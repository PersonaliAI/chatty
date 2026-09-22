"""FastAPI dependencies - Supabase session-JWT verification and the
`require_user` dependency routes use to get the authenticated user's row.
"""

from __future__ import annotations

from typing import Any, Optional
import os
import uuid

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.core.clients import supabase
from app.core.config import DEPLOYMENT_PROFILE, SUPABASE_JWT_SECRET, SUPABASE_URL
from app.core.db_pool import connection
from app.core.oidc import verify_oidc_jwt

_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client = (
    PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=3600)
    if SUPABASE_URL
    else None
)


def _self_host_subject_uuid(subject: str) -> uuid.UUID:
    """Map an OIDC subject to a stable UUID for the portable SQL schema."""
    issuer = os.environ.get("OIDC_ISSUER_URL", "").rstrip("/")
    return uuid.uuid5(uuid.NAMESPACE_URL, f"chatty:{issuer}:{subject}")


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
        if _jwks_client is None:
            raise RuntimeError("Supabase JWT verifier is disabled")
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
    if DEPLOYMENT_PROFILE == "self_host":
        from psycopg2.extras import RealDictCursor

        canonical_id = _self_host_subject_uuid(auth_user_id)
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE auth_user_id = %s LIMIT 1", (str(canonical_id),))
                row = cur.fetchone()
                if row:
                    return dict(row)
                cur.execute(
                    """
                    INSERT INTO auth.users (id, email, raw_user_meta_data)
                    VALUES (%s, %s, %s::jsonb)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (str(canonical_id), None, "{}"),
                )
                cur.execute(
                    """
                    INSERT INTO users (auth_user_id)
                    VALUES (%s)
                    ON CONFLICT (auth_user_id) DO UPDATE SET updated_at = NOW()
                    RETURNING *
                    """,
                    (str(canonical_id),),
                )
                return dict(cur.fetchone())

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


def verify_bearer_jwt(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    if DEPLOYMENT_PROFILE == "self_host":
        return verify_oidc_jwt(authorization)
    return verify_supabase_jwt(authorization)


def require_user(claims: dict[str, Any] = Depends(verify_bearer_jwt)) -> dict[str, Any]:
    user = get_user_by_auth_id(claims["sub"])
    # OIDC claims are the source of identity attributes in self-host mode.
    # Overlay only non-sensitive display fields so team authorization can use
    # the IdP email without trusting arbitrary request data or changing the
    # managed Supabase path.
    if DEPLOYMENT_PROFILE == "self_host":
        for field in ("email", "display_name"):
            if claims.get(field) and not user.get(field):
                user[field] = claims[field]
    return user
