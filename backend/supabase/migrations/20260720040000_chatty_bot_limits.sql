-- Enforce the per-plan bot-count limits already advertised on the pricing
-- page (Hobby 1, Standard 3, Business 5) — nothing enforced this server-side
-- before, since bot creation writes directly from the dashboard to Supabase
-- (no backend endpoint in the loop to add a check to). A client-side check
-- alone would be trivially bypassable by calling the Supabase REST API
-- directly with the user's own session, so this has to live in the database.

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

  bot_limit := CASE owner_plan
    WHEN 'chatty_hobby' THEN 1
    WHEN 'chatty_standard' THEN 3
    WHEN 'chatty_business' THEN 5
    ELSE 1  -- free tier, or any non-Chatty (Kin) plan — matches the advertised free-tier "1 chatbot"
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
