---
phase: 49-report-infrastructure
plan: 02
subsystem: api
tags: [reports, orchestrator, routes, controller, pagination, sorting, scoping]

requires:
  - 49-01
provides:
  - Report orchestrator with param validation, scope building, generator execution, output validation
  - GET /api/reports/registry endpoint for role-filtered report catalog
  - GET /api/reports/:reportId endpoint for full report generation pipeline
  - Server-driven pagination (page, limit, totalCount, totalPages)
  - In-memory sorting with Hebrew locale support
affects: [50-teacher-reports, 51-student-reports, 52-institutional-reports, 53-department-reports]

tech-stack:
  added: []
  patterns: ["Orchestrator pattern: validate -> scope -> generate -> validate output -> sort -> paginate -> shape", "Error codes: REPORT_NOT_FOUND/ACCESS_DENIED/INVALID_PARAMS/GENERATOR_ERROR/INVALID_GENERATOR_OUTPUT"]

key-files:
  created:
    - api/reports/report.orchestrator.js
    - api/reports/report.controller.js
    - api/reports/report.route.js
  modified:
    - server.js

key-decisions:
  - "Report-specific params validated against generator.params declarations with type coercion and allowed-values check"
  - "Sorting applied in-memory after generator returns, before pagination slice"
  - "School year defaults to context.schoolYearId from addSchoolYearToRequest middleware"
  - "Report routes mounted with full middleware chain including enforceTenant and addSchoolYearToRequest"

patterns-established:
  - "Orchestrator pipeline: resolve generator -> role check -> parse shared params -> validate report params -> build scope -> call generator -> validate output -> sort -> paginate -> shape response"
  - "Error shape: { message, code, status, errors? } with HTTP status codes"
  - "Controller error handling: orchestrator errors return status + code + errors array"

duration: 1min
completed: 2026-03-06
---

# Phase 49 Plan 02: Report Orchestrator, Routes, and Permissions Summary

**Full report API pipeline with orchestrator, controller, routes, pagination, sorting, and server.js mount**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T21:39:27Z
- **Completed:** 2026-03-06T21:41:01Z
- **Tasks:** 2
- **Files created:** 3 (+ 1 modified)

## Accomplishments
- Orchestrator validates shared params (page/limit/sortBy/sortOrder/schoolYearId/comparisonYearId/department) with defaults and bounds
- Report-specific param validation against generator.params with type coercion and allowed-values enforcement
- Locale-aware sorting (Hebrew) for string columns, numeric for number/percentage/currency types
- In-memory pagination after sorting with totalCount/totalPages metadata
- Controller delegates to orchestrator, returns shaped response or typed error
- Routes gated by requirePermission('reports', 'view') for RBAC enforcement
- Server.js mounts /api/reports with full middleware chain and loads generators on startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Orchestrator with param validation, pagination, sorting, and year-over-year** - `caf258c` (feat)
2. **Task 2: Controller, routes, server.js mount, and registry initialization** - `6d390a7` (feat)

## Files Created/Modified
- `api/reports/report.orchestrator.js` - Central orchestration: param validation, scope building, generator execution, sorting, pagination, response shaping
- `api/reports/report.controller.js` - Route handlers delegating to orchestrator with error handling
- `api/reports/report.route.js` - GET /registry and GET /:reportId with requirePermission
- `server.js` - Import report routes + loadGenerators, mount /api/reports with full middleware chain, call loadGenerators() on startup

## Decisions Made
- Report-specific params validated against generator.params declarations with type coercion (number, boolean, string)
- Sorting applied in-memory after generator returns full dataset, before pagination slice
- School year defaults to context.schoolYearId (populated by addSchoolYearToRequest middleware)
- loadGenerators() called during server startup after MongoDB init, before app.listen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete report infrastructure ready for generator implementation phases (50-53)
- All 7 foundation files in place: contract, scope, registry, stub generator, orchestrator, controller, routes
- Any new generator dropped into api/reports/generators/ is auto-discovered and accessible via the API

---
*Phase: 49-report-infrastructure*
*Completed: 2026-03-06*
