# Chatty managed-Supabase self-hosting runbook

This is the production deployment guide for running Chatty's application
containers on your own host while keeping Supabase Auth, Postgres, Storage,
Realtime, pgvector, and row-level security managed by Supabase.

The supported shape is deliberately small:

~~~
public HTTPS frontend (Next.js)  ─────┐
                                      ├── managed Supabase project
public HTTPS API (FastAPI) ───────────┘
~~~

The same two images run on Docker/VPS, Railway, Render, and Heroku-style
container platforms. The provider-neutral self_host profile is a different,
advanced deployment and is not part of this runbook.

## 0. Before you deploy

You need:

1. A Supabase project and its database password.
2. A GitHub checkout of this repository.
3. A domain (recommended for production) or the platform's temporary domains.
4. A Gemini key, or another LLM/BYOK configuration.
5. One public URL for the frontend and one public URL for the API.

Use the Supabase **publishable** key only in the browser and the Supabase
**secret** key only on the API. Supabase documents this split explicitly: a
publishable key is safe to ship because RLS still applies, while a secret key
bypasses RLS and must remain server-only ([Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)).

Do not commit any .env file, platform export, token, webhook secret, or
database password. The repository's .env.example files contain names and
placeholders only.

## 1. Create the managed Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Choose a region close to the API deployment and record the database
   password in a password manager.
3. In **Project Settings → API**, copy:
   - Project URL into SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL.
   - Publishable key into NEXT_PUBLIC_SUPABASE_ANON_KEY (the legacy anon key
     is also accepted by older projects).
   - Secret key into SUPABASE_SECRET_KEY (the legacy service_role key is
     accepted only when a project has not migrated to the new key names).
4. In **Project Settings → Database → Connection string**, copy the direct or
   session-pooler connection details. The migration script needs a connection
   that supports DDL; do not use the transaction pooler for migrations. See
   [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
5. In **Authentication → URL Configuration**, add the final frontend HTTPS URL
   as Site URL and add its OAuth callback URLs under Redirect URLs.
6. Create the Chatty schema before the first production request:

~~~powershell
git clone https://github.com/PersonaliAI/chatty.git
cd chatty
cd backend
python -m pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:DB_PASSWORD@DB_HOST:5432/postgres"
cd ..
~~~

Keep the connection string out of shell history where possible. Use the
platform's secret input or a temporary local environment variable.

## 2. Generate secrets and configure the contract

Generate unique values per environment. Never reuse production secrets in a
preview or local project.

~~~powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"  # FUNCTION_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # BYOK_ENCRYPTION_KEY
~~~

Backend variables:

| Variable | Value | Where it may exist |
|---|---|---|
| DEPLOYMENT_PROFILE | managed_supabase | API only |
| SUPABASE_URL | project URL | API only |
| SUPABASE_SECRET_KEY | server-only secret key | API only |
| SUPABASE_DB_HOST | direct/session database host | API only |
| SUPABASE_DB_PASSWORD | database password | API only |
| FUNCTION_SECRET | generated random secret | API only |
| BYOK_ENCRYPTION_KEY | generated Fernet key | API only |
| GEMINI_API_KEY | Google AI Studio key | API only |
| ALLOWED_ORIGINS | frontend HTTPS origin(s) | API only |
| FRONTEND_URL | frontend HTTPS origin | API only |
| CHATTY_FRONTEND_URL | frontend HTTPS origin | API only |
| CHATTY_BACKEND_URL | API HTTPS origin | API only |
| PORT | platform-provided value | API runtime |

Frontend variables:

| Variable | Value | Where it may exist |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | project URL | frontend build/runtime |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | publishable key | frontend build/runtime |
| NEXT_PUBLIC_BACKEND_URL | API HTTPS origin | frontend build/runtime |
| NEXT_PUBLIC_DEPLOYMENT_PROFILE | managed_supabase | frontend build/runtime |
| NEXT_PUBLIC_LEMON_PORTAL_URL | optional billing portal | frontend build/runtime |

Copy the complete optional feature list from
[backend/.env.example](../backend/.env.example) and
[frontend/.env.example](../frontend/.env.example). WhatsApp, Slack, Google,
Microsoft, Zoom, LiveKit, billing, Sentry, and web crawling remain opt-in;
blank values disable only that feature.

## 3. Local smoke test (required before a hosted deploy)

Create backend/.env and frontend/.env from the examples and fill the
variables above. Then run:

~~~powershell
docker compose up --build -d backend frontend
docker compose ps
curl http://localhost:8000/readyz
~~~

The API must return a ready response before you open the frontend at
http://localhost:3000. Test sign-up, create a bot, add a small knowledge
source, send a widget message, and confirm the API URL is your own backend URL.

Stop the local stack with docker compose down. The default compose file does
not create a second Postgres, Redis, or object store; it connects to managed
Supabase.

## 4. Docker Compose on a VPS

1. Provision a Linux host with Docker Engine, the Compose plugin, a firewall,
   automatic security updates, and a non-root deployment user.
2. Clone the repository under that user's home directory.
3. Create backend/.env, frontend/.env, and root .env from the examples. Use a
   secret manager or root-readable files with restrictive permissions:

~~~bash
chmod 600 backend/.env frontend/.env .env
~~~

4. Run the migration once from a controlled shell, then start only the two
   application services:

~~~bash
docker compose up --build -d backend frontend
docker compose ps
curl http://127.0.0.1:8000/readyz
~~~

5. Put Caddy, nginx, or Traefik in front of the containers. Terminate TLS at
   the proxy, route app.example.com to port 3000, and route api.example.com to
   port 8000. Do not expose API secret variables or the database port.
6. Set final URLs in ALLOWED_ORIGINS, FRONTEND_URL, CHATTY_FRONTEND_URL,
   CHATTY_BACKEND_URL, and NEXT_PUBLIC_BACKEND_URL, then recreate services.
7. Configure a process monitor, centralise container logs, and monitor
   /readyz. Supabase remains responsible for database backups and storage
   durability; do not add local database volumes to this managed profile.

## 5. Railway (two services from one repository)

Railway does not run the root Compose file as one application. Its official
model maps each Compose service to a separate Railway service, with Dockerfile
paths and variables configured per service ([Railway Compose deployment](https://docs.railway.com/guides/docker-compose)).

### API service

1. Create a Railway project and choose **Empty project**.
2. Add a service from the GitHub repository and select the main branch.
3. Set **Root Directory** to backend and Dockerfile path to Dockerfile.
   Railway also supports RAILWAY_DOCKERFILE_PATH when the path must be
   configured as a variable ([Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)).
4. Add the backend variables from Section 2 in **Variables → Raw Editor**.
5. Do not hard-code a public port. The API listens on Railway's injected PORT;
   configure healthcheck path /readyz. Railway waits for a 2xx response before
   switching a deployment live ([Railway healthchecks](https://docs.railway.com/deployments/healthchecks)).
6. Generate a public domain or attach api.example.com. Copy that HTTPS URL
   into CHATTY_BACKEND_URL and ALLOWED_ORIGINS as appropriate.

### Frontend service

1. Add a second service from the same repository and branch.
2. Set Root Directory to frontend and Dockerfile path to Dockerfile.
3. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   NEXT_PUBLIC_BACKEND_URL, and optional public billing variables. Next.js
   public variables are build-time values, so changing one triggers a rebuild
   ([Railway frontend variables](https://docs.railway.com/guides/frontend-environment-variables)).
4. Generate a public domain or attach app.example.com.
5. Update the API service's CHATTY_FRONTEND_URL, FRONTEND_URL, and
   ALLOWED_ORIGINS to the final frontend origin, then redeploy both services.

### Verify and operate

Open the frontend URL, sign in, create a bot, send a test message, and check
the API deployment logs. Railway provides private networking, but the public
frontend should call the public API URL unless you deliberately design an
internal proxy. Add custom domains and DNS records in Networking
([Railway domains](https://docs.railway.com/networking/domains/railway-domains)).

## 6. Render (Blueprint or two manual Docker services)

The repository includes [render.yaml](../render.yaml). Render Blueprints
support Docker services, health checks, and sync: false prompts for secrets
([Blueprint reference](https://render.com/docs/blueprint-spec)).

### Blueprint path (recommended)

1. In Render, choose **New → Blueprint** and connect the GitHub repository.
2. Select the main branch. Render detects the root render.yaml and proposes
   chatty-api and chatty-frontend.
3. When prompted, enter backend secrets and URLs. Never put secret values in
   YAML; Render's sync: false values are intentionally requested in the
   dashboard ([Render Infrastructure as Code](https://render.com/docs/infrastructure-as-code)).
4. Set frontend NEXT_PUBLIC_* values.
5. Apply the Blueprint and wait for chatty-api to pass /readyz. Render HTTP
   health checks accept 2xx/3xx responses and prevent traffic from moving to an
   unhealthy new deploy ([Render health checks](https://render.com/docs/health-checks)).
6. Attach api.example.com to the API and app.example.com to the frontend, or
   use the generated onrender.com URLs while testing.
7. Put final domains into CHATTY_BACKEND_URL, CHATTY_FRONTEND_URL, FRONTEND_URL,
   and ALLOWED_ORIGINS, then trigger a new deploy.

### Manual Docker path

If your Render workspace does not allow Blueprints, create two Web Services
from the same repository:

1. API: runtime Docker, root directory backend, Dockerfile ./Dockerfile,
   health check /readyz, backend variables from Section 2.
2. Frontend: runtime Docker, root directory frontend, Dockerfile ./Dockerfile,
   public NEXT_PUBLIC_* variables.
3. Add domains, update CORS and callback URLs, deploy, and run the verification
   checklist below. Render translates Docker service variables into build
   arguments, so never put passwords or API keys in Docker build arguments or
   image layers ([Render Docker services](https://render.com/docs/docker)).

## 7. Heroku-style container platforms

Heroku's container runtime is app-per-web-process. Deploy the API and frontend
as two separate apps; keep Supabase external. Heroku's official flow is login,
push the web image, release it, and use config vars for credentials
([Container Registry & Runtime](https://devcenter.heroku.com/articles/container-registry-and-runtime)).

### API app

~~~bash
heroku login
heroku container:login
heroku create chatty-api --stack container
heroku config:set DEPLOYMENT_PROFILE=managed_supabase \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SECRET_KEY="..." \
  SUPABASE_DB_HOST="..." SUPABASE_DB_PASSWORD="..." \
  FUNCTION_SECRET="..." BYOK_ENCRYPTION_KEY="..." \
  GEMINI_API_KEY="..." ALLOWED_ORIGINS="https://app.example.com" \
  FRONTEND_URL="https://app.example.com" \
  CHATTY_FRONTEND_URL="https://app.example.com" \
  CHATTY_BACKEND_URL="https://api.example.com"
cd backend
heroku container:push web --app chatty-api
heroku container:release web --app chatty-api
cd ..
~~~

Heroku supplies PORT; do not depend on fixed 8000 in production. Add
api.example.com with heroku domains:add and complete the DNS step
([Heroku custom domains](https://devcenter.heroku.com/articles/custom-domains)).

### Frontend app

~~~bash
heroku create chatty-frontend --stack container
heroku config:set NODE_ENV=production \
  NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..." \
  NEXT_PUBLIC_BACKEND_URL="https://api.example.com" \
  NEXT_PUBLIC_DEPLOYMENT_PROFILE=managed_supabase \
  NEXT_PUBLIC_LEMON_PORTAL_URL="..." \
  --app chatty-frontend
cd frontend
heroku container:push web --app chatty-frontend
heroku container:release web --app chatty-frontend
cd ..
heroku domains:add app.example.com --app chatty-frontend
~~~

Use heroku logs --tail to diagnose startup failures. Heroku's container
filesystem is ephemeral and its runtime does not provide Compose networking, so
this profile must not expect local Postgres, Redis, or storage volumes. Use
Supabase and external managed integrations instead.

## 8. Production verification checklist

Run this checklist after every first deploy and after a domain or secret change:

1. GET https://api.example.com/readyz returns HTTP 200 and status=ready.
2. The frontend loads over HTTPS with no mixed-content errors.
3. Sign-up, sign-in, sign-out, and password reset work through Supabase Auth.
4. A new bot can be created and a knowledge source can be uploaded.
5. A widget message receives an answer from the configured LLM.
6. Browser requests use only the publishable Supabase key; inspect the bundle
   and network panel to ensure SUPABASE_SECRET_KEY never appears.
7. OAuth callback URLs, WhatsApp webhook URL, and Slack request URL use the API
   domain and the platform reports successful health checks.
8. Logs contain no access tokens, database passwords, or raw BYOK secrets.
9. Enable backups, alerts, and log retention in the platform and Supabase.

## 9. Updates, rollback, and incident response

Deploy an immutable Git commit, not an uncommitted working tree. Apply new
Supabase migrations before or during a controlled rollout, then deploy the API
and frontend. If a release is unhealthy, use the platform's previous healthy
deployment rollback; do not reset or alter the live Supabase database to make a
container release pass.

Rotate SUPABASE_SECRET_KEY, FUNCTION_SECRET, BYOK_ENCRYPTION_KEY, OAuth
secrets, and channel tokens through the platform secret manager. A BYOK key
rotation requires a planned re-encryption/migration; keep the old key available
only for the documented rotation window. Revoke leaked tokens immediately and
review Supabase Auth, API, and platform audit logs.

## 10. Common failures

| Symptom | Check |
|---|---|
| API exits during startup | SUPABASE_URL and SUPABASE_SECRET_KEY are missing or still placeholders. |
| /readyz fails on a hosted platform | The process is not listening on injected PORT, or Supabase is unreachable. |
| Browser shows CORS errors | ALLOWED_ORIGINS must contain the exact HTTPS frontend origin, without a trailing path. |
| Login redirects to the old site | Update Supabase Auth redirect URLs and CHATTY_FRONTEND_URL. |
| Widget calls the old API | Rebuild the frontend after changing NEXT_PUBLIC_BACKEND_URL; it is a Next.js build-time value. |
| Migration cannot connect | Use the Supabase direct/session connection, not the transaction pooler. |
| Heroku deploy starts then exits | The image must use platform PORT; Heroku does not support Compose networking or persistent volumes. |
| Render deploy never becomes live | Confirm the Dockerfile has a CMD and /readyz returns 2xx within the health-check timeout. |
| Railway deploy is healthy but browser fails | Railway services are separate; generate a public domain for both and update CORS and frontend build variables. |

For the lower-level variable list, see [backend/.env.example](../backend/.env.example).

