-- Fixes a real regression from 20260830010000: that migration's chatty_bots
-- SELECT policy queried chatty_team_members directly, and
-- chatty_team_members's own "Owners manage team for their bots" policy
-- queries chatty_bots right back — neither hop goes through a
-- SECURITY DEFINER function, so nothing breaks the cycle. Postgres detects
-- this as infinite recursion (42P17), which PostgREST surfaces as a bare
-- 500 on literally any `select * from chatty_bots` — this broke bot loading
-- for everyone, not just team members, the moment that migration ran.
--
-- chatty_has_bot_access() (added by 20260709010000 for exactly this reason)
-- is SECURITY DEFINER, so its internal chatty_bots/chatty_team_members
-- lookups run as the function's owner rather than re-triggering the calling
-- policy — the same mechanism already safely used to widen
-- chatty_conversations/leads/sessions/unanswered for team access. Using it
-- here instead of a raw subquery breaks the cycle the same way.
DROP POLICY IF EXISTS "Team members can view bots they're added to" ON chatty_bots;
CREATE POLICY "Team members can view bots they're added to" ON chatty_bots
  FOR SELECT TO authenticated
  USING (chatty_has_bot_access(id));
