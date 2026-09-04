-- Reschedule (Phase 3 of team scheduling) needs to PATCH the same
-- Google/Outlook event rather than delete+recreate it (keeps the join
-- link, attendee list, and provider event id stable) — which requires
-- actually knowing that provider event id. It was never persisted before;
-- create_calendar_event/create_outlook_event's response id only lived
-- transiently in memory during booking.
alter table public.chatty_meetings add column if not exists provider_event_id text;
