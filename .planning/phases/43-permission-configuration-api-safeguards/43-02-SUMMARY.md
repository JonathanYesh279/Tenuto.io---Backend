---
phase: 43-permission-configuration-api-safeguards
plan: 02
subsystem: api
tags: [rbac, roles, admin-safeguard, teacher, multi-tenant]

requires:
  - phase: 43-01
    provides: permission configuration API with SAFE-02 lockout prevention
  - phase: 39-01
    provides: TEACHER_ROLES, ADMIN_TIER_ROLES, INSTRUMENT_DEPARTMENTS constants
  - phase: 40-01
    provides: requirePermission middleware with LOCKED_DOMAINS enforcement
provides:
  - PUT /api/teacher/:id/roles endpoint for admin role assignment
  - SAFE-01 last-admin prevention safeguard in teacher service
  - coordinatorDepartments validation tied to department coordinator role
affects: [frontend-role-management, permission-ui, admin-dashboard]

tech-stack:
  added: []
  patterns: [service-layer-safeguard, custom-error-codes, locked-domain-gating]

key-files:
  created: []
  modified:
    - api/teacher/teacher.service.js
    - api/teacher/teacher.controller.js
    - api/teacher/teacher.route.js

key-decisions:
  - "SAFE-01 uses countDocuments with ADMIN_TIER_ROLES $in query for last-admin check"
  - "coordinatorDepartments forced to [] when department coordinator role not in roles array"
  - "Custom error codes (LAST_ADMIN, INVALID_ROLES, INVALID_DEPARTMENTS) for structured client handling"

patterns-established:
  - "Role assignment endpoint pattern: service validates + safeguards, controller returns structured errors"

duration: 3min
completed: 2026-03-05
---

# Phase 43 Plan 02: Role Assignment Endpoint Summary

**PUT /api/teacher/:id/roles with SAFE-01 last-admin prevention and coordinator department validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T09:31:06Z
- **Completed:** 2026-03-05T09:33:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Role assignment endpoint with multi-role support and TEACHER_ROLES validation
- SAFE-01 last-admin safeguard prevents removing the only admin-tier role holder from a tenant
- coordinatorDepartments accepted only with department coordinator role, validated against INSTRUMENT_DEPARTMENTS
- Endpoint locked to admin-only via requirePermission('roles', 'assign') on locked domain

## Task Commits

Each task was committed atomically:

1. **Task 1: Add updateTeacherRoles to teacher service** - `52cbfbb` (feat)
2. **Task 2: Add roles route and controller handler** - `047f63c` (feat)

## Files Created/Modified
- `api/teacher/teacher.service.js` - Added updateTeacherRoles with role/department validation and SAFE-01
- `api/teacher/teacher.controller.js` - Added updateTeacherRoles handler with structured error responses
- `api/teacher/teacher.route.js` - Added PUT /:id/roles route gated by requirePermission('roles', 'assign')

## Decisions Made
- SAFE-01 uses countDocuments with ADMIN_TIER_ROLES $in query for last-admin check (efficient single query)
- coordinatorDepartments forced to [] when department coordinator role not in roles array (auto-cleanup)
- Custom error codes (LAST_ADMIN, INVALID_ROLES, INVALID_DEPARTMENTS) for structured client-side error handling
- Route placed before PUT /:id to ensure Express matches the more specific path first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role assignment endpoint complete, ready for frontend integration
- SAFE-01 and SAFE-02 safeguards both operational
- Phase 43 complete (both plans delivered)

---
*Phase: 43-permission-configuration-api-safeguards*
*Completed: 2026-03-05*
