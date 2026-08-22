"""Visual Flow Architect AI Copilot endpoint (/api/flow/*)."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from google.genai import types as genai_types

from app.core.clients import supabase
from app.core.config import MODEL_NAME
from app.core.db import run_db
from app.schemas.flow import FlowGenerateRequest
from plugins.widget_brain import _gemini_generate

logger = logging.getLogger("chatty")

router = APIRouter()


@router.post("/api/flow/generate")
async def generate_flow_with_ai(body: FlowGenerateRequest):
    bot_name = "Chatty Assistant"
    welcome_message = "Hi! How can I help you today?"
    try:
        res = await run_db(lambda: supabase.table("chatty_bots").select("name, welcome_message").eq("id", body.bot_id).maybe_single().execute())
        if res.data:
            bot_name = res.data.get("name") or bot_name
            welcome_message = res.data.get("welcome_message") or welcome_message
    except Exception:
        pass

    prompt = (
        "You are an expert chatbot designer. Your task is to design a high-converting, "
        "industrial-grade visual conversational flow based on the business description and requirements below.\n\n"
        f"BOT NAME: {bot_name}\n"
        f"DEFAULT WELCOME MESSAGE: {welcome_message}\n"
        f"USER DESIGN REQUEST: {body.description}\n\n"
        "Generate a React Flow schema mapping nodes and edges in JSON format. The nodes must have distinct positions (e.g. x and y coordinates that do not overlap, with spacing of at least y=120px) and styles.\n\n"
        "Supported node types/visual styles:\n"
        "1. Start conversation node: id='start', label='🚀 Start Conversation', style: {background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold'}\n"
        "2. Message node: id like 'msg-X', label like '💬 Hello...', style: {background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', minWidth: '150px'}\n"
        "3. Question node (must connect to multiple paths based on user responses): id like 'q-X', label like '❓ Ask: <question>', style: {background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', minWidth: '150px'}\n"
        "4. Set Tag node: id like 'tag-X', label like '🏷️ Tag session: <tag>', style: {background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '12px', padding: '12px', minWidth: '150px', fontWeight: 'semibold'}\n"
        "5. Escalate node: id like 'esc-X', label like '🔔 Escalate to Live Agent', style: {background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', borderRadius: '12px', padding: '12px', minWidth: '150px', fontWeight: 'bold'}\n\n"
        "Ensure all nodes are properly wired with edges! Start node must connect to the first action node.\n"
        "Respond with ONLY a JSON block containing two lists: 'nodes' and 'edges'."
    )

    try:
        resp = await _gemini_generate(
            model=MODEL_NAME,
            contents=[genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=prompt)])],
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json"
            )
        )
        text = (resp.text or "").strip()
        schema = json.loads(text)
        return schema
    except Exception as e:
        logger.exception("Failed to generate flow with AI")
        raise HTTPException(status_code=500, detail=str(e))
