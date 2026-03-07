---
phase: 59-attendance-data-layer
plan: 02
subsystem: api
tags: [attendance, soft-delete, analytics, reports, late-status]

requires:
  - phase: 59-attendance-data-layer
    plan: 01
    provides: ATTENDANCE_STATUSES and MINISTRY_PRESENT_STATUSES constants, updateAttendance with transactional writes
provides:
  - Soft-delete (isArchived) pattern for attendance records on rehearsal deletion
  - Unified orchestra attendance write path delegating to rehearsal service
  - Late-as-present in all attendance rate calculations via MINISTRY_PRESENT_STATUSES
  - Archived record filtering across all attendance consumers
affects: [59-03, attendance-ui, ministry-reports]

tech-stack:
  added: []
  patterns:
    - "Soft-delete attendance via isArchived flag with archivedAt timestamp and archivedReason"
    - "MINISTRY_PRESENT_STATUSES.includes() replaces status==='הגיע/ה' for present detection"
    - "Late count surfaced separately in all stat breakdowns alongside attended/missed"

key-files:
  created: []
  modified:
    - api/rehearsal/rehearsal.service.js
    - api/orchestra/orchestra.service.js
    - api/orchestra/orchestra.controller.js
    - api/analytics/attendance.service.js
    - api/reports/generators/student-attendance.generator.js
    - api/schedule/attendance.service.js

key-decisions:
  - "Soft-delete attendance records with isArchived:true instead of hard-delete on rehearsal removal"
  - "Orchestra attendance write path delegates to canonical rehearsal.updateAttendance (no duplicate logic)"
  - "Late (איחור) counts as present in all Ministry reporting and attendance rate calculations"
  - "Orchestra removeOrchestra cascade also archives attendance (archivedReason: orchestra_deleted)"

patterns-established:
  - "isArchived:{$ne:true} filter on all activity_attendance read queries"
  - "archivedReason field documents why record was archived (rehearsal_deleted, orchestra_deleted)"

duration: 5min
completed: 2026-03-07
---

# Phase 59 Plan 02: Attendance Consumers & Soft-Delete Summary

**Soft-delete attendance on rehearsal deletion, consolidated orchestra attendance path, and late-as-present across all analytics/reports/schedule consumers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T15:22:56Z
- **Completed:** 2026-03-07T15:28:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced hard-delete (deleteMany) with soft-delete (updateMany + isArchived) in removeRehearsal, bulkDeleteRehearsalsByOrchestra, bulkDeleteRehearsalsByDateRange, and removeOrchestra cascade
- Consolidated orchestra.updateRehearsalAttendance to delegate to canonical rehearsal.updateAttendance with backward-compatible format conversion
- Added isArchived:{$ne:true} filter to all activity_attendance queries across 4 consumer files (analytics, reports, orchestra stats, schedule attendance)
- Replaced all `status === 'הגיע/ה'` checks with MINISTRY_PRESENT_STATUSES.includes() across all attendance rate calculations
- Added late count to all stat breakdowns (analytics per-activity, overall, teacher, student, orchestra, schedule)
- Added MEMBERSHIP_VALIDATION error handling in orchestra controller

## Task Commits

Each task was committed atomically:

1. **Task 1: Soft-delete attendance on rehearsal deletion and consolidate orchestra attendance path** - `17a92b2` (feat)
2. **Task 2: Update analytics, reports, schedule, and stats queries for late status and archived record filtering** - `6b8affc` (feat)

## Files Created/Modified
- `api/rehearsal/rehearsal.service.js` - removeRehearsal, bulkDelete* functions now archive attendance instead of deleting
- `api/orchestra/orchestra.service.js` - updateRehearsalAttendance delegates to rehearsal service; getStudentAttendanceStats uses isArchived filter + MINISTRY_PRESENT_STATUSES; removeOrchestra archives attendance
- `api/orchestra/orchestra.controller.js` - Added MEMBERSHIP_VALIDATION error handling
- `api/analytics/attendance.service.js` - All query functions filter archived records, use MINISTRY_PRESENT_STATUSES, surface late counts
- `api/reports/generators/student-attendance.generator.js` - isArchived filter, MINISTRY_PRESENT_STATUSES in rate and trend calculations
- `api/schedule/attendance.service.js` - All 3 functions (getStudentPrivateLessonStats, getTeacherAttendanceOverview, getStudentAttendanceHistory) filter archived records and use MINISTRY_PRESENT_STATUSES

## Decisions Made
- Soft-delete with isArchived:true preserves attendance history for audit/recovery while hiding from live queries
- Orchestra attendance write path consolidation eliminates duplicate logic -- single source of truth in rehearsal.updateAttendance
- Late status counts as present everywhere for Ministry compliance (MINISTRY_PRESENT_STATUSES includes both 'הגיע/ה' and 'איחור')
- archivedReason distinguishes rehearsal_deleted from orchestra_deleted for potential future restore

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Orchestra removeOrchestra also hard-deleted attendance**
- **Found during:** Task 1
- **Issue:** orchestra.service.js removeOrchestra had a deleteMany on activity_attendance that wasn't mentioned in the plan
- **Fix:** Updated to soft-delete (updateMany + isArchived) with archivedReason: 'orchestra_deleted'
- **Files modified:** api/orchestra/orchestra.service.js
- **Commit:** 17a92b2

**2. [Rule 2 - Missing Critical Functionality] MEMBERSHIP_VALIDATION error not handled in orchestra controller**
- **Found during:** Task 1
- **Issue:** Orchestra controller's updateRehearsalAttendance now delegates to rehearsal service which can throw MEMBERSHIP_VALIDATION, but controller didn't handle it
- **Fix:** Added MEMBERSHIP_VALIDATION error handling returning 400 with invalidStudentIds
- **Files modified:** api/orchestra/orchestra.controller.js
- **Commit:** 17a92b2

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Attendance data layer complete with soft-delete, late handling, and consumer updates
- Ready for 59-03 (frontend integration) to consume updated attendance API
- Frontend should display late count in attendance stats where available

---
*Phase: 59-attendance-data-layer*
*Completed: 2026-03-07*
