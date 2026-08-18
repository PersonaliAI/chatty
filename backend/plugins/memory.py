"""Long-term memory for Kin — RAG on top of pgvector.

Pipeline per assistant turn:
  1. retrieve_memories(user_msg)  →  top-k cosine matches, injected as system context
  2. (reply is generated)
  3. extract_and_store(user_msg, reply)  →  Gemini distills 0..3 "facts worth
     remembering", we embed each one and insert into memory_embeddings.

Runs against `text-embedding-004` (768-d, matches the existing column).
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

logger = logging.getLogger("kin.memory")

EMBED_MODEL = os.environ.get("KIN_EMBED_MODEL", "text-embedding-004")
EMBED_DIMENSIONS = int(os.environ.get("KIN_EMBED_DIMENSIONS", "768"))
# gemini-embedding-2 uses prompt prefixes for task; older models use task_type param.
IS_EMBED_V2 = "gemini-embedding-2" in EMBED_MODEL
EXTRACT_MODEL = os.environ.get("KIN_EXTRACT_MODEL", "gemini-2.5-flash")
MATCH_THRESHOLD = float(os.environ.get("KIN_MEMORY_THRESHOLD", "0.55"))
MATCH_COUNT = int(os.environ.get("KIN_MEMORY_TOPK", "5"))

ALLOWED_KINDS = {"preference", "fact", "event", "relationship", "goal", "habit"}

_EXTRACT_SYSTEM_PROMPT = (
    "You distill conversations into facts worth remembering for next time.\n"
    "Output a JSON array (possibly empty) of memory objects. Each has:\n"
    '  - "summary": one short sentence, written in third person about the user '
    '(e.g. "User\'s sister Maya lives in Berlin", "User dislikes early-morning meetings").\n'
    '  - "kind": one of: preference, fact, event, relationship, goal, habit.\n'
    "RULES:\n"
    " * Only include details that would help in a FUTURE conversation: names, "
    "relationships, recurring preferences, ongoing goals, stable facts.\n"
    " * Skip pleasantries, transient events (today's weather), tool output "
    "(emails, calendar entries the user merely asked to read).\n"
    " * Skip if the exchange is purely operational ('add task X', 'what's on my calendar today').\n"
    " * NEVER store connection/integration status (e.g. 'Gmail is/isn't connected', "
    "'Microsoft account not linked'). That's live state that changes — a stale cached "
    "memory of it becomes a lie the moment it changes, and the assistant should always "
    "check the real status via a tool, never trust a remembered claim about it.\n"
    " * NEVER store the details of a scheduled task being created (its prompt, cron "
    "time, or channel) — that's already durably stored in the scheduled_tasks table. "
    "A duplicate memory of it only risks bleeding into an unrelated later request.\n"
    " * 0..3 items max. Empty array is the right answer most of the time.\n"
    " * Never invent details that weren't explicitly stated."
)


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


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
) -> tuple[list, dict]:
    """Returns (contents, config_kwargs) for the active embedding model."""
    if IS_EMBED_V2:
        # Format each text with task prefix, wrap each in its own Content so the
        # API returns separate embeddings (otherwise it aggregates into one).
        if is_query:
            formatted = [_format_query(t) for t in texts]
        else:
            ts = titles or [None] * len(texts)
            formatted = [_format_doc(t, ti) for t, ti in zip(texts, ts)]
        contents = [
            genai_types.Content(parts=[genai_types.Part.from_text(text=f)])
            for f in formatted
        ]
        return contents, {}
    # Legacy: pass texts directly, use task_type param
    task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"
    return list(texts), {"task_type": task_type}


def _embed_with_retry(
    client: genai.Client,
    texts: list[str],
    *,
    is_query: bool,
    titles: Optional[list[Optional[str]]] = None,
    max_attempts: int = 4,
) -> list[list[float]]:
    """Call embed_content with retry on transient errors (429/500/503/etc.)."""
    contents, extra_cfg = _build_call(texts, is_query=is_query, titles=titles)
    cfg = genai_types.EmbedContentConfig(
        output_dimensionality=EMBED_DIMENSIONS, **extra_cfg
    )

    last_exc: Optional[Exception] = None
    for attempt in range(max_attempts):
        try:
            res = client.models.embed_content(
                model=EMBED_MODEL, contents=contents, config=cfg
            )
            if not res.embeddings:
                raise RuntimeError("empty embeddings response")
            vectors: list[list[float]] = []
            for e in res.embeddings:
                if e.values is None:
                    raise RuntimeError("embedding value missing")
                vectors.append(list(e.values))
            return vectors
        except (genai_errors.ClientError, genai_errors.ServerError) as exc:
            code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            transient = code in (429, 500, 502, 503, 504)
            last_exc = exc
            if not transient or attempt == max_attempts - 1:
                raise
            backoff = 2 ** attempt  # 1s, 2s, 4s, 8s
            logger.warning(
                "embed transient %s — backing off %ds (attempt %d/%d)",
                code, backoff, attempt + 1, max_attempts,
            )
            time.sleep(backoff)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            raise
    assert last_exc is not None
    raise last_exc


def embed_document(
    client: genai.Client, text: str, *, title: Optional[str] = None
) -> list[float]:
    return _embed_with_retry(client, [text], is_query=False, titles=[title])[0]


def embed_query(client: genai.Client, text: str) -> list[float]:
    return _embed_with_retry(client, [text], is_query=True)[0]


def embed_documents_batch(
    client: genai.Client,
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
        vecs = _embed_with_retry(
            client, chunk_texts, is_query=False, titles=chunk_titles
        )
        out.extend(vecs)
        if i + batch_size < len(texts):
            time.sleep(0.3)
    return out


# ---------------------------------------------------------------------------
# Storage / retrieval
# ---------------------------------------------------------------------------


def store(
    supabase,
    *,
    user_id: str,
    content: str,
    embedding: list[float],
    kind: str,
    source_session: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    supabase.table("memory_embeddings").insert(
        {
            "user_id": user_id,
            "content": content,
            "embedding": embedding,
            "kind": kind if kind in ALLOWED_KINDS else "fact",
            "source_session": source_session,
            "metadata": metadata or {},
        }
    ).execute()


def forget(supabase, *, user_id: str, memory_id: str) -> bool:
    """Delete one memory by id, scoped to this user. Returns True if a row
    was actually deleted (false if no such memory exists for this user —
    e.g. a stale/wrong id, or it belongs to someone else)."""
    res = (
        supabase.table("memory_embeddings")
        .delete()
        .eq("id", memory_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


DEDUP_THRESHOLD = float(os.environ.get("KIN_MEMORY_DEDUP_THRESHOLD", "0.90"))


def _find_near_duplicate(
    supabase, *, user_id: str, vec: list[float], threshold: float = DEDUP_THRESHOLD
) -> Optional[dict[str, Any]]:
    """Check whether a memory this similar already exists for the user.

    Without this, semantically-identical facts re-extracted across separate
    conversations (e.g. "wants daily vocab words at 8 AM" and "...at 8:15
    PM") pile up as separate rows instead of one being recognized as an
    update — which both bloats retrieval with noise and, worse, gives a
    later unrelated query more surface area to accidentally match one of
    the duplicates and bleed its content into a different request.
    """
    try:
        res = supabase.rpc(
            "match_memories",
            {
                "query_embedding": vec,
                "match_user_id": user_id,
                "match_threshold": threshold,
                "match_count": 1,
            },
        ).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        logger.exception("dedup match_memories rpc failed")
        return None


def retrieve(
    supabase,
    client: genai.Client,
    *,
    user_id: str,
    query: str,
    threshold: float = MATCH_THRESHOLD,
    count: int = MATCH_COUNT,
) -> list[dict[str, Any]]:
    """Return memories semantically similar to `query`."""
    try:
        vec = embed_query(client, query)
    except Exception:  # noqa: BLE001
        logger.exception("embed_query failed")
        return []
    try:
        res = supabase.rpc(
            "match_memories",
            {
                "query_embedding": vec,
                "match_user_id": user_id,
                "match_threshold": threshold,
                "match_count": count,
            },
        ).execute()
    except Exception:  # noqa: BLE001
        logger.exception("match_memories rpc failed")
        return []
    return res.data or []


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def _too_short_to_remember(user_msg: str, reply: str) -> bool:
    """Heuristics to skip extraction on trivial turns."""
    u = (user_msg or "").strip().lower()
    if not u:
        return True
    if len(u) < 12:
        return True
    if u in {"ok", "thanks", "thank you", "cool", "nice", "got it", "yes", "no"}:
        return True
    return False


_EXTRACT_SCHEMA = genai_types.Schema(
    type=genai_types.Type.ARRAY,
    items=genai_types.Schema(
        type=genai_types.Type.OBJECT,
        properties={
            "summary": genai_types.Schema(type=genai_types.Type.STRING),
            "kind": genai_types.Schema(
                type=genai_types.Type.STRING,
                enum=sorted(ALLOWED_KINDS),
            ),
        },
        required=["summary", "kind"],
    ),
)


def extract_facts(
    client: genai.Client, user_msg: str, assistant_reply: str
) -> list[dict[str, str]]:
    """Ask the model to extract 0-3 memorable facts. Returns [] on failure."""
    if _too_short_to_remember(user_msg, assistant_reply):
        return []
    try:
        contents = [
            genai_types.Content(
                role="user",
                parts=[
                    genai_types.Part.from_text(
                        text=(
                            f"User said:\n{user_msg.strip()}\n\n"
                            f"Assistant replied:\n{assistant_reply.strip()}"
                        )
                    )
                ],
            )
        ]
        config = genai_types.GenerateContentConfig(
            system_instruction=_EXTRACT_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=_EXTRACT_SCHEMA,
            temperature=0,
        )
        res = client.models.generate_content(
            model=EXTRACT_MODEL, contents=contents, config=config
        )
        raw = (res.text or "").strip()
        if not raw:
            return []
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        out: list[dict[str, str]] = []
        for item in data[:3]:
            if not isinstance(item, dict):
                continue
            summary = (item.get("summary") or "").strip()
            kind = (item.get("kind") or "fact").strip().lower()
            if not summary or len(summary) < 8:
                continue
            if kind not in ALLOWED_KINDS:
                kind = "fact"
            out.append({"summary": summary, "kind": kind})
        return out
    except Exception:  # noqa: BLE001
        logger.exception("extract_facts failed")
        return []


def extract_and_store(
    supabase,
    client: genai.Client,
    *,
    user: dict[str, Any],
    user_msg: str,
    assistant_reply: str,
    session_id: str,
) -> None:
    """Synchronous extraction + storage. Safe to call in a BackgroundTask."""
    if not user.get("memory_enabled", True):
        return
    facts = extract_facts(client, user_msg, assistant_reply)
    for f in facts:
        try:
            vec = embed_document(client, f["summary"])
            dup = _find_near_duplicate(supabase, user_id=user["id"], vec=vec)
            if dup:
                logger.info(
                    "skipped near-duplicate memory (sim=%.2f): %r ~= existing %r",
                    dup.get("similarity", 0), f["summary"][:100], dup.get("content", "")[:100],
                )
                continue
            store(
                supabase,
                user_id=user["id"],
                content=f["summary"],
                embedding=vec,
                kind=f["kind"],
                source_session=session_id,
            )
            logger.info(
                "stored memory (kind=%s): %s", f["kind"], f["summary"][:120]
            )
        except Exception:  # noqa: BLE001
            logger.exception("failed to store memory: %s", f.get("summary", "?"))


# ---------------------------------------------------------------------------
# Format for prompt injection
# ---------------------------------------------------------------------------


def _format_age(created_at: Optional[str], now: datetime) -> str:
    if not created_at:
        return "date unknown"
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        days = (now - dt).days
        if days < 1:
            return "today"
        if days == 1:
            return "1 day ago"
        if days < 30:
            return f"{days} days ago"
        months = days // 30
        if months < 12:
            return f"{months} month{'s' if months != 1 else ''} ago"
        years = days // 365
        return f"{years} year{'s' if years != 1 else ''} ago"
    except Exception:  # noqa: BLE001
        return "date unknown"


def format_for_prompt(memories: list[dict[str, Any]]) -> str:
    """Render retrieved memories as a dated bullet list for the system prompt.

    Each line carries its age so the model can judge staleness itself —
    without this, a 6-month-old memory reads with the same authority as
    one from 5 minutes ago, which is exactly how a stale "not connected"
    fact once out-argued live tool output.
    """
    if not memories:
        return ""
    now = datetime.now(timezone.utc)
    lines = [
        "Things you remember about this user (from prior conversations, each "
        "dated). Treat anything that can change over time — connection "
        "status, ongoing plans, contact details — as possibly stale if it's "
        "not recent; verify live via a tool instead of trusting an old memory "
        "when it matters:",
    ]
    for m in memories:
        age = _format_age(m.get("created_at"), now)
        lines.append(f"  - [{m.get('kind', 'fact')}, {age}] (id: {m.get('id', '?')}) {m.get('content', '')}")
    return "\n".join(lines)
