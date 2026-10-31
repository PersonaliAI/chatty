-- ==============================================================================
-- Migration: Enterprise Architecture Foundation
-- DeskcommCRM Doctrine applied to Chatty:
-- 1. Zero-Loss Event Log Outbox (Idempotency Key deduplication)
-- 2. Cognitive Session Checkpointing (Structured rolling summaries & objections)
-- 3. Omnichannel Sales Pipeline & Kanban Deals (Deals, Stages, Probabilities)
-- 4. Enterprise Audit Trail (Immutable security & mutation tracking)
-- 5. Row-Level Security (RLS) enforcement & Helper functions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Zero-Loss Event Log Outbox Table (chatty_event_log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatty_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  external_id text NOT NULL,
  bot_id uuid REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  next_attempt_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_event_log_channel_external_id UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_event_log_status_next ON public.chatty_event_log(status, next_attempt_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_event_log_bot_created ON public.chatty_event_log(bot_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Cognitive Session Checkpointing (chatty_session_checkpoints)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatty_session_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  summary_delta text,
  rolling_summary text,
  active_commitments jsonb DEFAULT '[]'::jsonb,
  unresolved_objections jsonb DEFAULT '[]'::jsonb,
  next_action text,
  customer_sentiment text DEFAULT 'neutral' CHECK (customer_sentiment IN ('positive', 'neutral', 'hesitant', 'frustrated')),
  lead_intent text DEFAULT 'inquiry' CHECK (lead_intent IN ('inquiry', 'support', 'sales', 'ready_to_buy', 'complaint')),
  turn_number int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_session_checkpoints_bot_session UNIQUE (bot_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_bot_updated ON public.chatty_session_checkpoints(bot_id, updated_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Omnichannel Sales Pipeline & Kanban Deals
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatty_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Sales Pipeline',
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatty_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.chatty_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_order int NOT NULL DEFAULT 0,
  win_probability int DEFAULT 0 CHECK (win_probability BETWEEN 0 AND 100),
  color text DEFAULT '#10b981',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatty_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.chatty_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.chatty_pipeline_stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  contact_id text,
  session_id text,
  value_cents bigint DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
  lost_reason text,
  expected_close_date date,
  assigned_team_member_id uuid REFERENCES public.chatty_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_bot_stage ON public.chatty_deals(bot_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_status_close ON public.chatty_deals(status, expected_close_date);

-- Helper to automatically populate default stages for new pipelines
CREATE OR REPLACE FUNCTION public.fn_seed_default_pipeline_stages()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.chatty_pipeline_stages (pipeline_id, name, stage_order, win_probability, color)
  VALUES
    (NEW.id, 'New Lead', 0, 10, '#3b82f6'),
    (NEW.id, 'Qualified', 1, 30, '#8b5cf6'),
    (NEW.id, 'Meeting Scheduled', 2, 60, '#f59e0b'),
    (NEW.id, 'Proposal Sent', 3, 80, '#06b6d4'),
    (NEW.id, 'Won / Closed', 4, 100, '#10b981'),
    (NEW.id, 'Lost', 5, 0, '#ef4444');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_pipeline_stages ON public.chatty_pipelines;
CREATE TRIGGER trg_seed_pipeline_stages
  AFTER INSERT ON public.chatty_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_seed_default_pipeline_stages();

-- ------------------------------------------------------------------------------
-- 4. Enterprise Audit Trail (chatty_enterprise_audit_log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatty_enterprise_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid,
  user_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  diff jsonb,
  ip_address text,
  request_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_bot_created ON public.chatty_enterprise_audit_log(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.chatty_enterprise_audit_log(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.chatty_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_session_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_enterprise_audit_log ENABLE ROW LEVEL SECURITY;

-- Grants for service_role
GRANT ALL ON public.chatty_event_log TO service_role;
GRANT ALL ON public.chatty_session_checkpoints TO service_role;
GRANT ALL ON public.chatty_pipelines TO service_role;
GRANT ALL ON public.chatty_pipeline_stages TO service_role;
GRANT ALL ON public.chatty_deals TO service_role;
GRANT ALL ON public.chatty_enterprise_audit_log TO service_role;

-- Authenticated Users Policies using chatty_has_bot_access
CREATE POLICY "service_role_full_access_event_log" ON public.chatty_event_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_checkpoints" ON public.chatty_session_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_pipelines" ON public.chatty_pipelines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_stages" ON public.chatty_pipeline_stages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_deals" ON public.chatty_deals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_audit" ON public.chatty_enterprise_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated policies on pipelines & deals
CREATE POLICY "users_manage_bot_pipelines" ON public.chatty_pipelines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatty_bots WHERE id = chatty_pipelines.bot_id AND user_id = auth.uid()));

CREATE POLICY "users_manage_pipeline_stages" ON public.chatty_pipeline_stages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chatty_pipelines p
    JOIN public.chatty_bots b ON b.id = p.bot_id
    WHERE p.id = chatty_pipeline_stages.pipeline_id AND b.user_id = auth.uid()
  ));

CREATE POLICY "users_manage_deals" ON public.chatty_deals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatty_bots WHERE id = chatty_deals.bot_id AND user_id = auth.uid()));

CREATE POLICY "users_view_session_checkpoints" ON public.chatty_session_checkpoints
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatty_bots WHERE id = chatty_session_checkpoints.bot_id AND user_id = auth.uid()));

CREATE POLICY "users_view_audit_logs" ON public.chatty_enterprise_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.chatty_bots WHERE id = chatty_enterprise_audit_log.bot_id AND user_id = auth.uid()
  ));
