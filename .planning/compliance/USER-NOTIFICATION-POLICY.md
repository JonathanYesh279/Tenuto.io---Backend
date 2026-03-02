# User Notification Policy -- Monitoring and Activity Logging

**Document ID:** LOG-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon changes to monitoring capabilities
**Related Documents:** ACPOL-03 (Access Logging Policy), SECOFF-01/02 (Security Officer Role and Appointment), PERS-01/02/03 (Personnel Security Procedures), ACPOL-01 (Access Control Policy), GLOSS-01 (Glossary)

---

## 1. Purpose

This document establishes the user notification policy for the Tenuto.io music conservatory management platform, fulfilling the transparency requirement of **Regulation 10(e)** (Takanat 10(e)) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 10(e) requires: "A database controller will inform the database authorized users of the monitoring mechanism to the database systems."

This document satisfies the transparency requirement by defining how all authorized users are informed that their access and activity are logged and monitored. It specifies the notification text, delivery mechanism, user rights, and monitoring data retention.

ACCESS-LOGGING-POLICY.md (ACPOL-03) Section 8 explicitly identified this gap -- "No user notification mechanism exists" -- and deferred the full notification framework to Phase 30. This document closes that gap at the policy level.

---

## 2. Notification Scope

### 2.1 Who Receives the Notification

The monitoring notification must be provided to **all authorized users** of the Tenuto.io platform, covering every user category defined in ACCESS-CONTROL-POLICY.md (ACPOL-01):

**Platform Personnel:**

| Role | Notification Method | Scope of Monitoring |
|------|-------------------|-------------------|
| Super Admin (Menahel-Al) | Written onboarding materials (PERS-01 Step 2) + login banner (when implemented) | All infrastructure and application access, all impersonation sessions, all tenant management operations |
| Developer | Written onboarding materials (PERS-01 Step 2) | Infrastructure access, code deployment activities |
| Security Officer | Written onboarding materials (PERS-01 Step 2) | All system access, audit activities |

**Tenant Personnel:**

| Role | Notification Method | Scope of Monitoring |
|------|-------------------|-------------------|
| Conservatory Admin (Menahel) | Login banner (when implemented) + security awareness training (PERS-02 Topic 1) | All application access within their tenant scope |
| Teacher (Moreh) | Login banner (when implemented) + security awareness training (PERS-02 Topic 1) | All application access within their assignment scope |
| Conductor (Menatze'akh) | Login banner (when implemented) + security awareness training (PERS-02 Topic 1) | All application access within their tenant scope |
| Ensemble Instructor (Madrich Herkev) | Login banner (when implemented) + security awareness training (PERS-02 Topic 1) | All application access within their tenant scope |
| Theory Teacher (Moreh Teoria) | Login banner (when implemented) + security awareness training (PERS-02 Topic 1) | All application access within their tenant scope |

### 2.2 When the Notification Is Provided

- **New users:** Upon first login after account creation (login banner) or during onboarding (written materials)
- **Existing users:** When monitoring capabilities change (updated login banner)
- **Periodic reminder:** At least annually, recommended at school year start (September), aligned with the PERS-02 training refresher cycle

---

## 3. Current Monitoring Capabilities

This section documents what is and is not currently monitored. It is the factual basis for the notification text in Section 4. This section must be updated whenever monitoring capabilities change.

### 3.1 What IS Currently Logged

The following logging capabilities exist as of the date of this document. Source: ACCESS-LOGGING-POLICY.md (ACPOL-03) Section 2.1.

| Log Target | What Is Logged | Collection / Location | Compliance Grade |
|-----------|---------------|----------------------|-----------------|
| Super admin audit log | Login, impersonation start/end, tenant management (CRUD), admin account management, all mutating actions during impersonation sessions | `platform_audit_log` (MongoDB) | ADEQUATE -- structured, queryable, includes actor/action/target/timestamp |
| Deletion audit | All cascade deletion operations with full document snapshots, including entity type, entity IDs, operator, deletion timestamp, and cascade details | `deletion_snapshots` (MongoDB) | ADEQUATE for deletion events |
| Security events | Limited security events (collection exists but usage is minimal in current codebase) | `security_log` (MongoDB) | INADEQUATE -- sparsely populated |
| Import operations | Import file type, upload user, preview data, execution results, timestamps | `import_log` (MongoDB) | PARTIAL -- operational metadata only, no security event context |
| Application logs | HTTP requests/responses, server-side errors, stack traces, startup events | Pino logger -> Render platform logs (30-day retention) | NOT COMPLIANCE GRADE -- unstructured, not queryable for audit |
| Last login timestamp | Most recent successful login time (single overwritten value, not a history) | `teacher.credentials.lastLogin` field | MINIMAL -- no login history, just most recent |

### 3.2 What Is NOT Currently Logged

The following categories of activity are **not currently logged**. Source: ACCESS-LOGGING-POLICY.md (ACPOL-03) Section 3.1.

| Activity Category | Current State | Priority for Implementation |
|------------------|---------------|---------------------------|
| Authentication events (login success/failure, logout, token refresh, password changes) | NOT LOGGED -- only `credentials.lastLogin` overwritten timestamp | CRITICAL (ACPOL-03 Category 1) |
| Authorization failures (permission denied, role check failures, IDOR blocks) | NOT LOGGED -- silently rejected with HTTP 403 | HIGH (ACPOL-03 Category 2) |
| Individual record access (student/teacher data reads) | NOT LOGGED | CRITICAL for minors' data (ACPOL-03 Category 3) |
| Data modification (creates and updates on PII collections) | PARTIAL -- only deletes via `deletion_audit`; creates and updates not logged | HIGH (ACPOL-03 Category 4) |
| Data export operations (ministry report generation) | NOT LOGGED as security events | MEDIUM (ACPOL-03 Category 8) |
| Report generation | NOT LOGGED | MEDIUM |
| Search queries | NOT LOGGED | LOW |
| Session duration and activity patterns | NOT TRACKED | MEDIUM |
| Configuration changes (school year, tenant settings) | NOT LOGGED | MEDIUM (ACPOL-03 Category 10) |

### 3.3 Planned Enhancements (v1.6 Technical Hardening)

The v1.6 milestone will implement comprehensive access logging covering all data operations. Planned capabilities include:

- Structured authentication event logging (all login, logout, token, and password events)
- Authorization failure logging with full request context
- Minors' data access logging (dedicated audit trail for student and bagrut collection access)
- Data modification audit trail for all PII-containing collections
- Export event logging
- Anomaly detection for authentication patterns
- Real-time alerting for security events

The implementation roadmap is detailed in ACCESS-LOGGING-POLICY.md (ACPOL-03) Section 7.2.

---

## 4. Notification Text

### 4.1 Draft Notification (English)

The following notification text is intended for display to all authorized users. It accurately reflects the current monitoring state described in Section 3.

> **Platform Activity Monitoring Notice**
>
> Your access to and activity within Tenuto.io may be logged and monitored for security and regulatory compliance purposes.
>
> This includes:
> - Login events and session information
> - Administrative actions (account management, data changes)
> - Data access and operations within the platform
>
> Monitoring is conducted to protect the security of personal data held on the platform, including student information, and to comply with the Israeli Privacy Protection Regulations (Information Security), 5777-2017. Monitoring data is not used for performance evaluation of individual users.
>
> Monitoring data is retained in accordance with our data retention policy: operational logs for 30 days, security logs for 2 years, and legal/compliance logs for 7 years.
>
> For questions about monitoring practices or to exercise your rights regarding monitored data, contact the Security Officer at [SECURITY_OFFICER_EMAIL].
>
> By continuing to use the platform, you acknowledge this monitoring notice.

### 4.2 Language Notes

- The notification uses "may be logged and monitored" rather than "is actively monitored" to honestly reflect that not all monitoring categories listed in ACPOL-03 Section 3.1 are currently implemented. As monitoring capabilities are activated in v1.6, the notification text should be updated to replace "may be" with "is" for categories where logging is fully operational.
- **Hebrew translation is required before production deployment.** The platform's primary user base consists of conservatory teachers and administrators who operate in Hebrew. The notification must be provided in clear, non-technical Hebrew accessible to educators without a technical background.
- The notification text should be reviewed by the Security Officer and, if available, legal counsel before deployment.

### 4.3 Notification Text Maintenance

The notification text must be updated whenever:

- New monitoring categories are activated (e.g., v1.6 authentication logging goes live)
- Retention periods change
- The Security Officer contact information changes
- The regulatory basis changes (e.g., Amendment 13 secondary regulations)

Each update requires a version increment on this document and re-delivery of the notification to all active users.

---

## 5. Notification Delivery Mechanism

### 5.1 Recommended Primary Method: Login Banner

The recommended primary notification delivery mechanism is a **login banner** displayed within the platform:

- **First display:** Upon first login after the notification policy is deployed
- **Periodic display:** At least once per school year (recommended: at the start of each school year in September, aligned with the PERS-02 training refresher cycle)
- **Re-display triggers:** When the notification text is updated (new monitoring capabilities activated, retention changes)
- **Acknowledgment:** User must acknowledge the banner to proceed (click "I understand" or equivalent)
- **Acknowledgment record:** Store acknowledgment timestamp per user for compliance evidence

**Implementation:** Deferred to v1.6. The login banner requires frontend development (display logic, acknowledgment tracking) and backend support (acknowledgment storage, display trigger logic).

### 5.2 Alternative Method: Terms of Service Clause

If the login banner is not available at initial production launch:

- Include the monitoring notification as a clearly identified clause in the platform's Terms of Service or Acceptable Use Policy
- Present the Terms of Service during first login with required acceptance
- This approach is less visible than a login banner but satisfies the transparency requirement

### 5.3 Supplementary Methods

- **Security awareness training (PERS-02):** Topic 1 (Platform overview and data responsibilities) should reference that user activity may be logged and monitored. This reinforces the notification during the training cycle.
- **Written onboarding materials (PERS-01):** For pre-launch and early production: include the monitoring notification in the written onboarding packet provided to new tenant personnel and platform personnel during onboarding Steps 2-3.

### 5.4 Pre-Launch Approach

Until the login banner is implemented in v1.6:

1. Include the monitoring notification text (Section 4.1) in written onboarding materials provided during PERS-01 onboarding procedures
2. Include the monitoring notification as a section in the security awareness training briefing (PERS-02)
3. Obtain written acknowledgment from each user as part of the onboarding process

This approach satisfies the Regulation 10(e) transparency requirement through documented notification delivery, even without a technical implementation.

---

## 6. User Rights Regarding Monitored Data

### 6.1 Right to Information

Users may request information about what data is logged about their activity on the platform. This includes:

- What categories of activity are logged (as documented in Section 3)
- How long their monitoring data is retained (as documented in Section 7)
- Who has access to their monitoring data (Security Officer and authorized reviewers per ACPOL-03 Section 6)

### 6.2 Right to Correction

Users may request correction of inaccurate monitoring data if they believe a log entry incorrectly attributes an action to them or contains factual errors.

### 6.3 Request Process

- All requests regarding monitored data are directed to the **Security Officer** per SECOFF-01/02
- Contact: [SECURITY_OFFICER_EMAIL] (to be completed in the appointment document)
- The Security Officer will acknowledge receipt within 7 days
- Response timeline: within **30 days** per the Israeli Privacy Protection Law's data subject access provisions
- If the request cannot be fulfilled within 30 days, the Security Officer will provide a written explanation and revised timeline

### 6.4 Limitations

- Log entries created for security purposes (authentication events, authorization failures, incident investigation) may not be deleted at the user's request, as they serve a legitimate security and compliance function
- Log entries may be redacted rather than disclosed in full if disclosure would compromise security controls or reveal information about other users

---

## 7. Monitoring Data Retention

Monitoring data is retained according to the retention schedule defined in ACCESS-LOGGING-POLICY.md (ACPOL-03) Section 5:

| Log Category | Retention Period | Rationale |
|-------------|-----------------|-----------|
| Application/operational logs (Pino/Render) | 30 days | Operational debugging; controlled by Render platform |
| Authentication and authorization events | 2 years | Security investigation window; pattern analysis |
| Import operation logs | 2 years | Operational data quality tracking |
| Minors' data access logs (when implemented) | 7 years | Regulatory requirement for minors' data |
| Data modification audit trail | 7 years | Legal obligation -- must be able to reconstruct modification history |
| Admin/super admin operations | 7 years | Legal obligation -- governance audit trail |
| Impersonation session logs | 7 years | Legal obligation -- cross-tenant access audit trail |
| Export event logs | 7 years | Ministry reporting traceability |

**Current enforcement gap:** No MongoDB collection currently has TTL (Time-To-Live) indexes. All log data is retained indefinitely. TTL enforcement is planned for v1.6. See ACPOL-03 Section 5.2 and R-11 (No Data Retention Enforcement) in RISK-ASSESSMENT.md (RISK-01).

---

## 8. Review Schedule

### 8.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Accuracy of Section 3 (Current Monitoring Capabilities) against the actual platform logging state
- Currency of the notification text (Section 4) against current capabilities -- update "may be" to "is" for categories where logging is fully implemented
- Effectiveness of the delivery mechanism (are users receiving and acknowledging the notification?)
- Alignment with ACPOL-03 if the access logging policy has been updated

### 8.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| New monitoring categories activated (v1.6 implementation) | Full document update -- Sections 3, 4, and 7 |
| Change to monitoring data retention periods | Sections 4 and 7 |
| Change to notification delivery mechanism | Section 5 |
| Security Officer appointment or change | Sections 4 (contact info) and 6 (request process) |
| Regulatory change affecting transparency requirements (e.g., Amendment 13) | Full document review |
| User complaint about insufficient notification | Review notification text clarity and delivery mechanism |

---

## 9. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Access Logging Policy | ACPOL-03 | Primary source for current monitoring capabilities (Section 2.1), planned categories (Section 3.1), and retention schedule (Section 5). Section 8 explicitly defers user notification to this document. |
| Security Officer | SECOFF-01/02 | Document owner; contact point for user rights requests (Section 6); notification policy maintenance is part of overall security governance |
| Personnel Security | PERS-01/02/03 | PERS-01: Onboarding procedures include notification delivery. PERS-02: Training Topic 1 references monitoring. PERS-03: Confidentiality agreement covers awareness of monitoring |
| Access Control Policy | ACPOL-01 | Defines the authorized user categories (Section 3) that determine notification scope (Section 2) |
| Risk Assessment | RISK-01 | R-08 (Insufficient Logging) provides context for the honest monitoring gap disclosure in Section 3.2 |
| Glossary | GLOSS-01 | Terminology reference for Hebrew-English regulatory terms |

---

**Document ID:** LOG-01 -- User Notification Policy
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
