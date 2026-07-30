# Vercel production deployment

TrackForge is deployed as two Vercel projects backed by Neon PostgreSQL.

- Dashboard: https://trackforge-dsa-tracker.vercel.app
- API: https://trackforge-api.vercel.app
- API documentation: https://trackforge-api.vercel.app/docs
- Database: Neon Serverless Postgres, Singapore (`sin1`)
- API compute: Vercel Python/FastAPI, Singapore (`sin1`)

## Project layout

Vercel treats `frontend/` and `backend/` as separate projects from the same repository:

| Directory | Vercel project | Framework |
| --- | --- | --- |
| `frontend/` | `trackforge-dsa-tracker` | Vite |
| `backend/` | `trackforge-api` | FastAPI / Python 3.12 |

`frontend/vercel.json` provides the Vite build/output contract and browser security headers. `backend/vercel.json` pins compute beside the database, configures a bounded function duration, and excludes development artifacts.

## Production environment

The API project requires:

- `DATABASE_URL`: injected by the connected Neon Marketplace resource.
- `TRACKER_TOKEN`: sensitive 256-bit application token.
- `ENVIRONMENT=production`.
- `CORS_ORIGINS=https://trackforge-dsa-tracker.vercel.app`.
- `LOG_LEVEL=INFO`.

The dashboard project requires `VITE_API_URL=https://trackforge-api.vercel.app`. Vite embeds this value at build time, so changing it requires a new frontend deployment.

Never commit pulled `.env.local` files. The project and root ignore rules exclude Vercel metadata and local secrets.

## Schema migration

Run migrations before deploying backend code that depends on a new schema:

```powershell
npx vercel env run --cwd backend --environment production -- `
  .\.venv\Scripts\python.exe -m scripts.migrate
```

The Marketplace URL is normalized to SQLAlchemy's Psycopg 3 dialect in both the application and Alembic. Migrations are not automatically executed on every serverless cold start.

## Deployment

```powershell
npx vercel deploy --prod --cwd backend --yes
npx vercel deploy --prod --cwd frontend --yes
```

For Git-based deployments, configure each Vercel project with its matching root directory. Schema-changing releases still require the migration step before promotion.

## Serverless import behavior

A container deployment executes durable imports as background work. On Vercel, the API completes an import within the invoking function before returning the persisted terminal job response. This avoids detached threads being terminated after a serverless response. The function duration is bounded at 300 seconds.

## Live verification baseline

The initial production release completed both catalog imports:

- 2,545 ZeroTrac rating records.
- 4,005 LeetCode catalog records.
- 3,867 records classified with official metadata.
- 71 topic groups visible in the dashboard.

A 50-request authenticated smoke test at concurrency 5 completed with zero failures, 565.6 ms mean, and 1,957.2 ms p95 over the public internet. Live Chromium confirmed a 200 summary response, 4,005 tracked records, seven rendered topic rows, and no application error banner.