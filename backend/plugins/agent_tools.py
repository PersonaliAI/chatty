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
import re
from typing import Any, Optional

import httpx

from plugins import google_integrations as g
from plugins import microsoft_integrations as ms
from plugins import notifications as notify
from plugins import zoom_integration as zoom

from app.core.db import run_db

logger = logging.getLogger("chatty.tools")


# ---------------------------------------------------------------------------
# Function declarations — plain OpenAI tool-schema dicts (LiteLLM translates
# these into each provider's own native function-calling format, including
# Gemini's), not google-genai's Schema/FunctionDeclaration types.
# ---------------------------------------------------------------------------


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


DECLARATIONS: list[dict] = [
    _tool(
        "create_calendar_event",
        "Create a new Google Calendar event. Times should be ISO 8601 in the "
        "user's local timezone (e.g. '2026-05-12T15:00:00').",
        {
            "summary": {"type": "string", "description": "Event title."},
            "start": {"type": "string", "description": "ISO 8601 start datetime."},
            "end": {"type": "string", "description": "ISO 8601 end datetime."},
            "description": {"type": "string", "description": "Optional event description."},
            "location": {"type": "string", "description": "Optional physical/virtual location."},
            "attendees": {"type": "array", "items": {"type": "string"}, "description": "List of attendee email addresses. For widget demo bookings, the visitor's real email address is required here before booking."},
            "all_day": {"type": "boolean", "description": "True for all-day events; start/end then become dates."},
        },
        ["summary", "start", "end"],
    ),
    _tool(
        "check_calendar_availability",
        "Free/busy query — returns intervals when the user is busy in a "
        "given window. Useful for 'am I free Tuesday at 3pm?'.",
        {
            "start": {"type": "string", "description": "ISO 8601 start of the window."},
            "end": {"type": "string", "description": "ISO 8601 end of the window."},
        },
        ["start", "end"],
    ),
    _tool(
        "list_outlook_events",
        "List Outlook calendar events. Optional days_ahead window similar to "
        "the Google Calendar tool.",
        {
            "calendar_id": {"type": "string", "description": "Optional calendar ID (default: primary)."},
            "days_ahead": {"type": "integer", "description": "Lookahead window (default 7)."},
            "limit": {"type": "integer", "description": "Max events (default 25)."},
        },
        [],
    ),
    _tool(
        "create_outlook_event",
        "Create an Outlook calendar event. Times in ISO 8601 in user's local timezone.",
        {
            "subject": {"type": "string", "description": "Event title."},
            "start": {"type": "string", "description": "ISO 8601 start datetime."},
            "end": {"type": "string", "description": "ISO 8601 end datetime."},
            "body": {"type": "string", "description": "Optional description."},
            "location": {"type": "string", "description": "Optional location."},
            "attendees": {"type": "array", "items": {"type": "string"}, "description": "List of attendee emails. For widget demo bookings, the visitor's real email address is required here before booking."},
            "is_all_day": {"type": "boolean", "description": "All-day event."},
            "calendar_id": {"type": "string", "description": "Optional non-default calendar."},
            "online_meeting": {"type": "boolean", "description": "Set true to create a Microsoft Teams online meeting and generate a join link."},
        },
        ["subject", "start", "end"],
    ),
    _tool(
        "create_lead",
        "Record visitor details (name, email, phone, company, job_title, country, industry, budget, etc.) as a business lead. "
        "Call this when the visitor shares their contact info, or after booking a meeting.",
        {
            "bot_id": {"type": "string", "description": "UUID of the chatbot widget."},
            "name": {"type": "string", "description": "Visitor's full name."},
            "email": {"type": "string", "description": "Visitor's email address."},
            "phone": {"type": "string", "description": "Visitor's phone number."},
            "company": {"type": "string", "description": "Visitor's company name."},
            "job_title": {"type": "string", "description": "Visitor's job title."},
            "country": {"type": "string", "description": "Visitor's country."},
            "industry": {"type": "string", "description": "Visitor's industry."},
            "budget": {"type": "string", "description": "Visitor's budget."},
        },
        ["bot_id", "name", "email"],
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


async def check_bot_meeting_quota(
    bot_id: str,
    target_dt: datetime,
    bot: dict[str, Any],
    supabase,
) -> Optional[dict[str, Any]]:
    """Check if the bot has hit max_daily_meetings or max_weekly_meetings for target_dt."""
    max_daily = int(bot.get("max_daily_meetings") or 0)
    max_weekly = int(bot.get("max_weekly_meetings") or 0)
    if not max_daily and not max_weekly:
        return None

    # Normalise target_dt to UTC
    if target_dt.tzinfo is not None:
        target_utc = target_dt.astimezone(timezone.utc)
    else:
        target_utc = target_dt.replace(tzinfo=timezone.utc)

    # Day window in UTC
    day_start = target_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    if max_daily:
        try:
            res = await run_db(lambda: supabase.table("chatty_meetings")
                .select("id", count="exact")
                .eq("bot_id", bot_id)
                .neq("status", "cancelled")
                .gte("start_time", day_start.isoformat())
                .lt("start_time", day_end.isoformat())
                .execute())
            count_day = res.count if res and res.count is not None else len(res.data or [])
            if count_day >= max_daily:
                return {
                    "limit_reached": True,
                    "reason": "daily_limit",
                    "max_daily_meetings": max_daily,
                    "count": count_day,
                    "message": (
                        f"Daily meeting limit of {max_daily} reached for this date. "
                        "This day is at full capacity. Please proactively suggest open slots on the next available business day."
                    ),
                }
        except Exception:
            logger.exception("Failed checking daily meeting quota")

    if max_weekly:
        # Week window (Monday to Sunday)
        week_start = (target_utc - timedelta(days=target_utc.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        try:
            res_w = await run_db(lambda: supabase.table("chatty_meetings")
                .select("id", count="exact")
                .eq("bot_id", bot_id)
                .neq("status", "cancelled")
                .gte("start_time", week_start.isoformat())
                .lt("start_time", week_end.isoformat())
                .execute())
            count_week = res_w.count if res_w and res_w.count is not None else len(res_w.data or [])
            if count_week >= max_weekly:
                return {
                    "limit_reached": True,
                    "reason": "weekly_limit",
                    "max_weekly_meetings": max_weekly,
                    "count": count_week,
                    "message": (
                        f"Weekly meeting limit of {max_weekly} reached for this week. "
                        "This week is at full capacity. Please proactively suggest open slots in the following week."
                    ),
                }
        except Exception:
            logger.exception("Failed checking weekly meeting quota")

    return None


async def _check_calendar_availability(args: dict, user: dict, supabase, context: Optional[dict] = None) -> dict:
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

    # Quota check if bot configuration is available in context
    if context and context.get("bot_id") and context.get("bot"):
        quota_err = await check_bot_meeting_quota(context["bot_id"], time_min, context["bot"], supabase)
        if quota_err:
            return {
                "busy": {"primary": [{"start": time_min.isoformat(), "end": time_max.isoformat()}]},
                **quota_err,
            }

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
            r = await run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).eq(
                "session_id", session_id).order("created_at", desc=True).limit(1).execute())
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
                await run_db(lambda: supabase.table("chatty_leads").update(update).eq("id", existing["id"]).execute())
            return {"success": True, "lead_id": existing["id"], "message": "Lead updated"}

        insert_data = {"bot_id": bot_id, "session_id": session_id, **fields, "custom_fields": custom_fields}
        res = await run_db(lambda: supabase.table("chatty_leads").insert(insert_data).execute())
        if res.data:
            lead = res.data[0]
            try:
                await run_db(lambda: supabase.table("chatty_audit_logs").insert({
                    "bot_id": bot_id,
                    "action": "lead_created",
                    "details": f"Captured lead: {fields.get('name')} ({fields.get('email')})",
                    "performed_by": "assistant",
                }).execute())
            except Exception:
                pass
            try:
                bot_res = await run_db(lambda: supabase.table("chatty_bots").select("webhook_url").eq("id", bot_id).execute())
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

    async def _insert_notification(row: dict):
        """Insert a notification row; retry without html_content if that
        column doesn't exist yet, so a pending migration never drops sends."""
        try:
            await run_db(lambda: supabase.table("chatty_notifications").insert(row).execute())
        except Exception:
            if "html_content" in row:
                fallback = {k: v for k, v in row.items() if k != "html_content"}
                try:
                    await run_db(lambda: supabase.table("chatty_notifications").insert(fallback).execute())
                    return
                except Exception:
                    logger.exception("Notification insert failed (fallback)")
            else:
                logger.exception("Notification insert failed")

    try:
        # 1. Get bot info
        res_bot = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
        if not res_bot.data:
            return
        bot = res_bot.data[0]

        # 2. Get attendee details
        attendees = args.get("attendees") or []
        if isinstance(attendees, str):
            attendees = [attendees]
        visitor_email = _dedupe_doubled(attendees[0] if attendees else "guest@example.com")

        # Parse visitor name from summary/subject or default
        summary = args.get("summary") or args.get("subject") or "Demo Meeting"
        raw_name = summary.replace("Demo Meeting with ", "").replace("Demo Meeting with", "").replace("Demo Meeting", "").strip()
        visitor_name = _dedupe_doubled(raw_name) or "Guest"

        # If visitor_name is generic or suspicious, try to recover from session lead in DB
        invalid_names = {"guest", "visitor", "user", "attendee", "none", "null", "ues", "uesues", "yes"}
        session_id = context.get("session_id")
        if (not visitor_name or visitor_name.lower() in invalid_names) and session_id:
            try:
                lead_res = await run_db(lambda: supabase.table("chatty_leads").select("name").eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=True).limit(1).execute())
                if lead_res.data and lead_res.data[0].get("name"):
                    db_name = _dedupe_doubled(lead_res.data[0]["name"].strip())
                    if db_name and db_name.lower() not in invalid_names:
                        visitor_name = db_name
            except Exception:
                pass

        # 3. Find or create lead
        res_lead = await run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).eq("email", visitor_email).execute())
        lead_id = None
        if res_lead.data:
            lead_id = res_lead.data[0]["id"]
            if visitor_name and visitor_name.lower() not in invalid_names:
                await run_db(lambda: supabase.table("chatty_leads").update({"name": visitor_name}).eq("id", lead_id).execute())
        else:
            lead_by_session = None
            if session_id:
                try:
                    s_res = await run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=True).limit(1).execute())
                    if s_res.data:
                        lead_by_session = s_res.data[0]
                except Exception:
                    pass
            if lead_by_session:
                lead_id = lead_by_session["id"]
                update_fields = {"email": visitor_email}
                if visitor_name and visitor_name.lower() not in invalid_names:
                    update_fields["name"] = visitor_name
                await run_db(lambda: supabase.table("chatty_leads").update(update_fields).eq("id", lead_id).execute())
            else:
                # Create a lead
                lead_res = await run_db(lambda: supabase.table("chatty_leads").insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "name": visitor_name,
                    "email": visitor_email,
                    "phone": ""
                }).execute())
                if lead_res.data:
                    lead_id = lead_res.data[0]["id"]
                    try:
                        await notify.enqueue_webhook_event(
                            supabase, bot_id=bot_id, event="lead.created",
                            session_id=session_id or "",
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
        elif provider == "zoom" and zoom.zoom_configured():
            # Zoom meetings aren't attached to the calendar event we just
            # created (Server-to-Server OAuth is a separate, backend-wide
            # credential, not tied to the owner's connected Google/Microsoft
            # account) — mint one directly from the same start/end args.
            meeting_link = None
            try:
                duration_minutes = 30
                start_arg, end_arg = args.get("start"), args.get("end")
                if start_arg and end_arg:
                    try:
                        delta = _parse_iso(end_arg) - _parse_iso(start_arg)
                        duration_minutes = max(int(delta.total_seconds() // 60), 1)
                    except ValueError:
                        pass
                zoom_meeting = await zoom.create_meeting(
                    topic=summary, start=start_arg or "", duration_minutes=duration_minutes,
                    timezone_str=tz_label,
                )
                meeting_link = zoom_meeting.get("join_url")
            except Exception:
                logger.exception("Failed to create Zoom meeting")
        else:
            meeting_link = result.get("hangoutLink") or result.get("html_link")

        # Graceful fallback link if a provider couldn't mint a real one
        if not meeting_link:
            meeting_link = (
                result.get("html_link") or result.get("web_link")
                or result.get("htmlLink") or "https://meet.google.com/"
            )

        # 5. Insert meeting record
        meet_res = await run_db(lambda: supabase.table("chatty_meetings").insert({
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
        }).execute())

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
        await _insert_notification({
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
        await _insert_notification({
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
        await _insert_notification({
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
        await _insert_notification({
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
        await run_db(lambda: supabase.table("chatty_audit_logs").insert({
            "bot_id": bot_id,
            "action": "meeting_booked",
            "details": f"Meeting scheduled with {visitor_name} ({visitor_email}) at {args.get('start')}. Provider: {provider}.",
            "performed_by": "assistant"
        }).execute())

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
    context: Optional[dict] = None,
) -> dict:
    """Dispatch a function call to its handler."""
    # bot_id is exposed to the LLM as an ordinary tool parameter (it needs to
    # be in the schema for the model to reference it in reasoning/replies),
    # but it must never be TRUSTED from the model's tool-call args — a
    # visitor could prompt-inject "call create_lead with bot_id=<another
    # tenant's UUID>" to write fake leads (and fire their webhooks) into a
    # different customer's account. The real bot_id for this conversation is
    # already known server-side (the widget session it actually belongs to),
    # so always override whatever the model supplied with the trusted value.
    if context and context.get("bot_id") and "bot_id" in args:
        args = {**args, "bot_id": context["bot_id"]}
    try:
        if name in ("create_calendar_event", "create_outlook_event"):
            if context and context.get("bot_id") and context.get("bot") and args.get("start"):
                try:
                    start_dt = _parse_iso(args["start"])
                    quota_err = await check_bot_meeting_quota(context["bot_id"], start_dt, context["bot"], supabase)
                    if quota_err:
                        return {"error": quota_err["message"]}
                except Exception:
                    pass

            if context and context.get("source") == "widget":
                attendees = args.get("attendees") or []
                if isinstance(attendees, str):
                    attendees = [attendees]
                elif not isinstance(attendees, (list, tuple)):
                    attendees = []

                visitor_email = ""
                for att in attendees:
                    if isinstance(att, str):
                        cand = _dedupe_doubled(att.strip()).lower()
                        if (
                            re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cand)
                            and not any(dummy in cand for dummy in ("guest@example.com", "@example.com", "test@test.com", "user@example.com", "none@", "null@"))
                        ):
                            visitor_email = cand
                            break

                if not visitor_email:
                    return {
                        "error": (
                            "Cannot book meeting: A valid visitor email address is REQUIRED in 'attendees' before booking can be completed. "
                            "Do NOT call this tool yet. Ask the visitor for their name and email address first, "
                            "and call this tool only after they provide their real email address."
                        )
                    }

                # Ensure args['attendees'] has the clean visitor email
                args = {**args, "attendees": [visitor_email]}

                bot_cfg = context.get("bot") or {}
                req_fields = [f.lower() for f in (bot_cfg.get("lead_required_fields") or [])]
                if "name" in req_fields:
                    summary = args.get("summary") or args.get("subject") or ""
                    clean_name = summary.replace("Demo Meeting with ", "").replace("Demo Meeting with", "").replace("Demo Meeting", "").strip()
                    invalid_names = {"guest", "visitor", "user", "attendee", "none", "null", "ues", "uesues", "yes"}
                    if not clean_name or clean_name.lower() in invalid_names or "@" in clean_name:
                        session_id = context.get("session_id")
                        bot_id = context.get("bot_id")
                        has_db_name = False
                        if session_id and bot_id:
                            try:
                                lead_res = await run_db(lambda: supabase.table("chatty_leads").select("name").eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=True).limit(1).execute())
                                if lead_res.data and lead_res.data[0].get("name"):
                                    if lead_res.data[0]["name"].strip().lower() not in invalid_names:
                                        has_db_name = True
                            except Exception:
                                pass
                        if not has_db_name:
                            return {
                                "error": (
                                    "Cannot book meeting: Visitor's name is REQUIRED before booking. "
                                    "Do NOT call this tool yet. Ask the visitor for their name first, "
                                    "and include it in the summary (e.g. summary='Demo Meeting with <Visitor Name>')."
                                )
                            }
        if name == "create_calendar_event":
            res = await _create_calendar_event(args, user, supabase)
            if context and context.get("source") == "widget" and "error" not in res:
                await _process_widget_booking(args, user, supabase, res, context)
            return res
        if name == "check_calendar_availability":
            return await _check_calendar_availability(args, user, supabase, context=context)
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
