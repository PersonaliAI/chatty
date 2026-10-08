-- Deepgram TTS is implemented by the worker and exposed in the dashboard
-- catalog. Keep the database contract aligned with that provider surface.
alter table chatty_bots
  drop constraint if exists chatty_bots_voice_tts_provider_check;

alter table chatty_bots
  add constraint chatty_bots_voice_tts_provider_check
    check (voice_tts_provider in ('google', 'livekit-inference', 'cartesia', 'deepgram', 'elevenlabs', 'openai', 'fishaudio'));
