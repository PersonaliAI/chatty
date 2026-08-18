-- Tappable suggested prompts ("conversation starters") shown in the widget.
alter table chatty_bots
  add column if not exists conversation_starters text[] default '{}'::text[];
