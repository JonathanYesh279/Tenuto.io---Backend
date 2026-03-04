---
phase: 38-single-lesson-reschedule-detail-modal
plan: 02
subsystem: ui
tags: [room-schedule, detail-modal, drag-and-drop, reschedule, react, typescript]

# Dependency graph
requires:
  - phase: 38-single-lesson-reschedule-detail-modal
    plan: 01
    provides: "Enhanced activity data with lessonId/studentId/duration/blockId, PUT /reschedule-lesson endpoint"
  - phase: 37-room-schedule-ux-fixes
    provides: "ActivityCell, RoomGrid, DnD handler, silentReloadSchedule, extractBlockId"
provides:
  - "ActivityDetailModal component with view/edit/delete for timeBlock lessons"
  - "Click-to-view on any activity cell in the room schedule grid"
  - "DnD handler fork routing lesson-level drags to rescheduleLesson endpoint"
  - "rescheduleLesson and deleteLessonFromBlock methods on roomScheduleService"
affects: [frontend-room-schedule, future-schedule-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Click-to-view detail modal pattern for grid activities"
    - "DnD handler fork: lesson-level vs block-level routing based on activity ID format"
    - "Inline delete confirmation (not window.confirm) with confirm/cancel toggle"

key-files:
  created:
    - "src/components/room-schedule/ActivityDetailModal.tsx"
  modified:
    - "src/components/room-schedule/ActivityCell.tsx"
    - "src/components/room-schedule/RoomGrid.tsx"
    - "src/pages/RoomSchedule.tsx"
    - "src/services/apiService.js"

key-decisions:
  - "ActivityData extended with lessonId/studentId/duration/blockId as optional fields for backward compat"
  - "onClick on ActivityCell only fires when not dragging (isDragging check prevents click-on-drag)"
  - "Inline delete confirmation toggle (not window.confirm) for consistent UX with shadcn Dialog"
  - "Lesson-level DnD skips optimistic update because reschedule creates new backend entities with unpredictable IDs"
  - "deleteLessonFromBlock uses existing DELETE /lesson/:teacherId/:timeBlockId/:lessonId route (no new backend endpoint needed)"

patterns-established:
  - "Activity detail modal pattern: read-only for all types, edit section conditional on source + lessonId"
  - "DnD fork pattern: isLessonLevel check using ID format (blockId_N) + lessonId presence"

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 38 Plan 02: Frontend Detail Modal, Click-to-View, and Lesson-Level DnD Summary

**ActivityDetailModal with view/edit/delete for timeBlock lessons, click-to-view on grid cells, and DnD handler fork routing lesson-level drags through rescheduleLesson endpoint**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T19:59:14Z
- **Completed:** 2026-03-04T20:08:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- New ActivityDetailModal component showing read-only details for all activity types (teacher, student, room, day, time, type badge)
- Edit section for timeBlock lessons with day/time/room inputs and save button calling rescheduleLesson
- Inline delete confirmation for timeBlock lessons calling existing DELETE /lesson endpoint
- Click-to-view wired through ActivityCell -> RoomGrid -> RoomSchedule with proper non-drag click detection
- DnD handler forked: lesson-level drags (blockId_N with lessonId) call rescheduleLesson, block/rehearsal/theory drags use existing moveActivity

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActivityDetailModal and add rescheduleLesson/deleteLessonFromBlock to apiService** - `fe94db5` (feat)
2. **Task 2: Wire onClick through ActivityCell/RoomGrid/RoomSchedule and fork DnD handler** - `b4304a3` (feat)

## Files Created/Modified
- `src/components/room-schedule/ActivityDetailModal.tsx` - New component: detail modal with read-only view (all types), edit form + save (timeBlock lessons), inline delete confirmation
- `src/components/room-schedule/ActivityCell.tsx` - Extended ActivityData with lessonId/studentId/duration/blockId; added onClick prop with isDragging guard
- `src/components/room-schedule/RoomGrid.tsx` - Added onActivityClick prop; passed onClick to both solo and conflict group ActivityCell instances
- `src/pages/RoomSchedule.tsx` - Added detail modal state/handler; rendered ActivityDetailModal; forked handleDragEnd for lesson-level reschedule
- `src/services/apiService.js` - Added rescheduleLesson (PUT /room-schedule/reschedule-lesson) and deleteLessonFromBlock (DELETE /lesson/:teacherId/:blockId/:lessonId)

## Decisions Made
- Extended ActivityData interface rather than creating a separate type, keeping backward compatibility with all existing consumers
- onClick on ActivityCell checks `!isDragging` to prevent opening modal when user was attempting a drag (8px activation distance from PointerSensor handles most cases, this is the safety net)
- Used inline confirm/cancel toggle for delete instead of window.confirm for consistent UX within the Dialog
- Lesson-level DnD branch does NOT use optimistic update because reschedule creates new backend entities whose IDs cannot be predicted client-side; silentReloadSchedule syncs state after API response
- Reused existing DELETE /lesson/:teacherId/:timeBlockId/:lessonId route from time-block.route.js (no new backend endpoint required)
- Added selectedDay to handleDragEnd dependency array since the lesson-level branch passes it as targetDay

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 38 complete: both backend (Plan 01) and frontend (Plan 02) for single-lesson reschedule and detail modal
- Admin can click any activity to see details, edit/reschedule timeBlock lessons, and delete lessons
- Admin can drag lesson-level activities independently from their parent blocks
- All existing grid functionality preserved (filters, week view, PDF export, fullscreen, block-level drag)

## Self-Check: PASSED

All files exist, both commits verified, all key content confirmed in created/modified files.

---
*Phase: 38-single-lesson-reschedule-detail-modal*
*Completed: 2026-03-04*
