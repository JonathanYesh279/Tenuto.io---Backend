---
phase: 59-attendance-data-layer
plan: 01
subsystem: api
tags: [attendance, transactions, validation, mongodb]

requires:
  - phase: 57-rehearsal-orchestra-data-flow
    provides: withTransaction utility for all rehearsal write operations
provides:
  - ATTENDANCE_STATUSES constant with present/absent/late values
  - MINISTRY_PRESENT_STATUSES for ministry reporting
  - Per-student attendance validation schema with 3 statuses
  - Transactional updateAttendance with membership validation
  - activity_attendance as canonical source with rehearsal.attendance cache
affects: [59-02, 59-03, attendance-ui, ministry-reports]

tech-stack:
  added: []
  patterns:
    - "Membership validation before attendance writes (orchestra.memberIds gate)"
    - "Canonical source (activity_attendance) written first, cache (rehearsal.attendance) derived"
    - "MEMBERSHIP_VALIDATION error code pattern with 400 HTTP response"

key-files:
  created: []
  modified:
    - config/constants.js
    - api/rehearsal/rehearsal.validation.js
    - api/rehearsal/rehearsal.service.js
    - api/rehearsal/rehearsal.controller.js

key-decisions:
  - "Per-student records schema replaces old present/absent arrays for input"
  - "Membership validation rejects entire request if any student is not a member (no partial writes)"
  - "activity_attendance uses rehearsal.type (not hardcoded) for activityType field"

patterns-established:
  - "MEMBERSHIP_VALIDATION error code with invalidStudentIds array for client-side feedback"
  - "Three-status attendance model: present/absent/late with late counting as present for ministry"

duration: 2min
completed: 2026-03-07
---

# Phase 59 Plan 01: Attendance Data Layer Summary

**Transactional attendance recording with 3-status model (present/absent/late), membership validation against orchestra.memberIds, and activity_attendance as canonical source**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T15:18:29Z
- **Completed:** 2026-03-07T15:20:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added ATTENDANCE_STATUSES and MINISTRY_PRESENT_STATUSES constants for consistent status values
- Replaced old present/absent array validation with per-student records schema supporting 3 statuses
- Rewrote updateAttendance to validate membership, write canonical activity_attendance records, and update cache atomically via withTransaction
- Controller returns 400 with invalidStudentIds for membership validation failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add attendance status constants and update validation schema** - `8e25575` (feat)
2. **Task 2: Rewrite updateAttendance with membership validation and transactional writes** - `b46cb9e` (feat)

## Files Created/Modified
- `config/constants.js` - Added ATTENDANCE_STATUSES and MINISTRY_PRESENT_STATUSES constants
- `api/rehearsal/rehearsal.validation.js` - New per-student attendanceSchema, added late array to cache schemas
- `api/rehearsal/rehearsal.service.js` - Rewrote updateAttendance with membership gate and withTransaction
- `api/rehearsal/rehearsal.controller.js` - Added MEMBERSHIP_VALIDATION 400 error handling

## Decisions Made
- Per-student records schema replaces old present/absent arrays -- enables per-student notes and late status
- Membership validation rejects entire request if any student is not a member (no partial writes)
- activity_attendance uses `rehearsal.type` dynamically (not hardcoded 'תזמורת') to support both orchestra and ensemble types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Attendance data layer complete with transactional writes and membership validation
- Ready for 59-02 (attendance query/aggregation layer) to build read paths on activity_attendance
- Frontend will need to adapt to new request format: `{ records: [{ studentId, status, notes }] }`

---
*Phase: 59-attendance-data-layer*
*Completed: 2026-03-07*
