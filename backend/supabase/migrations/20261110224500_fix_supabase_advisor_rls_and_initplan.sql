-- ==============================================================================
-- Migration: Fix Supabase Security & Performance Advisor Warnings
--
-- 1. CRITICAL: RLS Disabled in Public (public.chatty_payment_integrations)
--    - Enables Row Level Security on public.chatty_payment_integrations.
--    - Grants full access to service_role (used by FastAPI backend worker).
--    - Grants bot owners access to manage integrations for their own bots.
--
-- 2. PERFORMANCE: Auth RLS Initialization Plan (auth_rls_initplan)
--    - Replaces bare `auth.uid()` with `(SELECT auth.uid())` in policies for:
--        * public.chatty_orders
--        * public.chatty_oauth_clients
--        * public.chatty_bots
--        * public.chatty_sources
--        * public.chatty_availability_rules
--        * public.chatty_meetings
--        * public.chatty_media_items
--        * public.chatty_woocommerce_integrations
--        * public.chatty_flow_versions
--    Wrapping `auth.uid()` in a subquery lets PostgreSQL execute it once as an
--    InitPlan for the entire query instead of evaluating it per-row.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX CRITICAL ERROR: Enable RLS on public.chatty_payment_integrations
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.chatty_payment_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatty_payment_integrations_service_role" ON public.chatty_payment_integrations;
CREATE POLICY "chatty_payment_integrations_service_role"
  ON public.chatty_payment_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage payment integrations for their own bots" ON public.chatty_payment_integrations;
CREATE POLICY "Users can manage payment integrations for their own bots"
  ON public.chatty_payment_integrations
  FOR ALL
  TO authenticated
  USING (
    bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid()))
  );


-- ------------------------------------------------------------------------------
-- 2. PERFORMANCE: public.chatty_orders (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage orders for their own bots" ON public.chatty_orders;
CREATE POLICY "Users can manage orders for their own bots"
  ON public.chatty_orders
  FOR ALL
  TO authenticated
  USING (
    bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid()))
  );


-- ------------------------------------------------------------------------------
-- 3. PERFORMANCE: public.chatty_oauth_clients (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own oauth clients" ON public.chatty_oauth_clients;
CREATE POLICY "Users can manage own oauth clients"
  ON public.chatty_oauth_clients
  FOR ALL
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));


-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE: public.chatty_bots (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their own bots" ON public.chatty_bots;
CREATE POLICY "Users can manage their own bots"
  ON public.chatty_bots
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE: public.chatty_sources (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage sources for their own bots" ON public.chatty_sources;
CREATE POLICY "Users can manage sources for their own bots"
  ON public.chatty_sources
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chatty_bots
    WHERE chatty_bots.id = chatty_sources.bot_id AND chatty_bots.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chatty_bots
    WHERE chatty_bots.id = chatty_sources.bot_id AND chatty_bots.user_id = (SELECT auth.uid())
  ));


-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE: public.chatty_availability_rules (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner manages availability rules" ON public.chatty_availability_rules;
CREATE POLICY "Owner manages availability rules"
  ON public.chatty_availability_rules
  FOR ALL
  TO authenticated
  USING (
    bot_id IN (SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid()))
  );


-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE: public.chatty_meetings (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage meetings for their own bots" ON public.chatty_meetings;
CREATE POLICY "Users can manage meetings for their own bots"
  ON public.chatty_meetings
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chatty_bots
    WHERE chatty_bots.id = chatty_meetings.bot_id AND chatty_bots.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chatty_bots
    WHERE chatty_bots.id = chatty_meetings.bot_id AND chatty_bots.user_id = (SELECT auth.uid())
  ));


-- ------------------------------------------------------------------------------
-- 8. PERFORMANCE: public.chatty_media_items (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage media items for own bots" ON public.chatty_media_items;
CREATE POLICY "Users can manage media items for own bots"
  ON public.chatty_media_items
  FOR ALL
  TO authenticated
  USING (
    bot_id IN (
      SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid())
    )
  );


-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE: public.chatty_woocommerce_integrations (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage woocommerce integrations for own bots" ON public.chatty_woocommerce_integrations;
CREATE POLICY "Users can manage woocommerce integrations for own bots"
  ON public.chatty_woocommerce_integrations
  FOR ALL
  TO authenticated
  USING (
    bot_id IN (
      SELECT id FROM public.chatty_bots WHERE user_id = (SELECT auth.uid())
    )
  );


-- ------------------------------------------------------------------------------
-- 10. PERFORMANCE: public.chatty_flow_versions (Auth RLS InitPlan)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "flow versions owner read" ON public.chatty_flow_versions;
CREATE POLICY "flow versions owner read"
  ON public.chatty_flow_versions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chatty_bots b
    WHERE b.id = chatty_flow_versions.bot_id AND b.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "flow versions owner write" ON public.chatty_flow_versions;
CREATE POLICY "flow versions owner write"
  ON public.chatty_flow_versions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chatty_bots b
    WHERE b.id = chatty_flow_versions.bot_id AND b.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chatty_bots b
    WHERE b.id = chatty_flow_versions.bot_id AND b.user_id = (SELECT auth.uid())
  ));
