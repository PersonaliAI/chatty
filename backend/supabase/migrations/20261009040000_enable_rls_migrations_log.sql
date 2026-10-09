-- Keep the migration ledger out of the PostgREST public surface.
-- The backend migration runner uses the database owner/service role, while
-- browser roles must not be able to read or mutate migration bookkeeping.
ALTER TABLE IF EXISTS public._migrations_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._migrations_log FROM anon, authenticated;
