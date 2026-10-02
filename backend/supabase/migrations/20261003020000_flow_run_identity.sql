alter table public.chatty_flow_runs add column if not exists flow_id uuid references public.chatty_flows(id) on delete set null;
alter table public.chatty_flow_runs add column if not exists event_id text;
alter table public.chatty_flow_runs add column if not exists idempotency_key text;
create unique index if not exists chatty_flow_runs_idempotency_idx
  on public.chatty_flow_runs(idempotency_key) where idempotency_key is not null;
create index if not exists chatty_flow_runs_flow_created_idx
  on public.chatty_flow_runs(flow_id, created_at desc);
