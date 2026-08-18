-- Voice agent config for a bot (Phase A of the voice-agent feature — this
-- migration just adds the columns; nothing reads/writes them yet).
ALTER TABLE chatty_bots
  ADD COLUMN IF NOT EXISTS voice_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_stt_provider text NOT NULL DEFAULT 'google'
    CHECK (voice_stt_provider IN ('google','deepgram','assemblyai','soniox','openai')),
  ADD COLUMN IF NOT EXISTS voice_stt_byok_key_encrypted text,
  ADD COLUMN IF NOT EXISTS voice_tts_provider text NOT NULL DEFAULT 'google'
    CHECK (voice_tts_provider IN ('google','cartesia','elevenlabs','openai','fishaudio')),
  ADD COLUMN IF NOT EXISTS voice_tts_byok_key_encrypted text,
  ADD COLUMN IF NOT EXISTS voice_tts_voice text;
