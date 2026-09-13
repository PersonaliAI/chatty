-- Update bot-count limits according to new pricing plans:
-- Free: 1 chatbot
-- Hobby: 3 chatbots
-- Standard: 6 chatbots
-- Business: Unlimited chatbots

CREATE OR REPLACE FUNCTION chatty_enforce_bot_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_plan TEXT;
  bot_limit INT;
  current_count INT;
BEGIN
  SELECT plan INTO owner_plan FROM users WHERE auth_user_id = NEW.user_id;

  -- Business tier has unlimited chatbots
  IF owner_plan = 'chatty_business' THEN
    RETURN NEW;
  END IF;

  bot_limit := CASE owner_plan
    WHEN 'chatty_hobby' THEN 3
    WHEN 'chatty_standard' THEN 6
    ELSE 1  -- free tier, or any non-Chatty (Kin) plan - matches the advertised free-tier "1 chatbot"
  END;

  SELECT COUNT(*) INTO current_count FROM chatty_bots WHERE user_id = NEW.user_id;

  IF current_count >= bot_limit THEN
    RAISE EXCEPTION 'Bot limit reached for your plan (max %). Upgrade to add more chatbots.', bot_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chatty_bots_enforce_limit ON chatty_bots;
CREATE TRIGGER chatty_bots_enforce_limit
  BEFORE INSERT ON chatty_bots
  FOR EACH ROW EXECUTE FUNCTION chatty_enforce_bot_limit();
