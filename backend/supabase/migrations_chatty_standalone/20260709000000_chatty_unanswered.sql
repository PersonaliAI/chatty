-- Unanswered-questions queue: visitor questions the bot couldn't confidently
-- answer, surfaced in the dashboard for one-click retraining.
CREATE TABLE IF NOT EXISTS chatty_unanswered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_unanswered_bot ON chatty_unanswered(bot_id, status);

ALTER TABLE chatty_unanswered ENABLE ROW LEVEL SECURITY;

-- Owner-scoped only; the backend writes with the service role (bypasses RLS).
DROP POLICY IF EXISTS "Owners manage unanswered for their bots" ON chatty_unanswered;
CREATE POLICY "Owners manage unanswered for their bots" ON chatty_unanswered
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_unanswered.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_unanswered.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  );
