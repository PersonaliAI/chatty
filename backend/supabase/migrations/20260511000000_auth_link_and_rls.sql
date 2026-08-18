-- Link existing users table to Supabase auth + add web/telegram source separation + RLS

-- 1. Loosen telegram_id (now optional — users can sign up via web before linking Telegram)
ALTER TABLE users
  ALTER COLUMN telegram_id DROP NOT NULL;

-- 2. Auth linkage column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS system_prompt TEXT;

CREATE INDEX IF NOT EXISTS idx_users_auth ON users(auth_user_id);

-- 3. Messages: distinguish surface (web vs telegram) + session grouping + assistant tool trace
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web' CHECK (source IN ('web', 'telegram', 'cron')),
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_user_source_created
  ON messages(user_id, source, created_at DESC);

-- 4. Auto-provision public.users row when a new auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. Row-level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;

-- Helper: current public.users.id for the JWT-authenticated user
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
$$;

-- users
DROP POLICY IF EXISTS "users_select_self" ON users;
CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_self" ON users;
CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (user_id = public.current_user_id());

-- tasks
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (user_id = public.current_user_id());

-- contacts
DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
CREATE POLICY "contacts_select_own" ON contacts
  FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
CREATE POLICY "contacts_insert_own" ON contacts
  FOR INSERT WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
CREATE POLICY "contacts_update_own" ON contacts
  FOR UPDATE USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
CREATE POLICY "contacts_delete_own" ON contacts
  FOR DELETE USING (user_id = public.current_user_id());

-- memory_embeddings (read-only for client; backend writes via service role)
DROP POLICY IF EXISTS "memory_select_own" ON memory_embeddings;
CREATE POLICY "memory_select_own" ON memory_embeddings
  FOR SELECT USING (user_id = public.current_user_id());

-- 6. Backfill: ensure every existing auth user has a public.users row
INSERT INTO public.users (auth_user_id, email, display_name, avatar_url)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data ->> 'avatar_url'
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id
WHERE pu.id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;
