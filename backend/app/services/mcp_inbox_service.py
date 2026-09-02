"""Inbox / human-takeover / gap-analysis tools for the Developer API / MCP
server.

The original version of this file invented a `chatty_messages` table (real
messages live in `chatty_conversations`) and wrote `status`/`ai_paused`
directly onto `chatty_conversations`, which has neither column. The real
per-visitor conversation state (ai_paused, needs_attention, last_message*)
lives on `chatty_sessions`, one row per (bot_id, session_id) — exactly the
table app/routers/admin.py's dashboard inbox endpoints already use. These
functions now mirror that same table/column usage instead of inventing a
parallel, nonexistent schema.

discover_knowledge_gaps and analyze_sentiment were 100% fabricated (fixed
fake entries / fixed fake percentages, identical for every bot). They now
read chatty_unanswered (the real unanswered-question queue already surfaced
in the dashboard) and the same real thumbs/CSAT tables bots_service.py's
get_feedback_summary uses, respectively — both honestly limited compared to
real NLP, but built from data that actually exists for the bot in question.
"""

from __future__ import annotations

import datetime
from collections import Counter
from typing import Any

from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db


async def list_conversations(
    principal: dict[str, Any], bot_id: str, status: str = "all", limit: int = 50
) -> list[dict[str, Any]]:
    """Lists chatty_sessions rows for a bot — the same table/columns the
    dashboard inbox (GET /api/admin/inbox) lists. `status` is one of
    "all", "needs_attention", or "paused" (there's no free-form session
    status field in the real schema to filter on beyond these two flags)."""
    await _oauth.require_bot_access(principal, bot_id)
    query = supabase.table("chatty_sessions").select("*").eq("bot_id", bot_id)
    if status == "needs_attention":
        query = query.eq("needs_attention", True)
    elif status == "paused":
        query = query.eq("ai_paused", True)
    elif status != "all":
        raise HTTPException(status_code=400, detail="status must be 'all', 'needs_attention', or 'paused'")
    res = await run_db(lambda: query.order("last_message_at", desc=True).limit(limit).execute())
    return res.data or []


async def get_conversation_transcript(principal: dict[str, Any], bot_id: str, session_id: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    res_msgs = await run_db(lambda: supabase.table("chatty_conversations").select(
        "id, role, content, sender, feedback_rating, correction, created_at"
    ).eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=False).execute())
    messages = res_msgs.data or []
    return {"bot_id": bot_id, "session_id": session_id, "message_count": len(messages), "messages": messages}


async def human_agent_takeover(principal: dict[str, Any], bot_id: str, session_id: str, pause_ai: bool = True) -> dict[str, Any]:
    """Same effect as the dashboard's AI toggle (POST /api/admin/inbox/ai):
    flips chatty_sessions.ai_paused. Taking over also clears needs_attention,
    matching what a human reply in the dashboard does."""
    await _oauth.require_bot_access(principal, bot_id)
    update: dict[str, Any] = {"ai_paused": pause_ai}
    if pause_ai:
        update["needs_attention"] = False
    res = await run_db(lambda: supabase.table("chatty_sessions").update(update).eq(
        "bot_id", bot_id).eq("session_id", session_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    row = res.data[0]
    return {"bot_id": bot_id, "session_id": session_id, "ai_paused": bool(row.get("ai_paused"))}


async def send_agent_message(principal: dict[str, Any], bot_id: str, session_id: str, message: str) -> dict[str, Any]:
    """Same effect as the dashboard's inbox reply (POST /api/admin/inbox/reply):
    inserts a human-authored assistant message into chatty_conversations and
    pauses the AI + clears needs_attention on the session."""
    await _oauth.require_bot_access(principal, bot_id)
    if not message.strip():
        raise HTTPException(status_code=400, detail="message must not be empty")
    row = {
        "bot_id": bot_id, "session_id": session_id, "role": "assistant",
        "content": message, "sender": "human",
    }
    res = await run_db(lambda: supabase.table("chatty_conversations").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    await run_db(lambda: supabase.table("chatty_sessions").update({
        "ai_paused": True, "needs_attention": False, "last_message": message[:300],
        "last_message_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }).eq("bot_id", bot_id).eq("session_id", session_id).execute())

    return res.data[0]


async def discover_knowledge_gaps(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    """Real, unresolved entries from chatty_unanswered — the same queue the
    dashboard's unanswered-questions view surfaces — grouped by exact
    question text so a question asked by several visitors shows a real
    frequency count instead of an invented one. No suggested FAQ title or
    content is fabricated; that's for generate_flow_with_ai-style AI calls
    to produce on request, not something to invent silently here."""
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_unanswered").select(
        "question, session_id, created_at"
    ).eq("bot_id", bot_id).eq("status", "open").order("created_at", desc=True).execute())
    rows = res.data or []

    counts = Counter(r["question"].strip().lower() for r in rows)
    first_seen: dict[str, str] = {}
    last_seen: dict[str, str] = {}
    original_text: dict[str, str] = {}
    for r in rows:
        key = r["question"].strip().lower()
        original_text.setdefault(key, r["question"])
        ts = r["created_at"]
        if key not in first_seen or ts < first_seen[key]:
            first_seen[key] = ts
        if key not in last_seen or ts > last_seen[key]:
            last_seen[key] = ts

    gaps = [
        {
            "topic": original_text[key],
            "frequency": count,
            "first_seen": first_seen[key],
            "last_seen": last_seen[key],
        }
        for key, count in counts.most_common()
    ]
    return gaps


async def analyze_sentiment(principal: dict[str, Any], bot_id: str, sample_size: int = 50) -> dict[str, Any]:
    """Not NLP sentiment analysis — there's no sentiment-classification
    pipeline in this codebase. This reuses the same two real feedback
    mechanisms bots_service.get_feedback_summary is built on (per-message
    thumbs and post-chat CSAT) and reports them honestly labeled as a
    satisfaction proxy, rather than fabricating positive/neutral/negative
    percentages with no data behind them."""
    await _oauth.require_bot_access(principal, bot_id)

    thumbs_res = await run_db(lambda: supabase.table("chatty_conversations").select(
        "feedback_rating").eq("bot_id", bot_id).in_("feedback_rating", ["up", "down"]).order(
        "created_at", desc=True).limit(sample_size).execute())
    thumbs = thumbs_res.data or []
    thumbs_up = sum(1 for r in thumbs if r.get("feedback_rating") == "up")
    thumbs_down = sum(1 for r in thumbs if r.get("feedback_rating") == "down")
    total_thumbs = thumbs_up + thumbs_down

    csat_res = await run_db(lambda: supabase.table("chatty_csat_feedback").select(
        "rating, comment").eq("bot_id", bot_id).order("created_at", desc=True).limit(sample_size).execute())
    csat_rows = csat_res.data or []
    avg_rating = (sum(r["rating"] for r in csat_rows) / len(csat_rows)) if csat_rows else None

    return {
        "bot_id": bot_id,
        "note": "Derived from real thumbs-up/down and CSAT feedback, not NLP sentiment classification (no such pipeline exists in this system).",
        "thumbs_sample_size": total_thumbs,
        "thumbs_up_percent": round(thumbs_up / total_thumbs * 100, 1) if total_thumbs else None,
        "thumbs_down_percent": round(thumbs_down / total_thumbs * 100, 1) if total_thumbs else None,
        "csat_sample_size": len(csat_rows),
        "csat_average_rating": round(avg_rating, 2) if avg_rating is not None else None,
        "negative_comments_sample": [r["comment"] for r in csat_rows if r.get("comment") and r.get("rating", 5) <= 2][:5],
    }
