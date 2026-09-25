-- Durable freshness and ingestion state for catalog items.
ALTER TABLE public.chatty_media_items
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

CREATE INDEX IF NOT EXISTS idx_chatty_media_items_ingestion_state
  ON public.chatty_media_items (bot_id, ingestion_status, synced_at);

