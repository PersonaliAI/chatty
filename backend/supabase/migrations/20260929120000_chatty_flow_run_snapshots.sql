-- Preserve the exact graph used by each execution so replay and audit tooling
-- remain deterministic after a newer draft is published.
alter table if exists public.chatty_flow_runs
  add column if not exists flow_data jsonb not null default '{"nodes": [], "edges": []}'::jsonb;
