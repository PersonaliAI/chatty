-- The post-chat CSAT popup (1-5 stars + optional comment, EmbedClient.tsx's
-- submitCsat) has been posting to /api/widget/feedback all along, but that
-- endpoint only ever accepted rating in ("up","down") for the per-message
-- thumbs feature — every CSAT submission hit a 400 and was dropped, silently,
-- since the widget doesn't check the response status before showing "Thank
-- you for your feedback!". Nothing was ever stored. This gives CSAT its own
-- table (separate from chatty_conversations.feedback_rating, which is the
-- per-message thumbs/"Refine answers" column reviewed from the Inbox tab —
-- reusing it for session-level CSAT would collide the two features on the
-- same column) so the star rating and comment text can actually be kept and
-- shown to the bot owner.
create table if not exists chatty_csat_feedback (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references chatty_bots(id) on delete cascade,
  session_id text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists chatty_csat_feedback_bot_id_created_at_idx
  on chatty_csat_feedback (bot_id, created_at desc);

alter table chatty_csat_feedback enable row level security;

-- Widget submissions go through the backend with the service-role key
-- (bypasses RLS), same as chatty_conversations/chatty_leads — see
-- 20260708000000_chatty_rls_lockdown.sql. Only the bot owner reads.
create policy "Owners manage csat feedback for their bots" on chatty_csat_feedback
  for all to authenticated
  using (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_csat_feedback.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_csat_feedback.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  );
