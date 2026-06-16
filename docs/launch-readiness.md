# ASSconnect Static Launch Readiness Checklist

## Implemented In This Static Prototype

- Static HTML/CSS/JavaScript in `public/`.
- Browser-local student, professional and admin demo roles.
- Browser-local registration and login simulation.
- Browser-local verification code flow.
- Browser-local password reset code flow.
- Browser-local profile storage through `localStorage`.
- Profile create, edit, export and delete in the current browser.
- Profile visibility and contact consent controls.
- Searchable student directory backed by seeded/local data.
- Professional company profiles in local browser storage.
- Contact request messaging in local browser storage.
- Professional saved-student shortlist.
- Internal opportunity posting with browser-local admin approval.
- Admin profile moderation simulation.
- Admin opportunity moderation simulation.
- Profile reporting and report moderation simulation.
- Basic analytics event capture in local browser storage.
- Admin backup download.
- CV/profile photo upload as local data URLs for prototype use.
- Mobile responsive layout and keyboard-labeled forms.
- Static smoke test confirming the page has no API dependency.

## Required Before Public Production

- Add a real backend and database if profiles must be shared across users.
- Replace JSON file storage with a managed database such as PostgreSQL.
- Replace local verification/reset codes with a real email provider.
- Move auth tokens to hardened secure cookies or another reviewed session strategy.
- Add rate limiting and brute-force protection.
- Add malware scanning and file-type validation for CV/photo uploads.
- Add scheduled retention cleanup according to the retention policy.
- Configure production hosting.
- Configure domain and HTTPS certificates.
- Configure automated backups and restore drills.
- Configure uptime monitoring and error logging.
- Run an accessibility audit with screen reader and keyboard-only testing.
- Run a security review and penetration test.
- Confirm whether external vacancy sites allow embedded live result ingestion before building scrapers or API integrations.

## Deployment Notes

Open directly:

```text
public/index.html
```

Or host the `public/` folder with any static web host. The root `index.html` redirects to `public/index.html`.

Production should still use HTTPS, a real domain, privacy review and accessibility testing before launch.
