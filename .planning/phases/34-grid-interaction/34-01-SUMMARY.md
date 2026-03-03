---
phase: 34-grid-interaction
plan: 01
subsystem: ui
tags: [react, filtering, useMemo, room-schedule, tenant-rooms, phosphor-icons]

# Dependency graph
requires:
  - phase: 33-read-only-room-grid-ui
    provides: RoomGrid, ActivityCell, SummaryBar, DaySelector, utils.ts, RoomSchedule page
provides:
  - FilterBar component with teacher name search, room select, activity type toggles
  - Client-side filtering of schedule data via useMemo
  - Empty tenant room rows merged into grid
  - DAY_NAMES and minutesToTime shared utils
  - Filters type export for reuse in other components
affects: [34-02-click-to-create, 34-03-drag-and-drop]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side useMemo filtering of API response, tenant room merge for empty room display]

key-files:
  created:
    - src/components/room-schedule/FilterBar.tsx
  modified:
    - src/pages/RoomSchedule.tsx
    - src/components/room-schedule/utils.ts
    - src/components/room-schedule/DaySelector.tsx

key-decisions:
  - "Client-side filtering via useMemo (no new API calls) -- schedule data per day is small"
  - "Empty rooms from tenant settings merged into filteredRooms so they appear as grid rows"
  - "Stats recomputed from filteredRooms so summary bar reflects active filter state"
  - "DAY_NAMES moved to shared utils.ts to eliminate duplication across DaySelector and future CreateLessonDialog"
  - "Conflict count in stats derived from filtered activity hasConflict flags rather than summary.conflictCount"

patterns-established:
  - "FilterBar pattern: parent owns filter state, child calls onFiltersChange callback"
  - "Tenant room merge: schedule rooms + active tenant rooms combined with deduplication"

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 34 Plan 01: Filter Controls and Empty Rooms Summary

**Client-side FilterBar with teacher search, room dropdown, and activity type toggles, plus tenant empty room rows merged into grid**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T13:22:21Z
- **Completed:** 2026-03-03T13:29:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- FilterBar component with teacher name search input, room name select dropdown, 3 activity type toggle buttons, and conditional clear button
- Client-side filtering in RoomSchedule.tsx via filteredRooms useMemo -- filters by teacher name, room name, and activity type
- Empty rooms from tenant settings appear as grid rows with no activities
- Stats bar updates to reflect filtered view (room count, occupied/free slots, conflicts)
- DAY_NAMES and minutesToTime exported from shared utils.ts for reuse
- Filters persist when switching days via DaySelector

## Task Commits

Each task was committed atomically:

1. **Task 1: FilterBar component and shared utils additions** - `5f8e55d` (feat)
2. **Task 2: Integrate filters and empty rooms into RoomSchedule page** - `df1fd34` (feat)

## Files Created/Modified
- `src/components/room-schedule/FilterBar.tsx` - New filter controls component with teacher search, room select, activity type toggles, clear button
- `src/pages/RoomSchedule.tsx` - Added filter state, tenant rooms fetch, filteredRooms useMemo, roomNames useMemo, FilterBar in JSX
- `src/components/room-schedule/utils.ts` - Added DAY_NAMES constant and minutesToTime helper
- `src/components/room-schedule/DaySelector.tsx` - Import DAY_NAMES from utils instead of local definition

## Decisions Made
- Client-side filtering via useMemo rather than server-side API params -- schedule data per day is small (~60-100 activities), instant filtering, no extra API calls
- Empty rooms from tenant settings merged into filteredRooms data rather than handled separately in RoomGrid -- cleaner data flow, grid renders them as normal rows
- Stats recomputed from filteredRooms (not raw schedule.summary) so occupied/free slot counts and conflict count reflect the current filter state
- DAY_NAMES moved to shared utils.ts for deduplication -- DaySelector imports from utils, future CreateLessonDialog (plan 34-02) will also import from there
- Conflict count in stats derived from filtered activity hasConflict flags rather than schedule.summary.conflictCount, ensuring it reflects filtered activities only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FilterBar and Filters type exported for potential reuse in Plan 34-02 (click-to-create)
- minutesToTime utility ready for Plan 34-03 endTime calculation
- Empty room rows provide droppable targets for Plan 34-03 drag-and-drop
- filteredRooms data structure compatible with existing RoomGrid -- no changes needed to RoomGrid for this plan

---
*Phase: 34-grid-interaction*
*Completed: 2026-03-03*
