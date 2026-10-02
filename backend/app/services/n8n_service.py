"""n8n integration service for Chatty.

Connects Chatty to an external or self-hosted n8n automation engine.
Replaces legacy flow builder with n8n workflows for 1,500+ integrations,
webhooks, and AI agent execution.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("chatty")

N8N_EXTERNAL_URL = os.getenv("N8N_EXTERNAL_URL", "https://n8n.chatty.personaliai.com").rstrip("/")
N8N_INTERNAL_URL = os.getenv("N8N_INTERNAL_URL", N8N_EXTERNAL_URL).rstrip("/")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")


def get_n8n_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY
    return headers


async def check_n8n_health() -> Dict[str, Any]:
    """Check if n8n service is reachable and responsive."""
    candidates = [N8N_INTERNAL_URL]
    if N8N_EXTERNAL_URL not in candidates:
        candidates.append(N8N_EXTERNAL_URL)

    for base_url in candidates:
        url = f"{base_url}/healthz"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return {"status": "ok", "url": N8N_EXTERNAL_URL, "reachable": True}
        except Exception as exc:
            logger.debug("n8n health check failed for %s: %s", url, exc)
    return {"status": "unavailable", "url": N8N_EXTERNAL_URL, "reachable": False}


async def get_bot_starter_template(bot_id: str, bot_name: str) -> Dict[str, Any]:
    """Build a standard n8n starter workflow definition for a Chatty bot."""
    webhook_path = f"chatty-{bot_id}"
    return {
        "name": f"Chatty Bot: {bot_name} ({bot_id})",
        "nodes": [
            {
                "id": "chatty-webhook-trigger",
                "name": "Chatty Event Trigger",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 2,
                "position": [250, 300],
                "parameters": {
                    "httpMethod": "POST",
                    "path": webhook_path,
                    "responseMode": "responseNode",
                    "options": {}
                }
            },
            {
                "id": "chatty-respond-webhook",
                "name": "Respond to Chatty",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1.1,
                "position": [680, 300],
                "parameters": {
                    "respondWith": "json",
                    "responseBody": "={{ { success: True, message: 'Automation executed successfully', data: $json } }}",
                    "options": {}
                }
            }
        ],
        "connections": {
            "Chatty Event Trigger": {
                "main": [
                    [
                        {
                            "node": "Respond to Chatty",
                            "type": "main",
                            "index": 0
                        }
                    ]
                ]
            }
        },
        "settings": {
            "executionOrder": "v1"
        }
    }


async def get_voice_and_bot_starter_template(bot_id: str, bot_name: str) -> Dict[str, Any]:
    """Build a rich starter workflow with voice event and lead routing."""
    webhook_path = f"chatty-{bot_id}"
    return {
        "name": f"Chatty Bot: {bot_name} ({bot_id})",
        "nodes": [
            {
                "id": "chatty-webhook-trigger",
                "name": "Chatty Event Trigger",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 2,
                "position": [240, 300],
                "parameters": {
                    "httpMethod": "POST",
                    "path": webhook_path,
                    "responseMode": "responseNode",
                    "options": {}
                }
            },
            {
                "id": "chatty-event-router",
                "name": "Event Router",
                "type": "n8n-nodes-base.switch",
                "typeVersion": 3,
                "position": [480, 300],
                "parameters": {
                    "rules": {
                        "values": [
                            {
                                "conditions": {
                                    "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "loose"},
                                    "conditions": [
                                        {
                                            "leftValue": "={{ $json.body?.action || $json.action }}",
                                            "rightValue": "call_ended",
                                            "operator": {"type": "string", "operation": "contains"}
                                        }
                                    ],
                                    "combinator": "and"
                                },
                                "renameOutput": True,
                                "outputKey": "Voice Call Ended"
                            },
                            {
                                "conditions": {
                                    "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "loose"},
                                    "conditions": [
                                        {
                                            "leftValue": "={{ $json.body?.action || $json.action }}",
                                            "rightValue": "lead_captured",
                                            "operator": {"type": "string", "operation": "contains"}
                                        }
                                    ],
                                    "combinator": "and"
                                },
                                "renameOutput": True,
                                "outputKey": "Lead Captured"
                            }
                        ]
                    },
                    "options": {"fallbackOutput": "extra"}
                }
            },
            {
                "id": "chatty-voice-handler",
                "name": "Process Voice Call",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [740, 200],
                "parameters": {
                    "jsCode": "// Extract voice session details\nconst event = $json.body || $json;\nconst duration = event.payload?.duration_seconds || event.duration_seconds || 0;\nreturn {\n  json: {\n    event_type: 'voice_call_summary',\n    session_id: event.payload?.session_id || 'unknown',\n    duration_seconds: duration,\n    duration_minutes: (duration / 60).toFixed(1),\n    processed_at: new Date().toISOString()\n  }\n};"
                }
            },
            {
                "id": "chatty-lead-handler",
                "name": "Format Lead Info",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [740, 400],
                "parameters": {
                    "jsCode": "// Format lead for CRM/notification\nconst event = $json.body || $json;\nconst payload = event.payload || {};\nreturn {\n  json: {\n    event_type: 'lead_captured',\n    name: payload.customer_name || payload.name || 'Anonymous',\n    email: payload.customer_email || payload.email || '',\n    phone: payload.customer_phone || payload.phone || '',\n    captured_at: new Date().toISOString()\n  }\n};"
                }
            },
            {
                "id": "chatty-respond-webhook",
                "name": "Respond to Chatty",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1.1,
                "position": [1020, 300],
                "parameters": {
                    "respondWith": "json",
                    "responseBody": "={{ { success: True, message: 'Automation executed successfully', action: $json.body?.action || $json.action } }}",
                    "options": {}
                }
            }
        ],
        "connections": {
            "Chatty Event Trigger": {
                "main": [[{"node": "Event Router", "type": "main", "index": 0}]]
            },
            "Event Router": {
                "main": [
                    [{"node": "Process Voice Call", "type": "main", "index": 0}],
                    [{"node": "Format Lead Info", "type": "main", "index": 0}],
                    [{"node": "Respond to Chatty", "type": "main", "index": 0}]
                ]
            },
            "Process Voice Call": {
                "main": [[{"node": "Respond to Chatty", "type": "main", "index": 0}]]
            },
            "Format Lead Info": {
                "main": [[{"node": "Respond to Chatty", "type": "main", "index": 0}]]
            }
        },
        "settings": {
            "executionOrder": "v1"
        }
    }


async def get_or_create_bot_workflow(
    bot_id: str,
    bot_name: str,
    auth_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Find existing workflow for bot or provision a starter workflow in n8n.
    
    When auth_token is provided (e.g. from user's Supabase session), requests are
    scoped directly to the tenant's personal project in n8n via the /rest/workflows
    endpoint. Otherwise, falls back to the instance API key via /api/v1/workflows.
    """
    headers = {"Content-Type": "application/json"}
    endpoint = "/api/v1/workflows"
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
        endpoint = "/rest/workflows"
    elif N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY

    # 1. Search existing workflows
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            list_resp = await client.get(f"{N8N_INTERNAL_URL}{endpoint}", headers=headers)
            if list_resp.status_code == 200:
                data = list_resp.json()
                workflows = (
                    data.get("data", [])
                    if isinstance(data, dict)
                    else (data if isinstance(data, list) else [])
                )
                for wf in workflows:
                    if any(
                        node.get("type") == "n8n-nodes-base.webhook"
                        and node.get("parameters", {}).get("path") == f"chatty-{bot_id}"
                        for node in wf.get("nodes", [])
                    ):
                        wf_id = wf["id"]
                        return {
                            "workflow_id": wf_id,
                            "workflow_name": wf.get("name", f"Chatty Bot: {bot_name}"),
                            "active": wf.get("active", False),
                            "editor_url": f"{N8N_EXTERNAL_URL}/workflow/{wf_id}",
                            "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
                            "created": False,
                        }
            elif auth_token and list_resp.status_code == 401 and N8N_API_KEY:
                # Fallback to API key if bearer token expired
                headers = get_n8n_headers()
                endpoint = "/api/v1/workflows"
                list_resp = await client.get(f"{N8N_INTERNAL_URL}{endpoint}", headers=headers)
                if list_resp.status_code == 200:
                    data = list_resp.json()
                    workflows = data.get("data", []) if isinstance(data, dict) else []
                    for wf in workflows:
                        if any(
                            node.get("type") == "n8n-nodes-base.webhook"
                            and node.get("parameters", {}).get("path") == f"chatty-{bot_id}"
                            for node in wf.get("nodes", [])
                        ):
                            wf_id = wf["id"]
                            return {
                                "workflow_id": wf_id,
                                "workflow_name": wf.get("name", f"Chatty Bot: {bot_name}"),
                                "active": wf.get("active", False),
                                "editor_url": f"{N8N_EXTERNAL_URL}/workflow/{wf_id}",
                                "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
                                "created": False,
                            }
    except Exception as exc:
        logger.warning("Failed to query n8n workflows: %s", exc)

    # 2. Create starter workflow
    template = await get_bot_starter_template(bot_id, bot_name)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            create_resp = await client.post(
                f"{N8N_INTERNAL_URL}{endpoint}",
                json=template,
                headers=headers,
            )
            if create_resp.status_code in (200, 201):
                new_wf = create_resp.json()
                wf_id = new_wf.get("id") or (new_wf.get("data", {}).get("id"))
                return {
                    "workflow_id": wf_id,
                    "workflow_name": template["name"],
                    "active": False,
                    "editor_url": f"{N8N_EXTERNAL_URL}/workflow/{wf_id}",
                    "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
                    "created": True,
                }
    except Exception as exc:
        logger.error("Failed to create n8n workflow for bot %s: %s", bot_id, exc)

    return {
        "workflow_id": None,
        "workflow_name": None,
        "active": False,
        "editor_url": f"{N8N_EXTERNAL_URL}",
        "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
        "created": False,
    }


async def trigger_bot_workflow(bot_id: str, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Forward an event from Chatty to n8n webhook."""
    webhook_url = f"{N8N_INTERNAL_URL}/webhook/chatty-{bot_id}"
    request_data = {
        **payload,
        "bot_id": bot_id,
        "action": action,
    }
    
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(webhook_url, json=request_data)
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    return {"status": "ok", "text": resp.text}
            return {
                "error": f"n8n webhook returned status {resp.status_code}",
                "detail": resp.text
            }
    except httpx.ConnectError:
        logger.warning("Could not reach n8n at %s", webhook_url)
        return {"error": "n8n_unreachable", "message": "n8n automation service is offline or not configured."}
    except Exception as exc:
        logger.error("Error executing n8n workflow for bot %s: %s", bot_id, exc)
        return {"error": "execution_failed", "detail": str(exc)}
