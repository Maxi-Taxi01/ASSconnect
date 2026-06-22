# ASSconnect Records of Processing and Legal Bases (Draft)

**Status: draft for review.** A working record of processing activities (in the
spirit of GDPR Article 30) and the lawful basis for each category of personal
data. Confirm with the operating organisation and legal counsel before launch.

_Last updated: 19 June 2026._

## Controller

Controller: **[organisation name and legal entity]**. Contact: **[email]**.
Where applicable, the Data Protection Officer is **[name / contact]**.

## Categories of data, purpose and lawful basis

Account identity (name, email, date of birth, role, password hash): used to
create and secure accounts and to enforce the minimum age. Lawful basis:
performance of the service and legitimate interests; the date of birth is
processed to meet the legal-obligation aspect of age limits.

Authentication data (sessions, hashed verification/reset codes, optional TOTP
secret): used to authenticate users and protect accounts. Lawful basis:
legitimate interests in security.

Student profile (programme, phase, study year, looking-for, availability,
location, remote preference, languages, skills, bio, links, photo): used to match
students with opportunities and to display approved profiles in search. Lawful
basis: consent for visibility; legitimate interests for operating the directory.

Student contact details and CV (email, phone, CV file): shared with professionals
only on the basis of explicit **consent**, which can be withdrawn at any time.

Company profile and opportunities (company name, website, sectors, description,
postings): used to present organisations and opportunities. Lawful basis:
performance of the service and legitimate interests.

Messages and contact requests: used to enable communication between consenting
users. Lawful basis: performance of the service; legitimate interests in abuse
review for reported messages.

Saved students, reports, blocks, privacy requests: used for shortlisting,
safety, user control and rights handling. Lawful basis: legitimate interests and,
for rights requests, legal obligation.

Analytics events: used to understand usage at an aggregate level. Lawful basis:
legitimate interests; production should minimise and, where required, seek
consent for any non-essential analytics.

Audit log: records of sensitive administrative and security actions. Lawful
basis: legal obligation and legitimate interests in security and accountability.

Backups: copies of the database for recovery. Lawful basis: legitimate interests
in resilience; must be encrypted and access-controlled in production.

## Recipients and processors

In production, personal data is processed by infrastructure and service providers
acting as processors under data-processing agreements: hosting, managed database,
transactional email, object storage, and monitoring/analytics. Maintain a current
list of these processors with signed agreements before launch.

## International transfers

Record whether any processor transfers data outside the EEA and, if so, the
safeguard relied upon (for example EU Standard Contractual Clauses). **[Complete
after selecting processors.]**

## Consent records

Consent for profile visibility and for sharing contact details is captured per
student through explicit toggles and is reflected in the stored profile. Withdrawal
is possible by editing visibility/consent, restricting processing, or deleting the
profile or account.

## Data subject rights

Access and portability are served by the data export; rectification by profile
editing; erasure by profile/account deletion; restriction and objection by the
privacy-request workflow (restriction hides the profile from search until lifted
by an administrator). Track and log all rights requests and their resolution.

## Security measures

PBKDF2 password hashing, expiring bearer sessions (shorter for administrators),
optional TOTP two-factor authentication, hashed short-lived codes, login lockout,
rate limiting, upload type/size limits, role-based access control, and audit
logging. Production adds HTTPS, secret management, private upload storage with
malware scanning, encrypted off-site backups and monitoring.
