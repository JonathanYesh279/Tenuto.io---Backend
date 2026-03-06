---
phase: 50-teacher-workforce-generators
plan: 02
subsystem: api
tags: [reports, generators, salary, roster, teacher, hours_summary]

requires:
  - phase: 49-report-infrastructure
    provides: generator plugin convention, report orchestrator, scope builder
  - phase: 50-01
    provides: hours_summary-based generator pattern, department filtering helpers
provides:
  - TCHR-03 Teacher Salary Projection generator with classification/degree rate lookup
  - TCHR-04 Teacher Roster generator with status/department filtering
affects: [future report generators, report export, admin dashboard]

tech-stack:
  added: []
  patterns:
    - "Hourly rate lookup table (classification x degree matrix with cascading defaults)"
    - "Batch teacher doc loading for cross-collection enrichment"
    - "Direct teacher collection query for roster-style generators"

key-files:
  created:
    - api/reports/generators/teacher-salary-projection.generator.js
    - api/reports/generators/teacher-roster.generator.js
  modified: []

key-decisions:
  - "Salary projection uses hardcoded Ministry of Education reference rates (configurable later)"
  - "Monthly projection = weekly * 4.33, annual = monthly * 10 (school year ~10 months)"
  - "Roster queries teacher collection directly (not hours_summary) for complete teacher listing"

patterns-established:
  - "Rate lookup with cascading defaults: classification -> degree -> _default"
  - "Cross-collection enrichment via batch ObjectId lookup with projection"

duration: 2min
completed: 2026-03-06
---

# Phase 50 Plan 02: Teacher Salary Projection & Roster Generators Summary

**Salary projection with classification/degree-based hourly rates and teacher roster with status/department/contact filtering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T22:00:47Z
- **Completed:** 2026-03-06T22:02:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Teacher Salary Projection generator with per-teacher weekly/monthly/annual cost estimates using MoE reference rates
- Teacher Roster generator with complete contact info, qualifications, instruments, roles, and active/inactive filtering
- Both generators follow plugin convention and are auto-discovered by the registry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Teacher Salary Projection generator (TCHR-03)** - `b75dfe0` (feat)
2. **Task 2: Create Teacher Roster generator (TCHR-04)** - `7b0a5e6` (feat)

## Files Created/Modified
- `api/reports/generators/teacher-salary-projection.generator.js` - TCHR-03: salary estimates using hours_summary + teacher degree lookup with classification/degree rate matrix
- `api/reports/generators/teacher-roster.generator.js` - TCHR-04: complete teacher listing with status filtering, department filtering, and distinct instrument counting

## Decisions Made
- Salary projection uses hardcoded Ministry of Education reference rates with cascading defaults (classification -> degree -> global default). Comment notes these are configurable reference values.
- Monthly projection calculated as weekly * 4.33 weeks, annual as monthly * 10 months (school year duration)
- Roster queries teacher collection directly rather than hours_summary, since it needs all teachers including those without hours data
- Roster uses `getInstrumentsByDepartment()` for department filtering (more efficient $in query) vs salary projection using `getInstrumentDepartment()` per-teacher (inherited from hours-summary pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 teacher workforce generators complete (TCHR-01 through TCHR-04)
- Ready for next phase of report generators (student or institutional category)

---
*Phase: 50-teacher-workforce-generators*
*Completed: 2026-03-06*
