-- Keep realtime provider choices aligned with the LiveKit Agents realtime
-- plugins exposed by the Voice Agent studio. Credentials remain encrypted.
alter table public.chatty_bots
  drop constraint if exists chatty_bots_voice_realtime_provider_check;

alter table public.chatty_bots
  add constraint chatty_bots_voice_realtime_provider_check
  check (voice_realtime_provider in (
    'google', 'openai', 'azure', 'aws', 'nvidia', 'phonic', 'spacexai', 'ultravox'
  ));
