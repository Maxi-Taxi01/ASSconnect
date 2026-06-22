# ASSconnect Deployment and Environments Guide (Draft)

**Status: draft for review.** How to configure and run ASSconnect, and how to keep
development, staging and production separated. Fill in provider-specific details
when chosen.

_Last updated: 19 June 2026._

## Runtime

The server is a single Node.js process (`server.js`) with no external runtime
dependencies and a JSON data store for the MVP. It serves the static frontend and
the `/api/*` routes. Production must run it behind HTTPS and, before real scale,
replace the JSON store with a managed transactional database.

## Configuration (environment variables)

Configuration is read from the environment; copy `.env.example` to `.env` and set
values per environment. Key variables:

- `NODE_ENV` — set to `production` for live deployments. In production no demo
  accounts or seed data are created.
- `PORT` — HTTP port (default 4173).
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` — the initial administrator,
  created when the database is first seeded. Set a strong password before first
  start; otherwise a random one is generated and must be set via password reset.
- `DATA_DIR`, `DB_FILE`, `UPLOADS_DIR` — storage locations; point these at managed
  volumes or, in production, migrate to a managed database and private object
  storage.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — when
  `SMTP_HOST` is set the app integrates with a transactional email provider;
  otherwise mail is written to a local outbox.

Never commit real secrets; `.env` and `.env.*` are git-ignored (`.env.example`
is kept as the template).

## Separate environments

Maintain isolated development, staging and production systems, each with its own
data store, uploads, secrets and administrator credentials. Promote changes
development → staging → production. Use production-like data volumes in staging
for realistic testing, with personal data anonymised.

## Continuous integration and deployment

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the unit, API and
security suites on every push and pull request to `main`, then installs Puppeteer
and runs the end-to-end and accessibility suites. Require this check to pass before
merging. The existing GitHub Pages workflow publishes the static prototype; the
server-backed mode requires a Node host and is deployed separately.

A production deployment should: build/release from a reviewed `main`, run the test
suite, apply configuration from secrets, run database migrations (once a managed
database is adopted), and perform a health check (`/api/health`) before switching
traffic. Keep the ability to roll back to the previous release.

## Pre-launch checklist pointer

See `docs/production-readiness-status.md` for the full mapping of remaining
launch-blocking work (hosting, HTTPS/DNS, managed database, email and storage
providers, malware scanning, monitoring, penetration test, processor agreements
and the controlled pilot).
