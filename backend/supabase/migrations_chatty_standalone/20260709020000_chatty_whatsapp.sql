-- WhatsApp channel: link a bot to a Meta WhatsApp Business phone number so
-- inbound messages to that number are answered by the bot.
alter table chatty_bots add column if not exists whatsapp_phone_number_id text;
create index if not exists idx_chatty_bots_wa on chatty_bots(whatsapp_phone_number_id);
