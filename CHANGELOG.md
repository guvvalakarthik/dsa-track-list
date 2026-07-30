# Changelog

All notable changes are documented here. The format follows Keep a Changelog, and releases use semantic versioning.

## [Unreleased]

### Added

- Durable, deduplicated ZeroTrac and LeetCode catalog import jobs with restart recovery.
- PostgreSQL production overlay, Alembic migrations, readiness probes, JSON logs, Prometheus metrics, and a bounded load-smoke script.
- Backend PostgreSQL integration tests, frontend unit coverage, Chromium E2E, extension tests, and automated CI quality gates.
- Architecture, API, operations, deployment, security, engineering-decision, and contribution documentation.
- Reproducible portfolio dashboard screenshot.
- Live Vercel dashboard and FastAPI deployments backed by Neon PostgreSQL in Singapore.

### Changed

- Modularized the FastAPI application into configuration, database, domain, security, observability, and router boundaries.
- Split the React application into views and reusable components.
- Applied problem filters before count and pagination and ordered recent solves by timestamp.
- Moved long-running imports to queue-and-poll client behavior.

### Security

- Fail-closed staging/production token and CORS validation.
- Session-scoped client token storage and optional extension origin permissions.
- Canonical URL normalization, security headers, protected metrics, bounded HTTP retries, and non-root containers.