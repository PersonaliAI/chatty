-- Chatty self-host compatibility prelude.
--
-- The product schema originated in Supabase and therefore references
-- auth.users, auth.uid(), and auth.jwt() in foreign keys/RLS policies. This
-- tiny, provider-neutral compatibility layer lets the same versioned schema
-- run on stock PostgreSQL. It is not an authentication provider: OIDC is the
-- identity authority and the API inserts/links these rows after validating a
-- token.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- OAuth tables are part of the public API contract.  Keep their definitions
-- in the provider-neutral prelude so a fresh self-host install does not
-- depend on the Supabase-only migration history.
CREATE TABLE IF NOT EXISTS chatty_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  client_name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  registration_access_token_hash TEXT,
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatty_oauth_clients_client_id
  ON chatty_oauth_clients(client_id);

CREATE TABLE IF NOT EXISTS chatty_oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES chatty_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatty_oauth_codes_expires
  ON chatty_oauth_codes(expires_at);

CREATE TABLE IF NOT EXISTS chatty_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES chatty_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chatty_oauth_tokens_access
  ON chatty_oauth_tokens(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_chatty_oauth_tokens_refresh
  ON chatty_oauth_tokens(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_chatty_oauth_tokens_user
  ON chatty_oauth_tokens(user_id);
