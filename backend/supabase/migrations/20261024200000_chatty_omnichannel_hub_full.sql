-- Omnichannel Messaging Hub: Full Multi-Tenant Channel Columns (WhatsApp, Messenger, Instagram, TikTok, Telegram, SMS, Email)
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_verify_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_app_secret TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS whatsapp_quick_replies JSONB DEFAULT '[]'::jsonb;

-- Facebook Messenger Dedicated Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_page_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_page_name TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_access_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_verify_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_app_secret TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS messenger_quick_replies JSONB DEFAULT '[]'::jsonb;

-- Instagram Direct (DM) Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_page_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_verify_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_app_secret TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS instagram_quick_replies JSONB DEFAULT '[]'::jsonb;

-- TikTok Business Messaging Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_open_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_business_id TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_display_name TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_refresh_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_verify_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_client_key TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_client_secret TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS tiktok_quick_replies JSONB DEFAULT '[]'::jsonb;

-- Telegram Bot Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS telegram_secret_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;

-- Two-Way SMS (Twilio) Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;

-- Support Email Columns
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS email_channel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS email_support_address TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS email_webhook_secret TEXT;
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS email_auto_reply_mode TEXT DEFAULT 'ai_draft';
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS slack_escalation_webhook_url TEXT;

-- Unified Omnichannel Config JSONB (durable multi-channel metadata)
ALTER TABLE public.chatty_bots ADD COLUMN IF NOT EXISTS omnichannel_config JSONB DEFAULT '{}'::jsonb;

-- Indexes for fast webhook routing
CREATE INDEX IF NOT EXISTS idx_chatty_bots_messenger_page ON public.chatty_bots(messenger_page_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_messenger_verify ON public.chatty_bots(messenger_verify_token);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_ig_page ON public.chatty_bots(instagram_page_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_ig_verify ON public.chatty_bots(instagram_verify_token);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_tiktok_open_id ON public.chatty_bots(tiktok_open_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_tiktok_business_id ON public.chatty_bots(tiktok_business_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_tiktok_verify ON public.chatty_bots(tiktok_verify_token);

-- Reload PostgREST schema cache so new columns are immediately queryable
NOTIFY pgrst, 'reload schema';
