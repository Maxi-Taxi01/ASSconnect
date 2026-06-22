# ASSconnect Data Retention Schedule (Draft)

**Status: draft for review.** Retention periods below match the behaviour
implemented in the server and the intended production policy. Confirm the
production periods with the operating organisation before launch.

_Last updated: 19 June 2026._

## Automated cleanup already implemented

The server's retention cleanup and session handling remove data on these
schedules:

- Login sessions expire automatically — 14 days for normal users, 8 hours for
  administrators — and expired sessions are purged.
- Email-verification and password-reset codes expire after 1 hour and are purged
  once expired or used.
- Analytics events older than 90 days are deleted.
- Unverified accounts older than 30 days are deleted.

## Recommended production retention periods

- Active accounts and profiles: retained while the account is active; deleted or
  anonymised on account deletion.
- Inactive accounts: review and notify after **[e.g. 24 months]** of inactivity,
  then delete if not reactivated.
- Messages: retained for the life of the account or **[e.g. 24 months]**,
  whichever is shorter, unless needed for an open abuse investigation.
- Uploads (photos, CVs): deleted with the profile; orphaned files cleaned on a
  regular schedule.
- Audit log: retained **[e.g. 12-24 months]** for security and accountability,
  then deleted; entries are minimised to avoid storing unnecessary personal data.
- Analytics: 90 days (as implemented), aggregated thereafter if retained at all.
- Backups: retained **[e.g. 30-90 days]** on an encrypted, access-controlled,
  off-site rotation, then securely destroyed.

## Deletion and anonymisation

Account deletion removes the profile from public view, anonymises the account
identity and invalidates sessions. A minimal audit record may be kept for the
audit-log retention period. Document any legal hold that overrides these periods.

## Responsibilities

The operator runs and monitors the retention cleanup, verifies backup rotation
and destruction, and reviews this schedule at least annually or when processing
changes.
