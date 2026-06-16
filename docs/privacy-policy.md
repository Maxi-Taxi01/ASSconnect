# ASSconnect Privacy Policy Draft

This draft is intended for MVP testing and must be reviewed before public launch.

## Data Collected

In static mode, ASSconnect stores demo data in the visitor's browser through `localStorage`.

In server mode, ASSconnect stores account data, student profile data, professional company data, contact requests, saved students, reports, admin actions, upload metadata and basic analytics in the server database at `data/app-db.json`.

Student profile data may include name, programme, study year, availability, location, preferred opportunity type, skills, biography, links, email, phone, profile photo and CV.

## Purpose

Data is used to connect students with professionals for internships, graduation projects, career opportunities, research collaborations and jobs.

## Visibility

Students choose whether their profile is visible in search. Profiles require admin approval before appearing in the shared directory.

Contact details and CV links are shown only when the student has consented and the viewer is logged in as a professional, admin or profile owner.

## Email

Server mode creates verification, password reset and contact request emails. In local development, these messages are written to the server outbox in the database. In production, ASSconnect must use a configured SMTP or transactional email provider.

## Uploads

Photo and CV uploads are stored in `uploads/` in server mode. Production should move uploads to private object storage, add malware scanning and restrict CV downloads to authorized users.

## Consent

Students must explicitly consent before storing and showing selected contact information. Consent can be withdrawn by editing profile visibility, deleting the profile or deleting the account.

## Retention

Server mode includes admin retention cleanup for expired sessions, expired reset/verification tokens, old analytics events and stale unverified users.

Production should define formal retention periods for profiles, messages, audit logs and backups before public launch.

## Rights

Users can export their account/profile data and delete their profile or account from the account tools. Admin audit data may be retained for security and compliance.

## Security

Passwords are hashed in server mode. Static mode remains a demo-only browser prototype and should not be used for real private data.

Production hosting must use HTTPS, secure secret management, hardened session storage, rate limiting, encrypted backups, monitoring and a formal security review.

## Third-Party Links

ASSconnect links to external opportunity search engines such as TNO, imec and TU Delft. Those sites have their own privacy policies.

