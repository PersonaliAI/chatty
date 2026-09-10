-- Anti-fake-meeting defenses: optional abuse-prevention toggles for calendar scheduling
-- All 4 settings default to FALSE (off) to maintain 100% backwards compatibility.

ALTER TABLE public.chatty_bots
  ADD COLUMN IF NOT EXISTS booking_email_verification BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_block_disposable_emails BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_limit_one_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_require_business_email BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.chatty_bots.booking_email_verification IS 'Require 6-digit email OTP verification before creating calendar events';
COMMENT ON COLUMN public.chatty_bots.booking_block_disposable_emails IS 'Block temporary/disposable email addresses from booking meetings';
COMMENT ON COLUMN public.chatty_bots.booking_limit_one_active IS 'Restrict each visitor email address to at most 1 active/upcoming scheduled meeting';
COMMENT ON COLUMN public.chatty_bots.booking_require_business_email IS 'Block free/personal consumer email domains (gmail, yahoo, hotmail, etc.) requiring work emails';
