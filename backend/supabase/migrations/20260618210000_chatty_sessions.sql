-- chatty_sessions was created outside migrations at some point (confirmed
-- schema drift — see the guarded/no-op RLS block for it in
-- 20260708000000_chatty_rls_lockdown.sql, which assumes it already exists).
-- Reconstructed here from actual column usage in main.py (_upsert_session,
-- the inbox/admin session endpoints) and notifications.py
-- (detect_and_fire_ended_sessions) so a standalone Chatty DB has it.

CREATE TABLE IF NOT EXISTS chatty_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES chatty_bots(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  ai_paused BOOLEAN DEFAULT false,
  needs_attention BOOLEAN DEFAULT false,
  visitor_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bot_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_chatty_sessions_bot ON chatty_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_last_message_at ON chatty_sessions(last_message_at);
