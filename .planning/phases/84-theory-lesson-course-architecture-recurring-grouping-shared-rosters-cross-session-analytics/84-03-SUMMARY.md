---
phase: 84-theory-lesson-course-architecture-recurring-grouping-shared-rosters-cross-session-analytics
plan: 03
subsystem: frontend
tags: [theory, course, apiService, frontend, react, real-data, mock-removal]

requires:
  - phase: 84-02
    provides: "8 REST endpoints under /api/theory/courses/* for course CRUD, roster management, and analytics"

provides:
  - "theoryService in apiService.js extended with 8 course methods: getCourses, getCourseById, createCourse, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAnalytics"
  - "TheoryGroupManager wired to real /api/theory/courses API — zero mock data"
  - "Teacher map pattern applied for name enrichment (fetch once, enrich courses)"
  - "Analytics tab shows real per-student attendance rates from getCourseAnalytics"

affects: [theory-frontend, apiService, theory-group-manager]

tech-stack:
  added: []
  patterns:
    - "Teacher map pattern (fetch teachers once, build Record<id, info>, enrich courses) — same as Phase 80"
    - "Student map pattern (fetch students once, build Record<id, GroupStudent>) for enrolled student details"
    - "Optimistic UI update after add/remove student — local state updated immediately after API call"
    - "Non-fatal try/catch for teacher and student map building — course list still loads if enrichment fails"

key-files:
  created: []
  modified:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/theory/TheoryGroupManager.tsx

key-decisions:
  - "getTheoryGroups updated to read from getCourses API — returns empty array when no courses exist instead of grouping lessons client-side"
  - "Student map built from getStudents() for enrollment detail enrichment — same pattern as teacher map"
  - "Analytics tab fetches on tab click (lazy load) rather than on group selection — avoids unnecessary API calls"
  - "loadCourseAnalytics uses non-fatal catch — sets courseAnalytics to null, shows empty state gracefully"
  - "Mock generator functions (generateMockCurriculum, generateMockRequirements, generateMockGrades) fully removed — curriculum: [] and requirements: [] until backend adds those fields"

duration: 8min
completed: 2026-03-26
---

# Phase 84 Plan 03: Frontend API Wiring Summary

**theoryService extended with 8 course API methods and TheoryGroupManager fully rewired from mock lesson-grouped data to real /api/theory/courses endpoints — zero mock data remains**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T11:00:00Z
- **Completed:** 2026-03-26T11:08:00Z
- **Tasks:** 2 (Task 3 is a checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- Extended `theoryService` in `apiService.js` with 8 new methods: getCourses, getCourseById, createCourse, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAnalytics
- Updated `getTheoryGroups` to delegate to the real `getCourses` API endpoint instead of grouping theory_lesson documents client-side
- Rewrote `loadTheoryGroups` in `TheoryGroupManager.tsx` to call `apiService.theory.getCourses()`, build teacher/student enrichment maps, and map course API shape to `TheoryGroup` interface
- Replaced mock `handleEnrollStudent` with `apiService.theory.addStudentToCourse()` call + optimistic local state update
- Replaced mock `handleUnenrollStudent` with `apiService.theory.removeStudentFromCourse()` call + local state update
- Added `loadCourseAnalytics` function and `CourseAnalytics` interface; analytics tab now shows real per-student attendance rates with progress bars
- Removed all mock generator functions: generateMockCurriculum, generateMockRequirements, generateMockGrades

## Task Commits

1. **Task 1: Add theory course API methods to apiService.js** - `bf59edb` (feat)
2. **Task 2: Wire TheoryGroupManager to real course API data** - `22318f5` (feat)

## Files Created/Modified

- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js` — 8 new course methods added to theoryService; getTheoryGroups updated to use getCourses API
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/theory/TheoryGroupManager.tsx` — loadTheoryGroups replaced with real API fetch; mock handlers replaced; analytics tab wired; mock generators removed

## Decisions Made

- `getTheoryGroups` now reads from real course API — returns empty array when no courses exist (instead of grouping lessons). This is the correct behavior: if no courses were created yet, the manager shows an empty state
- Teacher map and student map are built with non-fatal try/catch — course list loads even if teacher/student enrichment fails (graceful degradation)
- Analytics tab loads data lazily on tab click — avoids API call overhead until user actually opens the analytics tab
- `curriculum: []` and `requirements: []` set as defaults — these are aspirational UI fields not yet on the backend course entity

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Added student map for enrollment detail enrichment**
- **Found during:** Task 2
- **Issue:** Plan specified teacher map enrichment, but enrolled students from the course API only have IDs (not names/details). Without enrichment the student list would show blank names
- **Fix:** Built a student map from `getStudents()` alongside the teacher map, with the same non-fatal try/catch pattern
- **Files modified:** TheoryGroupManager.tsx
- **Impact:** Student names, grades, instruments now display correctly in the enrolled students list

**2. [Rule 1 - Bug] Removed mock-data fallback in getTheoryGroups**
- **Found during:** Task 1
- **Issue:** Original plan specified "fall back to client-side grouping" but that would silently hide the empty state and continue showing mock-derived data if the course API returned an empty array
- **Fix:** When getCourses returns empty, getTheoryGroups returns `[]` directly — no fallback to lesson grouping. Empty state is shown, which is correct behavior
- **Files modified:** apiService.js

## Issues Encountered

None beyond deviations documented above.

## User Setup Required

To test the full-stack course feature:
1. Start backend: `npm run dev` in backend repo
2. Run migration: `node scripts/migrate-theory-courses.js`
3. Start frontend: `npm run dev` in frontend repo

## Next Phase Readiness

- Full-stack theory course feature is complete pending human verification (Task 3 checkpoint)
- Backend: 8 endpoints live under /api/theory/courses/*
- Frontend: TheoryGroupManager reads/writes real course data
- Migration script: backfills courseId on existing lessons and creates indexes

---
*Phase: 84-theory-lesson-course-architecture*
*Completed: 2026-03-26*

## Self-Check

- /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js: FOUND (getCourses, getCourseById, createCourse, updateCourse, deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseAnalytics)
- /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/theory/TheoryGroupManager.tsx: FOUND (apiService.theory.getCourses, addStudentToCourse, removeStudentFromCourse, getCourseAnalytics)
- Commit bf59edb (Task 1): FOUND
- Commit 22318f5 (Task 2): FOUND

## Self-Check: PASSED
