"""Public marketing preference endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.core.clients import supabase
from app.core.db import run_db
from app.services.marketing_consent import verify_unsubscribe_token

router = APIRouter()


def _render_unsubscribe_page(heading: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{heading} — Chatty</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:460px;margin:40px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px;text-align:center;box-shadow:0 4px 16px rgba(15,23,42,0.05);">
    <h1 style="margin:0 0 10px;font-size:20px;line-height:28px;font-weight:800;color:#0f172a;">{heading}</h1>
    <p style="margin:0;font-size:14px;line-height:22px;color:#475569;">{message}</p>
  </div>
</body>
</html>"""


@router.get("/api/marketing/unsubscribe", response_class=HTMLResponse)
async def marketing_unsubscribe(token: str = Query(default="")) -> HTMLResponse:
    payload = verify_unsubscribe_token(token)
    if not payload:
        return HTMLResponse(_render_unsubscribe_page("Link expired", "This unsubscribe link is invalid."), status_code=400)
    lead_id = str(payload["lead_id"])
    result = await run_db(lambda: supabase.table("chatty_leads").select("id,email").eq("id", lead_id).maybe_single().execute())
    lead = result.data or {}
    if not lead or str(lead.get("email") or "").strip().lower() != str(payload["email"]).strip().lower():
        return HTMLResponse(_render_unsubscribe_page("Link expired", "This unsubscribe link is no longer valid."), status_code=400)
    # Clearing consent is the enforcement signal used by every campaign
    # audience query. It works against existing installations even before the
    # optional audit timestamp migration has been applied.
    await run_db(lambda: supabase.table("chatty_leads").update({"marketing_consent": False}).eq("id", lead_id).execute())
    return HTMLResponse(_render_unsubscribe_page("You’re unsubscribed", "You will no longer receive marketing emails from Chatty. Support messages are unaffected."))
