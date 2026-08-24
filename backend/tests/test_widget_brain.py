"""Pure unit tests for plugins/widget_brain.py — the booking-claim guard, the
RAG-translation helper, the web-search helper, and the source-ranking/citation
logic that feeds the widget's system prompt and citation UI.

Deliberately does NOT test `run_widget_assistant` end-to-end: it's an
~750-line async orchestration loop (LiteLLM streaming, tool-calling rounds,
prompt assembly) that's an integration-test target, not a unit-test one. All
HTTP/LLM calls here are mocked; nothing touches the network.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from plugins import widget_brain as wb


# ---------------------------------------------------------------------------
# _claims_booking_success
# ---------------------------------------------------------------------------


def test_claims_booking_success_detects_past_tense_confirmation():
    # The exact live bug this regex guards against: model checks availability
    # then confidently lies that it booked the slot.
    assert wb._claims_booking_success("I've booked your meeting for 3pm.") is True


def test_claims_booking_success_detects_meeting_is_booked_phrasing():
    assert wb._claims_booking_success("Your meeting is all set for tomorrow!") is True
    assert wb._claims_booking_success("The meeting has been confirmed.") is True
    assert wb._claims_booking_success("Booking is confirmed, see you then.") is True


def test_claims_booking_success_ignores_offer_language():
    # "Would you like to schedule" is an offer, not a claim — must not match.
    assert wb._claims_booking_success("Would you like to schedule a meeting?") is False
    assert wb._claims_booking_success("I can check availability for you.") is False


def test_claims_booking_success_handles_empty_and_none():
    assert wb._claims_booking_success("") is False
    assert wb._claims_booking_success(None) is False


# ---------------------------------------------------------------------------
# _query_tokens
# ---------------------------------------------------------------------------


def test_query_tokens_strips_stopwords_and_short_words():
    tokens = wb._query_tokens("what is the pricing for your plans")
    assert "the" not in tokens
    assert "is" not in tokens  # too short (<3 chars)
    assert "pricing" in tokens


def test_query_tokens_expands_synonyms():
    tokens = wb._query_tokens("pricing")
    # pricing should pull in related terms so short queries still retrieve
    # the right section of a longer page.
    assert "cost" in tokens
    assert "plan" in tokens


def test_query_tokens_handles_non_english_synonyms():
    tokens = wb._query_tokens("prezzo")
    assert "pricing" in tokens


def test_query_tokens_empty_for_blank_query():
    assert wb._query_tokens("") == set()
    assert wb._query_tokens(None) == set()


# ---------------------------------------------------------------------------
# _relevant_snippet
# ---------------------------------------------------------------------------


def test_relevant_snippet_returns_whole_content_when_short():
    content = "short content"
    assert wb._relevant_snippet(content, {"content"}, length=100) == content


def test_relevant_snippet_centers_window_on_match_deep_in_text():
    # Regression target: relevant text deep in a long page (e.g. a pricing
    # table) must not be lost to always grabbing the opening paragraphs.
    filler = "x" * 5000
    content = filler + "PRICING TABLE HERE" + ("y" * 5000)
    snippet = wb._relevant_snippet(content, {"pricing"}, length=3500)
    assert "pricing table here" in snippet.lower()


def test_relevant_snippet_falls_back_to_start_when_match_is_early():
    content = "PRICING near the start " + ("z" * 5000)
    snippet = wb._relevant_snippet(content, {"pricing"}, length=3500)
    assert snippet.startswith("PRICING")


def test_relevant_snippet_falls_back_to_start_when_no_match():
    content = "z" * 5000
    snippet = wb._relevant_snippet(content, {"nonexistent"}, length=3500)
    assert snippet == content[:3500]


# ---------------------------------------------------------------------------
# _choose_sources
# ---------------------------------------------------------------------------


def test_choose_sources_scores_by_token_overlap():
    sources = [
        {"name": "Pricing Page", "content": "Our pricing plans cost $10/month."},
        {"name": "About Us", "content": "We are a company founded in 2020."},
    ]
    chosen, q_tokens = wb._choose_sources("what is your pricing", sources)
    assert chosen[0]["name"] == "Pricing Page"
    assert "pricing" in q_tokens


def test_choose_sources_title_match_gets_a_boost():
    sources = [
        {"name": "General FAQ", "content": "pricing pricing pricing pricing"},
        {"name": "Pricing", "content": "see our plans"},
    ]
    chosen, _ = wb._choose_sources("pricing", sources, max_sources=2)
    # "Pricing" title match should outrank raw word-count in the other doc's body
    # despite fewer literal occurrences, due to the +5 title-match boost.
    assert chosen[0]["name"] == "Pricing"


def test_choose_sources_falls_back_to_all_when_nothing_scores():
    sources = [{"name": "A", "content": "aaa"}, {"name": "B", "content": "bbb"}]
    chosen, q_tokens = wb._choose_sources("zzz completely unrelated", sources)
    assert q_tokens  # tokens were extracted
    assert len(chosen) == 2  # nothing scored > 0, so all sources returned


def test_choose_sources_with_no_query_tokens_falls_back_to_first_two():
    # Empty query -> every source scores 0 -> the "sc > 0" filter yields
    # nothing, so the else-branch falls back to the first 2 sources
    # regardless of max_sources (an actual quirk of the fallback, not
    # something this test tries to paper over).
    sources = [{"name": "A", "content": "a"}, {"name": "B", "content": "b"}, {"name": "C", "content": "c"}]
    chosen, q_tokens = wb._choose_sources("", sources, max_sources=1)
    assert q_tokens == set()
    assert len(chosen) == 2


# ---------------------------------------------------------------------------
# _rank_sources
# ---------------------------------------------------------------------------


def test_rank_sources_includes_matching_content():
    sources = [{"name": "Pricing", "content": "Plans start at $10/month."}]
    out = wb._rank_sources("pricing", sources)
    assert "Pricing" in out
    assert "$10/month" in out


def test_rank_sources_respects_max_chars_budget():
    sources = [
        {"name": f"Doc{i}", "content": "pricing " + ("word " * 1000)}
        for i in range(10)
    ]
    out = wb._rank_sources("pricing", sources, max_sources=10, max_chars=500)
    assert len(out) < 1000  # budget kept output well under the unbounded size


def test_rank_sources_empty_when_no_sources():
    assert wb._rank_sources("pricing", []) == ""


# ---------------------------------------------------------------------------
# _ranked_source_refs
# ---------------------------------------------------------------------------


def test_ranked_source_refs_empty_when_no_query_tokens():
    sources = [{"name": "Pricing", "content": "plans", "type": "text"}]
    assert wb._ranked_source_refs("", sources) == []


def test_ranked_source_refs_empty_when_nothing_matches():
    # Greetings/unknowns must not produce spurious citations.
    sources = [{"name": "Pricing", "content": "plans and costs", "type": "text"}]
    assert wb._ranked_source_refs("hello there friend", sources) == []


def test_ranked_source_refs_marks_url_sources_as_clickable():
    sources = [{"name": "https://example.com/pricing", "content": "pricing plans", "type": "url"}]
    refs = wb._ranked_source_refs("pricing", sources)
    assert len(refs) == 1
    assert refs[0]["url"] == "https://example.com/pricing"
    assert refs[0]["type"] == "url"


def test_ranked_source_refs_text_sources_have_no_url():
    sources = [{"name": "Pricing Doc", "content": "pricing plans", "type": "text"}]
    refs = wb._ranked_source_refs("pricing", sources)
    assert refs[0]["url"] is None


def test_ranked_source_refs_dedupes_by_name_and_respects_limit():
    sources = [
        {"name": "Pricing", "content": "pricing plans a", "type": "text"},
        {"name": "Pricing", "content": "pricing plans b", "type": "text"},
        {"name": "Pricing2", "content": "pricing plans c", "type": "text"},
    ]
    refs = wb._ranked_source_refs("pricing", sources, limit=10)
    names = [r["name"] for r in refs]
    assert names.count("Pricing") == 1


# ---------------------------------------------------------------------------
# _web_search (widget_brain's own copy — httpx.AsyncClient mocked)
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, text=""):
        self.status_code = status_code
        self.text = text


class _FakeAsyncClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, headers=None):
        return self._response


def test_web_search_returns_empty_query_message():
    result = asyncio.run(wb._web_search("   "))
    assert result == "No search query provided."


def test_web_search_returns_trimmed_results_on_success(monkeypatch):
    monkeypatch.setattr(wb.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(200, "some results")))
    result = asyncio.run(wb._web_search("weather today"))
    assert result == "some results"


def test_web_search_truncates_long_results(monkeypatch):
    long_text = "x" * 10000
    monkeypatch.setattr(wb.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(200, long_text)))
    result = asyncio.run(wb._web_search("q"))
    assert len(result) == 6000


def test_web_search_returns_fallback_message_on_failure(monkeypatch):
    class _RaisingClient:
        def __init__(self, **kw):
            pass

        async def __aenter__(self):
            raise RuntimeError("network down")

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(wb.httpx, "AsyncClient", lambda **kw: _RaisingClient())
    result = asyncio.run(wb._web_search("weather"))
    assert result == "Web search is unavailable right now; answer from what you already know."


def test_web_search_returns_fallback_on_auth_error(monkeypatch):
    monkeypatch.setattr(wb.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(401, "")))
    result = asyncio.run(wb._web_search("q"))
    assert "unavailable" in result


# ---------------------------------------------------------------------------
# _translate_to_english_for_rag — mocks ai_client.chat
# ---------------------------------------------------------------------------


def _fake_chat_response(content: str):
    msg = MagicMock()
    msg.message.content = content
    resp = MagicMock()
    resp.choices = [msg]
    return resp


def test_translate_returns_input_unchanged_for_short_text():
    # Anything under 4 chars is not worth a translation round-trip.
    result = asyncio.run(wb._translate_to_english_for_rag("hi"))
    assert result == "hi"


def test_translate_returns_input_unchanged_for_empty_text():
    assert asyncio.run(wb._translate_to_english_for_rag("")) == ""
    assert asyncio.run(wb._translate_to_english_for_rag(None)) == ""


def test_translate_calls_ai_client_chat_and_returns_translation(monkeypatch):
    chat_mock = AsyncMock(return_value=_fake_chat_response("What is the price?"))
    monkeypatch.setattr(wb.ai_client, "chat", chat_mock)
    result = asyncio.run(wb._translate_to_english_for_rag("Qual è il prezzo?"))
    assert result == "What is the price?"
    chat_mock.assert_awaited_once()
    # Sanity: the original text is embedded in the translation prompt sent upstream.
    _, kwargs = chat_mock.call_args
    assert "Qual è il prezzo?" in kwargs["messages"][0]["content"]


def test_translate_falls_back_to_original_text_on_empty_translation(monkeypatch):
    chat_mock = AsyncMock(return_value=_fake_chat_response(""))
    monkeypatch.setattr(wb.ai_client, "chat", chat_mock)
    result = asyncio.run(wb._translate_to_english_for_rag("hola mundo"))
    assert result == "hola mundo"


def test_translate_falls_back_to_original_text_on_exception(monkeypatch):
    chat_mock = AsyncMock(side_effect=RuntimeError("model unavailable"))
    monkeypatch.setattr(wb.ai_client, "chat", chat_mock)
    result = asyncio.run(wb._translate_to_english_for_rag("bonjour le monde"))
    assert result == "bonjour le monde"
