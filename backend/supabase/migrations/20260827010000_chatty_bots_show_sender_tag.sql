-- Customizer toggle: label each assistant reply in the widget as "AI" or
-- "Human agent" (per chatty_conversations.sender), so visitors can tell
-- which is which. Off by default — matches the widget's current behavior.
alter table chatty_bots add column if not exists show_sender_tag boolean not null default false;
