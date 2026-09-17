-- Migration: Industrial Multimodal RAG (MM-RAG) - Images, Videos, & Product Catalog
-- Supports visual similarity search (e.g. clothing/product photo matching),
-- video keyframe retrieval with timestamp jump, and structured product cards.

CREATE TABLE IF NOT EXISTS public.chatty_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.chatty_sources(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('product', 'image', 'video', 'video_frame')),
  title TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  url TEXT,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  video_timestamp_start NUMERIC(8, 2),
  video_timestamp_end NUMERIC(8, 2),
  visual_attributes JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_bot ON public.chatty_media_items(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_sku ON public.chatty_media_items(bot_id, sku);
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_type ON public.chatty_media_items(bot_id, media_type);
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_gin_attrs ON public.chatty_media_items USING gin (visual_attributes);

-- HNSW Vector Index for fast sub-millisecond visual & multimodal similarity search
CREATE INDEX IF NOT EXISTS idx_chatty_media_items_embedding 
  ON public.chatty_media_items 
  USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.chatty_media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage media items for own bots"
  ON public.chatty_media_items
  FOR ALL
  USING (
    bot_id IN (
      SELECT id FROM public.chatty_bots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public widget read access to media items"
  ON public.chatty_media_items
  FOR SELECT
  USING (true);

-- RPC Function for Multimodal Vector Search with tenant isolation
CREATE OR REPLACE FUNCTION match_media_items(
  query_embedding vector(768),
  match_bot_id uuid,
  match_threshold float DEFAULT 0.40,
  match_count int DEFAULT 6,
  filter_media_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  bot_id uuid,
  media_type text,
  title text,
  description text,
  sku text,
  price numeric,
  currency text,
  url text,
  media_url text,
  thumbnail_url text,
  video_url text,
  video_timestamp_start numeric,
  video_timestamp_end numeric,
  visual_attributes jsonb,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.bot_id,
    m.media_type,
    m.title,
    m.description,
    m.sku,
    m.price,
    m.currency,
    m.url,
    m.media_url,
    m.thumbnail_url,
    m.video_url,
    m.video_timestamp_start,
    m.video_timestamp_end,
    m.visual_attributes,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM chatty_media_items m
  WHERE m.bot_id = match_bot_id
    AND (filter_media_type IS NULL OR m.media_type = filter_media_type)
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
