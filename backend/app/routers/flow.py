"""Visual Flow Architect AI Copilot endpoint (/api/flow/*).

Builds industrial-grade conversational qualification flows matching Intercom Fin & Zendesk,
supporting multi-choice questions, lead capture, dynamic AI qualification, and calendar booking.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.clients import supabase
from app.core.config import MODEL_NAME
from app.core.db import run_db
from app.schemas.flow import FlowGenerateRequest
from plugins import ai_client
from plugins.widget_brain import GEMINI_FALLBACK_MODELS

logger = logging.getLogger("chatty")

router = APIRouter()


INTERCOM_FIN_DEMO_TEMPLATE = {
    "name": "B2B Demo Qualification (Intercom Fin Playbook)",
    "description": "Multi-step consultative sales qualification with business email capture, 4-way use case branching, and inline calendar demo booking.",
    "nodes": [
        {
            "id": "start",
            "type": "start",
            "data": {"label": "🚀 Start Conversation"},
            "position": {"x": 380, "y": 20},
        },
        {
            "id": "msg-welcome",
            "type": "message",
            "data": {"label": "💬 Hi there! You are now speaking with the AI Assistant. How can I help you today?"},
            "position": {"x": 380, "y": 140},
        },
        {
            "id": "lead-email",
            "type": "leadCapture",
            "data": {
                "label": "👤 First, could you share your business email? This will help me follow up in case you need to step away.",
                "field": "email",
                "validation": "business_email",
            },
            "position": {"x": 380, "y": 270},
        },
        {
            "id": "choice-objective",
            "type": "choice",
            "data": {
                "label": "🔘 To get you to the right demo, how are you looking to use our AI agent?",
                "options": ["Inbound sales", "Customer support", "Ecommerce", "Other"],
            },
            "position": {"x": 380, "y": 410},
        },
        # --- Inbound Sales Branch ---
        {
            "id": "msg-sales-intro",
            "type": "message",
            "data": {"label": "💬 Great — our AI for Sales helps convert inbound website traffic into high-value pipeline. Which company are you with?"},
            "position": {"x": 40, "y": 570},
        },
        {
            "id": "q-sales-tools",
            "type": "question",
            "data": {"label": "❓ How are inbound leads handled today at your company (e.g. Crisp, HubSpot, Zendesk)?"},
            "position": {"x": 40, "y": 700},
        },
        {
            "id": "q-sales-volume",
            "type": "question",
            "data": {"label": "❓ Roughly how many inbound leads do you get per month, and what's your decision timeline (e.g. 0–3 months)?"},
            "position": {"x": 40, "y": 830},
        },
        {
            "id": "tag-sales-qualified",
            "type": "setTag",
            "data": {"label": "🏷️ Tag session: Sales Demo - High Intent"},
            "position": {"x": 40, "y": 960},
        },
        {
            "id": "meet-sales-demo",
            "type": "bookMeeting",
            "data": {"label": "📅 Select a time that works best for you from our available slots to schedule your personalized demo meeting:"},
            "position": {"x": 40, "y": 1090},
        },
        # --- Customer Support Branch ---
        {
            "id": "msg-support-intro",
            "type": "message",
            "data": {"label": "💬 Our Support AI automates 75%+ of customer queries with zero-touch resolution. What helpdesk do you currently use?"},
            "position": {"x": 360, "y": 570},
        },
        {
            "id": "q-support-volume",
            "type": "question",
            "data": {"label": "❓ Approximately how many support tickets or chats does your team handle each month?"},
            "position": {"x": 360, "y": 700},
        },
        {
            "id": "tag-support-qualified",
            "type": "setTag",
            "data": {"label": "🏷️ Tag session: Support Demo - Qualified"},
            "position": {"x": 360, "y": 830},
        },
        {
            "id": "meet-support-demo",
            "type": "bookMeeting",
            "data": {"label": "📅 Select a time that works best for you from our available slots to schedule your support architecture demo:"},
            "position": {"x": 360, "y": 960},
        },
        # --- Ecommerce Branch ---
        {
            "id": "msg-ecom-intro",
            "type": "message",
            "data": {"label": "💬 Our Ecommerce AI assists shoppers with product recommendations, order tracking, and cart recovery. What store platform do you use?"},
            "position": {"x": 680, "y": 570},
        },
        {
            "id": "tag-ecom-qualified",
            "type": "setTag",
            "data": {"label": "🏷️ Tag session: Ecommerce Demo"},
            "position": {"x": 680, "y": 700},
        },
        {
            "id": "meet-ecom-demo",
            "type": "bookMeeting",
            "data": {"label": "📅 Select a time that works best for you from our available slots to schedule your ecommerce growth demo:"},
            "position": {"x": 680, "y": 830},
        },
        # --- Other / Consultative AI Branch ---
        {
            "id": "ai-qualify-custom",
            "type": "aiQualify",
            "data": {
                "label": "🤖 Understand custom use case, team scope, and specific integration requirements.",
                "prompt": "Consultatively identify what the user needs. If they say 'idk' or are unsure, explain our core solutions (Inbound Sales vs Support automation) and guide them to choose.",
            },
            "position": {"x": 1000, "y": 570},
        },
        {
            "id": "meet-custom-demo",
            "type": "bookMeeting",
            "data": {"label": "📅 Select a time that works best for you from our available slots to schedule your discovery call:"},
            "position": {"x": 1000, "y": 720},
        },
    ],
    "edges": [
        {"id": "e-start-welcome", "source": "start", "target": "msg-welcome", "animated": True},
        {"id": "e-welcome-email", "source": "msg-welcome", "target": "lead-email", "animated": True},
        {"id": "e-email-objective", "source": "lead-email", "target": "choice-objective", "animated": True},
        {"id": "e-obj-sales", "source": "choice-objective", "target": "msg-sales-intro", "label": "Inbound sales", "animated": True},
        {"id": "e-sales-tools", "source": "msg-sales-intro", "target": "q-sales-tools", "animated": True},
        {"id": "e-sales-vol", "source": "q-sales-tools", "target": "q-sales-volume", "animated": True},
        {"id": "e-sales-tag", "source": "q-sales-volume", "target": "tag-sales-qualified", "animated": True},
        {"id": "e-sales-meet", "source": "tag-sales-qualified", "target": "meet-sales-demo", "animated": True},
        {"id": "e-obj-support", "source": "choice-objective", "target": "msg-support-intro", "label": "Customer support", "animated": True},
        {"id": "e-support-vol", "source": "msg-support-intro", "target": "q-support-volume", "animated": True},
        {"id": "e-support-tag", "source": "q-support-volume", "target": "tag-support-qualified", "animated": True},
        {"id": "e-support-meet", "source": "tag-support-qualified", "target": "meet-support-demo", "animated": True},
        {"id": "e-obj-ecom", "source": "choice-objective", "target": "msg-ecom-intro", "label": "Ecommerce", "animated": True},
        {"id": "e-ecom-tag", "source": "msg-ecom-intro", "target": "tag-ecom-qualified", "animated": True},
        {"id": "e-ecom-meet", "source": "tag-ecom-qualified", "target": "meet-ecom-demo", "animated": True},
        {"id": "e-obj-other", "source": "choice-objective", "target": "ai-qualify-custom", "label": "Other", "animated": True},
        {"id": "e-other-meet", "source": "ai-qualify-custom", "target": "meet-custom-demo", "animated": True},
    ],
}

SUPPORT_TRIAGE_TEMPLATE = {
    "name": "Support Triage & Deflection",
    "description": "Categorizes visitor issues, checks documentation, and smoothly escalates urgent problems to live agents.",
    "nodes": [
        {"id": "start", "type": "start", "data": {"label": "🚀 Start Conversation"}, "position": {"x": 300, "y": 20}},
        {"id": "msg-welcome", "type": "message", "data": {"label": "💬 Hello! I am your Support Assistant. What can we help you solve today?"}, "position": {"x": 300, "y": 140}},
        {
            "id": "choice-category",
            "type": "choice",
            "data": {
                "label": "🔘 Please select the topic that best matches your issue:",
                "options": ["Billing & Invoices", "Technical Problem", "Feature Question", "Speak to Human"],
            },
            "position": {"x": 300, "y": 270},
        },
        {"id": "tag-billing", "type": "setTag", "data": {"label": "🏷️ Tag session: Billing"}, "position": {"x": 40, "y": 420}},
        {"id": "q-billing", "type": "question", "data": {"label": "❓ Please share your invoice number or account email so we can pull up your records:"}, "position": {"x": 40, "y": 550}},
        {"id": "esc-billing", "type": "escalate", "data": {"label": "🔔 Transfer to Billing Specialist"}, "position": {"x": 40, "y": 680}},
        {"id": "tag-tech", "type": "setTag", "data": {"label": "🏷️ Tag session: Tech Support"}, "position": {"x": 320, "y": 420}},
        {"id": "q-tech", "type": "question", "data": {"label": "❓ Could you describe the error message and the browser or app version you are using?"}, "position": {"x": 320, "y": 550}},
        {"id": "ai-tech-diag", "type": "aiQualify", "data": {"label": "🤖 Diagnose technical issue and offer knowledge base resolution steps."}, "position": {"x": 320, "y": 680}},
        {"id": "tag-escalation", "type": "setTag", "data": {"label": "🏷️ Tag session: Urgent Escalation"}, "position": {"x": 600, "y": 420}},
        {"id": "esc-human", "type": "escalate", "data": {"label": "🔔 Escalate to Live Agent"}, "position": {"x": 600, "y": 550}},
    ],
    "edges": [
        {"id": "e-start", "source": "start", "target": "msg-welcome", "animated": True},
        {"id": "e-wel-cat", "source": "msg-welcome", "target": "choice-category", "animated": True},
        {"id": "e-cat-bill", "source": "choice-category", "target": "tag-billing", "label": "Billing & Invoices", "animated": True},
        {"id": "e-bill-q", "source": "tag-billing", "target": "q-billing", "animated": True},
        {"id": "e-bill-esc", "source": "q-billing", "target": "esc-billing", "animated": True},
        {"id": "e-cat-tech", "source": "choice-category", "target": "tag-tech", "label": "Technical Problem", "animated": True},
        {"id": "e-tech-q", "source": "tag-tech", "target": "q-tech", "animated": True},
        {"id": "e-tech-ai", "source": "q-tech", "target": "ai-tech-diag", "animated": True},
        {"id": "e-cat-human", "source": "choice-category", "target": "tag-escalation", "label": "Speak to Human", "animated": True},
        {"id": "e-tag-human", "source": "tag-escalation", "target": "esc-human", "animated": True},
    ],
}


@router.get("/api/flow/templates")
async def get_flow_templates():
    """Returns high-converting enterprise conversational workflow templates."""
    return {
        "templates": [
            INTERCOM_FIN_DEMO_TEMPLATE,
            SUPPORT_TRIAGE_TEMPLATE,
        ]
    }


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
        "You are an enterprise AI Conversational Architect specializing in high-converting B2B qualification "
        "workflows (matching Intercom Fin, Drift, and Zendesk Flow Builder).\n\n"
        f"BOT NAME: {bot_name}\n"
        f"DEFAULT WELCOME MESSAGE: {welcome_message}\n"
        f"USER DESIGN REQUEST: {body.description}\n\n"
        "Generate a complete, intelligent React Flow schema mapping nodes and edges in JSON format.\n"
        "Nodes must have clean, non-overlapping positions (spacing of at least y=130px, and horizontal branches spaced by x=300px).\n\n"
        "RICH NODE TAXONOMY & TYPES:\n"
        "1. start: Entry trigger. id='start', type='start', data: {'label': '🚀 Start Conversation'}\n"
        "2. message: Informational text. id='msg-X', type='message', data: {'label': '💬 ...'}\n"
        "3. leadCapture: Collect contact info before booking. id='lead-X', type='leadCapture', data: {'label': '👤 First, could you share your business email?...', 'field': 'email'}\n"
        "4. choice: Multiple-choice question with clickable buttons! id='choice-X', type='choice', data: {'label': '🔘 Question text...', 'options': ['Option A', 'Option B', 'Option C']}\n"
        "5. question: Freeform open question. id='q-X', type='question', data: {'label': '❓ Question text...'}\n"
        "6. aiQualify: Consultative conversational AI step. id='ai-X', type='aiQualify', data: {'label': '🤖 AI Objective...', 'prompt': 'Clarify intent if user says idk or is unsure'}\n"
        "7. bookMeeting: Inline interactive demo calendar booking! id='meet-X', type='bookMeeting', data: {'label': '📅 Select a time that works best for you from our available slots to schedule your demo:'}\n"
        "8. setTag: Session CRM tagging. id='tag-X', type='setTag', data: {'label': '🏷️ Tag session: TagName'}\n"
        "9. escalate: Live agent transfer. id='esc-X', type='escalate', data: {'label': '🔔 Escalate to Live Agent'}\n\n"
        "10. delay: Scheduled wait. data: {'label': '⏱️ Wait before continuing', 'config': {'duration_ms': 5000}}\n"
        "11. condition: Typed branch. data: {'label': '🔀 Check condition', 'config': {'expression': 'lead.score >= 0'}}\n"
        "12. loop: Bounded iteration. data: {'label': '🔁 Process each item', 'config': {'max_iterations': 10}}\n"
        "13. webhook: External integration call. data: {'label': '🔗 Send webhook', 'config': {'url': 'https://example.invalid/hook'}}\n"
        "14. retry: Resilience wrapper. data: {'label': '♻️ Retry transient failures', 'config': {'max_attempts': 3, 'timeout_ms': 30000}}\n\n"
        "CRITICAL ARCHITECTURAL RULES FOR QUALIFICATION / DEMO FLOWS:\n"
        "- If the request involves scheduling a demo, meetings, or lead qualification:\n"
        "  1. DO NOT make a primitive 3-node chain. Never jump straight to 'Great! We will get back to you shortly'.\n"
        "  2. Follow the Intercom Fin methodology: Capture business email early -> Multi-choice objective question (e.g. Sales vs Support vs Ecommerce vs Other) -> Contextual qualification (company name, current tools, lead/ticket volume, timeline) -> Tag session -> Inline calendar meeting scheduler (bookMeeting)!\n"
        "  3. Every choice option in a choice node MUST have a matching outgoing edge where edge.label matches the option string!\n"
        "- Respond with ONLY a valid JSON object with 'nodes' and 'edges'."
    )

    try:
        resp = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.3,
            response_format={"type": "json_object"},
            bot_id=body.bot_id,
            call_type="flow_generate",
        )
        text = (resp.choices[0].message.content or "").strip()
        schema = json.loads(text)
        return schema
    except Exception as e:
        logger.exception("Failed to generate flow with AI")
        raise HTTPException(status_code=500, detail="Failed to generate flow") from e
