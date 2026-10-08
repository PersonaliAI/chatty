import asyncio
from types import SimpleNamespace

import main  # noqa: F401 - initialize the router bridge before importing widget
from app.routers import widget


def test_campaigns_fall_back_when_optional_columns_are_missing(monkeypatch):
    class MissingColumnError(Exception):
        code = "42703"

        def __str__(self):
            return "column chatty_campaigns.channels does not exist"

    calls = 0

    async def run_db(_operation):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise MissingColumnError()
        return SimpleNamespace(data=[{
            "id": "campaign-1",
            "name": "Welcome",
            "type": "chat_bubble",
            "message": "Need help?",
            "url_patterns": [],
            "trigger_type": "time_on_page",
            "trigger_value": 5,
            "target_devices": ["desktop"],
            "is_active": True,
            "start_date": None,
            "end_date": None,
        }])

    monkeypatch.setattr(widget, "run_db", run_db)
    result = asyncio.run(widget.widget_campaigns("bot-1"))

    assert result["campaigns"][0]["id"] == "campaign-1"
    assert result["campaigns"][0]["channels"] == ["web"]
    assert calls == 2


def test_campaigns_fail_soft_when_campaign_store_is_unavailable(monkeypatch):
    async def run_db(_operation):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(widget, "run_db", run_db)

    result = asyncio.run(widget.widget_campaigns("bot-1"))

    assert result == {"campaigns": []}
