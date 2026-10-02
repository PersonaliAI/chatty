-- Stable workflow identities allow several independent automations per bot.
create table if not exists public.chatty_flows (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  name text not null default 'Chatty automation',
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatty_flows_bot_updated_idx on public.chatty_flows(bot_id, updated_at desc);
alter table public.chatty_flows enable row level security;
drop policy if exists "chatty flows owner access" on public.chatty_flows;
create policy "chatty flows owner access" on public.chatty_flows for all using (exists (
  select 1 from public.chatty_bots b where b.id = chatty_flows.bot_id and b.user_id = auth.uid()
)) with check (exists (
  select 1 from public.chatty_bots b where b.id = chatty_flows.bot_id and b.user_id = auth.uid()
));

alter table public.chatty_flow_versions add column if not exists flow_id uuid references public.chatty_flows(id) on delete cascade;

do $$
declare
  version_row record;
  new_flow_id uuid;
begin
  for version_row in select distinct on (bot_id) bot_id, created_by from public.chatty_flow_versions where flow_id is null order by bot_id, created_at loop
    insert into public.chatty_flows (bot_id, name, created_by) values (version_row.bot_id, 'Chatty automation', version_row.created_by) returning id into new_flow_id;
    update public.chatty_flow_versions set flow_id = new_flow_id where bot_id = version_row.bot_id and flow_id is null;
  end loop;
end $$;

create index if not exists chatty_flow_versions_flow_version_idx on public.chatty_flow_versions(flow_id, version desc);
alter table public.chatty_flow_versions drop constraint if exists chatty_flow_versions_bot_id_version_key;
create unique index if not exists chatty_flow_versions_flow_version_unique_idx on public.chatty_flow_versions(flow_id, version);

create or replace function public.publish_chatty_flow_version_v2(
  p_flow_id uuid,
  p_version integer,
  p_flow_data jsonb,
  p_note text,
  p_created_by uuid,
  p_custom_js text
)
returns setof public.chatty_flow_versions
language plpgsql security definer set search_path = public
as $$
declare
  target_bot_id uuid;
begin
  if p_flow_data is null or p_custom_js is null then
    raise exception using errcode = '22023', message = 'flow publish payload is incomplete';
  end if;
  select bot_id into target_bot_id from public.chatty_flows where id = p_flow_id;
  if target_bot_id is null then raise exception using errcode = 'P0002', message = 'flow not found'; end if;
  update public.chatty_flow_versions set status = 'draft'
    where flow_id = p_flow_id and status = 'published';
  update public.chatty_flows set updated_at = now() where id = p_flow_id;
  update public.chatty_bots set custom_js = p_custom_js where id = target_bot_id;
  return query insert into public.chatty_flow_versions
    (bot_id, flow_id, version, status, flow_data, note, created_by, published_at)
    values (target_bot_id, p_flow_id, p_version, 'published', p_flow_data, p_note, p_created_by, now()) returning *;
end;
$$;

revoke all on function public.publish_chatty_flow_version_v2(uuid, integer, jsonb, text, uuid, text) from public;
grant execute on function public.publish_chatty_flow_version_v2(uuid, integer, jsonb, text, uuid, text) to service_role;
