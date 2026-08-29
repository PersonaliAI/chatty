-- Per-call voice usage/cost log — didn't exist before (voice_worker.py's
-- own comment called this "a known, explicitly-accepted gap: usage is
-- tracked, not gated"). Populated by voice_worker.py at the end of every
-- call, for both pipeline and realtime mode. cost_usd is null when it
-- couldn't be computed (e.g. a pipeline-mode STT/TTS provider litellm has
-- no pricing for) rather than a misleading 0.
create table if not exists chatty_voice_calls (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references chatty_bots(id) on delete cascade,
  session_id text not null,
  mode text not null check (mode in ('pipeline', 'realtime')),
  provider text,
  model text,
  duration_seconds numeric,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_chatty_voice_calls_bot on chatty_voice_calls(bot_id, created_at desc);

alter table chatty_voice_calls enable row level security;

create policy "Users can view voice call logs for their own bots" on chatty_voice_calls
  for select to authenticated
  using (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_voice_calls.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  );
