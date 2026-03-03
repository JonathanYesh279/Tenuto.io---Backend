---
phase: 34-grid-interaction
plan: 03
subsystem: ui
tags: [dnd-kit, drag-and-drop, react, room-schedule, rtl, conflict-validation]

# Dependency graph
requires:
  - phase: 34-02
    provides: "Click-to-create empty cell handling, ActivityCell component, RoomGrid with occupied slot detection"
  - phase: 32-02
    provides: "PUT /api/room-schedule/move endpoint with conflict pre-check and 409 conflict response"
provides:
  - "@dnd-kit/core integration with DndContext, PointerSensor (8px threshold), KeyboardSensor"
  - "DroppableCell wrapper encoding room::time droppable IDs"
  - "DragOverlayContent for visual drag feedback in portal"
  - "ActivityCell with useDraggable hook, drag state styling"
  - "Move API integration with conflict error display in Hebrew"
  - "extractBlockId helper for timeBlock ID parsing"
  - "apiService 409 conflict handler preserving conflicts array"
affects: [phase-35-polish, room-schedule-enhancements]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/utilities@3.2.2"]
  patterns: ["DndContext at page level wrapping grid only", "Droppable ID encoding room::time", "PointerSensor with 8px activation distance", "DragOverlay portal for CSS grid compat"]

key-files:
  created:
    - "src/components/room-schedule/DroppableCell.tsx"
    - "src/components/room-schedule/DragOverlayContent.tsx"
  modified:
    - "src/components/room-schedule/ActivityCell.tsx"
    - "src/components/room-schedule/RoomGrid.tsx"
    - "src/pages/RoomSchedule.tsx"
    - "src/components/room-schedule/utils.ts"
    - "src/services/apiService.js"

key-decisions:
  - "DndContext wraps only RoomGrid+DragOverlay, not entire page (FilterBar, SummaryBar outside)"
  - "PointerSensor 8px activation distance prevents click/drag conflict"
  - "apiService 409 handler added to preserve conflict details on error object"
  - "RTL keyboard navigation accepted as-is; custom coordinateGetter deferred to Phase 35"
  - "DroppableCell ID format: room::HH:MM with lastIndexOf parsing for room names containing colons"

patterns-established:
  - "Droppable ID encoding: room::time parsed via lastIndexOf('::') for safe room name handling"
  - "Conflict error display: err.code === 'CONFLICT' with err.conflicts array"
  - "Activity drag data: spread activity + dragData (room, teacherId) on useDraggable"

# Metrics
duration: 9min
completed: 2026-03-03
---

# Phase 34 Plan 03: Drag-and-Drop Time Block Moves Summary

**@dnd-kit/core drag-and-drop integration with DroppableCell grid targeting, DragOverlay visual feedback, move API with 409 conflict display in Hebrew**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-03T13:42:38Z
- **Completed:** 2026-03-03T13:51:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Full drag-and-drop between grid cells: activities draggable with useDraggable, cells droppable with useDroppable
- Move API integration on drop with conflict validation and Hebrew error toasts showing teacher names and times
- DragOverlay portal rendering avoids CSS grid position conflicts; original cell dims during drag
- 8px PointerSensor activation distance prevents click/drag conflicts, preserving click-to-create and tooltip interactions
- apiService enhanced with 409 conflict handler preserving conflicts array on error objects

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit and create DroppableCell, DragOverlayContent, extractBlockId** - `96437f6` (feat)
2. **Task 2: Make ActivityCell draggable, wrap grid in DndContext, handle drag-and-drop with move API** - `c021113` (feat)

## Files Created/Modified
- `src/components/room-schedule/DroppableCell.tsx` - Droppable cell wrapper with useDroppable, drop highlight, click passthrough
- `src/components/room-schedule/DragOverlayContent.tsx` - Visual clone of ActivityCell in DragOverlay portal
- `src/components/room-schedule/ActivityCell.tsx` - Added useDraggable hook, drag state styling, isDragEnabled/dragData props
- `src/components/room-schedule/RoomGrid.tsx` - Background cells wrapped in DroppableCell, isDragEnabled prop for ActivityCell
- `src/pages/RoomSchedule.tsx` - DndContext with sensors, handleDragStart/handleDragEnd, move API call, conflict handling
- `src/components/room-schedule/utils.ts` - extractBlockId helper for timeBlock ID parsing
- `src/services/apiService.js` - 409 conflict handler preserving conflicts array on error

## Decisions Made
- **DndContext scope:** Wraps only RoomGrid + DragOverlay, not entire page. FilterBar, SummaryBar, DaySelector, UnassignedRow remain outside DndContext to avoid unnecessary droppable registration.
- **PointerSensor 8px threshold:** Prevents accidental drag when user intends to click. Click-to-create on empty cells and tooltip on activity cells both work without interference.
- **RTL keyboard deferred:** Default KeyboardSensor used without custom coordinateGetter. RTL arrow key behavior noted as known limitation for Phase 35 polish if testing reveals issues.
- **Droppable ID parsing:** Uses `lastIndexOf('::')` instead of `split('::')` to safely handle room names that might contain colons.
- **ActivityData.teacherId added to interface:** The ActivityData type in ActivityCell.tsx now includes teacherId field (was already returned by API but not typed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] apiService 409 handler to preserve conflict data**
- **Found during:** Task 2 (move API error handling)
- **Issue:** The apiClient handleResponse method threw a plain Error for 409 status, losing the conflicts array from the response body. The plan assumed axios-style error.response.data access.
- **Fix:** Added explicit 409 handler in apiService.js handleResponse that creates an error with code='CONFLICT', status=409, and conflicts array attached
- **Files modified:** src/services/apiService.js
- **Verification:** Error handler in RoomSchedule.tsx checks err.code === 'CONFLICT' and err.conflicts
- **Committed in:** c021113 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for conflict error handling. Without it, 409 responses would show generic error instead of conflict details. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated components (BagrutForm, AttendanceManager, etc.) -- not related to room-schedule changes. Verified zero TS errors in all room-schedule files and RoomSchedule.tsx.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 34 complete: all 3 plans (Filters, Click-to-Create, Drag-and-Drop) shipped
- EDIT-01 through EDIT-06 requirements satisfied
- RTL keyboard drag navigation is a known limitation to validate manually
- Ready for Phase 35 polish or next milestone planning

---
*Phase: 34-grid-interaction*
*Completed: 2026-03-03*
