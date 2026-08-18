-- Generic outbound webhook: POSTed on new conversations and new leads
-- (covers the "Actions"/Zapier-style integration and "Notifications" gaps).
alter table chatty_bots add column if not exists webhook_url text;
