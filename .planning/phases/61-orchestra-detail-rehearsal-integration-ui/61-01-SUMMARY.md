---
phase: 61-orchestra-detail-rehearsal-integration-ui
plan: 01
subsystem: ui
tags: [react, typescript, attendance, navigation, orchestra]

requires:
  - phase: 59-attendance-backend
    provides: 3-status attendance model (present/absent/late)
  - phase: 60-attendance-ux
    provides: Conductor attendance view at /conductor/attendance/:id
provides:
  - Updated ScheduleTab with 3-status attendance display
  - In-app navigation from orchestra detail to rehearsal detail and attendance
affects: [orchestra-details, rehearsal-navigation]

tech-stack:
  added: []
  patterns:
    - "Late counts as present in percentage calculation (decision 59-02)"
    - "In-app navigate() over window.open for all internal navigation"

key-files:
  created: []
  modified:
    - src/features/orchestras/details/types/index.ts
    - src/features/orchestras/details/components/tabs/ScheduleTab.tsx

key-decisions:
  - "Take Attendance button shown for all past rehearsals (not just those with existing attendance)"
  - "preselectedOrchestraId passed via navigate state for Add Rehearsal button"

patterns-established:
  - "3-status attendance display: present+late as main count, late shown separately in amber"

duration: 6min
completed: 2026-03-07
---

# Phase 61 Plan 01: ScheduleTab Attendance & Navigation Update Summary

**Orchestra detail ScheduleTab updated with 3-status attendance (present/absent/late) and React Router in-app navigation replacing all window.open calls**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T16:19:52Z
- **Completed:** 2026-03-07T16:26:23Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `late` array to OrchestraRehearsal type for 3-status attendance model
- Attendance percentage now counts late as present (per decision 59-02), with late count shown separately in amber
- Replaced all 4 `window.open` calls with React Router `navigate()` for in-app navigation
- Added Take Attendance button navigating to `/conductor/attendance/:id` for past rehearsals
- Add Rehearsal button passes `preselectedOrchestraId` via route state

## Task Commits

Each task was committed atomically:

1. **Task 1: Update OrchestraRehearsal type and ScheduleTab attendance logic** - `fa94b5d` (feat)

## Files Created/Modified
- `src/features/orchestras/details/types/index.ts` - Added late array, dayOfWeek, type fields to OrchestraRehearsal
- `src/features/orchestras/details/components/tabs/ScheduleTab.tsx` - 3-status attendance, navigate(), Take Attendance button

## Decisions Made
- Take Attendance button shown for all past rehearsals (not conditioned on existing attendance data) to allow conductors to record attendance at any time
- preselectedOrchestraId passed via navigate state to allow future rehearsal form pre-selection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ScheduleTab aligned with Phases 57-60 backend and attendance model
- Ready for Phase 62 (Rehearsal Details Page) or further UI integration work

## Self-Check: PASSED

- FOUND: types/index.ts
- FOUND: ScheduleTab.tsx
- FOUND: commit fa94b5d

---
*Phase: 61-orchestra-detail-rehearsal-integration-ui*
*Completed: 2026-03-07*
