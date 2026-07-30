# Deployment guide

The supported production topology is the base Compose file plus the PostgreSQL overlay. It is portable to a single VM or container host and keeps application secrets out of images.

## Prerequisites

- A Linux host with Docker Engine and Compose v2.
- A DNS record for the chosen domain.
- TLS termination through the cloud load balancer or an ingress/reverse proxy.
- A backup destination for the PostgreSQL volume.

## 1. Configure secrets

Copy `.env.example` to `.env` on the host. Generate independent high-entropy values:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Use one as `TRACKER_TOKEN` and one as `POSTGRES_PASSWORD`. Set:

```dotenv
TRACKER_TOKEN=<at-least-32-characters>
POSTGRES_PASSWORD=<strong-database-password>
CORS_ORIGINS=https://tracker.example.com
VITE_API_URL=https://api.tracker.example.com
ENVIRONMENT=production
LOG_LEVEL=INFO
```

`TRACKER_TOKEN` and wildcard CORS fail validation in production when unsafe. `VITE_API_URL` is compiled into the frontend image, so rebuild the web image when it changes.

## 2. Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

The API entrypoint runs Alembic before Uvicorn. The web service waits for the API readiness probe. Both application images run without root privileges.

## 3. Terminate TLS

Expose the frontend and API through HTTPS. Route the dashboard origin to web port 5173 and the API origin to port 8000. Limit direct host access to these container ports with the host firewall; PostgreSQL is not published by Compose.

Do not terminate public traffic directly on Uvicorn or expose `/metrics` without authentication. If a single-domain reverse proxy maps `/api` to the backend, build the frontend with that public API base and keep the matching origin in `CORS_ORIGINS`.

## 4. Verify

```bash
curl --fail https://api.tracker.example.com/api/health
curl --fail https://api.tracker.example.com/api/ready
curl --fail -H "Authorization: Bearer $TRACKER_TOKEN" \
  https://api.tracker.example.com/api/auth/verify
curl --fail -H "Authorization: Bearer $TRACKER_TOKEN" \
  https://api.tracker.example.com/metrics
```

Run the bounded smoke test from a machine near the deployment:

```bash
python backend/scripts/load_smoke.py \
  --base-url https://api.tracker.example.com \
  --token "$TRACKER_TOKEN" \
  --requests 200 --concurrency 20 --max-p95-ms 750
```

Choose the latency threshold from the host and network baseline; the default is a smoke guard, not an SLO.

## 5. Back up and update

Back up PostgreSQL before updates. Pull or copy the new source, rebuild images, and rerun `up -d`. Migrations are forward-only and execute before new application traffic reaches a healthy container.

A public URL is intentionally not committed to this repository. Publishing requires the owner's cloud account, domain, and secret-management target; the repository contains the repeatable deployment artifact and verification procedure without pretending credentials are portable.

## Rollback

Application rollback is an image rollback. Database rollback is restore-first: take a backup before schema-changing releases, deploy the prior image, and restore the matching database backup if a migration is incompatible. Avoid automatically running Alembic downgrades on production data.