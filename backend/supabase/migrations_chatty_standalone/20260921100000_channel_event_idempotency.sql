-- Durable idempotency keys for provider webhooks in the standalone schema.
CREATE TABLE IF NOT EXISTS public.chatty_channel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_chatty_channel_events_bot_created
  ON public.chatty_channel_events (bot_id, created_at DESC);

ALTER TABLE public.chatty_channel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage channel events for own bots"
  ON public.chatty_channel_events
  FOR ALL
  USING (bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()))
  WITH CHECK (bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()));
