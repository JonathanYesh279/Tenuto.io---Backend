---
phase: 75-rehearsal-attendance-tracking
plan: 01
subsystem: api, ui
tags: [mongodb, attendance, denormalization, dashboard]

requires:
  - phase: 59-60 (v1.9 rehearsals)
    provides: updateAttendance transaction, attendance arrays, Dashboard tooltip
provides:
  - attendanceCount denormalized field on rehearsal documents
  - Server-first attendanceCount in frontend apiService
affects: [rehearsal, dashboard, attendance]

tech-stack:
  added: []
  patterns:
    - "Server-persisted denormalized count with client-computed fallback"

key-files:
  created: []
  modified:
    - api/rehearsal/rehearsal.service.js
    - /Tenuto.io-Frontend/src/services/apiService.js

key-decisions:
  - "total uses records.length (all marked students) not present+absent sum, because late students count toward total"
  - "Frontend uses || fallback so old rehearsals without attendanceCount still work"

patterns-established:
  - "Denormalized count pattern: persist counts alongside arrays in same transaction for list-view performance"

duration: 2min
completed: 2026-03-14
---

# Phase 75 Plan 01: Persist attendanceCount Summary

**Denormalized attendanceCount { present, absent, late, total } persisted on rehearsal docs in updateAttendance transaction; frontend apiService prefers server value with client-computed fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T19:46:04Z
- **Completed:** 2026-03-14T19:47:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Backend updateAttendance transaction now persists attendanceCount alongside attendance arrays
- Frontend getRehearsals and getRehearsalDetails prefer server-persisted attendanceCount
- Dashboard 30-day rehearsal tracker tooltip will show real attendance data for marked rehearsals
- Backward compatible: old rehearsals without attendanceCount fall back to client computation

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist attendanceCount in backend updateAttendance transaction** - `b0f2720` (feat)
2. **Task 2: Frontend apiService prefers server-persisted attendanceCount** - `99a9416` (feat, frontend repo)

## Files Created/Modified
- `api/rehearsal/rehearsal.service.js` - Added attendanceCount to $set in updateAttendance transaction
- `/Tenuto.io-Frontend/src/services/apiService.js` - Two locations updated to prefer server attendanceCount with fallback

## Decisions Made
- `total` field uses `records.length` (all marked students including late) rather than `present + absent` sum
- Frontend uses `rehearsal.attendanceCount || { ... }` pattern for backward compatibility with pre-existing rehearsals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `rehearsal.service.test.js` (`should update an existing rehearsal as admin`) unrelated to this change - affects `updateRehearsal` not `updateAttendance`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- attendanceCount field will be persisted on all newly-marked rehearsals
- Existing rehearsals need attendance to be re-marked to populate the field (or a migration script)
- Dashboard tooltip reads `r.attendanceCount.present/total` which will now have data

---
*Phase: 75-rehearsal-attendance-tracking*
*Completed: 2026-03-14*
