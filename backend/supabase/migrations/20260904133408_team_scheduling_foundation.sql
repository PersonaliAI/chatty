-- Foundation for team-based scheduling: member name/phone, per-bot
-- round-robin opt-in, per-member recurring availability rules, and the
-- meeting -> assignee link.

alter table public.chatty_team_members add column if not exists name text;
alter table public.chatty_team_members add column if not exists phone text;
alter table public.chatty_team_members add column if not exists bookable boolean not null default false;

-- Per-day availability ranges for a team member on a given bot. Multiple
-- rows per (bot_id, member_email) are allowed so a member can set split
-- hours (e.g. 9-12 and 13-17). A member with zero rows falls back to the
-- bot's own business_hours_start/end + working_days.
create table if not exists public.chatty_availability_rules (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references public.chatty_bots(id) on delete cascade not null,
  member_email text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Mon .. 6=Sun, matches availability_engine._DAY_NUM
  start_minute smallint not null check (start_minute >= 0 and start_minute < 1440),
  end_minute smallint not null check (end_minute > start_minute and end_minute <= 1440),
  created_at timestamptz not null default now()
);
create index if not exists chatty_availability_rules_bot_member_idx
  on public.chatty_availability_rules (bot_id, member_email);

alter table public.chatty_availability_rules enable row level security;

-- Anyone with access to the bot (owner or team member — chatty_has_bot_access
-- is the existing SECURITY DEFINER helper from 20260709010000/20260830020000,
-- reused here rather than a raw chatty_bots subquery so this can't hit the
-- same cross-table RLS recursion that migration had to fix) can read
-- everyone's rules — the dashboard's team/availability view needs that to
-- show each member's schedule. Writes are restricted to the bot owner or the
-- member themselves, matching chatty_team_members' own access shape.
create policy "Bot access can view availability rules" on public.chatty_availability_rules
  for select using (chatty_has_bot_access(bot_id));

create policy "Owner manages availability rules" on public.chatty_availability_rules
  for all using (
    bot_id in (select id from public.chatty_bots where user_id = auth.uid())
  );

create policy "Member manages own availability rules" on public.chatty_availability_rules
  for all using (
    lower(member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

alter table public.chatty_meetings add column if not exists assigned_to_email text;
