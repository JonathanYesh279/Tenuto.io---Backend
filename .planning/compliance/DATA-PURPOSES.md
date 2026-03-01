# Data Processing Purposes and Retention Policy (DBDF-02)

**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (to be appointed -- see Phase 28)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon changes to data processing activities
**Related Documents:** DATA-INVENTORY.md (DBDF-01), MINORS-DATA.md (DBDF-03), DATA-MINIMIZATION.md (DBDF-04)

---

## 1. Regulatory Context

Under the Israeli Privacy Protection Regulations (Information Security), 2017, every processing activity involving personal data must have a documented lawful basis. The controller (Tenuto.io) must be able to demonstrate that each category of personal data is collected and processed for a specified, explicit, and legitimate purpose. Furthermore, personal data must not be retained longer than necessary for the purpose for which it was collected. This document establishes the lawful basis for each data processing activity in the platform and assesses the current state of data retention.

---

## 2. Lawful Basis Types

The platform relies on four lawful basis types for processing personal data:

| Basis | Definition | When Applied |
|---|---|---|
| **Consent** | The data subject (or their parent/guardian for minors) has given explicit, informed consent for the specific processing activity. | Currently not implemented as a formal mechanism. Required for minors' data processing -- flagged as a gap. |
| **Contractual Necessity** | Processing is required to deliver the music education management services specified in the enrollment or employment agreement between the conservatory and the data subject. | Primary basis for student, teacher, and operational data. The conservatory enrolls students and engages teachers; managing this relationship requires processing their data. |
| **Legal Obligation** | Processing is required by Israeli law, including Ministry of Education reporting requirements, tax and employment record-keeping, and bagrut examination administration. | Applied to bagrut examination data, teacher ID numbers (employment/tax reporting), hours summaries, and ministry report snapshots. |
| **Legitimate Interest** | Processing is necessary for the legitimate operation of the platform where the controller's interest does not override the data subject's rights and freedoms. Applied only when no other basis is more appropriate. | Applied to operational and audit collections (import logs, deletion audit trails, platform administration, security monitoring). |

---

## 3. Collection-by-Collection Data Processing Purposes

The following table documents the lawful basis, rationale, and retention status for all 22 MongoDB collections in the platform. Collections are ordered by data sensitivity (RESTRICTED first, then SENSITIVE, then INTERNAL, then PUBLIC).

### 3.1 RESTRICTED Collections

| Collection | Data Purpose | Lawful Basis | Rationale | Contains PII | Retention: Current State | Retention: Recommended | Action Needed |
|---|---|---|---|---|---|---|---|
| `student` | Store and manage personal, academic, and enrollment data for conservatory students (primarily minors) | Contractual Necessity | Required to deliver music education services per enrollment agreement between conservatory and student/parent | Yes (RESTRICTED -- minors' PII) | No retention policy (indefinite) | Archive after 7 years post last enrollment; delete PII after archive period | NEEDS RETENTION POLICY |
| `teacher` | Store personal, professional, credential, and schedule data for conservatory teachers | Contractual Necessity + Legal Obligation | Required to manage teacher engagement and comply with tax/employment reporting (ID number) | Yes (SENSITIVE adult PII + RESTRICTED credentials + RESTRICTED denormalized minor names) | No retention policy (indefinite) | Archive after 7 years post last active engagement; purge credentials immediately on account deactivation | NEEDS RETENTION POLICY |
| `bagrut` | Record and manage bagrut (matriculation) examination grades, evaluations, and program details for students | Legal Obligation | Israeli Ministry of Education requires bagrut examination records to be maintained | Yes (RESTRICTED -- minors' exam grades and evaluations) | No retention policy (indefinite) | Retain for 7 years per Ministry of Education record-keeping requirements; archive after | NEEDS RETENTION POLICY |
| `super_admin` | Store platform operator accounts for system administration | Legitimate Interest | Platform administration requires operator accounts with authentication credentials | Yes (RESTRICTED -- admin credentials; SENSITIVE -- admin name/email) | No retention policy (indefinite) | Delete account data within 90 days of admin account deactivation; retain audit log entries separately | NEEDS RETENTION POLICY |

### 3.2 SENSITIVE Collections

| Collection | Data Purpose | Lawful Basis | Rationale | Contains PII | Retention: Current State | Retention: Recommended | Action Needed |
|---|---|---|---|---|---|---|---|
| `tenant` | Store conservatory organization data, director information, subscription details, and ministry identifiers | Contractual Necessity | Required to deliver multi-tenant SaaS platform services per service agreement | Yes (SENSITIVE -- director name, organizational contacts, business number, addresses) | No retention policy (indefinite) | Retain active tenant data for duration of contract; archive for 7 years after tenant deletion | NEEDS RETENTION POLICY |
| `import_log` | Log Excel import operations including preview data, results, and error details | Legitimate Interest | Operational logging for data quality assurance and import troubleshooting | Yes (SENSITIVE -- previewData blob may contain full teacher/student PII from Excel uploads) | No retention policy (indefinite) | Purge previewData within 90 days after import execution; retain metadata (type, status, timestamps) for 1 year | NEEDS RETENTION POLICY |
| `ministry_report_snapshots` | Store snapshots of generated Ministry of Education reports for audit trail | Legal Obligation | Ministry of Education reporting requirements; snapshots provide proof of submission content | Yes (SENSITIVE -- snapshotData contains aggregated teacher and student data) | No retention policy (indefinite) | Retain for 7 years per regulatory record-keeping; consider archiving to cold storage after 2 years | NEEDS RETENTION POLICY |
| `deletion_snapshots` | Store complete document copies before cascade deletion for potential data recovery | Legitimate Interest | Data recovery capability in case of accidental deletion | Yes (SENSITIVE -- snapshotData contains full document copies including all PII of deleted entities) | No retention policy (indefinite) | Purge after 90 days post-deletion; recovery window should be time-limited | NEEDS RETENTION POLICY |
| `tenant_deletion_snapshots` | Store complete tenant data dump before permanent tenant purge for recovery | Legal Obligation | Data recovery window before permanent deletion; regulatory requirement for data subject access during grace period | Yes (SENSITIVE -- contains ALL tenant data including student PII, teacher PII, and credentials) | No retention policy (indefinite) | Purge after 90 days post-tenant purge execution; this is the most PII-dense collection | NEEDS RETENTION POLICY |
| `migration_backups` | Store pre-migration document snapshots for rollback capability | Legitimate Interest | Migration safety -- enables rollback if migration causes data corruption | Yes (SENSITIVE -- backupData contains pre-migration document copies which may include PII) | No retention policy (indefinite) | Purge after 180 days post-migration; migrations older than 6 months are unlikely to need rollback | NEEDS RETENTION POLICY |
| `platform_audit_log` | Record super admin actions for governance and compliance audit trail | Legitimate Interest | Platform governance requires an immutable audit trail of administrative actions | Yes (SENSITIVE -- IP addresses of super admin requests) | No retention policy (indefinite) | Retain for 7 years for compliance audit purposes; IP addresses could be anonymized after 1 year | NEEDS RETENTION POLICY |

### 3.3 INTERNAL Collections (No Direct PII)

| Collection | Data Purpose | Lawful Basis | Rationale | Contains PII | Retention: Current State | Retention: Recommended | Action Needed |
|---|---|---|---|---|---|---|---|
| `orchestra` | Organize and manage orchestra/ensemble groups, membership, and schedules | Contractual Necessity | Required to organize ensemble activities as part of music education delivery | No (references students by ID only) | No retention policy (indefinite) | Archive after school year close; retain for duration of school year + 1 year | None (no PII) |
| `rehearsal` | Track individual rehearsal sessions including attendance by student ID | Contractual Necessity | Required to track attendance for educational delivery and reporting | No (references students by ID only) | No retention policy (indefinite) | Archive after school year close; retain for duration of school year + 1 year | None (no PII) |
| `theory_lesson` | Manage group theory instruction sessions including enrollment and attendance | Contractual Necessity | Required to manage group theory instruction as part of educational delivery | No (references students by ID only) | No retention policy (indefinite) | Archive after school year close; retain for duration of school year + 1 year | None (no PII) |
| `school_year` | Define academic year boundaries and current year designation per tenant | Contractual Necessity | Required for academic year organization and scoping of all educational activities | No | No retention policy (indefinite) | Retain indefinitely (lightweight reference data) | None (no PII) |
| `activity_attendance` | Track individual student attendance across orchestra and theory activities | Contractual Necessity | Required for attendance reporting and educational service delivery tracking | No (references students by ID only) | No retention policy (indefinite) | Archive after school year close; retain for duration of school year + 1 year | None (no PII) |
| `hours_summary` | Calculate and store weekly teaching hour summaries per teacher per school year | Contractual Necessity + Legal Obligation | Required for Ministry of Education reporting and teacher workload management | No (references teachers by ID only) | No retention policy (indefinite) | Retain for 7 years for Ministry reporting compliance | None (no PII) |
| `deletion_audit` | Record metadata about cascade deletion operations for compliance trail | Legitimate Interest | Deletion audit trail for compliance -- documents what was deleted, when, and by whom | No (references entities by ID only) | No retention policy (indefinite) | Retain for 7 years for compliance audit purposes | None (no PII) |
| `security_log` | Record security events within tenant scope | Legitimate Interest | Security monitoring and incident investigation | No | No retention policy (indefinite) | Retain for 1 year; archive or purge older entries | None (no PII) |
| `integrityAuditLog` | Store results of automated data integrity checks | Legitimate Interest | Data quality assurance across the platform | No | No retention policy (indefinite) | Retain for 1 year; purge older entries | None (no PII) |
| `integrityStatus` | Store current integrity status across collections | Legitimate Interest | Data quality assurance -- current state reference | No | No retention policy (indefinite) | Overwritten on each check; no retention concern | None (no PII) |

### 3.4 PUBLIC Collections (No Personal Data)

| Collection | Data Purpose | Lawful Basis | Rationale | Contains PII | Retention: Current State | Retention: Recommended | Action Needed |
|---|---|---|---|---|---|---|---|
| `healthcheck` | Verify database connectivity at application startup | N/A | No personal data -- system operational check only | No | No retention policy (indefinite) | Single document overwritten on each startup; no retention concern | None (no personal data) |

---

## 4. Retention Gap Analysis

**Current state:** No collection in the platform has TTL (Time-To-Live) indexes or automated cleanup mechanisms. All data is retained indefinitely unless manually deleted through the application's deletion features.

The following analysis prioritizes retention gaps by risk level, based on the sensitivity of data stored and the absence of any retention enforcement.

### 4.1 CRITICAL -- Immediate Action Recommended

These collections store RESTRICTED-level data within blob fields and have no retention enforcement whatsoever. They represent the highest risk because they accumulate complete copies of personal data (including minors' PII) with no time limit.

| Collection | Risk Factor | Data at Risk | Recommended Action |
|---|---|---|---|
| `deletion_snapshots` | Contains full document copies of deleted entities, including all RESTRICTED student PII and teacher credentials | Minors' personal data, hashed passwords, JWT tokens | Implement 90-day TTL index on `deletedAt`; encrypt snapshotData at rest |
| `tenant_deletion_snapshots` | Contains ALL data for purged tenants -- the most PII-dense collection in the system | Complete student records, teacher records with credentials, all tenant-scoped data | Implement 90-day TTL index on `createdAt`; this is the single highest-risk collection for PII accumulation |
| `import_log` (previewData) | Stores parsed Excel data indefinitely; may contain hundreds of student/teacher records per import | Full names, phone numbers, email addresses, ID numbers, ages of minors | Implement job to purge `previewData` field 90 days after `executedAt`; retain import metadata |

### 4.2 HIGH -- Action Required

These collections store SENSITIVE-level data (which may effectively contain RESTRICTED data) and accumulate indefinitely without cleanup.

| Collection | Risk Factor | Data at Risk | Recommended Action |
|---|---|---|---|
| `teacher` (credentials) | Credentials (hashed passwords, refresh tokens, invitation tokens, reset tokens) stored alongside PII in the same document | Hashed passwords, active JWT refresh tokens, invitation/reset tokens | Implement credential cleanup: purge expired invitation tokens, purge reset tokens after use, consider separating credentials collection |
| `tenant` | Soft-deleted tenants retain all organizational PII indefinitely | Director names, business numbers, organizational contact details | Enforce purge schedule aligned with `deletionPurgeAt` timestamp |
| `migration_backups` | Pre-migration document copies accumulate indefinitely; older backups serve no rollback purpose | Historical copies of teacher and student documents | Implement 180-day TTL index on `createdAt`; migrations older than 6 months need no rollback |
| `ministry_report_snapshots` | Report snapshots with aggregated teacher/student data accumulate without limit | Teacher names, student data aggregated into ministry report format | Consider archiving snapshots older than 2 years; implement 7-year retention ceiling |

### 4.3 MEDIUM -- Scheduled Remediation

These collections store operational data that accumulates indefinitely but contain no direct PII (or only IP addresses). Risk is lower but storage and data hygiene are concerns.

| Collection | Risk Factor | Data at Risk | Recommended Action |
|---|---|---|---|
| `platform_audit_log` | Audit entries with IP addresses accumulate indefinitely | Super admin IP addresses (could be considered personal data) | Anonymize IP addresses after 1 year; retain action metadata for 7 years |
| `security_log` | Security events accumulate with no archival | No direct PII but may reference user IDs | Implement 1-year retention with archival to cold storage |
| `rehearsal` / `theory_lesson` / `activity_attendance` | Operational records accumulate across school years with no cleanup | Student IDs (references only, no PII) | Archive after school year close + 1 year; low priority since no direct PII |

---

## 5. Cross-Border Data Transfer

### 5.1 SendGrid (Email Delivery)

The platform uses SendGrid (a Twilio company based in the United States) as the primary email delivery service. The following personal data is transferred to SendGrid servers in the US:

| Data Type | Classification | Purpose |
|---|---|---|
| Teacher email addresses | SENSITIVE | Recipient address for invitation, password reset, and welcome emails |
| Teacher names | SENSITIVE | Personalization in email content |
| Invitation/reset tokens (embedded in URLs) | RESTRICTED | One-time-use tokens embedded in email links |

**Regulatory requirement:** Under Israeli Privacy Protection Regulations, cross-border transfer of personal data to a country without adequate data protection requires either:

1. **Standard Contractual Clauses (SCCs)** or equivalent contractual safeguards between Tenuto.io and SendGrid/Twilio, OR
2. **Explicit consent** of the data subject for the transfer, OR
3. **A finding** by the Israeli Privacy Protection Authority that the destination country provides adequate protection.

**Current status:** NEEDS VERIFICATION -- whether a Data Processing Agreement (DPA) with Twilio/SendGrid includes adequate cross-border transfer provisions.

**Action required:** Verify DPA status with SendGrid/Twilio. If no DPA exists, execute one before the next compliance review. Consider evaluating EU-based email delivery alternatives to simplify cross-border compliance.

### 5.2 Gmail Fallback

The platform has a fallback email delivery mechanism using Gmail via Nodemailer. If active in production, this transfers the same data categories to Google's global infrastructure. Google Workspace agreements typically include DPA provisions, but this should be verified for the specific account in use.

**Action required:** Confirm whether Gmail fallback is active in production. If yes, verify DPA status with Google.

---

## 6. Lawful Basis Summary

| Lawful Basis | Collections Using This Basis | Count |
|---|---|---|
| Contractual Necessity | student, teacher, tenant, orchestra, rehearsal, theory_lesson, school_year, activity_attendance, hours_summary | 9 |
| Legal Obligation | bagrut, hours_summary, ministry_report_snapshots, tenant_deletion_snapshots | 4 |
| Legitimate Interest | super_admin, import_log, deletion_audit, deletion_snapshots, security_log, migration_backups, platform_audit_log, integrityAuditLog, integrityStatus | 9 |
| Consent | None currently (gap -- required for minors' data) | 0 |
| N/A (no personal data) | healthcheck | 1 |

**Note:** Some collections have dual lawful bases (e.g., `teacher` uses Contractual Necessity for personal data and Legal Obligation for ID number; `hours_summary` uses both Contractual Necessity and Legal Obligation). The table above lists each collection under its primary basis. The `teacher` collection is listed under Contractual Necessity as its primary basis.

**Gap identified:** No collection relies on Consent as its lawful basis, yet the platform processes minors' data (students aged approximately 6-18). Under Israeli privacy regulations, parental/guardian consent is required for processing minors' personal data. This consent mechanism does not currently exist in the platform and should be implemented in a future phase (v1.6 recommendation).

---

*Document version: 1.0 | Last updated: 2026-03-02 | Next review: Annual or upon changes to data processing activities*
