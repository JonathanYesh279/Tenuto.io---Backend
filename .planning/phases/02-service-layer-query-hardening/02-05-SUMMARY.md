---
phase: 02-service-layer-query-hardening
plan: 05
subsystem: api
tags: [multi-tenant, tenant-isolation, theory, bagrut, requireTenantId, buildScopedFilter, cross-service]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Hardened buildScopedFilter with TENANT_GUARD, enforceTenant middleware"
  - phase: 02-02
    provides: "Hardened school-year and student services (getCurrentSchoolYear, setBagrutId, removeBagrutId accept options)"
provides:
  - "Fully tenant-hardened theory service with requireTenantId on all 16 functions"
  - "Fully tenant-hardened bagrut service with requireTenantId on all 20 functions"
  - "Tenant-scoped bulk create/delete operations for theory lessons"
  - "Tenant-scoped cross-service calls from bagrut to studentService"
  - "Tenant-scoped activity_attendance writes and deletes in theory service"
affects: [02-06, 02-07, 02-08, shared-services, past-activities]

# Tech tracking
tech-stack:
  added: []
  patterns: [requireTenantId-per-function, options-context-threading, cross-service-context-passing, buildScopedFilter-wrapping-createLessonFilterQuery]

key-files:
  created: []
  modified:
    - api/theory/theory.service.js
    - api/theory/theory.controller.js
    - api/bagrut/bagrut.service.js
    - api/bagrut/bagrut.controller.js

key-decisions:
  - "Theory getTheoryLessons wraps createLessonFilterQuery with buildScopedFilter (two-layer filter composition)"
  - "Theory bulk operations set tenantId on each document and include tenantId in all delete criteria"
  - "Theory activity_attendance records include tenantId on inserts and deletes"
  - "Bagrut cross-service calls pass { context: options.context } to student setBagrutId/removeBagrutId"
  - "Both _buildCriteria functions cleaned of tenantId handling (delegated to buildScopedFilter)"
  - "Theory getCurrentSchoolYear call now passes { context: options.context } for tenant scoping"

patterns-established:
  - "Two-layer filter composition: buildScopedFilter('collection', createLessonFilterQuery(filterBy), context) for services using shared filter utilities"
  - "Cross-service context threading: pass { context: options.context } when calling hardened services from other services"
  - "Bulk operation tenant scoping: set tenantId on each document in bulk inserts, include tenantId in all bulk delete criteria"
  - "Transaction + fallback tenant scoping: both transaction and fallback paths include tenantId in all queries"

# Metrics
duration: 12min
completed: 2026-02-15
---

# Phase 02 Plan 05: Theory and Bagrut Service Hardening Summary

**requireTenantId on all 36 functions across theory (16) and bagrut (20), with bulk operation tenant scoping, cross-service context threading to studentService, and tenant-scoped activity_attendance writes**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-15T00:00:05Z
- **Completed:** 2026-02-15T00:12:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 16 theory service functions guarded by requireTenantId with tenantId in every query filter
- All 20 bagrut service functions guarded by requireTenantId with tenantId in every query filter
- Theory bulk create sets tenantId on each document; all 3 bulk delete operations include tenantId in criteria
- Bagrut cross-service calls to studentService.setBagrutId and removeBagrutId now pass context
- Theory activity_attendance inserts include tenantId; deletes scope by tenantId
- Both _buildCriteria functions cleaned of tenantId (delegated to buildScopedFilter)
- Theory getCurrentSchoolYear call passes context for tenant-scoped school year lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden theory.service.js and theory.controller.js** - `3b9e787` (feat)
2. **Task 2: Harden bagrut.service.js and bagrut.controller.js** - `b7c5769` (feat)

## Files Created/Modified
- `api/theory/theory.service.js` - All 16 functions require tenantId, buildScopedFilter wraps createLessonFilterQuery, bulk operations scope by tenantId, activity_attendance records include tenantId, _buildCriteria cleaned
- `api/theory/theory.controller.js` - All 17 service calls pass { context: req.context }, tenantId removed from filterBy
- `api/bagrut/bagrut.service.js` - All 20 functions require tenantId, buildScopedFilter wraps _buildCriteria in getBagruts, all findOne/findOneAndUpdate/deleteOne include tenantId, cross-service calls pass context, _buildCriteria cleaned
- `api/bagrut/bagrut.controller.js` - All 19 service calls pass { context: req.context }, tenantId removed from filterBy

## Decisions Made
- **Two-layer filter composition in theory:** getTheoryLessons uses `buildScopedFilter('theory_lesson', createLessonFilterQuery(filterBy), context)` -- the shared `createLessonFilterQuery` utility from queryOptimization.js still exists but tenantId is no longer passed via filterBy. buildScopedFilter adds tenantId from context as the authoritative source.
- **Bulk operation scoping:** All 3 bulk delete operations (by date, category, teacher) include tenantId in both the main criteria and the attendance cleanup criteria, in both transaction and fallback code paths.
- **Cross-service context threading:** Bagrut's addBagrut and removeBagrut pass `{ context: options.context }` to studentService.setBagrutId/removeBagrutId, which were already hardened in plan 02-02.
- **Theory getCurrentSchoolYear call:** Updated from no-arg call to `getCurrentSchoolYear({ context: options.context })`, using the backward-compat options pattern established in 02-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theory and bagrut services are fully hardened -- two of the largest services in the codebase
- Services hardened so far: school-year (7), student (13), teacher (12+), orchestra (14+), rehearsal (9+), theory (16), bagrut (20)
- Remaining services for Phase 2: analytics, schedule-attendance, hours-summary, import/export, shared services (conflictDetection, duplicateDetection, permission)
- The `authorizeBagrutAccess` middleware does its own bagrut lookup without tenantId -- this should be addressed when shared middleware is hardened

## Self-Check: PASSED

- All 4 modified files exist on disk
- All 2 task commits verified in git log (3b9e787, b7c5769)
- SUMMARY.md created successfully

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-15*
