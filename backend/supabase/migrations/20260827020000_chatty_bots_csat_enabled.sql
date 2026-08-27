-- Customizer toggle: the post-chat "How was your conversation?" star-rating
-- popup, currently always shown (when closing after 2+ messages and no
-- rating submitted yet this session) with no way to turn it off. Defaults
-- to true so existing bots keep their current behavior.
alter table chatty_bots add column if not exists csat_enabled boolean not null default true;
