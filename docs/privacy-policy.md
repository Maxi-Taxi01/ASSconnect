# ASSconnect Privacy Policy Draft

This draft is intended for MVP testing and must be reviewed before public launch.

## Data Collected

This static prototype stores account data, student profile data, professional company data, contact requests, saved students, reports, admin actions and basic usage analytics in the visitor's browser through `localStorage`.

Student profile data may include name, programme, study year, availability, location, preferred opportunity type, skills, biography, links, email, phone, profile photo and CV.

## Purpose

Data is used to simulate connecting students with professionals for internships, graduation projects, career opportunities, research collaborations and jobs.

## Visibility

Students choose whether their profile is visible in search. Contact details and CV data are shown only when the student has consented and the viewer is logged in as a professional or admin.

## Consent

Students must explicitly consent before storing and showing selected contact information. Consent can be withdrawn by editing profile visibility, deleting the profile or deleting the account.

## Retention

The static prototype keeps data in the current browser until the user clears browser storage, exports/deletes data, or resets the prototype. Production should add scheduled retention cleanup.

## Rights

Users can export their stored account/profile data and request or perform deletion from the account tools. Admin audit data may be retained for security and compliance.

## Security

Passwords in the static prototype are demo-only and should not be reused. Production must add a real backend, password hashing, HTTPS, secure cookies or hardened token storage, rate limiting, audit review, backups, monitoring and a formal security review.

## Third-Party Links

ASSconnect links to external opportunity search engines such as TNO, imec and TU Delft. Those sites have their own privacy policies.
