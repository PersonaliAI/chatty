"""Provider-neutral OIDC JWT verification for self-host deployments."""

from __future__ import annotations

from typing import Any, Optional

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

from app.core.config import OIDC_AUDIENCE, OIDC_ISSUER_URL


def verify_oidc_jwt(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    if not OIDC_ISSUER_URL:
        raise HTTPException(status_code=503, detail="self-host identity provider is not configured")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        jwks = PyJWKClient(f"{OIDC_ISSUER_URL}/.well-known/jwks.json", cache_keys=True, lifespan=3600)
        key = jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256", "ES256"], audience=OIDC_AUDIENCE, issuer=OIDC_ISSUER_URL)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="invalid token") from exc
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="invalid token")
    return claims
