-- Migration: RLS was never enabled on 5 tables added after the original
-- 20260708000000_chatty_rls_lockdown.sql pass — Supabase's Security Advisor
-- flagged them as exposed to PostgREST with no RLS. All backend writes go
-- through the service role (bypasses RLS), so these only need owner-scoped
-- read/write for the dashboard, or no policy at all for pure internal tables.

-- ── chatty_api_keys ──────────────────────────────────────────────────────
ALTER TABLE chatty_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own API keys" ON chatty_api_keys
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── chatty_api_audit_log ─────────────────────────────────────────────────
-- Read-only for owners (viewing usage of their own bots' keys); rows are
-- only ever inserted by the backend via service role.
ALTER TABLE chatty_api_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view audit log for their bots" ON chatty_api_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id::text = chatty_api_audit_log.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  );

-- ── user_subscriptions ───────────────────────────────────────────────────
-- Read-only for the owning user; writes come only from the Lemon Squeezy
-- webhook handler via service role.
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own subscription" ON user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── lemon_events ─────────────────────────────────────────────────────────
-- Pure internal webhook-event log (billing), no user-facing access at all —
-- enable RLS with zero policies so only the service role can touch it.
ALTER TABLE lemon_events ENABLE ROW LEVEL SECURITY;

-- ── _manual_migrations_log ───────────────────────────────────────────────
-- Internal migration-tracking table (not part of the app schema) — same
-- treatment, service role only.
ALTER TABLE _manual_migrations_log ENABLE ROW LEVEL SECURITY;
