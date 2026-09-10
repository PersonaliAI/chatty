-- Microsoft 365 integration: store per-user OAuth tokens for Microsoft Graph
-- (Outlook, OneDrive, ToDo).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS microsoft_email TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_scopes TEXT;

-- drive_documents already exists. Add a `source` column so we can tell
-- which provider a file came from (gdrive vs onedrive).
ALTER TABLE drive_documents
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'gdrive' CHECK (source IN ('gdrive', 'onedrive'));

CREATE INDEX IF NOT EXISTS idx_drive_documents_user_source
  ON drive_documents(user_id, source, indexed_at DESC);
