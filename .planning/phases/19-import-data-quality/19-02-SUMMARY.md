---
phase: 19-import-data-quality
plan: 02
subsystem: api
tags: [import, excel, students, startDate, studyYears, ministry]

# Dependency graph
requires:
  - phase: 19-01
    provides: "readInstrumentMatrix, buildInstrumentProgressEntry, department tracking, stage validation"
  - phase: 16-import-enrichment
    provides: "Student import preview/execute pipeline with field comparison and new student creation"
provides:
  - "Root-level startDate field on student schema (Date|null)"
  - "calculateStartDate helper: Jan 1 of (currentYear - studyYears + 1)"
  - "startDate calculation for both new and updated students during import"
  - "TeacherAssignment startDate derived from studyYears when available"
affects: [frontend-student-display, student-service, reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived date calculation: studyYears -> startDate via currentYear - studyYears + 1"
    - "Preview-computed fields: _calculatedStartDate set in preview, consumed in execute"

key-files:
  created: []
  modified:
    - api/student/student.validation.js
    - api/import/import.service.js

key-decisions:
  - "startDate is a root-level field on student document (not nested under academicInfo or teacherAssignment)"
  - "startDate defaults to null on schema (not new Date()) -- only import populates it from studyYears"
  - "Fallback to new Date() only in import execute when no studyYears data available"
  - "Start date comparison uses year-only check to avoid time-of-day mismatches"

patterns-established:
  - "Derived field pattern: calculateStartDate computes from studyYears, stored as _calculatedStartDate on mapped data for execute consumption"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 19 Plan 02: Start Date Calculation from Study Years Summary

**Root-level startDate on student schema calculated from studyYears during import (Jan 1 of currentYear - studyYears + 1)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T16:36:46Z
- **Completed:** 2026-02-27T16:39:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Root-level startDate field added to both studentSchema and studentUpdateSchema (Date|null)
- calculateStartDate helper derives start date from study years (e.g., 3 years in 2026 = 2024-01-01)
- Preview phase computes _calculatedStartDate on mapped data for execute to consume
- calculateStudentChanges detects startDate differences when studyYears change on existing students
- New students get startDate from calculated value with fallback to current date
- TeacherAssignment startDate uses calculated date for both new and matched students

## Task Commits

Each task was committed atomically:

1. **Task 1: Add root-level startDate to student schema** - `0116236` (feat)
2. **Task 2: Calculate startDate from studyYears in import preview and execute** - `d244333` (feat)

## Files Created/Modified
- `api/student/student.validation.js` - Added root-level startDate to studentSchema (default null) and studentUpdateSchema (optional)
- `api/import/import.service.js` - Added calculateStartDate helper, preview _calculatedStartDate computation, startDate comparison in calculateStudentChanges, startDate on new students and teacherAssignments

## Decisions Made
- startDate is a root-level field on student document (not nested under academicInfo) -- represents when student started at the conservatory
- Schema default is null (not new Date()) -- only import populates from studyYears, existing students not affected
- Import fallback to new Date() only when studyYears data is missing or invalid
- Year-only comparison for startDate changes avoids time-of-day and timezone mismatches

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Root-level startDate available on student documents for frontend display
- Import pipeline fully calculates and persists startDate from Ministry study years data
- All 19-import-data-quality plans complete (01: stage/instrument/department, 02: startDate)

---
*Phase: 19-import-data-quality*
*Completed: 2026-02-27*
