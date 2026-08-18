"""FastAPI dependencies — Supabase session-JWT verification and the
`require_user` dependency routes use to get the authenticated user's row.
"""

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
    """Verify a Supabase access-token JWT.

    Supabase projects can sign tokens two ways:
      * Legacy: HS256 with a shared `SUPABASE_JWT_SECRET`.
      * New: ES256/RS256 with rotating keys exposed via JWKS.

    We try JWKS first (the modern path), and fall back to the shared secret
    only if JWKS isn't available. Either way the JWT must have `aud=authenticated`.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    last_err: Optional[Exception] = None

    # 1) Asymmetric (JWKS)
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
    except Exception as exc:  # noqa: BLE001 — fall through to legacy
        last_err = exc

    # 2) Legacy HS256 with shared secret
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

    detail = "invalid token"
    if last_err:
        detail = f"invalid token: {last_err}"
    raise HTTPException(status_code=401, detail=detail)


def get_user_by_auth_id(auth_user_id: str) -> dict[str, Any]:
    res = (
        supabase.table("users")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        ins = supabase.table("users").insert({"auth_user_id": auth_user_id}).execute()
        return ins.data[0]
    return res.data[0]


def require_user(claims: dict[str, Any] = Depends(verify_supabase_jwt)) -> dict[str, Any]:
    return get_user_by_auth_id(claims["sub"])
