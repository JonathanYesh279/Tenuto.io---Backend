---
phase: 41-route-migration
plan: 01
subsystem: auth
tags: [rbac, permissions, route-migration, requirePermission, role-normalization]

# Dependency graph
requires:
  - phase: 40-permission-engine-middleware
    provides: "requirePermission middleware function in auth.middleware.js"
  - phase: 39-rbac-constants
    provides: "DEFAULT_ROLE_PERMISSIONS, ROLE_RENAME_MAP, resolveEffectivePermissions"
provides:
  - "7 core route files using requirePermission instead of requireAuth"
  - "Expanded permission matrix covering all existing access patterns"
  - "Legacy role normalization in buildContext"
affects: [42-route-migration-wave2, admin-routes, analytics-routes]

# Tech tracking
tech-stack:
  added: []
  patterns: ["requirePermission(domain, action) replaces requireAuth(roles[])"]

key-files:
  created: []
  modified:
    - config/permissions.js
    - middleware/tenant.middleware.js
    - api/student/student.route.js
    - api/teacher/teacher.route.js
    - api/file/file.route.js
    - api/orchestra/orchestra.route.js
    - api/rehearsal/rehearsal.route.js
    - api/theory/theory.route.js
    - api/bagrut/bagrut.route.js

key-decisions:
  - "Expanded permission matrix before route migration to prevent 403 regressions"
  - "Role normalization happens in buildContext only — teacher.roles is never mutated"
  - "Bagrut and file routes use students domain since they are student data"
  - "Teacher schedule/lesson routes use schedules domain, not teachers domain"

patterns-established:
  - "requirePermission(domain, action) pattern for all route guards"
  - "Domain matches data type: students, teachers, schedules, orchestras, rehearsals, theory"

# Metrics
duration: 6min
completed: 2026-03-05
---

# Phase 41 Plan 01: Route Migration Summary

**Migrated 7 core route files from requireAuth(roles[]) to requirePermission(domain, action) with expanded permission matrix and legacy role normalization**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T08:45:32Z
- **Completed:** 2026-03-05T08:51:32Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Expanded DEFAULT_ROLE_PERMISSIONS for 3 teaching roles to cover all existing requireAuth access patterns
- Added legacy role normalization in buildContext via ROLE_RENAME_MAP (prevents empty permissions for old role names)
- Migrated all 7 core domain route files: student, teacher, file, orchestra, rehearsal, theory, bagrut
- Zero requireAuth calls remain in migrated files; 98 requirePermission calls across 7 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand DEFAULT_ROLE_PERMISSIONS** - `5156523` (feat)
2. **Task 2: Add legacy role normalization in buildContext** - `af7720f` (feat)
3. **Task 3: Migrate 7 route files to requirePermission** - `18ae10c` (feat)

## Files Created/Modified
- `config/permissions.js` - Expanded permissions for 'מורה', 'ניצוח', 'מדריך הרכב' roles
- `middleware/tenant.middleware.js` - Added ROLE_RENAME_MAP import and role normalization in buildContext
- `api/student/student.route.js` - 9 routes: requirePermission('students', view/create/update/delete)
- `api/teacher/teacher.route.js` - 24 routes: requirePermission('teachers', ...) + requirePermission('schedules', ...)
- `api/file/file.route.js` - 1 route: requirePermission('students', 'view')
- `api/orchestra/orchestra.route.js` - 10 routes: requirePermission('orchestras', ...) + requirePermission('rehearsals', ...)
- `api/rehearsal/rehearsal.route.js` - 11 routes: requirePermission('rehearsals', view/create/update/delete)
- `api/theory/theory.route.js` - 16 routes: requirePermission('theory', view/create/update/delete)
- `api/bagrut/bagrut.route.js` - 20 routes: requirePermission('students', view/create/update/delete)

## Decisions Made
- Expanded permission matrix BEFORE route migration to prevent 403 regressions for teaching-tier roles
- Role normalization happens in buildContext only -- teacher.roles document is never mutated
- Bagrut and file routes mapped to 'students' domain since they are student data
- Teacher schedule/lesson endpoints use 'schedules' domain (not 'teachers') matching data ownership
- Invitation public routes (validate/accept) left unchanged -- they have no auth guard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 7 core domain route files fully migrated to requirePermission
- Remaining route files (admin, analytics, import/export, schedule, etc.) ready for wave 2 migration
- Permission matrix complete for all teaching-tier roles currently in route files

## Self-Check: PASSED

All 9 modified files confirmed on disk. All 3 task commits (5156523, af7720f, 18ae10c) confirmed in git log.

---
*Phase: 41-route-migration*
*Completed: 2026-03-05*
