-- Fine-grained per-member dashboard-tab permissions for chatty_team_members.
--
-- Until now, `role` ('admin' | 'agent') was stored but never actually
-- enforced anywhere beyond who could reach conversations: every non-owner
-- team member — admin or agent — got identical access (view via the
-- team-visibility SELECT policy, inbox actions via chatty_has_bot_access),
-- and NOBODY but the owner could ever write to chatty_bots or chatty_sources
-- (only "Users can manage their own bots" / "...sources for their own bots"
-- existed, both scoped to auth.uid() = user_id). So an invited "admin" could
-- see a bot's settings but never save a change to it, same as an "agent".
--
-- This adds an actual, editable permission set per member and lets an
-- owner/admin grant real write access per dashboard tab.

ALTER TABLE chatty_team_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows with sensible role-based defaults so nobody's
-- access silently changes the moment this migration runs.
UPDATE chatty_team_members SET permissions = ARRAY['inbox','sources','design','settings','voice','team']
  WHERE role = 'admin' AND permissions = '{}';
UPDATE chatty_team_members SET permissions = ARRAY['inbox']
  WHERE role = 'agent' AND permissions = '{}';

-- Reusable predicate: does the current user hold a specific dashboard-tab
-- permission on this bot? The owner always does. SECURITY DEFINER for the
-- same reason chatty_has_bot_access is (added by 20260709010000, fixed for
-- recursion by 20260830020000) — its internal chatty_bots/chatty_team_members
-- lookups run as the function owner rather than re-triggering the calling
-- policy's own RLS.
CREATE OR REPLACE FUNCTION chatty_has_bot_permission(target_bot UUID, perm TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM chatty_bots WHERE id = target_bot AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM chatty_team_members
    WHERE bot_id = target_bot AND lower(email) = lower(auth.jwt() ->> 'email')
      AND perm = ANY(permissions)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Let a team member with the 'settings' permission actually save changes to
-- a bot (design, prompt, name, etc.) — additive to, not a replacement for,
-- the owner's existing "Users can manage their own bots" ALL policy.
DROP POLICY IF EXISTS "Team edits bot settings with permission" ON chatty_bots;
CREATE POLICY "Team edits bot settings with permission" ON chatty_bots
  FOR UPDATE TO authenticated
  USING (chatty_has_bot_permission(id, 'settings'))
  WITH CHECK (chatty_has_bot_permission(id, 'settings'));

-- Same for training sources/RAG content, gated on the 'sources' permission.
DROP POLICY IF EXISTS "Team manages sources with permission" ON chatty_sources;
CREATE POLICY "Team manages sources with permission" ON chatty_sources
  FOR ALL TO authenticated
  USING (chatty_has_bot_permission(bot_id, 'sources'))
  WITH CHECK (chatty_has_bot_permission(bot_id, 'sources'));
