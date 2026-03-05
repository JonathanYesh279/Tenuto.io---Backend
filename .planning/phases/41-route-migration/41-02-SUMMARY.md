---
phase: 41-route-migration
plan: 02
subsystem: auth
tags: [rbac, requirePermission, route-migration, middleware]

requires:
  - phase: 41-01
    provides: "Core route files (student, teacher, orchestra, etc.) migrated to requirePermission"
  - phase: 40-01
    provides: "requirePermission middleware with LOCKED_DOMAINS enforcement and scope modifiers"
provides:
  - "All 15 remaining route files migrated from requireAuth to requirePermission"
  - "Zero requireAuth calls in any route file across the entire codebase"
  - "PERM-06 route migration fully complete (combined with 41-01)"
affects: [42-testing, future-rbac-customization]

tech-stack:
  added: []
  patterns:
    - "Inline requirePermission per route (no shared middleware variables)"
    - "auth.route.js chains authenticateToken + buildContext + requirePermission for routes mounted without buildContext"
    - "School-year reads use 'schedules' domain to avoid LOCKED_DOMAIN block on non-admin roles"
    - "Teacher self-view routes use non-locked domains to preserve access"
    - "Destructive admin operations use 'settings.update' (not invalid 'settings.delete')"

key-files:
  created: []
  modified:
    - api/schedule/schedule.route.js
    - api/schedule/time-block.route.js
    - api/room-schedule/room-schedule.route.js
    - api/hours-summary/hours-summary.route.js
    - api/export/export.route.js
    - api/import/import.route.js
    - api/school-year/school-year.route.js
    - api/tenant/tenant.route.js
    - api/auth/auth.route.js
    - api/admin/cleanup.route.js
    - api/admin/cascade-deletion.routes.js
    - api/admin/consistency-validation.route.js
    - api/admin/data-integrity.routes.js
    - api/admin/date-monitoring.route.js
    - api/admin/past-activities.route.js

key-decisions:
  - "School-year GET routes use 'schedules' domain (not locked 'settings') to preserve teacher/conductor access"
  - "Hours-summary teacher self-view uses 'schedules' domain (not 'reports') since teachers have no reports permission"
  - "Room-schedule uses 'settings' domain (locked) to preserve admin-only access pattern"
  - "Cascade-deletion and date-monitoring destructive operations use 'settings.update' (settings domain has no 'delete' action)"
  - "Auth admin routes chain buildContext inline since /api/auth is mounted without it in server.js"
  - "Import routes use 'settings.update' (admin data management action)"
  - "Past-activities routes use 'reports' domain (reporting function)"

patterns-established:
  - "Domain selection based on access pattern: use non-locked domains for shared-access routes, locked domains for admin-only"
  - "Inline buildContext chaining for routes on mounts that lack it in server.js"

duration: 3min
completed: 2026-03-05
---

# Phase 41 Plan 02: Route Migration (Remaining 15 Files) Summary

**15 schedule/reports/admin/settings route files migrated from requireAuth to requirePermission with domain-specific access control preserving teacher access to school years and hours while locking admin tools behind settings domain**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T08:53:51Z
- **Completed:** 2026-03-05T08:57:12Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Migrated all 15 remaining route files from requireAuth(roles[]) to requirePermission(domain, action)
- Zero requireAuth calls remain in any route file across the entire codebase (PERM-06 complete)
- Correct domain mapping prevents 403 regressions: school-year reads and teacher hours use non-locked domains
- Auth admin routes chain buildContext inline to prevent 500 PERMISSION_CONTEXT_MISSING errors
- No invalid 'settings.delete' action used anywhere (cascade-deletion and date-monitoring use 'settings.update')

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate schedule, time-block, and room-schedule routes** - `9956605` (feat)
2. **Task 2: Migrate reports, settings, auth, and admin route files** - `323502e` (feat)

## Files Created/Modified
- `api/schedule/schedule.route.js` - 8 routes: schedules domain + settings for migration routes
- `api/schedule/time-block.route.js` - 11 routes: schedules domain
- `api/room-schedule/room-schedule.route.js` - 3 routes: settings domain (admin-only)
- `api/hours-summary/hours-summary.route.js` - 4 routes: reports for admin, schedules for teacher self-view
- `api/export/export.route.js` - 3 routes: reports domain with export action
- `api/import/import.route.js` - 6 routes: settings.update (admin data management)
- `api/school-year/school-year.route.js` - 7 routes: schedules for reads, settings for writes
- `api/tenant/tenant.route.js` - 9 routes: settings domain
- `api/auth/auth.route.js` - 5 admin routes: authenticateToken + buildContext + requirePermission chain
- `api/admin/cleanup.route.js` - 7 routes: settings.view and settings.update
- `api/admin/cascade-deletion.routes.js` - 8 routes: settings.view and settings.update (no invalid delete)
- `api/admin/consistency-validation.route.js` - 6 routes: settings.view and settings.update
- `api/admin/data-integrity.routes.js` - 7 routes: settings.view and settings.update
- `api/admin/date-monitoring.route.js` - 9 routes: settings.view and settings.update
- `api/admin/past-activities.route.js` - 2 routes: reports domain

## Decisions Made
- School-year GET routes use 'schedules' domain instead of locked 'settings' to preserve teacher/conductor/ensemble-leader access
- Hours-summary teacher self-view (GET /teacher/:teacherId) uses 'schedules' domain because 'מורה' role has no 'reports' permission
- Room-schedule uses locked 'settings' domain to preserve admin-only access (matching original requireAuth(['מנהל']))
- All destructive admin operations use 'settings.update' since 'settings' domain only supports view and update actions
- Auth admin routes import and chain buildContext inline because /api/auth is mounted without it in server.js
- Import routes classified as 'settings.update' (admin data management, not 'reports')
- Past-activities classified as 'reports' domain (viewing historical data is a reporting function)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PERM-06 route migration is fully complete (41-01 + 41-02 = all route files migrated)
- Ready for Phase 42 or integration testing of the permission system
- requireAuth function still exists in auth.middleware.js (not deleted -- test files reference it)
- Super admin routes unchanged (use their own middleware)

---
*Phase: 41-route-migration*
*Completed: 2026-03-05*
