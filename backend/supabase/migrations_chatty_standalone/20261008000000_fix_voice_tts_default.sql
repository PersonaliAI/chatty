-- Keep the persisted default in sync with the LiveKit Google plugin.
-- The previous value was not a model accepted by GeminiTTS.
alter table chatty_bots
  alter column voice_tts_model set default 'gemini-3.1-flash-tts-preview';

update chatty_bots
set voice_tts_model = 'gemini-3.1-flash-tts-preview'
where voice_tts_model = 'gemini-3.8-flash-tts';
