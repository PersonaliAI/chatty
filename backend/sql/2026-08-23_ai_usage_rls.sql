-- chatty_ai_usage was created without RLS (raw SQL migration, service-role
-- writes only) — closing that gap before it's ever queried with the anon/
-- authenticated key from the frontend. Same access rule as every other
-- per-bot table (chatty_conversations, chatty_sessions, etc.): the bot
-- owner or an invited team member. Idempotent.

alter table public.chatty_ai_usage enable row level security;

drop policy if exists "Team accesses ai usage for their bots" on public.chatty_ai_usage;
create policy "Team accesses ai usage for their bots"
  on public.chatty_ai_usage
  for select
  using (bot_id is not null and chatty_has_bot_access(bot_id));
