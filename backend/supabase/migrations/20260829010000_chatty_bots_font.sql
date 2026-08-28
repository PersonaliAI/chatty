-- Widget font customization: a Google Fonts family name (null = the active
-- design preset's own default font, e.g. DM Sans for "minimal") and a
-- font-size scale as a percentage of the widget's normal size (100 =
-- unchanged). Both additive/nullable — an existing bot with neither set
-- keeps rendering exactly as before.
alter table chatty_bots add column if not exists font_family text;
alter table chatty_bots add column if not exists font_size_percent integer default 100;
