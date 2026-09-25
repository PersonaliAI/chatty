-- Execution records for Flow Builder dry-runs and future production runs.
create table if not exists public.chatty_flow_runs (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  version_id uuid references public.chatty_flow_versions(id) on delete set null,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  inputs jsonb not null default '[]'::jsonb,
  trace jsonb not null default '[]'::jsonb,
  error text,
  duration_ms integer,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists chatty_flow_runs_bot_created_idx
  on public.chatty_flow_runs(bot_id, created_at desc);

alter table public.chatty_flow_runs enable row level security;

drop policy if exists "flow runs owner access" on public.chatty_flow_runs;
create policy "flow runs owner access" on public.chatty_flow_runs
  for all using (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_runs.bot_id and b.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_runs.bot_id and b.user_id = auth.uid()
  ));
