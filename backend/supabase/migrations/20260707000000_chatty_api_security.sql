-- API key scopes + IP allowlist
alter table chatty_api_keys
    add column if not exists scopes      text[]  not null default '{chat,read}',
    add column if not exists allowed_ips text[]  default null;

comment on column chatty_api_keys.scopes is
    'Granted permission scopes: chat | read | write | admin';
comment on column chatty_api_keys.allowed_ips is
    'Optional IP allowlist (exact IPs or CIDR ranges). NULL = allow any IP.';

-- Audit log — one row per public API request
create table if not exists chatty_api_audit_log (
    id          uuid        primary key default gen_random_uuid(),
    key_id      text        not null,
    bot_id      text        not null,
    endpoint    text        not null,
    method      text        not null,
    client_ip   text        not null,
    request_id  text        not null,
    status_code integer     not null default 200,
    duration_ms integer     not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists chatty_api_audit_log_key_id_idx
    on chatty_api_audit_log (key_id, created_at desc);

create index if not exists chatty_api_audit_log_bot_id_idx
    on chatty_api_audit_log (bot_id, created_at desc);

-- Auto-prune rows older than 90 days (pg_cron if available; safe to skip otherwise)
-- Kept as a comment — enable manually via Cloud Scheduler or pg_cron if desired:
-- select cron.schedule('prune-audit-log','0 3 * * *',
--   $$delete from chatty_api_audit_log where created_at < now() - interval '90 days'$$);
