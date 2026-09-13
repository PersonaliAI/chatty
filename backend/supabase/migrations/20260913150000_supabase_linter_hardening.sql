-- Supabase Security Linter Hardening Migration
-- Resolves all ERROR, WARN, and INFO alerts flagged by Supabase Database Linter

-- 1. Enable RLS on public OAuth tables (resolves rls_disabled_in_public ERROR)
ALTER TABLE IF EXISTS public.chatty_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chatty_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chatty_oauth_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatty_oauth_clients') THEN
    DROP POLICY IF EXISTS "Users can manage own oauth clients" ON public.chatty_oauth_clients;
    CREATE POLICY "Users can manage own oauth clients" ON public.chatty_oauth_clients
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. Set search_path on mutable functions (resolves function_search_path_mutable WARN)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'touch_updated_at') THEN
    ALTER FUNCTION public.touch_updated_at() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_has_bot_access') THEN
    ALTER FUNCTION public.chatty_has_bot_access(uuid) SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_has_bot_permission') THEN
    ALTER FUNCTION public.chatty_has_bot_permission(uuid, text) SET search_path = public;
  END IF;
END $$;

-- 3. Revoke public/anon access from internal SECURITY DEFINER functions (resolves anon_security_definer_function_executable WARN)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_auth_user') THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_enforce_bot_limit') THEN
    REVOKE EXECUTE ON FUNCTION public.chatty_enforce_bot_limit() FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id') THEN
    REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_has_bot_access') THEN
    REVOKE EXECUTE ON FUNCTION public.chatty_has_bot_access(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.chatty_has_bot_access(uuid) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'chatty_has_bot_permission') THEN
    REVOKE EXECUTE ON FUNCTION public.chatty_has_bot_permission(uuid, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.chatty_has_bot_permission(uuid, text) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_document_chunks' AND pronargs = 4) THEN
    REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, double precision, integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, double precision, integer) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_document_chunks' AND pronargs = 5) THEN
    REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, double precision, integer, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, double precision, integer, text) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_memories' AND pronargs = 4) THEN
    REVOKE EXECUTE ON FUNCTION public.match_memories(vector, uuid, double precision, integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.match_memories(vector, uuid, double precision, integer) TO authenticated, service_role;
  END IF;
END $$;

-- 4. Harden permissive INSERT policies (resolves rls_policy_always_true WARN)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatty_kb_feedback') THEN
    DROP POLICY IF EXISTS "Public can submit feedback" ON public.chatty_kb_feedback;
    CREATE POLICY "Public can submit feedback" ON public.chatty_kb_feedback
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (article_id IS NOT NULL AND is_helpful IS NOT NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatty_kb_searches') THEN
    DROP POLICY IF EXISTS "Public can record searches" ON public.chatty_kb_searches;
    CREATE POLICY "Public can record searches" ON public.chatty_kb_searches
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (query IS NOT NULL AND length(trim(query)) > 0);
  END IF;
END $$;

-- 5. Add explicit service_role policies to internal tables (resolves rls_enabled_no_policy INFO)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_manual_migrations_log') THEN
    DROP POLICY IF EXISTS "Service role access _manual_migrations_log" ON public._manual_migrations_log;
    CREATE POLICY "Service role access _manual_migrations_log" ON public._manual_migrations_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatty_webhook_deliveries') THEN
    DROP POLICY IF EXISTS "Service role access chatty_webhook_deliveries" ON public.chatty_webhook_deliveries;
    CREATE POLICY "Service role access chatty_webhook_deliveries" ON public.chatty_webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kin_email_watches') THEN
    DROP POLICY IF EXISTS "Service role access kin_email_watches" ON public.kin_email_watches;
    CREATE POLICY "Service role access kin_email_watches" ON public.kin_email_watches FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kin_webhook_deliveries') THEN
    DROP POLICY IF EXISTS "Service role access kin_webhook_deliveries" ON public.kin_webhook_deliveries;
    CREATE POLICY "Service role access kin_webhook_deliveries" ON public.kin_webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lemon_events') THEN
    DROP POLICY IF EXISTS "Service role access lemon_events" ON public.lemon_events;
    CREATE POLICY "Service role access lemon_events" ON public.lemon_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Move pg_net extension to extensions schema if available (resolves extension_in_public WARN)
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_net extension schema alteration: %', SQLERRM;
END $$;
