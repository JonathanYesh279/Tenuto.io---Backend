---
phase: 81-schedule-single-source-of-truth
plan: 01
subsystem: api
tags: [schedule, timeBlocks, rehearsal, theory, aggregation, write-through]

requires:
  - phase: 78-full-activity-rescheduling
    provides: moveActivity and rescheduleLesson in room-schedule.service.js
provides:
  - GET /api/student/:studentId/weekly-schedule endpoint
  - studentScheduleService with live data aggregation
  - Write-through scheduleInfo sync on moveActivity
affects: [student-details-frontend, hours-summary, export]

tech-stack:
  added: []
  patterns:
    - "Live data aggregation from three sources (timeBlocks, rehearsals, theory)"
    - "Write-through pattern for backward-compatible snapshots"
    - "Deduplication by composite key for weekly patterns"

key-files:
  created:
    - api/student/student-schedule.service.js
  modified:
    - api/student/student.controller.js
    - api/student/student.route.js
    - api/room-schedule/room-schedule.service.js

key-decisions:
  - "Live data only - no stale snapshots, always reads from timeBlocks/rehearsals/theory_lesson"
  - "Legacy assignments without timeBlockId fall back to top-level day/time fields (NOT scheduleInfo)"
  - "moveActivity write-through updates location and day only (lesson times within block are independent)"
  - "rescheduleLesson already handled by existing removeLessonFromBlock/assignLessonToBlock lifecycle"
  - "Orchestra membership checked via both enrollments.orchestraIds AND orchestra.memberIds"

patterns-established:
  - "Student schedule aggregation: three-source parallel fetch with batch teacher lookups"
  - "Write-through scheduleInfo: non-fatal sync after primary operation succeeds"

duration: 2min
completed: 2026-03-21
---

# Phase 81 Plan 01: Student Weekly Schedule Endpoint Summary

**Live student schedule endpoint aggregating timeBlocks, rehearsals, and theory lessons with write-through scheduleInfo sync on moveActivity**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T17:24:00Z
- **Completed:** 2026-03-21T17:26:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created student-schedule.service.js with live data aggregation from three sources
- Individual lessons resolved from teacher.teaching.timeBlocks (not stale snapshots)
- Orchestra rehearsals and theory lessons deduplicated by weekly pattern
- Write-through scheduleInfo sync keeps hours-summary and export consumers in sync
- Legacy assignment fallback uses top-level fields with isLegacy flag

## Task Commits

Each task was committed atomically:

1. **Task 1: Create student-schedule.service.js and wire endpoint** - `82d20e7` (feat)
2. **Task 2: Add write-through scheduleInfo updates to moveActivity** - `c7256fc` (feat)

## Files Created/Modified
- `api/student/student-schedule.service.js` - New service: aggregates live schedule from timeBlocks, rehearsals, theory lessons
- `api/student/student.controller.js` - Added getStudentWeeklySchedule handler with IDOR check
- `api/student/student.route.js` - Added GET /:studentId/weekly-schedule route
- `api/room-schedule/room-schedule.service.js` - Added write-through scheduleInfo sync after timeBlock moveActivity

## Decisions Made
- **Live data only:** Endpoint always reads from source collections, never from scheduleInfo snapshots
- **Legacy fallback:** Assignments without timeBlockId use top-level day/time/location fields (NOT scheduleInfo) with isLegacy flag
- **moveActivity write-through scope:** Only updates location and day (if changed). Lesson-level startTime/endTime within the block are independent of block position and don't change when the block moves
- **rescheduleLesson coverage:** No additional write-through needed -- removeLessonFromBlock already deactivates old student assignment, assignLessonToBlock already creates new one with fresh scheduleInfo
- **Dual membership check:** Orchestra membership resolved from both enrollments.orchestraIds AND orchestra.memberIds to catch both enrollment paths

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend endpoint ready for frontend consumption
- Frontend student details page can switch from stale snapshots to live weekly-schedule endpoint
- Write-through ensures backward compatibility for hours-summary and export during transition

---
*Phase: 81-schedule-single-source-of-truth*
*Completed: 2026-03-21*
