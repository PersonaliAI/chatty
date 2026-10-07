-- Keep provider constraints aligned with the LiveKit Inference catalog.
alter table chatty_bots
  drop constraint if exists chatty_bots_voice_stt_provider_check,
  drop constraint if exists chatty_bots_voice_tts_provider_check,
  drop constraint if exists chatty_bots_voice_llm_provider_check;

alter table chatty_bots
  add constraint chatty_bots_voice_stt_provider_check
    check (voice_stt_provider in ('google', 'livekit-inference', 'deepgram', 'assemblyai', 'soniox', 'cartesia', 'openai')),
  add constraint chatty_bots_voice_tts_provider_check
    check (voice_tts_provider in ('google', 'livekit-inference', 'cartesia', 'elevenlabs', 'openai', 'fishaudio')),
  add constraint chatty_bots_voice_llm_provider_check
    check (voice_llm_provider in ('google', 'livekit-inference', 'openai', 'anthropic', 'openrouter'));
