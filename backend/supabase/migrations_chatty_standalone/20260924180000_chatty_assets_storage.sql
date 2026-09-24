-- Managed storage contract for the standalone schema as well. The backend
-- uploads with its server-only key; the public bucket only controls reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chatty_assets',
  'chatty_assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
