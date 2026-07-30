# Operations runbook

## Health model

- `/api/health`: the process is alive.
- `/api/ready`: the process can query its database.
- `/api/auth/verify`: an authenticated client can cross the security boundary.

Use readiness for traffic routing and liveness for restart policy. A database outage should remove the instance from traffic without causing a blind restart loop.

## Logs and correlation

Application request logs are JSON and include timestamp, level, logger, request ID, method, route, status, and duration. The API returns the correlation value in `X-Request-ID`.

Suggested search sequence for an incident:

1. Capture `X-Request-ID` from the failed response.
2. Search API logs for that value.
3. Inspect status, route, and duration.
4. For imports, correlate the logged `job_id` with `GET /api/jobs/{job_id}` and the latest sync run.

Never log bearer tokens, authorization headers, browser cookies, or raw platform sessions.

## Metrics

The authenticated `/metrics` endpoint exposes:

- `trackforge_http_requests_total` by method, route, and status.
- HTTP request duration histogram by method and route.
- Import job totals by kind and terminal status.

Useful starting alerts:

- Readiness fails for 2 consecutive minutes.
- 5xx rate exceeds 2% over 10 minutes.
- p95 API latency exceeds the measured environment baseline for 10 minutes.
- Import failure count increases or a running job exceeds its expected maximum duration.

Tune alerts after collecting real traffic; personal deployments have bursty, low-volume workloads.

## Import incidents

A queued/running job is persisted. API startup resubmits incomplete jobs. The queue endpoint deduplicates work of the same kind, preventing repeated button clicks from launching concurrent copies.

If a job fails:

1. Read its persisted `error` through the job endpoint.
2. Inspect logs for the same job ID.
3. Check upstream availability and rate limits.
4. Queue a new job after correcting the cause.

Retry policy covers connection errors and HTTP 429/500/502/503/504 with a small exponential delay. Permanent HTTP 4xx errors are not retried.

## Database backup

For the Compose topology:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml \
  exec -T db pg_dump -U trackforge -d trackforge -Fc > trackforge.dump
```

Store backups encrypted outside the host. Periodically restore into a disposable PostgreSQL instance and run `/api/ready`; an untested dump is not a backup strategy.

## Capacity and performance

Use `backend/scripts/load_smoke.py` after deployment and before releases that change queries. It creates a bounded concurrent read workload and fails on errors or a p95 threshold. It is deliberately dependency-free and does not replace sustained load, write-contention, or soak testing.

The current local reference run used Docker Desktop, PostgreSQL, 100 authenticated summary requests, and concurrency 10: zero failures, 205.7 ms mean, 420.6 ms p95.

## Common commands

```bash
# Service status
docker compose -f docker-compose.yml -f docker-compose.production.yml ps

# API logs
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail 200 api

# Migration state
docker compose -f docker-compose.yml -f docker-compose.production.yml exec api alembic current

# Graceful stop; named volumes remain
docker compose -f docker-compose.yml -f docker-compose.production.yml down
```