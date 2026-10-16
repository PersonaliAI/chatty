-- Team collaboration v2: out-of-office, skills/languages, offboarding support.
ALTER TABLE chatty_team_members
  ADD COLUMN IF NOT EXISTS ooo_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ooo_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ooo_backup_email TEXT,
  ADD COLUMN IF NOT EXISTS ooo_reason TEXT,
  ADD COLUMN IF NOT EXISTS action_permissions TEXT[] DEFAULT NULL;

-- Update role check constraint to include all 6 standardized roles if constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chatty_team_members_role_check'
  ) THEN
    ALTER TABLE chatty_team_members DROP CONSTRAINT chatty_team_members_role_check;
    ALTER TABLE chatty_team_members ADD CONSTRAINT chatty_team_members_role_check
      CHECK (role IN ('owner', 'admin', 'editor', 'billing_manager', 'agent', 'viewer'));
  END IF;
END $$;

-- Internal notes + @mentions on conversations.
CREATE TABLE IF NOT EXISTS chatty_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL,
  mentions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_internal_notes_session ON chatty_internal_notes (bot_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_internal_notes_mentions ON chatty_internal_notes USING GIN (mentions);

-- Row Level Security for internal notes
ALTER TABLE chatty_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team accesses internal notes for their bots" ON chatty_internal_notes;
CREATE POLICY "Team accesses internal notes for their bots" ON chatty_internal_notes
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));
