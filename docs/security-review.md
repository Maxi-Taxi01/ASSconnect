# Security Review Notes

## Completed Static Prototype Protections

- Student contact details are hidden unless consent is enabled and the viewer is a professional, admin or profile owner.
- Admin-only controls check the browser-local demo role.
- User-generated HTML is escaped in the frontend before rendering.
- The static page no longer depends on API routes.

## Remaining Production Work

- Add a real backend, database and authentication system.
- Hash passwords server-side.
- Add secure session handling.
- Add CSRF protection if cookie sessions are introduced.
- Add rate limits for login, registration, password reset and contact requests.
- Add server-side validation for uploaded file signatures and extensions.
- Store uploads outside JSON and scan files before download.
- Add structured logs without sensitive personal data.
- Add secrets management for production.
- Add database migrations and encrypted backups.
- Add dependency scanning if external packages are introduced.
