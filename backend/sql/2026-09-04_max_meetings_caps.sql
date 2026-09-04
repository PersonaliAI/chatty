-- Add max daily and weekly meeting quotas to chatty_bots
alter table public.chatty_bots add column if not exists max_daily_meetings int default 0;
alter table public.chatty_bots add column if not exists max_weekly_meetings int default 0;
