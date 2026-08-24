"""Pure unit tests for plugins/doc_rag.py's search-ranking and chunking
logic — no network, no live DB. embed_query and the supabase.rpc() call are
mocked; see tests/test_integration_live.py for the real-embedding smoke test.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from plugins import doc_rag


# ---------------------------------------------------------------------------
# search() — ranking/filtering pipeline
# ---------------------------------------------------------------------------


def _make_supabase_returning(rows):
    execute_result = MagicMock()
    execute_result.data = rows
    supabase = MagicMock()
    supabase.rpc.return_value.execute.return_value = execute_result
    return supabase


def test_search_returns_rpc_rows_in_given_order(monkeypatch):
    rows = [
        {"file_name": "a.pdf", "chunk_index": 0, "similarity": 0.91, "content": "A"},
        {"file_name": "b.pdf", "chunk_index": 2, "similarity": 0.85, "content": "B"},
    ]
    monkeypatch.setattr(doc_rag.mem, "embed_query", AsyncMock(return_value=[0.1, 0.2, 0.3]))
    supabase = _make_supabase_returning(rows)

    result = asyncio.run(doc_rag.search(supabase, user_id="u1", query="what is X?"))
    assert result == rows


def test_search_passes_threshold_and_count_through_to_rpc(monkeypatch):
    monkeypatch.setattr(doc_rag.mem, "embed_query", AsyncMock(return_value=[0.1]))
    supabase = _make_supabase_returning([])

    asyncio.run(doc_rag.search(supabase, user_id="u1", query="q", count=3, threshold=0.6))

    _, kwargs = supabase.rpc.call_args
    params = supabase.rpc.call_args[0][1]
    assert params["match_user_id"] == "u1"
    assert params["match_count"] == 3
    assert params["match_threshold"] == 0.6
    assert params["query_embedding"] == [0.1]


def test_search_returns_empty_list_when_rpc_returns_no_data(monkeypatch):
    monkeypatch.setattr(doc_rag.mem, "embed_query", AsyncMock(return_value=[0.1]))
    supabase = _make_supabase_returning(None)

    result = asyncio.run(doc_rag.search(supabase, user_id="u1", query="q"))
    assert result == []


def test_search_returns_empty_list_when_embedding_fails(monkeypatch):
    # A live-API outage embedding the query must degrade to "no results",
    # not propagate an exception into the chat turn.
    monkeypatch.setattr(doc_rag.mem, "embed_query", AsyncMock(side_effect=RuntimeError("embed API down")))
    supabase = MagicMock()

    result = asyncio.run(doc_rag.search(supabase, user_id="u1", query="q"))
    assert result == []
    supabase.rpc.assert_not_called()


def test_search_returns_empty_list_when_rpc_raises(monkeypatch):
    # A DB/RPC failure must also degrade gracefully rather than 500ing the chat turn.
    monkeypatch.setattr(doc_rag.mem, "embed_query", AsyncMock(return_value=[0.1]))
    supabase = MagicMock()
    supabase.rpc.return_value.execute.side_effect = RuntimeError("db down")

    result = asyncio.run(doc_rag.search(supabase, user_id="u1", query="q"))
    assert result == []


# ---------------------------------------------------------------------------
# format_for_prompt()
# ---------------------------------------------------------------------------


def test_format_for_prompt_returns_empty_string_for_no_chunks():
    assert doc_rag.format_for_prompt([]) == ""


def test_format_for_prompt_includes_filename_and_similarity():
    chunks = [{"file_name": "notes.pdf", "chunk_index": 1, "similarity": 0.873, "content": "Some text"}]
    out = doc_rag.format_for_prompt(chunks)
    assert "notes.pdf" in out
    assert "chunk 1" in out
    assert "0.87" in out
    assert "Some text" in out


def test_format_for_prompt_defaults_missing_similarity_to_zero():
    chunks = [{"file_name": "x.pdf", "chunk_index": 0, "content": "text"}]
    out = doc_rag.format_for_prompt(chunks)
    assert "0.00" in out


def test_format_for_prompt_joins_multiple_chunks():
    chunks = [
        {"file_name": "a.pdf", "chunk_index": 0, "similarity": 0.9, "content": "A"},
        {"file_name": "b.pdf", "chunk_index": 0, "similarity": 0.8, "content": "B"},
    ]
    out = doc_rag.format_for_prompt(chunks)
    assert out.count("---") == 4  # opening+closing marker per chunk


# ---------------------------------------------------------------------------
# chunk_text() — recursive character splitter
# ---------------------------------------------------------------------------


def test_chunk_text_empty_input_returns_empty_list():
    assert doc_rag.chunk_text("") == []
    assert doc_rag.chunk_text("   ") == []


def test_chunk_text_short_text_returns_single_chunk():
    assert doc_rag.chunk_text("Hello world", size=100) == ["Hello world"]


def test_chunk_text_splits_long_text_into_multiple_chunks():
    text = "Sentence one. " * 50  # ~700 chars
    chunks = doc_rag.chunk_text(text, size=200, overlap=20)
    assert len(chunks) > 1
    for c in chunks:
        # A little slack for boundary back-off, but nothing should run away unbounded.
        assert len(c) <= 200 + 50


def test_chunk_text_reassembly_covers_the_source_without_large_gaps():
    text = "word " * 300
    chunks = doc_rag.chunk_text(text, size=300, overlap=30)
    # Every chunk should be non-empty and the total chunk count should be
    # proportional to input length (regression guard against an infinite
    # loop or a chunker that stalls producing 1 chunk forever).
    assert all(c.strip() for c in chunks)
    assert len(chunks) >= len(text) // 300


def test_chunk_text_overlap_means_consecutive_chunks_share_content():
    text = "AAAAAAAAAA BBBBBBBBBB CCCCCCCCCC DDDDDDDDDD " * 10
    chunks = doc_rag.chunk_text(text, size=100, overlap=30)
    assert len(chunks) > 1
    # With nonzero overlap, the end of one chunk and the start of the next
    # should share at least a little text (not a hard cut with zero overlap).
    first_tail = chunks[0][-15:]
    second_head = chunks[1][:60]
    assert any(word in second_head for word in first_tail.split())


def test_chunk_text_zero_overlap_still_terminates():
    text = "x" * 1000
    chunks = doc_rag.chunk_text(text, size=100, overlap=0)
    assert len(chunks) >= 9
    assert "".join(chunks).replace("", "") != ""
