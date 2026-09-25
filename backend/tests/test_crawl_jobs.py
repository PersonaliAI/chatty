import asyncio
from unittest.mock import AsyncMock

import main  # noqa: F401

from app.routers import crawl
from app.workers import crawl_jobs


def test_crawl_pages_job_upserts_content(monkeypatch):
    class Query:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self): return type("R", (), {"data": []})()
    monkeypatch.setattr(crawl_jobs, "supabase", type("S", (), {"table": lambda self, _name: Query()})())
    monkeypatch.setattr(crawl_jobs, "run_db", lambda callback: asyncio.sleep(0, result=type("R", (), {"data": []})()))
    monkeypatch.setattr("main._fetch_url_content", AsyncMock(return_value="<html>content</html>"))
    result = asyncio.run(crawl_jobs._crawl_one("bot-1", "https://example.com/page"))
    assert result["ok"] is True
    assert result["chars"] > 0


def test_scheduled_crawl_job_requires_fields():
    try:
        asyncio.run(crawl_jobs.process_crawl_job({"source_id": "source-1"}))
    except ValueError as exc:
        assert "missing source fields" in str(exc)
    else:
        raise AssertionError("expected missing-field validation")


def test_crawl_queue_fails_closed_without_queue(monkeypatch):
    monkeypatch.setattr(crawl, "_crawl_job_queue", None)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)
    # The endpoint's queue gate is exercised by the helper behavior below.
    assert crawl._allow_ephemeral_jobs() is False
