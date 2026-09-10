-- Migration: Add scheduling and timezone configurations to chatty_bots
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS widget_style TEXT NOT NULL DEFAULT 'minimalist';
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS sync_google_drive BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS calendar_scheduling_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS scheduling_duration_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS bot_timezone TEXT NOT NULL DEFAULT 'UTC';
