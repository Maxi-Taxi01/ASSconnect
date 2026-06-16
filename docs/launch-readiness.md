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
- Static backup restore.
- Static demo data reset.
- Browser-local retention cleanup for older messages, reports and analytics.
- Company directory rendering.
- Internal ASSconnect opportunity filtering.
- Profile photo preview and downloadable CV links where consent allows.
- CV/profile photo upload as local data URLs for prototype use.
- Mobile responsive layout and keyboard-labeled forms.
- Static smoke test confirming the page has no API dependency.

## Outside Static-Only Scope

These are not compatible with a static-only webpage and should be treated as future platform work only if ASSconnect becomes a hosted multi-user service:

- Shared backend and database for cross-device/cross-user profiles.
- Real email delivery for verification and password reset.
- Server-side authentication, secure sessions, rate limiting and abuse protection.
- Server-side file scanning and private upload storage.
- Managed production backups, monitoring and restore drills.
- Live embedded vacancy ingestion from third parties, subject to permission/API access.
- Formal legal, accessibility and security audits for a public production platform.

## Deployment Notes

Open directly:

```text
public/index.html
```

Or host the `public/` folder with any static web host. The root `index.html` redirects to `public/index.html`.

Static hosting should still use HTTPS, a real domain, privacy review and accessibility testing before public launch.
