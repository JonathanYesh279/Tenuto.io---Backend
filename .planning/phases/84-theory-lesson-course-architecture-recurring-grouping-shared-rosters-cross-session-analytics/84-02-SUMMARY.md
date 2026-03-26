---
phase: 84-theory-lesson-course-architecture-recurring-grouping-shared-rosters-cross-session-analytics
plan: 02
subsystem: api
tags: [theory, course, routes, controller, middleware, validation, bulk-create]

requires:
  - phase: 84-01
    provides: "theoryCourseService with 9 functions, validateTheoryCourse / validateTheoryCourseUpdate Joi schemas"

provides:
  - "8 REST endpoints under /api/theory/courses/* for course CRUD, roster management, and analytics"
  - "theory.controller.js extended with 8 course controller functions delegating to theoryCourseService"
  - "middleware/theoryValidation.js extended with validateCourseCreate and validateCourseUpdate"
  - "bulkCreateTheoryLessons enhanced with optional createCourse: true flag (backward compatible)"

affects: [theory-routes, theory-controller, theory-service, theory-validation, theory-middleware]

tech-stack:
  added: []
  patterns:
    - "Dynamic import() for theoryCourseService inside bulkCreate — avoids circular dependency, same pattern as Phase 73/74"
    - "Course routes registered before /:id wildcard to prevent Express param shadowing"
    - "Non-fatal linkLessonsToCourse after bulk insert — lessons are authoritative, course linkage is best-effort"

key-files:
  created: []
  modified:
    - api/theory/theory.controller.js
    - api/theory/theory.route.js
    - api/theory/theory.service.js
    - api/theory/theory.validation.js
    - middleware/theoryValidation.js

key-decisions:
  - "Course routes placed BEFORE /:id routes in theory.route.js — prevents 'courses' string matching /:id param"
  - "Dynamic import() for theoryCourseService in bulkCreate — same circular-dependency-safe pattern as Phase 73"
  - "linkLessonsToCourse failure is non-fatal — logged as error but bulk operation still succeeds"
  - "courseId: null stamped on every lesson document even when no course — explicit over implicit"

duration: 5min
completed: 2026-03-26
---

# Phase 84 Plan 02: Course API Routes & Enhanced BulkCreate Summary

**8 course REST endpoints wired to theoryCourseService, and bulkCreateTheoryLessons enhanced with optional createCourse: true flag that atomically creates a parent course and links all generated lessons**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T10:00:37Z
- **Completed:** 2026-03-26T10:05:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended `api/theory/theory.controller.js` with 8 course controller functions: getCourses, getCourseById, createCourse, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAttendanceAnalytics
- Added 8 course routes under `/api/theory/courses/*` in `theory.route.js`, placed before existing `/:id` routes to prevent Express param conflicts
- Added `validateCourseCreate` and `validateCourseUpdate` middleware to `middleware/theoryValidation.js` using dynamic import of Joi schemas from theory.validation.js
- Enhanced `bulkCreateTheoryLessons` in `theory.service.js` to create a parent course entity when `createCourse: true` is passed, stamp each lesson with `courseId`, and link all lessons to the course via `linkLessonsToCourse` after insertion
- Added `createCourse: Joi.boolean().default(false)` to `theoryBulkCreateSchema` in `theory.validation.js`

## Task Commits

1. **Task 1: Add course controller functions and routes** - `35cdb35` (feat)
2. **Task 2: Enhance bulkCreateTheoryLessons with optional course creation** - `f8794e5` (feat)

## Files Created/Modified

- `api/theory/theory.controller.js` — Import theoryCourseService, export 8 new course controller functions, added to theoryController export object
- `api/theory/theory.route.js` — Import validateCourseCreate/validateCourseUpdate, 8 course routes registered before /:id wildcard
- `api/theory/theory.service.js` — bulkCreateTheoryLessons: dynamic import theoryCourseService, createCourse before insertion, stamp courseId on each lesson, linkLessonsToCourse after insertion, return courseId in result
- `api/theory/theory.validation.js` — Added `createCourse: Joi.boolean().default(false)` to theoryBulkCreateSchema
- `middleware/theoryValidation.js` — Added validateCourseCreate and validateCourseUpdate using dynamic import of Joi validators, exported both

## Decisions Made

- Course routes placed BEFORE `/:id` routes in theory.route.js — 'courses' as a static segment must be declared before the `:id` dynamic segment or Express will treat "courses" as an ID value
- Dynamic `import()` for theoryCourseService in bulkCreate — avoids circular dependency (theory.service.js and theory-course.service.js are siblings), same pattern established in Phase 73
- `linkLessonsToCourse` failure after bulk insert is non-fatal — the important invariant is that lessons exist and each has `courseId` stamped; the course's `lessonIds[]` array is a convenience cache, not authoritative
- All lesson documents receive `courseId: null` even when no course is created — explicit null is more predictable than a missing field for downstream consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- All 8 `/api/theory/courses/*` endpoints are live and operational
- bulkCreate with `createCourse: true` creates course + lessons in one request
- Plan 03 (frontend integration) can use: GET /api/theory/courses, POST /api/theory/courses, GET /api/theory/courses/:id/analytics, POST /api/theory/bulk-create with createCourse: true

---
*Phase: 84-theory-lesson-course-architecture*
*Completed: 2026-03-26*

## Self-Check: PASSED

- api/theory/theory.controller.js: FOUND (getCourses, createCourse, getCourseAttendanceAnalytics: true, 24 total exports)
- api/theory/theory.route.js: FOUND
- api/theory/theory.service.js: FOUND (createCourse logic, linkLessonsToCourse call)
- api/theory/theory.validation.js: FOUND (createCourse: Joi.boolean().default(false))
- middleware/theoryValidation.js: FOUND (validateCourseCreate, validateCourseUpdate)
- Commit 35cdb35 (Task 1): FOUND
- Commit f8794e5 (Task 2): FOUND
