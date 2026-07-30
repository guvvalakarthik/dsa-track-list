# Contributing

Thank you for improving TrackForge. Keep changes focused, testable, and explicit about behavior and trade-offs.

## Development setup

Follow the source setup in [README.md](README.md). Use Python 3.12 and Node.js 22 to match CI. Start from an up-to-date branch and create a narrowly named branch such as `fix/problem-pagination` or `feat/import-cancellation`.

## Before opening a pull request

Run the relevant checks and preferably the full matrix:

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check app migrations scripts tests
.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing

cd ..\frontend
npm run test:coverage
npm run build
npm run test:e2e

cd ..\extension
npm test
```

For schema changes, create and review an Alembic revision, test an upgrade from the prior revision, and test a fresh database. For operational changes, boot the Compose topology and check both `/api/ready` and structured logs.

## Pull-request expectations

- Explain the user-visible outcome and why the change is needed.
- Include tests for regressions and new behavior.
- Keep secrets, `.env`, databases, coverage, and browser artifacts out of commits.
- Update API, architecture, deployment, or operations docs when their contracts change.
- Call out migrations, compatibility breaks, security implications, and rollback steps.
- Use a focused conventional-style commit subject, such as `fix:`, `feat:`, `test:`, `docs:`, or `security:`.

## Design principles

- Apply filters and authorization at the data boundary, not after pagination or serialization.
- Preserve platform credentials in the browser.
- Fail closed in production configuration.
- Prefer idempotent import behavior and persisted outcomes.
- Add complexity only when the operating model requires it; document the point where the current design stops scaling.

## Security reports

Do not disclose vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).