-- Add a separate cross-modal vector so text and image retrieval can evolve
-- independently while the existing text RPC remains backwards compatible.

ALTER TABLE public.chatty_media_items
  ADD COLUMN IF NOT EXISTS image_embedding VECTOR(768);

CREATE INDEX IF NOT EXISTS idx_chatty_media_items_image_embedding
  ON public.chatty_media_items
  USING hnsw (image_embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_media_items_multimodal(
  match_bot_id uuid,
  query_embedding vector(768) DEFAULT NULL,
  query_image_embedding vector(768) DEFAULT NULL,
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scored AS (
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
    (
      CASE WHEN query_image_embedding IS NOT NULL AND m.image_embedding IS NOT NULL
        THEN 0.70 * (1 - (m.image_embedding <=> query_image_embedding)) ELSE 0 END
      + CASE WHEN query_embedding IS NOT NULL AND m.embedding IS NOT NULL
        THEN 0.30 * (1 - (m.embedding <=> query_embedding)) ELSE 0 END
    ) / NULLIF(
      CASE WHEN query_image_embedding IS NOT NULL AND m.image_embedding IS NOT NULL THEN 0.70 ELSE 0 END
      + CASE WHEN query_embedding IS NOT NULL AND m.embedding IS NOT NULL THEN 0.30 ELSE 0 END,
      0
    ) AS similarity
    FROM public.chatty_media_items m
    WHERE m.bot_id = match_bot_id
    AND (filter_media_type IS NULL OR m.media_type = filter_media_type)
    AND (
      (query_image_embedding IS NOT NULL AND m.image_embedding IS NOT NULL)
      OR (query_embedding IS NOT NULL AND m.embedding IS NOT NULL)
    )
  )
  SELECT * FROM scored
  WHERE scored.similarity >= match_threshold
  ORDER BY scored.similarity DESC
  LIMIT match_count;
$$;
