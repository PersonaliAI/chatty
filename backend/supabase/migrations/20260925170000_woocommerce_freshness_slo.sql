-- Expose measurable catalog freshness and sync lifecycle timestamps.

ALTER TABLE public.chatty_woocommerce_integrations
  ADD COLUMN IF NOT EXISTS catalog_freshness_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ;
