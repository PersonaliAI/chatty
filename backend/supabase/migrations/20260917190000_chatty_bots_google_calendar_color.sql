-- Add google_calendar_color to chatty_bots to allow bot owners to configure
-- Google Calendar event color scheme (e.g. 'auto_multiple' or specific Google colorId 1-11).
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS google_calendar_color TEXT DEFAULT 'auto_multiple';

-- Add calendar_color_id to chatty_meetings to track the resolved Google Calendar event color.
ALTER TABLE chatty_meetings ADD COLUMN IF NOT EXISTS calendar_color_id TEXT;
