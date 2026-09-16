-- Migration: WooCommerce Direct Import & Auto-Sync Integration
-- Stores WooCommerce store credentials, webhook secret, and sync progress per bot.

CREATE TABLE IF NOT EXISTS public.chatty_woocommerce_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL UNIQUE REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  store_url TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  consumer_secret TEXT NOT NULL,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'synced', 'failed')),
  sync_progress INT NOT NULL DEFAULT 0,
  total_products INT NOT NULL DEFAULT 0,
  synced_products INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_wc_integrations_bot ON public.chatty_woocommerce_integrations(bot_id);

-- Fast lookup for WooCommerce product IDs inside metadata
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_wc_id 
  ON public.chatty_media_items (bot_id, ((metadata->>'woocommerce_id')));

-- Enable RLS
ALTER TABLE public.chatty_woocommerce_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage woocommerce integrations for own bots"
  ON public.chatty_woocommerce_integrations
  FOR ALL
  USING (
    bot_id IN (
      SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()
    )
  );
