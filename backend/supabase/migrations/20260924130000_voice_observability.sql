-- Additive per-call telemetry for the voice worker. Existing Supabase voice
-- calls remain valid; every column is nullable for rolling deployments.
alter table if exists chatty_voice_calls
  add column if not exists peak_rss_mb numeric,
  add column if not exists cpu_seconds numeric,
  add column if not exists avg_cpu_percent numeric,
  add column if not exists first_response_latency_ms integer,
  add column if not exists turn_count integer,
  add column if not exists nudge_count integer,
  add column if not exists error_count integer;

comment on column chatty_voice_calls.peak_rss_mb is 'Peak worker resident memory for this call, MiB';
comment on column chatty_voice_calls.avg_cpu_percent is 'Process CPU time / wall time for this call';
comment on column chatty_voice_calls.first_response_latency_ms is 'Call start to first agent speech';
