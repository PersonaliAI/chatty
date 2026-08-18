-- Recurring auto re-index for the last-indexed Google Drive / OneDrive folder.
-- Lives on `users` (not chatty_bots) because Drive/OneDrive indexing is
-- account-scoped: any bot with sync_google_drive/sync_outlook_calendar enabled
-- searches the same per-user document index (see doc_rag.search keyed by user_id).
alter table users add column if not exists drive_folder_id text;
alter table users add column if not exists drive_max_files integer default 50;
alter table users add column if not exists drive_sync_schedule text default 'off';
alter table users add column if not exists drive_next_sync_at timestamptz;

alter table users add column if not exists onedrive_folder_id text;
alter table users add column if not exists onedrive_max_files integer default 50;
alter table users add column if not exists onedrive_sync_schedule text default 'off';
alter table users add column if not exists onedrive_next_sync_at timestamptz;
