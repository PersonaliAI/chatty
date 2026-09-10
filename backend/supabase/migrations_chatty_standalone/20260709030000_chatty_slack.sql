-- Slack channel: link a bot to a Slack workspace so its slash command answers
-- from that bot's knowledge base.
alter table chatty_bots add column if not exists slack_team_id text;
create index if not exists idx_chatty_bots_slack on chatty_bots(slack_team_id);
