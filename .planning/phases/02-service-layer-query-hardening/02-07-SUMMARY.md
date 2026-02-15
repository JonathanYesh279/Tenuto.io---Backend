---
phase: 02-service-layer-query-hardening
plan: 07
subsystem: api
tags: [multi-tenant, requireTenantId, hours-summary, import, export, ministry-report, cross-collection]

# Dependency graph
requires:
  - phase: 02-02
    provides: "Hardened student service with buildScopedFilter + context"
  - phase: 02-03
    provides: "Hardened teacher service with requireTenantId + context"
  - phase: 02-04
    provides: "Hardened orchestra/rehearsal services with tenant-scoped $lookups"
  - phase: 02-05
    provides: "Hardened theory/bagrut services with requireTenantId"
provides:
  - "Tenant-hardened hours-summary calculation service (cross-collection: teacher, student, orchestra, theory)"
  - "Tenant-hardened import service (matching + writes scoped by tenantId)"
  - "Tenant-hardened export service (ministry report generation scoped by tenantId)"
  - "Tenant-hardened ministry-mappers data loader (6-collection query scoping)"
affects: [02-08, shared-services]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-service options threading: options passed through to dependent service calls"
    - "Internal helper tenantId threading: executeTeacherImport/executeStudentImport receive tenantId as parameter"
    - "Data loader guard: requireTenantId at top of loadExportData before any queries"

key-files:
  created: []
  modified:
    - "api/hours-summary/hours-summary.service.js"
    - "api/hours-summary/hours-summary.controller.js"
    - "api/import/import.service.js"
    - "api/import/import.controller.js"
    - "api/export/export.service.js"
    - "api/export/export.controller.js"
    - "api/export/ministry-mappers.js"

key-decisions:
  - "Hours-summary signature changed: tenantId moved from positional param to options.context (breaking change from old API)"
  - "Export service signature reordered: generateFullReport(schoolYearId, userId, options) instead of (tenantId, schoolYearId, userId)"
  - "Ministry-mappers loadExportData now validates tenantId with requireTenantId (was conditional spreading)"
  - "Import executeTeacherImport/executeStudentImport receive tenantId as explicit param from parent (not via options -- internal functions)"

patterns-established:
  - "Cross-service context threading: when service A calls service B, pass options through unchanged"
  - "Data loader hardening: validate tenantId before ANY collection queries in multi-collection loaders"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 2 Plan 7: Cross-Cutting Services Hardening Summary

**Hours-summary, import, and export services hardened with requireTenantId across 15+ cross-collection queries spanning teacher, student, orchestra, theory, rehearsal, and hours_summary collections**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T00:25:43Z
- **Completed:** 2026-02-15T00:30:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Hours-summary service: all 4 functions (calculateTeacherHours, calculateAllTeacherHours, getHoursSummary, getHoursSummaryByTeacher) now require tenantId via options.context, with cross-collection queries scoped across teacher, student, orchestra, and theory_lesson collections
- Import service: all 3 exported functions hardened, matching queries scoped by tenantId, import log writes include tenantId, execute updates include tenantId in filter
- Export service: all 3 exported functions hardened, ministry report snapshot writes include mandatory tenantId, hours recalculation call passes context through
- Ministry-mappers loadExportData: all 6 collection queries use direct tenantId filter (removed conditional spreading pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden hours-summary service and controller** - `fc3efc0` (feat)
2. **Task 2: Harden import/export services and controllers** - `95b1570` (feat)

## Files Created/Modified
- `api/hours-summary/hours-summary.service.js` - All 4 functions use requireTenantId + options pattern, cross-collection queries scoped
- `api/hours-summary/hours-summary.controller.js` - Passes { context: req.context } to all 4 service calls
- `api/import/import.service.js` - 3 exported functions hardened, matching + write queries tenant-scoped
- `api/import/import.controller.js` - Passes { context: req.context } to all 3 service calls
- `api/export/export.service.js` - 3 exported functions hardened, snapshot writes include mandatory tenantId
- `api/export/export.controller.js` - Passes { context: req.context } to all 3 service calls
- `api/export/ministry-mappers.js` - loadExportData validates tenantId, all 6 collection queries use direct tenantId

## Decisions Made
- Hours-summary function signatures changed from positional `tenantId` to `options = {}` with `options.context.tenantId` -- consistent with canonical pattern established in 02-02 through 02-06
- Export service function signatures reordered to move tenantId out of positional params: `generateFullReport(schoolYearId, userId, options)` instead of `(tenantId, schoolYearId, userId)`
- Ministry-mappers `loadExportData` keeps tenantId as positional param (called from export.service.js which has already validated it) but adds requireTenantId guard for defense-in-depth
- Internal import helpers (executeTeacherImport, executeStudentImport) receive tenantId as explicit param rather than options -- they are private functions called only from executeImport which has already validated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Hardened ministry-mappers.js loadExportData**
- **Found during:** Task 2 (Export service hardening)
- **Issue:** Plan mentioned checking if ministry-mappers.js makes DB queries but did not explicitly task hardening it. loadExportData queries 6 collections with conditional `tenantId ? { tenantId } : {}` spreading -- same vulnerability pattern
- **Fix:** Added requireTenantId import and guard, replaced all conditional tenant spreading with direct tenantId filter
- **Files modified:** api/export/ministry-mappers.js
- **Verification:** node --check passes, requireTenantId count is 2 (import + call)
- **Committed in:** 95b1570 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- loadExportData is the primary data loader for all export operations and was using the same vulnerable conditional pattern.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All P2 (cross-cutting) services are now hardened
- Remaining: 02-08 (shared services: duplicateDetection, conflictDetection, permission) to complete Phase 2
- past-activities.service.js call to rehearsalService.getRehearsals still needs context (tracked in STATE.md blockers)

## Self-Check: PASSED

All 8 files verified present. Both task commits (fc3efc0, 95b1570) verified in git log.

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-15*
