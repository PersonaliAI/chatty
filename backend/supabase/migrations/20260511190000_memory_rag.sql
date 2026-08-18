-- Long-term memory (RAG) — extends the existing memory_embeddings table.

-- 1. Per-user toggle.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT TRUE;

-- 2. Categorize memories so the UI can group/filter them.
ALTER TABLE memory_embeddings
  ADD COLUMN IF NOT EXISTS kind TEXT,
  ADD COLUMN IF NOT EXISTS source_session TEXT;

CREATE INDEX IF NOT EXISTS idx_memory_user_kind
  ON memory_embeddings(user_id, kind, created_at DESC);

-- 3. Insert + delete policies so the dashboard can manage what Kin remembers
--    (backend writes via service role and bypasses RLS, but we still need
--    deletes from the client).
DROP POLICY IF EXISTS "memory_delete_own" ON memory_embeddings;
CREATE POLICY "memory_delete_own" ON memory_embeddings
  FOR DELETE USING (user_id = public.current_user_id());

-- 4. Cosine-similarity RPC. We expose this to the backend (service role) so
--    it can run vector search without raw SQL plumbing.
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  kind text,
  metadata jsonb,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.kind,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memory_embeddings m
  WHERE m.user_id = match_user_id
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Drop the placeholder ivfflat index that was created with `lists = 100`
--    when there were zero rows (bad choice for tiny tables) and recreate at
--    a sensible default. PostgreSQL chooses sequential scan when rows < ~1000
--    anyway, so this is a no-op in practice but tidies things up.
DROP INDEX IF EXISTS idx_memory_user_embedding;
CREATE INDEX IF NOT EXISTS idx_memory_embedding_cosine
  ON memory_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
