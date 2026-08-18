-- Migration: Chatty AI Chatbot Platform Schema

-- Chatty Bots Table (Appearance & Settings)
CREATE TABLE IF NOT EXISTS chatty_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Chatty Assistant',
  welcome_message TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
  primary_color TEXT NOT NULL DEFAULT '#f97316',
  widget_style TEXT NOT NULL DEFAULT 'minimalist',
  selected_model TEXT NOT NULL DEFAULT 'gemini',
  system_instructions TEXT NOT NULL DEFAULT 'You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.',
  strict_mode BOOLEAN NOT NULL DEFAULT TRUE,
  email_notify BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chatty Training Sources Table (Knowledge Base)
CREATE TABLE IF NOT EXISTS chatty_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'url', 'file')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trained' CHECK (status IN ('training', 'trained', 'failed')),
  char_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chatty Leads Table (Captured contact details)
CREATE TABLE IF NOT EXISTS chatty_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chatty Conversations Table (Playground / Embed session history)
CREATE TABLE IF NOT EXISTS chatty_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatty_bots_user ON chatty_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_chatty_sources_bot ON chatty_sources(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_leads_bot ON chatty_leads(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_conv_session ON chatty_conversations(session_id);

-- Enable RLS (Row Level Security) on the tables
ALTER TABLE chatty_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_conversations ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
-- Users can only manage their own Chatty Bots
CREATE POLICY "Users can manage their own bots" ON chatty_bots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can manage sources for their own bots
CREATE POLICY "Users can manage sources for their own bots" ON chatty_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_sources.bot_id AND chatty_bots.user_id = auth.uid()
    )
  );

-- Users can view leads captured for their own bots
CREATE POLICY "Users can view leads for their own bots" ON chatty_leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_leads.bot_id AND chatty_bots.user_id = auth.uid()
    )
  );

-- Anyone (public) can insert leads (from the embed widget)
CREATE POLICY "Public can insert leads" ON chatty_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Anyone can insert conversations or select messages for a session (from widget)
CREATE POLICY "Public can manage conversations" ON chatty_conversations
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
