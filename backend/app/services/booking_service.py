"""Calendar booking side effects for widget-created meetings."""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Optional

from plugins import google_integrations as g
from plugins import notifications as notify
from plugins import zoom_integration as zoom

logger = logging.getLogger("chatty.booking")

RunDb = Callable[[Callable[[], Any]], Awaitable[Any]]
Dedupe = Callable[[Any], Any]
ParseIso = Callable[[str], Any]
FormatInvitationTime = Callable[[str, Optional[str]], str]
MeetingReplyTo = Callable[[str], Optional[str]]
LogMeetingMessage = Callable[..., Awaitable[None]]


async def process_widget_booking(
    args: dict,
    user: dict,
    supabase,
    result: dict,
    context: dict,
    *,
    run_db: RunDb,
    dedupe_doubled: Dedupe,
    parse_iso: ParseIso,
    format_invitation_time: FormatInvitationTime,
    meeting_reply_to: MeetingReplyTo,
    log_meeting_message: LogMeetingMessage,
) -> None:
    """Persist widget booking records and deliver visitor/admin notifications."""
    bot_id = context.get("bot_id")
    if not bot_id:
        return

    async def _insert_notification(row: dict) -> None:
        """Insert notification rows with compatibility for pending DB migrations."""
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
        res_bot = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
        if not res_bot.data:
            return
        bot = res_bot.data[0]

        attendees = args.get("attendees") or []
        if isinstance(attendees, str):
            attendees = [attendees]
        visitor_email = dedupe_doubled(attendees[0] if attendees else "guest@example.com")

        summary = args.get("summary") or args.get("subject") or "Demo Meeting"
        raw_name = summary.replace("Demo Meeting with ", "").replace("Demo Meeting with", "").replace("Demo Meeting", "").strip()
        visitor_name = dedupe_doubled(raw_name) or "Guest"

        invalid_names = {"guest", "visitor", "user", "attendee", "none", "null", "ues", "uesues", "yes"}
        session_id = context.get("session_id")
        if (not visitor_name or visitor_name.lower() in invalid_names) and session_id:
            try:
                lead_res = await run_db(lambda: supabase.table("chatty_leads").select("name").eq("bot_id", bot_id).eq("session_id", session_id).order("created_at", desc=True).limit(1).execute())
                if lead_res.data and lead_res.data[0].get("name"):
                    db_name = dedupe_doubled(lead_res.data[0]["name"].strip())
                    if db_name and db_name.lower() not in invalid_names:
                        visitor_name = db_name
            except Exception:
                pass

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
                lead_res = await run_db(lambda: supabase.table("chatty_leads").insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "name": visitor_name,
                    "email": visitor_email,
                    "phone": "",
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

        provider = bot.get("meeting_provider") or "google_meet"
        tz_label = bot.get("bot_timezone") or "UTC"
        if provider == "google_meet":
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
            meeting_link = result.get("online_meeting_url") or result.get("web_link")
        elif provider == "zoom" and zoom.zoom_configured():
            meeting_link = None
            try:
                duration_minutes = 30
                start_arg, end_arg = args.get("start"), args.get("end")
                if start_arg and end_arg:
                    try:
                        delta = parse_iso(end_arg) - parse_iso(start_arg)
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

        if not meeting_link:
            meeting_link = (
                result.get("html_link") or result.get("web_link")
                or result.get("htmlLink") or "https://meet.google.com/"
            )

        visitor_tz = (context or {}).get("visitor_timezone") or bot.get("bot_timezone") or "UTC"
        start_raw = args.get("start") or ""
        start_invitation_label = format_invitation_time(start_raw, visitor_tz) or start_raw
        tz_bracket = f"({visitor_tz})"

        meet_res = await run_db(lambda: supabase.table("chatty_meetings").insert({
            "bot_id": bot_id,
            "lead_id": lead_id,
            "title": summary,
            "description": args.get("description") or "Scheduled via AI Assistant",
            "start_time": args.get("start"),
            "end_time": args.get("end"),
            "timezone": visitor_tz,
            "meeting_link": meeting_link,
            "provider": provider,
            "status": "scheduled",
            "attendee_email": visitor_email,
            "attendee_name": visitor_name,
            "assigned_to_email": args.get("_assigned_to_email") or (user.get("email") or "").strip().lower() or None,
            "provider_event_id": result.get("id"),
        }).execute())

        meeting_id = meet_res.data[0]["id"] if meet_res.data else None

        owner_email = user.get("email") or "admin@personaliai.com"
        bot_owner_auth_id = bot.get("user_id")
        if bot_owner_auth_id and bot_owner_auth_id != user.get("auth_user_id"):
            try:
                owner_res = await run_db(lambda: supabase.table("users").select("email").eq(
                    "auth_user_id", bot_owner_auth_id).limit(1).execute())
                if owner_res.data and owner_res.data[0].get("email"):
                    owner_email = owner_res.data[0]["email"]
            except Exception:
                logger.exception("Failed to resolve bot owner's email for admin notification")

        reply_to = meeting_reply_to(meeting_id) if meeting_id else None

        client_html = notify.build_client_email_html(
            visitor_name=visitor_name, summary=summary, start=start_invitation_label,
            timezone_label=tz_bracket, meeting_link=meeting_link, provider=provider,
        )
        client_subject = f"Meeting Confirmed: {summary}"
        client_status = await notify.deliver_email(
            supabase=supabase, owner_user=user, to=visitor_email,
            subject=client_subject, html=client_html, reply_to=reply_to,
        )
        if meeting_id:
            await log_meeting_message(
                supabase, meeting_id, direction="outbound",
                from_email=notify.RESEND_EMAIL_FROM, subject=client_subject, body_text=client_html,
            )
        await _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": visitor_email,
            "channel": "email",
            "type": "client",
            "subject": client_subject,
            "content": f"Your meeting '{summary}' is confirmed for {start_invitation_label}. Join: {meeting_link}",
            "html_content": client_html,
            "status": client_status,
        })

        admin_html = notify.build_admin_email_html(
            visitor_name=visitor_name, visitor_email=visitor_email, summary=summary,
            start=start_invitation_label, timezone_label=tz_bracket, meeting_link=meeting_link,
            provider=provider,
        )
        admin_subject = f"New Meeting Booked: {visitor_name}"
        admin_status = await notify.deliver_email(
            supabase=supabase, owner_user=user, to=owner_email,
            subject=admin_subject, html=admin_html, reply_to=reply_to,
        )
        await _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": owner_email,
            "channel": "email",
            "type": "admin",
            "subject": admin_subject,
            "content": f"New meeting booked by {visitor_name} ({visitor_email}) for {start_invitation_label}.",
            "html_content": admin_html,
            "status": admin_status,
        })

        client_push_status = await notify.deliver_push(
            headings="Meeting Booked",
            contents=f"Your meeting is set for {start_invitation_label}.",
            external_id=visitor_email,
        )
        await _insert_notification({
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "recipient": visitor_email,
            "channel": "onesignal",
            "type": "client",
            "subject": "Meeting Booked",
            "content": f"Your meeting is set for {start_invitation_label}.",
            "status": client_push_status,
        })

        admin_push_status = await notify.deliver_push(
            headings="New Booking",
            contents=f"New meeting scheduled by {visitor_name}.",
            external_id=bot_owner_auth_id or user.get("auth_user_id"),
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

        await run_db(lambda: supabase.table("chatty_audit_logs").insert({
            "bot_id": bot_id,
            "action": "meeting_booked",
            "details": f"Meeting scheduled with {visitor_name} ({visitor_email}) at {start_invitation_label}. Provider: {provider}.",
            "performed_by": "assistant",
        }).execute())

    except Exception:
        logger.exception("Failed to process widget booking side effects")
