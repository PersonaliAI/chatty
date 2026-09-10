-- Enable pgvector extension (used by drive_documents/document_chunks embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'executive')),
  lemon_customer_id TEXT,
  lemon_subscription_id TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  briefing_enabled BOOLEAN DEFAULT FALSE,
  briefing_time TIME DEFAULT '08:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages Table (used read-only for chatty_quota_exceeded()'s combined
-- Kin+Chatty message count - kept even in a standalone Chatty DB since that
-- function assumes the table exists; owner accounts are the join point)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  audio_url TEXT,
  tool_calls JSONB,
  token_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
