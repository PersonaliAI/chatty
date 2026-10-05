-- Keep production catalog imports aligned with the worker's progress and
-- ingestion fields. These columns were previously present only in the
-- standalone migration set, so hosted installs could connect a store but
-- could not persist sync checkpoints or catalog versions.

ALTER TABLE public.chatty_woocommerce_integrations
  ADD COLUMN IF NOT EXISTS sync_page INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sync_checkpoint_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalog_freshness_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ;

ALTER TABLE public.chatty_woocommerce_integrations
  DROP CONSTRAINT IF EXISTS chatty_woocommerce_integrations_sync_page_check;

ALTER TABLE public.chatty_woocommerce_integrations
  ADD CONSTRAINT chatty_woocommerce_integrations_sync_page_check
  CHECK (sync_page >= 1);

ALTER TABLE public.chatty_media_items
  ADD COLUMN IF NOT EXISTS image_embedding VECTOR(768),
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalog_version TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS last_ingestion_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chatty_media_items_ingestion_status_check'
  ) THEN
    ALTER TABLE public.chatty_media_items
      ADD CONSTRAINT chatty_media_items_ingestion_status_check
      CHECK (ingestion_status IN ('pending', 'ready', 'stale', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chatty_media_items_image_embedding
  ON public.chatty_media_items
  USING hnsw (image_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chatty_media_items_ingestion_state
  ON public.chatty_media_items (bot_id, ingestion_status, synced_at);
