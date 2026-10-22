-- Migration: 20261022200000_chatty_omnichannel_channels.sql
-- Omnichannel Messaging Channels: Instagram DM & Messenger, Telegram, Twilio SMS, Two-Way Support Email

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS instagram_page_id TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS instagram_verify_token TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS instagram_app_secret TEXT;

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS telegram_secret_token TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS email_channel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS email_support_address TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS email_webhook_secret TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS email_auto_reply_mode TEXT DEFAULT 'instant_ai';

CREATE INDEX IF NOT EXISTS idx_chatty_bots_ig_page ON chatty_bots(instagram_page_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_twilio_phone ON chatty_bots(twilio_phone_number);
