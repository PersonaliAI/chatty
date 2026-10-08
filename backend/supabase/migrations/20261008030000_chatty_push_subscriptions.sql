CREATE TABLE IF NOT EXISTS public.chatty_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  session_id TEXT,
  external_id TEXT NOT NULL,
  subscription_id TEXT,
  platform TEXT NOT NULL DEFAULT 'web',
  channel TEXT NOT NULL DEFAULT 'push',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, external_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_chatty_push_subscriptions_lookup
  ON public.chatty_push_subscriptions (bot_id, external_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatty_push_subscriptions_session
  ON public.chatty_push_subscriptions (bot_id, session_id, last_seen_at DESC);
ALTER TABLE public.chatty_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public push subscription access" ON public.chatty_push_subscriptions;
