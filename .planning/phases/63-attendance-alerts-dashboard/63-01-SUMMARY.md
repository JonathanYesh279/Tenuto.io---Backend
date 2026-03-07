---
phase: 63-attendance-alerts-dashboard
plan: 01
subsystem: api
tags: [attendance, alerts, dashboard, mongodb-aggregation, tenant-settings]

# Dependency graph
requires:
  - phase: 59-attendance-input
    provides: activity_attendance collection schema, MINISTRY_PRESENT_STATUSES
  - phase: 60-attendance-stats
    provides: minimumRehearsals threshold pattern, present-status counting convention
provides:
  - DEFAULT_ATTENDANCE_ALERT_SETTINGS constant
  - attendanceAlertService with flagging, dashboard, and student summary
  - 4 REST endpoints at /api/attendance-alerts
  - Tenant settings schema for attendanceAlerts
affects: [63-02 frontend dashboard, future notification system]

# Tech tracking
tech-stack:
  added: []
  patterns: [threshold-based flagging with configurable tenant settings, per-orchestra aggregation dashboard]

key-files:
  created:
    - api/attendance-alerts/attendanceAlert.service.js
    - api/attendance-alerts/attendanceAlert.controller.js
    - api/attendance-alerts/attendanceAlert.route.js
  modified:
    - config/constants.js
    - api/tenant/tenant.validation.js
    - server.js

key-decisions:
  - "Tenant settings.attendanceAlerts defaults to null; service falls back to DEFAULT_ATTENDANCE_ALERT_SETTINGS"
  - "Flagging uses MINISTRY_PRESENT_STATUSES for consistent present counting with Phase 59/60"
  - "Dashboard deduplicates flagged students across orchestras by studentId"

patterns-established:
  - "Configurable alert thresholds: tenant settings override global defaults"
  - "Dual flag conditions: consecutive absences + rate-based thresholds"

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 63 Plan 01: Attendance Alerts Backend Summary

**Configurable attendance alert thresholds in tenant settings with auto-flagging service, admin dashboard aggregation, and student summary endpoints**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T18:35:41Z
- **Completed:** 2026-03-07T18:39:47Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- DEFAULT_ATTENDANCE_ALERT_SETTINGS constant with 4 configurable fields (consecutiveAbsences, absenceRateThreshold, minimumRehearsals, isEnabled)
- Tenant validation schema extended to accept attendanceAlerts in settings for both create and update
- attendanceAlertService with 4 functions: getTenantAlertSettings, evaluateFlaggedStudents, getAttendanceDashboard, getStudentAttendanceSummary
- 4 REST endpoints mounted at /api/attendance-alerts with full middleware chain and RBAC permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add attendance alert settings to tenant schema and constants** - `2210522` (feat)
2. **Task 2: Create attendance alert service with flagging, dashboard, and student summary** - `0b425c7` (feat)
3. **Task 3: Create controller, routes, and mount attendance-alerts module** - `84baeb9` (feat)

## Files Created/Modified
- `config/constants.js` - Added DEFAULT_ATTENDANCE_ALERT_SETTINGS constant
- `api/tenant/tenant.validation.js` - Added attendanceAlerts Joi schema to both tenant schemas
- `api/attendance-alerts/attendanceAlert.service.js` - Threshold evaluation, flagging logic, dashboard aggregation, student summary
- `api/attendance-alerts/attendanceAlert.controller.js` - HTTP handlers for 4 endpoints
- `api/attendance-alerts/attendanceAlert.route.js` - Routes with requirePermission guards
- `server.js` - Mounted attendance-alerts routes with full 6-middleware chain

## Decisions Made
- Tenant settings.attendanceAlerts defaults to null; service falls back to DEFAULT_ATTENDANCE_ALERT_SETTINGS constant
- Flagging uses MINISTRY_PRESENT_STATUSES for consistent present counting (late counts as present)
- Dashboard deduplicates flagged students across orchestras by studentId to avoid double-counting
- absenceRateThreshold is a percentage (30 = 30% absence rate) not an attendance rate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API complete, ready for frontend dashboard implementation
- Tenant alert settings can be configured via existing PUT /api/tenant/:id endpoint

---
*Phase: 63-attendance-alerts-dashboard*
*Completed: 2026-03-07*
