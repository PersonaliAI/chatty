-- ============================================================================
-- 20260909160000_chatty_helpdesk_sla_tickets.sql
-- Enterprise Helpdesk Engine: Full Ticket Lifecycle, SLAs, Priority Tiers,
-- Team Assignment, Collision Awareness, Tags, and Multi-Agent Notes.
-- ============================================================================

-- 1. Upgrade chatty_sessions for enterprise helpdesk
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes');
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours');
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'on_track';
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS assigned_agent_email TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Ensure status check constraint or sensible default if status column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chatty_sessions_priority_check'
  ) THEN
    ALTER TABLE chatty_sessions ADD CONSTRAINT chatty_sessions_priority_check
      CHECK (priority IN ('urgent', 'high', 'normal', 'low'));
  END IF;
END $$;

-- High-performance indexes for inbox filtering and SLA sorting
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_status ON chatty_sessions(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_priority ON chatty_sessions(bot_id, priority);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_assigned ON chatty_sessions(bot_id, assigned_agent_email);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_res_due ON chatty_sessions(bot_id, resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_first_due ON chatty_sessions(bot_id, first_response_due_at);

-- 2. Upgrade chatty_session_notes for multi-agent author attribution
ALTER TABLE chatty_session_notes ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE chatty_session_notes ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE chatty_session_notes ADD COLUMN IF NOT EXISTS author_id UUID;

-- 3. Widen RLS policies on chatty_session_notes to include team members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatty_session_notes') THEN
    ALTER TABLE chatty_session_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Owners manage session notes for their bots" ON chatty_session_notes;
    DROP POLICY IF EXISTS "Team accesses session notes for their bots" ON chatty_session_notes;
    
    -- Check if chatty_has_bot_access exists; if so use it, otherwise fallback to bot owner check
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_has_bot_access') THEN
      CREATE POLICY "Team accesses session notes for their bots" ON chatty_session_notes
        FOR ALL TO authenticated
        USING (chatty_has_bot_access(bot_id))
        WITH CHECK (chatty_has_bot_access(bot_id));
    ELSE
      CREATE POLICY "Team accesses session notes for their bots" ON chatty_session_notes
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM chatty_bots
            WHERE chatty_bots.id = chatty_session_notes.bot_id
              AND chatty_bots.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM chatty_bots
            WHERE chatty_bots.id = chatty_session_notes.bot_id
              AND chatty_bots.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END $$;
