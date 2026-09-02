-- Private agent notes on a conversation (Developer API's
-- add_conversation_internal_note tool). Distinct from
-- chatty_conversations.role='assistant' messages: a note is never sent to
-- the visitor, it's an internal annotation for other human agents working
-- the same inbox (e.g. "escalated to billing team, waiting on refund
-- approval"). No such table or column existed before this — the earlier
-- version of this tool had nothing real to write to.
create table if not exists chatty_session_notes (
    id         uuid primary key default gen_random_uuid(),
    bot_id     uuid not null references chatty_bots(id) on delete cascade,
    session_id text not null,
    note       text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_chatty_session_notes_session on chatty_session_notes(bot_id, session_id);

alter table chatty_session_notes enable row level security;

-- Same ownership pattern as chatty_campaigns/chatty_csat_feedback: only the
-- bot's owner (auth.uid() = chatty_bots.user_id) can read/write via the
-- dashboard's own session; this backend's Developer API path uses the
-- service-role key and bypasses RLS like every other chatty_* table here.
create policy "Owners manage session notes for their bots" on chatty_session_notes
  for all to authenticated
  using (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_session_notes.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_session_notes.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  );
