# Access Control Policy

**Document ID:** ACPOL-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon role/permission changes
**Related Documents:** SECOFF-01/02 (Security Officer), SECPR-01/02/03 (Security Procedures), DBDF-01 (Data Inventory), DBDF-03 (Minors Data), RISK-01 (Risk Assessment), GLOSS-01 (Glossary)

---

## 1. Purpose

This document defines the access control policy for the Tenuto.io music conservatory management platform, as required by **Regulations 8-9** (Takkanot 8-9) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

It documents all application roles, their permissions, and tenant data boundaries. For each role, the document specifies which resources can be read, created, updated, or deleted, and the scope within which those operations are permitted.

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, detailed access control policies must be defined and periodically reviewed.

---

## 2. Scope

This policy covers all users who access the Tenuto.io platform:

- **Tenant-level users:** Teachers, administrators, conductors, and other staff roles within individual conservatories (tenants)
- **Platform-level users:** Super administrators who manage the platform across all tenants

The policy references the 22 MongoDB collections documented in DATA-INVENTORY.md (DBDF-01), which include 14 tenant-scoped collections and 8 platform-level collections. Data classifications (PUBLIC, INTERNAL, SENSITIVE, RESTRICTED) from DBDF-01 inform the access control requirements described herein.

---

## 3. Role Inventory

The Tenuto.io platform defines **9 roles**: 8 tenant-level roles stored in the `teacher.roles[]` array, and 1 platform-level role stored in a separate collection.

### 3.1 Complete Role Table

| # | Hebrew Name | English Name | Scope | Defined In | RBAC Status | Notes |
|---|------------|-------------|-------|-----------|-------------|-------|
| 1 | סופר-אדמין | Super Admin | Platform-wide | `super_admin` collection, `super-admin.middleware.js` | Separate auth flow | Separate data store, cross-tenant access via impersonation only |
| 2 | מנהל | Admin | Tenant-wide | `ROLE_PERMISSIONS` in `permissionService.js` | Formal RBAC | Full CRUD within tenant; `ADMIN_FULL` permission |
| 3 | סגן מנהל | Deputy Admin | Tenant-wide | Route-level `requireAuth` checks only | **GAP** -- No ROLE_PERMISSIONS entry | Not present in any route file `requireAuth` array; functionally unused |
| 4 | ראש מגמה | Department Head | Tenant-wide | Route-level `requireAuth` checks only | **GAP** -- No ROLE_PERMISSIONS entry | Not present in any route file `requireAuth` array; functionally unused |
| 5 | מורה | Teacher | Own assignments | `ROLE_PERMISSIONS` in `permissionService.js` | Formal RBAC | Scoped to assigned students via `teacherAssignments` |
| 6 | מנצח | Conductor | Orchestra scope | `ROLE_PERMISSIONS` in `permissionService.js` | Formal RBAC | Orchestra management + broad student read |
| 7 | מדריך הרכב | Ensemble Instructor | Orchestra/ensemble scope | `ROLE_PERMISSIONS` in `permissionService.js` | Formal RBAC | Student read/update, rehearsal management |
| 8 | מורה תאוריה | Theory Teacher | Theory lesson scope | `ROLE_PERMISSIONS` in `permissionService.js` | Formal RBAC | Theory lesson CRUD, assigned student read |
| 9 | מלווה / מורה-מלווה | Accompanist / Teacher-Accompanist | Own assignments | Route-level `requireAuth` checks only | **GAP** -- No ROLE_PERMISSIONS entry | Not present in any route file `requireAuth` array; functionally unused |
| 10 | אורח | Guest | Read-only | Route-level `requireAuth` checks only | **GAP** -- No ROLE_PERMISSIONS entry | Not present in any route file `requireAuth` array; functionally unused |

### 3.2 RBAC Gap Analysis

**Roles marked GAP have no formal RBAC permission definition in `permissionService.js`.** Access control for these roles is intended to be enforced via route-level `requireAuth()` checks in individual route files. However, upon examination of all route files in the codebase, the following roles **do not appear in any `requireAuth()` call**:

- **סגן מנהל** (Deputy Admin) -- never referenced in any route file
- **ראש מגמה** (Department Head) -- never referenced in any route file
- **מלווה** (Accompanist) -- never referenced in any route file
- **מורה-מלווה** (Teacher-Accompanist) -- never referenced in any route file
- **אורח** (Guest) -- never referenced in any route file

**Consequence:** If a teacher account is assigned one of these roles exclusively (without also having מורה, מנצח, מדריך הרכב, or מנהל), they would be **unable to access any protected route** because `requireAuth()` would reject them -- their role would not match any authorized role array.

**Note:** In practice, teachers typically have the מורה role in their `roles[]` array alongside any of these additional roles. The additional roles may function as display labels rather than functional access control designations. This inconsistency is flagged for v1.6 remediation.

### 3.3 Roles With Formal RBAC Definitions

The `ROLE_PERMISSIONS` map in `permissionService.js` defines explicit permissions for 5 roles:

**מנהל (Admin) -- 30 permissions:**
`ADMIN_FULL`, `TEACHER_READ`, `TEACHER_CREATE`, `TEACHER_UPDATE`, `TEACHER_DELETE`, `TEACHER_SCHEDULE`, `STUDENT_READ`, `STUDENT_CREATE`, `STUDENT_UPDATE`, `STUDENT_DELETE`, `ORCHESTRA_READ`, `ORCHESTRA_CREATE`, `ORCHESTRA_UPDATE`, `ORCHESTRA_DELETE`, `REHEARSAL_READ`, `REHEARSAL_CREATE`, `REHEARSAL_UPDATE`, `REHEARSAL_DELETE`, `SCHEDULE_READ`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`, `SCHEDULE_DELETE`, `THEORY_READ`, `THEORY_CREATE`, `THEORY_UPDATE`, `THEORY_DELETE`, `BAGRUT_READ`, `BAGRUT_CREATE`, `BAGRUT_UPDATE`, `BAGRUT_DELETE`, `AUDIT_READ`, `SYSTEM_CONFIG`

**מורה (Teacher) -- 10 permissions:**
`TEACHER_READ_OWN`, `TEACHER_UPDATE_OWN`, `STUDENT_READ_ASSIGNED`, `STUDENT_CREATE`, `STUDENT_UPDATE_ASSIGNED`, `SCHEDULE_READ_OWN`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`, `REHEARSAL_READ`, `THEORY_READ`

**מנצח (Conductor) -- 12 permissions:**
`TEACHER_READ_OWN`, `TEACHER_UPDATE_OWN`, `ORCHESTRA_READ`, `ORCHESTRA_CONDUCT`, `ORCHESTRA_UPDATE`, `STUDENT_READ`, `REHEARSAL_READ`, `REHEARSAL_CREATE`, `REHEARSAL_UPDATE`, `SCHEDULE_READ`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`

**מדריך הרכב (Ensemble Instructor) -- 10 permissions:**
`TEACHER_READ_OWN`, `TEACHER_UPDATE_OWN`, `STUDENT_READ`, `STUDENT_UPDATE`, `REHEARSAL_READ`, `REHEARSAL_CREATE`, `REHEARSAL_UPDATE`, `SCHEDULE_READ`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`

**מורה תאוריה (Theory Teacher) -- 10 permissions:**
`TEACHER_READ_OWN`, `TEACHER_UPDATE_OWN`, `STUDENT_READ_ASSIGNED`, `STUDENT_UPDATE_ASSIGNED`, `THEORY_READ`, `THEORY_CREATE`, `THEORY_UPDATE`, `THEORY_DELETE`, `SCHEDULE_READ_OWN`, `SCHEDULE_CREATE`

---

## 4. Permission Matrix

### 4.1 Resource-Role Permission Grid

The following matrix maps each role to the operations it can perform on each resource. Permissions are derived from two sources: **RBAC** (from `ROLE_PERMISSIONS` in `permissionService.js`) and **Route** (from `requireAuth()` calls in route files).

**Legend:**
- **R** = Read, **C** = Create, **U** = Update, **D** = Delete
- Superscript **o** = Own/self only (e.g., R^o = read own profile)
- Superscript **a** = Assigned students only
- Superscript **i** = Via impersonation (generates tenant-scoped JWT)
- **--** = No access
- Source noted: **(RBAC)** = from ROLE_PERMISSIONS, **(Route)** = from requireAuth arrays

| Resource | Super Admin | מנהל (Admin) | מורה (Teacher) | מנצח (Conductor) | מדריך הרכב (Ens. Instr.) | מורה תאוריה (Theory) |
|----------|-------------|-------------|----------------|------------------|--------------------------|---------------------|
| **Students** | RCUD^i | RCUD | R^a C U^a (RBAC) R^a (Route) | R (RBAC) R (Route) | R U (RBAC) R (Route) | R^a U^a (RBAC) |
| **Teachers** | RCUD^i | RCUD (RBAC+Route) | R^o U^o (RBAC) R (Route) | R^o U^o (RBAC) R (Route) | R^o U^o (RBAC) R (Route) | R^o U^o (RBAC) |
| **Orchestras** | RCUD^i | RCUD (RBAC+Route) | R (Route) | R U (RBAC) R (Route) | R (Route) | -- |
| **Rehearsals** | RCUD^i | RCUD (RBAC+Route) | R (RBAC+Route) | RCU (RBAC) RCUD (Route) | R (Route) RCU (RBAC) | -- |
| **Theory Lessons** | RCUD^i | RCUD (RBAC+Route) | R (RBAC+Route) | R (Route) | R (Route) | RCUD (RBAC+Route) |
| **Bagrut** | RCUD^i | RCUD (RBAC+Route) | RCU (Route) | -- | -- | -- |
| **Schedule/TimeBlocks** | RCUD^i | RCUD (RBAC+Route) | R^o CU (RBAC) RCU (Route) | RCU (RBAC) | RCU (RBAC) | R^o C (RBAC) |
| **Hours Summary** | R^i | RCU (Route) | R (Route, own) | -- | -- | -- |
| **Import** | --^i | RCUD (Route) | -- | -- | -- | -- |
| **Export** | --^i | R (Route) | -- | -- | -- | -- |
| **School Year** | RCUD^i | RCUD (Route) | R (Route) | R (Route) | R (Route) | -- |
| **Tenant Settings** | RCUD^i | RU (Route) | -- | -- | -- | -- |
| **Files** | R^i | R (Route) | R (Route) | R (Route) | R (Route) | -- |
| **Admin Tools** | --^i | RCUD (Route) | -- | -- | -- | -- |
| **User Management** | RCUD^i | CUD (Route) | -- | -- | -- | -- |

### 4.2 Super Admin Access Pathway

Super admin operations are handled through a separate authentication flow (Section 6). The RCUD^i notation indicates that super admins access tenant data **exclusively via impersonation**, which generates a standard tenant-scoped JWT with `isImpersonation: true`. During impersonation, the super admin operates with the permissions of the impersonated role (typically מנהל).

Super admin native operations (without impersonation) are limited to:
- Tenant CRUD (create, read, update, delete/purge tenants)
- Platform reporting and analytics
- User management (create admins, manage super admin accounts)
- Impersonation session management

### 4.3 Scope Limitations

| Scope Type | Applies To | Mechanism | Description |
|-----------|-----------|-----------|-------------|
| Tenant-wide | מנהל | `enforceTenant` middleware | Can access all data within their tenant |
| Assignment-scoped | מורה, מורה תאוריה | `buildScopedFilter` with `teacherAssignments.teacherId` | Can only access students assigned to them |
| Orchestra-scoped | מנצח | Route-level logic + orchestra conductorId matching | Can manage orchestras where they are the conductor |
| Own-only | All tenant roles | `TEACHER_READ_OWN`, `TEACHER_UPDATE_OWN` permissions | Can only read/update their own teacher profile |
| Platform-wide | סופר-אדמין | `super-admin.middleware.js` | Access to all tenants via impersonation |

---

## 5. Tenant Data Boundaries

### 5.1 Five-Layer Tenant Isolation Defense

The platform enforces tenant isolation through 5 independent layers. All layers must be bypassed for a cross-tenant data leak to occur.

| Layer | Control | Implementation | Code Reference | Defense |
|-------|---------|---------------|---------------|---------|
| 1 | Tenant enforcement | `enforceTenant` middleware rejects requests without valid tenantId in JWT | `tenant.middleware.js:117-132` | Blocks all requests that lack tenant context |
| 2 | Context injection | `buildContext` extracts tenantId from JWT and attaches to `req.context` | `tenant.middleware.js:24-77` | Ensures tenant context is derived from authenticated token, not client input |
| 3 | Client override prevention | `stripTenantId` removes tenantId from request body, params, and query | `tenant.middleware.js:85-110` | Prevents client-side tenantId injection/manipulation |
| 4 | Query scoping | `buildScopedFilter` injects tenantId into all database queries | `utils/queryScoping.js:12-30` | Ensures every database query is constrained to the authenticated tenant |
| 5 | Service guard | `requireTenantId` validates tenantId presence in service layer | `tenant.middleware.js:11-16` | Last-resort guard -- service layer rejects operations without tenant context |

### 5.2 Tenant Isolation Principle

No user in any role can access data belonging to a different tenant. This is an architectural invariant enforced at every layer of the application stack:

- **Middleware layer:** Tenant context derived from JWT, not from client request
- **Route layer:** All tenant-scoped routes pass through the tenant middleware chain
- **Service layer:** Services receive tenantId from middleware context, not from parameters
- **Database layer:** All queries against tenant-scoped collections include tenantId filter

### 5.3 Cross-Tenant Access Exception

The only mechanism for accessing data across tenant boundaries is **super admin impersonation** (Section 6). Impersonation generates a standard tenant-scoped JWT for the target tenant, meaning the super admin's session is fully bound by the target tenant's data boundaries during impersonation. Cross-tenant data aggregation is performed only through platform-level reporting APIs that query each tenant's data independently.

---

## 6. Super Admin Access Controls

### 6.1 Separate Authentication Flow

Super admin accounts are completely separated from tenant user accounts:

| Aspect | Super Admin | Tenant Users |
|--------|------------|-------------|
| Data store | `super_admin` collection | `teacher` collection |
| Authentication middleware | `super-admin.middleware.js` | `auth.middleware.js` |
| JWT claim | `type: 'super_admin'` | Standard teacher JWT |
| Login endpoint | `/api/super-admin/login` | `/api/auth/login` |
| Token validation | Checks `super_admin` collection | Checks `teacher` collection |

### 6.2 Impersonation Controls

Super admin cross-tenant access is exclusively through impersonation:

1. **Session creation:** Super admin requests impersonation of a specific teacher in a specific tenant
2. **Token generation:** System generates a standard tenant-scoped JWT with `isImpersonation: true` claim
3. **Scope binding:** The impersonation JWT is bound to the target tenant's data boundaries
4. **Audit logging:** The impersonation session start is logged in `platform_audit_log`
5. **Mutating actions:** All create/update/delete operations during impersonation are logged in `platform_audit_log` with the super admin's identity
6. **Session end:** Impersonation session end is logged in `platform_audit_log`

### 6.3 Super Admin Capabilities

| Capability | Method | Audit Logged |
|-----------|--------|-------------|
| Tenant creation | Direct API | Yes -- `platform_audit_log` |
| Tenant deactivation | Direct API | Yes -- `platform_audit_log` |
| Tenant purge (permanent deletion) | Direct API | Yes -- `platform_audit_log` |
| Platform reporting | Direct API | Yes -- `platform_audit_log` |
| Admin account management | Direct API | Yes -- `platform_audit_log` |
| Tenant data access | Via impersonation only | Yes -- impersonation session + all actions |
| Tenant data modification | Via impersonation only | Yes -- all mutating actions during session |

---

## 7. Minors' Data Access

### 7.1 Cross-Reference

For the complete minors' data analysis, see MINORS-DATA.md (DBDF-03). This section summarizes the access control provisions specific to minors' data.

### 7.2 Current Controls

Minors' data (student and bagrut collections, classified RESTRICTED in DBDF-01) is protected by:

| Control | Description | Limitation |
|---------|------------|-----------|
| Tenant isolation | 5-layer defense (Section 5) prevents cross-tenant access | None -- effective |
| Role-based access | Only roles listed in `requireAuth()` arrays can access student routes | Does not distinguish between adult and minor data |
| Assignment scoping | Teachers (מורה) can only access students assigned to them via `teacherAssignments` | Does not apply to מנצח or מדריך הרכב who have broad `STUDENT_READ` |
| Context-based IDOR prevention | `req.context.scopes.studentIds` limits teacher access | Not all endpoints consistently use this |

### 7.3 Identified Gaps

| # | Gap | Impact | Reference |
|---|-----|--------|-----------|
| 1 | No additional access tier for minors' data | Adult and minor data treated identically by access controls | DBDF-03, Gap 1 |
| 2 | No minors' data access logging | Cannot audit who accessed student records, when, or what they viewed | DBDF-03, Gap 2; R-08 in RISK-01 |
| 3 | No parental consent mechanism | Student records created without documented parental consent workflow | DBDF-03, Gap 1 |
| 4 | No age verification at data entry | System does not validate minor status to apply enhanced protections | DBDF-03, Gap 3 |
| 5 | Broad student read for מנצח and מדריך הרכב | These roles have `STUDENT_READ` (all students in tenant), not `STUDENT_READ_ASSIGNED` | permissionService.js |

### 7.4 v1.6 Remediation

- Implement minors' data access logging (dedicated audit trail for student/bagrut collection access)
- Evaluate parental consent requirements and implement consent recording mechanism
- Restrict מנצח and מדריך הרכב to `STUDENT_READ_ASSIGNED` where possible
- Add age verification flag to student records

---

## 8. IDOR Prevention

### 8.1 Current Controls

The platform implements Insecure Direct Object Reference (IDOR) prevention through:

| Utility | Location | Function |
|---------|----------|----------|
| `canAccessStudent()` | `utils/queryScoping.js` | Checks if a student ID is in the teacher's `_studentAccessIds` set (loaded in `buildContext`). No database round-trip required. |
| `canAccessOwnResource()` | `utils/queryScoping.js` | Checks if a resource belongs to the requesting user |
| `buildScopedFilter()` | `utils/queryScoping.js` | Injects tenantId and role-based scoping into all database queries |
| `_studentAccessIds` | `buildContext` in `tenant.middleware.js` | Lazy-loaded set of student IDs the authenticated teacher is assigned to, derived from `teacherAssignments` |

### 8.2 How It Works

1. During request processing, `buildContext` middleware loads `_studentAccessIds` for teacher-role users
2. When a teacher requests a specific student by ID, `canAccessStudent(studentId, req.context)` checks membership in the pre-loaded set
3. This provides O(1) authorization checks without additional database queries
4. For list queries, `buildScopedFilter` adds `teacherAssignments.teacherId` to the query filter

### 8.3 Gap

Not all endpoints consistently use `canAccessStudent()` or `buildScopedFilter()`. Some student-related endpoints may rely solely on route-level `requireAuth()` without additional resource-level authorization checks. This means a teacher with the מורה role could potentially access any student in their tenant (not just assigned students) through endpoints that lack the scoping filter.

**v1.6 Remediation:** Audit all student-facing endpoints for consistent use of `canAccessStudent()` or `buildScopedFilter()`. Implement middleware-level enforcement to apply scoping automatically.

---

## 9. Access Review Process

### 9.1 Current State

**No formal access review process exists.** Role assignments are made by tenant administrators at their discretion, with no periodic review or revalidation. There is no mechanism to flag stale permissions, detect over-privileged accounts, or identify inactive accounts that retain access.

### 9.2 Recommended Process (Pending Security Officer Activation)

The Security Officer (SECOFF-01/02) should establish the following access review schedule:

| Review Type | Frequency | Scope | Reviewer | Deliverable |
|------------|-----------|-------|---------|-------------|
| Admin role audit | Quarterly | Verify admin role assignments per tenant -- confirm each admin still requires admin access | Security Officer or delegate | List of verified/revoked admin assignments |
| Full access review | Annually | Review all role assignments across all roles in all tenants | Security Officer | Access review report with findings and actions |
| School year transition | At start of each school year | Review teacher accounts -- deactivate teachers who have left, update role assignments for new year | Tenant administrator | Updated account list for new school year |
| On-event: role change | On occurrence | Review immediately when a teacher's role is changed (especially escalation to admin) | Security Officer notified | Confirmation of appropriate role assignment |
| On-event: deactivation | On occurrence | Review when tenant is deactivated or teacher account deactivated | Security Officer notified | Confirmation of complete access revocation |
| On-event: security incident | On occurrence | Immediate review of all access related to the incident scope | Security Officer | Incident-related access review report |

### 9.3 v1.6 Implementation Plan

- Add last-login tracking to enable identification of inactive accounts
- Implement admin notification for accounts inactive for 90+ days
- Create access review dashboard for Security Officer use
- Add role change audit logging at the tenant level

---

## 10. Gap Summary and Remediation Roadmap

### 10.1 Consolidated Access Control Gaps

| # | Gap | Category | Impact | Current Risk | Remediation | Target |
|---|-----|----------|--------|-------------|------------|--------|
| 1 | 5 roles without formal RBAC or route-level auth | Role definition | Users with these roles exclusively cannot access any route; inconsistent enforcement model | LOW (roles not used in isolation) | Define all roles in `ROLE_PERMISSIONS`; remove unused roles from valid role list | v1.6 |
| 2 | No access review process | Administrative | Stale permissions accumulate; no detection of over-privileged or inactive accounts | MEDIUM | Implement review schedule per Section 9.2 | v1.6 |
| 3 | No minors' data access logging | Compliance | Cannot demonstrate who accessed student data or investigate access incidents | HIGH (R-08 in RISK-01) | Implement structured access logging for student and bagrut collections | v1.6 |
| 4 | No parental consent mechanism | Compliance | Student records processed without documented consent from parent/guardian | MEDIUM (DBDF-03 Gap 1) | Implement consent recording workflow | v1.6 |
| 5 | Broad STUDENT_READ for מנצח and מדריך הרכב | Least privilege | These roles can read all students in tenant, not just those in their orchestras/ensembles | MEDIUM | Restrict to `STUDENT_READ_ASSIGNED` or orchestra-scoped read | v1.6 |
| 6 | Inconsistent IDOR prevention | Authorization | Some endpoints may not use `canAccessStudent()` or `buildScopedFilter()` | MEDIUM (R-03 in RISK-01) | Audit all student-facing endpoints; implement middleware-level enforcement | v1.6 |
| 7 | No tenant-level admin action logging | Audit | Admin actions within a tenant (user creation, role changes, settings) not logged | MEDIUM (R-08 in RISK-01) | Implement tenant-level admin audit log | v1.6 |
| 8 | No automated deprovisioning | Administrative | Inactive accounts retain full access indefinitely | LOW | Implement 90-day inactivity flagging with admin notification | v1.6 |
| 9 | Super admin seed endpoint | Security | No rate limit or environment guard on super admin account creation | MEDIUM | Add environment check (development only) and rate limiting | v1.6 |

### 10.2 Remediation Priority

1. **CRITICAL (v1.6 Phase 1):** Gap 3 (minors' data access logging) -- regulatory requirement for compliance with Regulation 12
2. **HIGH (v1.6 Phase 1):** Gap 6 (IDOR prevention consistency) -- security vulnerability
3. **MEDIUM (v1.6 Phase 2):** Gaps 1, 2, 5, 7, 9 -- access control hardening
4. **LOW (v1.6 Phase 3):** Gaps 4, 8 -- operational improvements

---

## 11. Route-Level Access Control Reference

### 11.1 Actual Route Authorization by Module

The following documents the actual `requireAuth()` arrays in each route file, providing a ground-truth reference for which roles can access which endpoints.

**Student Routes** (`api/student/student.route.js`):
- GET `/`, `/:id` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- GET `/:studentId/private-lesson-attendance`, `/:studentId/attendance-history` -- `['מורה', 'מנהל']`
- POST `/` -- `['מנהל', 'מורה']`
- PUT `/:id`, `/:id/test` -- `['מורה', 'מנהל']`
- PATCH `/:id/stage-level` -- `['מורה', 'מנהל']`
- DELETE `/:id` -- `['מנהל', 'מורה']`

**Teacher Routes** (`api/teacher/teacher.route.js`):
- GET `/`, `/profile/me`, `/:id`, `/role/:role` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- PUT `/profile/me` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- GET `/:teacherId/lessons`, `/weekly-schedule`, `/day-schedule`, etc. -- `['מורה', 'מנהל']`
- POST `/` -- `['מנהל']`
- PUT `/:id` -- `['מנהל']`
- DELETE `/:id` -- `['מנהל']`
- POST/DELETE `/:teacherId/student/:studentId` -- `['מנהל']`
- GET/POST/PUT/DELETE time-blocks -- `['מורה', 'מנהל']`

**Orchestra Routes** (`api/orchestra/orchestra.route.js`):
- GET `/`, `/:id` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- POST `/` -- `['מנהל']`
- PUT `/:id` -- `['מנהל', 'מנצח']`
- DELETE `/:id` -- `['מנהל']`
- POST/DELETE `/:id/members` -- `['מנהל', 'מנצח', 'מדריך הרכב']`
- GET attendance -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- PUT attendance -- `['מנצח', 'מנהל']`

**Rehearsal Routes** (`api/rehearsal/rehearsal.route.js`):
- GET `/`, `/orchestra/:id`, `/:id` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`
- POST `/` -- `['מנצח', 'מנהל']`
- PUT `/:id` -- `['מנצח', 'מנהל']`
- DELETE `/:id` -- `['מנצח', 'מנהל']`
- PUT attendance -- `['מנצח', 'מנהל']`
- Bulk operations -- `['מנהל', 'מנצח']`

**Theory Lesson Routes** (`api/theory/theory.route.js`):
- GET (all read routes) -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']`
- POST/PUT/DELETE (write routes) -- `['מנהל', 'מורה תאוריה']`
- DELETE by teacher -- `['מנהל', 'מורה תאוריה', 'מורה']`

**Bagrut Routes** (`api/bagrut/bagrut.route.js`):
- GET `/` -- `['מנהל']`
- GET `/:id`, `/student/:studentId` -- `['מנהל', 'מורה']`
- POST/PUT (all write routes) -- `['מנהל', 'מורה']`
- DELETE -- `['מנהל']`

**School Year Routes** (`api/school-year/school-year.route.js`):
- GET (all read routes) -- `['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']`
- POST/PUT (write routes) -- `['מנהל']`

**Hours Summary Routes** (`api/hours-summary/hours-summary.route.js`):
- GET `/` -- `['מנהל']`
- GET `/teacher/:teacherId` -- `['מנהל', 'מורה']`
- POST calculate -- `['מנהל']`

**Import Routes** (`api/import/import.route.js`):
- All routes -- `['מנהל']`

**Export Routes** (`api/export/export.route.js`):
- All routes -- `['מנהל']`

**Admin Routes** (cleanup, cascade-deletion, data-integrity, etc.):
- All routes -- `['מנהל']`

**File Routes** (`api/file/file.route.js`):
- GET `/:filename` -- `['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']`

**Tenant Routes** (`api/tenant/tenant.route.js`):
- All routes -- `['מנהל']`

---

## 12. Review Schedule

### 12.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Accuracy of the role inventory against the current codebase (`ROLE_PERMISSIONS` and `requireAuth()` arrays)
- Completeness of the permission matrix against current API endpoints
- Currency of the tenant isolation layers against current middleware implementation
- Status of remediation items in Section 10

### 12.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| New role added to the platform | Full role inventory and permission matrix update |
| New API endpoint or resource type added | Permission matrix update |
| Change to tenant isolation middleware | Tenant data boundaries section update |
| Change to `ROLE_PERMISSIONS` in `permissionService.js` | Permission matrix update |
| Security incident involving unauthorized access | Full document review |
| Regulatory update affecting access control requirements | Full document review |

---

## 13. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Security Officer | SECOFF-01/02 | Document owner; approves access policies |
| Security Procedures | SECPR-01/02/03 | Parent procedure document; this policy implements SECPR-01a access management |
| Data Inventory | DBDF-01 | Source for collection list and data classifications |
| Minors Data Analysis | DBDF-03 | Source for minors' data access requirements and gaps |
| Risk Assessment | RISK-01 | Source for access-control-related risks (R-01, R-03, R-08) |
| Glossary | GLOSS-01 | Terminology reference for role names and regulatory terms |
| Auth Policy | ACPOL-02 | Companion policy covering authentication controls |
| Access Logging Policy | ACPOL-03 | Companion policy covering access event logging |

---

**Document ID:** ACPOL-01 -- Access Control Policy
**Phase:** 28 -- Governance Framework and Security Policies
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
