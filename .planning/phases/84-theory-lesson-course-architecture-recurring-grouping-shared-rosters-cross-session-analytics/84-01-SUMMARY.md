---
phase: 84-theory-lesson-course-architecture-recurring-grouping-shared-rosters-cross-session-analytics
plan: 01
subsystem: api
tags: [theory, course, mongodb, aggregation, validation, migration, joi]

requires:
  - phase: 83-attendance-feature-deep-review
    provides: "Confirmed sessionId field name in activity_attendance, verified 'איחור' as canonical late status in activity_attendance collection"

provides:
  - "theoryCourseService with 9 functions: createCourse, getCourses, getCourseById, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAttendanceAnalytics, linkLessonsToCourse"
  - "theoryCourseSchema and theoryCourseUpdateSchema Joi validation schemas"
  - "validateTheoryCourse and validateTheoryCourseUpdate exported functions"
  - "migrate-theory-courses.js idempotent migration script for backfilling courseId and creating indexes"

affects: [theory-lesson-course-architecture, theory-routes, theory-controller]

tech-stack:
  added: []
  patterns:
    - "Parent entity pattern: theory_course mirrors orchestra/rehearsal parent-child relationship"
    - "Cross-collection roster sync: addStudentToCourse updates course + future lessons + student.enrollments atomically"
    - "Activity attendance aggregation: per-student and per-session stats via two MongoDB aggregate pipelines"
    - "linkLessonsToCourse: post-hoc bulk association of lessons to a course"

key-files:
  created:
    - api/theory/theory-course.service.js
    - scripts/migrate-theory-courses.js
  modified:
    - api/theory/theory.validation.js
    - .gitignore

key-decisions:
  - "Use 'איחור' (not 'איחר/ה') for activity_attendance late status — MINISTRY_PRESENT_STATUSES uses 'איחור', theory.service.js 'איחר/ה' is for the embedded attendance object only"
  - "addStudentToCourse / removeStudentFromCourse use non-fatal try/catch for lesson and student updates — course roster is authoritative, secondary updates are best-effort"
  - "linkLessonsToCourse uses $addToSet with $each for idempotency — safe to call multiple times"
  - "migration script does NOT auto-group existing lessons — user decides grouping via dedicated endpoints"

patterns-established:
  - "Theory course as parent entity: lessonIds[] on course, courseId on lesson — mirrors orchestra/rehearsalIds pattern"
  - "Future-lessons filter uses ISO string date comparison (date: { $gte: nowIso }) — consistent with phase 76-02 decision that activity_attendance dates are ISO strings"

duration: 4min
completed: 2026-03-26
---

# Phase 84 Plan 01: Theory Course Data Layer Summary

**theory_course parent entity with CRUD, shared roster management, cross-session analytics aggregation, and idempotent migration script — follows the proven orchestra-to-rehearsal parent-child pattern**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T09:52:34Z
- **Completed:** 2026-03-26T09:56:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `api/theory/theory-course.service.js` with 9 exported functions covering CRUD, roster management, cross-session attendance analytics, and lesson-to-course linking
- Added `theoryCourseSchema`, `theoryCourseUpdateSchema`, `validateTheoryCourse`, and `validateTheoryCourseUpdate` to `api/theory/theory.validation.js`
- Created idempotent `scripts/migrate-theory-courses.js` that backfills `courseId: null` on existing theory_lesson documents and creates 5 compound indexes on 3 collections

## Task Commits

1. **Task 1: Create theory-course.service.js** - `678d30d` (feat)
2. **Task 2: Add course validation and migration script** - `7e81776` (feat)

## Files Created/Modified

- `api/theory/theory-course.service.js` — 9-function service: createCourse, getCourses, getCourseById, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAttendanceAnalytics, linkLessonsToCourse
- `api/theory/theory.validation.js` — Added theoryCourseSchema, theoryCourseUpdateSchema, validateTheoryCourse, validateTheoryCourseUpdate
- `scripts/migrate-theory-courses.js` — Idempotent migration: courseId backfill + 5 indexes
- `.gitignore` — Whitelisted migrate-theory-courses.js for git tracking

## Decisions Made

- Used 'איחור' (not 'איחר/ה') for activity_attendance analytics — MINISTRY_PRESENT_STATUSES in config/constants.js uses 'איחור'; 'איחר/ה' is only in theory.service.js's embedded attendance object
- addStudentToCourse / removeStudentFromCourse use non-fatal try/catch for lesson and student sync — course is authoritative, secondary updates are best-effort with warn logging
- linkLessonsToCourse uses $addToSet with $each for idempotency — safe to call multiple times
- Migration script does NOT auto-group existing lessons — leaves courseId: null, user decides grouping

## Deviations from Plan

**1. [Rule 3 - Blocking] Added migrate-theory-courses.js to .gitignore whitelist**
- **Found during:** Task 2 commit
- **Issue:** `scripts/*` is gitignored by default; the new migration script was rejected by git add
- **Fix:** Added `!scripts/migrate-theory-courses.js` to .gitignore whitelist alongside the existing `!scripts/create-tenant-indexes.js` entry
- **Files modified:** .gitignore
- **Verification:** `git add scripts/migrate-theory-courses.js` succeeded after whitelist entry
- **Committed in:** 7e81776 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — gitignore whitelist)
**Impact on plan:** Necessary fix to persist the migration script in version control. No scope creep.

## Issues Encountered

None beyond the gitignore fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- theoryCourseService is ready for Plan 02 (route/controller integration)
- validateTheoryCourse / validateTheoryCourseUpdate ready to be imported in theory.controller.js
- Migration script ready to run: `node scripts/migrate-theory-courses.js`
- Plan 02 can add theory-course routes to `api/theory/theory.route.js` and expose the 9 service functions via HTTP endpoints

---
*Phase: 84-theory-lesson-course-architecture*
*Completed: 2026-03-26*

## Self-Check: PASSED

- api/theory/theory-course.service.js: FOUND
- api/theory/theory.validation.js: FOUND
- scripts/migrate-theory-courses.js: FOUND
- Commit 678d30d (Task 1): FOUND
- Commit 7e81776 (Task 2): FOUND
