-- Migration: `sender` was never added to chatty_conversations in production,
-- despite every write path (widget.py, admin.py, webhooks.py) inserting it
-- on every message. Every insert has been failing with PGRST204 "column
-- 'sender' not found", so no conversation history has ever been persisted —
-- the widget has effectively had zero memory across every bot, and the
-- human-agent poll/live endpoints (which filter .eq("sender","human")) have
-- never been able to find anything either. Same schema-drift pattern as
-- chatty_bots.allowed_domains/notification_emails/logo_url/avatar_url before it.
ALTER TABLE chatty_conversations
  ADD COLUMN IF NOT EXISTS sender text;
