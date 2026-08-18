-- Email attachments + signature — closes two real gaps found 2026-07-20:
-- send_email/reply_email could not attach any file (a job application with
-- the resume attached was impossible), and there was no email signature at
-- all.

-- Original bytes for direct uploads (web paperclip / Telegram attachments /
-- Telegram photos) — needed so a file can be attached to a LATER email,
-- since Telegram file URLs expire and web uploads aren't stored elsewhere.
-- Drive/OneDrive-sourced documents are NOT duplicated here — they're
-- re-downloaded live via drive_file_id at send time instead.
ALTER TABLE drive_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Structured email signature (Free tier) — rendered server-side from these
-- fields rather than storing raw HTML, so the dashboard preview and the
-- actual sent-email rendering can never drift apart.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature_links JSONB NOT NULL DEFAULT '[]'::jsonb;
