-- Migration: Add name column to public.users and keep it in sync with display_name
-- Fixes GDPR account export (GET /api/account/gdpr/export) and queries expecting users.name

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;

UPDATE public.users 
SET name = COALESCE(display_name, split_part(email, '@', 1)) 
WHERE name IS NULL;

CREATE OR REPLACE FUNCTION public.sync_users_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = OLD.display_name) THEN
        NEW.name := NEW.display_name;
    ELSIF NEW.name IS NOT NULL AND NEW.display_name IS NULL THEN
        NEW.display_name := NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_users_name ON public.users;
CREATE TRIGGER trg_sync_users_name
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_name();
