-- Migration: logo_url and avatar_url were added to chatty_bots directly in
-- production at some point, outside any migration file (schema drift, same
-- pattern already documented for chatty_sessions/chatty_api_keys). Lost
-- entirely when the database was rebuilt from the migrations folder alone —
-- surfaced as a PGRST204 "column not found" 400 from PostgREST on
-- POST /api/bot/logo and the avatar-upload endpoint.
ALTER TABLE chatty_bots
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS avatar_url text;
