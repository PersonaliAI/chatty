-- Knowledge source mode for the bot's answers:
--   'strict' — only the trained knowledge base (default, safest)
--   'hybrid' — knowledge base + the model's own general knowledge
--   'web'    — knowledge base + live web search
alter table chatty_bots add column if not exists answer_mode text not null default 'strict'
  check (answer_mode in ('strict', 'hybrid', 'web'));
