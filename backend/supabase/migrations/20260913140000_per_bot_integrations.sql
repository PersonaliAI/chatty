-- Migration: Per-bot Google/Microsoft calendar & Drive isolation
-- Allows bots within the same account to target specific secondary calendars,
-- bind to dedicated connected accounts, and strictly scope Drive RAG to folder IDs.

ALTER TABLE public.chatty_bots 
  ADD COLUMN IF NOT EXISTS google_connected_account_id UUID REFERENCES public.kin_connected_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.chatty_bots 
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT NOT NULL DEFAULT 'primary';

ALTER TABLE public.chatty_bots 
  ADD COLUMN IF NOT EXISTS google_calendar_name TEXT;

ALTER TABLE public.chatty_bots 
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

ALTER TABLE public.chatty_bots 
  ADD COLUMN IF NOT EXISTS google_drive_folder_name TEXT;

ALTER TABLE public.chatty_sources 
  ADD COLUMN IF NOT EXISTS folder_id TEXT;

CREATE INDEX IF NOT EXISTS idx_drive_documents_parent_folder ON public.drive_documents(user_id, parent_folder_id);

-- Updated match_document_chunks with optional match_folder_id scoping
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float DEFAULT 0.40,
  match_count int DEFAULT 8,
  match_folder_id text DEFAULT NULL
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
  JOIN drive_documents d ON d.id = c.document_id
  WHERE c.user_id = match_user_id
    AND (match_folder_id IS NULL OR d.parent_folder_id = match_folder_id)
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

