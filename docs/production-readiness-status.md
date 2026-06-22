# ASSconnect Production Readiness Status

_Last updated: 19 June 2026._

This report maps every item from the production readiness checklist to its current
status. Statuses are: **Done** (implemented in code and covered by tests where
applicable), **Documented** (a draft document has been produced and needs review/
sign-off), **Partial** (meaningful work done, with a remainder noted), and
**External** (requires hosting, paid providers, manual testing or legal action and
cannot be completed from the codebase alone).

## Critical launch tasks

- Deploy the Node server — **External.** Host `server.js` on a managed Node host
  behind HTTPS.
- Configure domain and HTTPS — **External.** Point `assconnect.nl` at the host and
  force TLS. (The Pages prototype already carries the CNAME.)
- Replace JSON storage with PostgreSQL — **External.** Storage is centralised in
  `loadDb`/`saveDb`, which eases the swap, but a managed database and migration are
  required.
- Implement real email delivery — **Partial.** SMTP configuration is wired via
  `SMTP_*` env vars and the app falls back to a local outbox; connect a provider.
- Protect uploaded CVs — **Partial/External.** Uploads are type/size validated;
  production must serve them from private storage with authorised, signed
  downloads.
- Use production file storage — **External.** Move photos/CVs to S3/Azure/R2.
- Add file malware scanning — **External.** Scan uploads before they are served.
- Remove production demo credentials — **Done.** No demo accounts or seed data in
  production; the admin is seeded from `ADMIN_*` env vars (random password with a
  warning if unset).
- Add environment configuration — **Done.** `.env.example` plus env-driven
  database, uploads, admin and SMTP settings.
- Harden authentication sessions — **Partial.** Added login lockout, shorter admin
  session TTL, optional TOTP and expiring tokens. Moving from localStorage bearer
  tokens to HTTP-only cookies remains a future change.

## Account and authentication

- Finish production email verification — **Done.** Dev codes are hidden when
  `NODE_ENV=production`; delivery needs the email provider above.
- Finish production password reset — **Done.** Reset invalidates existing sessions
  and codes expire.
- Add account email changes — **Done.** Password-checked change with
  re-verification of the new address.
- Improve password security — **Done.** Strength rules, common-password rejection
  and temporary lockout after repeated failures.
- Protect admin accounts — **Done.** Optional TOTP two-factor authentication and
  shorter administrator sessions.
- Add bot and spam protection — **Partial.** In-memory rate limiting and login
  lockout are in place; CAPTCHA and distributed rate limiting require an external
  service.

## Profiles and opportunities

- Complete company moderation — **Done.** New and edited company profiles are
  pending until an admin approves them.
- Add opportunity editing and deletion — **Done.** Owners can edit, withdraw and
  list their own opportunities.
- Add profile history — **Done.** Changes are recorded and reviewable by admins.
- Improve image handling — **Done.** Photos are downscaled and compressed in the
  browser before upload.
- Add pagination — **Done.** Opt-in pagination on student, company, opportunity and
  audit lists.
- Improve filtering and sorting — **Done.** Sorting by newest, name/company,
  programme, availability and deadline.

## Messaging

- Build full conversations — **Done.** Threaded replies, read status and history.
- Add message notifications — **Done.** Email (via outbox/provider) and an in-app
  unread indicator.
- Add spam and blocking controls — **Done.** Users can block senders; admins can
  review blocks and reported messages.

## Administration

- Add server backup restoration — **Done.** Confirmation-gated restore from a
  backup, plus backup listing.
- Create encrypted off-site backups — **External.** Schedule encrypted, off-site
  backups and define recovery objectives (see the incident plan).
- Add admin audit-log screens — **Done.** Searchable audit log in the admin panel.
- Add user suspension controls — **Done.** Suspend/reactivate (ends sessions and
  blocks login); permanent removal via account deletion.
- Define moderation procedures — **Documented.** `docs/moderation-procedures.md`.

## Privacy and GDPR

- Finalize the privacy policy — **Documented.** `docs/privacy-policy.md` (needs
  legal review for the real organisation).
- Add Terms of Service — **Documented.** `docs/terms-of-service.md`.
- Document legal bases and consent — **Documented.** `docs/records-of-processing.md`.
- Define retention periods — **Documented + Partial.** `docs/data-retention.md`;
  automated cleanup of sessions, tokens, old analytics and stale unverified users
  is implemented.
- Complete GDPR request workflows — **Done.** Access/export, rectification,
  erasure, restriction, objection and portability are available; restriction hides
  the profile from search until lifted.
- Create processor agreements — **External.** Sign agreements with chosen
  providers.
- Address student age requirements — **Done + Documented.** Registration enforces a
  minimum age of 16.

## Testing and quality

- Add comprehensive automated tests — **Done.** Static, API, feature and security
  suites (permissions, expired tokens, validation, uploads, concurrent edits).
- Add end-to-end browser tests — **Done.** A Puppeteer journey covering
  registration, verification, login, profile creation, moderation and search.
- Perform accessibility testing — **Done (automated) / Partial.** An automated a11y
  suite passes on all pages; a manual screen-reader and colour-contrast review is
  still recommended.
- Test mobile and browser compatibility — **Partial.** Responsive layout is checked
  at a mobile viewport in headless Chromium; real Safari/Firefox/Edge and iOS/
  Android testing remains (external/manual or a cross-browser cloud).
- Run a penetration test — **External.**
- Perform load testing — **External.**

## Operations

- Add production logging — **Not yet built.** Structured, redacted request logging
  is a remaining code item.
- Add monitoring and alerts — **External.**
- Create deployment automation — **Done.** GitHub Actions CI runs all suites plus
  the e2e and a11y checks. (The workflow file must be pushed with a token that has
  the `workflow` scope.)
- Create separate environments — **Documented + supported.** Env-driven config
  enables isolated dev/staging/production; see `docs/deployment.md`.
- Create incident and recovery plans — **Documented.** `docs/incident-response.md`.
- Complete content and usability review — **Partial.** Structure/accessibility and
  the chip/favicon fixes are done; a full copy and empty-state review is
  recommended.
- Run a controlled pilot launch — **External.**

## Remaining code items not yet built

A few items are code-level but were outside the scopes completed so far: HTTP-only
cookie sessions, CAPTCHA on public forms, structured production logging, and
advanced server-side image cropping. These can be added on request.

## Summary

The application code is feature-complete for a secure MVP, with automated unit,
API, security, end-to-end and accessibility tests and a CI pipeline. What stands
between it and a public launch is largely operational and legal: production
hosting with HTTPS, a managed database, email and storage providers, malware
scanning, encrypted off-site backups, monitoring, a penetration test, load
testing, signed processor agreements, legal sign-off of the drafted policies, and
a controlled pilot.
