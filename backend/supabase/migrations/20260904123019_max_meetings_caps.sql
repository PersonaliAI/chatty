-- Add max daily and weekly meeting quotas to chatty_bots.
-- Folded in from sql/2026-09-04_max_meetings_caps.sql (ad-hoc, applied
-- directly against prod) as a properly dated migration, same pattern as
-- 20260621000000_booking_rules_and_api_keys.sql.
alter table public.chatty_bots add column if not exists max_daily_meetings int default 0;
alter table public.chatty_bots add column if not exists max_weekly_meetings int default 0;
