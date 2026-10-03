"""Security boundary tests for signed customer identity and widget capabilities."""
import asyncio
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import jwt
import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

import main  # initialize router imports
from app.services import contact_identity as identity
from app.routers import contact_identity as routes, admin
from test_admin import _RecordingSupabase

BOT = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
TOKEN = "a" * 43
SECRET = "test-only-signing-secret-not-a-production-secret"


def signed(**changes):
    now = int(time.time())
    claims = {"sub": "customer-123", "iat": now, "exp": now + 120,
              "aud": f"chatty:{BOT}", "iss": "chatty-customer", "profile": {"name": "Sam", "custom_attributes": {"plan": "pro"}}}
    claims.update(changes)
    return jwt.encode(claims, SECRET, algorithm="HS256")


def request(session="ci-owned", token=TOKEN, bot=BOT):
    query = f"bot_id={bot}&session_id={session}".encode()
    return Request({"type": "http", "method": "GET", "path": "/api/widget/poll", "query_string": query,
                    "headers": [(b"x-chatty-visitor", token.encode())]})


def binding(**changes):
    row = {"bot_id": BOT, "token_hash": identity.hash_token(TOKEN), "session_id": "ci-owned", "contact_id": "contact-a",
           "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}
    row.update(changes)
    return row


def test_signed_identity_accepts_only_server_asserted_profile():
    sub, profile = identity.verify_identity(signed(), SECRET, BOT)
    assert sub == "customer-123" and profile["custom_attributes"] == {"plan": "pro"}


@pytest.mark.parametrize("changes", [
    {"aud": "chatty:other-bot"}, {"iss": "evil"}, {"exp": 1}, {"sub": ""},
    {"exp": int(time.time()) + 10000}, {"iat": int(time.time()) + 100},
    {"profile": {"custom_attributes": {"role": "admin"}}},
    {"profile": {"identity_verified": True}}, {"profile": {"custom_attributes": {"nested": {"secret": "x"}}}},
])
def test_signed_identity_denies_bad_claims(changes):
    with pytest.raises(HTTPException) as error:
        identity.verify_identity(signed(**changes), SECRET, BOT)
    assert error.value.status_code == 401


def test_signed_identity_denies_wrong_signature_and_algorithm():
    for token in [signed(), jwt.encode({"sub": "x"}, "", algorithm="none")]:
        with pytest.raises(HTTPException):
            identity.verify_identity(token, "wrong-secret", BOT)


@pytest.mark.parametrize("profile", [{"name": "x" * 201}, {"avatar_url": "javascript:alert(1)"},
    {"custom_attributes": {"x": [1]}}, {"custom_attributes": {"password": "x"}},
    {"custom_attributes": {"x": float("nan")}}, {"custom_attributes": {"x": "a" * 501}}])
def test_profile_limits(profile):
    with pytest.raises(ValueError):
        identity.validate_profile(profile)


@pytest.mark.parametrize("token", ["", "guess", "a" * 42, "a" * 44])
def test_guessed_tokens_rejected_without_database(monkeypatch, token):
    database = AsyncMock()
    monkeypatch.setattr(identity, "run_db", database)
    with pytest.raises(HTTPException):
        asyncio.run(identity.credential(BOT, token))
    database.assert_not_awaited()


@pytest.mark.parametrize("row", [binding(revoked_at="2026-01-01"), binding(expires_at="2020-01-01T00:00:00+00:00"), binding(bot_id="other-bot")])
def test_revoked_expired_wrong_bot_credentials_denied(monkeypatch, row):
    monkeypatch.setattr(identity, "supabase", _RecordingSupabase({"chatty_visitor_credentials": [row]}))
    with pytest.raises(HTTPException):
        asyncio.run(identity.guard_widget_session(request()))


def test_cross_contact_session_denied(monkeypatch):
    fake = _RecordingSupabase({"chatty_visitor_credentials": [binding(), binding(session_id="ci-victim", contact_id="victim", token_hash="other")]})
    monkeypatch.setattr(identity, "supabase", fake)
    with pytest.raises(HTTPException) as error:
        asyncio.run(identity.guard_widget_session(request("ci-victim")))
    assert error.value.status_code == 403


def test_same_contact_previous_conversation_allowed(monkeypatch):
    fake = _RecordingSupabase({"chatty_visitor_credentials": [binding(), binding(session_id="ci-previous", token_hash="other")]})
    monkeypatch.setattr(identity, "supabase", fake)
    asyncio.run(identity.guard_widget_session(request("ci-previous")))


def test_owner_configuration_denies_other_user(monkeypatch):
    fake = _RecordingSupabase({"chatty_bots": [{"id": BOT, "user_id": "owner"}]})
    monkeypatch.setattr(routes, "supabase", fake)
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.rotate_identity(routes.VisitorRequest(bot_id=BOT), Response(), {"auth_user_id": "other"}))
    assert error.value.status_code == 403
    assert not any(call[1] == "update" for call in fake.calls)


def test_credentials_never_stored_plaintext(monkeypatch):
    captured = {}
    class Fake:
        def rpc(self, name, values):
            captured.update(values)
            return self
        def execute(self):
            return None
    monkeypatch.setattr(identity, "supabase", Fake())
    result = asyncio.run(identity.create_visitor(BOT))
    assert captured["p_hash"] == identity.hash_token(result["visitor_token"])
    assert result["visitor_token"] not in captured.values()
    assert captured["p_external"] is None


def test_linked_contact_still_requires_session_assignment(monkeypatch):
    denied = AsyncMock(side_effect=HTTPException(403, "Unauthorized"))
    monkeypatch.setattr(admin, "_verify_session_inbox_access", denied)
    db = AsyncMock()
    monkeypatch.setattr(admin, "run_db", db)
    with pytest.raises(HTTPException):
        asyncio.run(admin.admin_inbox_visitor(BOT, "ci-victim", {"auth_user_id": "agent"}))
    db.assert_not_awaited()
