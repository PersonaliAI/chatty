"""Embedding utility for document RAG (plugins/doc_rag.py) — every embedding
call in the codebase goes through here, routed to LiteLLM.

This module used to be a full copy of Kin's long-term conversational memory
system (extract facts from a conversation, dedupe, store, retrieve by
semantic similarity) — none of that is reachable from Chatty (confirmed via
grep: nothing calls retrieve/extract_facts/extract_and_store/store/forget
anywhere in this codebase), so it's been removed rather than carried as
dead weight. Only the embedding pipeline doc_rag.py actually uses remains.

Runs against `gemini-embedding-001` (768-d, matches the existing pgvector
column) — text-embedding-004 was retired from the Gemini API.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from plugins import ai_client

logger = logging.getLogger("chatty.memory")

EMBED_MODEL = os.environ.get("KIN_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIMENSIONS = int(os.environ.get("KIN_EMBED_DIMENSIONS", "768"))
# gemini-embedding-2 uses prompt prefixes for task; gemini-embedding-001 (the
# current default) uses a separate task_type param instead.
IS_EMBED_V2 = "gemini-embedding-2" in EMBED_MODEL


def _format_doc(text: str, title: Optional[str] = None) -> str:
    """gemini-embedding-2 expects 'title: X | text: Y' for retrieval documents."""
    return f"title: {title or 'none'} | text: {text}"


def _format_query(text: str) -> str:
    """gemini-embedding-2 expects 'task: question answering | query: X' for retrieval queries."""
    return f"task: question answering | query: {text}"


def _build_call(
    texts: list[str],
    *,
    is_query: bool,
    titles: Optional[list[Optional[str]]] = None,
) -> tuple[list[str], dict]:
    """Returns (formatted_texts, extra_kwargs) for the active embedding model."""
    if IS_EMBED_V2:
        # Format each text with its task prefix — gemini-embedding-2 doesn't
        # take a separate task_type param, unlike gemini-embedding-001.
        if is_query:
            formatted = [_format_query(t) for t in texts]
        else:
            ts = titles or [None] * len(texts)
            formatted = [_format_doc(t, ti) for t, ti in zip(texts, ts)]
        return formatted, {}
    # gemini-embedding-001 (current default): pass texts directly, use task_type param
    task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"
    return list(texts), {"task_type": task_type}


async def _embed_with_retry(
    texts: list[str],
    *,
    is_query: bool,
    titles: Optional[list[Optional[str]]] = None,
    max_attempts: int = 4,
) -> list[list[float]]:
    """Embed via LiteLLM, with retry on transient errors (429/500/503/etc.)."""
    formatted, extra_kwargs = _build_call(texts, is_query=is_query, titles=titles)
    model = ai_client.resolve_gemini_model(EMBED_MODEL)

    last_exc: Optional[Exception] = None
    for attempt in range(max_attempts):
        try:
            res = await ai_client.embed(
                model=model, input=formatted,
                output_dimensionality=EMBED_DIMENSIONS, **extra_kwargs,
            )
            if not res.data:
                raise RuntimeError("empty embeddings response")
            vectors: list[list[float]] = []
            for item in res.data:
                values = item.get("embedding") if isinstance(item, dict) else getattr(item, "embedding", None)
                if not values:
                    raise RuntimeError("embedding value missing")
                vectors.append(list(values))
            return vectors
        except Exception as exc:  # noqa: BLE001
            transient = isinstance(exc, ai_client._TRANSIENT_EXCEPTIONS)
            last_exc = exc
            if not transient or attempt == max_attempts - 1:
                raise
            backoff = 2 ** attempt  # 1s, 2s, 4s, 8s
            logger.warning(
                "embed transient error — backing off %ds (attempt %d/%d): %s",
                backoff, attempt + 1, max_attempts, exc,
            )
            await asyncio.sleep(backoff)
    assert last_exc is not None
    raise last_exc


async def embed_document(text: str, *, title: Optional[str] = None) -> list[float]:
    return (await _embed_with_retry([text], is_query=False, titles=[title]))[0]


async def embed_query(text: str) -> list[float]:
    return (await _embed_with_retry([text], is_query=True))[0]


async def embed_documents_batch(
    texts: list[str],
    *,
    titles: Optional[list[Optional[str]]] = None,
    batch_size: int = 50,
) -> list[list[float]]:
    """Embed many documents efficiently. One API call per batch, retries on 429."""
    out: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        chunk_texts = texts[i : i + batch_size]
        chunk_titles = titles[i : i + batch_size] if titles else None
        vecs = await _embed_with_retry(chunk_texts, is_query=False, titles=chunk_titles)
        out.extend(vecs)
        if i + batch_size < len(texts):
            await asyncio.sleep(0.3)
    return out
