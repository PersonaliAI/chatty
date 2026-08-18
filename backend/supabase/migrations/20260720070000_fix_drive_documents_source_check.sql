-- Bug found 2026-07-20: drive_documents.source only allowed ('gdrive',
-- 'onedrive') from the original Drive/OneDrive-sync feature. When direct
-- file-upload indexing was added later (doc_rag.index_blob, used by both
-- POST /api/documents/upload — the web chat paperclip — and Telegram
-- document attachments), it passes source='upload' or 'telegram-upload',
-- neither of which satisfied this constraint. Every direct upload has been
-- failing with a 23514 check-constraint violation since that feature
-- shipped (reported: a Telegram PDF upload failing with "Failed to index
-- that file").
ALTER TABLE drive_documents DROP CONSTRAINT IF EXISTS drive_documents_source_check;
ALTER TABLE drive_documents ADD CONSTRAINT drive_documents_source_check
  CHECK (source IN ('gdrive', 'onedrive', 'upload', 'telegram-upload'));
