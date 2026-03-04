# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** Phase 39 — Role & Permission Foundation (v1.7)

## Current Position

Phase: 39 of 45 (Role & Permission Foundation)
Plan: 01 complete
Status: Executing
Last activity: 2026-03-05 — 39-01 RBAC constants and permission matrix

Progress: [█░░░░░░░░░] 14%

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

### Pending Todos

None.

### Blockers/Concerns

None.

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 39-01 | RBAC constants | 3min | 2 | 4 |

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 39-01-PLAN.md (RBAC constants and permission matrix)
Resume: Execute next plan in phase 39 or run `/gsd:execute-phase 39`
