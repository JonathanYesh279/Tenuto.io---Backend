# Access Logging Policy

**Document ID:** ACPOL-03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon logging infrastructure changes
**Related Documents:** SECOFF-01/02 (Security Officer), SECPR-01/02/03 (Security Procedures), ACPOL-01 (Access Control Policy), DBDF-01 (Data Inventory), DBDF-03 (Minors Data), RISK-01 (Risk Assessment, specifically R-08), GLOSS-01 (Glossary)

---

## 1. Purpose

This document defines the access logging requirements for the Tenuto.io platform, as required by **Regulation 12** (Takanat 12) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017. It specifies what events must be logged, where logs are stored, retention periods, and the review process.

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, automatic documentation mechanisms for access events must be maintained and periodically reviewed.

---

## 2. Current Logging Infrastructure

### 2.1 Existing Log Targets

The platform currently maintains the following log targets:

| Log Target | Storage | What Is Logged | Scope | Compliance Grade |
|-----------|---------|---------------|-------|-----------------|
| `platform_audit_log` | MongoDB collection (platform-level) | Super admin actions: impersonation start/end, tenant management (CRUD), admin account management, all mutating actions during impersonation sessions | Platform-wide | **ADEQUATE** -- structured, queryable, includes actor/action/target/timestamp |
| `deletion_audit` | MongoDB collection (tenant-scoped) | Cascade deletion events: entity type, entity IDs, operator, deletion timestamp, cascade details (affected collections and counts) | Per-tenant | **ADEQUATE** for deletion events -- structured, includes audit context |
| `security_log` | MongoDB collection (tenant-scoped) | Limited security events (collection exists but usage is minimal in current codebase) | Per-tenant | **INADEQUATE** -- collection exists but is sparsely populated |
| `import_log` | MongoDB collection (tenant-scoped) | Import operations: file type, upload user, preview data, execution results, timestamps | Per-tenant | **PARTIAL** -- operational metadata logged, but no security event context |
| Pino logger | stdout (Render platform logs) | Application-level operational logs: HTTP requests/responses, errors, stack traces, startup events | Unstructured, ephemeral | **NOT COMPLIANCE GRADE** -- unstructured text logs, not queryable for audit, retention controlled by Render (30 days default) |

### 2.2 Infrastructure Assessment

**What works well:**
- `platform_audit_log` provides a solid model for structured audit logging -- it captures actor identity, action type, target entity, details, IP address, and timestamp
- Impersonation session logging is comprehensive -- start, end, and all mutating actions are captured
- The `deletion_audit` collection provides full traceability for cascade deletion operations

**What is missing:**
- No tenant-level administrative action logging (who created/edited/deleted users, changed settings)
- No authentication event logging (login success/failure, token refresh, password changes)
- No authorization failure logging (permission denied events, role check failures)
- No minors' data access logging (who read/wrote student or bagrut records)
- No data modification audit trail for non-deletion operations (creates and updates on PII collections)
- No export event logging (ministry report generation as security events)
- No configuration change logging (school year changes, tenant settings modifications)

---

## 3. Required Logging Events

### 3.1 Event Categories

The following table defines 10 event categories with their current logging state and priority for v1.6 implementation.

| # | Event Category | Specific Events | Current State | Priority | v1.6 Plan |
|---|---------------|----------------|---------------|----------|-----------|
| 1 | **Authentication** | Login success, login failure (with reason: wrong password, not found, tenant deactivated, locked), logout, token refresh, password change, password reset request/completion, force logout (tokenVersion bump) | **NOT LOGGED** -- only `credentials.lastLogin` overwritten timestamp | **CRITICAL** | Structured auth event logging to `security_log` collection; see AUTH-POLICY.md (ACPOL-02) Section 9 |
| 2 | **Authorization failures** | Permission denied by `requireAuth()`, role check failures by `PermissionService.hasPermission()`, IDOR attempts blocked by `canAccessStudent()` or `buildScopedFilter()`, tenant isolation violations caught by `enforceTenant` | **NOT LOGGED** -- silently rejected with HTTP 403 | **HIGH** | Log to `security_log` with full request context (actor, role, attempted resource, IP) |
| 3 | **Minors' data access** | Read operations on `student` and `bagrut` collections, write operations on `student` and `bagrut` collections, student data returned in API responses | **NOT LOGGED** -- no specific audit trail for minors' data access | **CRITICAL** (per DBDF-03) | Dedicated minors' data access log -- every read/write to student and bagrut collections with actor, timestamp, operation type, student IDs accessed |
| 4 | **Data modification** | Create/update/delete operations on PII-containing collections: `teacher`, `student`, `bagrut`, `tenant`, `super_admin`, and blob collections (`import_log`, `ministry_report_snapshots`, `deletion_snapshots`, `tenant_deletion_snapshots`, `migration_backups`) -- 11 collections from DBDF-01 data classification | **PARTIAL** -- `deletion_audit` covers deletes only; creates and updates not logged | **HIGH** | Comprehensive change audit log capturing all CUD operations on PII collections |
| 5 | **Admin operations** | Tenant admin role changes, user creation/deactivation, bulk operations (import execution), tenant settings modifications, school year management | **NOT LOGGED** at tenant level -- only super admin actions logged in `platform_audit_log` | **MEDIUM** | Tenant admin audit log (either extend `security_log` or create dedicated `admin_audit_log`) |
| 6 | **Super admin operations** | Tenant CRUD, platform reporting, admin account management, system configuration | **LOGGED** in `platform_audit_log` | **ADEQUATE** | Maintain current logging; ensure completeness of action types |
| 7 | **Impersonation actions** | Impersonation session start/end, all mutating actions (create/update/delete) during impersonation sessions | **LOGGED** in `platform_audit_log` | **ADEQUATE** | Maintain current logging; add read-action logging during impersonation for full traceability |
| 8 | **Data export events** | Ministry report generation, Excel export downloads, completion status checks | **PARTIAL** -- `ministry_report_snapshots` stores the generated report data but no security event log entry is created | **MEDIUM** | Export event logging to `security_log` or dedicated collection; capture who exported, when, what data scope |
| 9 | **Data import events** | Import file upload, preview generation, import execution, import failures | **PARTIAL** -- `import_log` stores operational metadata (type, status, preview data, results) but no security event context (IP, user agent, authorization context) | **LOW** | Enhance `import_log` with security event fields; or create separate security event entries in `security_log` |
| 10 | **Configuration changes** | School year create/update/set-current/rollover, tenant settings modifications, subscription changes | **NOT LOGGED** -- settings changes happen silently | **MEDIUM** | Configuration change audit log capturing before/after values |

### 3.2 Category Priority Summary

- **CRITICAL (must implement in v1.6 Phase 1):** Categories 1 (authentication) and 3 (minors' data access)
- **HIGH (v1.6 Phase 1):** Categories 2 (authorization failures) and 4 (data modification)
- **MEDIUM (v1.6 Phase 2):** Categories 5 (admin operations), 8 (export events), 10 (configuration changes)
- **LOW (v1.6 stretch goals):** Category 9 (import event enhancement)
- **ADEQUATE (maintain):** Categories 6 (super admin) and 7 (impersonation)

---

## 4. Log Entry Format

### 4.1 Required Fields

Every compliance-grade log entry must contain the following fields. This format is based on the existing `platform_audit_log` structure, extended for tenant-level logging.

| Field | Type | Description | Example | Required |
|-------|------|------------|---------|----------|
| `_id` | ObjectId | Unique entry identifier | `ObjectId("...")` | Auto-generated |
| `timestamp` | Date (ISO 8601 UTC) | When the event occurred | `2026-03-02T14:30:00.000Z` | Yes |
| `eventType` | string | Dot-notation category and event | `"authentication.login_success"` | Yes |
| `actorId` | ObjectId / string | User performing the action (teacher or super_admin ID) | `ObjectId("...")` | Yes (null for anonymous events like failed login by unknown email) |
| `actorRole` | string | Role at time of action (Hebrew role name from `teacher.roles[]`) | `"מנהל"` | Yes |
| `tenantId` | string | Tenant context (null for platform-level events) | `ObjectId("...")` | Yes for tenant-scoped events |
| `resourceType` | string | Target collection or entity type | `"student"`, `"teacher"`, `"bagrut"` | Yes for resource-related events |
| `resourceId` | ObjectId / string | Target entity ID | `ObjectId("...")` | Yes for single-resource events |
| `action` | string | Specific operation performed | `"read"`, `"create"`, `"update"`, `"delete"`, `"login"`, `"denied"` | Yes |
| `details` | object | Additional event-specific context | `{ fields_changed: ["personalInfo.phone"], reason: "wrong_password" }` | Optional but recommended |
| `ipAddress` | string | Client IP address | `"192.168.1.1"` | Yes for client-facing events |
| `userAgent` | string | Client browser/application identifier | `"Mozilla/5.0..."` | Yes for client-facing events |
| `result` | string | Outcome of the operation | `"success"`, `"denied"`, `"error"` | Yes |

### 4.2 Event Type Naming Convention

Event types follow a dot-notation hierarchy: `{category}.{specific_event}`

Examples:
- `authentication.login_success`
- `authentication.login_failure`
- `authorization.permission_denied`
- `authorization.idor_blocked`
- `minors_data.student_read`
- `minors_data.bagrut_update`
- `data_modification.teacher_update`
- `admin.user_created`
- `admin.role_changed`
- `config.school_year_changed`
- `export.ministry_report_generated`

### 4.3 Sensitive Data in Log Entries

Log entries must **NOT** contain:
- Passwords (plaintext or hashed)
- JWT tokens
- Full request/response bodies containing PII
- Student personal details (names, addresses, phone numbers) -- use IDs only

Log entries **MAY** contain:
- User IDs (actorId, resourceId)
- Email addresses (for login events where the email is the identifier)
- IP addresses (necessary for security investigation)
- Field names that were changed (but not field values)
- Role names and tenant identifiers

---

## 5. Log Retention Policy

### 5.1 Retention Periods by Category

| Log Category | Collection | Retention Period | Rationale | Enforcement Mechanism |
|-------------|-----------|-----------------|-----------|---------------------|
| Authentication events | `security_log` | 2 years | Security investigation window; sufficient for pattern analysis and incident response | TTL index on `timestamp` (v1.6) |
| Authorization failures | `security_log` | 2 years | Security investigation window; detect persistent unauthorized access attempts | TTL index on `timestamp` (v1.6) |
| Minors' data access | Dedicated collection (v1.6) | 7 years | Regulatory requirement for minors' data; aligns with legal obligation retention | TTL index on `timestamp` (v1.6) |
| Data modification audit | Dedicated collection (v1.6) | 7 years | Legal obligation -- must be able to reconstruct data modification history | TTL index on `timestamp` (v1.6) |
| Admin operations | `security_log` or dedicated collection | 7 years | Legal obligation -- administrative actions affecting user accounts | TTL index on `timestamp` (v1.6) |
| Super admin operations | `platform_audit_log` | 7 years | Legal obligation -- platform governance audit trail | TTL index on `timestamp` (v1.6) |
| Impersonation actions | `platform_audit_log` | 7 years | Legal obligation -- cross-tenant access must be fully auditable | TTL index on `timestamp` (v1.6) |
| Export events | Dedicated collection or `security_log` | 7 years | Ministry reporting traceability; must demonstrate when and by whom reports were generated | TTL index on `timestamp` (v1.6) |
| Import events | `import_log` | 2 years | Operational -- import metadata for data quality tracking | TTL index on `createdAt` (v1.6) |
| Application logs (Pino) | Render stdout | 30 days | Operational debugging; controlled by Render platform retention | Render platform configuration |

### 5.2 Retention Enforcement Gap

**Current state:** No collection in the platform has TTL (Time-To-Live) indexes. All log data is retained indefinitely. This includes `platform_audit_log`, `deletion_audit`, `security_log`, and `import_log`.

**v1.6 plan:** Implement TTL indexes on all log collections per the retention periods specified above. See R-11 (No Data Retention Enforcement) in RISK-ASSESSMENT.md (RISK-01).

### 5.3 Archive Policy

For log categories with 7-year retention:
- **Years 0-2:** Active storage in MongoDB -- queryable for investigation and compliance reporting
- **Years 2-7:** Evaluate migration to cold storage (e.g., S3 archive tier) to reduce database storage costs while maintaining legal compliance
- **Implementation:** Archive migration is a v1.7+ consideration; for v1.6, all data remains in MongoDB with TTL enforcement

---

## 6. Log Review Process

### 6.1 Scheduled Reviews

The Security Officer (SECOFF-01/02, Responsibility #3: Continuous Monitoring Plan) is responsible for establishing and executing the following review schedule.

| Review Type | Frequency | Reviewer | Focus Areas | Deliverable |
|------------|-----------|---------|-------------|-------------|
| Authentication anomalies | Weekly (when Category 1 implemented) | Security Officer or delegate | Failed login patterns (multiple failures from same IP, attempts across multiple accounts), unusual login times, login from new geographic regions, account lockout events | Weekly authentication review summary; escalate anomalies within 24 hours |
| Minors' data access | Monthly (when Category 3 implemented) | Security Officer | Verify access is appropriate and role-scoped; detect unusually high access volumes; identify access from unexpected roles; compare access patterns against teacher assignments | Monthly minors' data access review report |
| Admin action review | Monthly | Security Officer | Role changes (especially escalation to admin), user creation/deactivation, bulk operations, settings changes | Monthly admin action review report |
| Super admin activity | Monthly | Security Officer | Impersonation sessions (frequency, duration, actions taken), tenant management actions, admin account changes | Monthly super admin activity report |
| Authorization failures | Monthly (when Category 2 implemented) | Security Officer | Patterns of denied access (persistent attempts by same actor, IDOR attempts, role escalation attempts) | Monthly authorization review report |
| Full audit log review | Quarterly | Security Officer | Comprehensive cross-category review; trend analysis; comparison against previous quarter; identification of new patterns or concerns | Quarterly audit review report with findings and recommendations |

### 6.2 Ad-Hoc Review Triggers

The following events trigger an immediate, unscheduled log review:

| Trigger | Scope | Response Time |
|---------|-------|---------------|
| Suspected security incident | All log categories relevant to the incident scope | Immediate -- within 4 hours of detection |
| User complaint about unauthorized access | Authentication + authorization + minors' data access logs for the reported period | Within 24 hours of complaint receipt |
| Anomaly detected in scheduled review | Extended review of the anomalous pattern across all related log categories | Within 48 hours of anomaly detection |
| Regulatory audit request | All log categories for the requested period | As specified by the audit timeline |
| Data subject access request | Access logs related to the specific data subject's records | Within 30 days per regulatory requirement |
| New security vulnerability disclosed (affecting platform dependencies) | Authentication logs + access patterns for the vulnerability window | Within 24 hours of disclosure |

### 6.3 Escalation Procedure

```
Level 1: Anomaly detected during scheduled or ad-hoc review
         -> Security Officer notified within 24 hours
         -> Security Officer assesses severity

Level 2: Confirmed security event (unauthorized access, data breach, persistent attack)
         -> Incident Response Plan activated (Phase 29 deliverable)
         -> Senior management notified within 24 hours of confirmation
         -> Begin incident investigation and containment

Level 3: Regulatory breach suspected (minors' data exposed, cross-tenant leak, bulk PII exposure)
         -> Senior management notified immediately
         -> Privacy Protection Authority notification evaluated per Regulation 11a
         -> Legal counsel engaged
         -> Affected data subjects notification evaluated

Level 4: Ongoing attack detected (active exploitation, persistent unauthorized access)
         -> Immediate technical response (IP blocking, token invalidation, account lockout)
         -> Security Officer and senior management notified immediately
         -> External security support engaged if needed
```

---

## 7. Current Gaps and Remediation (R-08 from RISK-01)

### 7.1 R-08: Insufficient Logging for Compliance

**Source:** RISK-ASSESSMENT.md (RISK-01), Risk R-08
**Risk Level:** MEDIUM (Medium Likelihood x Medium Impact)

The risk assessment identifies the platform's audit logging as insufficient for compliance demonstration. The specific gaps are:

| Severity | Categories Affected | Current State | v1.6 Remediation |
|----------|-------------------|---------------|------------------|
| **CRITICAL** | Category 1 (Authentication), Category 3 (Minors' data access) | **NOT LOGGED** at all | Implement structured logging as highest priority in v1.6 |
| **HIGH** | Category 2 (Authorization failures), Category 4 (Data modification) | **NOT LOGGED** (auth failures) / **PARTIAL** (modifications -- only deletes via deletion_audit) | Implement in v1.6 Phase 1 alongside critical categories |
| **MEDIUM** | Category 5 (Admin operations), Category 8 (Export events), Category 10 (Configuration changes) | **NOT LOGGED** at tenant level | Implement in v1.6 Phase 2 |
| **LOW** | Category 9 (Import events) | **PARTIAL** -- operational metadata exists in `import_log` | Enhance with security event context in v1.6 |
| **ADEQUATE** | Category 6 (Super admin), Category 7 (Impersonation) | **LOGGED** in `platform_audit_log` | Maintain; consider adding read-action logging during impersonation |

### 7.2 Implementation Roadmap

**v1.6 Phase 1 (Critical + High):**
1. Create structured logging service (follows `platform_audit_log` schema pattern)
2. Implement Category 1: Authentication event logging
3. Implement Category 3: Minors' data access logging
4. Implement Category 2: Authorization failure logging
5. Implement Category 4: Data modification audit (extend beyond deletion_audit)
6. Add TTL indexes on all log collections

**v1.6 Phase 2 (Medium):**
7. Implement Category 5: Tenant admin operations logging
8. Implement Category 8: Export event logging
9. Implement Category 10: Configuration change logging
10. Implement log review dashboard for Security Officer

**v1.6 Phase 3 (Low + Enhancement):**
11. Enhance Category 9: Import event security context
12. Add read-action logging during impersonation sessions (Category 7 enhancement)
13. Implement automated anomaly detection for authentication patterns
14. Implement log archival pipeline for cold storage

---

## 8. User Notification

### 8.1 Transparency Requirement

Users of the platform should be informed that their access and activity may be logged for security and compliance purposes. This is a transparency requirement under Israeli privacy regulations.

### 8.2 Current State

**No user notification mechanism exists.** Users are not informed that their activities are or will be logged.

### 8.3 Recommended Implementation

- Add a login banner or terms-of-service clause informing users that activity is monitored for security purposes
- Include activity monitoring disclosure in the platform's privacy policy (Phase 30 deliverable)
- Ensure the notification is presented in Hebrew (the platform's primary language) with clear, non-technical language
- The full user notification and privacy policy framework is planned as a **Phase 30 deliverable**

---

## 9. Review Schedule

### 9.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Accuracy of current logging infrastructure description against actual platform state
- Completeness of event categories against current API surface
- Currency of retention periods against regulatory requirements
- Status of v1.6 implementation roadmap items
- Effectiveness of the review process (are reviews happening on schedule? are anomalies being detected?)

### 9.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| New logging infrastructure deployed (v1.6 implementation) | Full document update to reflect new current state |
| Security incident revealing logging gaps | Gap analysis update; remediation priority reassessment |
| Regulatory change affecting logging requirements | Retention periods and event category review |
| Change to platform architecture affecting data flows | Event categories and log target review |
| Render platform logging changes | Application log retention and format review |

---

## 10. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Security Officer | SECOFF-01/02 | Document owner; responsible for log review process execution (Responsibility #3) |
| Security Procedures | SECPR-01/02/03 | Parent procedure document; this policy implements logging requirements from SECPR-01a |
| Access Control Policy | ACPOL-01 | Defines roles and permissions whose enforcement this policy logs |
| Auth Policy | ACPOL-02 | Defines authentication controls whose events this policy logs (Section 9) |
| Data Inventory | DBDF-01 | Source for collection classification; determines which collections require modification logging |
| Minors Data Analysis | DBDF-03 | Source for minors' data access logging requirements (Category 3) |
| Risk Assessment | RISK-01 | Source for R-08 (Insufficient Logging) risk and gap analysis |
| Glossary | GLOSS-01 | Terminology reference for regulatory terms |

---

**Document ID:** ACPOL-03 -- Access Logging Policy
**Phase:** 28 -- Governance Framework and Security Policies
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
