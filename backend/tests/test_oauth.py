"""Unit tests for app/core/oauth.py — PKCE verification, token hashing, and
the resolve_access_token / require_bot_access security checks. Supabase
calls are mocked (MagicMock chains), matching test_onboarding.py's pattern
for DB-touching code — no real network/DB access. Async functions are
driven with asyncio.run(...), matching test_widget_brain.py/test_uploads.py
rather than pytest-asyncio (not installed/configured in this repo).
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main
from app.core import oauth


# ---------------------------------------------------------------------------
# PKCE (RFC 7636)
# ---------------------------------------------------------------------------


def _s256_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def test_pkce_accepts_matching_verifier():
    verifier = "a" * 43  # RFC 7636 minimum length
    challenge = _s256_challenge(verifier)
    assert oauth.verify_pkce(verifier, challenge, "S256") is True


def test_pkce_rejects_wrong_verifier():
    challenge = _s256_challenge("a" * 43)
    assert oauth.verify_pkce("b" * 43, challenge, "S256") is False


def test_pkce_rejects_missing_verifier_when_challenge_was_used():
    challenge = _s256_challenge("a" * 43)
    assert oauth.verify_pkce(None, challenge, "S256") is False


def test_pkce_rejects_plain_method():
    # Only S256 is accepted — "plain" is a downgrade that defeats PKCE's point.
    verifier = "a" * 43
    assert oauth.verify_pkce(verifier, verifier, "plain") is False


def test_pkce_ok_when_no_challenge_and_no_verifier():
    # A client that didn't use PKCE at /authorize time must not supply a
    # verifier at /token time either — anything else is a mismatch.
    assert oauth.verify_pkce(None, None, None) is True


def test_pkce_rejects_verifier_when_no_challenge_was_registered():
    assert oauth.verify_pkce("a" * 43, None, None) is False


# ---------------------------------------------------------------------------
# Token/code/client-id generation shape
# ---------------------------------------------------------------------------


def test_generated_ids_have_expected_prefixes_and_are_unique():
    assert oauth.new_client_id().startswith(oauth._CLIENT_ID_PREFIX)
    assert oauth.new_client_secret().startswith(oauth._CLIENT_SECRET_PREFIX)
    assert oauth.new_client_id() != oauth.new_client_id()
    assert oauth.new_authorization_code() != oauth.new_authorization_code()


def test_hash_token_is_deterministic_and_not_reversible_length():
    h1 = oauth.hash_token("chatty_oat_abc123")
    h2 = oauth.hash_token("chatty_oat_abc123")
    assert h1 == h2
    assert h1 != "chatty_oat_abc123"
    assert len(h1) == 64  # sha256 hex digest


# ---------------------------------------------------------------------------
# resolve_access_token
# ---------------------------------------------------------------------------


def _mock_select_result(rows):
    """Mocks supabase.table(...).select(...).eq(...).execute() — the exact
    chain both resolve_access_token and require_bot_access use."""
    result = MagicMock()
    result.data = rows
    query = MagicMock()
    query.select.return_value.eq.return_value.execute.return_value = result
    return query


def test_resolve_access_token_rejects_missing_header():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(oauth.resolve_access_token(None))
    assert exc.value.status_code == 401


def test_resolve_access_token_rejects_non_oauth_token_shape():
    # A chatty_sk_ API key (or anything else) handed to the OAuth resolver
    # specifically, not the unified resolve_principal — must not validate.
    with pytest.raises(HTTPException) as exc:
        asyncio.run(oauth.resolve_access_token("Bearer chatty_sk_notanoauthtoken"))
    assert exc.value.status_code == 401


def test_resolve_access_token_rejects_unknown_token():
    query = _mock_select_result([])
    with patch.object(oauth.supabase, "table", return_value=query):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(oauth.resolve_access_token("Bearer chatty_oat_doesnotexist"))
    assert exc.value.status_code == 401


def test_resolve_access_token_rejects_revoked_token():
    row = {"revoked": True, "access_expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}
    query = _mock_select_result([row])
    with patch.object(oauth.supabase, "table", return_value=query):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(oauth.resolve_access_token("Bearer chatty_oat_revoked"))
    assert exc.value.status_code == 401
    assert "revoked" in exc.value.detail.lower()


def test_resolve_access_token_rejects_expired_token():
    row = {"revoked": False, "access_expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
    query = _mock_select_result([row])
    with patch.object(oauth.supabase, "table", return_value=query):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(oauth.resolve_access_token("Bearer chatty_oat_expired"))
    assert exc.value.status_code == 401
    assert "expired" in exc.value.detail.lower()


def test_resolve_access_token_accepts_valid_token():
    row = {
        "revoked": False,
        "access_expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "user_id": "user-123",
        "scope": "read write",
    }
    query = _mock_select_result([row])
    with patch.object(oauth.supabase, "table", return_value=query):
        result = asyncio.run(oauth.resolve_access_token("Bearer chatty_oat_valid"))
    assert result["user_id"] == "user-123"


# ---------------------------------------------------------------------------
# check_principal_scope
# ---------------------------------------------------------------------------


def test_check_principal_scope_allows_granted_scope():
    oauth.check_principal_scope({"scopes": ["read", "write"]}, "read")  # must not raise


def test_check_principal_scope_admin_satisfies_anything():
    oauth.check_principal_scope({"scopes": ["admin"]}, "write")  # must not raise


def test_check_principal_scope_rejects_missing_scope():
    with pytest.raises(HTTPException) as exc:
        oauth.check_principal_scope({"scopes": ["read"]}, "write")
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# require_bot_access — the actual multi-tenancy boundary: an OAuth token for
# user A must never be able to read/write user B's bot, and an API key must
# never reach any bot but the one it was minted for.
# ---------------------------------------------------------------------------


def test_require_bot_access_api_key_rejects_wrong_bot():
    principal = {"auth_type": "api_key", "bot_id": "bot-A"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(oauth.require_bot_access(principal, "bot-B"))
    assert exc.value.status_code == 403


def test_require_bot_access_api_key_allows_own_bot():
    principal = {"auth_type": "api_key", "bot_id": "bot-A"}
    query = _mock_select_result([{"id": "bot-A", "user_id": "user-1"}])
    with patch.object(oauth.supabase, "table", return_value=query):
        bot = asyncio.run(oauth.require_bot_access(principal, "bot-A"))
    assert bot["id"] == "bot-A"


def test_require_bot_access_oauth_rejects_other_users_bot():
    principal = {"auth_type": "oauth", "user_id": "user-1"}
    query = _mock_select_result([{"id": "bot-X", "user_id": "someone-else"}])
    with patch.object(oauth.supabase, "table", return_value=query):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(oauth.require_bot_access(principal, "bot-X"))
    assert exc.value.status_code == 404  # not 403 — don't confirm the bot exists to a non-owner


def test_require_bot_access_oauth_allows_own_bot():
    principal = {"auth_type": "oauth", "user_id": "user-1"}
    query = _mock_select_result([{"id": "bot-X", "user_id": "user-1"}])
    with patch.object(oauth.supabase, "table", return_value=query):
        bot = asyncio.run(oauth.require_bot_access(principal, "bot-X"))
    assert bot["id"] == "bot-X"


def test_require_bot_access_rejects_nonexistent_bot():
    principal = {"auth_type": "oauth", "user_id": "user-1"}
    query = _mock_select_result([])
    with patch.object(oauth.supabase, "table", return_value=query):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(oauth.require_bot_access(principal, "no-such-bot"))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Route wiring — real HTTP requests through the actual FastAPI app, catching
# the class of bug unit tests can't (wrong path, Form() vs JSON body
# mismatch, response model errors) without needing a full DB-backed flow.
# ---------------------------------------------------------------------------


def _mock_insert_result(row):
    result = MagicMock()
    result.data = [row]
    query = MagicMock()
    query.insert.return_value.execute.return_value = result
    return query


def test_well_known_authorization_server_metadata_is_served():
    client = TestClient(main.app)
    r = client.get("/.well-known/oauth-authorization-server")
    assert r.status_code == 200
    body = r.json()
    assert body["authorization_endpoint"].endswith("/oauth/authorize")
    assert body["token_endpoint"].endswith("/oauth/token")
    assert "S256" in body["code_challenge_methods_supported"]


def test_well_known_protected_resource_metadata_is_served_at_both_paths():
    # Explicit routes in oauth.py, not just FastMCP's own auto-registration
    # (see oauth.py's comment on this pair) — TestClient and the real
    # deployed service disagreed about which of these FastMCP alone would
    # serve, so both are covered explicitly rather than depending on either.
    client = TestClient(main.app)
    for path in ("/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert r.json()["resource"].endswith("/mcp")


def test_register_client_rejects_non_https_redirect_uri():
    client = TestClient(main.app)
    r = client.post("/oauth/register", json={
        "client_name": "Evil App",
        "redirect_uris": ["http://evil.example.com/callback"],
    })
    assert r.status_code == 400


def test_register_client_accepts_loopback_redirect_uri_for_native_clients():
    client = TestClient(main.app)
    query = _mock_insert_result({"id": "row-1"})
    with patch.object(oauth.supabase, "table", return_value=query):
        r = client.post("/oauth/register", json={
            "client_name": "My CLI Tool",
            "redirect_uris": ["http://127.0.0.1:54321/callback"],
        })
    assert r.status_code == 200
    body = r.json()
    assert body["client_id"].startswith(oauth._CLIENT_ID_PREFIX)
    assert body["token_endpoint_auth_method"] == "none"
    assert body["client_secret"] is None  # public/PKCE client — no secret issued


def test_token_endpoint_rejects_unsupported_grant_type():
    client = TestClient(main.app)
    r = client.post("/oauth/token", data={"grant_type": "password"})
    assert r.status_code == 400


def test_token_endpoint_requires_form_encoding_not_json():
    # RFC 6749 §3.2 mandates application/x-www-form-urlencoded; a JSON body
    # (which is what a hand-rolled client might mistakenly send) must be
    # rejected as a validation error, not silently misparsed.
    client = TestClient(main.app)
    r = client.post("/oauth/token", json={"grant_type": "authorization_code"})
    assert r.status_code == 422


def test_create_bot_requires_oauth_not_api_key():
    # A single-bot API key must never be able to create additional bots —
    # bot creation only makes sense for a user-scoped OAuth principal.
    async def fake_resolve_api_key(*_args, **_kwargs):
        return {"id": "key-1", "bot_id": "bot-1", "user_id": "user-1", "revoked": False, "scopes": ["admin"]}

    client = TestClient(main.app)
    with patch("main._resolve_api_key", new=fake_resolve_api_key):
        r = client.post(
            "/api/v1/bots",
            json={"name": "New Bot"},
            headers={"Authorization": "Bearer chatty_sk_sometestkey"},
        )
    assert r.status_code == 403
    assert "OAuth2" in r.json()["detail"]
