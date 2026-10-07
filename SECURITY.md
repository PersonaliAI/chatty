# 🛡️ Security Policy

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, use GitHub's built-in private vulnerability reporting:

1. Go to the [**Security** tab](https://github.com/PersonaliAI/chatty/security) of this repository
2. Click **Report a vulnerability**
3. Fill in the details — the more context, the faster we can triage

### Response Timeline

| Stage | Target |
|-------|--------|
| Initial acknowledgment | **48 hours** |
| Triage and severity assessment | **7 days** |
| Patch development | Depends on severity — critical issues are prioritized immediately |
| Public disclosure | **90 days** after initial report, or sooner if a patch is released |

We follow coordinated disclosure. We will not take legal action against researchers who report vulnerabilities responsibly.

---

## Scope

### In Scope

- **Authentication & authorization** — Supabase Auth integration, JWT verification, RBAC (owner/admin/agent roles)
- **API security** — All FastAPI endpoints under `/api/`
- **Widget origin verification** — JWT-signed widget tokens (`FUNCTION_SECRET`)
- **MCP OAuth 2.0 server** — Authorization code flow with PKCE (RFC 7636), dynamic client registration (RFC 7591), token issuance and verification
- **BYOK encryption** — Fernet AES-128-CBC encryption of customer-supplied LLM API keys at rest
- **Data storage** — Supabase PostgreSQL with Row-Level Security (RLS) policies
- **Webhook signature verification** — HMAC-SHA256 for Lemon Squeezy, WhatsApp Cloud, Slack, and outbound webhooks
- **File upload validation** — Multipart upload sanitization and Supabase Storage access controls
- **Outbound request filtering** — SSRF firewall blocking RFC-1918 / loopback IP ranges for crawlers and webhooks

### Out of Scope

- Third-party managed services (Supabase, LLM providers, Lemon Squeezy) — report to those vendors directly
- Social engineering attacks against project maintainers
- Denial of service (DoS/DDoS)
- Vulnerabilities in dependencies — report upstream; we monitor via Dependabot and `pip-audit`
- Self-hosted deployment misconfigurations (e.g., exposed `.env` files, missing TLS)

---

## Security Architecture

### Authentication & Access Control

- **Supabase Auth** handles user identity with JWT tokens verified server-side via `deps.py`
- **Row-Level Security (RLS)** on all Supabase tables — the `service_role` key is only used server-side, never exposed to clients
- **Role-Based Access Control (RBAC)** with three roles: `owner` (full access), `admin` (configurable tab permissions), `agent` (restricted to live inbox)
- **Widget origin tokens** — cryptographic JWTs signed by `FUNCTION_SECRET` ensure widget embed calls originate from allowed domains

### MCP OAuth 2.0 Server

- **Authorization Code with PKCE** (RFC 7636) — mandatory code verifier/challenge for all MCP client authorization
- **Dynamic Client Registration** (RFC 7591) — MCP clients self-register without pre-shared secrets
- **Authorization Server Metadata** (RFC 8414) — auto-discoverable at `/.well-known/oauth-authorization-server`
- **Scoped access tokens** — `read`, `write`, `knowledge`, `actions`, `admin`

### Encryption

- **BYOK keys at rest** — customer-supplied LLM API keys are encrypted with **Fernet (AES-128-CBC)** using `BYOK_ENCRYPTION_KEY` before storage; decrypted only at inference time in memory
- **OAuth state tokens** — signed JWTs prevent CSRF in OAuth flows
- **Webhook signatures** — all inbound webhooks are verified via HMAC-SHA256 before processing

### Network Security

- **SSRF firewall** (`app/core/ssrf.py`) — blocks outbound HTTP requests to private/reserved IP ranges (10.x, 172.16–31.x, 192.168.x, 127.x, ::1, link-local) for URL crawlers and webhook deliveries
- **Rate limiting** — distributed fixed-window rate limiter via Upstash Redis REST API with automatic in-memory fallback
- **Security headers middleware** — Content-Security-Policy, Strict-Transport-Security (HSTS), X-Content-Type-Options, X-Frame-Options
- **CORS** — strict origin allowlist for dashboard; dynamic origin reflection for widget endpoints only
- **Request ID tracing** — every request gets a unique `X-Request-ID` for audit trail correlation

### Data Protection

- **PII scrubber** (`app/services/pii_service.py`) — redacts credit card numbers, SSNs, and sensitive patterns before LLM inference
- **Conversation data sovereignty** — all data stays in the customer's own Supabase project
- **No telemetry** — self-hosted instances send zero data to PersonaliAI

---

## Credential Management

### Required Secrets

| Secret | Purpose | Rotation Guidance |
|--------|---------|-------------------|
| `SUPABASE_SECRET_KEY` | Server-side Supabase access (bypasses RLS) | Rotate via Supabase dashboard → Settings → API → Regenerate |
| `FUNCTION_SECRET` | Signs widget origin JWTs and OAuth state tokens | Regenerate with `python -c "import secrets; print(secrets.token_urlsafe(32))"` — existing widget tokens will be invalidated |
| `BYOK_ENCRYPTION_KEY` | Encrypts customer BYOK LLM keys at rest | Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` — **rotating this invalidates all stored BYOK keys** |
| `GEMINI_API_KEY` | Default LLM provider | Rotate via [Google AI Studio](https://aistudio.google.com/apikey) |

### Storage Rules

- **Never** commit a filled `.env` file — all `.env` files are gitignored
- Use a secret manager (Vault, AWS Secrets Manager, GCP Secret Manager, Railway/Render built-in secrets) in production
- OAuth client secrets (Google, Microsoft, Zoom) should be rotated annually

---

## Dependency Management

| Tool | What it does | Frequency |
|------|-------------|-----------|
| **Dependabot** (`.github/dependabot.yml`) | Watches pip, npm, Docker, and GitHub Actions dependencies | Weekly |
| **`pip-audit`** | Scans Python dependencies for known CVEs in CI | Every push/PR to `main` |
| **CodeQL** (`.github/workflows/codeql.yml`) | Static analysis for common vulnerability patterns | Every push/PR to `main` |
| **Secret scanning** (`.github/workflows/secret-scan.yml`) | Detects accidentally committed secrets | Every push/PR to `main` |

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `main` branch | ✅ Active security updates |
| Older commits / tags | ❌ No backports — update to latest |

We do not maintain separate release branches. Security fixes are applied to `main` and released immediately.

---

## Disclosure Policy

We follow **coordinated disclosure**:

1. Reporter submits via GitHub's private vulnerability reporting
2. We acknowledge within 48 hours and begin triage
3. We develop and test a fix
4. We release the patch and publish a GitHub Security Advisory
5. The reporter is credited (unless they prefer anonymity)
6. Full details are disclosed **90 days** after the initial report, or immediately upon patch release — whichever comes first

We will never pursue legal action against security researchers acting in good faith.

---

## Security Best Practices for Self-Hosters

- Always deploy behind TLS (HTTPS) — use a reverse proxy like Caddy, nginx, or your platform's built-in TLS
- Set `CHATTY_BACKEND_URL` and `CHATTY_FRONTEND_URL` to your real production domains
- Use the **session pooler** or **direct connection** string for migrations, not the transaction pooler
- Keep your Supabase `service_role` key strictly server-side — never expose it in frontend code or client-side configuration
- Enable Supabase's built-in email confirmation for sign-ups in production
- Review and restrict the `allowed_domains` list for each bot to prevent unauthorized widget embedding
- Monitor `docker compose logs` and Sentry (if configured) for anomalous patterns

---

<div align="center">

Questions about security? [Open a discussion](https://github.com/PersonaliAI/chatty/discussions) (for general questions) or use [private vulnerability reporting](https://github.com/PersonaliAI/chatty/security) (for vulnerabilities).

</div>
