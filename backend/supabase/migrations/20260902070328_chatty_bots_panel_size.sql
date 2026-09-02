-- Widget size customization: a named preset controlling the chat panel's
-- default width/height ("compact" | "default" | "large"). The actual pixel
-- dimensions for each preset live in the widget frontend, not here, so
-- adding a new preset never needs a migration. Additive/nullable-with-default
-- — an existing bot with nothing set keeps rendering at today's size.
alter table chatty_bots add column if not exists panel_size text default 'default';
