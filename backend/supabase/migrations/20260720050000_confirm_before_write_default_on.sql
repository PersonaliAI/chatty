-- "Confirm before acting" (confirm_before_write) is Kin's barrier before any
-- consequential write action (send/reply email, share a file, create/delete
-- a calendar event, delete a scheduled task, etc.) — added 2026-07-18,
-- opt-in and off by default. User request 2026-07-20: make it on by default
-- so new accounts start protected, while existing users keep whatever
-- they've already got (this only changes the column default applied to
-- newly-inserted rows, it does not touch existing user rows).
ALTER TABLE users ALTER COLUMN confirm_before_write SET DEFAULT true;
