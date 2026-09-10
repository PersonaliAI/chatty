-- "Refine answers": thumbs up/down + an optional corrected answer on any
-- assistant message, reviewed from the Inbox tab.
alter table chatty_conversations add column if not exists feedback_rating text;
alter table chatty_conversations add column if not exists correction text;
