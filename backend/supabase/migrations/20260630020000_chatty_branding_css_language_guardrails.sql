-- White-label: hide the "Powered by Chatty" footer mark in the widget.
alter table chatty_bots add column if not exists hide_branding boolean default false;

-- Customizer: raw CSS/JS injected into the embed widget for advanced theming.
alter table chatty_bots add column if not exists custom_css text;
alter table chatty_bots add column if not exists custom_js text;

-- Force the assistant to always reply in a specific language instead of
-- mirroring the visitor (empty/null = mirror visitor's language, current default).
alter table chatty_bots add column if not exists response_language text;

-- Guardrails: dedicated, structured safety controls (separate from the free-text
-- system_instructions field).
alter table chatty_bots add column if not exists guardrail_topics text;
alter table chatty_bots add column if not exists guardrail_block_profanity boolean default false;
alter table chatty_bots add column if not exists guardrail_refusal_message text;
