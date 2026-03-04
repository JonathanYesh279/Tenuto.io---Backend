---
phase: 38-single-lesson-reschedule-detail-modal
plan: 01
subsystem: api
tags: [room-schedule, reschedule, time-block, lesson-management]

# Dependency graph
requires:
  - phase: 32-room-schedule-aggregation-service
    provides: "getRoomSchedule aggregation, moveActivity endpoint, conflict detection"
  - phase: 37-room-schedule-ux-fixes
    provides: "seed data with lessons/blocks, room schedule UX foundation"
provides:
  - "Enhanced activity data with lessonId, studentId, duration, blockId fields"
  - "PUT /api/room-schedule/reschedule-lesson endpoint for single-lesson moves"
  - "Conflict pre-check at target room/time with 409 response"
  - "Empty source block auto-cleanup after last lesson rescheduled away"
affects: [38-02, frontend-detail-modal, frontend-lesson-drag]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-lesson granularity operations (vs block-level in moveActivity)"
    - "timeBlockService composition: removeLessonFromBlock + createTimeBlock + assignLessonToBlock"

key-files:
  created: []
  modified:
    - "api/room-schedule/room-schedule.service.js"
    - "api/room-schedule/room-schedule.controller.js"
    - "api/room-schedule/room-schedule.route.js"
    - "api/room-schedule/room-schedule.validation.js"

key-decisions:
  - "Conflict exclusion by lessonId field rather than blockId prefix to avoid masking sibling lessons"
  - "Empty block cleanup is non-fatal: logged but does not fail the reschedule operation"
  - "Duration fallback: uses targetEndTime - targetStartTime when lesson.duration is null"

patterns-established:
  - "Lesson-level metadata fields (lessonId, studentId, duration, blockId) on timeBlock activities"
  - "rescheduleLesson as atomic multi-step operation via timeBlockService composition"

# Metrics
duration: 10min
completed: 2026-03-04
---

# Phase 38 Plan 01: Backend API for Lesson Metadata and Reschedule Summary

**Enhanced room schedule API with per-lesson metadata fields (lessonId, studentId, duration, blockId) and PUT /reschedule-lesson endpoint for atomic single-lesson moves across rooms/days/times**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-04T19:44:41Z
- **Completed:** 2026-03-04T19:54:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Every timeBlock activity now emits lessonId, studentId, duration, and blockId for frontend detail modal consumption
- New reschedule-lesson endpoint atomically moves a single lesson: removes from source block, creates target block, assigns lesson, cleans up empty source blocks
- Conflict pre-check returns 409 with conflict details when target room/time is occupied
- Existing moveActivity and getRoomSchedule endpoints unchanged (no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance activity data with lesson metadata fields** - `c745648` (feat)
2. **Task 2: Add rescheduleLesson endpoint (service + controller + route + validation)** - `74dc667` (feat)

## Files Created/Modified
- `api/room-schedule/room-schedule.service.js` - Added lessonId/studentId/duration/blockId to activity objects; added rescheduleLesson function with conflict check, lesson removal, block creation, lesson assignment, and empty block cleanup
- `api/room-schedule/room-schedule.controller.js` - Added rescheduleLesson handler with error code routing (409/404/403/500)
- `api/room-schedule/room-schedule.route.js` - Added PUT /reschedule-lesson route with admin-only auth
- `api/room-schedule/room-schedule.validation.js` - Added rescheduleBodySchema and validateRescheduleBody (teacherId, sourceBlockId, lessonId, targetRoom, targetDay, targetStartTime, targetEndTime)

## Decisions Made
- Conflict exclusion uses lessonId field match rather than blockId prefix to correctly preserve sibling lesson conflict detection
- Empty block cleanup is wrapped in try/catch as non-fatal -- a cleanup failure should not roll back a successful reschedule
- Duration fallback calculates from target times when lesson.duration is null, enabling cross-duration reschedules
- timeBlockService imported at module level (not lazy) since reschedule is a core operation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API ready for frontend consumption in Plan 38-02
- Enhanced activity data (lessonId, studentId, duration, blockId) available for detail modal
- Reschedule endpoint ready for frontend drag-and-drop single-lesson moves
- Existing moveActivity endpoint preserved for block-level moves

## Self-Check: PASSED

All files exist, both commits verified, all key content confirmed in modified files.

---
*Phase: 38-single-lesson-reschedule-detail-modal*
*Completed: 2026-03-04*
