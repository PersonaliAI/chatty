-- Supports the visitor feedback cooldown lookup in /api/widget/csat.
-- The cooldown is scoped to bot + visitor session, so one visitor cannot
-- repeatedly submit ratings for the same conversation within two days.
create index if not exists chatty_csat_feedback_bot_session_created_at_idx
  on chatty_csat_feedback (bot_id, session_id, created_at desc);
