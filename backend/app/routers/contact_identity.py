"""Private contact configuration and public capability exchange."""
from __future__ import annotations

import secrets
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.core.clients import supabase
from app.core.crypto import encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from app.services.contact_identity import create_visitor, credential, hash_token

router = APIRouter()
VISITOR_COOKIE_NAME = "chatty_visitor"

def _legacy_visitor_cookie(bot_id: str) -> str:
    # Keep the cookie name bot-specific while accepting only the canonical UUID
    # alphabet. The validated match prevents attributes or separators from
    # reaching Starlette's Set-Cookie serializer.
    match = re.fullmatch(
        r"([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
        str(bot_id),
        re.IGNORECASE,
    )
    canonical_bot_id = match.group(1).replace("-", "").lower() if match else "invalid"
    return f"chatty_visitor_{canonical_bot_id}"

def _visitor_token(request: Request, bot_id: str) -> str:
    # New writes use one fixed cookie key. Keep reading the previous
    # per-bot key so existing visitors are not logged out by the migration.
    return request.cookies.get(VISITOR_COOKIE_NAME, "") or request.cookies.get(_legacy_visitor_cookie(bot_id), "")

def _set_visitor_cookie(response: Response, bot_id: str, token: str, expires_at: str, request: Request) -> None:
    expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    max_age = max(0, int((expiry - datetime.now(timezone.utc)).total_seconds()))
    token_match = re.fullmatch(r"[A-Za-z0-9_-]{1,512}", token or "")
    safe_token = token_match.group(0) if token_match else ""
    response.set_cookie(VISITOR_COOKIE_NAME, safe_token, max_age=max_age, expires=max_age,
        httponly=True, secure=request.url.scheme == "https",
        samesite="none" if request.url.scheme == "https" else "lax", path="/api/widget")


class VisitorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bot_id: str = Field(min_length=36, max_length=36)
    identity_token: str | None = Field(default=None, max_length=16000)
    new_conversation: bool = False


async def owner(bot_id: str, user: dict) -> None:
    rows = (await run_db(lambda: supabase.table("chatty_bots").select("id")
        .eq("id", bot_id).eq("user_id", user["auth_user_id"]).limit(1).execute())).data
    if not rows:
        raise HTTPException(403, "Bot owner access required")


@router.get("/api/admin/inbox/identity-settings")
async def identity_settings(bot_id: str, user: dict = Depends(require_user)):
    await owner(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_contact_identity_settings").select("bot_id,updated_at")
        .eq("bot_id", bot_id).limit(1).execute())).data or []
    return {"configured": bool(rows), "updated_at": rows[0]["updated_at"] if rows else None}


@router.post("/api/admin/inbox/identity-settings/rotate")
async def rotate_identity(body: VisitorRequest, response: Response, user: dict = Depends(require_user)):
    await owner(body.bot_id, user)
    secret = secrets.token_urlsafe(48)
    await run_db(lambda: supabase.rpc("chatty_rotate_identity", {"p_bot": body.bot_id, "p_secret": encrypt_secret(secret)}).execute())
    from app.routers.admin import _write_admin_audit_log
    await _write_admin_audit_log(body.bot_id, "website_identity_key_rotated", "Rotated website identity signing key and revoked visitor credentials", user)
    response.headers["Cache-Control"] = "no-store"
    return {"signing_secret": secret}


@router.post("/api/widget/identity")
async def visitor_identity(body: VisitorRequest, request: Request, response: Response):
    from main import _client_ip, _rate_limited_async
    if await _rate_limited_async(f"identity:{body.bot_id}:{_client_ip(request)}", 20, 60):
        raise HTTPException(429, "Too many identity requests")
    bots = (await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", body.bot_id).limit(1).execute())).data
    if not bots:
        raise HTTPException(404, "Bot not found")
    old_token = request.headers.get("x-chatty-visitor", "") or _visitor_token(request, body.bot_id)
    old_row = await credential(body.bot_id, old_token) if old_token else None
    if body.new_conversation:
        if not old_row or body.identity_token:
            raise HTTPException(400, "Existing visitor credential required")
        token, session = secrets.token_urlsafe(32), f"ci-{uuid.uuid4()}"
        await run_db(lambda: supabase.table("chatty_visitor_credentials").insert({
            "token_hash": hash_token(token), "bot_id": body.bot_id, "contact_id": old_row["contact_id"],
            "session_id": session, "expires_at": old_row["expires_at"],
            "family_id": old_row["family_id"],
        }).execute())
        _set_visitor_cookie(response, body.bot_id, token, old_row["expires_at"], request)
        response.headers["Cache-Control"] = "no-store"
        return {"visitor_token": token, "session_id": session, "expires_at": old_row["expires_at"]}
    # Returning visitors retain the same credential; identify always creates a
    # fresh session, leaving the anonymous transcript unmerged.
    if old_row and not body.identity_token:
        row = old_row
        _set_visitor_cookie(response, body.bot_id, old_token, row["expires_at"], request)
        response.headers["Cache-Control"] = "no-store"
        return {"visitor_token": old_token, "session_id": row["session_id"], "expires_at": row["expires_at"]}
    result = await create_visitor(body.bot_id, body.identity_token)
    if old_token:
        await run_db(lambda: supabase.table("chatty_visitor_credentials").update({"revoked_at": datetime.now(timezone.utc).isoformat()})
            .eq("bot_id", body.bot_id).eq("family_id", old_row["family_id"]).execute())
    _set_visitor_cookie(response, body.bot_id, result["visitor_token"], result["expires_at"], request)
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/api/widget/identity/logout")
async def visitor_logout(body: VisitorRequest, request: Request, response: Response):
    row = await credential(body.bot_id, request.headers.get("x-chatty-visitor", "") or _visitor_token(request, body.bot_id))
    await run_db(lambda: supabase.table("chatty_visitor_credentials").update({"revoked_at": datetime.now(timezone.utc).isoformat()})
        .eq("bot_id", body.bot_id).eq("family_id", row["family_id"]).execute())
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie(VISITOR_COOKIE_NAME, path="/api/widget")
    return {"ok": True}


@router.get("/api/widget/identity/history")
async def visitor_history(bot_id: str, request: Request, response: Response):
    row = await credential(bot_id, request.headers.get("x-chatty-visitor", "") or _visitor_token(request, bot_id))
    bindings = (await run_db(lambda: supabase.table("chatty_visitor_credentials").select("session_id")
        .eq("bot_id", bot_id).eq("contact_id", row["contact_id"]).limit(100).execute())).data or []
    ids = [binding["session_id"] for binding in bindings]
    sessions = (await run_db(lambda: supabase.table("chatty_sessions").select("session_id,channel,last_message_at,last_message,status")
        .eq("bot_id", bot_id).in_("session_id", ids).order("last_message_at", desc=True).limit(50).execute())).data or []
    response.headers["Cache-Control"] = "no-store"
    return {"conversations": sessions}


@router.get("/api/widget/identity/messages")
async def visitor_messages(bot_id: str, session_id: str, request: Request, response: Response):
    from app.services.contact_identity import guard_widget_session
    if not session_id.startswith("ci-"):
        raise HTTPException(403, "Legacy conversations cannot be adopted")
    await guard_widget_session(request)
    rows = (await run_db(lambda: supabase.table("chatty_conversations").select("role,content,sender,sender_name,sender_avatar,created_at")
        .eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=False).limit(100).execute())).data or []
    response.headers["Cache-Control"] = "no-store"
    return {"messages": rows}


@router.get("/api/admin/inbox/contacts/export")
async def export_contacts(bot_id: str, response: Response, user: dict = Depends(require_user)):
    await owner(bot_id, user)
    response.headers["Cache-Control"] = "no-store"
    rows = (await run_db(lambda: supabase.table("chatty_contacts").select("*").eq("bot_id", bot_id).limit(50000).execute())).data or []
    return {"contacts": rows}


@router.delete("/api/admin/inbox/contacts/{contact_id}")
async def erase_contact(contact_id: str, bot_id: str, user: dict = Depends(require_user)):
    await owner(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_contacts").select("id")
        .eq("bot_id", bot_id).eq("id", contact_id).limit(1).execute())).data or []
    if not rows:
        raise HTTPException(404, "Contact not found")
    await run_db(lambda: supabase.rpc("chatty_erase_contact", {"p_bot": bot_id, "p_contact": contact_id}).execute())
    from app.routers.admin import _write_admin_audit_log
    await _write_admin_audit_log(bot_id, "website_contact_erased", f"Erased contact {contact_id} and bound chat records", user)
    return {"ok": True}
