# Security Procedure Document

**Document ID:** SECPR-01/02/03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (as defined in SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon significant system change, security incident, or regulatory update
**Related Documents:** SECOFF-01/02 (Security Officer), DBDF-01 (Data Inventory), DBDF-02 (Data Purposes), DBDF-03 (Minors Data Analysis), DBDF-04 (Data Minimization), RISK-01 (Risk Assessment), SMAP-01 (Architecture Diagram), SMAP-02 (Data Flow Map), SMAP-03 (Vendor Inventory), GLOSS-01 (Glossary)

---

## 1. Purpose and Scope

### 1.1 Purpose

This document is the **Security Procedure Document** (Nohal Avtachat Meida / נוהל אבטחת מידע) required by **Regulation 4** (Takanat 4) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

It establishes the security procedures for the Tenuto.io music conservatory management platform, covering:

- **SECPR-01:** Access management, authentication, and authorization procedures
- **SECPR-02:** Backup, recovery, and business continuity procedures
- **SECPR-03:** Data handling, retention, and deletion procedures

This document references the risk assessment (RISK-ASSESSMENT.md, RISK-01) to ensure that security procedures address identified risks, and the data inventory (DATA-INVENTORY.md, DBDF-01) to ensure that procedures cover all personal data holdings.

### 1.2 Scope

This document covers:

- **All platform components** documented in ARCHITECTURE-DIAGRAM.md (SMAP-01): Node.js/Express backend, MongoDB Atlas database cluster, Render application hosting, AWS S3 file storage, SendGrid email delivery, Google Gmail fallback email
- **All personal data holdings** documented in DATA-INVENTORY.md (DBDF-01): 22 MongoDB collections (14 tenant-scoped, 8 platform-level), including RESTRICTED minors' data and teacher credentials
- **All data flows** documented in DATA-FLOW-MAP.md (SMAP-02): 11 identified data flow paths
- **All user roles**: 8 tenant-level roles + 1 platform-level role (super admin)

### 1.3 Security Level

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per the risk assessment documented in RISK-ASSESSMENT.md (RISK-01). This classification reflects the processing of minors' personal data (students aged approximately 6-18) and the multi-tenant architecture serving multiple conservatories.

### 1.4 Document Structure

Each section in this document follows a three-part pattern for honest compliance documentation:

1. **Current State** -- What security controls exist today, referencing actual code and configurations
2. **Gap Analysis** -- Where the current state does not meet the regulatory requirement or best practice
3. **Planned Remediation (v1.6)** -- What will be addressed in v1.6 Technical Hardening

This pattern is mandated because v1.5 is a documentation-only milestone. The procedures must accurately describe the current state -- not an aspirational state.

### 1.5 Document Ownership

This document is owned by the **Security Officer** as defined in SECURITY-OFFICER.md (SECOFF-01/02). The Security Officer is responsible for:

- Reviewing this document annually (Responsibility #2 in SECOFF-01)
- Ensuring procedures remain accurate against the current platform state
- Approving any changes to security procedures
- Reporting compliance status to senior management (Responsibility #4 in SECOFF-01)

---

## 2. Access Management (SECPR-01a)

### 2.1 User Account Lifecycle

**Current State:**

Teacher accounts are created through two channels:

1. **Admin dashboard:** Tenant administrators create individual teacher accounts via the admin interface. The account creation flow sets `isActive: true`, assigns roles from the `teacher.roles[]` array, and stores credentials in `teacher.credentials`.
2. **Bulk import:** Administrators upload an Excel file via the import system (`api/import/import.service.js`). Imported teachers are matched by email, then ID number, then name to prevent duplicates. Accounts created via import receive a default password (see Section 3.2 for the associated risk).

Account attributes include:

- `credentials.email` -- login identifier (unique within tenant via compound index `tenantId + email`)
- `credentials.password` -- bcrypt-hashed password (10 salt rounds)
- `roles[]` -- array of role strings (e.g., `["מורה"]`, `["מנהל", "מורה"]`)
- `isActive` -- soft-delete flag for account deactivation

Account deactivation is performed by setting `isActive: false`. Deactivated accounts cannot authenticate (checked during login flow). The deactivated account's data is retained in the `teacher` collection indefinitely.

**Gap Analysis:**

- No formal account provisioning approval workflow. Any tenant admin can create accounts without secondary approval.
- No automated deprovisioning for inactive accounts. Accounts that have not logged in for extended periods are not flagged or deactivated.
- No periodic access review process. There is no mechanism to verify that all active accounts still require access.
- No onboarding/offboarding procedures documented for conservatory staff changes.

**Planned Remediation (v1.6):**

- Implement an account review mechanism that flags accounts inactive for more than 90 days
- Define an inactive account deactivation policy (e.g., auto-deactivate after 180 days of inactivity with admin notification)
- Create an access review checklist for administrators to verify active accounts at the start of each school year

### 2.2 Role Assignment

**Current State:**

Roles are assigned during account creation or updated by tenant administrators. The platform defines 8 tenant-level roles stored in the `teacher.roles[]` array:

| Role (Hebrew) | Role (English) | Assignment Method |
|--------------|----------------|-------------------|
| מנהל | Admin | Assigned by tenant admin or during tenant setup |
| סגן מנהל | Deputy Admin | Assigned by tenant admin |
| ראש מגמה | Department Head | Assigned by tenant admin |
| מורה | Teacher | Default role for new accounts |
| מנצח | Conductor | Assigned by tenant admin |
| מלווה | Accompanist | Assigned by tenant admin |
| מורה-מלווה | Teacher-Accompanist | Assigned by tenant admin |
| אורח | Guest | Assigned by tenant admin |

Role changes take effect on the next authentication event (when a new JWT is issued). Existing JWTs continue to carry the previous role claims until they expire (1-hour access token lifetime).

**Gap Analysis:**

- No role change audit trail. When an admin changes a teacher's role, the change is not logged.
- No approval workflow for elevated roles. Assigning the Admin (מנהל) role to a teacher does not require secondary approval or confirmation.
- No periodic role review. There is no process to verify that role assignments remain appropriate over time.
- Role change propagation depends on token expiry. A role revocation does not take immediate effect on active sessions.

**Planned Remediation (v1.6):**

- Implement role change event logging in the `security_log` collection, capturing: who changed the role, for which teacher, old role, new role, timestamp
- Evaluate an admin role approval workflow (e.g., require confirmation from a second admin)
- Define a periodic role review process aligned with the school year cycle

### 2.3 Tenant Isolation

**Current State:**

Tenant isolation is enforced through a 5-layer defense architecture:

| Layer | Control | Implementation |
|-------|---------|---------------|
| 1 | `enforceTenant` middleware | `tenant.middleware.js:117-132` -- Validates tenant exists and is active; rejects requests for deactivated tenants |
| 2 | `buildContext` middleware | `tenant.middleware.js:24-77` -- Extracts tenantId from JWT claims and adds to `req.context`; builds `_studentAccessIds` for authorization |
| 3 | `stripTenantId` middleware | `tenant.middleware.js:85-110` -- Removes any client-supplied tenantId from request body/query to prevent tenant ID manipulation |
| 4 | `buildScopedFilter` utility | `utils/queryScoping.js:12-30` -- Injects tenantId into every database query filter |
| 5 | `requireTenantId` guard | `tenant.middleware.js:11-16` -- Service-layer guard that throws an error if a query is attempted without tenantId |

All 14 tenant-scoped collections have tenantId as a field on every document. Database queries are scoped by tenantId through `buildScopedFilter()`, ensuring that a teacher in Tenant A can never query documents belonging to Tenant B.

**Gap Analysis:**

- No automated tenant isolation testing. Isolation correctness depends on developer discipline -- every new endpoint and query must use `buildScopedFilter()` or risk a tenant data leak (R-01 from RISK-01).
- No runtime monitoring for cross-tenant query patterns. If a bug bypasses the scoping middleware, there is no detection mechanism.

**Planned Remediation (v1.6):**

- Implement automated tenant isolation integration tests that verify every API endpoint only returns data from the requesting tenant
- Add monitoring/alerting for any database query that lacks a tenantId filter
- Create a development checklist requiring tenant isolation verification for every new endpoint

### 2.4 Super Admin Access

**Current State:**

Super admin accounts are stored in a separate `super_admin` collection (platform-level, no tenantId). Authentication uses a separate middleware (`super-admin.middleware.js`) and JWT claims include `type: 'super_admin'` to distinguish platform-level tokens from tenant-level tokens.

Super admin capabilities:

- Tenant CRUD (create, read, update, delete tenants)
- Platform reporting (cross-tenant analytics)
- User management (create/modify tenant admin accounts)
- **Impersonation:** Super admins can generate a tenant-scoped JWT to operate as a specific teacher within a tenant. During impersonation, the JWT includes `isImpersonation: true` and `impersonatedBy` claims. Mutating actions performed during impersonation are logged in `platform_audit_log` with the impersonation context.

Super admin seed mechanism: The initial super admin account is created via a seed endpoint that hashes a predefined password and inserts a record into the `super_admin` collection.

**Gap Analysis:**

- The super admin seed endpoint has no rate-limit or environment guard. It could be called repeatedly in production, though it checks for existing accounts.
- No MFA for super admin accounts. Given that super admins have cross-tenant access to all data (including minors' PII), this is a significant gap.
- No super admin access review process. There is no mechanism to audit which super admin accounts exist and whether they are still needed.
- Impersonation audit logs are limited to mutating actions. Read-only operations during impersonation (viewing student records, accessing teacher data) are not logged.

**Planned Remediation (v1.6):**

- Add rate-limiting and environment guards on the super admin seed endpoint
- Implement MFA for super admin accounts as a priority security control
- Define a super admin access review process (quarterly review of all super admin accounts)
- Extend impersonation audit logging to include read operations, especially for minors' data

---

## 3. Authentication Procedures (SECPR-01b)

### 3.1 Authentication Architecture

**Current State:**

The platform uses JWT-based authentication with a dual-token architecture:

| Token | Type | Algorithm | Expiry | Storage |
|-------|------|-----------|--------|---------|
| Access token | Bearer token | HS256 (HMAC-SHA256) | 1 hour | Frontend localStorage |
| Refresh token | Stored in DB + returned to client | HS256 | 30 days | Frontend localStorage + `teacher.credentials.refreshToken` |

Authentication flow:

1. User submits `email + password` to `/api/auth/login`
2. Server verifies credentials against `teacher.credentials.password` (bcrypt compare)
3. If multi-tenant: server checks tenant assignment. If teacher belongs to multiple tenants, returns `TENANT_SELECTION_REQUIRED` response for tenant selection
4. Server generates access token (1h) and refresh token (30d) with claims: `userId`, `tenantId`, `role`, `tokenVersion`
5. Token refresh: Client sends expired access token + refresh token to `/api/auth/refresh-token`. Server validates refresh token against `teacher.credentials.refreshToken` and `tokenVersion`
6. Token revocation: Incrementing `tokenVersion` on the teacher document invalidates all outstanding refresh tokens for that user

Reference: ARCHITECTURE-DIAGRAM.md (SMAP-01) for the complete authentication component diagram.

**Gap Analysis:**

- No authentication event logging. Login successes, failures, token refreshes, and logouts are not systematically recorded (R-08 from RISK-01).

**Planned Remediation (v1.6):**

- Implement structured authentication event logging capturing: event type, user identifier, tenant, timestamp, IP address, success/failure, failure reason.

### 3.2 Password Management

**Current State:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Password hashing | bcrypt with 10 salt rounds | Active -- all passwords are hashed before storage |
| Default password | "123456" auto-set for teachers created without a password | Active -- **R-05 from RISK-01** |
| Forced password change | `requiresPasswordChange: true` flag set on accounts with default passwords | Active -- `checkPasswordChangeRequired` middleware enforces the flag |
| Password change enforcement | `checkPasswordChangeRequired` middleware blocks API calls (except password change) when flag is set | Active -- middleware in authentication chain |

**Gap Analysis:**

- **Default password "123456" is auto-set** for teachers created without a password (R-05 from RISK-01). This is the world's most common password. While the `requiresPasswordChange` flag is set, enforcement depends on the frontend cooperating with the middleware response. Accounts created via bulk import could result in dozens of accounts simultaneously accessible with this default.
- No password complexity requirements. The server does not enforce minimum length, character diversity, or dictionary checks.
- No password history tracking. A user can change their password back to a previously used password.
- No password expiry policy. Passwords remain valid indefinitely.
- No password change event logging.

**Planned Remediation (v1.6):**

- **Remove default passwords entirely** -- implement an invitation flow where all new accounts receive an email with a secure, one-time token link for initial password setup. Reference RISK-01 R-05 specifically.
- Add minimum password length (8 characters) and complexity requirements (at least one uppercase, one lowercase, one digit)
- Evaluate password history tracking (prevent reuse of last N passwords)
- Implement password change event logging

### 3.3 Token Management

**Current State:**

| Aspect | Implementation | Concern |
|--------|---------------|---------|
| Signing algorithm | HS256 (symmetric) | Single key used for both signing and verification |
| Signing keys | `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` stored in Render environment variables | Secrets not in code or version control |
| Key rotation | No rotation mechanism | Keys have been static since deployment |
| Token claims | `userId`, `tenantId`, `role`, `tokenVersion`, `isImpersonation` (optional) | Claims are standard and minimal |
| Token storage (frontend) | `localStorage` | Vulnerable to XSS attacks |

**Gap Analysis:**

- No key rotation mechanism. The JWT signing secrets have no rotation schedule, meaning a compromised key remains valid indefinitely (R-04 from RISK-01).
- HS256 symmetric signing means any party with the secret can both sign and verify tokens. There is no separation between token issuance and token validation capabilities.
- localStorage is vulnerable to XSS. Any JavaScript code injected into the frontend can read access and refresh tokens, enabling session hijacking.
- No token binding. Tokens are not bound to the originating client (IP, device fingerprint), so a stolen token can be used from any location.

**Planned Remediation (v1.6):**

- Evaluate RS256 asymmetric signing to separate signing (private key) from verification (public key)
- Implement a key rotation schedule with dual-key validation during the rotation window
- Evaluate httpOnly cookie storage for tokens to mitigate XSS-based token theft
- Consider token binding mechanisms (IP-based or device-based)

### 3.4 Session Controls

**Current State:**

Sessions are stateless -- the JWT access token IS the session. There is no server-side session store. The 1-hour access token expiry provides an implicit session timeout: after 1 hour of inactivity (no token refresh), the user must re-authenticate.

The `tokenVersion` counter on the teacher document provides a mechanism to invalidate all sessions for a specific user by incrementing the counter. This causes all outstanding refresh tokens for that user to fail validation.

**Gap Analysis:**

- No explicit session timeout. The 1-hour access token expiry acts as a de facto timeout, but there is no configurable idle timeout.
- No concurrent session limits. A user can be logged in from unlimited devices simultaneously.
- No "force logout all sessions" capability beyond the `tokenVersion` increment, which requires a backend action and does not immediately invalidate active access tokens (they remain valid until their 1-hour expiry).
- No session activity logging. There is no record of active sessions or session lifecycle events.

**Planned Remediation (v1.6):**

- Evaluate session management improvements including: configurable idle timeout, concurrent session limits, and immediate session invalidation
- Consider adding a server-side session store for enhanced control (trade-off: increased complexity and state management)

### 3.5 Account Lockout

**Current State:**

No account lockout mechanism exists. Failed login attempts are not tracked, counted, or limited at the application level.

**Gap Analysis:**

- Brute force attacks against the login endpoint are not mitigated at the application level. An attacker can attempt unlimited password guesses without being blocked (partially mitigated by bcrypt's computational cost, but not eliminated).
- No failed login attempt logging. There is no visibility into whether accounts are being targeted.
- No progressive delay or CAPTCHA mechanism.

**Planned Remediation (v1.6):**

- Implement account lockout after N consecutive failed attempts (recommended: 5 attempts) with progressive delay (1 min, 5 min, 15 min, 1 hour)
- Add failed login attempt logging with IP address capture
- Evaluate CAPTCHA integration for login after repeated failures

---

## 4. Authorization Procedures (SECPR-01c)

### 4.1 Role-Based Access Control (RBAC)

**Current State:**

The platform implements RBAC through `permissionService.js`, which defines a `ROLE_PERMISSIONS` map. This map formally defines permissions for 5 of the 8 tenant-level roles:

| Role (Hebrew) | Role (English) | Formally Defined in ROLE_PERMISSIONS |
|--------------|----------------|--------------------------------------|
| מנהל | Admin | Yes -- full CRUD on all tenant resources |
| מורה | Teacher | Yes -- own profile, assigned students, own schedule |
| מנצח | Conductor | Yes -- orchestras, students, rehearsals, schedule |
| מדריך הרכב | Ensemble Instructor | Yes -- ensembles, students, rehearsals |
| מורה תאוריה | Theory Teacher | Yes -- theory lessons, students |
| סגן מנהל | Deputy Admin | No -- handled via route-level `requireAuth` checks |
| מלווה / מורה-מלווה | Accompanist | No -- handled via route-level `requireAuth` checks |
| אורח | Guest | No -- handled via route-level `requireAuth` checks |

The `requireAuth` middleware enforces role checks at the route level. For example, `requireAuth(['מנהל', 'מורה'])` restricts an endpoint to Admin and Teacher roles. Routes declare their allowed roles explicitly.

**Gap Analysis:**

- 3 declared roles lack formal RBAC definitions in `permissionService.js`: Deputy Admin (סגן מנהל), Accompanist (מלווה/מורה-מלווה), and Guest (אורח). These roles are enforced via route-level `requireAuth` checks but have no explicit permission map. This creates inconsistency between the formal RBAC model and actual access enforcement.
- No formal documentation of which routes accept which roles. The role-to-route mapping exists only in code (route files) and is not centrally documented.
- No automated RBAC consistency testing to verify that route-level auth matches the intended permission model.

**Planned Remediation (v1.6):**

- Define `ROLE_PERMISSIONS` entries for all 8 tenant-level roles in `permissionService.js`
- Audit all route files for consistent role authorization
- Generate a centralized role-route permission matrix from code analysis
- Implement automated RBAC consistency tests

### 4.2 IDOR Prevention

**Current State:**

The platform provides utilities to prevent Insecure Direct Object Reference (IDOR) attacks:

| Utility | Location | Function |
|---------|----------|----------|
| `canAccessStudent()` | `utils/queryScoping.js` | Checks whether the requesting teacher has access to a specific student by comparing against `_studentAccessIds` (loaded from `teacherAssignments` in `buildContext`). No additional database query required. |
| `canAccessOwnResource()` | `utils/queryScoping.js` | Validates that a resource belongs to the requesting user (e.g., a teacher can only modify their own time blocks). |
| `buildScopedFilter()` | `utils/queryScoping.js` | Injects both `tenantId` and teacher-specific scope into database query filters, ensuring queries only return authorized results. |

**Gap Analysis:**

- Not all endpoints use the queryScoping utilities consistently. Some endpoints rely on manual authorization checks rather than the centralized utilities.
- No automated testing to verify IDOR protection across all endpoints.
- Resource ownership checks are not standardized -- some endpoints check ownership in the controller, others in the service layer.

**Planned Remediation (v1.6):**

- Audit all endpoints for consistent IDOR protection using the queryScoping utilities
- Standardize the authorization check location (preferably at the service layer for consistency)
- Add integration tests that attempt cross-user resource access

### 4.3 Minors' Data Access

**Current State:**

Student data represents minors under 18 (approximately ages 6-18, grades alef through yud-bet). All student personal information fields are classified as RESTRICTED per DATA-INVENTORY.md (DBDF-01).

Access to student data is scoped by teacher assignment:

- Teachers see only students assigned to them via `teacherAssignments`
- The `_studentAccessIds` set is built in `buildContext` middleware from the teacher's assigned students
- Administrators see all students within their tenant
- Super admins access student data through impersonation (logged in `platform_audit_log` for mutating actions)

There is no separate access tier for minors' data versus adult data. All personal data receives the same access control treatment regardless of the data subject's age.

**Gap Analysis:**

- No additional access controls for minors' data beyond standard teacher scoping. There is no heightened access restriction for student records compared to other tenant data.
- No minors' data access logging. Read access to student records is not logged -- only mutating super admin actions during impersonation are audited (R-08 from RISK-01).
- No parental consent mechanism. The platform does not capture or verify parental/guardian consent for processing minors' data. Consent is not used as a lawful basis for any collection (DATA-PURPOSES.md, DBDF-02).
- No age verification mechanism. The platform accepts the student's age as entered but does not verify it or apply age-specific access controls.
- Student names are denormalized into teacher records (`teaching.timeBlocks[].assignedLessons[].studentName`), creating additional copies of minors' PII outside the student collection (R-12 from RISK-01).

Reference: MINORS-DATA.md (DBDF-03) for the complete analysis of 5 identified gaps in minors' data handling.

**Planned Remediation (v1.6):**

- Implement minors' data access logging (read and write operations to student and bagrut collections)
- Evaluate a consent mechanism for parental/guardian authorization
- Evaluate data minimization in API responses to return only necessary student fields per endpoint (R-03 from RISK-01)

### 4.4 Principle of Least Privilege

**Current State:**

The platform applies the principle of least privilege through layered scoping:

| Scope Layer | Control | Effect |
|------------|---------|--------|
| Tenant | `enforceTenant` + `buildContext` | Users see only their tenant's data |
| Role | `requireAuth` + `ROLE_PERMISSIONS` | Users can only perform actions allowed by their role |
| Teacher | `buildScopedFilter` + `_studentAccessIds` | Teachers see only their assigned students |
| Admin | No additional scoping | Admins see all data within their tenant |
| Super Admin | Impersonation required | Super admins must explicitly impersonate a tenant user to access tenant data |

**Gap Analysis:**

- No formal least-privilege review process. Permissions are not regularly audited to verify they remain appropriate.
- Admin role grants full access within tenant -- there is no granular admin permission model (e.g., an admin who can manage teachers but not view student grades).
- The impersonation mechanism provides super admins with full admin-level access within any tenant, which is broader than may be necessary for specific administrative tasks.

**Planned Remediation (v1.6):**

- Define a periodic access review process aligned with the school year cycle
- Evaluate granular admin permissions for specific administrative functions
- Consider scoped impersonation (limiting impersonated actions to specific operations rather than full admin access)
