-- Editable proactive-teaser bubble text shown next to the widget launcher.
alter table chatty_bots
  add column if not exists teaser_message text default '👋 Need help? Chat with us.';
