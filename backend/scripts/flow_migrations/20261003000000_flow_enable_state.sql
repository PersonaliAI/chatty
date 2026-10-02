alter table public.chatty_flow_versions
  add column if not exists is_enabled boolean not null default true;

create index if not exists chatty_flow_versions_bot_status_enabled_idx
  on public.chatty_flow_versions(bot_id, status, is_enabled);
