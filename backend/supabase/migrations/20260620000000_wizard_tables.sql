-- Migration: Add Wizard configurations, dynamic lead fields, and Admin Panel tables

-- 1. Alter chatty_bots to support wizard configs and extra calendar integrations
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS lead_fields JSONB NOT NULL DEFAULT '["name", "email", "phone"]'::jsonb;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS bot_country TEXT;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS sync_outlook_calendar BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS sync_office365_calendar BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS meeting_provider TEXT NOT NULL DEFAULT 'google_meet';
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
ALTER TABLE chatty_bots ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 2. Alter chatty_leads to add pre-defined optional capture fields and custom_fields jsonb
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 3. Create chatty_meetings table for scheduled client appointments
CREATE TABLE IF NOT EXISTS chatty_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES chatty_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  meeting_link TEXT,
  provider TEXT NOT NULL, -- 'google_meet', 'zoom', 'teams'
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  attendee_email TEXT NOT NULL,
  attendee_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create chatty_notifications table for tracking emails & OneSignal push notifications
CREATE TABLE IF NOT EXISTS chatty_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  meeting_id UUID REFERENCES chatty_meetings(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'email', 'onesignal'
  type TEXT NOT NULL, -- 'client', 'admin'
  subject TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create chatty_audit_logs table for user and system activity logging
CREATE TABLE IF NOT EXISTS chatty_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- 'bot_created', 'training_started', 'lead_configured', 'calendar_connected', 'meeting_booked'
  details TEXT NOT NULL,
  performed_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security) on the tables
ALTER TABLE chatty_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to prevent duplicates)
DROP POLICY IF EXISTS "Users can manage meetings for their own bots" ON chatty_meetings;
DROP POLICY IF EXISTS "Users can view notifications for their own bots" ON chatty_notifications;
DROP POLICY IF EXISTS "Users can view audit logs for their own bots" ON chatty_audit_logs;
DROP POLICY IF EXISTS "Public can insert meetings" ON chatty_meetings;
DROP POLICY IF EXISTS "Public can insert notifications" ON chatty_notifications;

-- Create Policies for RLS
CREATE POLICY "Users can manage meetings for their own bots" ON chatty_meetings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_meetings.bot_id AND chatty_bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert meetings" ON chatty_meetings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view notifications for their own bots" ON chatty_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_notifications.bot_id AND chatty_bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert notifications" ON chatty_notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view audit logs for their own bots" ON chatty_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_audit_logs.bot_id AND chatty_bots.user_id = auth.uid()
    )
  );
