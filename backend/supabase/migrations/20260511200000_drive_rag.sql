-- Drive/Docs/Sheets/Slides RAG: index Google Drive files into pgvector so the
-- agent can answer questions grounded in the user's documents.

-- 1. Per-file metadata (one row per indexed Drive file).
CREATE TABLE IF NOT EXISTS drive_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  web_view_link TEXT,
  parent_folder_id TEXT,
  size_bytes BIGINT,
  modified_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  chunk_count INT DEFAULT 0,
  status TEXT DEFAULT 'indexed' CHECK (status IN ('indexed', 'failed', 'pending')),
  error TEXT,
  UNIQUE(user_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_documents_user ON drive_documents(user_id, indexed_at DESC);

-- 2. Per-chunk content + embedding.
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES drive_documents(id) ON DELETE CASCADE NOT NULL,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_user_doc ON document_chunks(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_cosine
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 3. RLS
ALTER TABLE drive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drive_documents_select_own" ON drive_documents;
CREATE POLICY "drive_documents_select_own" ON drive_documents
  FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "drive_documents_delete_own" ON drive_documents;
CREATE POLICY "drive_documents_delete_own" ON drive_documents
  FOR DELETE USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "document_chunks_select_own" ON document_chunks;
CREATE POLICY "document_chunks_select_own" ON document_chunks
  FOR SELECT USING (user_id = public.current_user_id());

-- 4. Cosine-similarity search (RPC the backend calls).
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float DEFAULT 0.40,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  drive_file_id text,
  file_name text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.drive_file_id,
    c.file_name,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM document_chunks c
  WHERE c.user_id = match_user_id
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
