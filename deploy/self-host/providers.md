# Provider mappings

The Compose file is the normative contract. Hosted platforms only change how
the same services are provisioned:

| Platform | App services | Managed dependencies |
| --- | --- | --- |
| Coolify | Import `docker-compose.selfhost.yml` | Add PostgreSQL, Redis, and S3-compatible storage as resources |
| Railway | Deploy backend and frontend from the two Dockerfiles | Attach PostgreSQL and Redis plugins; use an S3-compatible bucket |
| Render | Create two Docker services | Use Render PostgreSQL/Redis and an external S3-compatible bucket |
| DigitalOcean App Platform | Create frontend/backend components | Use a managed PostgreSQL cluster, Redis, and Spaces |
| Kubernetes | Convert the Compose services to Deployments/StatefulSets | Use managed or operator-backed PostgreSQL/Redis/object storage |
| Heroku-compatible | Deploy the backend/frontend containers | Bind Postgres and Redis add-ons; configure S3 variables |

Required application URLs and secrets are documented in the root `.env.example`
and `backend/.env.example`. Keep secrets in the platform secret manager; never
commit a production `.env` file.
