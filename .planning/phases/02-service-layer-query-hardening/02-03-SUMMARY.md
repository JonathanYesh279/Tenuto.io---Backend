---
phase: 02-service-layer-query-hardening
plan: 03
subsystem: api
tags: [multi-tenant, tenant-isolation, teacher, requireTenantId, buildScopedFilter, aggregation-pipeline]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Hardened buildScopedFilter with TENANT_GUARD, enforceTenant middleware, requireTenantId utility"
  - phase: 02-02
    provides: "Established patterns: requireTenantId-per-function, options-context-threading"
provides:
  - "Fully tenant-hardened teacher service with requireTenantId on all 15 functions"
  - "Fully tenant-hardened teacher-lessons aggregation service with requireTenantId on all 6 functions"
  - "Tenant-scoped aggregation pipeline ($match with tenantId as first filter)"
  - "Teacher controller passing { context: req.context } to all 22 service calls"
affects: [02-04, 02-05, 02-06, 02-07, 02-08, cascade-deletion, time-block-service]

# Tech tracking
tech-stack:
  added: []
  patterns: [requireTenantId-per-function, options-context-threading, aggregation-tenantId-in-first-match]

key-files:
  created: []
  modified:
    - api/teacher/teacher.service.js
    - api/teacher/teacher.controller.js
    - api/teacher/teacher-lessons.service.js

key-decisions:
  - "getTeacherByRole backward-compat: accepts string tenantId (legacy callers) or options object (canonical pattern)"
  - "tenantId removed from teacher _buildCriteria -- exclusively handled by buildScopedFilter at call site"
  - "addTeacher sets tenantId from context (server-derived), not from client request body"
  - "checkStudentScheduleConflict internal helper receives tenantId as parameter for tenant-scoped teacher query"
  - "No $lookup stages in teacher-lessons (aggregation on student collection) -- tenantId added to first $match"

patterns-established:
  - "Transaction tenant scoping: all withTransaction operations include tenantId in every findOne/updateOne filter"
  - "Internal helper tenant threading: non-exported helpers accept tenantId as explicit parameter"
  - "Aggregation pipeline scoping: tenantId in first $match stage prevents cross-tenant data leakage"

# Metrics
duration: 7min
completed: 2026-02-15
---

# Phase 02 Plan 03: Teacher Service and Teacher-Lessons Hardening Summary

**requireTenantId on all 21 functions across teacher service (15) and teacher-lessons service (6), with tenant-scoped aggregation pipeline, transaction operations, and sub-document mutations**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T23:40:55Z
- **Completed:** 2026-02-14T23:48:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- All 15 teacher service functions guarded by requireTenantId with tenantId in every MongoDB query filter
- Teacher _buildCriteria cleaned of tenantId handling (delegated to buildScopedFilter at call site)
- All 6 teacher-lessons aggregation functions guarded by requireTenantId with tenantId in $match stages
- getTeacherIds now tenant-scoped (previously returned ALL teacher IDs across all tenants -- CRITICAL vulnerability fixed)
- Transaction-based removeStudentFromTeacher includes tenantId in all 5 atomic operations (teacher findOne, student findOne, teacher updateOne, student updateOne x2, student findOne for return)
- addTeacher now sets tenantId from server-derived context (not client request body)

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden teacher.service.js and teacher.controller.js** - `ebb1c26` (feat)
2. **Task 2: Harden teacher-lessons.service.js aggregation pipeline** - `a9d3ccd` (feat)

## Files Created/Modified
- `api/teacher/teacher.service.js` - All 15 functions (14 exported + checkStudentScheduleConflict) require tenantId via requireTenantId, _buildCriteria cleaned, all query filters include tenantId, transaction operations scoped
- `api/teacher/teacher.controller.js` - All 22 service calls pass { context: req.context }, removed manual tenantId injection from addTeacher, removed tenantId from filterBy
- `api/teacher/teacher-lessons.service.js` - All 6 exported functions require tenantId, aggregation $match includes tenantId, teacher/student findOne checks include tenantId, internal calls thread context

## Decisions Made
- **getTeacherByRole backward compat:** Added typeof check for string vs object -- legacy callers may pass tenantId as second string argument (like the old `getTeacherByRole(role, tenantId)` pattern). New canonical pattern is `getTeacherByRole(role, { context: req.context })`.
- **tenantId removed from _buildCriteria:** Consistent with student service pattern from 02-02. buildScopedFilter at call site is the canonical place for tenantId injection.
- **Server-derived tenantId for addTeacher:** Controller no longer injects tenantId from context into request body. Service sets `value.tenantId = tenantId` from context, preventing tenant spoofing via request body.
- **Internal helper tenantId threading:** checkStudentScheduleConflict is not exported, so it receives tenantId as an explicit parameter rather than options object.
- **No $lookup conversion needed:** teacher-lessons.service.js has no $lookup stages -- it runs aggregation on the student collection with $match, $addFields, $unwind, $project. tenantId in the first $match is sufficient for tenant isolation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Teacher service and teacher-lessons service are fully hardened
- All callers of getTeacherByRole from other services will continue working via backward-compat string pattern until they are hardened
- The transaction pattern in removeStudentFromTeacher is now a template for other transaction-based operations that need tenant scoping
- Remaining services to harden: orchestra, schedule-attendance, time-block, analytics, hours-summary, shared services (plans 04-08)

## Self-Check: PASSED

- All 3 modified files exist on disk
- All 2 task commits verified in git log (ebb1c26, a9d3ccd)
- SUMMARY.md created successfully

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-15*
