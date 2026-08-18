-- Email follow-ups: Kin currently finds a reply only when explicitly asked
-- ("any replies for that?") — it never proactively tells the user one
-- arrived, and never offers to nudge a contact who's gone quiet. This closes
-- both gaps for Gmail threads Kin itself sent (scope: Gmail only for v1 —
-- Outlook's sendMail doesn't return a conversationId to track, unlike
-- Gmail's threadId).

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_followups_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS kin_email_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    sent_message_id TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    replied_at TIMESTAMPTZ,
    reply_notified_at TIMESTAMPTZ,
    nudge_prompted_at TIMESTAMPTZ,
    nudge_sent_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kin_email_watches_pending
    ON kin_email_watches(user_id, sent_at)
    WHERE replied_at IS NULL AND dismissed = false;

-- Managed entirely by the backend's service-role key (created on send/reply,
-- checked and updated by the /cron/check-email-followups job) — no direct
-- user-facing CRUD, so RLS stays enabled with no policy.
ALTER TABLE kin_email_watches ENABLE ROW LEVEL SECURITY;
