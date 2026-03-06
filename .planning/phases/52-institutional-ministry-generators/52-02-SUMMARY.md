---
phase: 52-institutional-ministry-generators
plan: 02
subsystem: api
tags: [reports, generators, ministry, data-quality, institutional]

requires:
  - phase: 49-report-engine-core
    provides: generator plugin convention, loadGenerators, scope builder
  - phase: 52-01
    provides: institutional generator pattern (year-over-year)
provides:
  - INST-02 Ministry Readiness Audit generator
  - INST-03 Data Quality Report generator
affects: [53-registration-wiring, report-engine]

tech-stack:
  added: []
  patterns:
    - "Delegating to exportService for ministry completion/validation data"
    - "Anomaly detection across student/teacher/orchestra collections"

key-files:
  created:
    - api/reports/generators/ministry-readiness-audit.generator.js
    - api/reports/generators/data-quality.generator.js
  modified: []

key-decisions:
  - "Ministry audit delegates to exportService rather than reimplementing completion logic"
  - "Data quality generator queries collections directly for anomaly detection"
  - "Empty orchestras category also flags missing conductors"

patterns-established:
  - "Cross-service delegation: generators can import and call other services (exportService) for complex data"
  - "Multi-category anomaly reports: single generator with param-based filtering across anomaly types"

duration: 3min
completed: 2026-03-07
---

# Phase 52 Plan 02: Ministry Readiness Audit & Data Quality Generators Summary

**Ministry readiness audit delegating to exportService for completion/validation, plus data quality anomaly detector for 4 categories with severity levels**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T22:38:30Z
- **Completed:** 2026-03-06T22:41:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Ministry Readiness Audit generator (INST-02) surfaces missing fields and cross-validation issues from exportService
- Data Quality generator (INST-03) detects unassigned students, idle teachers, incomplete records, and empty orchestras
- Both generators follow the established plugin convention with institutional category

## Task Commits

Each task was committed atomically:

1. **Task 1: Ministry Readiness Audit generator (INST-02)** - `262e0ce` (feat)
2. **Task 2: Data Quality Report generator (INST-03)** - `7df4479` (feat)

## Files Created/Modified
- `api/reports/generators/ministry-readiness-audit.generator.js` - INST-02: delegates to exportService.getCompletionStatus and crossValidate, maps results to rows with Hebrew labels
- `api/reports/generators/data-quality.generator.js` - INST-03: queries student/teacher/orchestra collections to find anomalies across 4 categories

## Decisions Made
- Ministry audit delegates to exportService.getCompletionStatus and crossValidate rather than reimplementing completion logic
- Data quality generator queries collections directly (not through other services) for anomaly detection
- Empty orchestras category also flags orchestras without conductors as a separate row
- Contact info missing severity is low, academic fields missing is medium, unassigned students is high

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 institutional generators complete (INST-01 through INST-03 plus import-history)
- Phase 52 complete, ready for phase 53 (registration wiring)

---
*Phase: 52-institutional-ministry-generators*
*Completed: 2026-03-07*
