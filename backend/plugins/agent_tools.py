"""Tools the AI assistant can call from the Chatty widget.

Deliberately small: the widget only ever offers a hard-restricted allowlist
of tool names (see main.py's `allowed_tool_names` construction), so this
file only implements those — calendar booking (Google + Outlook), lead
capture, and web search. It used to be a full copy of Kin's much larger
tool-calling module (Gmail, Tasks, Contacts, MCP, memory, scheduling,
social posting, etc.); all of that was dead code here since the widget can
never select those tools, and has been removed.
"""

from __future__ import annotations

import logging
import os
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from google.genai import types as genai_types

from plugins import google_integrations as g
from plugins import microsoft_integrations as ms
from plugins import notifications as notify

logger = logging.getLogger("chatty.tools")


# ---------------------------------------------------------------------------
# Function declarations
# ---------------------------------------------------------------------------


def _schema(t: genai_types.Type, description: str = "") -> genai_types.Schema:
    return genai_types.Schema(type=t, description=description)


def _string_array(description: str) -> genai_types.Schema:
    return genai_types.Schema(
        type=genai_types.Type.ARRAY,
        description=description,
        items=genai_types.Schema(type=genai_types.Type.STRING),
    )


DECLARATIONS: list[genai_types.FunctionDeclaration] = [
    genai_types.FunctionDeclaration(
        name="create_calendar_event",
        description=(
            "Create a new Google Calendar event. Times should be ISO 8601 in the "
            "user's local timezone (e.g. '2026-05-12T15:00:00')."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "summary": _schema(genai_types.Type.STRING, "Event title."),
                "start": _schema(genai_types.Type.STRING, "ISO 8601 start datetime."),
                "end": _schema(genai_types.Type.STRING, "ISO 8601 end datetime."),
                "description": _schema(genai_types.Type.STRING, "Optional event description."),
                "location": _schema(genai_types.Type.STRING, "Optional physical/virtual location."),
                "attendees": _string_array("Optional list of attendee email addresses."),
                "all_day": _schema(genai_types.Type.BOOLEAN, "True for all-day events; start/end then become dates."),
            },
            required=["summary", "start", "end"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="check_calendar_availability",
        description=(
            "Free/busy query — returns intervals when the user is busy in a "
            "given window. Useful for 'am I free Tuesday at 3pm?'."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "start": _schema(genai_types.Type.STRING, "ISO 8601 start of the window."),
                "end": _schema(genai_types.Type.STRING, "ISO 8601 end of the window."),
            },
            required=["start", "end"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="list_outlook_events",
        description=(
            "List Outlook calendar events. Optional days_ahead window similar to "
            "the Google Calendar tool."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "calendar_id": _schema(genai_types.Type.STRING, "Optional calendar ID (default: primary)."),
                "days_ahead": _schema(genai_types.Type.INTEGER, "Lookahead window (default 7)."),
                "limit": _schema(genai_types.Type.INTEGER, "Max events (default 25)."),
            },
        ),
    ),
    genai_types.FunctionDeclaration(
        name="create_outlook_event",
        description="Create an Outlook calendar event. Times in ISO 8601 in user's local timezone.",
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "subject": _schema(genai_types.Type.STRING, "Event title."),
                "start": _schema(genai_types.Type.STRING, "ISO 8601 start datetime."),
                "end": _schema(genai_types.Type.STRING, "ISO 8601 end datetime."),
                "body": _schema(genai_types.Type.STRING, "Optional description."),
                "location": _schema(genai_types.Type.STRING, "Optional location."),
                "attendees": _string_array("Optional attendee emails."),
                "is_all_day": _schema(genai_types.Type.BOOLEAN, "All-day event."),
                "calendar_id": _schema(genai_types.Type.STRING, "Optional non-default calendar."),
                "online_meeting": _schema(genai_types.Type.BOOLEAN, "Set true to create a Microsoft Teams online meeting and generate a join link."),
            },
            required=["subject", "start", "end"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="create_lead",
        description=(
            "Record visitor details (name, email, phone, company, job_title, country, industry, budget, etc.) as a business lead. "
            "Call this when the visitor shares their contact info, or after booking a meeting."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "bot_id": _schema(genai_types.Type.STRING, "UUID of the chatbot widget."),
                "name": _schema(genai_types.Type.STRING, "Visitor's full name."),
                "email": _schema(genai_types.Type.STRING, "Visitor's email address."),
                "phone": _schema(genai_types.Type.STRING, "Visitor's phone number."),
                "company": _schema(genai_types.Type.STRING, "Visitor's company name."),
                "job_title": _schema(genai_types.Type.STRING, "Visitor's job title."),
                "country": _schema(genai_types.Type.STRING, "Visitor's country."),
                "industry": _schema(genai_types.Type.STRING, "Visitor's industry."),
                "budget": _schema(genai_types.Type.STRING, "Visitor's budget."),
            },
            required=["bot_id", "name", "email"],
        ),
    ),
]


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _need_google(user: dict[str, Any]) -> dict[str, Any] | None:
    if not user.get("google_access_token"):
        return {
            "error": "Google not connected. Ask the user to visit /dashboard/integrations to connect their Google account.",
        }
    return None


def _need_microsoft(
    user: dict[str, Any], *, required_scope: Optional[str] = None
) -> dict[str, Any] | None:
    """Guard a Microsoft tool call.

    Returns None if everything's good, or a dict with an `error` describing
    what the user must do.  When `required_scope` is given (e.g.
    "Calendars.ReadWrite"), checks the granted scope set stored at connect
    time. If the scope wasn't granted, Graph would return either 403 or
    a silent empty result — neither is useful to the user. Surface the real
    fix instead: "reconnect Microsoft."
    """
    if not user.get("microsoft_access_token"):
        return {
            "error": "Microsoft not connected. Ask the user to visit /dashboard/integrations to connect their Microsoft 365 account.",
        }
    if required_scope:
        granted = (user.get("microsoft_scopes") or "").lower()
        # Graph returns scopes space-separated (or comma in some flows).
        if required_scope.lower() not in granted:
            return {
                "error": (
                    f"Microsoft is connected but the '{required_scope}' "
                    "permission was not granted. Tell the user: 'Your "
                    "Microsoft connection is missing calendar/contacts "
                    "permission. Please go to /dashboard/integrations, "
                    "click Disconnect Microsoft, then Connect Microsoft "
                    "again — the new consent screen will ask for the "
                    "calendar and contacts permissions.'"
                ),
            }
    return None


def _parse_iso(s: str) -> datetime:
    # Accept ISO with offset, "...Z", space separator, or date-only.
    s = (s or "").strip()
    if not s:
        raise ValueError("empty datetime")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    for candidate in (s, s.replace(" ", "T"), s + "T00:00:00"):
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue
    raise ValueError(f"unparseable datetime: {s!r}")


async def _create_calendar_event(args: dict, user: dict, supabase) -> dict:
    if g_err := _need_google(user):
        return g_err
    return await g.create_calendar_event(
        supabase,
        user,
        summary=args.get("summary") or "",
        start=args.get("start") or "",
        end=args.get("end") or "",
        description=args.get("description"),
        location=args.get("location"),
        attendees=list(args.get("attendees") or []) or None,
        all_day=bool(args.get("all_day")),
        timezone_override=args.get("_owner_timezone"),
    )


async def _check_calendar_availability(args: dict, user: dict, supabase) -> dict:
    if g_err := _need_google(user):
        return g_err
    try:
        time_min = _parse_iso(args.get("start") or "")
        time_max = _parse_iso(args.get("end") or "")
    except ValueError:
        return {"error": (
            "Invalid time format. Call this again with 'start' and 'end' as ISO 8601 "
            "datetimes INCLUDING the timezone offset, e.g. '2026-06-25T09:00:00+05:30'."
        )}
    if time_max <= time_min:
        return {"error": "'end' must be after 'start' — use a 30-minute window."}
    try:
        return await g.check_calendar_availability(
            supabase, user, time_min=time_min, time_max=time_max,
        )
    except g.GoogleNotConnected:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("check_calendar_availability failed")
        return {"error": f"availability check failed: {exc}"}


async def _list_outlook_events(args: dict, user: dict, supabase) -> dict:
    if g_err := _need_microsoft(user, required_scope="Calendars.ReadWrite"):
        return g_err
    days = max(1, min(int(args.get("days_ahead") or 7), 60))
    now = datetime.now(tz=timezone.utc)
    return {
        "events": await ms.list_outlook_events(
            supabase,
            user,
            calendar_id=args.get("calendar_id"),
            time_min=now - timedelta(hours=2),
            time_max=now + timedelta(days=days),
            limit=int(args.get("limit") or 25),
        )
    }


async def _create_outlook_event(args: dict, user: dict, supabase) -> dict:
    if g_err := _need_microsoft(user, required_scope="Calendars.ReadWrite"):
        return g_err
    return await ms.create_outlook_event(
        supabase,
        user,
        subject=args.get("subject") or "",
        start=args.get("start") or "",
        end=args.get("end") or "",
        body=args.get("body"),
        location=args.get("location"),
        attendees=list(args.get("attendees") or []) or None,
        is_all_day=bool(args.get("is_all_day")),
        calendar_id=args.get("calendar_id"),
        online_meeting=bool(args.get("online_meeting")),
        timezone_override=args.get("_owner_timezone"),
    )


def _dedupe_doubled(v):
    """Occasionally the model emits a field value as itself repeated twice
    back-to-back with no separator (e.g. "da@g.comda@g.com") — an LLM
    generation artifact, not anything the visitor typed. Collapse it back
    to the single value when the string is cleanly halvable that way."""
    if not isinstance(v, str) or len(v) < 2 or len(v) % 2 != 0:
        return v
    half = len(v) // 2
    return v[:half] if v[:half] == v[half:] else v


async def _create_lead(args: dict, user: dict, supabase) -> dict:
    bot_id = args.get("bot_id")
    if not bot_id:
        return {"error": "bot_id required"}
    session_id = args.get("session_id")
    company = _dedupe_doubled(args.get("company") or args.get("company_name"))
    fields = {
        "name": _dedupe_doubled(args.get("name")),
        "email": _dedupe_doubled(args.get("email")),
        "phone": _dedupe_doubled(args.get("phone")),
        "company": company,
        "job_title": _dedupe_doubled(args.get("job_title")),
        "country": args.get("country"),
        "city": args.get("city"),
        "region": args.get("region"),
        "lat": args.get("lat"),
        "lon": args.get("lon"),
        "industry": args.get("industry"),
        "budget": args.get("budget"),
    }

    standard_keys = [
        "bot_id", "session_id", "name", "email", "phone", "company", "company_name",
        "job_title", "country", "city", "region", "lat", "lon", "industry", "budget",
    ]
    custom_fields = {k: v for k, v in args.items() if k not in standard_keys and v is not None}

    # Dedupe: one lead per widget session. If a lead already exists for this
    # session, MERGE new (non-null) details into it instead of inserting again.
    existing = None
    if session_id:
        try:
            r = supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).eq(
                "session_id", session_id).order("created_at", desc=True).limit(1).execute()
            if r.data:
                existing = r.data[0]
        except Exception:
            logger.exception("lead dedupe lookup failed")

    try:
        if existing:
            update = {k: v for k, v in fields.items() if v}
            if custom_fields:
                update["custom_fields"] = {**(existing.get("custom_fields") or {}), **custom_fields}
            if update:
                supabase.table("chatty_leads").update(update).eq("id", existing["id"]).execute()
            return {"success": True, "lead_id": existing["id"], "message": "Lead updated"}

        insert_data = {"bot_id": bot_id, "session_id": session_id, **fields, "custom_fields": custom_fields}
        res = supabase.table("chatty_leads").insert(insert_data).execute()
        if res.data:
            lead = res.data[0]
            try:
                supabase.table("chatty_audit_logs").insert({
                    "bot_id": bot_id,
                    "action": "lead_created",
                    "details": f"Captured lead: {fields.get('name')} ({fields.get('email')})",
                    "performed_by": "assistant",
                }).execute()
            except Exception:
                pass
            try:
                bot_res = supabase.table("chatty_bots").select("webhook_url").eq("id", bot_id).execute()
                webhook_url = (bot_res.data or [{}])[0].get("webhook_url")
                if webhook_url:
                    await notify.deliver_webhook(
                        url=webhook_url, event="new_lead", bot_id=bot_id,
                        data={k: v for k, v in {**fields, "custom_fields": custom_fields, "lead_id": lead["id"]}.items() if v},
                    )
            except Exception:
                logger.exception("lead webhook delivery failed")
            try:
                await notify.enqueue_webhook_event(
                    supabase, bot_id=bot_id, event="lead.created", session_id=session_id or "",
                    data={"id": lead["id"], **{k: v for k, v in {**fields, "custom_fields": custom_fields}.items() if v}},
                )
            except Exception:
                logger.exception("lead.created webhook enqueue failed")
            return {"success": True, "lead_id": lead["id"], "message": "Lead registered successfully"}
        return {"error": "Failed to create lead"}
    except Exception as e:
        logger.exception("create_lead failed")
        return {"error": str(e)}


async def _process_widget_booking(args: dict, user: dict, supabase, result: dict, context: dict):
    bot_id = context.get("bot_id")
    if not bot_id:
        return

    def _insert_notification(row: dict):
        """Insert a notification row; retry without html_content if that
        column doesn't exist yet, so a pending migration never drops sends."""
        try:
            supabase.table("chatty_notifications").insert(row).execute()
        except Exception:
            if "html_content" in row:
                fallback = {k: v for k, v in row.items() if k != "html_content"}
                try:
                    supabase.table("chatty_notifications").insert(fallback).execute()
                    return
                except Exception:
                    logger.exception("Notification insert failed (fallback)")
            else:
                logger.exception("Notification insert failed")

    try:
        # 1. Get bot info
        res_bot = supabase.table("chatty_bots").select("*").eq("id", bot_id).execute()
        if not res_bot.data:
            return
        bot = res_bot.data[0]

        # 2. Get attendee details
        attendees = args.get("attendees") or []
        visitor_email = attendees[0] if attendees else "guest@example.com"

        # Parse visitor name from summary/subject or default
        summary = args.get("summary") or args.get("subject") or "Demo Meeting"
        visitor_name = summary.replace("Demo Meeting with ", "").replace("Demo Meeting", "").strip() or "Guest"

        # 3. Find or create lead
        res_lead = supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).eq("email", visitor_email).execute()
        lead_id = None
        if res_lead.data:
            lead_id = res_lead.data[0]["id"]
        else:
            # Create a lead
            lead_res = supabase.table("chatty_leads").insert({
                "bot_id": bot_id,
                "name": visitor_name,
                "email": visitor_email,
                "phone": ""
            }).execute()
            if lead_res.data:
                lead_id = lead_res.data[0]["id"]
                try:
                    await notify.enqueue_webhook_event(
                        supabase, bot_id=bot_id, event="lead.created",
                        session_id=context.get("session_id") or "",
                        data={"id": lead_id, "name": visitor_name, "email": visitor_email},
                    )
                except Exception:
                    logger.exception("lead.created webhook enqueue failed (booking flow)")

        # 4. Generate meeting link depending on provider
        provider = bot.get("meeting_provider") or "google_meet"
        tz_label = bot.get("bot_timezone") or "UTC"
        if provider == "google_meet":
            # Attach a real Meet conference to the event we just created.
            meeting_link = result.get("hangoutLink") or result.get("hangout_link")
            event_id = result.get("id")
            if not meeting_link and event_id:
                try:
                    meet = await g.add_meet_to_event(supabase, user, event_id=event_id)
                    meeting_link = meet.get("hangout_link")
                except Exception:
                    logger.exception("Failed to attach Google Meet conference")
            if not meeting_link:
                meeting_link = result.get("html_link") or result.get("htmlLink")

        elif provider == "teams":
            # Real Teams join link from the Outlook online meeting we created.
            meeting_link = result.get("online_meeting_url") or result.get("web_link")
        else:
            meeting_link = result.get("hangoutLink") or result.get("html_link")

        # Graceful fallback link if a provider couldn't mint a real one
        if not meeting_link:
            meeting_link = (
                result.get("html_link") or result.get("web_link")
                or result.get("htmlLink") or "https://meet.google.com/"
            )

        # 5. Insert meeting record
        meet_res = supabase.table("chatty_meetings").insert({
            "bot_id": bot_id,
            "lead_id": lead_id,
            "title": summary,
            "description": args.get("description") or "Scheduled via AI Assistant",
            "start_time": args.get("start"),
            "end_time": args.get("end"),
            "timezone": bot.get("bot_timezone") or "UTC",
            "meeting_link": meeting_link,
            "provider": provider,
            "status": "scheduled",
            "attendee_email": visitor_email,
            "attendee_name": visitor_name
        }).execute()

        meeting_id = meet_res.data[0]["id"] if meet_res.data else None

        # 6. Send real notifications (beautiful HTML email + push) and record them
        start_label = args.get("start") or ""
        owner_email = user.get("email") or "admin@personaliai.com"

        # --- Client confirmation email ---
        client_html = notify.build_client_email_html(
            visitor_name=visitor_name, summary=summary, start=start_label,
            timezone_label=tz_label, meeting_link=meeting_link, provider=provider,
        )
        client_subject = f"Meeting Confirmed: {summary}"
        client_status = await notify.deliver_email(
            supabase=supabase, owner_user=user, to=visitor_email,
            subject=client_subject, html=client_html,
        )
        _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": visitor_email,
            "channel": "email",
            "type": "client",
            "subject": client_subject,
            "content": f"Your meeting '{summary}' is confirmed for {start_label} ({tz_label}). Join: {meeting_link}",
            "html_content": client_html,
            "status": client_status,
        })

        # --- Admin notification email ---
        admin_html = notify.build_admin_email_html(
            visitor_name=visitor_name, visitor_email=visitor_email, summary=summary,
            start=start_label, timezone_label=tz_label, meeting_link=meeting_link,
            provider=provider,
        )
        admin_subject = f"New Meeting Booked: {visitor_name}"
        admin_status = await notify.deliver_email(
            supabase=supabase, owner_user=user, to=owner_email,
            subject=admin_subject, html=admin_html,
        )
        _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": owner_email,
            "channel": "email",
            "type": "admin",
            "subject": admin_subject,
            "content": f"New meeting booked by {visitor_name} ({visitor_email}) for {start_label}.",
            "html_content": admin_html,
            "status": admin_status,
        })

        # --- Push notifications (OneSignal) ---
        client_push_status = await notify.deliver_push(
            headings="Meeting Booked",
            contents=f"Your meeting is set for {start_label}.",
            external_id=visitor_email,
        )
        _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": visitor_email,
            "channel": "onesignal",
            "type": "client",
            "subject": "Meeting Booked",
            "content": f"Your meeting is set for {start_label}.",
            "status": client_push_status,
        })

        admin_push_status = await notify.deliver_push(
            headings="New Booking",
            contents=f"New meeting scheduled by {visitor_name}.",
            external_id=owner_id if (owner_id := user.get("auth_user_id")) else None,
        )
        _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": owner_email,
            "channel": "onesignal",
            "type": "admin",
            "subject": "New Booking",
            "content": f"New meeting scheduled by {visitor_name}.",
            "status": admin_push_status,
        })

        # 7. Write audit log
        supabase.table("chatty_audit_logs").insert({
            "bot_id": bot_id,
            "action": "meeting_booked",
            "details": f"Meeting scheduled with {visitor_name} ({visitor_email}) at {args.get('start')}. Provider: {provider}.",
            "performed_by": "assistant"
        }).execute()

    except Exception:
        logger.exception("Failed to process widget booking side effects")


# ---------------------------------------------------------------------------
# Web search — via Jina AI (s.jina.ai). Self-contained here rather than
# importing plugins.widget_brain's own _web_search (used by the tool-calling
# loop) or main.py's _fetch_url_content (used by the widget's KB crawler) —
# main.py imports this module, so pulling from either would be circular.
# ---------------------------------------------------------------------------


async def _web_search(args: dict, user: dict, supabase) -> dict:
    query = (args.get("query") or "").strip()
    if not query:
        return {"error": "query is required"}
    key = os.environ.get("JINA_API_KEY", "").strip()
    headers = {"Accept": "text/plain", "X-Respond-With": "no-content"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"https://s.jina.ai/{urllib.parse.quote(query)}", headers=headers)
            if r.status_code == 200 and r.text.strip():
                return {"results": r.text.strip()[:6000]}
            if r.status_code in (401, 402, 403):
                logger.warning("web_search auth error %s — check JINA_API_KEY", r.status_code)
    except Exception:
        logger.exception("web_search failed for %r", query)
    return {"error": "Web search is unavailable right now."}


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


async def execute(
    name: str,
    args: dict,
    *,
    user: dict,
    supabase,
    genai_client=None,
    context: Optional[dict] = None,
) -> dict:
    """Dispatch a function call to its handler."""
    try:
        if name == "create_calendar_event":
            res = await _create_calendar_event(args, user, supabase)
            if context and context.get("source") == "widget" and "error" not in res:
                await _process_widget_booking(args, user, supabase, res, context)
            return res
        if name == "check_calendar_availability":
            return await _check_calendar_availability(args, user, supabase)
        if name == "create_lead":
            return await _create_lead(args, user, supabase)
        if name == "web_search":
            return await _web_search(args, user, supabase)
        if name == "list_outlook_events":
            return await _list_outlook_events(args, user, supabase)
        if name == "create_outlook_event":
            res = await _create_outlook_event(args, user, supabase)
            if context and context.get("source") == "widget" and "error" not in res:
                await _process_widget_booking(args, user, supabase, res, context)
            return res
        return {"error": f"unknown tool: {name}"}
    except ms.MicrosoftNotConnected:
        return {
            "error": "Microsoft not connected. Ask the user to visit /dashboard/integrations.",
        }
    except g.GoogleNotConnected:
        return {
            "error": "Google not connected. Ask the user to visit /dashboard/integrations to connect their Google account.",
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("tool %s failed", name)
        return {"error": f"tool failed: {exc}"}
