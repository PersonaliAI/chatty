-- Prevent concurrent cron instances from delivering the same webhook retry.
ALTER TABLE public.chatty_webhook_deliveries
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_token TEXT;

CREATE INDEX IF NOT EXISTS idx_chatty_webhook_deliveries_processing
  ON public.chatty_webhook_deliveries(processing_started_at)
  WHERE status = 'processing';
