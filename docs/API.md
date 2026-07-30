# API reference

Interactive OpenAPI documentation is available at `/docs` and the machine-readable schema at `/openapi.json`.

## Authentication

Protected endpoints accept either header:

```http
Authorization: Bearer <TRACKER_TOKEN>
```

or the extension-compatible form:

```http
X-Tracker-Token: <TRACKER_TOKEN>
```

Use HTTPS outside localhost. Never place the token in a query string.

## System endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Process liveness and service timestamp |
| GET | `/api/ready` | No | Database readiness (`SELECT 1`) |
| GET | `/api/auth/verify` | Yes | Validate configured client credentials |
| GET | `/metrics` | Yes | Prometheus exposition format |

Every response includes `X-Request-ID`. An inbound `X-Request-ID` is preserved; otherwise the API generates one.

## Problem endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/summary` | Totals, completion, topic progress, and recently solved problems |
| GET | `/api/problems` | Filtered, paginated problem list |
| GET | `/api/problems/resolve?url=...` | Normalize a platform URL and return tracked state |
| PUT | `/api/problems/{id}/override` | Set or clear manual solved state |
| PUT | `/api/problems/{id}/topics` | Replace custom topic labels |
| POST | `/api/equivalence-groups` | Link cross-platform equivalent problems |
| GET | `/api/recommendations` | Rank unsolved LeetCode problems from solved history |

`GET /api/problems` supports `platform`, `solved`, `topic`, `search`, `min_rating`, `max_rating`, `limit` (1–5000), and `offset`. Filters are applied in SQL before count and pagination.

Example:

```http
GET /api/problems?platform=leetcode&solved=false&topic=Dynamic%20Programming&min_rating=1400&limit=50&offset=0
```

```json
{
  "items": [],
  "count": 0,
  "limit": 50,
  "offset": 0
}
```

## Sync and import endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/sync/{leetcode|gfg}` | Upsert problem observations from the extension |
| GET | `/api/extension/status-map` | Compact solved-state map for page badges |
| GET | `/api/sync-runs` | Latest 20 import/sync audit records |
| POST | `/api/import/zerotrac` | Synchronous compatibility import |
| POST | `/api/import/leetcode-catalog` | Synchronous compatibility import |
| POST | `/api/jobs/import/{zerotrac|leetcode-catalog}` | Queue a durable import; returns 202 |
| GET | `/api/jobs/{job_id}` | Poll persisted import status and result |

New clients should use the durable job routes. If a job of the same kind is already queued or running, the queue endpoint returns it with `deduplicated: true`.

Job states are `queued`, `running`, `succeeded`, and `failed`. A terminal response includes either `result` or `error`.

## Error behavior

FastAPI validation errors return 422. Missing or invalid authentication returns 401. Unknown records return 404. Synchronous upstream import failures return 502. Durable import failures remain queryable as failed job records so clients do not lose the outcome.