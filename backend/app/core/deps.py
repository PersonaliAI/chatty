"""FastAPI dependencies for managed Supabase authentication."""

from __future__ import annotations

from typing import Any, Optional

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.core.clients import supabase
from app.core.config import SUPABASE_JWT_SECRET, SUPABASE_URL

_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=3600)


def verify_supabase_jwt(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    """Verify a Supabase access-token JWT using JWKS, with legacy HS256 fallback."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    last_err: Optional[Exception] = None
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        if claims.get("sub"):
            return claims
    except Exception as exc:  # noqa: BLE001 - fall through to legacy
        last_err = exc

    if SUPABASE_JWT_SECRET:
        try:
            claims = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            if claims.get("sub"):
                return claims
        except jwt.PyJWTError as exc:
            last_err = exc

    detail = f"invalid token: {last_err}" if last_err else "invalid token"
    raise HTTPException(status_code=401, detail=detail)


def get_user_by_auth_id(auth_user_id: str, email: Optional[str] = None) -> dict[str, Any]:
    res = (
        supabase.table("users")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        insert_data: dict[str, Any] = {"auth_user_id": auth_user_id}
        if email:
            insert_data["email"] = email.lower().strip()
        ins = supabase.table("users").insert(insert_data).execute()
        return ins.data[0]
    user = res.data[0]
    if email and not user.get("email"):
        clean_email = email.lower().strip()
        try:
            supabase.table("users").update({"email": clean_email}).eq("id", user["id"]).execute()
            user["email"] = clean_email
        except Exception:
            pass
    return user


def verify_bearer_jwt(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    return verify_supabase_jwt(authorization)


def require_user(claims: dict[str, Any] = Depends(verify_bearer_jwt)) -> dict[str, Any]:
    return get_user_by_auth_id(claims["sub"], email=claims.get("email"))


async def require_active_user(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    """Dependency that ensures the authenticated user has an active 14-day trial or paid subscription."""
    from app.services.chatty_quota_service import check_bot_owner_subscription
    sub = await check_bot_owner_subscription(user, user.get("auth_user_id"))
    if not sub.get("is_active"):
        raise HTTPException(
            status_code=402,
            detail=f"Subscription inactive ({sub.get('status')}): {sub.get('reason') or 'Please upgrade your plan to access this feature.'}",
        )
    return user


def get_monthly_token_usage(user_id: str) -> dict[str, Any]:
    """Return monthly token usage for a user. Defaults to 0 if not tracked."""
    return {"total_tokens": 0}
