# Security policy

## Supported versions

Security fixes are applied to the latest commit on `main`. This personal project does not maintain parallel long-term-support release lines.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/guvvalakarthik/dsa-track-list/security/advisories/new). Include the affected component, reproduction steps, impact, and any suggested mitigation. Do not include active tokens, cookies, passwords, or private user data.

Please avoid public issues until a fix is available. You can expect an initial acknowledgement within seven days; remediation timing depends on severity and reproducibility.

## Operator responsibilities

TrackForge is self-hosted. Operators are responsible for HTTPS, secret storage and rotation, network restrictions, PostgreSQL backups, dependency updates, and limiting the instance to its documented single-user scope. See [the security model](docs/SECURITY_MODEL.md) and [deployment guide](docs/DEPLOYMENT.md).