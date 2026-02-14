---
phase: 02-service-layer-query-hardening
plan: 02
subsystem: api
tags: [multi-tenant, tenant-isolation, school-year, student, requireTenantId, buildScopedFilter]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Hardened buildScopedFilter with TENANT_GUARD, enforceTenant middleware on all routes"
provides:
  - "Fully tenant-hardened school-year service with requireTenantId on all 7 functions"
  - "Fully tenant-hardened student service with requireTenantId on all 13 functions"
  - "Backward-compatible getCurrentSchoolYear accepting both string tenantId and options object"
  - "Tenant-scoped setCurrentSchoolYear (no longer global unset)"
  - "Student _buildCriteria cleaned of tenantId handling (delegated to buildScopedFilter)"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, 02-08, bagrut-service]

# Tech tracking
tech-stack:
  added: []
  patterns: [requireTenantId-per-function, options-context-threading, backward-compat-string-or-options]

key-files:
  created: []
  modified:
    - api/school-year/school-year.service.js
    - api/school-year/school-year-controller.js
    - api/student/student.service.js
    - api/student/student.controller.js

key-decisions:
  - "Backward compat for getCurrentSchoolYear/getSchoolYears/getSchoolYearById: accept string tenantId (legacy) or options object (new pattern)"
  - "tenantId removed from student _buildCriteria -- now exclusively handled by buildScopedFilter at call site"
  - "getStudents context is now mandatory (no more optional conditional scoping)"
  - "Fixed pre-existing bug: teacherRelationshipSyncRequired replaced with teacherAssignmentsSyncRequired in updateStudent"
  - "All write operations derive tenantId from context (server-side, never from client request body)"

patterns-established:
  - "Service function pattern: options = {} with requireTenantId(options.context?.tenantId) at top of every function"
  - "Controller pattern: pass { context: req.context } as last parameter to every service call"
  - "Backward compat pattern: typeof check for string vs object first argument on functions called by legacy services"
  - "Internal call threading: all internal getStudentById calls pass options through for tenant scoping"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 02 Plan 02: School-Year and Student Service Hardening Summary

**requireTenantId on all 20 service functions across school-year (7) and student (13), with backward-compat string-tenantId callers and tenant-scoped setCurrentSchoolYear**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T23:32:28Z
- **Completed:** 2026-02-14T23:37:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 7 school-year service functions guarded by requireTenantId with tenantId in every query filter
- setCurrentSchoolYear now scopes the updateMany (unset isCurrent) by tenantId -- previously unset ALL school years globally across tenants
- All 13 student service functions guarded by requireTenantId with tenantId in every query filter
- Student _buildCriteria no longer handles tenantId (removed from filterBy) -- delegated to buildScopedFilter at call site for consistency
- Fixed pre-existing bug: undefined `teacherRelationshipSyncRequired` variable replaced with correct `teacherAssignmentsSyncRequired`

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden school-year.service.js and school-year-controller.js** - `156aad1` (feat)
2. **Task 2: Harden student.service.js and student.controller.js** - `26bb904` (feat)

## Files Created/Modified
- `api/school-year/school-year.service.js` - All 7 functions (getSchoolYears, getSchoolYearById, getCurrentSchoolYear, createSchoolYear, updateSchoolYear, setCurrentSchoolYear, rolloverToNewYear) now require tenantId via requireTenantId, with backward-compat string-or-options pattern on 3 functions
- `api/school-year/school-year-controller.js` - All 7 controller handlers pass { context: req.context } to service calls
- `api/student/student.service.js` - All 13 functions require tenantId, _buildCriteria cleaned of tenantId, getStudents context mandatory, all internal getStudentById calls thread options
- `api/student/student.controller.js` - All 7 controller handlers pass { context: req.context } to service calls

## Decisions Made
- **Backward compat for school-year functions:** getCurrentSchoolYear, getSchoolYears, and getSchoolYearById accept either a string (legacy tenantId from other services like orchestra.service.js, theory.service.js) or an options object (new canonical pattern). This prevents breaking callers until they are hardened in plans 03-05.
- **tenantId removed from student _buildCriteria:** The old pattern of injecting tenantId via filterBy was inconsistent with buildScopedFilter. Since buildScopedFilter already adds tenantId at the call site, _buildCriteria no longer needs to handle it.
- **getStudents context is now mandatory:** Removed the conditional `if (context)` -- context is always required. The legacy `teacherId/isAdmin` fallback path was removed since all controllers now pass context.
- **Server-derived tenantId for writes:** addStudent sets `value.tenantId = tenantId` from context (not from the client-supplied request body), preventing tenant spoofing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed undefined teacherRelationshipSyncRequired variable**
- **Found during:** Task 2 (student.service.js hardening)
- **Issue:** Line 409 of original file referenced `teacherRelationshipSyncRequired` which was never defined -- a pre-existing bug that would cause a ReferenceError at runtime
- **Fix:** Changed to `teacherAssignmentsSyncRequired` which is the correct variable defined earlier in the function
- **Files modified:** api/student/student.service.js
- **Verification:** Syntax check passes, variable is properly defined in scope
- **Committed in:** 26bb904 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- School-year and student services are fully hardened -- these are upstream dependencies for most other services
- Callers of getCurrentSchoolYear from other services (orchestra.service.js, theory.service.js) will continue to work via backward-compat string pattern until they are hardened in plans 03-05
- Callers of student setBagrutId/removeBagrutId from bagrut.service.js will need context threading when bagrut service is hardened
- The pattern is now well-established: `requireTenantId(options.context?.tenantId)` at top of every function, `{ context: req.context }` from controllers

## Self-Check: PASSED

- All 4 modified files exist on disk
- All 2 task commits verified in git log (156aad1, 26bb904)
- SUMMARY.md created successfully

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-14*
