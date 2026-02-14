---
phase: 02-service-layer-query-hardening
plan: 04
subsystem: api
tags: [multi-tenant, tenant-isolation, orchestra, rehearsal, requireTenantId, buildScopedFilter, aggregation, lookup]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Hardened buildScopedFilter with TENANT_GUARD, enforceTenant middleware"
  - phase: 02-02
    provides: "Hardened school-year service with backward-compat getCurrentSchoolYear"
provides:
  - "Fully tenant-hardened orchestra service with scoped $lookup aggregation pipelines"
  - "Fully tenant-hardened rehearsal service with tenant-scoped bulk operations"
  - "Tenant-scoped activity_attendance writes in both orchestra and rehearsal attendance flows"
  - "Orchestra addOrchestra uses dynamic import() for getCurrentSchoolYear with context"
affects: [02-05, 02-06, 02-07, 02-08, past-activities-service]

# Tech tracking
tech-stack:
  added: []
  patterns: [tenant-scoped-lookup-pipeline, tenant-scoped-bulk-operations, tenant-scoped-attendance-records]

key-files:
  created: []
  modified:
    - api/orchestra/orchestra.service.js
    - api/orchestra/orchestra.controller.js
    - api/rehearsal/rehearsal.service.js
    - api/rehearsal/rehearsal.controller.js

key-decisions:
  - "All 4 orchestra $lookup pipelines use let tid: '$tenantId' with $eq filter (prevents cross-tenant joins)"
  - "Orchestra addOrchestra uses dynamic import() instead of require() for ESM compat with school-year service"
  - "Rehearsal addRehearsal and bulkCreateRehearsals set tenantId from context on document (server-derived)"
  - "All activity_attendance upserts/inserts include tenantId in both filter and $set (prevents cross-tenant attendance)"
  - "Bulk delete/update operations include tenantId in all queries including transaction branches"
  - "getOrchestraRehearsals delegates to getRehearsals (context flows through naturally)"

patterns-established:
  - "Tenant-scoped $lookup: Use let { tid: '$tenantId' } + $eq: ['$tenantId', '$$tid'] in every pipeline $lookup"
  - "Tenant-scoped bulk operations: tenantId in find, deleteMany, updateMany, and orchestra cross-collection updates"
  - "Attendance records: tenantId in both query filter and $set for upsert operations"

# Metrics
duration: 6min
completed: 2026-02-15
---

# Phase 02 Plan 04: Orchestra and Rehearsal Service Hardening Summary

**requireTenantId on all 21 service functions, 4 $lookup pipelines converted to tenant-scoped form, bulk operations tenant-isolated, activity_attendance writes scoped**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-14T23:50:55Z
- **Completed:** 2026-02-14T23:56:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 10 orchestra service functions guarded by requireTenantId with tenantId in every query filter
- All 4 $lookup aggregation pipelines (2 in getOrchestras, 2 in getOrchestraById) converted to tenant-scoped form using `let { tid: '$tenantId' }` with `$eq: ['$tenantId', '$$tid']` -- prevents cross-tenant student/teacher joins
- All 11 rehearsal service functions guarded by requireTenantId with tenantId in every query filter
- Bulk operations (bulkCreate, bulkDeleteByOrchestra, bulkDeleteByDateRange, bulkUpdate) all include tenantId in queries and cross-collection updates
- Activity attendance records now include tenantId in both read and write operations across both orchestra and rehearsal services

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden orchestra.service.js and orchestra.controller.js** - `7dd17f8` (feat)
2. **Task 2: Harden rehearsal.service.js and rehearsal.controller.js** - `0e2bb6b` (feat)

## Files Created/Modified
- `api/orchestra/orchestra.service.js` - All 10 functions guarded by requireTenantId, 4 $lookup pipelines scoped by tenantId, _buildCriteria cleaned, all 8 internal getOrchestraById calls threaded with options, addOrchestra uses dynamic import() for getCurrentSchoolYear with context
- `api/orchestra/orchestra.controller.js` - All 10 controller handlers pass { context: req.context }, tenantId removed from filterBy
- `api/rehearsal/rehearsal.service.js` - All 11 functions guarded by requireTenantId, _buildCriteria cleaned, all internal getRehearsalById calls threaded with options, bulk operations tenant-scoped, attendance records include tenantId
- `api/rehearsal/rehearsal.controller.js` - All 11 controller handlers pass { context: req.context }, tenantId removed from filterBy

## Decisions Made
- **All $lookup pipelines use `let { tid: '$tenantId' }` pattern:** The $lookup stages already used pipeline form (not simple form), so the fix was to add `tid: '$tenantId'` to the `let` clause and `$eq: ['$tenantId', '$$tid']` to the `$match.$expr.$and`. This ensures student and teacher lookups never cross tenant boundaries.
- **Dynamic import() for school-year service:** The orchestra service used `require()` for school-year service (lazy loading). Since the project uses ESM (`"type": "module"`), this was converted to `await import()` for compatibility while preserving the lazy-load behavior.
- **Attendance tenantId in both filter and $set:** For upsert operations on activity_attendance, tenantId is included in both the query filter (for matching) and the $set (for creation). This ensures newly created attendance records always have tenantId.
- **Bulk operations fully scoped:** All bulk operations (create, delete, update) include tenantId in every query across both transactional and fallback code paths, including cross-collection orchestra updates within the same transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced require() with dynamic import() for ESM compatibility**
- **Found during:** Task 1 (orchestra.service.js hardening)
- **Issue:** `addOrchestra` used `require('../school-year/school-year.service.js')` which fails in ESM modules (`"type": "module"`)
- **Fix:** Converted to `const { schoolYearService } = await import('../school-year/school-year.service.js')`
- **Files modified:** api/orchestra/orchestra.service.js
- **Verification:** Syntax check passes
- **Committed in:** 7dd17f8 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added tenantId to activity_attendance operations**
- **Found during:** Task 1 (orchestra.service.js) and Task 2 (rehearsal.service.js)
- **Issue:** activity_attendance upserts/inserts/deletes had no tenantId filter -- would match/create cross-tenant attendance records
- **Fix:** Added tenantId to all activity_attendance query filters and $set clauses in both updateRehearsalAttendance (orchestra), removeRehearsal, and updateAttendance (rehearsal)
- **Files modified:** api/orchestra/orchestra.service.js, api/rehearsal/rehearsal.service.js
- **Verification:** All activity_attendance operations now include tenantId
- **Committed in:** 7dd17f8 and 0e2bb6b

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. The require() fix prevents runtime errors. The activity_attendance tenantId fix prevents cross-tenant data leakage in attendance records. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Orchestra and rehearsal services are fully hardened -- these were the highest-risk services due to $lookup aggregation pipelines
- Cross-service callers of rehearsalService.getRehearsals (past-activities.service.js) will need context threading when admin services are hardened (later plans)
- The $lookup tenantId scoping pattern (`let { tid: '$tenantId' }`) is now established for any future aggregation pipelines
- Remaining services to harden: theory, analytics, schedule, bagrut, shared services (plans 05-08)

## Self-Check: PASSED

- All 4 modified files exist on disk
- All 2 task commits verified in git log (7dd17f8, 0e2bb6b)
- SUMMARY.md created successfully

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-15*
