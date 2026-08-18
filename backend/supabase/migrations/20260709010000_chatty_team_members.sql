-- Team seats: let a bot owner invite teammates (admin/agent) to help run a bot.
-- Membership is matched by email (the invitee's Supabase auth email), so no
-- pre-existing account or backfill is required.

CREATE TABLE IF NOT EXISTS chatty_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, email)
);

CREATE INDEX IF NOT EXISTS idx_chatty_team_members_bot ON chatty_team_members(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_team_members_email ON chatty_team_members(lower(email));

ALTER TABLE chatty_team_members ENABLE ROW LEVEL SECURITY;

-- Owner manages the roster; a member may read their own membership rows.
DROP POLICY IF EXISTS "Owners manage team for their bots" ON chatty_team_members;
CREATE POLICY "Owners manage team for their bots" ON chatty_team_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM chatty_bots WHERE chatty_bots.id = chatty_team_members.bot_id AND chatty_bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chatty_bots WHERE chatty_bots.id = chatty_team_members.bot_id AND chatty_bots.user_id = auth.uid()));

DROP POLICY IF EXISTS "Members read their own membership" ON chatty_team_members;
CREATE POLICY "Members read their own membership" ON chatty_team_members
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Reusable predicate: is the current user an owner OR team member of the bot?
CREATE OR REPLACE FUNCTION chatty_has_bot_access(target_bot UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM chatty_bots WHERE id = target_bot AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM chatty_team_members
    WHERE bot_id = target_bot AND lower(email) = lower(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Widen the owner-scoped data policies to also allow team members.
DROP POLICY IF EXISTS "Owners manage conversations for their bots" ON chatty_conversations;
CREATE POLICY "Team accesses conversations for their bots" ON chatty_conversations
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id)) WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Owners manage leads for their bots" ON chatty_leads;
CREATE POLICY "Team accesses leads for their bots" ON chatty_leads
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id)) WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Owners manage sessions for their bots" ON chatty_sessions;
CREATE POLICY "Team accesses sessions for their bots" ON chatty_sessions
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id)) WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Owners manage unanswered for their bots" ON chatty_unanswered;
CREATE POLICY "Team accesses unanswered for their bots" ON chatty_unanswered
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id)) WITH CHECK (chatty_has_bot_access(bot_id));
