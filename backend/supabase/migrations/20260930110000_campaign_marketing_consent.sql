-- Provider campaigns may only be expanded from an explicit marketing opt-in.
-- Existing leads remain opted out until consent is recorded through an
-- auditable capture/import workflow.
alter table public.chatty_leads
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

create index if not exists chatty_leads_campaign_consent_idx
  on public.chatty_leads (bot_id, marketing_consent)
  where marketing_consent = true;
