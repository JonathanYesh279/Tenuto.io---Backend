# Incident Response Plan

**Document ID:** INCD-01/02/03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (as defined in SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon any P1/P2 severity incident (whichever comes first)
**Related Documents:** RISK-01 (Risk Assessment), SECOFF-01/02 (Security Officer), ACPOL-03 (Access Logging Policy), DBDF-01 (Data Inventory), DBDF-03 (Minors Data), SMAP-01 (Architecture Diagram), SMAP-02 (Data Flow Map), SMAP-03 (Vendor Inventory), SECPR-01/02/03 (Security Procedures), GLOSS-01 (Glossary)

---

## 1. Purpose and Scope

### 1.1 Purpose

This document is the **Incident Response Plan** for the Tenuto.io music conservatory management platform. It satisfies the incident preparedness and response requirements of **Regulation 11** (Takanat 11) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017), which requires organizations holding medium-security databases to:

1. Maintain a plan for responding to severe security incidents (Teuna Chmurah / תקנת חמורה)
2. Notify the Privacy Protection Authority (PPA / HaRashut LeHaganat HaPratiyut) immediately upon becoming aware of a severe security incident
3. Document incidents and response actions for compliance audit

This document covers three related requirements:

- **INCD-01:** Incident Response Plan -- severity classification, role assignments, and incident lifecycle procedures
- **INCD-02:** Breach Notification Procedure -- escalation levels and PPA notification process
- **INCD-03:** Incident Log Template -- standardized documentation format for all security incidents

### 1.2 Scope

This plan covers all components of the Tenuto.io platform as documented in ARCHITECTURE-DIAGRAM.md (SMAP-01):

| Component | Description | Incident Relevance |
|-----------|-------------|-------------------|
| Express API Server | Node.js backend on Render | Primary attack surface; handles all authentication, authorization, and data access |
| MongoDB Atlas | Managed database hosting (22 collections per DBDF-01) | Contains all personal data including minors' PII and credentials |
| AWS S3 (eu-central-1) | Bagrut document storage | Contains scanned exam papers that may include minors' names and grades |
| SendGrid | Transactional email delivery | Processes teacher email addresses and names; cross-border transfer to US |
| Gmail (Nodemailer) | Fallback email delivery | Same data scope as SendGrid |
| React Frontend (Render) | Static SPA hosting | Client-side JWT storage in localStorage |
| Socket.io | WebSocket connections | Cascade deletion progress; potential session hijacking vector |

### 1.3 Definitions

For the full Hebrew-English regulatory terminology mapping, see GLOSSARY.md (GLOSS-01). Key terms used in this document:

- **Severe Security Incident** (Teuna Chmurah / תקנת חמורה): Unauthorized use of a substantial part of the database, use exceeding authorization affecting a substantial part, or compromise of the integrity of a substantial part of the data
- **PPA** (HaRashut LeHaganat HaPratiyut): Privacy Protection Authority -- the Israeli government authority responsible for enforcing privacy protection legislation
- **Security Officer** (Memuné Al Abtakhat Meida / ממונה על אבטחת מידע): The appointed individual responsible for security oversight (SECOFF-01/02)

---

## 2. Special Handling: Minors' Data Incidents

Per MINORS-DATA.md (DBDF-03), the Tenuto.io platform processes personal data of students aged approximately 6-18. Minors' data receives the highest classification level (RESTRICTED) and requires elevated incident handling.

**Automatic Severity Elevation Rule:**

If an incident involves or potentially involves minors' personal data (student records from the `student` collection, examination grades from the `bagrut` collection, or denormalized student names in `teacher.teaching.timeBlocks[].assignedLessons[].studentName`), the severity is **automatically elevated by one level**:

| Original Severity | Elevated Severity | Rationale |
|-------------------|-------------------|-----------|
| P4 (Low) | P3 (Medium) | Minors' data anomalies require active investigation, not passive monitoring |
| P3 (Medium) | P2 (High) | Suspected minors' data exposure requires urgent containment |
| P2 (High) | P1 (Critical) | Confirmed minors' data breach triggers immediate regulatory response |
| P1 (Critical) | P1 (Critical) | Already at maximum severity |

This elevation applies regardless of the number of records affected, reflecting the heightened duty of care for minors' data under Israeli privacy regulations.

---

## 3. INCD-01 -- Incident Response Plan

### 3.1 Severity Classification

| Severity | Name | Definition | Response Time | Risk Examples |
|----------|------|-----------|---------------|---------------|
| **P1** | Critical | Confirmed data breach affecting minors' PII across tenants or credential exposure enabling platform-wide access. Meets PPA "Severe Security Incident" definition for medium-security database. Requires immediate PPA notification. | Immediate -- within 1 hour of confirmation | Cross-tenant data leak (R-01): flaw in tenant isolation logic allows Tenant A to access Tenant B's student records. Credential exposure in database dump (R-02): database backup leaked containing hashed passwords, refresh tokens, and Israeli ID numbers. Mass student PII exposure (R-03): API vulnerability exposes student records (names, addresses, parent contacts, grades) to unauthorized access. JWT secret compromise (R-04): ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET leaked, enabling forged tokens for any user on any tenant. |
| **P2** | High | Confirmed unauthorized access or data integrity compromise within a single tenant. Significant system availability impact. May constitute a Severe Security Incident pending scope assessment. | Within 4 hours of confirmation | S3 bucket publicly exposed (R-10): AWS S3 bucket storing bagrut documents found accessible without authentication; scanned exam papers with student names and grades potentially exposed. Single-tenant admin compromise via default password (R-05): attacker logs into a teacher account using the default "123456" password and accesses student data within that tenant. Complete database corruption requiring Atlas point-in-time recovery. |
| **P3** | Medium | Suspected unauthorized access or failed exploitation attempt. Regulatory non-compliance discovered. Partial system degradation. | Within 24 hours of detection | SendGrid DPA non-compliance discovered (R-09): cross-border transfer of teacher data to US without documented legal basis. Import log PII retention violation (R-06): discovery that `import_log.previewData` contains student PII retained indefinitely without TTL. Deletion snapshot PII accumulation (R-07): `deletion_snapshots` collection growing with complete copies of deleted student records with no cleanup mechanism. |
| **P4** | Low | Minor security anomaly, policy violation without data exposure, informational events. No immediate data compromise. | Within 72 hours of detection | Failed login attempt pattern from single IP address. Student name denormalization inconsistency (R-12): stale `studentName` values in teacher documents after student name correction. Logging gap discovered (R-08): compliance review reveals tenant-level administrative actions are not logged. No data retention enforcement (R-11): discovery that no TTL indexes exist on any collection. |

### 3.2 Role Assignments

| Role | Person / Position | Responsibilities During Incident |
|------|------------------|--------------------------------|
| **Incident Commander** | Security Officer (SECOFF-01/02) | Overall incident management; declares and updates severity level; authorizes escalation; coordinates response team; approves PPA notification; ensures incident is documented |
| **Technical Lead** | Lead Developer / CTO | Technical investigation and evidence preservation; containment action execution (token revocation, access blocking, service isolation); root cause analysis; recovery implementation; verifies remediation effectiveness |
| **Communications Lead** | Incident Commander (pre-launch, single-person team) | Tenant notification preparation and delivery; PPA notification form completion and submission; internal status updates; coordinates with Legal Advisor on external communications |
| **Legal Advisor** | External counsel (on retainer) | Regulatory notification guidance; assessment of whether incident meets "Severe Security Incident" threshold; liability assessment; advises on data subject notification if PPA orders it |

**Pre-launch note:** During the pre-launch phase where the Security Officer and Lead Developer may be the same individual (per SECOFF-01/02, Section 3.5 conflict of interest exception), the Incident Commander and Technical Lead roles will be held by the same person. The Communications Lead role defaults to the Incident Commander. This is a recognized limitation that must be resolved before production operation with real tenant data.

### 3.3 Incident Lifecycle Phases

The incident response lifecycle follows the NIST SP 800-61 framework, with each phase containing Tenuto.io-specific actions.

#### Phase 1: Preparation

**Objective:** Ensure the organization is ready to detect and respond to incidents before they occur.

| # | Action | Responsible | Status |
|---|--------|-------------|--------|
| 1 | Maintain this Incident Response Plan (current document) | Security Officer | COMPLETE (this document) |
| 2 | Assign incident response roles (Section 3.2) | Security Officer | COMPLETE (roles defined; named individuals required before production) |
| 3 | Establish secure communication channel for incident coordination | Security Officer | PENDING -- define out-of-band communication method (not dependent on potentially compromised platform) |
| 4 | Implement authentication event logging (ACPOL-03, Category 1) | Development Team | PLANNED for v1.6 |
| 5 | Implement minors' data access logging (ACPOL-03, Category 3) | Development Team | PLANNED for v1.6 |
| 6 | Implement authorization failure logging (ACPOL-03, Category 2) | Development Team | PLANNED for v1.6 |
| 7 | Configure monitoring alerts for anomalous patterns | Security Officer + Development Team | PLANNED for v1.6 |
| 8 | Pre-draft PPA notification form (Section 4.3) | Security Officer | COMPLETE (template in this document) |
| 9 | Pre-draft data subject notification template (Section 4.5) | Security Officer | COMPLETE (template in this document) |
| 10 | Conduct annual tabletop exercise simulating P1 and P2 incidents | Security Officer | PENDING -- schedule before first production tenant |

#### Phase 2: Detection and Analysis

**Objective:** Identify the incident, classify its severity, and document initial findings.

**Detection sources for the Tenuto.io platform:**

| Source | What It Can Detect | Current State |
|--------|-------------------|---------------|
| `platform_audit_log` (MongoDB) | Anomalous super admin actions, impersonation abuse | OPERATIONAL -- structured audit events |
| `deletion_audit` (MongoDB) | Unusual deletion patterns, mass deletions | OPERATIONAL -- structured deletion events |
| `security_log` (MongoDB) | Security events (sparsely populated) | PARTIALLY OPERATIONAL -- collection exists but minimally used |
| Pino application logs (Render stdout) | HTTP errors, application exceptions, startup failures | OPERATIONAL -- unstructured, 30-day retention on Render |
| MongoDB Atlas alerts | Database performance anomalies, connection spikes, authentication failures | AVAILABLE -- requires configuration in Atlas console |
| External reports | User reports of suspicious activity, third-party vulnerability disclosures | AVAILABLE -- no formal intake process defined |
| Automated monitoring | Authentication anomalies, access pattern deviations | NOT AVAILABLE -- planned for v1.6 |

**Analysis steps:**

1. **Triage:** Determine if the event is a security incident or a false positive. Check the detection source, correlate with other log sources, and assess initial scope.
2. **Classify severity:** Apply the P1-P4 classification from Section 3.1. If minors' data is involved or potentially involved, apply the automatic elevation rule from Section 2.
3. **Scope assessment:** Identify affected systems (reference SMAP-01 components), affected data (reference DBDF-01 collections and classifications), affected tenants (single-tenant or platform-wide), and whether the incident is ongoing.
4. **Document:** Create an incident log entry (Section 5 template) with all known information. Assign the incident ID (format: INC-YYYY-NNN).
5. **Notify:** Alert the Incident Commander (Security Officer) per the escalation timeline for the assigned severity level.

#### Phase 3: Containment

**Objective:** Stop the damage, isolate affected systems, and preserve evidence.

**Containment actions by affected component:**

| Component | Containment Action | Command / Procedure |
|-----------|-------------------|-------------------|
| **Compromised teacher account** | Revoke all active sessions by incrementing `tokenVersion` | Update `teacher.credentials.tokenVersion` in MongoDB; this invalidates all existing JWT tokens for the account |
| **Compromised admin account** | Same as above + temporarily deactivate account | Set `teacher.isActive: false`; increment `tokenVersion`; notify tenant |
| **Compromised super admin account** | Deactivate super admin account; rotate platform secrets | Set `super_admin.isActive: false`; rotate ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET on Render |
| **JWT secret compromise (R-04)** | Rotate both ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET | Update environment variables on Render; all existing tokens become invalid; all users must re-authenticate |
| **MongoDB Atlas access compromise** | Rotate database connection string credentials | Update MONGODB_URI in Render environment variables; update Atlas user credentials; review Atlas audit log |
| **S3 bucket exposure (R-10)** | Enable S3 Block Public Access; rotate S3 credentials | AWS Console: enable Block Public Access on bucket; rotate S3_ACCESS_KEY and S3_SECRET_KEY; update Render environment variables |
| **Cross-tenant data leak (R-01)** | Emergency API shutdown if leak is ongoing | Stop the Render service; investigate tenant isolation middleware (enforceTenant, buildContext, buildScopedFilter); do not restart until root cause is identified |
| **SendGrid API key compromise** | Revoke and regenerate SendGrid API key | SendGrid dashboard: revoke compromised key; generate new key; update SENDGRID_API_KEY on Render |
| **Active exploitation detected** | Block attacker IP at application level | Add IP to blocklist (if implemented); or contact Render support for infrastructure-level blocking |

**Evidence preservation:**

- Before any containment action that modifies data: document the current state (screenshots, database queries, log exports)
- Export relevant log entries from `platform_audit_log`, `security_log`, and `deletion_audit` for the incident period
- Export Render application logs for the incident period (Pino logs have 30-day retention)
- If MongoDB Atlas audit logging is enabled: export database-level access logs
- Store all evidence in a dedicated incident folder, named by incident ID

#### Phase 4: Eradication

**Objective:** Remove the root cause and verify it is fully remediated.

| Root Cause Type | Eradication Action |
|-----------------|-------------------|
| Application vulnerability (e.g., broken tenant isolation) | Deploy code fix; add regression tests; verify fix in staging before production |
| Compromised credentials | Rotate all affected secrets; force password reset for affected users; verify no backdoor accounts created |
| Misconfigured infrastructure (e.g., S3 bucket policy) | Correct configuration; add infrastructure-as-code or monitoring to prevent recurrence |
| Default password exploitation (R-05) | Force password reset for all accounts with `requiresPasswordChange: true`; consider disabling accounts that still use default passwords |
| Vendor security failure | Contact vendor security team; verify vendor's remediation; review DPA breach notification clause |

#### Phase 5: Recovery

**Objective:** Restore normal operations and verify data integrity.

1. **Restore services:** If services were shut down during containment, redeploy from known-good code (Git repository) to Render. Verify environment variables are correctly set.
2. **Verify data integrity:** Run data consistency checks against affected collections. Compare record counts and sample data against the most recent backup or snapshot.
3. **Restore affected data:** If data was corrupted or lost, restore from MongoDB Atlas point-in-time backup (per BACKUP-RECOVERY-PLAN.md / SECPR-02). Document the recovery point and any data gap.
4. **Re-enable access:** Reactivate any accounts that were temporarily disabled. Ensure affected users receive new credentials or are directed to the password reset flow.
5. **Monitor for recurrence:** Increase monitoring frequency for the affected systems for a minimum of 7 days following recovery. Check for indicators of persistent compromise.

#### Phase 6: Post-Incident Activity

**Objective:** Learn from the incident and improve the security posture.

| # | Action | Timeline | Responsible |
|---|--------|----------|-------------|
| 1 | Complete the incident log entry (Section 5) with all fields including root cause, lessons learned, and plan updates | Within 7 days of resolution | Incident Commander |
| 2 | Conduct post-incident review meeting with all response team members | Within 7 days of resolution | Incident Commander |
| 3 | Update RISK-ASSESSMENT.md (RISK-01) if the incident reveals a new risk or changes the score of an existing risk | Within 14 days | Security Officer |
| 4 | Update this Incident Response Plan if the response revealed gaps in the plan | Within 14 days | Security Officer |
| 5 | Update affected compliance documents (SECPR-01/02/03, ACPOL-01/02/03, etc.) if the incident reveals policy gaps | Within 30 days | Security Officer |
| 6 | Implement technical improvements identified during the post-incident review | Per development cycle | Development Team |
| 7 | Brief senior management on incident summary, impact, response effectiveness, and improvement actions | Within 14 days | Security Officer |

---

## 4. INCD-02 -- Breach Notification Procedure

### 4.1 Overview

This section defines the escalation procedure for security incidents, from initial detection through regulatory notification. The procedure implements the 4-level escalation model previously established in ACCESS-LOGGING-POLICY.md (ACPOL-03), Section 6.3, and aligns with the PPA notification requirements under Regulation 11 of the Israeli Privacy Protection Regulations (Information Security), 5777-2017.

### 4.2 Four-Level Escalation Procedure

| Level | Name | Trigger | Action | Timeline | Responsible Party |
|-------|------|---------|--------|----------|-------------------|
| **1** | Anomaly Detection | Unusual system behavior detected: failed access patterns, monitoring alert, unexpected log entries, user complaint, external vulnerability disclosure | Log the event in `security_log` (or equivalent). Investigate the anomaly. Determine whether it constitutes a security incident. If no security incident confirmed, close the event with documentation. | Ongoing monitoring; investigation begins within 4 hours of detection | Development Team |
| **2** | Security Incident Investigation | Confirmed unauthorized access, data integrity compromise, system compromise, or other security event at any severity level (P1-P4) | Classify severity per Section 3.1 (apply minors' data elevation per Section 2 if applicable). Begin incident response lifecycle (Phase 2: Detection and Analysis). Notify Security Officer. Assign Incident Commander. Create incident log entry (Section 5). | Notification to Security Officer: within 1 hour (P1), 4 hours (P2), 24 hours (P3), 72 hours (P4) | Technical Lead notifies Security Officer |
| **3** | Severe Security Incident | P1 or P2 incident confirmed to affect a **substantial part** of the database, meeting the Regulation 11 definition of a Severe Security Incident (Teuna Chmurah). Criteria: cross-tenant exposure, minors' data breach, credential dump affecting multiple users, or platform-wide compromise. | Activate PPA notification procedure (Section 4.3). Prepare PPA notification form with all required fields. Notify senior management. Engage Legal Advisor. Continue containment and eradication. | PPA notification: **immediately** upon determination that the incident is severe. Senior management: within 1 hour of determination. | Security Officer (Incident Commander) |
| **4** | Regulatory Breach Notification | PPA notification submitted. PPA reviews the incident and may order data subject notification after consulting with the Israel National Cyber Directorate. | Submit PPA notification form (Section 4.3). Await PPA direction on data subject notification. If PPA orders data subject notification: prepare and send notification using template (Section 4.5). Engage Legal Advisor for guidance. Submit follow-up report to PPA detailing response actions taken. | PPA form submission: immediately. Data subject notification: as directed by PPA. Follow-up report: within timeframe specified by PPA (or within 30 days if not specified). | Security Officer + Legal Advisor |

### 4.3 PPA Notification Form Fields

When a Level 3 (Severe Security Incident) determination is made, the Security Officer must prepare and submit a notification to the PPA containing all of the following fields. The notification is submitted via the PPA's online reporting form or via email to the PPA.

**Submission methods:**
- Online: PPA website (https://www.gov.il/he/departments/the_privacy_protection_authority)
- Email: PPA contact email as published on their website

**Required notification fields:**

| # | Field | Description | Pre-populated Value (Tenuto.io) |
|---|-------|-------------|-------------------------------|
| 1 | Reporting entity name | Organization name | Tenuto.io / [Legal entity name] |
| 2 | Reporting entity address | Registered address | [TO BE COMPLETED before production] |
| 3 | Reporting entity phone | Contact phone number | [TO BE COMPLETED before production] |
| 4 | Reporting entity email | Contact email address | [TO BE COMPLETED before production] |
| 5 | Senior management contact name | CEO / CTO name | [TO BE COMPLETED before production] |
| 6 | Senior management contact details | Phone and email | [TO BE COMPLETED before production] |
| 7 | Security Officer name | Per SECOFF-01/02 appointment | [TO BE COMPLETED -- appointment required before production] |
| 8 | Security Officer contact details | Phone and email | [TO BE COMPLETED -- appointment required before production] |
| 9 | Date of incident discovery | When the incident was first detected | [From incident log: Date/Time Detected] |
| 10 | Date incident is believed to have occurred | Estimated start date of the incident | [From incident log: Date/Time Occurred] |
| 11 | Whether a data leak occurred | Yes / No / Unknown | [From investigation findings] |
| 12 | Database registration status | Whether the database is registered with the PPA | [TO BE VERIFIED -- registration status] |
| 13 | Organization status | Controller or Processor | **Controller** -- Tenuto.io determines the purposes and means of processing |
| 14 | Whether reported to another regulator or law enforcement | Yes / No | [From incident response actions] |
| 15 | Cyber insurance coverage status | Whether the organization holds cyber insurance | [TO BE VERIFIED before production] |
| 16 | Types of personal data processed | Data categories from DBDF-01 | RESTRICTED: Student PII (minors' names, addresses, phone numbers, parent contacts, exam grades), teacher credentials (hashed passwords, JWT tokens, Israeli ID numbers). SENSITIVE: Teacher PII (names, emails, addresses), organizational data. INTERNAL: Schedules, attendance, configuration. |
| 17 | Number of data subjects potentially affected | Estimated count | [From incident scope assessment -- reference affected tenants and collections] |
| 18 | Number of authorized access holders | Users with access to affected data | [Count of teachers + admins in affected tenant(s), plus super admins] |
| 19 | Description of the incident | Narrative summary | [From incident log: Description] |
| 20 | Steps taken in response | Actions taken to contain and remediate | [From incident log: Containment Actions, Eradication Actions, Recovery Actions] |

### 4.4 Data Subject Notification -- Israeli Regulatory Model

**Data subject notification is NOT mandatory by default under Israeli privacy law.**

The Israeli breach notification model differs from the GDPR auto-notification approach. Under the Israeli Privacy Protection Regulations:

1. The **PPA must be notified** immediately upon the organization becoming aware of a Severe Security Incident.
2. The **PPA evaluates** the incident, consulting with the **Israel National Cyber Directorate** (HaMa'arach HaLeumi LeSiber / המערך הלאומי לסייבר).
3. The **PPA may ORDER** the organization to notify affected data subjects. This is a case-by-case determination, not an automatic obligation.
4. If the PPA does not order data subject notification, the organization is **not required** to notify data subjects.
5. The PPA may specify the **form and content** of the required data subject notification.

**Do NOT** proactively notify data subjects of a breach without PPA direction unless senior management and Legal Advisor determine it is in the organization's interest (e.g., for reputational reasons or because the breach is already publicly known). Premature notification can cause unnecessary panic and may conflict with PPA investigative procedures.

### 4.5 Pre-Drafted Data Subject Notification Template

The following template is prepared in advance so that, if the PPA orders data subject notification, it can be customized and sent promptly. The template is in Hebrew (the platform's primary language) with an English translation for compliance documentation purposes.

**Note:** This template should be reviewed by Legal Advisor before use and customized to the specific incident details. The PPA may specify different content requirements.

---

**Template (English version for documentation):**

```
Subject: Important Security Notice -- Tenuto.io Platform

Dear [Data Subject / Parent/Guardian of Student],

We are writing to inform you of a security incident affecting the Tenuto.io
platform used by [Conservatory Name].

WHAT HAPPENED:
[Brief description of the incident -- what occurred and when it was discovered]

WHAT DATA WAS AFFECTED:
[Specific data types that were or may have been exposed -- e.g., names, email
addresses, phone numbers, addresses, exam grades]

WHAT WE HAVE DONE:
[Summary of containment and remediation actions taken]

WHAT YOU SHOULD DO:
- Change your platform password immediately at [password reset URL]
- Monitor your accounts for any suspicious activity
- [Additional steps specific to the incident]

CONTACT INFORMATION:
If you have questions or concerns about this incident, please contact:
  Security Officer: [Name]
  Email: [security-officer-email]
  Phone: [security-officer-phone]

This notification is provided in accordance with a direction from the Israeli
Privacy Protection Authority.

[Organization Name]
[Date]
```

---

## 5. INCD-03 -- Incident Log Template

### 5.1 Incident Log Entry Format

Every security incident, regardless of severity, must be documented using the following template. The incident log serves as the official record of the incident for compliance audit, post-incident review, and regulatory inquiry purposes.

**Incident ID format:** `INC-YYYY-NNN` where YYYY is the year and NNN is a sequential number starting at 001 each year.

| # | Field | Description | Required | When Completed |
|---|-------|-------------|----------|----------------|
| 1 | Incident ID | Unique identifier (INC-YYYY-NNN) | Yes | At incident creation |
| 2 | Date/Time Detected | When the incident was first identified (ISO 8601 UTC) | Yes | At incident creation |
| 3 | Date/Time Occurred | Estimated time the incident actually started (ISO 8601 UTC) | Yes | At incident creation (may be updated during investigation) |
| 4 | Reported By | Name and role of person who detected or reported the incident | Yes | At incident creation |
| 5 | Severity | P1 / P2 / P3 / P4 (may be updated during investigation; note if elevated due to minors' data per Section 2) | Yes | At incident creation |
| 6 | Classification | Incident type: Data Breach, Unauthorized Access, System Compromise, Availability Impact, Policy Violation, Regulatory Non-Compliance | Yes | At incident creation |
| 7 | Affected Systems | Which platform components are affected (reference SMAP-01): Express API, MongoDB Atlas, AWS S3, SendGrid, Gmail, Render, React Frontend, Socket.io | Yes | At incident creation |
| 8 | Affected Data | Data types and classifications per DBDF-01 (e.g., "student.personalInfo -- RESTRICTED", "teacher.credentials -- RESTRICTED") | Yes | At incident creation |
| 9 | Affected Tenants | Which tenants' data was impacted: specific tenant name(s), "multiple tenants" (list them), or "platform-wide" for cross-tenant/infrastructure incidents | Yes | At incident creation |
| 10 | Minors Data Involved | Yes / No / Unknown -- if Yes, severity elevation rule from Section 2 applies. Reference DBDF-03 for minors' data locations. | Yes | At incident creation |
| 11 | Estimated Scope | Number of records and/or data subjects potentially affected | Yes | At incident creation (refined during investigation) |
| 12 | Description | Narrative description of what happened, how it was detected, and initial assessment | Yes | At incident creation |
| 13 | Root Cause | Technical root cause identified during investigation (e.g., "Missing tenantId filter in student query endpoint", "S3 bucket policy allowed public ListBucket") | When known | During/after investigation |
| 14 | Containment Actions | Numbered list of steps taken to stop the damage (e.g., "1. Revoked all tokens for affected accounts. 2. Disabled public access on S3 bucket.") | Yes | During containment |
| 15 | Eradication Actions | Numbered list of steps taken to remove the root cause (e.g., "1. Deployed code fix adding tenantId filter. 2. Added regression test.") | Yes | During eradication |
| 16 | Recovery Actions | Numbered list of steps taken to restore normal operations (e.g., "1. Restored affected records from Atlas PIT backup. 2. Re-enabled user accounts.") | Yes | During recovery |
| 17 | PPA Notified | Yes (with date) / No / Not Required. If Yes, reference the PPA form submission. If No but incident is P1/P2, document why it does not meet "Severe Security Incident" threshold. | Yes | When determination is made |
| 18 | Data Subjects Notified | Yes (with date, by PPA order) / No / Not Required / Ordered by PPA (pending). Document PPA direction. | Yes | When determination is made |
| 19 | Lessons Learned | What went well, what went wrong, what to improve. Specific recommendations for preventing recurrence. | Post-incident | Within 7 days of resolution |
| 20 | Plan Updates | Changes made to this Incident Response Plan, RISK-ASSESSMENT.md, or other compliance documents as a result of this incident | Post-incident | Within 14 days of resolution |
| 21 | Resolved Date | Date and time the incident was fully resolved (ISO 8601 UTC) | When resolved | At resolution |
| 22 | Reviewed By | Security Officer sign-off confirming the incident log is complete and accurate | Post-resolution | Within 7 days of resolution |

### 5.2 Example Incident Log Entry

The following is a filled example demonstrating how the template is used. This is a hypothetical incident for documentation purposes.

---

#### Incident: INC-2026-001

| Field | Value |
|-------|-------|
| **Incident ID** | INC-2026-001 |
| **Date/Time Detected** | 2026-04-15T10:30:00Z |
| **Date/Time Occurred** | 2026-04-15T09:15:00Z (estimated based on Atlas access logs) |
| **Reported By** | Sarah Cohen, Tenant Admin (Conservatory: Kfar Saba Music School) |
| **Severity** | P2 -- High (elevated from P3 due to minors' data involvement per Section 2) |
| **Classification** | Unauthorized Access |
| **Affected Systems** | MongoDB Atlas (teacher collection), Express API Server |
| **Affected Data** | teacher.credentials (RESTRICTED per DBDF-01), teacher.teaching.timeBlocks[].assignedLessons[].studentName (RESTRICTED -- denormalized minors' names per DBDF-03) |
| **Affected Tenants** | Kfar Saba Music School (single tenant) |
| **Minors Data Involved** | Yes -- teacher documents contain denormalized student names in assignedLessons[].studentName. Severity elevated from P3 to P2 per Section 2. |
| **Estimated Scope** | 14 teacher records, approximately 85 student names exposed via denormalization |
| **Description** | Tenant admin reported that a former teacher, whose account was deactivated 3 weeks ago, appeared to still be accessing the platform. Investigation revealed that the teacher's JWT refresh token was not invalidated at deactivation (tokenVersion was not incremented). The former teacher used the still-valid refresh token to obtain new access tokens and accessed teacher schedules, which contain denormalized student names. |
| **Root Cause** | Account deactivation procedure (setting `isActive: false`) did not increment `credentials.tokenVersion`, leaving existing refresh tokens valid. The authentication middleware checks `isActive` on login but the refresh token endpoint only validates the token itself, not the account active status. |
| **Containment Actions** | 1. Immediately incremented tokenVersion for the affected teacher account, invalidating all tokens. 2. Verified no other deactivated accounts had active sessions by querying for `isActive: false` with non-null `refreshToken`. 3. Found 2 additional deactivated accounts with stale refresh tokens; incremented their tokenVersion as well. |
| **Eradication Actions** | 1. Added `isActive` check to the refresh token endpoint (`POST /api/auth/refresh`). 2. Added automated tokenVersion increment to the account deactivation flow. 3. Added regression test verifying deactivated accounts cannot refresh tokens. |
| **Recovery Actions** | 1. No data was modified by the unauthorized access (read-only). 2. Verified no export operations were performed during the unauthorized sessions. 3. Confirmed platform operation returned to normal after code fix deployment. |
| **PPA Notified** | Not Required -- incident confined to a single tenant, affected approximately 14 teacher records and 85 student names (denormalized). Assessment: does not meet "substantial part of the database" threshold for the platform as a whole. However, this assessment should be reviewed with Legal Advisor given minors' data involvement. |
| **Data Subjects Notified** | No -- PPA notification not triggered. Tenant admin informed of the issue and remediation. No evidence of data exfiltration or misuse. |
| **Lessons Learned** | 1. Account deactivation must be a comprehensive operation including token invalidation, not just a flag change. 2. The refresh token endpoint must validate account active status, not just token validity. 3. The denormalized studentName field in teacher records increases the blast radius of teacher account compromises to include minors' data. This reinforces the R-12 remediation recommendation. 4. Offboarding procedures (PERS-01) must explicitly include token revocation verification. |
| **Plan Updates** | 1. Updated RISK-ASSESSMENT.md (R-05 example added: token persistence after deactivation). 2. Updated this Incident Response Plan: added token revocation to containment procedures for account compromise. 3. Updated PERSONNEL-SECURITY.md offboarding procedure to include tokenVersion increment verification. |
| **Resolved Date** | 2026-04-15T16:45:00Z |
| **Reviewed By** | Security Officer -- 2026-04-18 |

---

### 5.3 Incident Log Retention and Access

| Aspect | Policy |
|--------|--------|
| **Retention period** | 7 years from incident resolution date. This aligns with the legal obligation retention tier documented in ACCESS-LOGGING-POLICY.md (ACPOL-03), Section 5.1, and ensures incident records are available for regulatory audit and legal proceedings. |
| **Storage location** | Incident logs are stored as markdown files in a dedicated, access-restricted directory. Alternatively, they may be stored in a dedicated MongoDB collection with appropriate access controls. |
| **Access control** | Incident logs are accessible only to: Security Officer, senior management, and Legal Advisor. Incident logs must not be accessible to general development team members or tenant administrators. |
| **Incidents involving minors' data** | Incident logs for incidents flagged as "Minors Data Involved: Yes" are subject to the 7-year minors' data retention period per ACPOL-03 and must be stored with the same access restrictions as minors' data (RESTRICTED classification per DBDF-01). |
| **Regulatory disclosure** | Incident logs may be disclosed to the PPA upon request during a regulatory audit or investigation. The Security Officer is responsible for preparing and delivering requested records. |
| **Archival** | After 2 years in active storage: evaluate migration to secure cold storage (consistent with ACPOL-03, Section 5.3 archive policy). Retain for the full 7-year period regardless of storage tier. |

---

## 6. Review Schedule

### 6.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The annual review must cover:

- Accuracy of severity classification examples against current risk register (RISK-01)
- Currency of role assignments (correct individuals named)
- Completeness of containment procedures against current platform architecture (SMAP-01)
- Effectiveness of detection sources (are monitoring capabilities improving per v1.6 plan?)
- Currency of PPA notification form pre-populated fields
- Lessons learned from any incidents that occurred during the review period

### 6.2 Triggered Review

An immediate review of this document is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| Any P1 or P2 incident | Full document review; incorporate lessons learned; update procedures as needed |
| Significant platform architecture change | Containment procedures and detection sources review |
| New risk identified or existing risk score changed in RISK-01 | Severity classification examples update |
| Regulatory change to Regulation 11 or PPA notification requirements | Breach notification procedure (Section 4) update |
| Change of Security Officer appointment | Role assignments update |
| First production tenant onboarded | Full review; ensure all pre-populated fields are completed; verify communication channels |

### 6.3 Review Accountability

The Security Officer (SECOFF-01/02, Responsibility #5: Incident Coordination) is responsible for conducting all reviews of this document and ensuring updates are made within 14 days of the review trigger.

---

## 7. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Risk Assessment | RISK-01 | Source for all 12 risk examples (R-01 through R-12) mapped to severity levels |
| Security Officer | SECOFF-01/02 | Incident Commander role assignment; Responsibility #5 (incident coordination) |
| Access Logging Policy | ACPOL-03 | Detection sources (logging categories); 4-level escalation procedure (Section 6.3); log retention periods |
| Data Inventory | DBDF-01 | Collection and field classification referenced in incident scope assessment |
| Minors Data Analysis | DBDF-03 | Minors' data locations; automatic severity elevation rationale |
| Architecture Diagram | SMAP-01 | Platform components referenced in scope and containment procedures |
| Data Flow Map | SMAP-02 | Data flow paths for breach impact tracing |
| Vendor Inventory | SMAP-03 | Vendor contact information for vendor-related incidents |
| Security Procedures | SECPR-01/02/03 | Parent security procedure document; SECPR-02 for backup/recovery during incidents |
| Access Control Policy | ACPOL-01 | Role-based access that determines scope of account compromise |
| Auth Policy | ACPOL-02 | Authentication controls referenced in containment (token revocation, secret rotation) |
| Glossary | GLOSS-01 | Hebrew-English regulatory terminology |

---

**Document ID:** INCD-01/02/03 -- Incident Response Plan
**Phase:** 29 -- Operational Procedures
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
