-- Catalog items are tenant-scoped data. Public widget retrieval goes through
-- the backend/RPC boundary and must not expose the entire table via PostgREST.
DROP POLICY IF EXISTS "Public widget read access to media items"
  ON public.chatty_media_items;

