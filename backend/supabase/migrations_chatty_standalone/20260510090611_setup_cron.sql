-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the morning briefing to run every day at 8:00 AM UTC
-- Replace [CLOUD_RUN_URL] with your actual Cloud Run URL
-- Replace [FUNCTION_SECRET] with the secret from your .env

SELECT cron.schedule(
  'morning-briefing-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://personaliai-api-376030619262.us-central1.run.app/cron/morning-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('secret', 'your_custom_secret_here')
  )
  $$
);
