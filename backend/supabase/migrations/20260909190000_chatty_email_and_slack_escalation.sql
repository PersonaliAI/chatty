-- Migration: 20260909190000_chatty_email_and_slack_escalation.sql
-- Enterprise Email Support, Inbound Email-to-Ticket Gateway & Slack Escalations

-- 1. Upgrade chatty_sessions for omnichannel email support & threading
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'web';
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS visitor_email TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS last_inbound_message_id TEXT;
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS email_thread_id TEXT;

-- High-performance indexes for channel and customer email lookups
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_channel ON chatty_sessions(bot_id, channel);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_visitor_email ON chatty_sessions(bot_id, visitor_email);
CREATE INDEX IF NOT EXISTS idx_chatty_sessions_email_thread ON chatty_sessions(email_thread_id);

-- 2. Upgrade chatty_bots for support email address and Slack escalation webhook
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS email_support_address TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS slack_escalation_webhook_url TEXT;
