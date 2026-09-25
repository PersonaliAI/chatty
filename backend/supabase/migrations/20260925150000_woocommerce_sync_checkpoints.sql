-- Make WooCommerce imports resumable after worker, network, or provider failure.
-- The checkpoint points to the next page to request. Replaying the current
-- page is intentional: product upserts are keyed by woocommerce_id.

ALTER TABLE public.chatty_woocommerce_integrations
  ADD COLUMN IF NOT EXISTS sync_page INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sync_checkpoint_at TIMESTAMPTZ;

ALTER TABLE public.chatty_woocommerce_integrations
  DROP CONSTRAINT IF EXISTS chatty_woocommerce_integrations_sync_page_check;

ALTER TABLE public.chatty_woocommerce_integrations
  ADD CONSTRAINT chatty_woocommerce_integrations_sync_page_check
  CHECK (sync_page >= 1);
