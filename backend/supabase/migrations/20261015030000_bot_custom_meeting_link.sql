-- Migration: Bot custom / dedicated meeting link (e.g. dedicated Zoom PMI / Google Meet)
ALTER TABLE chatty_bots
  ADD COLUMN IF NOT EXISTS custom_meeting_link TEXT;
