-- Provider-neutral catalog updates for manual/ERP integrations.
CREATE TABLE IF NOT EXISTS public.chatty_catalog_webhooks (
  bot_id UUID PRIMARY KEY REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  signing_secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chatty_catalog_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage catalog webhooks for own bots"
  ON public.chatty_catalog_webhooks FOR ALL
  USING (bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()))
  WITH CHECK (bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()));
