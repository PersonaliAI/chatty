-- Migration: Lock down over-permissive RLS on Chatty tables.
--
-- Context: the anon key ships in the dashboard JS bundle. The old
-- "Public can manage conversations" policy (FOR ALL USING(true)) let any
-- anon-key holder read/update/delete every visitor conversation across all
-- customers. All widget traffic goes through the backend, which uses the
-- service-role key and bypasses RLS — so no anon policy is needed at all.
-- The dashboard (authenticated owner) only needs owner-scoped access.

-- ── chatty_conversations ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can manage conversations" ON chatty_conversations;

CREATE POLICY "Owners manage conversations for their bots" ON chatty_conversations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_conversations.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_conversations.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  );

-- ── chatty_leads ────────────────────────────────────────────────────────
-- Widget lead capture happens server-side (create_lead tool, service role),
-- so the public INSERT policy is unnecessary surface area.
DROP POLICY IF EXISTS "Public can insert leads" ON chatty_leads;
DROP POLICY IF EXISTS "Users can view leads for their own bots" ON chatty_leads;

CREATE POLICY "Owners manage leads for their bots" ON chatty_leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_leads.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_leads.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  );

-- ── chatty_meetings / chatty_notifications ─────────────────────────────
-- Same reasoning: widget booking + notifications are written by the backend
-- with the service role. Owner-scoped policies from 20260620000000 remain.
DROP POLICY IF EXISTS "Public can insert meetings" ON chatty_meetings;
DROP POLICY IF EXISTS "Public can insert notifications" ON chatty_notifications;

-- ── chatty_sessions ─────────────────────────────────────────────────────
-- This table was created outside migrations (schema drift) — RLS state is
-- unknown and may be fully open. Enable RLS defensively and add an
-- owner-scoped policy. Guarded so the migration succeeds if absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chatty_sessions'
  ) THEN
    EXECUTE 'ALTER TABLE chatty_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Owners manage sessions for their bots" ON chatty_sessions';
    EXECUTE $pol$
      CREATE POLICY "Owners manage sessions for their bots" ON chatty_sessions
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM chatty_bots
            WHERE chatty_bots.id = chatty_sessions.bot_id
              AND chatty_bots.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM chatty_bots
            WHERE chatty_bots.id = chatty_sessions.bot_id
              AND chatty_bots.user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;
