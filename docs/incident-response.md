# ASSconnect Incident Response and Recovery Plan (Draft)

**Status: draft for review.** A starting framework for handling outages, data
loss, security incidents and compromised accounts. Assign real names, contacts and
targets before launch.

_Last updated: 19 June 2026._

## Roles and contacts

- Incident lead: **[name / contact]**
- Technical responder(s): **[names / contacts]**
- Data-protection contact: **[name / contact]**
- Communications contact: **[name / contact]**
- Hosting / database / email provider support: **[links and account references]**

## Severity levels

- **SEV1** — full outage, confirmed data breach, or account-takeover at scale.
- **SEV2** — partial outage, degraded performance, or a contained security issue.
- **SEV3** — minor issue with a workaround and no data risk.

## Recovery objectives

- Recovery Time Objective (RTO): **[e.g. 4 hours for SEV1]**.
- Recovery Point Objective (RPO): **[e.g. 24 hours]**, aligned with backup
  frequency.

## General response steps

Detect and triage the issue and assign a severity. Contain it — for a security
incident this may mean rotating secrets, revoking sessions, suspending affected
accounts, or taking the service offline. Investigate the cause using application
and infrastructure logs (which must avoid exposing tokens, passwords, CVs or
personal data). Recover by restoring service and, if needed, restoring data from a
verified backup. Afterwards, run a blameless post-incident review and track
follow-up actions.

## Outage

Confirm scope via monitoring and health checks. Check the host, database, storage
and email provider status. Fail over or redeploy as appropriate. Communicate
status to users if the outage is user-visible and prolonged.

## Data loss

Identify the affected data and the last good backup. Use the controlled,
confirmation-gated server restore process to recover from an encrypted backup.
Verify integrity after restore and record the data gap against the RPO.

## Security incident or data breach

Contain immediately (rotate credentials, revoke sessions, patch the vector).
Assess what data was affected. If personal data is breached, follow the legal
notification duties: assess risk, and where required notify the supervisory
authority within the statutory deadline (in the EU, without undue delay and where
feasible within 72 hours) and inform affected users. Document the timeline and
decisions.

## Compromised account

Suspend the account, revoke its sessions, and require a password reset; encourage
or require two-factor authentication. Review the audit log for actions taken
during the compromise and reverse unauthorised changes.

## Testing

Run a backup-restore drill and a tabletop incident exercise at least
**[twice per year]**, and update this plan after each test or real incident.
