-- Email conversation thread per meeting (Phase 4 of team scheduling): every
-- confirmation/reschedule/cancellation email sent, plus every reply a
-- visitor sends back, so the dashboard can show a real thread instead of
-- just a booking record.
create table if not exists public.chatty_meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.chatty_meetings(id) on delete cascade not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text not null,
  subject text,
  body_text text,
  created_at timestamptz not null default now()
);
create index if not exists chatty_meeting_messages_meeting_idx
  on public.chatty_meeting_messages (meeting_id, created_at);

alter table public.chatty_meeting_messages enable row level security;

-- Same bot-access shape as chatty_meetings itself (owner or team member via
-- the existing SECURITY DEFINER helper) — read-only via the API, all writes
-- go through the backend's service-role key, never directly from a client.
create policy "Bot access can view meeting messages" on public.chatty_meeting_messages
  for select using (
    meeting_id in (
      select m.id from public.chatty_meetings m
      where chatty_has_bot_access(m.bot_id)
    )
  );
