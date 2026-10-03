# Inbox and contact identity implementation plan

The inbox receives messages from Chatty widgets and integrated channels. It
does not scrape website messages. This change starts with a permission-scoped
visitor context panel using existing conversation/lead records; it requires no
new SQL migration. It is **not** the persistent-contact identity system below.

## Available in this change

`GET /api/admin/inbox/visitor?bot_id=…&session_id=…` requires inbox permission
and the same assigned-session restriction as transcript access. It returns
only that bot/session's contact details, channel, timestamps, and lead location.
Details are labelled self-reported, never verified identity. No unrelated
conversations are joined by a supplied email address. The panel supports
loading, retry, long text, and cancellation when switching conversations.

## Next: persistent contacts

- A contact is distinct from a conversation. Store a bot-scoped contact ID,
  verified external user ID, name/email/phone/avatar, bounded JSON attributes,
  identity provenance, and first/last-seen timestamps.
- Use unique constraints on `(bot_id, external_user_id)` and visitor bindings;
  create/associate contacts atomically to avoid duplicates under concurrent
  requests. Link sessions to contact IDs without rewriting transcript history.
- Anonymous visitors retain a first-party, unpredictable identity credential
  across visits. A visitor ID alone is not permission to read history. Clearing
  browser storage starts a new anonymous identity.
- `Chatty.identify()` accepts a short-lived customer-server-signed token bound
  to the bot, external user, expiry, and trusted attributes. Do not accept a
  browser's user ID/email alone as verified identity or history authorization.
- Anonymous contact capture enriches the existing contact; it does not merge
  unrelated contacts by email. Identification across devices may link only
  after verified identity and an explicitly tested merge policy.
- `Chatty.logout()` removes previous user credentials, rotates anonymous
  identity, clears cached history, and aborts outstanding requests/subscriptions.
- Keep custom attributes size/depth bounded, reject reserved identity/security
  fields, render as text, and expose to AI only through a customer-configured
  allowlist. Never automatically send sensitive profile data to an AI model.
- Inbox profile sidebar shows trust/provenance, contact details, custom
  attributes and authorized previous conversations. An agent cannot use the
  profile panel to bypass their conversation-assignment permissions.

## Acceptance matrix

Anonymous chat without login; returning anonymous visitor; anonymous lead
capture without duplication; verified identification; same user on another
device; expired/wrong-bot/tampered identity tokens; logout/login as another user;
concurrent identification; cross-bot and cross-agent access denial; long/custom
attribute values; mobile conversation switching; offline retry; contact export,
retention and deletion. Tests must cover both website-to-inbox delivery and
human reply-to-widget delivery, plus voice/text channel labelling.

Production readiness also requires schema migration/backfill verification,
customer SDK examples, signed-token setup UI, and staging/browser acceptance.
