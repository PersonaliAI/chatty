import asyncio
from unittest.mock import AsyncMock

import main


def _run(coro):
    return asyncio.run(coro)


def test_firecrawl_skipped_without_key(monkeypatch):
    monkeypatch.delenv("FIRECRAWL_API_KEY", raising=False)
    assert _run(main._fetch_via_firecrawl("https://example.com")) == ""


def test_fetch_prefers_firecrawl_when_it_returns_content(monkeypatch):
    monkeypatch.setattr(main, "assert_safe_url_async", AsyncMock())
    monkeypatch.setattr(main, "_fetch_via_firecrawl", AsyncMock(return_value="# firecrawl md"))
    assert _run(main._fetch_url_content("https://example.com")) == "# firecrawl md"


def test_fetch_falls_back_to_jina_when_firecrawl_empty(monkeypatch):
    monkeypatch.setattr(main, "assert_safe_url_async", AsyncMock())
    monkeypatch.setattr(main, "_fetch_via_firecrawl", AsyncMock(return_value=""))

    class _Resp:
        status_code = 200
        text = "jina content"

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url): 
            assert url.startswith("https://r.jina.ai/")
            return _Resp()

    monkeypatch.setattr(main.httpx, "AsyncClient", _Client)
    assert _run(main._fetch_url_content("https://example.com")) == "jina content"


def test_firecrawl_error_status_returns_empty(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc-test")

    class _Resp:
        status_code = 402
        def json(self): return {}

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **k): return _Resp()

    monkeypatch.setattr(main.httpx, "AsyncClient", _Client)
    assert _run(main._fetch_via_firecrawl("https://example.com")) == ""
