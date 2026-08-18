-- Voice agent persona/focus role + a call-duration circuit breaker.
ALTER TABLE chatty_bots
  ADD COLUMN IF NOT EXISTS voice_agent_role text NOT NULL DEFAULT 'general'
    CHECK (voice_agent_role IN ('general', 'booking', 'info', 'lead')),
  ADD COLUMN IF NOT EXISTS voice_max_duration_minutes integer NOT NULL DEFAULT 15
    CHECK (voice_max_duration_minutes BETWEEN 1 AND 60);
