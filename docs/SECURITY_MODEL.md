# Security model

## Assets

TrackForge stores problem metadata, solved state, topic labels, equivalence links, sync history, and import-job outcomes. It should never store platform passwords or browser cookies.

## Trust boundaries

- The dashboard and extension are authenticated clients.
- The API is the authorization boundary.
- PostgreSQL is private to the deployment network.
- LeetCode, GFG, and ZeroTrac are untrusted upstreams whose payloads are validated and normalized.

## Implemented controls

- Production startup rejects tokens shorter than 32 characters and wildcard CORS.
- Protected routes use constant-time token comparison.
- API clients may use `Authorization: Bearer` or `X-Tracker-Token`; query-string secrets are unsupported.
- The web client stores the token in `sessionStorage`, not persistent local storage.
- The extension stores the token in `chrome.storage.session` and requests access only to the configured API origin.
- Incoming problem URLs are parsed and rewritten to canonical LeetCode/GFG hosts.
- Nginx and API responses set security headers; the web image includes a restrictive content security policy.
- Frontend and backend containers run as non-root users.
- PostgreSQL is not published to the host by the production overlay.
- External HTTP requests have connection timeouts, total timeouts, bounded retries, and a fixed user agent.
- Metrics are authenticated; health probes expose no user data.
- CI includes dependency audit, tests, lint, browser E2E, and PostgreSQL integration.

## Deployment responsibilities

Operators must terminate TLS, restrict host/network access, keep `.env` out of version control, back up PostgreSQL, rotate secrets after suspected disclosure, review dependency updates, and avoid exposing development servers.

## Known boundaries

The current authentication design is intentionally single-user. It does not provide user identity, per-record authorization, session revocation lists, or tenant isolation. Do not expose one instance to unrelated users.

The browser extension interacts with third-party pages. A platform UI or API change can break data capture but should not expand host permissions automatically. Review any future permission addition as a security-sensitive change.

## Reporting a vulnerability

Do not open a public issue with secrets or exploit details. Follow the private reporting process in the repository's top-level `SECURITY.md`.