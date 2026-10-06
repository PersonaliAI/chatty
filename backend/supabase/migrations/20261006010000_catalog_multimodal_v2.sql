-- Industrial catalog retrieval: one cross-modal embedding space plus
-- lexical/metadata retrieval for exact commerce attributes.
--
-- Gemini Embedding 2 maps text and images into one space. Existing catalog
-- vectors were produced by older model versions and must not be compared to
-- the new vectors, so the RPCs intentionally accept only v2-ready records.

ALTER TABLE public.chatty_media_items
  ADD COLUMN IF NOT EXISTS search_text TEXT;

UPDATE public.chatty_media_items
SET search_text = trim(concat_ws(
  ' ',
  title,
  description,
  sku,
  visual_attributes::text,
  metadata->>'categories',
  metadata->>'tags',
  metadata->>'attributes',
  metadata->>'variations',
  metadata->>'stock_status',
  metadata->>'in_stock',
  metadata->>'type',
  metadata->>'status',
  metadata->>'brand',
  metadata->>'color',
  metadata->>'colors',
  metadata->>'colour',
  metadata->>'colours',
  metadata->>'material',
  metadata->>'size',
  metadata->>'sizes'
))
WHERE search_text IS NULL OR search_text = '';

CREATE INDEX IF NOT EXISTS idx_chatty_media_items_search_text
  ON public.chatty_media_items
  USING gin (to_tsvector('simple', coalesce(search_text, '')));

DROP FUNCTION IF EXISTS public.match_media_items_multimodal(
  uuid, vector, vector, double precision, integer, text
);

CREATE OR REPLACE FUNCTION public.match_media_items_multimodal(
  match_bot_id uuid,
  query_embedding vector(768) DEFAULT NULL,
  query_image_embedding vector(768) DEFAULT NULL,
  query_text text DEFAULT NULL,
  match_threshold float DEFAULT 0.25,
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
SET search_path = public, extensions
AS $$
  WITH candidates AS (
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
      CASE
        WHEN query_embedding IS NOT NULL
          AND m.embedding IS NOT NULL
          AND m.metadata->>'_embedding_schema' = 'catalog-multimodal-v2'
          AND m.metadata->>'_embedding_status' = 'ready'
        THEN 1 - (m.embedding <=> query_embedding)
        ELSE NULL
      END AS text_similarity,
      CASE
        WHEN query_image_embedding IS NOT NULL
          AND m.image_embedding IS NOT NULL
          AND m.metadata->>'_image_embedding_schema' = 'catalog-multimodal-v2'
          AND m.metadata->>'_image_embedding_status' = 'ready'
        THEN 1 - (m.image_embedding <=> query_image_embedding)
        ELSE NULL
      END AS image_similarity,
      CASE
        WHEN nullif(trim(query_text), '') IS NOT NULL
        THEN ts_rank_cd(
          to_tsvector('simple', coalesce(m.search_text, '')),
          websearch_to_tsquery('simple', query_text)
        )
        ELSE 0
      END AS lexical_score
    FROM public.chatty_media_items m
    WHERE m.bot_id = match_bot_id
      AND (filter_media_type IS NULL OR m.media_type = filter_media_type)
  ),
  scored AS (
    SELECT
      c.*,
      CASE
        WHEN c.text_similarity IS NOT NULL OR c.image_similarity IS NOT NULL THEN
          (
            COALESCE(c.text_similarity, 0) * CASE WHEN c.text_similarity IS NOT NULL THEN 0.30 ELSE 0 END
            + COALESCE(c.image_similarity, 0) * CASE WHEN c.image_similarity IS NOT NULL THEN 0.70 ELSE 0 END
          ) / NULLIF(
            CASE WHEN c.text_similarity IS NOT NULL THEN 0.30 ELSE 0 END
            + CASE WHEN c.image_similarity IS NOT NULL THEN 0.70 ELSE 0 END,
            0
          ) * 0.85
          + LEAST(GREATEST(c.lexical_score, 0), 1) * 0.15
        ELSE LEAST(GREATEST(c.lexical_score, 0), 1)
      END AS combined_similarity
    FROM candidates c
  )
  SELECT
    s.id,
    s.bot_id,
    s.media_type,
    s.title,
    s.description,
    s.sku,
    s.price,
    s.currency,
    s.url,
    s.media_url,
    s.thumbnail_url,
    s.video_url,
    s.video_timestamp_start,
    s.video_timestamp_end,
    s.visual_attributes,
    s.metadata,
    s.combined_similarity::float AS similarity
  FROM scored s
  WHERE s.combined_similarity >= match_threshold
  ORDER BY s.combined_similarity DESC, s.title ASC
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.match_media_items_multimodal(
  uuid, vector, vector, text, double precision, integer, text
) TO anon, authenticated, service_role;
