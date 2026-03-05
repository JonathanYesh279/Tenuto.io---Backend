# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** Phase 41 — Route Migration (v1.7)

## Current Position

Phase: 41 of 45 (Route Migration)
Plan: 01 of 01 — COMPLETE
Status: Plan 41-01 complete (7 core route files migrated to requirePermission)
Last activity: 2026-03-05 — Plan 41-01 complete (3 tasks, 9 files modified)

Progress: [███░░░░░░░] 30%

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

### Pending Todos

None.

### Blockers/Concerns

None.

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 39-01 | RBAC constants | 3min | 2 | 4 |
| 39-02 | Middleware permissions | 2min | 1 | 3 |
| 40-01 | Permission engine middleware | 2min | 2 | 2 |
| 41-01 | Core route migration | 6min | 3 | 9 |

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 41-01-PLAN.md (core route migration)
Resume: Continue with remaining Phase 41 plans or next phase
