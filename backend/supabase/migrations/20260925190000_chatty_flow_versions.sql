-- Durable Flow Builder revisions for draft/publish/rollback and auditability.
create table if not exists public.chatty_flow_versions (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  flow_data jsonb not null default '{"nodes": [], "edges": []}'::jsonb,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (bot_id, version)
);

create index if not exists chatty_flow_versions_bot_created_idx
  on public.chatty_flow_versions(bot_id, created_at desc);

alter table public.chatty_flow_versions enable row level security;

drop policy if exists "flow versions owner read" on public.chatty_flow_versions;
create policy "flow versions owner read" on public.chatty_flow_versions
  for select using (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_versions.bot_id and b.user_id = auth.uid()
  ));

drop policy if exists "flow versions owner write" on public.chatty_flow_versions;
create policy "flow versions owner write" on public.chatty_flow_versions
  for all using (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_versions.bot_id and b.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_versions.bot_id and b.user_id = auth.uid()
  ));
