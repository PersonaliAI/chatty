"""Public marketing preference endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.core.clients import supabase
from app.core.db import run_db
from app.services.marketing_consent import verify_unsubscribe_token

router = APIRouter()


@router.get("/api/marketing/unsubscribe", response_class=HTMLResponse)
async def marketing_unsubscribe(token: str = Query(default="")) -> HTMLResponse:
    payload = verify_unsubscribe_token(token)
    if not payload:
        return HTMLResponse("<h1>Link expired</h1><p>This unsubscribe link is invalid.</p>", status_code=400)
    lead_id = str(payload["lead_id"])
    result = await run_db(lambda: supabase.table("chatty_leads").select("id,email").eq("id", lead_id).maybe_single().execute())
    lead = result.data or {}
    if not lead or str(lead.get("email") or "").strip().lower() != str(payload["email"]).strip().lower():
        return HTMLResponse("<h1>Link expired</h1><p>This unsubscribe link is no longer valid.</p>", status_code=400)
    # Clearing consent is the enforcement signal used by every campaign
    # audience query. It works against existing installations even before the
    # optional audit timestamp migration has been applied.
    await run_db(lambda: supabase.table("chatty_leads").update({"marketing_consent": False}).eq("id", lead_id).execute())
    return HTMLResponse("<h1>You’re unsubscribed</h1><p>You will no longer receive marketing emails from Chatty. Support messages are unaffected.</p>")
