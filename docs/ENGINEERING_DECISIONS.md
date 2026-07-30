# Engineering decisions and trade-offs

This document records decisions that are easy to miss in a code-only review.

## ADR-001: Single-user token boundary

**Decision:** Keep one high-entropy bearer token for the self-hosted deployment.

**Why:** The product is a personal tracker. OAuth, user tables, refresh-token rotation, password recovery, and tenant isolation would increase the attack surface without serving the current scope.

**Controls:** production requires at least 32 characters, wildcard CORS is rejected, clients verify the token explicitly, the dashboard uses session storage, the extension uses session storage, and HTTPS is required outside localhost.

**Limit:** This is not sufficient for multi-user SaaS. That version must introduce identity, per-resource authorization, tenancy constraints, audit events, rate limits, and secret rotation.

## ADR-002: SQLAlchemy with SQLite locally and PostgreSQL in production

**Decision:** Preserve a zero-setup SQLite developer path while validating production against PostgreSQL.

**Why:** Contributors can start quickly, while production receives stronger concurrency and operational tooling. SQLAlchemy and Alembic keep application code and schema history portable.

**Trade-off:** SQLite cannot reproduce every PostgreSQL behavior. CI therefore starts PostgreSQL and runs the integration path in addition to isolated tests.

## ADR-003: Durable records with an in-process executor

**Decision:** Persist import jobs, then execute them in the API process for the single-instance topology.

**Why:** Users no longer hold an HTTP request open during a long import; outcomes survive restarts; duplicate clicks deduplicate; deployment remains one application container.

**Trade-off:** An in-process thread executor does not provide distributed leases, scheduling fairness, or exactly-once execution. Imports are written to be idempotent upserts. Before horizontal scaling, move execution to a queue-backed worker and add ownership leases/heartbeats.

## ADR-004: Browser-side platform sessions

**Decision:** Let the extension read pages using the user's existing LeetCode/GFG browser sessions; send only normalized problem observations to the API.

**Why:** TrackForge never collects platform passwords or copies long-lived session cookies to its server.

**Trade-off:** Platform DOM/API changes can break adapters, and extension permissions must be maintained. Shared normalization logic is unit tested; origin access for the configured API is optional and requested at runtime.

## ADR-005: Filter before pagination

**Decision:** Translate list filters into SQL predicates before total count, offset, and limit.

**Why:** Filtering an already-paginated slice silently omits matches and reports misleading totals. The corrected contract returns a stable page and the count of all records matching the same predicates.

**Trade-off:** Topic filters currently query JSON stored as text for cross-database portability. At larger scale, PostgreSQL arrays/JSONB plus indexes or normalized topic tables would be more efficient.

## ADR-006: Protected metrics, public health probes

**Decision:** Liveness/readiness are public and data-free; Prometheus metrics require the tracker token.

**Why:** Container orchestrators must probe without user credentials, while metric names and traffic patterns still reveal operational information.

**Trade-off:** A larger platform should use a separate private management listener or network policy instead of sharing the application listener.

## ADR-007: Forward migrations and backup-based rollback

**Decision:** Run Alembic upgrades automatically before application startup and use backups for destructive rollback.

**Why:** Schema state is deterministic and containers do not serve against an old schema. Automatic downgrade can destroy data and often cannot reverse data migrations safely.

**Trade-off:** Releases that require incompatible schema changes must use expand/migrate/contract deployment steps.

## What I would build next

1. Queue-backed workers with leases and idempotency keys for multi-instance deployments.
2. PostgreSQL-native topic storage and indexes after query profiling shows the need.
3. OAuth/OIDC, tenant isolation, and audit history if the product becomes multi-user.
4. Upstream contract fixtures and scheduled adapter checks for platform changes.
5. OpenTelemetry traces and managed alert routing when operating outside a personal host.