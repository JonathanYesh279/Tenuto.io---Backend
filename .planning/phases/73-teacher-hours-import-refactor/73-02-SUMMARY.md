---
phase: 73-teacher-hours-import-refactor
plan: 02
subsystem: api
tags: [import, hours-summary, denormalization, dual-write, excel]

requires:
  - phase: 73-01
    provides: weeklyHoursSummary Joi schema and dual-write in calculateTeacherHours
provides:
  - weeklyHoursSummary populated from Excel hours data during import
  - Post-import hours recalculation hook for affected teachers
  - Import-created teachers have immediate hours data on their documents
affects: [teacher-details-page, hours-dashboard, import-flow]

tech-stack:
  added: []
  patterns: [post-import enrichment hook, non-fatal async processing after primary operation]

key-files:
  created: []
  modified:
    - api/import/import.service.js

key-decisions:
  - "Post-import recalculation is non-fatal — import success is independent of hours calculation"
  - "Per-teacher calculation (not bulk) to only process affected teachers"
  - "Dynamic imports for hoursSummaryService and schoolYearService to avoid circular dependencies"

patterns-established:
  - "Post-import enrichment: after primary import completes and status is saved, run non-fatal enrichment passes"

duration: 8min
completed: 2026-03-13
---

# Phase 73 Plan 02: Import Hours Wiring Summary

**Import flow populates weeklyHoursSummary from Excel data and triggers per-teacher hours recalculation post-import**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T21:41:39Z
- **Completed:** 2026-03-13T21:49:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- buildImportWeeklyHoursSummary() helper maps managementInfo field names to weeklyHoursSummary field names
- New teachers created via import have weeklyHoursSummary with source='import' populated from Excel hours
- Matched teachers get weeklyHoursSummary detected as a change and updated during import
- Post-import hook recalculates hours for all affected teachers via hoursSummaryService.calculateTeacherHours()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add weeklyHoursSummary to import document building and change detection** - `0090ea6` (feat)
2. **Task 2: Add post-import hours recalculation hook** - `2a2cee3` (feat)

## Files Created/Modified
- `api/import/import.service.js` - Added buildImportWeeklyHoursSummary() helper, weeklyHoursSummary in buildImportTeacherDocument(), change detection in calculateTeacherChanges(), post-import recalculation hook in executeTeacherImport()

## Decisions Made
- Post-import recalculation is non-fatal: wrapped in try/catch at both per-teacher and outer level, import status already saved before recalculation runs
- Per-teacher calculation chosen over calculateAllTeacherHours() to only process affected teachers (performance)
- Dynamic imports used for hoursSummaryService and schoolYearService to prevent circular dependency issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import flow now fully populates weeklyHoursSummary from Excel data
- Post-import recalculation ensures hours_summary collection and teacher.weeklyHoursSummary are both up-to-date
- Ready for frontend to display imported teacher hours without manual recalculation

---
*Phase: 73-teacher-hours-import-refactor*
*Completed: 2026-03-13*
