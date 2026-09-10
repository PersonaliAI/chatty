-- Allow team members to view/read sources for bots they belong to.
-- Fixes issue where team members without explicit 'sources' write permission
-- saw 'Trained Sources: 0 Active' on the Overview dashboard card.

DROP POLICY IF EXISTS "Team members can view sources" ON chatty_sources;
CREATE POLICY "Team members can view sources" ON chatty_sources
  FOR SELECT TO authenticated
  USING (chatty_has_bot_access(bot_id));
