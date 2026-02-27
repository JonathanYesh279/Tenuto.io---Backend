---
phase: 17-teacher-student-linking
plan: 01
subsystem: api
tags: [import, teacher-matching, preview, mongodb]

# Dependency graph
requires:
  - phase: 16-instrument-progress-student-data-enrichment
    provides: teacherName column mapping, calculateStudentChanges with teacherName placeholder
provides:
  - matchTeacherByName() function for teacher name matching in student import
  - teacherMatch property on every preview entry (matched + notFound)
  - teacherMatchSummary counts in preview object
  - Hebrew warnings for unresolved/ambiguous teacher names
affects: [17-02, frontend-import-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: [both-orderings name matching for Hebrew names, single-word fallback matching]

key-files:
  created: []
  modified:
    - api/import/import.service.js

key-decisions:
  - "matchTeacherByName tries both firstName+lastName orderings (Hebrew names have no standard ordering)"
  - "Single-word names match against either firstName or lastName individually"
  - "teacherName removed from calculateStudentChanges -- teacher matching now via teacherMatch on preview entries"
  - "Execute-path teacherName skip (line 1941) left as harmless dead code -- Plan 02 will clean up"

patterns-established:
  - "Teacher matching per row in preview with results persisted in import_log for execute consumption"
  - "teacherMatchSummary aggregation pattern for preview-level status counts"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 17 Plan 01: Teacher Name Matching in Preview Summary

**matchTeacherByName() with both-orderings Hebrew name matching, preview integration with teacherMatchSummary, and teacherMatch on all preview entries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T10:15:48Z
- **Completed:** 2026-02-27T10:18:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added matchTeacherByName() function handling 4 statuses: none/resolved/unresolved/ambiguous
- Integrated teacher matching into previewStudentImport with per-row matching and summary counts
- Removed Phase 16 placeholder teacherName from calculateStudentChanges
- Hebrew warning messages for unresolved and ambiguous teacher matches

## Task Commits

Each task was committed atomically:

1. **Task 1: Add matchTeacherByName function and remove teacherName from calculateStudentChanges** - `0da0f50` (feat)
2. **Task 2: Integrate teacher matching into previewStudentImport** - `ec9a6d1` (feat)

## Files Created/Modified
- `api/import/import.service.js` - Added matchTeacherByName(), removed teacherName from calculateStudentChanges, integrated teacher matching into previewStudentImport with teacherMatchSummary and warnings

## Decisions Made
- matchTeacherByName tries both firstName+lastName orderings since Hebrew names have no standard ordering convention
- Single-word names match against either firstName or lastName individually (not both required)
- teacherName removed from calculateStudentChanges changes array -- teacher matching is now handled via teacherMatch on preview entries, not via the changes array
- The execute-path `if (change.field === 'teacherName') continue;` skip at line 1941 was left as harmless dead code since no teacherName changes are generated anymore -- Plan 02 will address the execute path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- matchTeacherByName() is ready for Plan 02 to use during execute (match data persisted in import_log)
- Plan 02 can create teacherAssignment entries using the teacherMatch.teacherId from preview entries
- The execute-path teacherName skip should be cleaned up in Plan 02

---
*Phase: 17-teacher-student-linking*
*Completed: 2026-02-27*
