"""Visitor capability credentials, separate from customer signed identity.

Only hashes are stored. Never infer identity from email, host or session ID.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request

from app.core.clients import supabase
from app.core.crypto import decrypt_secret
from app.core.db import run_db

PROFILE_FIELDS = {"name", "email", "phone", "avatar_url", "custom_attributes"}
RESERVED = {"role", "roles", "permissions", "token", "secret", "password", "user_id", "bot_id", "contact_id", "identity_verified", "session_id"}


def validate_profile(profile: dict) -> dict:
    if set(profile) - PROFILE_FIELDS:
        raise ValueError("Unsupported profile field")
    clean = {}
    for key in PROFILE_FIELDS - {"custom_attributes"}:
        value = profile.get(key)
        if value is not None:
            if not isinstance(value, str) or len(value) > (2048 if key == "avatar_url" else 200):
                raise ValueError("Invalid profile value")
            if key == "avatar_url" and value and not value.startswith("https://"):
                raise ValueError("Avatar must use HTTPS")
            clean[key] = value
    attrs = profile.get("custom_attributes", {})
    if not isinstance(attrs, dict) or len(attrs) > 30:
        raise ValueError("Invalid custom attributes")
    for key, value in attrs.items():
        if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]{0,63}", key) or key.lower() in RESERVED:
            raise ValueError("Reserved or invalid attribute")
        if not (value is None or isinstance(value, (str, bool, int, float))) or isinstance(value, str) and len(value) > 500:
            raise ValueError("Attributes must be bounded scalar values")
    clean["custom_attributes"] = attrs
    if len(json.dumps(clean, allow_nan=False).encode()) > 8192:
        raise ValueError("Profile too large")
    return clean


def verify_identity(token: str, secret: str, bot_id: str) -> tuple[str, dict]:
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], audience=f"chatty:{bot_id}",
            issuer="chatty-customer", options={"require": ["sub", "iat", "exp", "aud", "iss"]})
        now = time.time()
        if not isinstance(claims["iat"], int) or not isinstance(claims["exp"], int) or not 0 < claims["exp"] - claims["iat"] <= 300 or claims["iat"] > now:
            raise ValueError("Invalid lifetime")
        sub = claims["sub"]
        if not isinstance(sub, str) or not sub.strip() or len(sub) > 200:
            raise ValueError("Invalid subject")
        return sub, validate_profile(claims.get("profile", {}))
    except (jwt.PyJWTError, ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(401, "Invalid or expired identity token") from exc


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def credential(bot_id: str, token: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token or ""):
        raise HTTPException(401, "Visitor credential required")
    rows = (await run_db(lambda: supabase.table("chatty_visitor_credentials").select("*")
        .eq("bot_id", bot_id).eq("token_hash", hash_token(token)).limit(1).execute())).data or []
    if not rows or rows[0].get("revoked_at") or datetime.fromisoformat(rows[0]["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(401, "Visitor credential expired or revoked")
    return rows[0]


async def create_visitor(bot_id: str, identity_token: str | None = None) -> dict:
    external, profile = None, {}
    if identity_token:
        settings = (await run_db(lambda: supabase.table("chatty_contact_identity_settings").select("signing_secret")
            .eq("bot_id", bot_id).limit(1).execute())).data or []
        if not settings:
            raise HTTPException(409, "Verified identity is not configured")
        external, profile = verify_identity(identity_token, decrypt_secret(settings[0]["signing_secret"]), bot_id)
    token, session = secrets.token_urlsafe(32), f"ci-{uuid.uuid4()}"
    expires = datetime.now(timezone.utc) + timedelta(days=30 if external is None else 1)
    await run_db(lambda: supabase.rpc("chatty_create_visitor", {
        "p_bot": bot_id, "p_external": external, "p_profile": profile,
        "p_hash": hash_token(token), "p_session": session, "p_expires": expires.isoformat(),
    }).execute())
    return {"visitor_token": token, "session_id": session, "expires_at": expires.isoformat(), "identity_verified": external is not None}


async def guard_widget_session(request: Request) -> None:
    """New capability sessions require their credential on *every* widget route.

    Legacy IDs stay compatible but are never adopted/merged by identity APIs.
    A token for one conversation cannot write/read another conversation.
    """
    values = dict(request.query_params)
    if request.method not in {"GET", "HEAD"}:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.json()
                if isinstance(body, dict):
                    values.update(body)
            except ValueError:
                return
        elif "multipart/form-data" in content_type:
            form = await request.form()
            values.update({k: v for k, v in form.items() if isinstance(v, str)})
    session = values.get("session_id")
    if request.url.path in {"/api/widget/poll", "/api/widget/live", "/api/widget/booking/active"} and session and not str(session).startswith("ci-"):
        raise HTTPException(401, "Upgrade to a credential-backed widget session")
    if not isinstance(session, str) or not session.startswith("ci-"):
        return
    row = await credential(str(values.get("bot_id", "")), request.headers.get("x-chatty-visitor", ""))
    if session.endswith("-search"):
        session = session[:-7]
    if row["session_id"] != session:
        bindings = (await run_db(lambda: supabase.table("chatty_visitor_credentials").select("contact_id")
            .eq("bot_id", row["bot_id"]).eq("session_id", session).limit(1).execute())).data or []
        if not bindings or bindings[0]["contact_id"] != row["contact_id"]:
            raise HTTPException(403, "Conversation credential mismatch")
    if request.url.path in {"/api/widget/chat", "/api/widget/chat/stream"}:
        contacts = (await run_db(lambda: supabase.table("chatty_contacts").select("external_user_id,profile")
            .eq("bot_id", row["bot_id"]).eq("id", row["contact_id"]).limit(1).execute())).data or []
        if contacts and not contacts[0].get("external_user_id"):
            profile = contacts[0].get("profile") or {}
            for source, target in (("visitor_name", "name"), ("visitor_email", "email")):
                value = values.get(source)
                if isinstance(value, str) and 0 < len(value.strip()) <= 200:
                    profile[target] = value.strip()
            await run_db(lambda: supabase.table("chatty_contacts").update({"profile": profile, "last_seen_at": datetime.now(timezone.utc).isoformat()})
                .eq("bot_id", row["bot_id"]).eq("id", row["contact_id"]).execute())
