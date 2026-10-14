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

import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, HttpUrl

from app.core.clients import supabase
from app.core.config import FRONTEND_URL, FUNCTION_SECRET
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


class GenerateClaimBotRequest(BaseModel):
    target_name: str
    target_url: str
    primary_color: Optional[str] = "#0f172a"
    welcome_message: Optional[str] = None
    suggested_prompts: Optional[List[str]] = None
    system_instructions: Optional[str] = None
    model: Optional[str] = "gemini-2.5-flash"


class ClaimResponse(BaseModel):
    success: bool
    bot_id: str
    message: str
    dashboard_url: str


@router.get("/api/claim/{claim_token}")
async def get_claim_details(claim_token: str) -> dict[str, Any]:
    """Public endpoint to fetch sanitized demo bot info for prospective claimants."""
    token = claim_token.strip()
    if not token:
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

    suggested = bot.get("suggested_prompts") or [
        "What are your core features and plans?",
        "How do I get started?",
        "How does your product work?",
    ]

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
    if not token:
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

    new_user_id = user["auth_user_id"]
    user_email = user.get("email") or ""
    now_iso = datetime.now(timezone.utc).isoformat()

    # Atomically reassign bot ownership
    update_res = await run_db(
        lambda: supabase.table("chatty_bots")
        .update(
            {
                "user_id": new_user_id,
                "claim_status": "claimed",
                "claimed_at": now_iso,
                "claimed_by_email": user_email,
            }
        )
        .eq("id", bot_id)
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

    logger.info("Bot %s successfully claimed by %s (%s)", bot_id, user_email, new_user_id)

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

    # Delete the bot row; foreign keys cascade to sources, documents, vectors, sessions
    await run_db(lambda: supabase.table("chatty_bots").delete().eq("id", bot_id).execute())

    logger.info("Demo bot %s permanently declined and deleted via claim token %s", bot_id, token)

    return {
        "success": True,
        "message": f"Demo assistant '{bot.get('name')}' and all associated knowledge data have been permanently deleted.",
    }


@router.post("/api/claim/generate")
async def generate_claimable_bot(
    req: GenerateClaimBotRequest,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Creates a pre-configured demo bot ready for cold outreach claiming."""
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
        "selected_model": req.model or "gemini-2.5-flash",
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
