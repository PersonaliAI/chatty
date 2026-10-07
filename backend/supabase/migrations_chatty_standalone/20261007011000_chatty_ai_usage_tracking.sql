-- Provider telemetry used by the Analytics tab. Keep this in the canonical
-- migration stream so self-hosted installs receive the same usage surface as
-- Chatty Cloud. The table is also created by an older raw SQL installer in
-- some deployments, so every statement is idempotent.

CREATE TABLE IF NOT EXISTS public.chatty_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES public.chatty_bots(id) ON DELETE SET NULL,
  session_id text,
  call_type text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(12, 8),
  is_byok boolean NOT NULL DEFAULT false,
  success boolean NOT NULL DEFAULT true,
  error text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatty_ai_usage_bot
  ON public.chatty_ai_usage(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatty_ai_usage_created
  ON public.chatty_ai_usage(created_at DESC);

ALTER TABLE public.chatty_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team accesses ai usage for their bots" ON public.chatty_ai_usage;
CREATE POLICY "Team accesses ai usage for their bots"
  ON public.chatty_ai_usage
  FOR SELECT
  USING (bot_id IS NOT NULL AND chatty_has_bot_access(bot_id));
