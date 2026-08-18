-- BYOK (bring your own key): lets a bot use the owner's own OpenAI/Anthropic/OpenRouter
-- key instead of Chatty's shared Gemini key. byok_api_key_encrypted is Fernet-encrypted
-- (see kin-backend/llm_providers.py), never stored in plaintext.
alter table chatty_bots add column if not exists byok_provider text;
alter table chatty_bots add column if not exists byok_api_key_encrypted text;
alter table chatty_bots add column if not exists byok_model text;
