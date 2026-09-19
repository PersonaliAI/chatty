"""Enterprise Agent AI Copilot Service.

Provides human support agents with native AI capabilities:
1. AI Draft Reply: Analyzes ticket context and generates suggested responses.
2. AI Conversation Summarizer: 1-click 3-bullet executive summary for handoffs and ticket notes.
3. Live Agent Collision Detection: Tracks active viewer heartbeats to prevent dual-agent collisions.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.core.clients import supabase
from app.core.db import run_db
from plugins import ai_client

logger = logging.getLogger("chatty.copilot")

# In-memory agent viewing presence cache: { "bot_id:session_id": { "agent_email": (timestamp, agent_name) } }
_ACTIVE_VIEWERS: dict[str, dict[str, tuple[float, str]]] = {}
_active_ticket_viewers = _ACTIVE_VIEWERS
_VIEWER_EXPIRATION_SECONDS = 35.0


def clean_expired_viewers() -> None:
    now = time.time()
    for key in list(_ACTIVE_VIEWERS.keys()):
        for email, (last_seen, _) in list(_ACTIVE_VIEWERS[key].items()):
            if now - last_seen > _VIEWER_EXPIRATION_SECONDS:
                _ACTIVE_VIEWERS[key].pop(email, None)
        if not _ACTIVE_VIEWERS[key]:
            _ACTIVE_VIEWERS.pop(key, None)


def record_viewer_heartbeat(bot_id: str, session_id: str, agent_email: str, agent_name: str = "") -> None:
    """Records that an agent is currently viewing a ticket."""
    key = f"{bot_id}:{session_id}"
    now = time.time()
    if key not in _ACTIVE_VIEWERS:
        _ACTIVE_VIEWERS[key] = {}
    _ACTIVE_VIEWERS[key][agent_email.lower()] = (now, agent_name or agent_email.split("@")[0].capitalize())


def get_active_viewers(bot_id: str, session_id: str, current_agent_email: str = "") -> list[dict[str, str]]:
    """Returns all other agents actively viewing this session within the heartbeat window."""
    key = f"{bot_id}:{session_id}"
    now = time.time()
    if key not in _ACTIVE_VIEWERS:
        return []

    active: list[dict[str, str]] = []
    # Prune expired viewers
    expired = []
    for email, (last_seen, name) in _ACTIVE_VIEWERS[key].items():
        if now - last_seen > _VIEWER_EXPIRATION_SECONDS:
            expired.append(email)
        elif email.lower() != current_agent_email.lower():
            active.append({
                "email": email,
                "name": name,
                "seconds_ago": str(int(now - last_seen)),
            })

    for exp in expired:
        _ACTIVE_VIEWERS[key].pop(exp, None)

    return active


async def generate_ai_draft_reply(
    bot_id: str,
    session_id: str,
    instructions: str = "",
) -> dict[str, Any]:
    """Generates an AI draft reply for an agent based on session transcript and bot knowledge."""
    # 1. Fetch transcript
    rows = (await run_db(lambda: supabase.table("chatty_conversations")
        .select("role,content,sender,created_at")
        .eq("bot_id", bot_id).eq("session_id", session_id)
        .order("created_at", desc=False).limit(30).execute())).data or []

    if not rows:
        return {
            "draft": "Hello! Thank you for reaching out to us today. How may I assist you?",
            "sources": [],
        }

    # Format transcript
    transcript_lines = []
    last_user_query = ""
    for r in rows:
        sender_role = r.get("sender") or r.get("role") or "visitor"
        text = (r.get("content") or "").strip()
        if not text:
            continue
        transcript_lines.append(f"{sender_role.upper()}: {text}")
        if r.get("role") == "user":
            last_user_query = text

    transcript_str = "\n".join(transcript_lines)

    # 2. Look up relevant bot knowledge chunks if available
    sources: list[str] = []
    context_str = ""
    try:
        sources_res = (await run_db(lambda: supabase.table("chatty_sources")
            .select("name,content").eq("bot_id", bot_id).limit(4).execute())).data or []
        if sources_res:
            context_pieces = []
            for s in sources_res:
                s_name = s.get("name") or "Knowledge Document"
                sources.append(s_name)
                c_snippet = (s.get("content") or "")[:800]
                context_pieces.append(f"[{s_name}]:\n{c_snippet}")
            context_str = "\n\n".join(context_pieces)
    except Exception:
        logger.debug("Failed to retrieve knowledge sources for draft", exc_info=True)

    system_prompt = (
        "You are an enterprise AI support copilot assisting human support agents. "
        "Your job is to draft a polite, highly competent, professional, and empathetic response "
        "to the customer based on the conversation transcript and company knowledge base.\n\n"
        "Guidelines:\n"
        "- Adopt a warm, professional, human support tone (not robotic).\n"
        "- Address the visitor's core question or issue directly.\n"
        "- If information is missing, politely ask clarifying questions.\n"
        "- Do NOT sign off with a generic placeholder like '[Your Name]' — write the response directly.\n"
        "- Keep it concise (1 to 3 short paragraphs)."
    )

    if instructions.strip():
        system_prompt += f"\n\nAgent's special instructions: {instructions.strip()}"

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"Company Knowledge Base Context:\n{context_str}\n\nConversation Transcript:\n{transcript_str}\n\nPlease draft the best response for the human agent to review and send to the customer:",
        },
    ]

    try:
        primary_model = ai_client.resolve_gemini_model("gemini-2.5-flash")
        resp = await ai_client.chat(
            model=primary_model,
            messages=messages,
            fallback_models=["gemini/gemini-2.0-flash", "gemini/gemini-1.5-flash"],
            max_attempts=2,
            bot_id=bot_id,
            session_id=session_id,
            call_type="copilot_draft",
        )
        draft_text = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning("AI copilot draft failed, using intelligent heuristic fallback: %s", e)
        draft_text = f"Hi there! Thank you for reaching out regarding: '{last_user_query[:80]}'. Let me look into this for you right away."

    return {
        "draft": draft_text,
        "draft_reply": draft_text,
        "sources": sources[:3],
    }


async def generate_conversation_summary(
    bot_id: str,
    session_id: str,
) -> dict[str, Any]:
    """Generates an executive 3-bullet conversation summary and evaluates customer sentiment."""
    rows = (await run_db(lambda: supabase.table("chatty_conversations")
        .select("role,content,sender,created_at")
        .eq("bot_id", bot_id).eq("session_id", session_id)
        .order("created_at", desc=False).limit(40).execute())).data or []

    if not rows:
        return {
            "summary": "• Issue: New customer ticket opened.\n• Discussion: No conversation messages yet.\n• Next Steps: Awaiting initial customer inquiry.",
            "sentiment": "neutral",
            "message_count": 0,
        }

    transcript_lines = []
    for r in rows:
        sender_role = r.get("sender") or r.get("role") or "visitor"
        text = (r.get("content") or "").strip()
        if text:
            transcript_lines.append(f"{sender_role.upper()}: {text}")

    transcript_str = "\n".join(transcript_lines)

    system_prompt = (
        "You are an enterprise support lead summarizer. "
        "Analyze the support conversation transcript and generate a structured 3-bullet summary formatted exactly as:\n\n"
        "• Inquiry: [Concise description of the visitor's core question or problem]\n"
        "• Discussion: [What was checked, answered, or troubleshooting steps taken]\n"
        "• Status & Next Steps: [Resolution reached or required follow-up action]\n\n"
        "Also conclude with a sentiment tag on its own line in the format: SENTIMENT: [satisfied | neutral | frustrated | churn_risk]"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Conversation Transcript:\n{transcript_str}\n\nPlease summarize this ticket:"},
    ]

    summary_text = ""
    sentiment = "neutral"

    try:
        primary_model = ai_client.resolve_gemini_model("gemini-2.5-flash")
        resp = await ai_client.chat(
            model=primary_model,
            messages=messages,
            fallback_models=["gemini/gemini-2.0-flash", "gemini/gemini-1.5-flash"],
            max_attempts=2,
            bot_id=bot_id,
            session_id=session_id,
            call_type="copilot_summary",
        )
        raw_output = (resp.choices[0].message.content or "").strip()

        # Parse sentiment tag if present
        for line in raw_output.split("\n"):
            if "SENTIMENT:" in line.upper():
                val = line.split(":", 1)[1].strip().lower()
                for possible in ("satisfied", "frustrated", "churn_risk", "neutral"):
                    if possible in val:
                        sentiment = possible
                        break

        # Remove the SENTIMENT line from the bullet summary
        clean_lines = [l for l in raw_output.split("\n") if "SENTIMENT:" not in l.upper()]
        summary_text = "\n".join(clean_lines).strip()
    except Exception as e:
        logger.warning("AI copilot summarize failed, using fallback summary: %s", e)
        first_msg = rows[0].get("content", "")[:100]
        last_msg = rows[-1].get("content", "")[:100]
        summary_text = (
            f"• Inquiry: {first_msg}\n"
            f"• Discussion: Active conversation with {len(rows)} messages exchanged.\n"
            f"• Status & Next Steps: Latest update: '{last_msg}'."
        )

    return {
        "summary": summary_text,
        "sentiment": sentiment,
        "message_count": len(rows),
    }
