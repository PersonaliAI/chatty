-- Tenant-scoped credentials for provider nodes in the flow builder.
-- Secret values stay encrypted in the service role database.

create table if not exists public.chatty_flow_connections (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  name text not null,
  auth_type text not null check (auth_type in ('oauth', 'api_key', 'token', 'basic', 'webhook')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  encrypted_credentials text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatty_flow_connections_bot_idx
  on public.chatty_flow_connections(bot_id, provider, created_at desc);

alter table public.chatty_flow_connections enable row level security;

drop policy if exists "flow connections owner access" on public.chatty_flow_connections;
create policy "flow connections owner access"
  on public.chatty_flow_connections
  for all
  using (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_connections.bot_id
      and b.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.chatty_bots b
    where b.id = chatty_flow_connections.bot_id
      and b.user_id = auth.uid()
  ));
