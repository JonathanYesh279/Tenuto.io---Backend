# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v1.7 RBAC & Admin Provisioning — COMPLETE

## Current Position

Phase: 48 of 48 (v1.7 Bug Fixes & Polish)
Plan: 1 of 1 — COMPLETE
Status: Phase 48 complete — v1.7 milestone SHIPPED
Last activity: 2026-03-06 — Completed 48-01 (v1.7 Bug Fixes & Polish)

Progress: [██████████] 100%

## Performance Metrics

**Previous milestones:** 38 phases, 92+ plans across 7 milestones
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)
**v1.6:** 26 plans, 8 phases (2026-03-03 -> 2026-03-04)

## Accumulated Context

### Decisions

- Hybrid RBAC: hardcoded defaults stored on tenant.rolePermissions, customizable by admin
- Admin provisioning: inline in tenant creation form (MongoDB transaction)
- 13 roles across 4 tiers: Admin (3), Coordinator (2), Teaching (7), View-only (1)
- Department coordinators scoped via coordinatorDepartments[] using INSTRUMENT_DEPARTMENTS
- Permission engine: requirePermission(domain, action) with scope modifiers (all/department/own)
- Locked domains: settings + roles only grantable to admin-tier roles
- Admin lockout prevention: cannot remove last admin, cannot downgrade admin permissions
- Design doc: docs/plans/2026-03-05-rbac-admin-provisioning-design.md
- 39-01: Admin-tier roles share same frozen ADMIN_PERMISSIONS object reference
- 39-01: rolePermissions defaults to null on tenant schema; middleware falls back to DEFAULT_ROLE_PERMISSIONS
- 39-01: LOCKED_DOMAINS (settings, roles) enforced via validateRolePermissions
- 39-02: isAdminTier helper kept private in auth.middleware (not exported)
- 39-02: buildContext queries tenant for rolePermissions separately (small indexed projection)
- 39-02: DB errors on rolePermissions fetch silently fall back to defaults (no 500)
- 40-01: requirePermission checks LOCKED_DOMAINS before effectivePermissions (non-admins blocked from settings/roles regardless of tenant customization)
- 40-01: buildScopedFilter department scope filters students by personalInfo.instrument via getInstrumentsByDepartment
- 40-01: canAccessStudent returns true for department scope (list filtering handled by buildScopedFilter)
- 40-01: Empty coordinatorDepartments with department scope falls back to own-scope behavior
- 41-01: Permission matrix expanded before route migration to prevent 403 regressions
- 41-01: Role normalization in buildContext only -- teacher.roles never mutated
- 41-01: Bagrut and file routes use 'students' domain (student data)
- 41-01: Teacher schedule/lesson routes use 'schedules' domain (not 'teachers')
- 41-02: School-year GET routes use 'schedules' domain (not locked 'settings') to preserve teacher/conductor access
- 41-02: Hours-summary teacher self-view uses 'schedules' domain (not 'reports') since teachers have no reports permission
- 41-02: Room-schedule uses locked 'settings' domain to preserve admin-only access
- 41-02: Destructive admin operations use 'settings.update' (settings domain has no 'delete' action)
- 41-02: Auth admin routes chain buildContext inline since /api/auth mounted without it in server.js
- 42-01: Deep clone DEFAULT_ROLE_PERMISSIONS via JSON.parse/stringify for tenant rolePermissions
- 42-01: No cross-tenant email uniqueness check for brand new tenant (compound index is tenantId + email)
- 42-01: Admin teacher gets invitationMode DEFAULT_PASSWORD with requiresPasswordChange: true
- 43-01: Admin-tier roles always return defaults on reset (no DB write needed)
- 43-01: getRolePermissions includes teacher list for UI role assignment context
- 43-01: LOCKED_DOMAINS double-checked in service layer (defense in depth beyond validateRolePermissions)
- 43-02: SAFE-01 uses countDocuments with ADMIN_TIER_ROLES $in query for last-admin check
- 43-02: coordinatorDepartments forced to [] when department coordinator role not in roles array
- 43-02: Custom error codes (LAST_ADMIN, INVALID_ROLES, INVALID_DEPARTMENTS) for structured client handling
- 44-01: Save button moved inside general TabsContent (not relevant for roles tab)
- 44-01: Role badges colored by tier (admin=red, coordinator=blue, teaching=green, view-only=gray)
- 44-01: Department coordinator section uses distinct blue background for visual separation
- 44-02: Used Lock icon instead of LockSimple (not available in installed phosphor-icons)
- 44-02: All unique actions shown as columns with dash for non-applicable domain-action pairs
- 44-02: Scope cycling uses local state clone with dirty tracking for save enablement
- 45-01: TENANT_ADMIN_PROJECTION as reusable projection constant for all tenant admin queries
- 45-01: Batch tenant lookup in getAllTenantAdmins instead of $lookup aggregation for simplicity
- 45-01: Email update syncs both personalInfo.email and credentials.email
- 45-01: Password reset uses DEFAULT_PASSWORD from invitationConfig with requiresPasswordChange: true
- 45-02: Table layout for dense admin listing (not cards)
- 45-02: KeyIcon for password reset button (intuitive affordance)
- 45-02: Role badge colors match 44-01 tier coloring (admin=red, coordinator=blue, teaching=green)
- 46-01: Removed Card wrapper around filters since FilterPanel provides its own border/background
- 46-01: Removed duplicate isCompleted filter (redundant with status filter)
- 46-01: Used bagrutSource instead of bagruts for conservatory options (teacher view correctness)
- 46-01: Age filter uses birthDate or dateOfBirth field from student personalInfo
- 47-01: Student-specific attendance routes use 'students' domain (consistent with student.route.js)
- 47-01: Analytics/aggregate routes use 'reports' domain (consistent with Phase 41 past-activities pattern)
- 47-01: Teacher schedule attendance uses 'schedules' domain (consistent with Phase 41 hours-summary self-view)
- 47-01: Export attendance report uses 'reports.export' action

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config. Also consider: rate limiting on auth endpoints, separate token secret for password resets, multi-tenant support in ForgotPassword form.

### Roadmap Evolution

- Phase 45 added: Super Admin Tenant Admin Management (dedicated page for viewing/managing tenant admin accounts)
- Original Phase 45 (Migration & Verification) removed — middleware fallback makes migration unnecessary
- Phase 46 added: Bagrut UI/UX Alignment — upgrade bagrut pages to modern FilterPanel + SearchInput patterns, add grade and age filters

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Forced password change flow after admin password reset | 2026-03-06 | 4f3ff9c | [1-forced-password-change](./quick/1-forced-password-change-flow-after-admin-/) |

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 39-01 | RBAC constants | 3min | 2 | 4 |
| 39-02 | Middleware permissions | 2min | 1 | 3 |
| 40-01 | Permission engine middleware | 2min | 2 | 2 |
| 41-01 | Core route migration | 6min | 3 | 9 |
| 41-02 | Remaining route migration | 3min | 2 | 15 |
| 42-01 | Tenant+admin provisioning | 3min | 2 | 3 |
| 43-01 | Permission config API | 2min | 2 | 4 |
| 43-02 | Role assignment endpoint | 3min | 2 | 3 |
| 44-01 | Settings UI staff roles | 13min | 2 | 5 |
| 44-02 | Permission matrix editor | 6min | 2 | 2 |
| 45-01 | Tenant admin management API | 2min | 2 | 4 |
| 45-02 | Tenant admin management UI | 2min | 2 | 3 |
| 46-01 | Bagrut list page modernization | 4min | 2 | 1 |
| 47-01 | Dept scope wiring + route migration | 2min | 2 | 14 |
| 48-01 | v1.7 bug fixes & polish | 1min | 2 | 2 |

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 48-01 (v1.7 Bug Fixes & Polish)
Resume: Phase 48 complete. v1.7 milestone SHIPPED. All known bugs resolved: null-safe teacherProfile in Bagruts.tsx, ROLE_COLORS updated to match 13 current TEACHER_ROLES.
