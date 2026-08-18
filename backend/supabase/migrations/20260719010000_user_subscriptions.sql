-- user_subscriptions was never created in any migration — the LemonSqueezy
-- webhook (main.py's /webhook/lemonsqueezy) upserts into it directly.
-- Reconstructed from that upsert's actual field usage.

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  variant_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
