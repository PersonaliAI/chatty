-- Stores the full beautiful HTML body of meeting emails so the dashboard
-- Mailbox tab can render a rich preview. Safe to run multiple times.
alter table public.chatty_notifications
  add column if not exists html_content text;
