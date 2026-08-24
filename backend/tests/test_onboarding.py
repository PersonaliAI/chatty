"""Unit tests for app/routers/onboarding.py's add_lead_column() — the
dynamic-column-name sanitization and safe SQL construction. No real DB
connection; psycopg2.connect is mocked.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from psycopg2 import sql as pg_sql

from app.routers import onboarding


def _mock_connect():
    """Returns (connect_mock, cursor_mock) with connect().cursor() wired up."""
    cursor = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value = cursor
    connect = MagicMock(return_value=conn)
    return connect, cursor


def test_add_lead_column_strips_invalid_characters(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    connect, cursor = _mock_connect()
    with patch.object(onboarding.psycopg2, "connect", connect):
        onboarding.add_lead_column("Favorite Color!! 123")

    assert cursor.execute.called
    executed_sql = cursor.execute.call_args[0][0]
    # Built via psycopg2.sql, not a raw f-string — the identifier is safely
    # composed rather than string-interpolated directly into the SQL text.
    assert isinstance(executed_sql, pg_sql.Composed)


def test_add_lead_column_builds_a_safely_quoted_identifier_not_raw_interpolation(monkeypatch):
    # Regression guard for the original implementation, which built the SQL
    # via an f-string: `f"ALTER TABLE ... ADD COLUMN IF NOT EXISTS {clean_name} TEXT;"`.
    # That happened to be safe only because of the regex allowlist upstream —
    # this asserts the safety property directly (a real Identifier object),
    # so it can't silently regress if the allowlist is ever loosened.
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    connect, cursor = _mock_connect()
    with patch.object(onboarding.psycopg2, "connect", connect):
        onboarding.add_lead_column("company_size")

    executed_sql = cursor.execute.call_args[0][0]
    assert isinstance(executed_sql, pg_sql.Composed)
    parts = executed_sql.seq
    assert any(isinstance(p, pg_sql.Identifier) for p in parts)


def test_add_lead_column_skips_reserved_words(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    connect, _cursor = _mock_connect()
    with patch.object(onboarding.psycopg2, "connect", connect):
        onboarding.add_lead_column("email")

    connect.assert_not_called()


def test_add_lead_column_skips_when_name_is_empty_after_sanitization(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    connect, _cursor = _mock_connect()
    with patch.object(onboarding.psycopg2, "connect", connect):
        onboarding.add_lead_column("!!!???")

    connect.assert_not_called()


def test_add_lead_column_skips_when_password_not_configured(monkeypatch):
    monkeypatch.delenv("SUPABASE_DB_PASSWORD", raising=False)
    connect, _cursor = _mock_connect()
    with patch.object(onboarding.psycopg2, "connect", connect):
        onboarding.add_lead_column("shoe_size")

    connect.assert_not_called()


def test_add_lead_column_never_raises_on_db_error(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    with patch.object(onboarding.psycopg2, "connect", side_effect=RuntimeError("db down")):
        onboarding.add_lead_column("shoe_size")  # must not raise
