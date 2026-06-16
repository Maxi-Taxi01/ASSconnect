# Security Review Notes

## Implemented Protections

- Passwords are hashed with PBKDF2 before storage.
- Login sessions use server-generated bearer tokens with expiry.
- Verification and password reset codes expire and are hashed before storage.
- Basic per-route rate limiting is enforced in memory.
- Student contact details are hidden unless consent is enabled and the viewer is a professional, admin or profile owner.
- Profiles and opportunities require admin approval before appearing publicly.
- User-generated HTML is escaped in the frontend before rendering.
- Uploads are limited to 5 MB and restricted to image or document MIME types.
- Account export, profile deletion and account deletion workflows are available.
- Admin backup and retention cleanup workflows are available.
- Audit log entries are recorded for sensitive actions.
- Runtime data and uploads are ignored by Git.

## Known MVP Limits

- The MVP database is a JSON file, not a transactional production database.
- Email delivery uses a local outbox unless SMTP is configured.
- Upload validation checks MIME declarations but does not perform malware scanning.
- Bearer tokens are stored in browser `localStorage`; production may prefer hardened cookie sessions.
- Rate limiting is in memory and resets when the server restarts.
- Backups are local files and must be encrypted/off-site for production.
- Admin controls are functional but need operational policy and review procedures.

## Production Hardening Needed

- Host behind HTTPS with secure headers at the reverse proxy.
- Use PostgreSQL or another managed database with migrations and point-in-time recovery.
- Store files in private object storage with signed download URLs.
- Add antivirus/malware scanning for CV uploads.
- Add CSRF protection if cookie sessions are introduced.
- Add structured logs that avoid sensitive personal data.
- Add monitoring, alerting and restore drills.
- Add dependency scanning if third-party packages are introduced.
- Run accessibility, privacy and penetration tests before public launch.

