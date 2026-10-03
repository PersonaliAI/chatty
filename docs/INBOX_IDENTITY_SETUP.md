# Secure website contacts and Inbox identity

Contacts are distinct from conversations. Verified contacts are unique per
`(bot_id, external_user_id)`. Matching email addresses never merge customers.

## Website setup

1. As bot owner, open **Inbox → select conversation → Website identity setup**.
   Generate a signing secret and save it in your website server's secret manager
   as `CHATTY_IDENTITY_SECRET`. Never use `NEXT_PUBLIC_*` or browser code for it.
   Closing the setup panel clears the displayed secret.
2. Create an authenticated endpoint on your website server. Read the customer
   from your validated login session, never from browser-supplied identity fields.
3. Return a short-lived HS256 JWT, with `Cache-Control: no-store`:

```python
# PyJWT customer-server example. Use your own authenticated login dependency.
import os, time, jwt

def chatty_identity_token(authenticated_customer, bot_id):
    now = int(time.time())
    return jwt.encode({
        "iss": "chatty-customer", "aud": f"chatty:{bot_id}",
        "sub": str(authenticated_customer.id), "iat": now, "exp": now + 120,
        "profile": {
            "name": authenticated_customer.name,
            "email": authenticated_customer.email,
            "custom_attributes": {"plan": authenticated_customer.plan},
        },
    }, os.environ["CHATTY_IDENTITY_SECRET"], algorithm="HS256")
```

Use the exact secret string as UTF-8 bytes; do not base64-decode it. Protect this
endpoint with your login/CSRF controls. Do not expose a generic signing endpoint.
Token lifetime cannot exceed five minutes.

4. After the widget is ready, fetch the token using your website login session:

```javascript
window.addEventListener("chatty:ready", async () => {
  const response = await fetch("/api/my-chatty-identity", { cache: "no-store" });
  if (!response.ok) return; // anonymous visitors do not need identification
  const { token } = await response.json();
  await window.Chatty.identify(token);
}, { once: true });
```

5. On website logout/account switching call `await window.Chatty.logout()`
   before another customer uses the widget. Local history/composer are cleared,
   pending requests aborted, and this browser's credential family revoked. An
   offline revocation failure rejects the promise while leaving the UI cleared;
   retry online, especially on a shared device. Other logged-in devices remain
   separate. The React SDK `useChatty()` exposes identify/logout too.

For an iframe send messages to the exact iframe origin. The receiver checks
the parent window and exact referrer origin and still verifies the signed token:

```javascript
iframe.contentWindow.postMessage({ type: "chatty:identify", bot_id: BOT_ID, token },
  "https://chatty.personaliai.com");
// Logout: { type: "chatty:logout", bot_id: BOT_ID }
```

## Inbox and history

**Visitor details** shows contact fields, provenance, external user ID, scalar
custom attributes and authorized conversation history with Voice/Text labels.
Website-server verification verifies the user-ID assertion, not independent
ownership of an email/phone. Agents see only history assigned to them; owner/admin
inbox authorization still applies. Attributes render as text, never HTML, and
are **not sent to AI models**. No implicit profile-to-model sharing is enabled.

Anonymous forms enrich their anonymous contact without email merging.
Identification starts a fresh conversation and never silently transfers anonymous
transcripts. Verified customers on another device share their contact only after
valid identification. Clearing browser storage starts a new anonymous identity.
Legacy sessions are never adopted just by knowing an ID.

## Security contract

- Wrong bot/audience/issuer, expired/tampered tokens and unsigned claims fail.
- Signing secrets are encrypted at rest. RLS and revoked `anon`/`authenticated`
  grants keep contact/identity tables backend-only. Visitor capabilities are
  stored only as hashes in the database, not as plaintext.
- The first-party browser persists a high-entropy capability, not a signing
  secret or customer JWT. This bearer credential is not an HttpOnly cookie:
  protect the host website from XSS with CSP and trusted scripts/dependencies.
- Anonymous capabilities expire in 30 days; verified ones in 24 hours. Identify
  again with a fresh customer-server token after expiry. Customer JWTs expire
  within five minutes and are never persisted.
- Logout revokes all credentials from that browser family. SSE checks revocation
  during delivery. Another tab changing identity clears its widget and requires
  reload instead of silently following another account.
- Signing-key rotation atomically revokes this bot's existing visitor credentials.
  Update the website server secret and reload its widgets after rotation.
- Attributes: at most 30 scalar keys, 500 characters per value and 8 KiB total.
  Nested values/reserved security fields are rejected. HTTPS avatar URLs are
  profile data only; the backend does not fetch them.
- Legacy transcripts remain available to authorized Inbox staff. Legacy public
  polling/live/active-booking reads require an upgraded capability-backed widget.
  Reload old cached clients after rollout.

## Deployment

Apply `backend/supabase/migrations/20261003140000_inbox_contact_identity.sql`
before deploying backend/frontend. This narrow helper avoids unrelated pending
migrations; use secure environment values, never commit database credentials:

```powershell
$env:SUPABASE_DB_HOST = "YOUR_DIRECT_OR_SESSION_POOLER_HOST"
$env:SUPABASE_DB_USER = "YOUR_DATABASE_USER"
$env:SUPABASE_DB_PASSWORD = "YOUR_DATABASE_PASSWORD"
py backend/scripts/apply_contact_identity_migration.py
py backend/scripts/check_contact_identity.py
Remove-Item Env:SUPABASE_DB_PASSWORD
```

The acceptance helper uses rollback-only fixtures. Do not use transaction-pooler
mode for DDL. Preserve backend `BYOK_ENCRYPTION_KEY`; losing it requires owner
signing-key rotation. No frontend secret is required.

Deploy API, rebuild the standalone bundle (`npm run build` under
`frontend/packages/chatty-react`), then deploy frontend. Keep the previous API
revision/frontend rollout for rollback. The additive schema can remain on
rollback; do not drop tables and erase customer data.

## Privacy operations

Owner-only `GET /api/admin/inbox/contacts/export?bot_id=…` exports contact profiles
without signing secrets/capabilities. The export currently caps at 50,000 contacts.
Owner-only `DELETE /api/admin/inbox/contacts/{contact_id}?bot_id=…` transactionally
erases that exact contact, bound conversation messages/leads/sessions and its
capabilities. Confirm the exact contact before deletion. It does not cancel
bookings or erase independent integration records; apply their retention rules
separately. No automatic retention duration is assumed.

## Tests

Backend: `pytest tests/test_contact_identity.py tests/test_admin.py tests/test_widget_live.py`.
Client: `npm run test:visitor-identity`. Database: `check_contact_identity.py`.
These cover invalid signatures/claims, profile bounds, hashed credential storage,
expired/revoked capabilities, cross-contact/cross-bot denial, agent authorization,
account-switch cancellation, cache clearing, logout rotation and external-origin
credential exclusion. Database acceptance checks deduplication and direct-read
denial; it rolls back all fixtures.

Live API acceptance: `py backend/scripts/check_contact_identity_http.py` uses
the database environment plus `BYOK_ENCRYPTION_KEY`. It creates and removes an
isolated temporary bot/passwordless owner; it does not modify customer plan
limits or send AI requests/emails.

## Verified rollout — 2026-10-03

- Source: `c62b34b5` (identity implementation `0a9046b6`).
- API: `chatty-api-00166-nlw`, 100% traffic; `/ready` returned 200 and anonymous
  identity-settings access returned 401. Previous revision: `chatty-api-00165-9g2`.
- Firebase explicit rollout `build-2026-10-03-023` succeeded; live `widget.js` serves
  `2026-10-03.identity-1` with identify/logout APIs. Previous frontend rollout:
  `rollout-2026-10-03-018`.
- CI frontend/backend, CodeQL, secret scan and managed-Supabase smoke passed.
- Live acceptance passed signed identity, cross-device contact deduplication and
  history, human-reply delivery, cross-bot/contact denial, account-switch
  revocation and browser-family logout. Temporary fixtures were removed.
- Local focused backend tests (55), identity client tests (5), mobile browser
  isolation test and production frontend build passed. Database RLS/read-denial
  and deduplication checks passed; migration was applied before deployment.

Rollback API traffic only if needed:

```powershell
gcloud run services update-traffic chatty-api --project personaliai --region us-central1 --to-revisions chatty-api-00165-9g2=100
```

Restore the previous frontend rollout using Firebase App Hosting's rollback
control. Keep the additive identity schema and encryption key. An old API lacks
the new identity protection: suspend signed identification during a rollback,
rather than treating legacy sessions as authenticated users.

This verifies the identity feature, not a security certification of the entire
platform. Existing frontend development-tool dependency advisories remain a
separate remediation item. A customer website must still connect its trusted
server-side login endpoint using the setup above.
