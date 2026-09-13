-- WhatsApp Business channel: multi-tenant credentials and settings
alter table chatty_bots add column if not exists whatsapp_access_token text;
alter table chatty_bots add column if not exists whatsapp_verify_token text;
alter table chatty_bots add column if not exists whatsapp_app_secret text;
alter table chatty_bots add column if not exists whatsapp_waba_id text;
alter table chatty_bots add column if not exists whatsapp_enabled boolean default false;
alter table chatty_bots add column if not exists whatsapp_quick_replies jsonb default '[]'::jsonb;

create index if not exists idx_chatty_bots_wa_phone on chatty_bots(whatsapp_phone_number_id);
create index if not exists idx_chatty_bots_wa_verify on chatty_bots(whatsapp_verify_token);
