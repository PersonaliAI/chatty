-- Weighted AI credits for flat Chatty plans.
-- Existing visitor messages remain one credit through the default, while new
-- requests can be charged server-side according to prompt/media size.

ALTER TABLE public.chatty_conversations
  ADD COLUMN IF NOT EXISTS usage_units integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chatty_conversations_usage_units_check'
  ) THEN
    ALTER TABLE public.chatty_conversations
      ADD CONSTRAINT chatty_conversations_usage_units_check
      CHECK (usage_units BETWEEN 1 AND 8);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chatty_conv_usage_month
  ON public.chatty_conversations(bot_id, created_at)
  WHERE role = 'user';

CREATE OR REPLACE FUNCTION public.chatty_monthly_ai_credits(
  p_owner_auth_id text,
  p_month_start timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(c.usage_units, 1)), 0)::bigint
  FROM public.chatty_conversations c
  JOIN public.chatty_bots b ON b.id = c.bot_id
  WHERE b.user_id::text = p_owner_auth_id
    AND c.role = 'user'
    AND c.created_at >= p_month_start;
$$;

REVOKE ALL ON FUNCTION public.chatty_monthly_ai_credits(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatty_monthly_ai_credits(text, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.chatty_bot_ai_credits(
  p_bot_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE(visitor_messages bigint, ai_credits bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(COALESCE(c.usage_units, 1)), 0)::bigint
  FROM public.chatty_conversations c
  WHERE c.bot_id = p_bot_id
    AND c.role = 'user'
    AND (p_from IS NULL OR c.created_at >= p_from)
    AND (p_to IS NULL OR c.created_at <= p_to);
$$;

REVOKE ALL ON FUNCTION public.chatty_bot_ai_credits(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatty_bot_ai_credits(uuid, timestamptz, timestamptz)
  TO service_role;
