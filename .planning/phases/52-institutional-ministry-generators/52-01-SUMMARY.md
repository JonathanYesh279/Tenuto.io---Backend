---
phase: 52-institutional-ministry-generators
plan: 01
subsystem: api
tags: [reports, generators, institutional, year-over-year, import-history]

requires:
  - phase: 49-report-engine-core
    provides: generator plugin convention, loadGenerators(), report service pipeline
  - phase: 50-teacher-financial-generators
    provides: hours_summary collection patterns, department filtering helpers
provides:
  - INST-01 Year-over-Year Comparison generator
  - INST-04 Import History generator
affects: [52-02, 53-report-ui]

tech-stack:
  added: []
  patterns: [institutional report generators with year-scoped metric comparison]

key-files:
  created:
    - api/reports/generators/year-over-year-comparison.generator.js
    - api/reports/generators/import-history.generator.js
  modified: []

key-decisions:
  - "Year-over-year metrics sourced from hours_summary (year-scoped) + orchestra (year-scoped) + student (tenant-scoped)"
  - "Student counts shown as tenant-wide (not year-scoped) since students persist across years"
  - "Import history uses ?? for nullish coalescing on preview/results fields for robust count extraction"

patterns-established:
  - "Institutional generators return empty for 'own' scope (not meaningful for individual teachers)"

duration: 1min
completed: 2026-03-07
---

# Phase 52 Plan 01: Institutional Generators Summary

**Year-over-Year Comparison and Import History generators comparing school year metrics and tracking data import activity**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T22:35:14Z
- **Completed:** 2026-03-06T22:36:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Year-over-Year Comparison generator comparing 7 key metrics (teachers, hours, orchestras, students) across two school years
- Import History generator querying import_log with Hebrew type/status translations and success/failure counts
- Both generators follow established plugin convention with proper scope handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Year-over-Year Comparison generator (INST-01)** - `576f710` (feat)
2. **Task 2: Import History generator (INST-04)** - `108bb78` (feat)

## Files Created/Modified
- `api/reports/generators/year-over-year-comparison.generator.js` - Compares metrics across two school years with change/changePercent
- `api/reports/generators/import-history.generator.js` - Shows import log entries with Hebrew translations and counts

## Decisions Made
- Year-over-year metrics sourced from hours_summary and orchestra (year-scoped) plus student counts (tenant-wide, since students persist across years)
- Import history extracts counts from both preview and results objects with nullish coalescing for robustness
- Both generators return empty results for 'own' scope since institutional reports are not meaningful per-teacher

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Two institutional generators ready for use via report engine
- Phase 52 plan 02 can add ministry-specific generators (INST-02, INST-03)

---
*Phase: 52-institutional-ministry-generators*
*Completed: 2026-03-07*
