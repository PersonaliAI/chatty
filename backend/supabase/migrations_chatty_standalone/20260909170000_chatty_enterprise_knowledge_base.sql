-- Migration: 20260909170000_chatty_enterprise_knowledge_base.sql
-- Pillar 2: Enterprise Knowledge Base & Help Center (Zendesk Guide Level)

-- 1. Knowledge Base Categories Table
CREATE TABLE IF NOT EXISTS chatty_kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Folder',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bot_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_chatty_kb_categories_bot ON chatty_kb_categories(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_categories_order ON chatty_kb_categories(bot_id, order_index);

-- 2. Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS chatty_kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES chatty_kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal_only')),
  author_id UUID,
  author_name TEXT DEFAULT '',
  author_email TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  helpful_count INT NOT NULL DEFAULT 0,
  not_helpful_count INT NOT NULL DEFAULT 0,
  source_id UUID REFERENCES chatty_sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bot_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_chatty_kb_articles_bot ON chatty_kb_articles(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_articles_cat ON chatty_kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_articles_status ON chatty_kb_articles(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_articles_visibility ON chatty_kb_articles(bot_id, visibility);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_articles_promoted ON chatty_kb_articles(bot_id, is_promoted);

-- 3. Knowledge Base Article Feedback Table (CSAT & Deflection Tracking)
CREATE TABLE IF NOT EXISTS chatty_kb_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES chatty_kb_articles(id) ON DELETE CASCADE NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  comment TEXT DEFAULT '',
  user_ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_kb_feedback_article ON chatty_kb_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_feedback_bot ON chatty_kb_feedback(bot_id);

-- 4. Knowledge Base Searches Table (Content Gap Analytics)
CREATE TABLE IF NOT EXISTS chatty_kb_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  results_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_kb_searches_bot ON chatty_kb_searches(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatty_kb_searches_query ON chatty_kb_searches(bot_id, query);

-- 5. Row Level Security (RLS)
ALTER TABLE chatty_kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_kb_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_kb_searches ENABLE ROW LEVEL SECURITY;

-- Team / Admin management policies
DROP POLICY IF EXISTS "Team manages kb categories" ON chatty_kb_categories;
CREATE POLICY "Team manages kb categories" ON chatty_kb_categories
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Team manages kb articles" ON chatty_kb_articles;
CREATE POLICY "Team manages kb articles" ON chatty_kb_articles
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Team reads kb feedback" ON chatty_kb_feedback;
CREATE POLICY "Team reads kb feedback" ON chatty_kb_feedback
  FOR SELECT TO authenticated
  USING (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Team reads kb searches" ON chatty_kb_searches;
CREATE POLICY "Team reads kb searches" ON chatty_kb_searches
  FOR SELECT TO authenticated
  USING (chatty_has_bot_access(bot_id));

-- Public read policies for published articles & categories on customer portal
DROP POLICY IF EXISTS "Public can view kb categories" ON chatty_kb_categories;
CREATE POLICY "Public can view kb categories" ON chatty_kb_categories
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can view published kb articles" ON chatty_kb_articles;
CREATE POLICY "Public can view published kb articles" ON chatty_kb_articles
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND visibility = 'public');

DROP POLICY IF EXISTS "Public can submit feedback" ON chatty_kb_feedback;
CREATE POLICY "Public can submit feedback" ON chatty_kb_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can record searches" ON chatty_kb_searches;
CREATE POLICY "Public can record searches" ON chatty_kb_searches
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
