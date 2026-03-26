---
phase: 85-theory-course-gap-closure
plan: 01
subsystem: api
tags: [mongodb, aggregation, theory, courses, auto-grouping]

# Dependency graph
requires:
  - phase: 84-theory-lesson-course-architecture
    provides: "theory_course collection, theoryCourseService with createCourse/linkLessonsToCourse"
provides:
  - "POST /api/theory/courses/auto-group endpoint (dryRun + execute modes)"
  - "POST /api/theory/courses/:id/link-lessons REST endpoint"
  - "autoGroupLessons service function with MongoDB aggregation pipeline"
affects: [85-02, 85-03, frontend-theory-course-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["MongoDB aggregation pipeline for schedule fingerprint grouping", "dryRun preview mode before destructive operations"]

key-files:
  created: []
  modified:
    - api/theory/theory-course.service.js
    - api/theory/theory.controller.js
    - api/theory/theory.route.js

key-decisions:
  - "Auto-group uses 5-field schedule fingerprint: category/teacherId/dayOfWeek/startTime/endTime"
  - "Singletons (1 lesson) skipped by default (minLessonCount=2)"
  - "Course studentIds computed as union of all grouped lessons' studentIds via Set"

patterns-established:
  - "dryRun parameter pattern: same endpoint, boolean flag toggles preview vs execute"

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 85 Plan 01: Auto-Group & Link-Lessons API Summary

**MongoDB aggregation-based auto-grouping of ungrouped theory lessons into courses by schedule fingerprint, plus REST endpoint for manual lesson-to-course linking**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T12:10:52Z
- **Completed:** 2026-03-26T12:18:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- autoGroupLessons service function with aggregation pipeline groups ungrouped lessons by category/teacher/day/time
- dryRun mode returns discovered groups without creating courses; execute mode creates courses and links lessons
- linkLessonsToCourse exposed as REST endpoint (previously service-only)
- Route ordering ensures auto-group is matched before parameterized /:id routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add autoGroupLessons to theory-course.service.js** - `0e02c24` (feat)
2. **Task 2: Add auto-group and link-lessons controller functions and routes** - `651c3c9` (feat)

## Files Created/Modified
- `api/theory/theory-course.service.js` - Added _unionStudentIds helper and autoGroupLessons function (10 total exports)
- `api/theory/theory.controller.js` - Added autoGroupLessons and linkLessonsToCourse controller functions (26 total exports)
- `api/theory/theory.route.js` - Added POST /courses/auto-group and POST /courses/:id/link-lessons routes

## Decisions Made
- Auto-group uses 5-field schedule fingerprint (category/teacherId/dayOfWeek/startTime/endTime) for grouping
- Singletons skipped by default (minLessonCount=2) to avoid creating courses for one-off lessons
- Course studentIds computed as Set union of all grouped lessons' studentIds arrays
- auto-group route placed before parameterized /:id routes (same Express ordering principle as Phase 84-02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auto-group and link-lessons endpoints ready for frontend wiring (Plan 85-02/85-03)
- Endpoints callable: POST /api/theory/courses/auto-group and POST /api/theory/courses/:id/link-lessons

---
*Phase: 85-theory-course-gap-closure*
*Completed: 2026-03-26*
