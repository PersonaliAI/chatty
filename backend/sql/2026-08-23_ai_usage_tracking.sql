-- Per-call AI usage/cost log, written by plugins/ai_client.py after every
-- LiteLLM completion/embedding call. Idempotent.

create table if not exists public.chatty_ai_usage (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references public.chatty_bots(id) on delete set null,
  session_id text,
  call_type text not null,          -- 'chat' | 'chat_stream' | 'embedding'
  provider text not null,           -- 'vertex_ai' | 'gemini' | 'openai' | 'anthropic' | 'openrouter'
  model text not null,              -- e.g. 'gemini-2.5-flash', 'claude-3-5-sonnet-latest'
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  cost_usd numeric(12, 8),          -- null when LiteLLM couldn't price the model (e.g. unlisted BYOK model)
  is_byok boolean not null default false,
  success boolean not null default true,
  error text,
  latency_ms int,
  created_at timestamptz default now()
);
create index if not exists idx_chatty_ai_usage_bot on public.chatty_ai_usage(bot_id, created_at desc);
create index if not exists idx_chatty_ai_usage_created on public.chatty_ai_usage(created_at desc);
