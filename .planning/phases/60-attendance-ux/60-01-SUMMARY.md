---
phase: 60-attendance-ux
plan: 01
subsystem: api
tags: [mongodb-aggregation, attendance, orchestra, batch-endpoint]

# Dependency graph
requires:
  - phase: 59-attendance-data-layer
    provides: activity_attendance collection with per-student records and isArchived soft-delete
provides:
  - GET /orchestra/:id/member-attendance-rates batch endpoint
  - Per-member attendance stats with suggestion flags (likelyPresent/frequentAbsent)
affects: [60-02, 60-03, frontend-attendance-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [MongoDB $cond aggregation for conditional counting within $group stage]

key-files:
  created: []
  modified:
    - api/orchestra/orchestra.service.js
    - api/orchestra/orchestra.controller.js
    - api/orchestra/orchestra.route.js

key-decisions:
  - "Minimum 3 rehearsals threshold before flagging frequentAbsent to avoid false positives on new members"
  - "Reuse MINISTRY_PRESENT_STATUSES constant for present counting consistency with existing getStudentAttendanceStats"

patterns-established:
  - "Batch attendance stats: aggregate activity_attendance then map all memberIds including zero-record members"

# Metrics
duration: 1min
completed: 2026-03-07
---

# Phase 60 Plan 01: Member Attendance Rates Endpoint Summary

**Batch endpoint returning per-member attendance rates with smart suggestion flags (likelyPresent/frequentAbsent) via MongoDB aggregation pipeline**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T15:44:28Z
- **Completed:** 2026-03-07T15:45:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added getMemberAttendanceRates service function with MongoDB aggregation on activity_attendance
- Wired controller handler and GET route at /:id/member-attendance-rates with rehearsals view permission
- Smart suggestion flags: likelyPresent (>80% rate), frequentAbsent (<50% rate with >=3 rehearsals)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getMemberAttendanceRates service function** - `5804e71` (feat)
2. **Task 2: Add controller handler and route** - `760b60a` (feat)

## Files Created/Modified
- `api/orchestra/orchestra.service.js` - New getMemberAttendanceRates function with aggregation pipeline and suggestion logic
- `api/orchestra/orchestra.controller.js` - New getMemberAttendanceRates handler extracting orchestraId from params
- `api/orchestra/orchestra.route.js` - GET /:id/member-attendance-rates route with rehearsals view permission

## Decisions Made
- Minimum 3 rehearsals threshold before flagging frequentAbsent -- prevents false positives on newly enrolled members
- Reused MINISTRY_PRESENT_STATUSES for present counting to stay consistent with existing getStudentAttendanceStats function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Batch endpoint ready for frontend consumption in attendance marking UI
- Response shape matches plan spec: `[{ studentId, totalRehearsals, attended, late, attendanceRate, suggestion }]`

---
*Phase: 60-attendance-ux*
*Completed: 2026-03-07*
