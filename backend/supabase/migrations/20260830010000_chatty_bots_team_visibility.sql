-- The team-members feature (20260709010000_chatty_team_members.sql) widened
-- RLS on chatty_conversations/chatty_leads/chatty_sessions/chatty_unanswered
-- so a team member can access a bot's inbox/leads data, but never widened
-- chatty_bots itself — so a team member could never actually SELECT the bot
-- row they were supposedly given access to. The dashboard's own bot list
-- query (chatty_bots where user_id = me) filters to owned bots only, and
-- RLS would have blocked a broader query anyway: the promised "this bot
-- appears in their dashboard automatically" never actually happened.
--
-- SELECT-only (not the owner's FOR ALL policy) — a team member can see and
-- work the bot's inbox/leads, but editing the bot's own configuration
-- (Customizer, Settings) stays owner-only until there's an actual
-- Agent-vs-Admin permission split to base that on.
DROP POLICY IF EXISTS "Team members can view bots they're added to" ON chatty_bots;
CREATE POLICY "Team members can view bots they're added to" ON chatty_bots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_team_members
      WHERE chatty_team_members.bot_id = chatty_bots.id
        AND lower(chatty_team_members.email) = lower(auth.jwt() ->> 'email')
    )
  );
