# ASSconnect Launch Readiness Checklist

## Implemented In This Repository

- Static GitHub Pages-compatible prototype in `public/`.
- Server-backed app mode at `public/index.html?mode=server`.
- Node backend in `server.js` with no external runtime dependencies.
- Shared JSON database in `data/app-db.json`.
- Real password hashing with PBKDF2.
- Server-side bearer sessions with expiry.
- Student, professional and admin roles.
- Email verification and password reset token flows.
- Local email outbox for verification, reset and contact messages.
- Shared student profile storage across browsers when the server is running.
- Professional accounts can search approved student profiles and see consented contact details.
- Profile create, edit, export and delete workflows.
- Profile visibility and contact consent controls.
- Server-side photo and CV upload storage in `uploads/`.
- Professional company profiles visible in the company directory.
- Internal opportunity posting with admin approval.
- External opportunity search links for TNO, imec and TU Delft.
- Professional saved-student shortlist.
- Contact request messaging stored on the server.
- Admin profile, opportunity and report moderation.
- Server-side analytics event capture.
- Admin backup creation to `data/backup-*.json`.
- Retention cleanup for expired tokens/sessions, old analytics and stale unverified users.
- Static smoke test and API smoke test.

## How To Run

Static mode:

```text
public/index.html
```

Server mode:

```text
npm start
```

Then open:

```text
http://127.0.0.1:4173/index.html?mode=server
```

Seed accounts:

- `admin@assconnect.local` / `Admin123!`
- `professional@assconnect.local` / `Professional123!`
- `student@assconnect.local` / `Student123!`

Runtime data is intentionally ignored by Git:

- `data/app-db.json`
- `data/backup-*.json`
- `uploads/*`

## Production Requirements Before Public Launch

- Deploy the Node server behind HTTPS.
- Replace JSON file storage with a managed database such as PostgreSQL.
- Configure real SMTP or transactional email delivery.
- Move uploaded CVs/photos to private object storage with malware scanning.
- Add domain-specific privacy/legal review and a final GDPR data-processing record.
- Add monitoring, alerting, restore drills and encrypted off-site backups.
- Add stronger abuse protection for public registration and messaging.
- Run accessibility, penetration and dependency audits.

