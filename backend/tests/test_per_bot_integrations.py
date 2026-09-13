"""End-to-end unit and security tests for per-bot Google/Microsoft integration isolation.

Covers:
1. Account resolution (primary fallback vs. connected account).
2. Cross-tenant isolation (preventing User A from accessing/binding User B's accounts).
3. Calendar listing and secondary calendar targeting in availability checks and booking.
4. Drive folder listing and RAG search scoping to folder_id.
5. Token Fernet encryption verification.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.crypto import decrypt_secret, encrypt_secret
from plugins import google_integrations as g
from plugins import availability_engine as avail
from plugins import doc_rag


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Test 1 & 2 & 3: Account resolution & Cross-Tenant Security Isolation
# ---------------------------------------------------------------------------

def test_resolve_account_user_default():
    """Default fallback: If no account_id is provided, returns user and table='users'."""
    async def _test():
        user = {"id": "user-123", "email": "alice@example.com", "google_access_token": "enc-tok"}
        mock_sb = MagicMock()
        resolved, table = await g.resolve_account_user(mock_sb, user, account_id=None)
        assert resolved == user
        assert table == "users"

    _run(_test())


def test_resolve_account_user_authorized_secondary():
    """Authorized secondary account: If account_id matches and belongs to user_id, returns account dict."""
    async def _test():
        user = {"id": "user-123", "timezone": "America/New_York", "name": "Alice"}
        account_row = {
            "id": "acc-abc",
            "user_id": "user-123",
            "google_access_token": "enc-secondary-tok",
            "google_email": "alice.sales@agency.com",
        }
        mock_sb = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[account_row])
        mock_sb.table.return_value = mock_query

        resolved, table = await g.resolve_account_user(mock_sb, user, account_id="acc-abc")
        assert table == "kin_connected_accounts"
        assert resolved["id"] == "acc-abc"
        assert resolved["google_email"] == "alice.sales@agency.com"
        assert resolved["timezone"] == "America/New_York"

    _run(_test())


def test_resolve_account_user_cross_tenant_spoofing_prevented():
    """Security test: User A cannot resolve an account_id belonging to User B."""
    async def _test():
        user_a = {"id": "user-a", "email": "a@example.com"}
        mock_sb = MagicMock()
        # Query filters by eq("user_id", "user-a"), so an account owned by user-b returns empty data []
        mock_query = MagicMock()
        mock_query.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = mock_query

        with pytest.raises(g.GoogleNotConnected) as exc_info:
            await g.resolve_account_user(mock_sb, user_a, account_id="user-b-account-id")
        assert "unauthorized" in str(exc_info.value).lower() or "not found" in str(exc_info.value).lower()

    _run(_test())


# ---------------------------------------------------------------------------
# Test 4: Calendar listing
# ---------------------------------------------------------------------------

def test_list_calendars_parsing():
    """Verify list_calendars parses primary and secondary calendars correctly."""
    async def _test():
        user = {"id": "user-123"}
        mock_sb = MagicMock()

        api_response = {
            "items": [
                {
                    "id": "primary",
                    "summary": "Personal Main",
                    "description": "Owner personal calendar",
                    "primary": True,
                    "accessRole": "owner",
                },
                {
                    "id": "c_secondary123@group.calendar.google.com",
                    "summary": "Chatty Sales Demos",
                    "description": "Sales bot calendar",
                    "primary": False,
                    "accessRole": "writer",
                },
            ]
        }

        with patch.object(g, "_api", AsyncMock(return_value=api_response)):
            cals = await g.list_calendars(mock_sb, user, account_id=None)
            assert len(cals) == 2
            assert cals[0]["id"] == "primary"
            assert cals[0]["primary"] is True
            assert cals[1]["id"] == "c_secondary123@group.calendar.google.com"
            assert cals[1]["summary"] == "Chatty Sales Demos"
            assert cals[1]["primary"] is False

    _run(_test())


# ---------------------------------------------------------------------------
# Test 5: Drive folder listing
# ---------------------------------------------------------------------------

def test_list_drive_folders():
    """Verify list_drive_folders returns formatted folder metadata."""
    async def _test():
        user = {"id": "user-123"}
        mock_sb = MagicMock()
        api_response = {
            "files": [
                {"id": "folder-1", "name": "Client Onboarding Docs", "parents": ["root"], "modifiedTime": "2026-09-01T00:00:00Z"},
                {"id": "folder-2", "name": "Support FAQs", "parents": ["root"], "modifiedTime": "2026-09-02T00:00:00Z"},
            ]
        }

        with patch.object(g, "_api", AsyncMock(return_value=api_response)):
            folders = await g.list_drive_folders(mock_sb, user, parent_id="root")
            assert len(folders) == 2
            assert folders[0]["id"] == "folder-1"
            assert folders[0]["name"] == "Client Onboarding Docs"
            assert folders[1]["id"] == "folder-2"

    _run(_test())


# ---------------------------------------------------------------------------
# Test 6 & 7: Availability engine uses secondary calendar
# ---------------------------------------------------------------------------

def test_fetch_busy_intervals_with_secondary_calendar():
    """Ensure availability queries use the specific calendar_id when passed."""
    async def _test():
        user = {"id": "user-123"}
        mock_sb = MagicMock()
        t_min = datetime(2026, 9, 15, 9, 0, tzinfo=timezone.utc)
        t_max = datetime(2026, 9, 15, 17, 0, tzinfo=timezone.utc)

        mock_check = AsyncMock(return_value={
            "busy": {
                "c_custom_calendar_id": [
                    {"start": "2026-09-15T10:00:00Z", "end": "2026-09-15T11:00:00Z"}
                ]
            }
        })

        with patch.object(g, "check_calendar_availability", mock_check):
            busy = await avail.fetch_busy_intervals(
                mock_sb,
                user,
                use_ms_calendar=False,
                time_min=t_min,
                time_max=t_max,
                calendar_id="c_custom_calendar_id",
                table="users",
            )
            mock_check.assert_called_once()
            _, kwargs = mock_check.call_args
            assert kwargs["calendar_ids"] == ["c_custom_calendar_id"]
            assert len(busy) == 1
            assert busy[0][0] == datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)
            assert busy[0][1] == datetime(2026, 9, 15, 11, 0, tzinfo=timezone.utc)

    _run(_test())


def test_get_available_slots_respects_bot_calendar():
    """Verify get_available_slots reads bot.google_calendar_id and queries that calendar."""
    async def _test():
        user = {"id": "user-123", "timezone": "UTC"}
        bot = {
            "id": "bot-demo",
            "google_calendar_id": "demo-calendar-id",
            "scheduling_duration_minutes": 30,
            "business_hours_start": 9,
            "business_hours_end": 17,
            "working_days": ["tue"],
            "buffer_minutes": 0,
        }
        mock_sb = MagicMock()
        now_utc = datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)  # Tuesday

        with patch.object(avail, "fetch_busy_intervals", AsyncMock(return_value=[])) as mock_busy:
            await avail.get_available_slots(
                mock_sb,
                user,
                bot_id="bot-demo",
                bot=bot,
                owner_tz_str="UTC",
                use_ms_calendar=False,
                now_utc=now_utc,
                max_results=3,
                search_days=1,
            )
            mock_busy.assert_called_once()
            _, kwargs = mock_busy.call_args
            assert kwargs["calendar_id"] == "demo-calendar-id"

    _run(_test())


# ---------------------------------------------------------------------------
# Test 8: Agent tools booking respects bot-specific calendar
# ---------------------------------------------------------------------------

def test_agent_tools_create_calendar_event_targets_secondary_calendar():
    """Verify _create_calendar_event extracts bot.google_calendar_id and forwards it."""
    async def _test():
        from plugins import agent_tools

        user = {"id": "user-123", "timezone": "UTC", "google_access_token": "enc-tok"}
        context = {
            "bot": {
                "id": "bot-xyz",
                "google_calendar_id": "isolated-calendar-id",
                "bot_timezone": "UTC",
            }
        }
        args = {
            "summary": "Intro Call",
            "start": "2026-09-15T14:00:00Z",
            "end": "2026-09-15T14:30:00Z",
        }
        mock_sb = MagicMock()

        mock_create = AsyncMock(return_value={"id": "evt-123", "summary": "Intro Call", "html_link": "http://cal"})
        with patch.object(g, "create_calendar_event", mock_create):
            res = await agent_tools._create_calendar_event(args, user, mock_sb, context=context)
            assert res["id"] == "evt-123"
            mock_create.assert_called_once()
            _, kwargs = mock_create.call_args
            assert kwargs["calendar_id"] == "isolated-calendar-id"

    _run(_test())


# ---------------------------------------------------------------------------
# Test 9: Drive RAG folder scoping
# ---------------------------------------------------------------------------

def test_doc_rag_search_folder_scoping():
    """Verify doc_rag.search includes match_folder_id in the RPC params when folder_id is supplied."""
    async def _test():
        mock_sb = MagicMock()
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=[{"file_name": "client_brief.pdf", "similarity": 0.9}])
        mock_sb.rpc.return_value = mock_rpc

        with patch("plugins.memory.embed_query", AsyncMock(return_value=[0.1] * 768)):
            results = await doc_rag.search(
                mock_sb,
                user_id="user-123",
                query="Tell me about pricing",
                folder_id="designated-folder-999",
            )
            assert len(results) == 1
            mock_sb.rpc.assert_called_once()
            rpc_name, rpc_params = mock_sb.rpc.call_args[0]
            assert rpc_name == "match_document_chunks"
            assert rpc_params["match_folder_id"] == "designated-folder-999"

    _run(_test())


# ---------------------------------------------------------------------------
# Test 10: Security: bots_service cross-account rejection
# ---------------------------------------------------------------------------

def test_bots_service_rejects_unowned_connected_account():
    """User A attempts to bind a connected account ID owned by User B -> 403 Forbidden."""
    async def _test():
        from app.services import bots_service
        from app.schemas.bots_api import BotUpdateRequest

        principal = {"auth_type": "oauth", "user_id": "user-a", "sub": "auth-user-a"}
        mock_sb = MagicMock()

        with patch("app.services.bots_service.supabase", mock_sb), \
             patch("app.services.bots_service._oauth.require_bot_access", AsyncMock(return_value={"id": "bot-1"})), \
             patch("app.services.bots_service._oauth.user_dict_for_principal", AsyncMock(return_value={"id": "user-a"})):

            # Mock kin_connected_accounts check to return [] (not owned by user-a)
            mock_query = MagicMock()
            mock_query.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            mock_sb.table.return_value = mock_query

            update_req = BotUpdateRequest(google_connected_account_id="victim-account-id")
            with pytest.raises(HTTPException) as exc:
                await bots_service.update_bot(principal, "bot-1", update_req)

            assert exc.value.status_code == 403
            assert "Forbidden" in exc.value.detail

    _run(_test())


# ---------------------------------------------------------------------------
# Test 11: Token Encryption Verification
# ---------------------------------------------------------------------------

def test_token_encryption_fernet():
    """Verify that tokens are encrypted at rest with Fernet and not stored in plaintext."""
    raw_token = "ya29.a0AfH6SMD-sample-sensitive-google-oauth-token-12345"
    encrypted = encrypt_secret(raw_token)
    assert encrypted != raw_token
    assert raw_token not in encrypted
    decrypted = decrypt_secret(encrypted)
    assert decrypted == raw_token
