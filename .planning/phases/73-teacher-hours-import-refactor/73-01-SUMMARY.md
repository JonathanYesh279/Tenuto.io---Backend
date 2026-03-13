---
phase: 73-teacher-hours-import-refactor
plan: 01
subsystem: api
tags: [joi, validation, hours-summary, denormalization, dual-write]

requires:
  - phase: none
    provides: existing hours_summary service and teacher validation schemas
provides:
  - weeklyHoursSummary Joi schema on all 3 teacher schemas (create, update, import)
  - Dual-write from calculateTeacherHours to teacher.weeklyHoursSummary
  - Teacher list API includes weeklyHoursSummary in enrichment response
affects: [73-02-import-hours, teacher-details-page, hours-dashboard]

tech-stack:
  added: []
  patterns: [dual-write denormalization for fast list access]

key-files:
  created: []
  modified:
    - api/teacher/teacher.validation.js
    - api/hours-summary/hours-summary.service.js
    - api/teacher/teacher.service.js

key-decisions:
  - "weeklyHoursSummary defaults to null (not empty object) to signal 'not yet calculated'"
  - "Dual-write pattern: hours_summary collection remains source of truth with breakdown, teacher doc gets flat totals for list display"

patterns-established:
  - "Denormalized summary on entity doc: write flat totals alongside detailed collection for O(1) list access"

duration: 10min
completed: 2026-03-13
---

# Phase 73 Plan 01: WeeklyHoursSummary Denormalization Summary

**weeklyHoursSummary Joi schema with dual-write from calculateTeacherHours and teacher list API exposure**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-13T21:29:41Z
- **Completed:** 2026-03-13T21:39:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Defined weeklyHoursSummarySchema with all hours breakdown fields (10 numeric + source + updatedAt)
- Added weeklyHoursSummary to all 3 teacher Joi schemas (create, update, import)
- calculateTeacherHours() now dual-writes summary totals to teacher document after hours_summary upsert
- Teacher list API enrichment includes weeklyHoursSummary (null when not yet populated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add weeklyHoursSummary to Joi schemas and dual-write in calculateTeacherHours** - `82042fe` (feat)
2. **Task 2: Expose weeklyHoursSummary in teacher list API enrichment** - `91fd5ba` (feat)

## Files Created/Modified
- `api/teacher/teacher.validation.js` - Added weeklyHoursSummarySchema, added to teacherSchema, teacherUpdateSchema, teacherImportSchema
- `api/hours-summary/hours-summary.service.js` - Added dual-write to teacher.weeklyHoursSummary after hours_summary upsert
- `api/teacher/teacher.service.js` - Added weeklyHoursSummary passthrough in _enrichWithStudentCounts()

## Decisions Made
- weeklyHoursSummary defaults to null (not empty object) to clearly signal "hours not yet calculated" to frontend
- Dual-write pattern chosen: hours_summary collection keeps full breakdown (students, orchestras, theory), teacher doc gets flat totals only for list display performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- weeklyHoursSummary field is now accepted by all teacher schemas and exposed in API
- Ready for Plan 02 (import hours from Excel) to populate the field via import
- Ready for frontend to display hours data in teacher list without extra API calls

---
*Phase: 73-teacher-hours-import-refactor*
*Completed: 2026-03-13*
