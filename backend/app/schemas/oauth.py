from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ClientRegistrationRequest(BaseModel):
    """RFC 7591 Dynamic Client Registration — the subset MCP clients (e.g.
    Claude Desktop) actually send. Unrecognized fields are accepted and
    ignored rather than rejected, per the RFC's own extensibility guidance."""
    client_name: str
    redirect_uris: list[str]
    token_endpoint_auth_method: Optional[str] = "none"  # "none" = public/PKCE client


class ClientRegistrationResponse(BaseModel):
    client_id: str
    client_secret: Optional[str] = None
    client_name: str
    redirect_uris: list[str]
    token_endpoint_auth_method: str


class AuthorizeDecisionRequest(BaseModel):
    client_id: str
    redirect_uri: str
    scope: str = "chat read"
    state: Optional[str] = None
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = None
    approve: bool = True


class TokenRequest(BaseModel):
    grant_type: str
    code: Optional[str] = None
    redirect_uri: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    code_verifier: Optional[str] = None
    refresh_token: Optional[str] = None
