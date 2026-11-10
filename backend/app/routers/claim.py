"""Claim & Transfer router for Chatty bots.

Enables:
  * Public inspection of pre-trained demo bots (/api/claim/{token})
  * 1-click ownership transfer to new users upon signup (/api/claim/{token})
  * Privacy-first GDPR data decline/delete (/api/claim/{token})
  * Admin / MCP generation of claimable demo bots (/api/claim/generate)
"""

from __future__ import annotations

import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

import json
import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, Request
from urllib.parse import urlparse
from pydantic import BaseModel, HttpUrl

import asyncio
from app.core.ssrf import assert_safe_url_async
from app.core.clients import supabase
from app.core.config import ADMIN_BYPASS_EMAILS, FRONTEND_URL, FUNCTION_SECRET
from app.core.db import run_db
from app.core.deps import require_user

logger = logging.getLogger("chatty")

router = APIRouter(tags=["Claim & Outreach"])

CLAIM_TOKEN_TTL_DAYS = 14
DEMO_WIDGET_TOKEN_TTL = 3600  # 1 hour for prospect playground sessions


def _mint_demo_widget_token(bot_id: str) -> str:
    payload = {
        "bot_id": bot_id,
        "verified": True,
        "demo": True,
        "exp": int(time.time()) + DEMO_WIDGET_TOKEN_TTL,
    }
    return jwt.encode(payload, FUNCTION_SECRET, algorithm="HS256")



class InstantSandboxRequest(BaseModel):
    url: str


_SANDBOX_RATE_LIMITS: dict[str, list[float]] = {}
_SANDBOX_MAX_PER_HOUR = 8


def _check_sandbox_rate_limit(client_ip: str):
    now = time.time()
    one_hour_ago = now - 3600
    timestamps = [t for t in _SANDBOX_RATE_LIMITS.get(client_ip, []) if t > one_hour_ago]
    if len(timestamps) >= _SANDBOX_MAX_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail="Demo creation limit reached for this hour. Please sign up for full access or try again shortly.",
        )
    timestamps.append(now)
    _SANDBOX_RATE_LIMITS[client_ip] = timestamps

class GenerateClaimBotRequest(BaseModel):
    target_name: str
    target_url: str
    primary_color: Optional[str] = "#0f172a"
    welcome_message: Optional[str] = None
    suggested_prompts: Optional[List[str]] = None
    system_instructions: Optional[str] = None
    model: Optional[str] = "gemma-4-31b"




def _heuristic_prompts_from_content(clean_name: str, content: str) -> list[str]:
    """Derive smart, context-appropriate demo questions based on keywords in crawled text."""
    lower = (content or "").lower()

    # Developer / API / Technical platform
    if any(k in lower for k in ("api", "sdk", "developer", "documentation", "endpoint", "webhook", "cli", "open-source", "github")):
        return [
            f"What core APIs and developer tools does {clean_name} offer?",
            f"How can I integrate {clean_name} into my application or workflow?",
            f"What are the pricing plans, SDKs, and documentation details?",
        ]

    # Search / AI / Cloud / Data platform
    if any(k in lower for k in ("search", "artificial intelligence", "ai model", "cloud compute", "analytics", "database", "llm", "ernie", "wenxin")):
        return [
            f"What products and AI services does {clean_name} provide?",
            f"What cloud, enterprise, or data solutions are available?",
            f"How do I access developer tools and APIs at {clean_name}?",
        ]

    # Healthcare / Clinic / Medical / Dental
    if any(k in lower for k in ("dental", "doctor", "patient", "clinic", "health", "appointment", "treatment", "medical", "hospital")):
        return [
            f"What treatments and healthcare services does {clean_name} provide?",
            f"How do I schedule an appointment or consultation?",
            f"What insurance plans or payment options do you accept?",
        ]

    # E-commerce / Retail with physical catalog/shipping
    if any(k in lower for k in ("add to cart", "checkout", "shipping policy", "return policy", "hoodie", "clothing", "apparel", "merchandise")):
        return [
            f"What products and collections does {clean_name} offer?",
            f"What are your shipping rates and return policies?",
            f"How can I track my order or contact customer care?",
        ]

    # Booking / Scheduling / Calendar
    if any(k in lower for k in ("booking", "calendar", "schedule", "meeting", "consultation")):
        return [
            f"How does scheduling and booking work with {clean_name}?",
            f"What calendar integrations (Google, Outlook, Zoom) are supported?",
            f"What are your plan options and core features?",
        ]

    # Default general B2B / SaaS
    return [
        f"What products or solutions does {clean_name} provide?",
        f"What are your core features, integrations, and plans?",
        f"How do I get started or contact your team?",
    ]


def _generate_initial_sandbox_prompts(clean_name: str, raw_url: str) -> list[str]:
    """Clean initial prompts before crawling completes, free of e-commerce assumptions."""
    return [
        f"What products or services does {clean_name} offer?",
        f"What are your core features, solutions, or plans?",
        f"How do I get started or contact support at {clean_name}?",
    ]


async def _extract_dynamic_prompts_from_content(bot_id: str, target_url: str, content: str) -> list[str]:
    """Use Gemini / LiteLLM to analyze trained site content and generate 3 sharp, specific questions."""
    parsed = urlparse(target_url)
    host = parsed.netloc.split(":")[0].lower().replace("www.", "")
    clean_name = host.split(".")[0].replace("-", " ").title()

    snippet = content[:4000].strip()
    if not snippet:
        return _heuristic_prompts_from_content(clean_name, content)

    try:
        from plugins import ai_client
        model = ai_client.resolve_gemini_model("gemini-2.5-flash")
        prompt = (
            f"You are analyzing website content for '{clean_name}' ({target_url}).\n"
            f"Website text excerpt:\n\"\"\"{snippet}\"\"\"\n\n"
            f"Generate exactly 3 specific, engaging questions a prospective customer or visitor would ask this business.\n"
            f"Rules:\n"
            f"1. Strictly grounded in what {clean_name} actually does based on the text.\n"
            f"2. Never mention shipping or returns unless this site sells physical goods.\n"
            f"3. Never ask to place an order unless it is an e-commerce shop with a cart.\n"
            f"4. Under 12 words per question, natural and punchy, ending with '?'.\n"
            f"5. Return ONLY a valid JSON list of 3 strings: [\"Question 1?\", \"Question 2?\", \"Question 3?\"]"
        )
        resp = await ai_client.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            bot_id=bot_id,
            call_type="claim_prompts",
        )
        raw = resp.choices[0].message.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed_list = json.loads(raw.strip())
        if isinstance(parsed_list, list) and len(parsed_list) >= 2:
            cleaned = [str(q).strip() for q in parsed_list if str(q).strip()][:4]
            if len(cleaned) >= 2:
                return cleaned
    except Exception as e:
        logger.warning("LLM dynamic prompt extraction failed for bot %s: %s", bot_id, e)

    return _heuristic_prompts_from_content(clean_name, content)

async def _crawl_demo_target_site(bot_id: str, target_url: str):
    """Background task to fetch and index the demo startup's site so the claimable
    assistant is pre-trained with real answers when the prospect opens the link."""
    try:
        await assert_safe_url_async(target_url)
        from main import _fetch_url_content
        content = await _fetch_url_content(target_url)
        if content and content.strip():
            await run_db(lambda: supabase.table("chatty_sources").insert({
                "bot_id": bot_id,
                "type": "url",
                "name": target_url,
                "content": content[:150000],
                "status": "trained",
                "char_count": len(content[:150000]),
            }).execute())
            logger.info("Successfully pre-trained demo bot %s (%d chars)", bot_id, len(content))

            # Dynamically generate and persist questions grounded in trained content
            dynamic_prompts = await _extract_dynamic_prompts_from_content(bot_id, target_url, content)
            if dynamic_prompts and len(dynamic_prompts) >= 2:
                try:
                    await run_db(lambda: supabase.table("chatty_bots").update({
                        "suggested_prompts": dynamic_prompts,
                    }).eq("id", bot_id).execute())
                    logger.info("Updated demo bot %s with %d dynamic prompts", bot_id, len(dynamic_prompts))
                except Exception:
                    logger.warning("Failed to update bot %s with dynamic prompts", bot_id)
    except Exception:
        logger.exception("Failed to pre-train demo bot %s", bot_id)

class ClaimResponse(BaseModel):
    success: bool
    bot_id: str
    message: str
    dashboard_url: str


@router.post("/api/claim/generate")
async def generate_claimable_bot(
    req: GenerateClaimBotRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Creates a pre-configured demo bot ready for cold outreach claiming."""
    email = (user.get("email") or "").strip().lower()
    role = (user.get("role") or "").strip().lower()
    is_admin = bool(
        email in ADMIN_BYPASS_EMAILS
        or role in ("admin", "superadmin", "super_admin")
        or user.get("is_admin")
    )
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only platform administrators can generate claimable outreach demo bots.",
        )

    claim_token = f"clm_{secrets.token_urlsafe(16)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=CLAIM_TOKEN_TTL_DAYS)).isoformat()

    prompts = req.suggested_prompts or [
        f"What is {req.target_name} and what problem does it solve?",
        "What are your pricing plans and features?",
        "How do I sign up or get started?",
    ]

    welcome = (
        req.welcome_message
        or f"Hello! I am {req.target_name}'s AI assistant. Ask me anything about our features, pricing, or docs."
    )

    system_inst = (
        req.system_instructions
        or f"You are the official customer support AI assistant for {req.target_name} ({req.target_url}). "
        f"Answer visitors accurately based on the company knowledge. Be polite, concise, and helpful."
    )

    row = {
        "user_id": user["auth_user_id"],
        "name": f"{req.target_name} Assistant",
        "welcome_message": welcome,
        "system_instructions": system_inst,
        "selected_model": req.model or "gemma-4-31b",
        "primary_color": req.primary_color or "#0f172a",
        "claim_token": claim_token,
        "claim_status": "unclaimed",
        "demo_target_name": req.target_name,
        "demo_target_url": req.target_url,
        "demo_expires_at": expires_at,
        "suggested_prompts": prompts,
    }

    res = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create claimable demo bot")

    created = res.data[0]
    bot_id = created["id"]
    if req.target_url:
        await assert_safe_url_async(req.target_url)
        # Always schedule as an asyncio task so background crawl runs concurrently
        # across both FastAPI HTTP requests and programmatic FastMCP tool calls
        asyncio.create_task(_crawl_demo_target_site(bot_id, req.target_url))

    base_frontend = (FRONTEND_URL or "https://chatty.personaliai.com").rstrip("/")
    claim_url = f"{base_frontend}/claim/{claim_token}"

    email_template = (
        f"Subject: Congrats on the launch! (+ pre-trained an AI assistant for {req.target_name})\n\n"
        f"Hi,\n\n"
        f"Congrats on launching {req.target_name}! Saw your launch and loved the concept.\n\n"
        f"Launch traffic usually brings dozens of repetitive visitor questions about pricing and features. "
        f"To help out, I ran {req.target_url} through Chatty and pre-trained a 24/7 AI support assistant on your site.\n\n"
        f"You can test it live with your team here (zero signup required):\n"
        f"{claim_url}\n\n"
        f"If you like how it answers, you can claim this assistant with 1 click and drop the 1-line script onto your site.\n\n"
        f"Best,\n"
        f"Founder, Chatty"
    )

    return {
        "success": True,
        "bot_id": bot_id,
        "claim_token": claim_token,
        "claim_url": claim_url,
        "demo_expires_at": expires_at,
        "email_template": email_template,
    }


@router.post("/api/claim/instant-sandbox")
async def create_instant_sandbox_bot(
    req: InstantSandboxRequest,
    request: Request,
) -> dict[str, Any]:
    """Public instant demo sandbox: parses prospect URL, launches safe crawler,
    and returns a claimable preview bot session in under 1 second.
    """
    raw_url = req.url.strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Please enter a valid website URL.")

    if not raw_url.startswith(("http://", "https://")):
        raw_url = f"https://{raw_url}"

    # Extract client IP for rate limiting & abuse prevention
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    _check_sandbox_rate_limit(client_ip)

    # SSRF verification to block internal/loopback/private IP ranges
    try:
        await assert_safe_url_async(raw_url)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate demo for private, local, or restricted network addresses.",
        )

    parsed = urlparse(raw_url)
    host = parsed.netloc.split(":")[0].lower()
    if host.startswith("www."):
        host = host[4:]

    # Friendly target name
    domain_part = host.split(".")[0] if "." in host else host
    clean_name = domain_part.replace("-", " ").replace("_", " ").title()
    if not clean_name:
        clean_name = "Store"

    # Reuse active demo bot for same URL if generated in last 2 hours
    cutoff_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    try:
        existing = await run_db(
            lambda: supabase.table("chatty_bots")
            .select("id, claim_token, demo_target_url, created_at")
            .eq("claim_status", "unclaimed")
            .eq("demo_target_url", raw_url)
            .gte("created_at", cutoff_time)
            .limit(1)
            .execute()
        )
        if existing.data and existing.data[0].get("claim_token"):
            bot = existing.data[0]
            claim_token = bot["claim_token"]
            return {
                "success": True,
                "bot_id": bot["id"],
                "claim_token": claim_token,
                "claim_url": f"/claim/{claim_token}",
                "target_name": clean_name,
                "reused": True,
            }
    except Exception:
        pass

    claim_token = f"clm_{secrets.token_urlsafe(16)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    prompts = _generate_initial_sandbox_prompts(clean_name, raw_url)

    welcome = (
        f"Hi there! I am the automated customer assistant for {clean_name}. "
        f"I've been pre-trained on {host}. How can I help you today?"
    )

    system_inst = (
        f"You are the official customer operations AI assistant for {clean_name} ({raw_url}). "
        f"Answer visitors accurately based only on information from the company website. "
        f"Be helpful, polite, and concise. If information is not found on the website, state so clearly."
    )

    row = {
        "user_id": None,
        "name": f"{clean_name} Assistant",
        "welcome_message": welcome,
        "system_instructions": system_inst,
        "selected_model": "gemini",
        "primary_color": "#c67139",
        "claim_token": claim_token,
        "claim_status": "unclaimed",
        "demo_target_name": clean_name,
        "demo_target_url": raw_url,
        "demo_expires_at": expires_at,
        "suggested_prompts": prompts,
    }

    res = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Could not initialize instant sandbox assistant.")

    created = res.data[0]
    bot_id = created["id"]

    # Start asynchronous background scraping
    asyncio.create_task(_crawl_demo_target_site(bot_id, raw_url))

    return {
        "success": True,
        "bot_id": bot_id,
        "claim_token": claim_token,
        "claim_url": f"/claim/{claim_token}",
        "target_name": clean_name,
        "reused": False,
    }



@router.get("/api/claim/{claim_token}")
async def get_claim_details(claim_token: str) -> dict[str, Any]:
    """Public endpoint to fetch sanitized demo bot info for prospective claimants."""
    token = claim_token.strip()
    if not token or token.lower() in ("generate", "create", "new", "instant-sandbox"):
        raise HTTPException(status_code=400, detail="Invalid claim token")

    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select(
            "id, name, welcome_message, primary_color, avatar_url, avatar_icon, "
            "claim_status, claimed_at, demo_target_name, demo_target_url, "
            "demo_expires_at, suggested_prompts, created_at"
        )
        .eq("claim_token", token)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Demo bot not found or claim link is invalid.")

    bot = res.data[0]
    status = bot.get("claim_status") or "unclaimed"

    if status == "declined":
        raise HTTPException(
            status_code=410,
            detail="This demo bot was declined and its data was permanently deleted.",
        )

    # Check expiration
    expires_at = bot.get("demo_expires_at")
    if expires_at and status == "unclaimed":
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(
                    status_code=410,
                    detail="This demo bot link has expired. Please contact us to generate a fresh preview.",
                )
        except (ValueError, TypeError):
            pass

    # Fetch indexed sources count and names
    bot_id = bot["id"]
    sources_res = await run_db(
        lambda: supabase.table("chatty_sources")
        .select("name, type, status, char_count")
        .eq("bot_id", bot_id)
        .limit(20)
        .execute()
    )
    sources = sources_res.data or []

    # Mint a signed widget origin token so the prospect can chat with 0 restrictions
    widget_token = _mint_demo_widget_token(bot_id)

    suggested = bot.get("suggested_prompts") or []
    has_stale_generic = any(
        "shipping, or return policies" in p or "place an order" in p
        for p in suggested
    )
    if has_stale_generic or not suggested:
        source_text = ""
        for s in sources:
            if s.get("content"):
                source_text = s["content"]
                break
        target_name = bot.get("demo_target_name") or bot.get("name") or "Your Startup"
        if source_text:
            dynamic = _heuristic_prompts_from_content(target_name, source_text)
            if dynamic:
                suggested = dynamic
                # Cache dynamic prompts to database asynchronously
                asyncio.create_task(
                    run_db(lambda: supabase.table("chatty_bots").update({"suggested_prompts": dynamic}).eq("id", bot_id).execute())
                )
        else:
            suggested = _generate_initial_sandbox_prompts(target_name, bot.get("demo_target_url") or "")

    return {
        "status": status,
        "bot_id": bot_id,
        "name": bot.get("name") or "AI Assistant",
        "welcome_message": bot.get("welcome_message") or "Hi! How can I help you today?",
        "primary_color": bot.get("primary_color") or "#0f172a",
        "avatar_url": bot.get("avatar_url"),
        "avatar_icon": bot.get("avatar_icon") or "bot",
        "demo_target_name": bot.get("demo_target_name") or bot.get("name") or "Your Startup",
        "demo_target_url": bot.get("demo_target_url") or "",
        "suggested_prompts": suggested,
        "sources_count": len(sources),
        "sources_sample": [s["name"] for s in sources[:6]],
        "demo_expires_at": bot.get("demo_expires_at"),
        "widget_token": widget_token,
    }


@router.post("/api/claim/{claim_token}")
async def claim_bot(
    claim_token: str,
    user: dict[str, Any] = Depends(require_user),
) -> ClaimResponse:
    """Authenticated endpoint that transfers bot ownership to the logged-in user."""
    token = claim_token.strip()
    if not token or token.lower() in ("generate", "create", "new", "instant-sandbox"):
        raise HTTPException(status_code=400, detail="Invalid claim token")

    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id, name, user_id, claim_status, demo_expires_at")
        .eq("claim_token", token)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Demo bot not found")

    bot = res.data[0]
    bot_id = bot["id"]
    current_status = bot.get("claim_status") or "unclaimed"

    if current_status == "claimed":
        # If already claimed by THIS user, let them through gracefully
        if bot.get("user_id") == user["auth_user_id"]:
            return ClaimResponse(
                success=True,
                bot_id=bot_id,
                message="You already claimed this assistant.",
                dashboard_url=f"/dashboard?bot_id={bot_id}&tab=customizer&claimed=1",
            )
        raise HTTPException(status_code=409, detail="This bot has already been claimed by another user.")

    if current_status == "declined":
        raise HTTPException(status_code=410, detail="This bot was declined and deleted.")

    expires_at_str = bot.get("demo_expires_at")
    if expires_at_str:
        try:
            exp = datetime.fromisoformat(str(expires_at_str).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=410, detail="This claim link has expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    new_user_id = user["auth_user_id"]
    user_email = user.get("email") or ""
    now_iso = datetime.now(timezone.utc).isoformat()

    # Atomically reassign bot ownership and clear claim_token
    update_res = await run_db(
        lambda: supabase.table("chatty_bots")
        .update(
            {
                "user_id": new_user_id,
                "claim_status": "claimed",
                "claimed_at": now_iso,
                "claimed_by_email": user_email,
                "claim_token": None,
            }
        )
        .eq("id", bot_id)
        .eq("claim_status", "unclaimed")
        .execute()
    )

    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to transfer bot ownership")

    # Ensure the user has an owner/admin team member entry
    try:
        await run_db(
            lambda: supabase.table("chatty_team_members")
            .upsert(
                {
                    "bot_id": bot_id,
                    "email": user_email,
                    "role": "admin",
                },
                on_conflict="bot_id,email",
            )
            .execute()
        )
    except Exception:
        logger.warning("Could not upsert team member record during claim for bot %s", bot_id)

    logger.info("Bot %s successfully claimed", bot_id)

    return ClaimResponse(
        success=True,
        bot_id=bot_id,
        message="Assistant successfully transferred to your account!",
        dashboard_url=f"/dashboard?bot_id={bot_id}&tab=customizer&claimed=1",
    )


@router.delete("/api/claim/{claim_token}")
async def decline_and_delete_demo_bot(claim_token: str) -> dict[str, Any]:
    """GDPR / Privacy self-service: instantly removes demo bot and all crawled vectors."""
    token = claim_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Invalid claim token")

    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id, name, claim_status")
        .eq("claim_token", token)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Demo bot not found")

    bot = res.data[0]
    bot_id = bot["id"]

    if bot.get("claim_status") == "claimed":
        raise HTTPException(status_code=403, detail="Cannot discard an already claimed bot")

    # Delete the bot row; foreign keys cascade to sources, documents, vectors, sessions
    await run_db(lambda: supabase.table("chatty_bots").delete().eq("id", bot_id).eq("claim_status", "unclaimed").execute())

    logger.info("Demo bot %s permanently declined and deleted", bot_id)

    return {
        "success": True,
        "message": f"Demo assistant '{bot.get('name')}' and all associated knowledge data have been permanently deleted.",
    }


