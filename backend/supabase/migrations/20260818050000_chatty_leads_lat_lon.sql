-- Migration: lat/lon were never added to chatty_leads in production, despite
-- _create_lead (plugins/agent_tools.py) always including them in its insert
-- payload. Every single create_lead call has been failing with PGRST204
-- "column 'lat' not found" — the model still tells visitors their details
-- were recorded (it only sees the tool's error dict, and narrates past it),
-- but no lead has ever actually been saved. Same schema-drift pattern as
-- chatty_conversations.sender and chatty_bots.allowed_domains/logo_url before it.
ALTER TABLE chatty_leads
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision;
