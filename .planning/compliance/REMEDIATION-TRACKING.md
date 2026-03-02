# Remediation Tracking Process

**Document ID:** AUDT-03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Quarterly review of register status; annual review of process
**Related Documents:** RISK-01 (Risk Assessment), SECOFF-01/02 (Security Officer Role and Appointment), AUDT-01 (Periodic Security Audit Program), AUDT-02 (Compliance Self-Assessment Checklist), INCD-01/02/03 (Incident Response Plan), GLOSS-01 (Glossary)

---

## 1. Purpose

This document formalizes the lifecycle for tracking audit findings and compliance gaps from identification through resolution, as required by **Regulation 18** (Takanat 18) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 18 requires that the periodic audit include: "identification of deficiencies and proposals for remediating them." This document provides the structured framework for that identification and remediation process.

This document serves two functions:

1. **Process definition (Sections 2-7):** Defines the finding lifecycle, severity framework, roles, finding template, tracking mechanism, and reporting cadence for managing compliance findings.
2. **Initial remediation register (Section 8):** Provides the baseline register pre-populated with ALL known gaps identified during the v1.5 compliance documentation phase (Phases 27-30). This makes the compliance program immediately actionable by consolidating all "Gap Analysis", "Planned Remediation (v1.6)", and risk assessment findings into a single tracking list.

---

## 2. Finding Lifecycle

### 2.1 Lifecycle Stages

Every finding progresses through a defined lifecycle from identification to closure:

```
OPEN -> ASSIGNED -> IN PROGRESS -> VERIFICATION -> CLOSED
```

| Stage | Definition | Entry Criteria | Exit Criteria | Responsible |
|-------|-----------|----------------|---------------|-------------|
| **Open** | Finding identified, not yet assigned | New finding from audit, self-assessment, incident, or gap analysis | Owner and priority assigned | Security Officer |
| **Assigned** | Owner identified, remediation not started | Priority, severity, and target timeline set | Remediation work begins | Finding Owner |
| **In Progress** | Remediation work actively underway | Work has started (first commit, configuration change, or document update) | Remediation complete, ready for verification | Finding Owner |
| **Verification** | Remediation implemented, pending confirmation | Owner marks complete with evidence of remediation | Verified by someone other than the owner | Security Officer or External Auditor |
| **Closed** | Finding fully resolved and verified | Verification passed; evidence documented | N/A -- terminal state | Security Officer |

### 2.2 Additional States

| State | Definition | Conditions | Responsible |
|-------|-----------|-----------|-------------|
| **Accepted** | Risk formally accepted with documented justification | LOW severity findings only, per RISK-01 Section 6.4 risk acceptance criteria. Requires written justification and senior management approval. | Security Officer + Senior Management |
| **Deferred** | Remediation intentionally delayed to a future cycle | Documented reason, target date (e.g., v1.6 or v1.7), and interim mitigating controls noted. Reviewed quarterly. | Security Officer |

### 2.3 State Transitions

```
                         +-> ACCEPTED (LOW only, with justification)
                        /
OPEN -> ASSIGNED -> IN PROGRESS -> VERIFICATION -> CLOSED
                        \                 |
                         \                v
                          +-> DEFERRED  (re-enters as OPEN when target date reached)
                                |
                                +-> Returns to OPEN at target date
```

**Rules:**
- Only the Security Officer may transition a finding to Open or Closed
- Only the Finding Owner may transition to In Progress
- Only someone other than the Finding Owner may verify and close
- Deferred findings are automatically reviewed when their target date is reached
- Accepted findings are reviewed annually to confirm the acceptance is still appropriate

---

## 3. Severity Framework

### 3.1 Severity Levels

Aligned with RISK-01 risk level definitions:

| Severity | Definition | SLA (Remediation Target) | Example Findings |
|----------|-----------|--------------------------|-----------------|
| **CRITICAL** | Immediate regulatory violation or active data exposure. Ongoing harm to data subjects. | **Immediate** -- remediation must begin within 24 hours | Production data breach, complete auth bypass, active cross-tenant data leak |
| **HIGH** | Significant gap with elevated risk, especially for minors' data. Regulatory non-compliance likely upon audit. | **Next planning cycle (v1.6)** | Cross-tenant data leak risk (R-01), no MFA (Reg. 9), no field-level encryption (ENC-01), no data retention enforcement (R-11) |
| **MEDIUM** | Moderate gap with mitigating controls in place. Regulatory finding possible but not certain. | **Within 2 planning cycles** | DPA not yet executed (VEND-02), training not yet delivered (PERS-02), default password (R-05), logging gaps (R-08) |
| **LOW** | Minor gap with low risk and acceptable interim controls. Unlikely to result in regulatory finding. | **Opportunistic / accept with documentation** | Student name denormalization (R-12), cosmetic compliance improvements |

### 3.2 Minors' Data Severity Elevation

Per INCIDENT-RESPONSE-PLAN.md (INCD-01) Section 2: findings that affect **minors' personal data** are automatically **elevated one severity level**:

- LOW -> MEDIUM
- MEDIUM -> HIGH
- HIGH -> CRITICAL

This elevation reflects the heightened protection requirements for minors' data under Israeli privacy law and ensures that gaps affecting children's data receive priority remediation.

### 3.3 Severity Assignment Guidelines

- Severity is assigned when the finding enters the **Open** state
- The Security Officer assigns initial severity based on this framework
- External auditors may recommend severity levels; the Security Officer confirms
- Severity may be adjusted during the lifecycle if new information changes the risk assessment
- All severity changes must be documented in the finding's Status History

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| **Security Officer** | Creates findings, assigns owners and severity, verifies closures, produces quarterly status report, escalates overdue findings. Owns the overall register. |
| **Finding Owner** | Implements remediation within SLA, updates status and progress notes, provides evidence of remediation, marks ready for verification. |
| **External Auditor** | Identifies findings during formal audits (per AUDT-01), validates closures during subsequent audits, may recommend severity levels. |
| **Senior Management** | Reviews quarterly status report, approves risk acceptances for LOW-severity findings, approves SLA extensions for extenuating circumstances. |
| **Development Team** | Implements technical remediations, provides technical evidence (code changes, configuration updates, test results). |

---

## 5. Finding Template

Each finding in the remediation register uses the following standardized format:

```
**Finding ID:** REM-[NNN]
**Date Identified:** [YYYY-MM-DD]
**Source:** [Audit / Self-Assessment / Incident / Gap Analysis / Risk Assessment]
**Regulation Reference:** [Regulation number and subject]
**Severity:** [CRITICAL / HIGH / MEDIUM / LOW]
**Description:** [What the gap or deficiency is]
**Affected Document(s):** [Document ID(s)]
**Current Control:** [What mitigation exists today, if any]
**Required Remediation:** [What needs to be done]
**Owner:** [Person or role responsible]
**Target Date:** [When remediation should be complete]
**Status:** [Open / Assigned / In Progress / Verification / Closed / Accepted / Deferred]
**Status History:**
  - [YYYY-MM-DD] - [Status change] - [Notes]
**Verification Notes:** [How closure was verified]
```

**Finding ID convention:** `REM-[sequential 3-digit number]` (e.g., REM-001, REM-025).

---

## 6. Tracking Mechanism

### 6.1 Current (v1.5)

Document-based tracking using the initial remediation register in Section 8 of this document. Findings are added, updated, and closed by editing this document directly.

**Limitations:** No automated workflow, no notification on SLA breach, manual status updates required.

### 6.2 Future (v1.6+)

Consider migrating to an issue tracker (GitHub Issues, Jira, or equivalent) for better workflow automation:
- Automated SLA breach notifications
- Status change audit trail
- Assignment workflow
- Dashboard and reporting
- Integration with development workflow (link findings to pull requests)

### 6.3 Update Schedule

The register is updated at minimum **quarterly** per the Security Officer's reporting cadence (SECOFF-01/02 Responsibility #4). Additional updates occur:
- When new findings are identified (from audit, self-assessment, or incident)
- When a finding's status changes
- When remediation evidence is submitted

---

## 7. Reporting Cadence

### 7.1 Quarterly Status Report

The Security Officer produces a quarterly status summary for senior management containing:

| Report Section | Contents |
|---------------|----------|
| **Total findings** | Count of all findings in register (including Closed) |
| **Open findings** | Count by severity (CRITICAL / HIGH / MEDIUM / LOW) |
| **Status distribution** | Findings by status (Open / Assigned / In Progress / Verification / Closed / Accepted / Deferred) |
| **New findings** | Findings added since last report |
| **Closed findings** | Findings closed since last report |
| **Overdue findings** | Findings past their SLA target date and still open |
| **Risk acceptances** | Any findings moved to Accepted state this quarter |
| **Trend analysis** | Comparison with previous quarter (improving / stable / degrading) |

### 7.2 Annual Audit Report

Full remediation status is included in the annual AUDT-01 audit report (Section 7). The external auditor reviews the register and validates closures.

---

## 8. Initial Remediation Register

This register consolidates ALL known gaps identified during the v1.5 compliance documentation phase (Phases 27-30). It includes all 12 formally assessed risks from RISK-01 and all gap analysis findings from compliance documents.

**Register Date:** 2026-03-02
**Source:** Gap analysis across all Phase 27-30 compliance documents + RISK-01 risk assessment

### 8.1 Findings from Risk Assessment (RISK-01)

---

**Finding ID:** REM-001
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-01)
**Regulation Reference:** Reg. 8 -- Access Control (Authorization)
**Severity:** HIGH
**Description:** Cross-tenant data leak risk. A flaw in tenant isolation logic could allow one tenant's users to access another tenant's data. Multiple isolation layers exist (enforceTenant, buildContext, buildScopedFilter, stripTenantId) but no comprehensive integration test suite validates tenant boundaries across all endpoints.
**Affected Document(s):** ACPOL-01, RISK-01
**Current Control:** 4-layer tenant isolation middleware chain; tenant-scoped indexes on 15 collections
**Required Remediation:** Add tenant isolation integration tests for every API endpoint; implement tenant boundary assertion in test suite; add monitoring/alerting for cross-tenant query patterns
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6 Technical Hardening; existing 4-layer controls provide interim mitigation
**Verification Notes:** --

---

**Finding ID:** REM-002
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-02)
**Regulation Reference:** Reg. 9 -- Access Control (Authentication), Reg. 14 -- Encryption
**Severity:** HIGH
**Description:** Credential exposure risk. The teacher collection co-locates hashed passwords, JWT refresh tokens, invitation tokens, and reset tokens with personal information (names, Israeli ID numbers, addresses). Any single exposure compromises both identity and authentication data.
**Affected Document(s):** ACPOL-02, ENC-01, RISK-01
**Current Control:** Passwords bcrypt-hashed (10 rounds); refresh tokens have version counters; connection string in environment variables
**Required Remediation:** Separate credentials into dedicated collection; implement field-level encryption for tokens and sensitive credential data; add database access audit logging
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; bcrypt hashing provides interim protection
**Verification Notes:** --

---

**Finding ID:** REM-003
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-03)
**Regulation Reference:** Reg. 8 -- Access Control, Reg. 10 -- Logging
**Severity:** HIGH
**Description:** Minors' data breach via API. Authorization bypass, IDOR, or injection vulnerabilities could expose student records containing minors' personal data (names, ages, addresses, parent contacts, exam grades). No comprehensive audit logging exists for minors' data access.
**Affected Document(s):** ACPOL-01, ACPOL-03, DBDF-03, RISK-01
**Current Control:** JWT authentication, RBAC, tenant isolation, canAccessStudent() IDOR prevention, express-mongo-sanitize, helmet
**Required Remediation:** Implement data minimization in API responses; add audit logging for all minors' data access; implement age verification flag; add API response schema validation
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; multiple existing controls provide interim mitigation
**Verification Notes:** --

---

**Finding ID:** REM-004
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-04)
**Regulation Reference:** Reg. 9 -- Authentication, Reg. 14 -- Encryption
**Severity:** HIGH
**Description:** JWT secret compromise risk. If ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET environment variables are leaked, an attacker could forge valid tokens for any user on any tenant, including administrators.
**Affected Document(s):** ACPOL-02, ENC-01, RISK-01
**Current Control:** Secrets in Render environment variables (not in code); separate access/refresh secrets; token version counter; 1-hour access token expiry
**Required Remediation:** Implement periodic secret rotation mechanism; add JWT key rotation support (dual-key validation); consider asymmetric signing (RS256); add anomaly detection for token usage patterns
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; current controls limit exposure window
**Verification Notes:** --

---

**Finding ID:** REM-005
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-05)
**Regulation Reference:** Reg. 9 -- Authentication
**Severity:** MEDIUM
**Description:** Default password "123456" auto-set on teacher accounts created without a password. This is the world's most common password. requiresPasswordChange flag exists but enforcement depends on frontend behavior. Bulk import could create many accounts with this default simultaneously.
**Affected Document(s):** ACPOL-02, RISK-01
**Current Control:** requiresPasswordChange flag; bcrypt hashing (literal "123456" not stored)
**Required Remediation:** Remove automatic default password assignment; require invitation email flow for all new accounts; add server-side enforcement blocking API access when requiresPasswordChange is true; add monitoring for accounts with unchanged defaults
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; requiresPasswordChange flag provides partial mitigation
**Verification Notes:** --

---

**Finding ID:** REM-006
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-06)
**Regulation Reference:** Reg. 2 -- Database Definition, Reg. 5 -- Retention
**Severity:** MEDIUM
**Description:** Import log PII retention. The import_log collection stores full previewData containing imported records (names, emails, ID numbers) indefinitely with no cleanup mechanism. Redundant PII exposure after successful import.
**Affected Document(s):** DBDF-02, RISK-01
**Current Control:** None -- previewData persisted indefinitely
**Required Remediation:** Add TTL index on import_log (90 days); purge previewData field after successful import execution; encrypt previewData if retention needed for audit
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; no interim mitigation
**Verification Notes:** --

---

**Finding ID:** REM-007
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-07)
**Regulation Reference:** Reg. 2 -- Database Definition, Reg. 5 -- Retention
**Severity:** MEDIUM
**Description:** Deletion snapshot PII accumulation. deletion_snapshots and tenant_deletion_snapshots collections store complete document copies (all PII) of deleted entities indefinitely. Undermines data subject deletion rights.
**Affected Document(s):** DBDF-02, RISK-01
**Current Control:** None -- snapshots persisted indefinitely
**Required Remediation:** Add TTL indexes (90 days) on both snapshot collections; encrypt snapshot data at rest; add snapshot purge administrative function
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; no interim mitigation
**Verification Notes:** --

---

**Finding ID:** REM-008
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-08)
**Regulation Reference:** Reg. 10 -- Logging and Monitoring
**Severity:** MEDIUM
**Description:** Insufficient logging for compliance. Only super-admin actions and deletion events are systematically logged. No tenant-level CRUD logging, no authentication event logging, no authorization failure logging, no minors' data access logging.
**Affected Document(s):** ACPOL-03, RISK-01
**Current Control:** platform_audit_log (super admin), deletion_audit (cascade deletions), security_log (sparse), Pino operational logs (unstructured)
**Required Remediation:** Extend audit logging to all tenant-level operations; implement structured access logs; add minors' data access logging as priority; create audit log query API
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; existing platform_audit_log provides partial coverage
**Verification Notes:** --

---

**Finding ID:** REM-009
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-09)
**Regulation Reference:** Reg. 15-16 -- Outsourcing / Vendor Management
**Severity:** MEDIUM
**Description:** SendGrid/email data in transit to US. Teacher email addresses and names transferred to SendGrid's US infrastructure for email delivery without documented legal basis for cross-border transfer.
**Affected Document(s):** SMAP-03, VEND-01/02/03, RISK-01
**Current Control:** HTTPS encryption to SendGrid API; SendGrid SOC 2 Type II certification
**Required Remediation:** Document legal basis for cross-border transfer; evaluate EU-based alternatives; verify and sign SendGrid DPA with cross-border provisions; minimize data sent to SendGrid
**Owner:** Security Officer
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; HTTPS provides transport security
**Verification Notes:** --

---

**Finding ID:** REM-010
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-10)
**Regulation Reference:** Reg. 14 -- Encryption, Reg. 7 -- System Mapping
**Severity:** HIGH
**Description:** S3 bucket misconfiguration risk. AWS S3 bucket for bagrut document storage could be publicly accessible. Bucket policy has not been verified. Exposed documents could contain minors' exam papers and certificates.
**Affected Document(s):** ENC-01, SMAP-01, RISK-01
**Current Control:** S3 access key authentication; S3 region eu-central-1; likely S3 Block Public Access enabled by default
**Required Remediation:** Verify S3 Block Public Access enabled; enable S3 server access logging; implement presigned URLs; review and restrict bucket policy; enable S3 versioning
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; AWS defaults likely provide baseline protection
**Verification Notes:** --

---

**Finding ID:** REM-011
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-11)
**Regulation Reference:** Reg. 2 -- Database Definition, Reg. 5 -- Retention
**Severity:** HIGH
**Description:** No data retention enforcement. No MongoDB collection has TTL indexes or automated retention enforcement. Data accumulates indefinitely: import logs, deletion snapshots, ministry reports, migration backups, security logs. Cannot demonstrate data minimization compliance.
**Affected Document(s):** DBDF-02, DBDF-04, RISK-01
**Current Control:** Soft-delete flags; tenant purge mechanism; cascade deletion for individual entities
**Required Remediation:** Implement TTL indexes: import_log (90d), deletion_snapshots (90d), tenant_deletion_snapshots (90d), migration_backups (180d). Define and enforce retention for all collections. Create automated retention enforcement service.
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Deferred - Scheduled for v1.6; no interim mitigation
**Verification Notes:** --

---

**Finding ID:** REM-012
**Date Identified:** 2026-03-02
**Source:** Risk Assessment (RISK-01, R-12)
**Regulation Reference:** Reg. 2 -- Database Definition
**Severity:** LOW
**Description:** Student name denormalization in teacher documents. Minors' names copied to teacher.teaching.timeBlocks[].assignedLessons[].studentName for display optimization. Creates additional PII copies outside student collection; complicates data subject deletion/correction.
**Affected Document(s):** DBDF-04, RISK-01
**Current Control:** Tenant isolation; role-based access scoping; buildScopedFilter
**Required Remediation:** Evaluate removing denormalized field in favor of runtime lookup; if retained, implement synchronization mechanism. Document in data subject request procedures.
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Accepted
**Status History:**
  - 2026-03-02 - Open - Identified during RISK-01 risk assessment
  - 2026-03-02 - Accepted - LOW severity; current access controls adequate; remediation is data hygiene improvement
**Verification Notes:** --

---

### 8.2 Findings from Gap Analyses (Phase 27-30 Compliance Documents)

---

**Finding ID:** REM-013
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (DBDF-02)
**Regulation Reference:** Reg. 2 -- Database Definition, Reg. 5 -- Retention
**Severity:** HIGH
**Description:** Data retention TTL not technically enforced. Retention periods are documented per collection (DBDF-02 Section 3) but no MongoDB TTL indexes exist on any collection. This is the documentation-level view of R-11 (which covers the risk perspective).
**Affected Document(s):** DBDF-02
**Current Control:** Retention policies defined in documentation; no technical enforcement
**Required Remediation:** Implement TTL indexes per documented retention periods. See REM-011 for technical details.
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in DBDF-02 gap analysis
  - 2026-03-02 - Deferred - Linked to REM-011; scheduled for v1.6
**Verification Notes:** --

---

**Finding ID:** REM-014
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (DBDF-04)
**Regulation Reference:** Reg. 2 -- Database Definition
**Severity:** MEDIUM
**Description:** Data minimization not technically enforced. Annual data minimization review process is defined (DBDF-04) but no technical enforcement exists: API responses return full documents, no field-level filtering by role or purpose, no automated data cleanup.
**Affected Document(s):** DBDF-04
**Current Control:** Process documented; no technical enforcement
**Required Remediation:** Implement API response minimization (return only needed fields per endpoint); add field-level filtering by role; automate data cleanup for identified minimization targets
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in DBDF-04 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; process documentation provides governance framework
**Verification Notes:** --

---

**Finding ID:** REM-015
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (DBDF-03)
**Regulation Reference:** Reg. 2 -- Database Definition (Minors' Data)
**Severity:** HIGH
**Description:** Consent mechanism for minors' data not implemented. No explicit parental/guardian consent mechanism exists for processing minors' personal data. Platform relies on contractual necessity (conservatory enrollment) as lawful basis, but consent may be required for certain processing activities (per DBDF-03 gap analysis).
**Affected Document(s):** DBDF-03
**Current Control:** Contractual necessity lawful basis documented; no consent collection mechanism
**Required Remediation:** Evaluate consent requirements for minors' data processing; if required, implement parental consent mechanism with documented consent records
**Owner:** Security Officer + Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in DBDF-03 gap analysis
  - 2026-03-02 - Deferred - Requires legal review of consent requirements; scheduled for v1.6
**Verification Notes:** --

---

**Finding ID:** REM-016
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (DBDF-03)
**Regulation Reference:** Reg. 2 -- Database Definition (Minors' Data)
**Severity:** MEDIUM
**Description:** Age verification not implemented. No mechanism to verify or flag the age of data subjects (students). Student records contain age/grade data but no formal age verification or minor/adult classification flag exists.
**Affected Document(s):** DBDF-03
**Current Control:** All students assumed to be minors (conservative approach); no technical distinction
**Required Remediation:** Implement age verification flag on student records; apply differentiated protection based on minor status
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in DBDF-03 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; conservative "all minors" assumption provides interim protection
**Verification Notes:** --

---

**Finding ID:** REM-017
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (ACPOL-01)
**Regulation Reference:** Reg. 8 -- Access Control (Authorization)
**Severity:** MEDIUM
**Description:** 5 unused RBAC roles with no auth enforcement. Deputy Admin, Department Head, Accompanist, Teacher-Accompanist, and Guest roles exist in the system but have no RBAC entry AND no route-level authentication. They are functionally unused but represent undocumented access paths if activated.
**Affected Document(s):** ACPOL-01
**Current Control:** Roles have no permissions and no route access; effectively disabled
**Required Remediation:** Either formally define permissions for needed roles or remove unused role definitions from the codebase to reduce attack surface
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in ACPOL-01 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; no immediate security risk (roles have zero permissions)
**Verification Notes:** --

---

**Finding ID:** REM-018
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (ACPOL-02)
**Regulation Reference:** Reg. 9 -- Authentication
**Severity:** HIGH
**Description:** No multi-factor authentication (MFA). The platform has no second authentication factor for any user role. Medium-security databases should implement MFA per regulatory guidance. This is the only Non-Compliant item in the AUDT-02 checklist.
**Affected Document(s):** ACPOL-02
**Current Control:** Single-factor authentication only (password + JWT)
**Required Remediation:** Implement MFA (TOTP, SMS, or email-based second factor) for at least admin and super-admin roles; evaluate MFA for all user roles
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in ACPOL-02 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; single-factor auth with bcrypt provides baseline security
**Verification Notes:** --

---

**Finding ID:** REM-019
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (ACPOL-03)
**Regulation Reference:** Reg. 10 -- Logging and Monitoring
**Severity:** MEDIUM
**Description:** Limited logging categories. Current logging covers only super-admin actions and deletion events. Missing: tenant-level CRUD, authentication events, authorization failures, minors' data access, export events, configuration changes. This is the documentation-level view of R-08.
**Affected Document(s):** ACPOL-03
**Current Control:** platform_audit_log and deletion_audit provide partial coverage
**Required Remediation:** Extend audit logging to all categories identified in ACPOL-03 Section 3.1. See REM-008 for technical details.
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in ACPOL-03 gap analysis
  - 2026-03-02 - Deferred - Linked to REM-008; scheduled for v1.6
**Verification Notes:** --

---

**Finding ID:** REM-020
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (LOG-01)
**Regulation Reference:** Reg. 10(e) -- User Notification
**Severity:** MEDIUM
**Description:** User notification delivery mechanism not implemented. Notification policy defined (LOG-01) with draft text and delivery options (login banner or ToS clause), but no technical mechanism delivers the notification to users in the application.
**Affected Document(s):** LOG-01
**Current Control:** Policy and draft notification text prepared; no delivery mechanism
**Required Remediation:** Implement notification delivery mechanism: login banner, ToS acceptance flow, or in-app notice. Ensure notification is presented to all users before or during first access.
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in LOG-01 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; policy documentation establishes the requirement
**Verification Notes:** --

---

**Finding ID:** REM-021
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (ENC-01)
**Regulation Reference:** Reg. 14 -- Encryption
**Severity:** HIGH
**Description:** No field-level encryption for RESTRICTED data. Provider-level encryption (Atlas AES-256, S3 SSE) covers all data, but no application-level field-level encryption exists for RESTRICTED data within blob fields (import_log.previewData, deletion_snapshots.snapshotData, tenant_deletion_snapshots.collectionSnapshots). ENC-01 Section 6 designates this as REQUIRED for v1.6.
**Affected Document(s):** ENC-01, DBDF-01
**Current Control:** Provider-level encryption at rest (Atlas, S3); no application-level encryption
**Required Remediation:** Implement field-level encryption for RESTRICTED data within SENSITIVE blob collections; evaluate MongoDB Client-Side Field Level Encryption (CSFLE) or application-layer encryption
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in ENC-01 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; provider-level encryption provides baseline protection
**Verification Notes:** --

---

**Finding ID:** REM-022
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (ENC-01)
**Regulation Reference:** Reg. 14 -- Encryption
**Severity:** MEDIUM
**Description:** No application-level key rotation mechanism. All encryption key management is provider-managed (Atlas, AWS, Render). No application-level encryption keys exist, and therefore no rotation capability. If application-level encryption is implemented (REM-021), a key rotation mechanism will be needed.
**Affected Document(s):** ENC-01
**Current Control:** Provider-managed key rotation (automatic per provider schedules)
**Required Remediation:** Implement application-level key management and rotation mechanism as part of field-level encryption implementation (REM-021)
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in ENC-01 gap analysis
  - 2026-03-02 - Deferred - Dependent on REM-021; scheduled for v1.6
**Verification Notes:** --

---

**Finding ID:** REM-023
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (VEND-01/02/03)
**Regulation Reference:** Reg. 15-16 -- Outsourcing / Vendor Management
**Severity:** MEDIUM
**Description:** DPAs not yet executed with all 5 vendors. DPA templates have been created with pre-populated vendor details (VEND-02), but no DPAs have been signed. Regulations 15-16 require written DPAs BEFORE engagement. Current vendor relationships pre-date the DPA templates.
**Affected Document(s):** VEND-01/02/03, SMAP-03
**Current Control:** DPA templates prepared; vendor risk assessments completed; vendor certifications documented
**Required Remediation:** Execute DPAs with all 5 vendors (MongoDB Atlas, Render, AWS S3, SendGrid, Gmail) using the prepared templates. Prioritize vendors handling minors' data.
**Owner:** Security Officer
**Target Date:** Before production launch
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in VEND-01/02/03 gap analysis
  - 2026-03-02 - Deferred - Requires vendor engagement; templates ready for execution
**Verification Notes:** --

---

**Finding ID:** REM-024
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (PERS-01/02/03)
**Regulation Reference:** Reg. 17 -- Personnel Security
**Severity:** MEDIUM
**Description:** Security training not yet delivered. Training outline created (PERS-02 Section 4) with 8 topics and delivery method, but no training has been conducted and no completion records exist. Regulation 17 requires personnel with data access to receive training.
**Affected Document(s):** PERS-01/02/03
**Current Control:** Training outline and materials prepared; no delivery or records
**Required Remediation:** Deliver security awareness training to all platform and tenant personnel before production launch; maintain completion records with dates and attendee list
**Owner:** Security Officer
**Target Date:** Before production launch
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in PERS-01/02/03 gap analysis
  - 2026-03-02 - Deferred - Training materials ready; delivery pending personnel availability
**Verification Notes:** --

---

**Finding ID:** REM-025
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (PERS-01/02/03)
**Regulation Reference:** Reg. 17 -- Personnel Security
**Severity:** MEDIUM
**Description:** Confidentiality agreements not yet signed. Agreement template created (PERS-03 Section 5) with all required clauses including indefinite obligation for minors' data, but no agreements have been executed.
**Affected Document(s):** PERS-01/02/03
**Current Control:** Agreement template prepared with all required clauses
**Required Remediation:** Execute confidentiality agreements with all platform and tenant personnel who have access to personal data. Maintain signed copies.
**Owner:** Security Officer
**Target Date:** Before production launch
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in PERS-01/02/03 gap analysis
  - 2026-03-02 - Deferred - Templates ready; execution pending personnel onboarding
**Verification Notes:** --

---

**Finding ID:** REM-026
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (BACK-01)
**Regulation Reference:** Reg. 5 -- Security Procedure Contents
**Severity:** MEDIUM
**Description:** Backup testing never performed. BACK-01 Section 6 defines a quarterly testing schedule (Atlas restore, S3 recovery, application snapshot restore) but no testing has been conducted. 4 blocking pre-production requirements identified: Atlas backup verification, Atlas restore test, application snapshot restore, secure secret backup creation.
**Affected Document(s):** BACK-01
**Current Control:** Testing schedule and runbooks defined; no testing performed
**Required Remediation:** Execute the 4 blocking pre-production backup tests per BACK-01 Section 6; document results; establish quarterly testing cadence
**Owner:** Development Team
**Target Date:** Before production launch
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in BACK-01 gap analysis
  - 2026-03-02 - Deferred - Runbooks ready; testing requires production-like environment
**Verification Notes:** --

---

**Finding ID:** REM-027
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (SECOFF-01/02)
**Regulation Reference:** Reg. 3 -- Security Officer
**Severity:** MEDIUM
**Description:** Named Security Officer individual not yet designated. SECOFF-01/02 Section 4 provides the appointment template with position title (CTO / Lead Developer) but no named individual has been formally appointed. Named individual required before production launch per Section 5.2.
**Affected Document(s):** SECOFF-01/02
**Current Control:** Position title documented; appointment template ready; conflict of interest provisions established
**Required Remediation:** Complete the appointment document with named individual, signed by both appointee and appointing authority, before first production tenant
**Owner:** Senior Management
**Target Date:** Before production launch
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in SECOFF-01/02 gap analysis
  - 2026-03-02 - Deferred - Appointment pending organizational readiness
**Verification Notes:** --

---

**Finding ID:** REM-028
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (AUDT-02)
**Regulation Reference:** Reg. 2 -- Database Definition
**Severity:** MEDIUM
**Description:** Database PPA registration status unknown. AUDT-02 item 2.7 flags the database registration status with the Privacy Protection Authority (PPA) as "TO BE VERIFIED." It is unclear whether the Tenuto.io database requires PPA registration before production launch.
**Affected Document(s):** AUDT-02
**Current Control:** None -- registration status not verified
**Required Remediation:** Verify PPA database registration requirements; complete registration if required; document registration status
**Owner:** Security Officer
**Target Date:** Before production launch
**Status:** Open
**Status History:**
  - 2026-03-02 - Open - Flagged during AUDT-02 compliance checklist creation
**Verification Notes:** --

---

**Finding ID:** REM-029
**Date Identified:** 2026-03-02
**Source:** Gap Analysis (SECPR-01/02/03)
**Regulation Reference:** Reg. 4 -- Security Procedures
**Severity:** MEDIUM
**Description:** Data classification handling rules not technically differentiated by tier. SECPR-03 Section 6 defines handling rules per classification tier (RESTRICTED, SENSITIVE, INTERNAL, PUBLIC) but ALL tiers receive the same technical controls. No technical enforcement differentiates access, encryption, or logging by classification level.
**Affected Document(s):** SECPR-01/02/03, ENC-01
**Current Control:** Handling rules documented per tier; no technical differentiation
**Required Remediation:** Implement differentiated technical controls by classification tier: enhanced logging for RESTRICTED data access, field-level encryption for RESTRICTED data, API response filtering by classification
**Owner:** Development Team
**Target Date:** v1.6
**Status:** Deferred
**Status History:**
  - 2026-03-02 - Open - Identified in SECPR-01/02/03 gap analysis
  - 2026-03-02 - Deferred - Scheduled for v1.6; overlaps with REM-021 (field-level encryption) and REM-008 (logging)
**Verification Notes:** --

---

### 8.3 Register Summary

| Metric | Count |
|--------|-------|
| **Total findings** | 29 |
| **CRITICAL** | 0 |
| **HIGH** | 7 (REM-001, 002, 003, 004, 010, 011, 018, 021) |
| **MEDIUM** | 14 (REM-005, 006, 007, 008, 009, 014, 016, 017, 019, 020, 022, 023, 024, 025, 026, 027, 028, 029) |
| **LOW** | 1 (REM-012) |
| | |
| **Status: Open** | 1 (REM-028) |
| **Status: Deferred** | 27 |
| **Status: Accepted** | 1 (REM-012) |
| **Status: Closed** | 0 |

**Severity distribution:**
- HIGH findings: 8 -- all deferred to v1.6 Technical Hardening with interim mitigating controls
- MEDIUM findings: 20 -- mix of v1.6 deferrals and pre-production launch requirements
- LOW findings: 1 -- accepted with documented justification
- CRITICAL findings: 0 -- no immediate regulatory violations or active data exposure

**Pre-production launch requirements** (must be completed before first tenant):
- REM-023: Execute DPAs with all 5 vendors
- REM-024: Deliver security training
- REM-025: Execute confidentiality agreements
- REM-026: Perform backup testing
- REM-027: Appoint named Security Officer
- REM-028: Verify PPA registration requirements

---

## 9. Review Schedule

### 9.1 Register Review

The remediation register (Section 8) is reviewed **quarterly** per the Security Officer's reporting cadence (SECOFF-01/02 Responsibility #4). Each quarterly review:

- Updates status of all active findings
- Reviews Deferred findings for target date proximity
- Identifies any new findings from incidents or operational observations
- Produces the quarterly status report (Section 7.1)

### 9.2 Process Review

The remediation tracking process itself (Sections 2-7) is reviewed **annually** as part of the AUDT-01 annual audit cycle. The review evaluates:

- Effectiveness of the finding lifecycle stages
- Appropriateness of severity SLAs
- Adequacy of the reporting cadence
- Need for tooling migration (Section 6.2)

---

## 10. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Risk Assessment | RISK-01 | Source of 12 formally assessed risks (REM-001 through REM-012); severity framework aligned with RISK-01 risk levels |
| Security Officer | SECOFF-01/02 | Security Officer owns the register; quarterly reporting cadence per Responsibility #4; audit coordination per Responsibility #6 |
| Periodic Audit Program | AUDT-01 | Audit findings feed into this register; annual audit validates register status |
| Compliance Self-Assessment Checklist | AUDT-02 | Partially Compliant and Non-Compliant items in AUDT-02 correspond to findings in this register |
| Incident Response Plan | INCD-01/02/03 | Post-incident findings enter this register; minors' data severity elevation rule sourced from INCD-01 |
| Data Inventory | DBDF-01 | Source of data classification for severity assessment |
| Data Purposes | DBDF-02 | Source of retention gap findings (REM-006, REM-013) |
| Minors' Data Assessment | DBDF-03 | Source of minors' data gap findings (REM-015, REM-016) |
| Data Minimization | DBDF-04 | Source of minimization gap finding (REM-014) |
| Access Control Policy | ACPOL-01 | Source of unused roles finding (REM-017) |
| Authentication Policy | ACPOL-02 | Source of MFA finding (REM-018) and default password finding (REM-005) |
| Access Logging Policy | ACPOL-03 | Source of logging gap findings (REM-008, REM-019) |
| User Notification Policy | LOG-01 | Source of notification delivery finding (REM-020) |
| Encryption Policy | ENC-01 | Source of encryption gap findings (REM-021, REM-022) |
| Vendor Management | VEND-01/02/03 | Source of DPA execution finding (REM-023) |
| Personnel Security | PERS-01/02/03 | Source of training (REM-024) and confidentiality (REM-025) findings |
| Backup and Recovery | BACK-01 | Source of backup testing finding (REM-026) |
| Security Procedures | SECPR-01/02/03 | Source of classification handling finding (REM-029) |

---

**Document ID:** AUDT-03
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
