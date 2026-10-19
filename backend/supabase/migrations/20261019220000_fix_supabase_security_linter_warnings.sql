-- ==============================================================================
-- Migration: Fix Supabase Security Linter Warnings (0013, 0011, 0028, 0029)
-- 
-- 1. rls_disabled_in_public:
--    - Enables RLS on public.chatty_lifecycle_emails with service_role and owner policies.
-- 
-- 2. function_search_path_mutable:
--    - Sets search_path = public, pg_temp on touch_updated_at and increment_api_key_usage.
-- 
-- 3. anon_security_definer_function_executable (0028) & authenticated (0029):
--    - Revokes execute from anon and PUBLIC on all SECURITY DEFINER functions.
--    - Revokes execute from client roles on trigger functions (chatty_enforce_bot_limit, handle_new_auth_user).
--    - Revokes execute from client roles on internal background jobs (prune_chatty_channel_events).
--    - Restricts vector similarity functions to service_role (backend worker only).
--    - Secures RLS helper functions (current_user_id, chatty_has_bot_access, chatty_has_bot_permission).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on public.chatty_lifecycle_emails
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.chatty_lifecycle_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatty_lifecycle_emails_service_role" ON public.chatty_lifecycle_emails;
CREATE POLICY "chatty_lifecycle_emails_service_role"
  ON public.chatty_lifecycle_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chatty_lifecycle_emails_authenticated_select" ON public.chatty_lifecycle_emails;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'chatty_lifecycle_emails' 
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE POLICY "chatty_lifecycle_emails_authenticated_select" ON public.chatty_lifecycle_emails FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. Fix mutable search_path on functions (function_search_path_mutable)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'touch_updated_at'
  ) THEN
    ALTER FUNCTION public.touch_updated_at() SET search_path = public, pg_temp;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'increment_api_key_usage'
  ) THEN
    ALTER FUNCTION public.increment_api_key_usage(uuid) SET search_path = public, pg_temp;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. Revoke EXECUTE on TRIGGER functions (Never callable via PostgREST RPC)
-- ------------------------------------------------------------------------------
-- chatty_enforce_bot_limit() is a BEFORE INSERT trigger on chatty_bots
REVOKE EXECUTE ON FUNCTION public.chatty_enforce_bot_limit() FROM PUBLIC, anon, authenticated;

-- handle_new_auth_user() is an AFTER INSERT trigger on auth.users
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 4. Revoke EXECUTE on internal maintenance & cleanup functions
-- ------------------------------------------------------------------------------
-- prune_chatty_channel_events() is an internal cron job / maintenance procedure
REVOKE EXECUTE ON FUNCTION public.prune_chatty_channel_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_chatty_channel_events() TO service_role;


-- ------------------------------------------------------------------------------
-- 5. Revoke EXECUTE from anon & untrusted roles on backend-only RPCs
-- ------------------------------------------------------------------------------
-- increment_api_key_usage: only backend worker needs execute
REVOKE EXECUTE ON FUNCTION public.increment_api_key_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_api_key_usage(uuid) TO service_role;

-- publish_chatty_flow_version_v2: only authenticated flow editors & service_role
REVOKE EXECUTE ON FUNCTION public.publish_chatty_flow_version_v2(uuid, integer, jsonb, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_chatty_flow_version_v2(uuid, integer, jsonb, text, uuid, text) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. Revoke EXECUTE from anon & public on Vector Similarity Search Functions
-- (Called by backend FastAPI service_role, not by anonymous public web clients)
-- ------------------------------------------------------------------------------
-- match_document_chunks (4 args overload)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'match_document_chunks' AND p.pronargs = 4
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer) TO service_role;
    ALTER FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer) SET search_path = public, extensions, pg_temp;
  END IF;
END $$;

-- match_document_chunks (5 args overload)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'match_document_chunks' AND p.pronargs = 5
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer, text) TO service_role;
    ALTER FUNCTION public.match_document_chunks(extensions.vector, uuid, double precision, integer, text) SET search_path = public, extensions, pg_temp;
  END IF;
END $$;

-- match_media_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'match_media_items'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.match_media_items(extensions.vector, uuid, double precision, integer, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.match_media_items(extensions.vector, uuid, double precision, integer, text) TO service_role;
    ALTER FUNCTION public.match_media_items(extensions.vector, uuid, double precision, integer, text) SET search_path = public, extensions, pg_temp;
  END IF;
END $$;

-- match_media_items_multimodal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'match_media_items_multimodal'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.match_media_items_multimodal(uuid, extensions.vector, extensions.vector, text, double precision, integer, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.match_media_items_multimodal(uuid, extensions.vector, extensions.vector, text, double precision, integer, text) TO service_role;
    ALTER FUNCTION public.match_media_items_multimodal(uuid, extensions.vector, extensions.vector, text, double precision, integer, text) SET search_path = public, extensions, pg_temp;
  END IF;
END $$;

-- match_memories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'match_memories'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, double precision, integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, double precision, integer) TO service_role;
    ALTER FUNCTION public.match_memories(extensions.vector, uuid, double precision, integer) SET search_path = public, extensions, pg_temp;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 7. Fix RLS Policy Helper Functions: current_user_id, chatty_has_bot_access, chatty_has_bot_permission
-- ------------------------------------------------------------------------------
-- Revoke from anon & public to prevent unauthenticated PostgREST RPC invocation
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, service_role;
ALTER FUNCTION public.current_user_id() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.chatty_has_bot_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chatty_has_bot_access(uuid) TO authenticated, service_role;
ALTER FUNCTION public.chatty_has_bot_access(uuid) SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.chatty_has_bot_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chatty_has_bot_permission(uuid, text) TO authenticated, service_role;
ALTER FUNCTION public.chatty_has_bot_permission(uuid, text) SET search_path = public, pg_temp;
