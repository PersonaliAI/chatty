-- Migration: Add bot claim and transfer support for outreach and agency handoffs
ALTER TABLE IF EXISTS public.chatty_bots
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'claimed', 'expired', 'declined')),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS demo_target_name TEXT,
  ADD COLUMN IF NOT EXISTS demo_target_url TEXT,
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_prompts JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chatty_bots_claim_token ON public.chatty_bots(claim_token);
