-- Catalog retrieval is backend-mediated and tenant-scoped. Remove the legacy
-- anonymous SELECT policy that exposed every bot's media rows to the public.

DROP POLICY IF EXISTS "Public widget read access to media items"
  ON public.chatty_media_items;
