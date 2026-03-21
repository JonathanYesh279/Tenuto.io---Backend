---
phase: 81-schedule-single-source-of-truth
plan: 02
subsystem: frontend
tags: [schedule, react-query, live-data, refactor]

requires:
  - phase: 81-schedule-single-source-of-truth
    plan: 01
    provides: GET /api/student/:studentId/weekly-schedule endpoint
provides:
  - useStudentScheduleData React Query hook
  - Refactored ScheduleTab consuming live backend data
affects: [student-details-page]

tech-stack:
  added: []
  patterns:
    - "React Query hook wrapping single backend endpoint"
    - "Data transformation in useMemo for grid component consumption"

key-files:
  created:
    - src/features/students/details/hooks/useStudentScheduleData.ts
  modified:
    - src/features/students/details/components/tabs/ScheduleTab.tsx
    - src/services/apiService.js
    - src/services/studentDetailsApi.ts
    - src/features/students/details/components/StudentDetailsPageSimple.tsx
    - src/features/students/details/components/StudentTabContent.tsx
    - src/features/students/details/components/StudentDetailsPageOptimized.tsx
    - src/features/students/details/components/StudentDetailsPage.tsx

key-decisions:
  - "Switch from studentDetailsApi to apiService for auth token reliability"
  - "studentDetailsApi singleton cached token at construction — caused 401s after login"
  - "Single useQuery call replaces 3 parallel useEffect blocks with N+1 teacher fetches"
  - "student prop removed from ScheduleTab (all data comes from hook)"
  - "30s staleTime for schedule data — reasonable for infrequently changing data"

patterns-established:
  - "Use apiService (not studentDetailsApi) for new student endpoint integrations"

duration: 8min
completed: 2026-03-22
---

# Phase 81 Plan 02: Frontend ScheduleTab Refactor Summary

**Refactored ScheduleTab from stale snapshot reads to live backend data via single API call**

## Performance

- **Duration:** 8 min (including debugging auth token issue)
- **Tasks:** 2 (1 auto + 1 human verification checkpoint)
- **Files modified:** 8

## Accomplishments
- Created useStudentScheduleData React Query hook consuming weekly-schedule endpoint
- Removed all 3 useEffect blocks, all useState for teacher/orchestra/theory data
- Removed all hardcoded fallback times ('14:30', '15:15', dayOfWeek ?? 2)
- Removed all scheduleInfo snapshot reads
- Removed student prop from ScheduleTab (updated 4 call sites)
- Fixed auth token issue: switched from studentDetailsApi to apiService

## Task Commits

1. **Task 1: Create hook and refactor ScheduleTab** - `4535434` (feat)
2. **Auth fix: Switch to apiService** - `32efcaa` (fix)

## Debugging: Auth Token Issue

Initial implementation used `studentDetailsApi` which is a singleton class that caches the auth token at construction time. Since the module loads before login, `this.token` was null and all requests returned 401. Fixed by switching to `apiService` which reads the token from localStorage on every request. Also fixed `studentDetailsApi.getHeaders()` to re-read token from storage as a defensive measure.

## Deviations from Plan

- **API client change:** Plan specified using `studentDetailsApi.getStudentSchedule()`. Changed to `apiService.getStudentWeeklySchedule()` because studentDetailsApi had a stale token bug. Added the method to apiService.

## Issues Encountered

- **studentDetailsApi stale token:** Singleton created at module load cached null token. All requests failed with 401 silently (React Query swallowed errors, showed empty state).

---
*Phase: 81-schedule-single-source-of-truth*
*Completed: 2026-03-22*
