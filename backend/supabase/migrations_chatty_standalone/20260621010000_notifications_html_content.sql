-- Stores the full beautiful HTML body of meeting emails so the dashboard
-- Mailbox tab can render a rich preview. Safe to run multiple times.
-- Folded in from the ad-hoc sql/2026-06-21_add_html_content_to_notifications.sql
-- script as a properly dated migration.
alter table public.chatty_notifications
  add column if not exists html_content text;
