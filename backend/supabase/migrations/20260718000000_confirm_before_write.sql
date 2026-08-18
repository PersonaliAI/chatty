-- Opt-in setting: require a recap + explicit confirmation before Kin
-- executes any consequential write action (send/reply email, share a file,
-- create/delete a calendar event, delete a scheduled task, etc.), not just
-- scheduled-task creation which already has this behavior unconditionally.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS confirm_before_write BOOLEAN DEFAULT FALSE;
