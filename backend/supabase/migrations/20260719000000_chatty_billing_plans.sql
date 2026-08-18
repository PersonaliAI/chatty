-- Add Chatty-specific paid plan tiers (Hobby/Standard/Business) to the shared
-- users.plan enum, so the Lemon Squeezy webhook can set them after checkout.
-- See kin-backend/main.py PLAN_QUOTAS / WHITELABEL_PLANS / LEMON_VARIANT_TO_PLAN.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (
  plan IN (
    'free', 'basic', 'pro', 'executive',
    'chatty_hobby', 'chatty_standard', 'chatty_business'
  )
);
