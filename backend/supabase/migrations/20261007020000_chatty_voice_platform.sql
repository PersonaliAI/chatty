-- Industrial voice-agent configuration for Chatty bots.
-- Secrets are encrypted with the existing BYOK_ENCRYPTION_KEY Fernet key.
alter table chatty_bots
  add column if not exists voice_enabled boolean not null default false,
  add column if not exists voice_mode text not null default 'pipeline',
  add column if not exists voice_expression_enabled boolean not null default true,
  add column if not exists voice_visualizer text not null default 'wave',
  add column if not exists voice_agent_name text not null default 'chatty-voice-agent',
  add column if not exists voice_llm_provider text not null default 'google',
  add column if not exists voice_llm_model text not null default 'gemini-2.5-flash',
  add column if not exists voice_llm_byok_key_encrypted text,
  add column if not exists voice_stt_model text not null default 'chirp_3',
  add column if not exists voice_stt_language text not null default 'en-US',
  add column if not exists voice_tts_model text not null default 'gemini-3.8-flash-tts',
  add column if not exists voice_tts_voice text not null default 'Kore',
  add column if not exists voice_max_duration_minutes integer not null default 15;

alter table chatty_bots drop constraint if exists chatty_bots_voice_mode_platform_check;
alter table chatty_bots add constraint chatty_bots_voice_mode_platform_check check (voice_mode in ('pipeline', 'realtime'));
alter table chatty_bots drop constraint if exists chatty_bots_voice_visualizer_check;
alter table chatty_bots add constraint chatty_bots_voice_visualizer_check check (voice_visualizer in ('wave', 'bar', 'grid', 'radial', 'aura'));
alter table chatty_bots drop constraint if exists chatty_bots_voice_llm_provider_check;
alter table chatty_bots add constraint chatty_bots_voice_llm_provider_check check (voice_llm_provider in ('google', 'openai', 'anthropic', 'openrouter'));
alter table chatty_bots drop constraint if exists chatty_bots_voice_max_duration_check;
alter table chatty_bots add constraint chatty_bots_voice_max_duration_check check (voice_max_duration_minutes between 1 and 60);
