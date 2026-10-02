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

N8N_INTERNAL_URL = os.getenv("N8N_INTERNAL_URL", "http://n8n:5678").rstrip("/")
N8N_EXTERNAL_URL = os.getenv("N8N_EXTERNAL_URL", "http://localhost:5678").rstrip("/")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")


def get_n8n_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY
    return headers


async def check_n8n_health() -> Dict[str, Any]:
    """Check if n8n service is reachable and responsive."""
    url = f"{N8N_INTERNAL_URL}/healthz"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return {"status": "ok", "url": N8N_EXTERNAL_URL, "reachable": True}
    except Exception as exc:
        logger.debug("n8n health check failed: %s", exc)
    return {"status": "unavailable", "url": N8N_EXTERNAL_URL, "reachable": False}


async def get_bot_starter_template(bot_id: str, bot_name: str) -> Dict[str, Any]:
    """Build a standard n8n starter workflow definition for a Chatty bot."""
    webhook_path = f"chatty-{bot_id}"
    return {
        "name": f"Chatty Bot: {bot_name} ({bot_id[:8]})",
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
                    "responseBody": "={{ { success: true, message: 'Automation executed successfully', data: $json } }}",
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


async def get_or_create_bot_workflow(bot_id: str, bot_name: str) -> Dict[str, Any]:
    """Find existing workflow for bot or provision a starter workflow in n8n."""
    headers = get_n8n_headers()
    target_prefix = f"Chatty Bot: {bot_name} ({bot_id[:8]})"
    
    # 1. Search existing workflows
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            list_resp = await client.get(f"{N8N_INTERNAL_URL}/api/v1/workflows", headers=headers)
            if list_resp.status_code == 200:
                workflows = list_resp.json().get("data", [])
                for wf in workflows:
                    if bot_id in wf.get("name", ""):
                        wf_id = wf["id"]
                        return {
                            "workflow_id": wf_id,
                            "workflow_name": wf["name"],
                            "active": wf.get("active", False),
                            "editor_url": f"{N8N_EXTERNAL_URL}/workflow/{wf_id}",
                            "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
                            "created": False
                        }
    except Exception as exc:
        logger.warning("Failed to query n8n workflows: %s", exc)

    # 2. Create starter workflow
    template = await get_bot_starter_template(bot_id, bot_name)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            create_resp = await client.post(
                f"{N8N_INTERNAL_URL}/api/v1/workflows",
                json=template,
                headers=headers
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
                    "created": True
                }
    except Exception as exc:
        logger.error("Failed to create n8n workflow for bot %s: %s", bot_id, exc)

    return {
        "workflow_id": None,
        "workflow_name": None,
        "active": False,
        "editor_url": f"{N8N_EXTERNAL_URL}",
        "webhook_url": f"{N8N_EXTERNAL_URL}/webhook/chatty-{bot_id}",
        "created": False
    }


async def trigger_bot_workflow(bot_id: str, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Forward an event from Chatty to n8n webhook."""
    webhook_url = f"{N8N_INTERNAL_URL}/webhook/chatty-{bot_id}"
    request_data = {
        "bot_id": bot_id,
        "action": action,
        **payload
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
