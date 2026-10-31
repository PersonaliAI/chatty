"""Durable Omnichannel Configuration Store & Schema-Resilient Bot Persistence.

Ensures all 7 Omnichannel Messaging Hub channels (WhatsApp, Facebook Messenger,
Instagram DM, TikTok Business, Telegram Bot, Two-Way SMS, Support Email) persist
reliably to Supabase `chatty_bots`, whether top-level columns are migrated or
stored inside the JSONB envelope (`whatsapp_quick_replies` / `omnichannel_config`).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db

logger = logging.getLogger("chatty.omnichannel.config_store")

# Secret fields that must be encrypted at rest and never overwritten by empty strings on general PATCH
OMNICHANNEL_SECRET_FIELDS = frozenset({
    "whatsapp_access_token",
    "whatsapp_app_secret",
    "messenger_access_token",
    "messenger_app_secret",
    "instagram_access_token",
    "instagram_app_secret",
    "tiktok_access_token",
    "tiktok_refresh_token",
    "tiktok_client_secret",
    "telegram_bot_token",
    "twilio_auth_token",
    "email_webhook_secret",
})

# Fields that may not exist as top-level columns on older Supabase instances before DDL migration
EXTENDED_OMNICHANNEL_FIELDS = frozenset({
    "messenger_enabled",
    "messenger_page_id",
    "messenger_page_name",
    "messenger_access_token",
    "messenger_verify_token",
    "messenger_app_secret",
    "messenger_quick_replies",
    "instagram_username",
    "instagram_quick_replies",
    "tiktok_enabled",
    "tiktok_open_id",
    "tiktok_business_id",
    "tiktok_display_name",
    "tiktok_access_token",
    "tiktok_refresh_token",
    "tiktok_verify_token",
    "tiktok_client_key",
    "tiktok_client_secret",
    "tiktok_quick_replies",
})

EXTENDED_DEFAULTS: dict[str, Any] = {
    "messenger_enabled": False,
    "messenger_page_id": None,
    "messenger_page_name": None,
    "messenger_access_token": None,
    "messenger_verify_token": None,
    "messenger_app_secret": None,
    "messenger_quick_replies": [],
    "instagram_username": None,
    "instagram_quick_replies": [],
    "tiktok_enabled": False,
    "tiktok_open_id": None,
    "tiktok_business_id": None,
    "tiktok_display_name": None,
    "tiktok_access_token": None,
    "tiktok_refresh_token": None,
    "tiktok_verify_token": None,
    "tiktok_client_key": None,
    "tiktok_client_secret": None,
    "tiktok_quick_replies": [],
}


def _looks_encrypted(val: str) -> bool:
    return val.startswith("gAAAA") and len(val) > 60


def ensure_encrypted(value: Optional[str]) -> Optional[str]:
    """Encrypt a secret token if non-empty and not already Fernet-encrypted."""
    if value is None:
        return None
    clean = str(value).strip()
    if not clean:
        return None
    if _looks_encrypted(clean):
        return clean
    return encrypt_secret(clean)


def unpack_omnichannel_bot_row(bot: dict[str, Any]) -> dict[str, Any]:
    """Unpack any JSONB-enveloped omnichannel fields onto the top-level bot dict."""
    if not isinstance(bot, dict):
        return bot

    out = dict(bot)
    raw_wqr = out.get("whatsapp_quick_replies")
    envelope: dict[str, Any] = {}

    if isinstance(raw_wqr, dict):
        items = raw_wqr.get("items")
        out["whatsapp_quick_replies"] = [str(x) for x in items if str(x).strip()] if isinstance(items, list) else []
        omni = raw_wqr.get("_omnichannel")
        if isinstance(omni, dict):
            envelope.update(omni)
    elif isinstance(raw_wqr, list):
        out["whatsapp_quick_replies"] = [str(x) for x in raw_wqr if str(x).strip()]
    else:
        out["whatsapp_quick_replies"] = []

    raw_omni_col = out.get("omnichannel_config")
    if isinstance(raw_omni_col, dict):
        envelope.update(raw_omni_col)

    for key, default_val in EXTENDED_DEFAULTS.items():
        if out.get(key) is None and key in envelope:
            out[key] = envelope[key]
        elif key not in out:
            out[key] = default_val if not isinstance(default_val, list) else list(default_val)

    for list_key in ("messenger_quick_replies", "instagram_quick_replies", "tiktok_quick_replies"):
        val = out.get(list_key)
        if not isinstance(val, list):
            out[list_key] = []
        else:
            out[list_key] = [str(x).strip()[:20] for x in val if str(x).strip()][:3]

    return out


async def update_bot_omnichannel_safe(
    supabase: Any,
    bot_id: str,
    updates: dict[str, Any],
    *,
    user_id: Optional[str] = None,
    allow_clear_secrets: bool = False,
) -> Optional[dict[str, Any]]:
    """Persist bot updates while encrypting secrets and folding extended omnichannel
    fields into the JSONB envelope so updates succeed regardless of schema cache state."""
    existing_res = await run_db(
        lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute()
    )
    if not existing_res or not existing_res.data:
        return None

    existing_raw = existing_res.data[0]
    raw_wqr = existing_raw.get("whatsapp_quick_replies")
    if isinstance(raw_wqr, dict):
        current_wqr_items = raw_wqr.get("items") if isinstance(raw_wqr.get("items"), list) else []
        current_omni_env = dict(raw_wqr.get("_omnichannel") or {}) if isinstance(raw_wqr.get("_omnichannel"), dict) else {}
    elif isinstance(raw_wqr, list):
        current_wqr_items = list(raw_wqr)
        current_omni_env = {}
    else:
        current_wqr_items = []
        current_omni_env = {}

    prepared: dict[str, Any] = {}
    for k, v in updates.items():
        if k in OMNICHANNEL_SECRET_FIELDS:
            if (v is None or str(v).strip() == "") and not allow_clear_secrets:
                # Never overwrite an existing encrypted secret when the dashboard sends an empty string
                continue
            prepared[k] = ensure_encrypted(v) if v else None
        elif k in ("whatsapp_quick_replies", "messenger_quick_replies", "instagram_quick_replies", "tiktok_quick_replies"):
            if isinstance(v, list):
                prepared[k] = [str(x).strip()[:20] for x in v if str(x).strip()][:3]
            else:
                prepared[k] = []
        else:
            prepared[k] = v

    if "whatsapp_quick_replies" in prepared:
        current_wqr_items = prepared["whatsapp_quick_replies"]

    has_extended = False
    for k in EXTENDED_OMNICHANNEL_FIELDS:
        if k in prepared:
            current_omni_env[k] = prepared[k]
            has_extended = True

    if has_extended or current_omni_env or (isinstance(raw_wqr, dict) and "_wordpress" in raw_wqr):
        prepared["whatsapp_quick_replies"] = {
            **(raw_wqr if isinstance(raw_wqr, dict) else {}),
            "items": current_wqr_items,
            "_omnichannel": current_omni_env,
        }

    def _run_update(payload: dict[str, Any]):
        q = supabase.table("chatty_bots").update(payload).eq("id", bot_id)
        if user_id:
            q = q.eq("user_id", user_id)
        return q.execute()

    try:
        res = await run_db(lambda: _run_update(prepared))
    except Exception as exc:
        err_msg = str(exc).lower()
        if "could not find" in err_msg or "column" in err_msg or "pgrst204" in err_msg:
            safe_payload = {
                k: v for k, v in prepared.items() if k not in EXTENDED_OMNICHANNEL_FIELDS and k != "omnichannel_config"
            }
            if safe_payload:
                res = await run_db(lambda: _run_update(safe_payload))
            else:
                res = existing_res
        else:
            raise

    row = res.data[0] if (res and res.data) else existing_raw
    return unpack_omnichannel_bot_row(row)


async def find_bot_by_omnichannel_field(
    supabase: Any,
    field_name: str,
    expected_value: str,
    *,
    require_enabled_field: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Look up a bot by an omnichannel identifier or verify token (supports both
    top-level columns and the JSONB `_omnichannel` envelope)."""
    clean_expected = (expected_value or "").strip()
    if not clean_expected:
        return None

    # 1. Try direct indexed column query if not an extended-only field
    if field_name not in EXTENDED_OMNICHANNEL_FIELDS:
        try:
            def _q():
                q = supabase.table("chatty_bots").select("*").eq(field_name, clean_expected)
                if require_enabled_field and require_enabled_field not in EXTENDED_OMNICHANNEL_FIELDS:
                    q = q.eq(require_enabled_field, True)
                return q.limit(5).execute()

            direct_res = await run_db(_q)
            if direct_res and direct_res.data:
                for raw in direct_res.data:
                    unpacked = unpack_omnichannel_bot_row(raw)
                    if require_enabled_field and not unpacked.get(require_enabled_field):
                        continue
                    return unpacked
        except Exception:
            pass

    # 2. Scan bots and match unpacked omnichannel config
    try:
        all_res = await run_db(
            lambda: supabase.table("chatty_bots").select("*").limit(500).execute()
        )
        for raw in (all_res.data or []):
            unpacked = unpack_omnichannel_bot_row(raw)
            val = str(unpacked.get(field_name) or "").strip()
            if val and val == clean_expected:
                if require_enabled_field and not unpacked.get(require_enabled_field):
                    continue
                return unpacked
    except Exception as exc:
        logger.warning("Omnichannel bot lookup fallback failed for %s: %s", field_name, exc)

    return None
