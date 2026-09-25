"""Resilience tests for the widget's long-lived live-agent SSE stream."""

from __future__ import annotations

import json

import httpx
import pytest

import main  # noqa: F401 - initialize the application before importing routers
from app.routers import widget as widget_router


@pytest.mark.anyio
async def test_widget_live_reconnects_after_transient_supabase_disconnect(monkeypatch):
    async def fail_db(_fn):
        raise httpx.RemoteProtocolError("Supabase reset the HTTP/2 connection")

    async def no_sleep(_seconds):
        return None

    # The generator may read the clock an implementation-dependent number of
    # times while unwinding an async retry. Once the deadline is reached, keep
    # returning a terminal value instead of making the test depend on an exact
    # number of ``time.time`` calls (which differs across Python versions).
    clock = iter((0.0, 0.0, 241.0))
    monkeypatch.setattr(widget_router, "run_db", fail_db)
    monkeypatch.setattr(widget_router.time, "time", lambda: next(clock, 241.0))
    monkeypatch.setattr(widget_router.asyncio, "sleep", no_sleep)

    response = await widget_router.widget_live(bot_id="bot-1", session_id="session-1")
    chunks = [chunk async for chunk in response.body_iterator]

    assert chunks[0] == ": connected\n\n"
    assert json.loads(chunks[-1].removeprefix("data: ").strip())["type"] == "reconnect"

