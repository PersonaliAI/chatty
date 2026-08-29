-- Adds a "realtime" mode alongside the existing STT/TTS pipeline: Gemini
-- Live / OpenAI Realtime speech-to-speech models, no separate STT/TTS
-- stage. Mirrors kin-backend's voice_agents.mode column and CHECK
-- constraint exactly (see kin-backend/supabase/migrations/20260827000000_
-- voice_agents_realtime_mode.sql) — same pattern, applied to chatty_bots
-- instead of a dedicated voice_agents table. voice_tts_voice is reused for
-- the realtime voice (e.g. "Puck"/"marin") rather than adding another
-- column; voice_stt_provider/voice_tts_provider simply go unused when
-- voice_mode = 'realtime'. See voice-agent/voice_worker.py's build_realtime().
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS voice_mode text NOT NULL DEFAULT 'pipeline';
ALTER TABLE chatty_bots DROP CONSTRAINT IF EXISTS chatty_bots_voice_mode_check;
ALTER TABLE chatty_bots ADD CONSTRAINT chatty_bots_voice_mode_check CHECK (voice_mode IN ('pipeline', 'realtime'));

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS voice_realtime_provider text NOT NULL DEFAULT 'google';
ALTER TABLE chatty_bots DROP CONSTRAINT IF EXISTS chatty_bots_voice_realtime_provider_check;
ALTER TABLE chatty_bots ADD CONSTRAINT chatty_bots_voice_realtime_provider_check CHECK (voice_realtime_provider IN ('google', 'openai'));

ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS voice_realtime_model text;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS voice_realtime_byok_key_encrypted text;
