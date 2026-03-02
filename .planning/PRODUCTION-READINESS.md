# Production Readiness Plan — Tenuto.io

**Created:** 2026-03-02
**Updated:** 2026-03-02 (route-level security audit + stricter launch criteria)
**Based on:** v1.5 compliance documentation (24 documents), RISK-01 (12 risks), AUDT-03 (29 findings), codebase audit of all 25 route files + server.js
**Goal:** Define everything required to go from "documentation complete" to "safe for real users"

---

## Table of Contents

1. [Production Blockers Checklist](#1-production-blockers-checklist)
2. [v1.6 Implementation Plan](#2-v16-implementation-plan)
3. [Risk-to-Control Mapping Table](#3-risk-to-control-mapping-table)
4. [Minimal Safe Launch Definition](#4-minimal-safe-launch-definition) *(revised — stricter for minors' data)*
5. [Recommended Order of Execution](#5-recommended-order-of-execution)
6. [Route-Level Security Audit](#6-route-level-security-audit)
7. [Safety Assessment](#7-safety-assessment)

---

## 1. Production Blockers Checklist

These items MUST be completed before any real tenant data enters the system. Each is either a regulatory requirement or an unacceptable security risk.

### BLOCK-01: Secure the Super Admin Seed Endpoint — RESOLVED

**Status:** FIXED (2026-03-02)

**What was done:** Added environment guard to `api/super-admin/super-admin.route.js`. The `/seed` route is only registered when `NODE_ENV !== 'production'`. In production, the route does not exist (Express returns 404). The service layer retains its self-protection (rejects if any super admin already exists) as defense-in-depth for non-production environments.

**Also fixed:** `/api/auth/init-admin` — same pattern applied in `api/auth/auth.route.js`. This endpoint creates a tenant admin with predictable credentials (`admin@example.com`) and must not be reachable in production.

**Verification criteria:**
- [x] `/api/super-admin/seed` — environment guard added, returns 404 in production
- [x] `/api/auth/init-admin` — environment guard added, returns 404 in production
- [ ] Confirmed after deploy: `curl -X POST https://production-url/api/super-admin/seed` returns 404
- [ ] Confirmed after deploy: `curl -X POST https://production-url/api/auth/init-admin` returns 404

---

### BLOCK-02: Execute DPAs with All Cloud Vendors

**Description:** No Data Processing Agreements have been signed with any of the 5 vendors: MongoDB Atlas, Render, AWS S3, SendGrid, Gmail.

**Why required:** Regulations 15-16 require written data processing agreements BEFORE engaging data processors. Every vendor currently processes personal data without a contractual privacy framework. (REM-023)

**Verification criteria:**
- [ ] DPA signed with MongoDB Atlas (stores ALL personal data)
- [ ] DPA signed with Render (processes ALL data in transit, holds ALL platform secrets)
- [ ] DPA signed with AWS S3 (stores bagrut documents — minors' data)
- [ ] DPA signed with SendGrid (cross-border transfer of teacher emails to US)
- [ ] DPA signed with Gmail/Google (email delivery for invitations)
- [ ] Signed copies stored and referenced in VENDOR-MANAGEMENT.md

---

### BLOCK-03: Appoint Named Security Officer

**Description:** The Security Officer role is defined with 10 responsibilities and an appointment template, but no named individual has been formally designated.

**Why required:** Regulation 3 requires a named Security Officer. All compliance documents reference this role as the document owner and incident escalation point. The governance framework has no authority without a named person. (REM-027)

**Verification criteria:**
- [ ] Appointment document (SECOFF-01/02 Section 4) completed with named individual
- [ ] Signed by both appointee and appointing authority
- [ ] Contact information and authority scope confirmed
- [ ] Conflict of interest acknowledgment signed (if developer-as-SO arrangement)

---

### BLOCK-04: Execute Confidentiality Agreements

**Description:** Agreement template exists but no agreements have been signed with any personnel who will have access to the system.

**Why required:** Regulation 17 requires confidentiality agreements for all personnel with data access. The template includes a critical minors' data clause with indefinite post-termination obligations. Without signed agreements, personnel are not legally bound to protect data. (REM-025)

**Verification criteria:**
- [ ] All platform personnel (developers, admins) have signed the confidentiality agreement
- [ ] Each conservatory's admin has signed before receiving credentials
- [ ] Signed copies stored securely
- [ ] Register of signatories maintained

---

### BLOCK-05: Deliver Security Awareness Training

**Description:** Training outline exists (7 topics, 55 min) but no training has been delivered and no completion records exist.

**Why required:** Regulation 17 requires security training for personnel with data access. Conservatory admins and teachers will handle minors' personal data daily. They need to understand data handling rules, incident reporting, and their legal obligations. (REM-024)

**Verification criteria:**
- [ ] Written security briefing document finalized from PERS-02 outline
- [ ] Training delivered to all platform personnel
- [ ] Training delivered to first tenant's admin and teachers
- [ ] Completion records with dates, attendee names, and acknowledgment signatures

---

### BLOCK-06: Test Backup and Recovery Procedures

**Description:** Backup runbooks exist but have never been tested. The system currently has NO verified ability to recover from data loss.

**Why required:** Regulation 5 requires tested backup and recovery procedures. Without testing, RPO 24h / RTO 4h objectives are aspirational, not proven. If data loss occurs with real tenant data and recovery fails, the platform has no recourse. (REM-026)

**Verification criteria:**
- [ ] Atlas backup configuration verified (continuous backup enabled, 2-hour granularity confirmed)
- [ ] Atlas point-in-time restore tested to a test cluster (documented with screenshots)
- [ ] Application-level snapshot restore procedure validated (import_log or deletion_snapshot restored)
- [ ] Secure secret backup created and stored separately from Render (encrypted, offline)
- [ ] Test results documented with actual RTO/RPO achieved

---

### BLOCK-07: Verify PPA Database Registration

**Description:** It is unclear whether the Tenuto.io database requires registration with the Israel Privacy Protection Authority (PPA) before operating.

**Why required:** Database registration may be legally required before processing personal data. Operating an unregistered database that requires registration is a regulatory violation. (REM-028)

**Verification criteria:**
- [ ] Legal determination made: does Tenuto.io require PPA registration?
- [ ] If yes: registration submitted and confirmation received
- [ ] If no: documented legal basis for exemption
- [ ] Result recorded in AUDT-02 item 2.7

---

### BLOCK-08: Implement User Monitoring Notification

**Description:** Regulation 10(e) requires informing users that their activity may be logged and monitored. The policy and draft text exist (LOG-01), but no delivery mechanism is implemented.

**Why required:** Users have a legal right to know they are being monitored. This is a regulatory requirement that can be satisfied with a simple login banner or terms acceptance, but it MUST exist before users log in to a system that logs any activity.

**Verification criteria:**
- [ ] Monitoring notification displayed to users during first login or via ToS acceptance
- [ ] Notification text matches LOG-01 draft (or approved revision)
- [ ] User acknowledgment recorded (date, user ID)
- [ ] Cannot be dismissed without acknowledgment

---

### Summary: 8 Production Blockers (1 resolved, 7 remaining)

| # | Blocker | Owner | Status |
|---|---------|-------|--------|
| BLOCK-01 | Secure seed endpoint + init-admin | Dev Team | **RESOLVED** |
| BLOCK-02 | Execute DPAs with 5 vendors | Business Owner | Open (2-4 weeks) |
| BLOCK-03 | Appoint named Security Officer | Senior Management | Open (1 day) |
| BLOCK-04 | Execute confidentiality agreements | Security Officer | Open (1 week) |
| BLOCK-05 | Deliver security training | Security Officer | Open (1 week) |
| BLOCK-06 | Test backup/recovery | Dev Team | Open (1-2 days) |
| BLOCK-07 | Verify PPA registration | Security Officer | Open (1-2 weeks) |
| BLOCK-08 | User monitoring notification | Dev Team | Open (2-4 hours) |

**Critical path:** BLOCK-02 (DPA execution) is the longest lead-time item. Start immediately.

---

## 2. v1.6 Implementation Plan

All tasks below are technical implementations derived from RISK-01 risks and AUDT-03 remediation findings. Grouped by domain.

### 2.1 Authentication & Authorization

#### AUTH-01: Remove Default Password "123456"
- **What:** Eliminate automatic default password assignment in `auth.service.js` line 50 and `auth.controller.js` line 502. All new accounts must use the invitation email flow for initial password setup.
- **Where:** `api/auth/auth.service.js`, `api/auth/auth.controller.js`, `api/import/import.service.js`
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-05, ACPOL-02)
- **Finding:** REM-005
- **Note:** Server-side enforcement of `requiresPasswordChange` already exists in `auth.middleware.js` (returns 403 with `PASSWORD_CHANGE_REQUIRED`). This provides interim mitigation, but the default password should be removed entirely.

#### AUTH-02: Implement Multi-Factor Authentication (MFA)
- **What:** Add TOTP-based MFA for admin and super-admin roles. Evaluate extending to all roles.
- **Where:** Backend: new `api/auth/mfa.service.js`, `api/auth/mfa.controller.js`. Frontend: MFA setup flow, TOTP input on login.
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required — only Non-Compliant item in AUDT-02 (Reg. 9.4)
- **Finding:** REM-018

#### AUTH-03: Implement Password Policy Enforcement
- **What:** Enforce minimum password length (8+), complexity requirements, and prevent common passwords. Add password history to prevent reuse.
- **Where:** `api/auth/auth.validation.js`, `api/auth/auth.service.js`
- **Priority:** HIGH
- **Dependency:** AUTH-01
- **Compliance:** Required (ACPOL-02)

#### AUTH-04: Clean Up Unused Roles
- **What:** Remove or formally define the 5 unused roles (Deputy Admin, Department Head, Accompanist, Teacher-Accompanist, Guest) from `ROLE_PERMISSIONS`.
- **Where:** `config/constants.js`, any role-checking middleware
- **Priority:** MEDIUM
- **Dependency:** None
- **Compliance:** Best practice (attack surface reduction)
- **Finding:** REM-017

### 2.2 Session Management

#### SESS-01: Implement Session Timeout / Idle Logout
- **What:** Add idle timeout that invalidates sessions after 30 minutes of inactivity. Currently, access tokens live for 1 hour regardless of activity and refresh tokens for 30 days.
- **Where:** Backend: track last-activity timestamp per session. Frontend: idle detection with automatic logout.
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (ACPOL-02, Reg. 9)

#### SESS-02: JWT Key Rotation Support
- **What:** Implement periodic secret rotation with dual-key validation during rotation window. Consider migrating from HS256 to RS256 (asymmetric) to separate signing from verification.
- **Where:** `api/auth/auth.service.js`, `api/auth/auth.middleware.js`, Render env vars
- **Priority:** MEDIUM
- **Dependency:** None
- **Compliance:** Required (R-04, ACPOL-02)
- **Finding:** REM-004

### 2.3 Logging & Monitoring

#### LOG-01: Comprehensive Audit Logging
- **What:** Extend audit logging beyond super-admin and deletion events. Implement structured access logs covering:
  - Authentication events (login success/failure, token refresh, password change)
  - Tenant-level CRUD operations (student/teacher create/update/delete)
  - Minors' data access (all reads of student records — highest priority)
  - Authorization failures (403 responses)
  - Export events (Ministry report generation)
  - Configuration changes (school year, tenant settings)
- **Where:** New logging middleware in `middleware/auditLog.middleware.js`, service-level log calls
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-08, ACPOL-03, Reg. 10)
- **Finding:** REM-008, REM-019

#### LOG-02: Log Retention Enforcement
- **What:** Implement the 3-tier retention schedule: 30 days operational (Pino), 2 years security/auth events, 7 years legal/minors' data. Add TTL indexes on log collections.
- **Where:** MongoDB index creation script, log collection management
- **Priority:** MEDIUM
- **Dependency:** LOG-01
- **Compliance:** Required (ACPOL-03)

#### LOG-03: Audit Log Query API
- **What:** Create an admin-facing API endpoint to query audit logs for compliance reporting and incident investigation.
- **Where:** New `api/audit-log/` module
- **Priority:** LOW
- **Dependency:** LOG-01
- **Compliance:** Best practice

### 2.4 Data Protection

#### DATA-01: TTL Indexes for Data Retention
- **What:** Add MongoDB TTL indexes to enforce documented retention periods:
  - `import_log`: 90 days (`createdAt` field + `expireAfterSeconds: 7776000`)
  - `deletion_snapshots`: 90 days
  - `tenant_deletion_snapshots`: 90 days
  - `migration_backups`: 180 days
  - `ministry_report_snapshots`: 365 days
- **Where:** New DB migration/setup script
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-11, Reg. 2/5)
- **Finding:** REM-011, REM-013

#### DATA-02: Purge Import Preview Data After Execution
- **What:** After successful import execution, set `import_log.previewData = null` to remove redundant PII copies. Keep import metadata (type, status, counts, timestamps).
- **Where:** `api/import/import.service.js` — in the execute flow after successful import
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-06)
- **Finding:** REM-006

#### DATA-03: Field-Level Encryption for RESTRICTED Data
- **What:** Implement application-level encryption for RESTRICTED data within blob fields: `import_log.previewData`, `deletion_snapshots.snapshotData`, `tenant_deletion_snapshots.collectionSnapshots`. Evaluate MongoDB CSFLE or application-layer AES-256-GCM.
- **Where:** New encryption utility service, integration into import/deletion services
- **Priority:** MEDIUM
- **Dependency:** DATA-01 (if blobs are TTL'd, encryption is less urgent)
- **Compliance:** Required by ENC-01 policy (Reg. 14)
- **Finding:** REM-021, REM-022

#### DATA-04: Separate Credentials Collection
- **What:** Move hashed passwords, refresh tokens, invitation tokens, and reset tokens from the `teacher` collection into a dedicated `credentials` collection referenced by teacherId. Reduces blast radius of any single collection exposure.
- **Where:** New `credentials` collection, migration script, updates to `auth.service.js`, `teacher.service.js`
- **Priority:** MEDIUM
- **Dependency:** None
- **Compliance:** Required (R-02)
- **Finding:** REM-002
- **Note:** This is a significant refactor. Carefully plan migration with zero-downtime approach.

#### DATA-05: API Response Minimization
- **What:** Ensure API responses return only fields needed for each endpoint. Add projection to service queries. Specifically target student endpoints to minimize minors' data exposure.
- **Where:** Service layer query projections across all modules
- **Priority:** MEDIUM
- **Dependency:** None
- **Compliance:** Required (R-03, DBDF-04)
- **Finding:** REM-003, REM-014

### 2.5 Infrastructure & Backups

#### INFRA-01: Verify S3 Bucket Security
- **What:** Confirm S3 Block Public Access is enabled. Enable S3 server access logging. Implement presigned URLs for document access instead of direct access. Restrict bucket policy to minimum permissions. Enable versioning.
- **Where:** AWS S3 console, `api/bagrut/bagrut.service.js` (presigned URL generation)
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-10)
- **Finding:** REM-010

#### INFRA-02: Global Rate Limiting
- **What:** Add rate limiting to all API routes, not just login. Currently only `POST /login` has a limiter (20 req / 5 min). Add tiered rate limiting:
  - Global: 100 req/min per IP
  - Auth routes: 20 req/5min (already exists for login, extend to all auth)
  - Import/export: 5 req/min
  - Super admin: 30 req/min
- **Where:** `server.js` (global), route-level limiters
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Best practice (defense in depth)

#### INFRA-03: Establish Backup Testing Cadence
- **What:** After BLOCK-06 validates initial backup/restore, establish quarterly automated backup testing with documented results.
- **Where:** Operational procedure, scheduled manual tests
- **Priority:** MEDIUM
- **Dependency:** BLOCK-06
- **Compliance:** Required (BACK-01, Reg. 5)
- **Finding:** REM-026

### 2.6 Tenant Isolation & Access Control

#### TENANT-01: Tenant Isolation Integration Tests
- **What:** Add comprehensive integration tests validating that every API endpoint properly enforces tenant boundaries. Test that Tenant A cannot access Tenant B's data through any endpoint.
- **Where:** New test suite in `test/integration/tenant-isolation/`
- **Priority:** HIGH
- **Dependency:** None
- **Compliance:** Required (R-01)
- **Finding:** REM-001

#### TENANT-02: Cross-Tenant Query Monitoring
- **What:** Add monitoring/alerting for any queries that might return data from multiple tenants. Log and alert on any buildScopedFilter calls where tenantId is missing.
- **Where:** `utils/queryScoping.js`, monitoring integration
- **Priority:** MEDIUM
- **Dependency:** LOG-01
- **Compliance:** Required (R-01)

### 2.7 Vendor & Legal Compliance

#### VENDOR-01: Document Cross-Border Transfer Legal Basis
- **What:** Establish and document the legal basis for transferring teacher email/name data to SendGrid's US infrastructure. Options: contractual necessity, adequate protection determination, or consent.
- **Where:** VENDOR-MANAGEMENT.md update, potential SendGrid DPA addendum
- **Priority:** MEDIUM
- **Dependency:** BLOCK-02 (SendGrid DPA)
- **Compliance:** Required (R-09, Reg. 15-16)
- **Finding:** REM-009

#### VENDOR-02: Evaluate Minors' Data Consent Mechanism
- **What:** Determine whether parental/guardian consent is legally required for processing minors' data beyond contractual necessity (conservatory enrollment). If yes, implement consent collection.
- **Where:** Legal review, potentially new consent service + frontend flow
- **Priority:** MEDIUM
- **Dependency:** BLOCK-03 (Security Officer to coordinate legal review)
- **Compliance:** Required (DBDF-03)
- **Finding:** REM-015

### Summary: 22 Implementation Tasks

| Priority | Count | Tasks |
|----------|-------|-------|
| HIGH | 10 | AUTH-01, AUTH-02, AUTH-03, SESS-01, LOG-01, DATA-01, DATA-02, INFRA-01, INFRA-02, TENANT-01 |
| MEDIUM | 10 | AUTH-04, SESS-02, LOG-02, DATA-03, DATA-04, DATA-05, INFRA-03, TENANT-02, VENDOR-01, VENDOR-02 |
| LOW | 2 | LOG-03, DATA classification enforcement |

---

## 3. Risk-to-Control Mapping Table

### HIGH Risks (6)

| Risk | Threat | Existing Control | Missing Control | Required Implementation |
|------|--------|------------------|-----------------|------------------------|
| **R-01** | Cross-tenant data leak | 4-layer tenant isolation (enforceTenant, buildContext, buildScopedFilter, stripTenantId), tenant-scoped indexes on 15 collections | No integration test suite validating tenant boundaries per endpoint; no runtime monitoring for cross-tenant queries | TENANT-01: Integration tests for every endpoint. TENANT-02: Runtime query monitoring. |
| **R-02** | Credential exposure in DB dump | bcrypt (10 rounds), token version counters, connection string in env vars | Credentials co-located with PII in teacher collection; no field-level encryption; no DB access audit logging | DATA-04: Separate credentials collection. DATA-03: Field-level encryption. LOG-01: DB access logging. |
| **R-03** | Minors' data breach via API | JWT auth, RBAC, tenant isolation, canAccessStudent() IDOR check, express-mongo-sanitize, helmet | No audit logging for minors' data access; API returns full documents (no minimization); no response schema validation | LOG-01: Minors' data access logging. DATA-05: API response minimization. |
| **R-04** | JWT secret compromise | Secrets in Render env vars (not code); separate access/refresh secrets; token version counter; 1h access token expiry | No secret rotation mechanism; no dual-key validation; HS256 (symmetric) — leaked secret enables both signing and verification | SESS-02: JWT key rotation with dual-key support. Consider RS256. |
| **R-10** | S3 bucket misconfiguration | S3 access key auth; eu-central-1 region; likely default Block Public Access | Bucket policy not verified; no server access logging; no presigned URLs; no versioning | INFRA-01: Verify BPA, enable logging, implement presigned URLs. |
| **R-11** | No data retention enforcement | Soft-delete flags; tenant purge; cascade deletion | Zero TTL indexes on any collection; data accumulates indefinitely; cannot demonstrate data minimization | DATA-01: TTL indexes. DATA-02: Purge import preview data. |

### MEDIUM Risks (5)

| Risk | Threat | Existing Control | Missing Control | Required Implementation |
|------|--------|------------------|-----------------|------------------------|
| **R-05** | Default password "123456" | `requiresPasswordChange` flag; server-side 403 enforcement in auth.middleware.js; bcrypt hashing | Default password still auto-set; bulk import creates many vulnerable accounts; enforcement assumed to be frontend-only (actually server-side) | AUTH-01: Remove default password. AUTH-03: Password policy enforcement. |
| **R-06** | Import log PII retention | None | previewData persisted indefinitely after successful import | DATA-02: Purge after execution. DATA-01: TTL index. |
| **R-07** | Deletion snapshot PII accumulation | None | Snapshots persisted indefinitely; undermines deletion rights | DATA-01: TTL indexes (90 days). |
| **R-08** | Insufficient logging | platform_audit_log (super admin), deletion_audit, Pino (unstructured) | No tenant-level CRUD logging; no auth event logging; no minors' data access logging | LOG-01: Comprehensive audit logging. |
| **R-09** | SendGrid cross-border transfer | HTTPS to SendGrid API; SOC 2 certification | No documented legal basis for cross-border transfer; no DPA with cross-border provisions | VENDOR-01: Legal basis. BLOCK-02: DPA execution. |

### LOW Risks (1)

| Risk | Threat | Existing Control | Missing Control | Required Implementation |
|------|--------|------------------|-----------------|------------------------|
| **R-12** | Student name denormalization | Tenant isolation; RBAC scoping; buildScopedFilter | Denormalized copies in teacher docs; complicates data subject deletion | Accepted — current controls adequate. Evaluate removal in future cycle. |

---

## 4. Minimal Safe Launch Definition

> **Revised 2026-03-02** — Stricter criteria applied. This platform processes minors' personal data (students as young as 6). The bar for "safe" must reflect that a data breach here affects children. "Minimum viable" does not mean "minimum possible."

### Tier 1: MUST exist before the first real tenant (launch blockers)

These are non-negotiable. Without every item in this tier, the platform MUST NOT accept real tenant data.

#### Technical Controls (code changes)

| # | Control | Covers | Status | Effort |
|---|---------|--------|--------|--------|
| 1 | **Disable seed + init-admin in production** | BLOCK-01 | **DONE** | — |
| 2 | **User monitoring notification** (login banner or ToS acceptance) | BLOCK-08, Reg. 10 | Open | 2-4 hours |
| 3 | **TTL indexes** on import_log, deletion_snapshots, tenant_deletion_snapshots | DATA-01, R-11 | Open | 2 hours |
| 4 | **Purge previewData** after successful import execution | DATA-02, R-06 | Open | 1 hour |
| 5 | **Verify S3 Block Public Access** is enabled | INFRA-01 (partial), R-10 | Open | 30 min |
| 6 | **Global rate limiting** on all API routes | INFRA-02 | Open | 2 hours |
| 7 | **Reduce refresh token lifetime** from 30 days to 7 days | SESS-01 (partial) | Open | 30 min |

**Why #7 is a launch blocker:** A 30-day refresh token means a lost or stolen device provides a full month of unauthorized access to minors' personal data. For a system handling children's data, this is unacceptable. Reducing to 7 days is a one-line change (`maxAge` in auth.service.js) that dramatically limits exposure from device theft/loss.

**Estimated dev effort for Tier 1 technical controls: ~1 day**

#### Administrative Actions (no code)

| # | Action | Covers | Status |
|---|--------|--------|--------|
| 8 | Execute DPAs with all 5 vendors | BLOCK-02, Reg. 15-16 | Open |
| 9 | Appoint named Security Officer | BLOCK-03, Reg. 3 | Open |
| 10 | Execute confidentiality agreements with all personnel | BLOCK-04, Reg. 17 | Open |
| 11 | Deliver security training to admins and teachers | BLOCK-05, Reg. 17 | Open |
| 12 | Test backup/recovery procedures | BLOCK-06, Reg. 5 | Open |
| 13 | Verify PPA registration status | BLOCK-07 | Open |

### Tier 2: MUST be implemented within 14 days of first tenant

These items are not launch blockers only because the platform launches with invite-only access to known users. But they MUST ship before the platform reaches 50 active users or 14 days post-launch, whichever comes first.

| # | Control | Why 14-Day Deadline | Risk If Delayed |
|---|---------|--------------------|-----------------|
| 14 | **AUTH-01: Remove default password "123456"** | Every bulk import creates accounts with a guessable password. Server-side 403 enforcement exists but the password is still guessable for brute-force. | With rate limiting in place (Tier 1), brute-force is harder but not impossible. Each imported teacher account is a potential entry point. |
| 15 | **AUTH-03: Password policy enforcement** | Without policy enforcement, users can set "1234" as their new password. The system forces password change but doesn't enforce quality. | Weak passwords on accounts with access to minors' data. |
| 16 | **SESS-01: Full session timeout / idle logout** | Beyond the reduced refresh token, active sessions should expire after 30 min of inactivity. Teachers may walk away from shared computers in conservatories. | An unlocked browser in a conservatory office = open access to all student data for that teacher's scope. |

### Tier 3: MUST be implemented within 30 days of first tenant

These items close HIGH-severity risks or address the only Non-Compliant finding. Delay beyond 30 days creates audit exposure.

| # | Control | Why 30-Day Deadline | Risk If Delayed |
|---|---------|--------------------|-----------------|
| 17 | **AUTH-02: MFA for admin + super-admin roles** | Only Non-Compliant item in AUDT-02 (Reg. 9.4). Admin accounts have platform-wide access to all minors' data. | Regulatory non-compliance. If admin credentials leak, no second factor protects all tenant data. |
| 18 | **LOG-01 Phase 1: Audit logging (auth events + minors' data access)** | Cannot investigate who accessed which student's data. Cannot respond to a parent asking "who viewed my child's information." | Regulatory exposure under Reg. 10. No incident investigation capability for data access questions. |
| 19 | **TENANT-01: Tenant isolation integration tests** | 4-layer isolation exists and was manually tested during v1.0, but no automated regression tests. Every new endpoint risks tenant boundary breach. | If a new endpoint bypasses tenant isolation, one conservatory's teachers could see another conservatory's students. |
| 20 | **INFRA-01 (full): S3 presigned URLs + logging + versioning** | Bagrut documents (minors' exam files) are stored in S3. Without presigned URLs, access control depends entirely on server-side gating. | If S3 bucket policy is misconfigured, minors' exam documents could be publicly accessible. |

### Tier 4: Implement within 60 days (v1.6 cycle completion)

These strengthen defense-in-depth. Not implementing them doesn't create an immediate regulatory violation, but they close remaining MEDIUM risks.

| Item | Why Deferrable to 60 Days | Risk of Deferral |
|------|---------------------------|------------------|
| DATA-04: Credential separation | Existing bcrypt + token versioning provides protection | Higher blast radius if DB dump is exposed |
| DATA-05: API response minimization | RBAC scopes data to authorized users | Authorized users see more fields than needed per-endpoint |
| DATA-03: Field-level encryption | Provider-level AES-256 covers all data at rest | If provider encryption bypassed, blob data readable |
| SESS-02: JWT key rotation | Secrets secure in Render env vars | Longer exposure window if secret leaks |
| LOG-02: Log retention enforcement | Operational logs managed by Pino | Cannot demonstrate retention compliance to auditor |
| TENANT-02: Cross-tenant query monitoring | 4-layer isolation + integration tests (by Tier 3) | No runtime detection of isolation failures |
| AUTH-04: Clean up unused roles | Unused roles have no permissions assigned | Attack surface: unused roles could be assigned permissions by mistake |
| VENDOR-01: Cross-border transfer legal basis | DPA in place (Tier 1) covers data handling | Legal basis for US transfer not formally documented |
| VENDOR-02: Minors' data consent evaluation | Legal review needed | May need parental consent mechanism — legal dependency |

**Important:** "Deferrable" does not mean "optional." Every item in Tier 4 should be implemented within the v1.6 cycle. The classification determines sequencing priority, not whether the work is necessary.

---

## 5. Recommended Order of Execution

### Phase A: Immediate (Before First Tenant) — ~1 week dev + parallel admin

**Dev work (1 day):**
1. BLOCK-01: Secure seed endpoint (30 min)
2. BLOCK-08: Monitoring notification banner (2-4 hours)
3. DATA-01: TTL indexes on 3 snapshot/log collections (2 hours)
4. DATA-02: Purge previewData after import (1 hour)
5. INFRA-01 (partial): Verify S3 Block Public Access (30 min)
6. INFRA-02: Global rate limiting (2 hours)

**Admin work (parallel, 2-4 weeks):**
7. BLOCK-02: Start DPA execution process (longest lead time — start first)
8. BLOCK-03: Appoint Security Officer
9. BLOCK-07: PPA registration inquiry
10. BLOCK-06: Backup testing
11. BLOCK-04: Confidentiality agreements (after SO appointed)
12. BLOCK-05: Security training (after SO appointed)

### Phase B: v1.6 Critical (First 30 Days Post-Launch)

Priority: Items that close HIGH risks or address the single Non-Compliant finding.

| Order | Task | Risk Closed |
|-------|------|-------------|
| 1 | AUTH-01: Remove default password | R-05 |
| 2 | AUTH-03: Password policy enforcement | R-05 |
| 3 | TENANT-01: Tenant isolation integration tests | R-01 |
| 4 | LOG-01: Comprehensive audit logging (Phase 1: auth events, minors' data, auth failures) | R-08 |
| 5 | INFRA-01 (full): S3 presigned URLs + logging + versioning | R-10 |
| 6 | SESS-01: Session timeout / idle logout | R-04 (partial) |
| 7 | AUTH-02: MFA for admin/super-admin | AUDT-02 Non-Compliant item |

### Phase C: v1.6 Important (Days 30-60)

Priority: Items that close remaining MEDIUM risks and strengthen defense in depth.

| Order | Task | Risk Closed |
|-------|------|-------------|
| 8 | DATA-04: Separate credentials collection | R-02 |
| 9 | DATA-05: API response minimization | R-03 |
| 10 | LOG-01 (Phase 2): Admin ops, export, config change logging | R-08 (full) |
| 11 | LOG-02: Log retention enforcement | ACPOL-03 |
| 12 | SESS-02: JWT key rotation support | R-04 |
| 13 | TENANT-02: Cross-tenant query monitoring | R-01 (full) |
| 14 | AUTH-04: Clean up unused roles | REM-017 |
| 15 | VENDOR-01: Cross-border transfer legal basis | R-09 |

### Phase D: v1.6 Completion (Days 60-90)

Priority: Defense in depth and policy-level requirements.

| Order | Task | Risk Closed |
|-------|------|-------------|
| 16 | DATA-03: Field-level encryption for RESTRICTED data | REM-021 |
| 17 | VENDOR-02: Minors' data consent evaluation | REM-015 |
| 18 | LOG-03: Audit log query API | REM-019 |
| 19 | INFRA-03: Quarterly backup testing cadence | REM-026 |
| 20 | LOG-01 (Phase 3): Import context, impersonation reads, anomaly detection | R-08 (complete) |

---

## 6. Route-Level Security Audit

**Audited:** 2026-03-02
**Scope:** All 25 route files + server.js middleware configuration
**Question:** Does any endpoint bypass authentication, allow privilege escalation, or expose sensitive operations without proper guards?

### Methodology

1. Read every route file in `api/*/` to identify routes without `authenticateToken` or `requireAuth`
2. Cross-referenced with `server.js` middleware chain to identify routes protected at mount level vs route level
3. Verified the middleware chain for each mount point in server.js (lines 129-340)
4. Checked for privilege escalation (routes where a lower role could access higher-role functions)

### Findings

#### FIXED: Two Unprotected Sensitive Endpoints

| Endpoint | File | Issue | Fix Applied |
|----------|------|-------|-------------|
| `POST /api/super-admin/seed` | `super-admin.route.js:10` | Public route, no auth, creates super admin account | Environment guard: route only exists when `NODE_ENV !== 'production'` |
| `POST /api/auth/init-admin` | `auth.route.js:17` | Public route, no auth, creates tenant admin with predictable credentials | Environment guard: route only exists when `NODE_ENV !== 'production'` |

Both endpoints had self-protection (reject if records already exist), but self-protection is insufficient: in a fresh or wiped database, they would allow unauthenticated account creation.

#### CONFIRMED SAFE: All Other Endpoints

**Super Admin routes** (`api/super-admin/super-admin.route.js`):
- `POST /auth/login`, `POST /auth/refresh` — Public auth endpoints (expected)
- All 20 other routes — Behind `authenticateSuperAdmin` middleware. Verified.

**Auth routes** (`api/auth/auth.route.js`):
- 6 public routes: login (rate-limited), tenants, refresh, forgot-password, reset-password, accept-invitation — All expected to be public for auth flows
- 5 admin-only routes: `authenticateToken + requireAuth(['מנהל'])` — Verified
- 4 protected routes: `authenticateToken` — Verified

**Health routes** (`api/health/health.route.js`):
- `GET /live`, `GET /ready` — Public health probes (expected)

**All tenant-scoped routes** (18 route files):
Every route in these modules uses `requireAuth([...])` at the route level AND receives the full middleware chain (`authenticateToken → enrichImpersonationContext → buildContext → enforceTenant → stripTenantId → addSchoolYearToRequest`) from server.js:
- student, teacher, orchestra, schedule, attendance, analytics, import, export, bagrut, hours-summary, school-year, settings, reports, cascade-deletion, admin, consistency-validation

**Server.js static routes:**
- `/accept-invitation/:token` (line 351) — Serves static HTML file. Token validation happens via API call from the page. No data exposed.
- `/force-password-change` (line 356) — Serves static HTML file. Password change requires valid auth token via API call.

#### LOW-RISK OBSERVATIONS (Not Blockers)

| Endpoint | Concern | Assessment |
|----------|---------|------------|
| `GET /api/config` (server.js:122) | Public, returns `{apiUrl, environment}` | Leaks environment name. No sensitive data. Acceptable. |
| `GET /api/auth/tenants?email=...` | Could be used for email enumeration | Expected for multi-tenant login UX. Rate limiting (Tier 1) mitigates abuse. |
| `/api/tenant` routes — no `enforceTenant` | Tenant management routes skip tenant enforcement | Correct: these routes manage tenants themselves. Protected by `authenticateToken + buildContext`. |
| `/api/files` routes — no `enforceTenant` | File routes skip tenant enforcement | Designed for cross-tenant file access (super admin). Protected by `authenticateToken + buildContext`. |

### Conclusion

**No unguarded sensitive endpoints remain after the two fixes applied.** Every route that accesses tenant data is behind authentication, role-based authorization, and tenant isolation middleware. The only public endpoints are health probes, authentication flows, and two static HTML pages — all expected and safe.

---

## 7. Safety Assessment

### Is the system SAFE for production?

**Conditionally YES — with the following requirements:**

The route-level security audit found **no authentication bypasses, no privilege escalation paths, and no unguarded sensitive operations** (after the two fixes applied in this session).

The system's security architecture is sound:
- **Authentication:** JWT with server-side enforcement of password change requirement
- **Authorization:** RBAC with role-specific route guards on every data endpoint
- **Tenant isolation:** 4-layer enforcement (enforceTenant middleware, buildContext, buildScopedFilter, stripTenantId) verified across all tenant-scoped routes
- **Input protection:** express-mongo-sanitize, helmet, CORS, rate limiting on login

### Remaining Critical Blockers (7 items — all administrative or minor code)

Before accepting real tenant data, these 7 items from Tier 1 must still be completed:

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | User monitoring notification (Reg. 10) | Code (2-4h) | Open |
| 2 | TTL indexes on snapshot/log collections | Code (2h) | Open |
| 3 | Purge previewData after import | Code (1h) | Open |
| 4 | Verify S3 Block Public Access | Infra check (30m) | Open |
| 5 | Global rate limiting on all routes | Code (2h) | Open |
| 6 | Reduce refresh token to 7 days | Code (30m) | Open |
| 7 | All administrative blockers (BLOCK-02 through BLOCK-07) | Business/legal | Open |

**Technical effort remaining: ~1 day of development.**
**Administrative effort remaining: 2-4 weeks (DPA execution is the critical path).**

### What was validated today

- [x] `/api/super-admin/seed` — Secured with environment guard
- [x] `/api/auth/init-admin` — Secured with environment guard
- [x] All 25 route files audited — no auth bypasses found
- [x] Server.js middleware chain verified — all mount points correctly configured
- [x] No privilege escalation paths identified
- [x] No unguarded sensitive operations found

---

## Appendix: Codebase Corrections to Compliance Docs

During the code audit for this document, one significant discrepancy was found between the compliance documentation and the actual codebase:

**`requiresPasswordChange` enforcement is server-side, not frontend-dependent.**

RISK-01 and ACPOL-02 both state that enforcement of the password change requirement "depends on frontend behavior." This is incorrect. The actual middleware (`auth.middleware.js` lines 190-200) returns HTTP 403 with `code: 'PASSWORD_CHANGE_REQUIRED'` for any protected API route when `requiresPasswordChange` is true. This is server-side enforcement — the frontend cannot bypass it.

This means R-05 (default password exploitation) has a stronger existing control than documented. The risk is real (the password is still guessable), but an account with the default password cannot access any data through the API until the password is changed.

**Recommendation:** Update RISK-01 R-05 existing controls and ACPOL-02 to reflect the server-side enforcement. This doesn't change the remediation plan (the default password should still be removed), but it corrects the risk assessment.

---

*Created: 2026-03-02*
*Based on: v1.5 compliance documents, RISK-01, AUDT-03, codebase audit*
