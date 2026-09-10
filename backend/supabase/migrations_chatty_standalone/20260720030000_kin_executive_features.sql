-- Token-level usage tracking (real cost-per-user measurement) - feeds
-- chatty_quota_exceeded()'s combined-usage check.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS total_tokens INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_messages_user_created_tokens
    ON messages(user_id, created_at) WHERE total_tokens > 0;
