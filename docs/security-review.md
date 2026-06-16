# Security Review Notes

## Completed Static Prototype Protections

- Student contact details are hidden unless consent is enabled and the viewer is a professional, admin or profile owner.
- Admin-only controls check the browser-local demo role.
- User-generated HTML is escaped in the frontend before rendering.
- The static page no longer depends on API routes.
- Static backup export, restore and demo reset are available.
- Browser-local retention cleanup is available for older messages, reports and analytics.

## Outside Static-Only Scope

The following require a hosted backend and are intentionally outside the static-page implementation:

- Real backend, database and authentication system.
- Server-side password hashing and secure session handling.
- CSRF protection if cookie sessions are introduced.
- Rate limits for login, registration, password reset and contact requests.
- Server-side validation for uploaded file signatures and extensions.
- Private file storage and malware scanning before download.
- Structured logs without sensitive personal data.
- Secrets management, database migrations and encrypted backups.
- Dependency scanning if external packages are introduced.
