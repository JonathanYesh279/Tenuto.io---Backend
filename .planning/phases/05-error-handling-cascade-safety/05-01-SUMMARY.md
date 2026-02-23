---
phase: 05-error-handling-cascade-safety
plan: 01
subsystem: api
tags: [error-handling, security, tenant-isolation, idor, sanitization]

# Dependency graph
requires:
  - phase: 02-service-layer-query-hardening
    provides: buildScopedFilter, canAccessStudent in utils/queryScoping.js
  - phase: 04-super-admin-allowlist
    provides: enforceTenant middleware and context threading
provides:
  - NotFoundError class in utils/queryScoping.js for typed 404 errors
  - Sanitized error handler that never leaks entity details in 404/500 responses
  - IDOR fix returning 404 instead of 403 for cross-scope student access
  - Controller-level 404 sanitization across 6 controller files
affects: [05-02, 05-03, 05-04, all-controllers]

# Tech tracking
tech-stack:
  added: []
  patterns: [NotFoundError class for typed 404s, generic error messages at controller boundary]

key-files:
  created: []
  modified:
    - utils/queryScoping.js
    - middleware/error.handler.js
    - api/student/student.controller.js
    - api/theory/theory.controller.js
    - api/analytics/attendance.controller.js
    - api/schedule/time-block.controller.js
    - api/admin/cleanup.controller.js
    - api/rehearsal/rehearsal.controller.js

key-decisions:
  - "NotFoundError resourceType is for server-side logging only; clients always get generic message"
  - "IDOR check returns 404 not 403 to prevent cross-tenant resource existence leaks"
  - "Keep 400/401/403 err.message for validation details and role-based checks (intentional user-facing)"
  - "Keep 409 conflict messages (same-tenant scheduling data, not cross-tenant leak)"
  - "Service-layer throw messages untouched for server-side debugging"

patterns-established:
  - "404 responses: always { error: 'Not Found', message: 'The requested resource was not found' }"
  - "500 responses: always { error: 'Internal Server Error', message: 'An unexpected error occurred' }"
  - "IDOR checks: return 404 (not 403) when user lacks access to specific resource"

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 05 Plan 01: Error Response Sanitization Summary

**NotFoundError class, sanitized error handler for 404/500, IDOR 403-to-404 fix, and controller-level error message cleanup across 8 files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T22:17:11Z
- **Completed:** 2026-02-23T22:22:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added NotFoundError class to utils/queryScoping.js for typed 404 error throwing
- Sanitized global error handler to return generic messages for all 404 and 500 responses
- Fixed student IDOR check from 403 to 404 (prevents resource existence leaks across tenants)
- Sanitized 404 and 500 error responses across 6 controller files (25+ occurrences)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NotFoundError class and sanitize error handler** - `eee5f4d` (feat)
2. **Task 2: Fix IDOR 403-to-404 and sanitize controller error patterns** - `8105939` (feat)

## Files Created/Modified
- `utils/queryScoping.js` - Added NotFoundError class (exported, statusCode 404)
- `middleware/error.handler.js` - Sanitized NotFoundError case, statusCode 404 fallback, and default 500 handler
- `api/student/student.controller.js` - Fixed IDOR 403 to 404, sanitized updateStudentTest 500 response
- `api/theory/theory.controller.js` - Sanitized 7 not-found catch blocks, 6 INTERNAL_SERVER_ERROR calls
- `api/analytics/attendance.controller.js` - Sanitized 3 not-found blocks, 7 status-500 responses
- `api/schedule/time-block.controller.js` - Sanitized 10 not-found blocks, 10 status-500 responses
- `api/admin/cleanup.controller.js` - Sanitized 3 not-found blocks, 1 transaction error, 1 preview failure
- `api/rehearsal/rehearsal.controller.js` - Sanitized bulkCreateRehearsals 500 response

## Decisions Made
- NotFoundError constructor accepts resourceType for server-side logging; error handler always returns generic message to client
- Student IDOR returns 404 (not 403) to prevent cross-tenant resource existence confirmation
- Kept 400 validation err.message (user-facing details), 401/403 err.message (role-based checks), and 409 conflict messages
- Service-layer throw statements left untouched (debugging preserved at service boundary)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed updateStudentTest leaking err.message and stack trace in 500 response**
- **Found during:** Task 2 (student controller sanitization)
- **Issue:** updateStudentTest returned `{ error: err.message, stack: ... }` in 500 response, leaking internal details
- **Fix:** Replaced with generic `{ error: 'Internal Server Error', message: 'An unexpected error occurred' }`
- **Files modified:** api/student/student.controller.js
- **Verification:** Grep confirms no err.message in 500 response bodies
- **Committed in:** 8105939 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Sanitized 500 responses across all 6 controllers**
- **Found during:** Task 2 (controller sanitization sweep)
- **Issue:** Plan focused on 404 err.message patterns, but 500 responses also leaked err.message in attendance, time-block, theory, cleanup, and rehearsal controllers
- **Fix:** Replaced all `res.status(500).json({ error: err.message })` with generic messages
- **Files modified:** All 6 controller files
- **Verification:** Grep confirms no err.message in 500 response bodies of modified controllers
- **Committed in:** 8105939 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Sanitized cleanup controller deletion preview error responses**
- **Found during:** Task 2 (cleanup controller sanitization)
- **Issue:** getStudentDeletionPreview passed `result.error` (service error message) and `err.message` to client in 404/500 responses
- **Fix:** Replaced with generic not-found and error messages
- **Files modified:** api/admin/cleanup.controller.js
- **Verification:** Grep confirms no raw error messages in 404/500 responses
- **Committed in:** 8105939 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for security. Extending 500 sanitization beyond the plan's 404 focus was essential to prevent information leakage. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error sanitization complete, ready for 05-02 (cascade deletion safety)
- NotFoundError class available for use in future service-layer improvements
- All controller 404/500 responses now follow consistent generic message pattern

---
*Phase: 05-error-handling-cascade-safety*
*Completed: 2026-02-24*
