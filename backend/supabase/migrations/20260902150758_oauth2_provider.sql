-- OAuth2 authorization server (RFC 6749 authorization-code grant + RFC 7636
-- PKCE + RFC 7591 dynamic client registration), so third-party apps and MCP
-- clients can authenticate as a Chatty user (not tied to one bot, unlike
-- chatty_api_keys) and call the public API / MCP tools with that user's
-- consent. Scopes reuse chatty_api_keys' existing chat|read|write|admin
-- vocabulary for consistency between the two auth models.

create table if not exists chatty_oauth_clients (
    id                  uuid primary key default gen_random_uuid(),
    client_id           text not null unique,
    -- Public clients (desktop/CLI MCP clients using PKCE, e.g. Claude
    -- Desktop) register with no secret — null here, PKCE is mandatory for
    -- them instead. Confidential clients (server-side apps) get a hashed
    -- secret, never stored/returned in plaintext after creation.
    client_secret_hash  text,
    is_confidential     boolean not null default false,
    client_name         text not null,
    redirect_uris       text[] not null,
    -- RFC 7591 registration_client_uri/registration_access_token support —
    -- lets a client that dynamically registered itself later read back its
    -- own registration. Nullable: clients created any other way don't need it.
    registration_access_token_hash text,
    owner_user_id       uuid,  -- null for clients created via open dynamic registration
    created_at          timestamptz not null default now()
);
create index if not exists idx_chatty_oauth_clients_client_id on chatty_oauth_clients(client_id);

-- Short-lived (minutes), single-use authorization codes.
create table if not exists chatty_oauth_codes (
    code                  text primary key,
    client_id             text not null references chatty_oauth_clients(client_id) on delete cascade,
    user_id               uuid not null,
    redirect_uri          text not null,
    scope                 text not null,
    code_challenge         text,
    code_challenge_method  text,
    used                   boolean not null default false,
    expires_at             timestamptz not null,
    created_at             timestamptz not null default now()
);
create index if not exists idx_chatty_oauth_codes_expires on chatty_oauth_codes(expires_at);

-- Access + refresh tokens. Both stored as hashes only (same pattern as
-- chatty_api_keys.key_hash) — the raw token is shown to the client exactly
-- once, at issuance.
create table if not exists chatty_oauth_tokens (
    id                   uuid primary key default gen_random_uuid(),
    access_token_hash    text not null unique,
    refresh_token_hash   text unique,
    client_id            text not null references chatty_oauth_clients(client_id) on delete cascade,
    user_id              uuid not null,
    scope                text not null,
    access_expires_at    timestamptz not null,
    refresh_expires_at   timestamptz,
    revoked              boolean not null default false,
    created_at           timestamptz not null default now(),
    last_used_at         timestamptz
);
create index if not exists idx_chatty_oauth_tokens_access on chatty_oauth_tokens(access_token_hash);
create index if not exists idx_chatty_oauth_tokens_refresh on chatty_oauth_tokens(refresh_token_hash);
create index if not exists idx_chatty_oauth_tokens_user on chatty_oauth_tokens(user_id);
