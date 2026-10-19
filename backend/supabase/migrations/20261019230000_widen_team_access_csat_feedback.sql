-- ==============================================================================
-- Widen RLS on chatty_csat_feedback, chatty_session_notes, and chatty_campaigns
-- so team members and collaborators can access them on shared bots using
-- chatty_has_bot_access(bot_id).
-- ==============================================================================

-- 1. chatty_csat_feedback
DROP POLICY IF EXISTS "Owners manage csat feedback for their bots" ON public.chatty_csat_feedback;
DROP POLICY IF EXISTS "Team manages csat feedback for their bots" ON public.chatty_csat_feedback;

CREATE POLICY "Team manages csat feedback for their bots" ON public.chatty_csat_feedback
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));

-- 2. chatty_session_notes
DROP POLICY IF EXISTS "Owners manage session notes for their bots" ON public.chatty_session_notes;
DROP POLICY IF EXISTS "Team manages session notes for their bots" ON public.chatty_session_notes;

CREATE POLICY "Team manages session notes for their bots" ON public.chatty_session_notes
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));

-- 3. chatty_campaigns
DROP POLICY IF EXISTS "Owners manage campaigns for their bots" ON public.chatty_campaigns;
DROP POLICY IF EXISTS "Team manages campaigns for their bots" ON public.chatty_campaigns;

CREATE POLICY "Team manages campaigns for their bots" ON public.chatty_campaigns
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));
