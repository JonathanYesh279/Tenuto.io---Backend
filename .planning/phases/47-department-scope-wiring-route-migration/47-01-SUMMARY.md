---
phase: 47-department-scope-wiring-route-migration
plan: 01
subsystem: api
tags: [rbac, permission-scope, buildScopedFilter, requirePermission, department-coordinator]

requires:
  - phase: 40-permission-engine-middleware
    provides: requirePermission middleware and buildScopedFilter with scope parameter
  - phase: 41-route-migration
    provides: requirePermission on core route files
provides:
  - All 6 controller/service pairs wire req.permissionScope to buildScopedFilter
  - Both attendance route files gated with requirePermission
  - PERM-06 route migration fully complete
affects: [48-remaining-gap-closure]

tech-stack:
  added: []
  patterns:
    - "Controllers pass scope: req.permissionScope in service options for list operations"
    - "Services destructure scope from options and forward as 4th arg to buildScopedFilter"

key-files:
  created: []
  modified:
    - api/student/student.controller.js
    - api/student/student.service.js
    - api/teacher/teacher.controller.js
    - api/teacher/teacher.service.js
    - api/orchestra/orchestra.controller.js
    - api/orchestra/orchestra.service.js
    - api/rehearsal/rehearsal.controller.js
    - api/rehearsal/rehearsal.service.js
    - api/theory/theory.controller.js
    - api/theory/theory.service.js
    - api/bagrut/bagrut.controller.js
    - api/bagrut/bagrut.service.js
    - api/analytics/attendance.routes.js
    - api/schedule/attendance.routes.js

key-decisions:
  - "Student-specific attendance routes use 'students' domain (consistent with student.route.js)"
  - "Analytics/aggregate routes use 'reports' domain (consistent with Phase 41 past-activities pattern)"
  - "Teacher schedule attendance uses 'schedules' domain (consistent with Phase 41 hours-summary self-view)"

patterns-established:
  - "scope passthrough: controllers always pass scope: req.permissionScope for list operations"
  - "buildScopedFilter always receives scope as 4th argument in service list functions"

duration: 2min
completed: 2026-03-06
---

# Phase 47 Plan 01: Department Scope Wiring and Route Migration Summary

**Wired req.permissionScope through all 6 controller/service pairs to buildScopedFilter and gated 10 attendance routes with requirePermission**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T06:40:37Z
- **Completed:** 2026-03-06T06:43:24Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- All 6 service list functions pass scope to buildScopedFilter as 4th argument
- All 6 controllers pass req.permissionScope in options for list operations
- canAccessStudent in student.controller.js passes scope as 3rd arg
- Both attendance route files (analytics + schedule) gated with requirePermission on every route
- No route file in the codebase uses requireAuth (PERM-06 fully complete)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire req.permissionScope through all controllers and services** - `1722be7` (feat)
2. **Task 2: Add requirePermission to analytics and schedule attendance routes** - `d462754` (feat)

## Files Created/Modified
- `api/student/student.controller.js` - Pass scope to service and canAccessStudent
- `api/student/student.service.js` - Forward scope to buildScopedFilter
- `api/teacher/teacher.controller.js` - Pass scope to service
- `api/teacher/teacher.service.js` - Forward scope to buildScopedFilter
- `api/orchestra/orchestra.controller.js` - Pass scope to service
- `api/orchestra/orchestra.service.js` - Forward scope to buildScopedFilter
- `api/rehearsal/rehearsal.controller.js` - Pass scope to service
- `api/rehearsal/rehearsal.service.js` - Forward scope to buildScopedFilter
- `api/theory/theory.controller.js` - Pass scope to service
- `api/theory/theory.service.js` - Forward scope to buildScopedFilter
- `api/bagrut/bagrut.controller.js` - Pass scope to service
- `api/bagrut/bagrut.service.js` - Forward scope to buildScopedFilter
- `api/analytics/attendance.routes.js` - Added requirePermission to 7 routes
- `api/schedule/attendance.routes.js` - Added requirePermission to 3 routes

## Decisions Made
- Student-specific attendance routes use 'students' domain (consistent with student.route.js)
- Analytics/aggregate routes use 'reports' domain (consistent with Phase 41 past-activities pattern)
- Teacher schedule attendance uses 'schedules' domain (consistent with Phase 41 hours-summary self-view)
- Export attendance report uses 'reports.export' action (consistent with export permission pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Department coordinator scope now active end-to-end for all list queries
- Ready for Phase 48 remaining gap closure work

---
*Phase: 47-department-scope-wiring-route-migration*
*Completed: 2026-03-06*
