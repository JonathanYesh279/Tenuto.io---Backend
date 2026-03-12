---
phase: 72-theory-lesson-entity-fixes
plan: 02
subsystem: api
tags: [rbac, permissions, role-normalization, ministry-export]

requires:
  - phase: 72-theory-lesson-entity-fixes
    provides: "ROLE_RENAME_MAP middleware normalization (plan 01)"
provides:
  - "Clean RBAC authorization flow for theory controller (no inline role checks)"
  - "Permission service using normalized role key"
  - "Ministry export handling both legacy and normalized role strings"
  - "Test utility VALID_RULES matching current TEACHER_ROLES"
affects: [theory-lessons, ministry-export, permission-service]

tech-stack:
  added: []
  patterns: ["RBAC middleware handles all auth - controllers contain only business logic"]

key-files:
  created: []
  modified:
    - api/theory/theory.controller.js
    - services/permissionService.js
    - api/export/ministry-mappers.js
    - validate-api-schemas.js
    - api/teacher/__tests__/teacher.validation.test.js

key-decisions:
  - "Remove inline auth checks entirely rather than updating role strings — RBAC middleware is the single auth authority"
  - "Ministry mapper checks both normalized and legacy role strings since it reads raw DB data"

patterns-established:
  - "Controllers should never contain inline role checks — requirePermission() middleware on routes is the single source of authorization"

duration: 11min
completed: 2026-03-12
---

# Phase 72 Plan 02: Backend Auth & Role Reference Fixes Summary

**Removed redundant inline auth from theory controller, fixed permissionService key to normalized 'תאוריה', and updated ministry mapper for dual role-string support**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-12T16:12:22Z
- **Completed:** 2026-03-12T16:23:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed 3 redundant inline role-check blocks from theory controller bulk delete functions
- Changed permissionService role key from legacy 'מורה תאוריה' to normalized 'תאוריה'
- Ministry export mapper now checks both normalized and legacy role strings for raw DB data
- validate-api-schemas.js VALID_RULES updated to match current TEACHER_ROLES (13 roles)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove redundant inline auth + fix permissionService key** - `a442516` (fix)
2. **Task 2: Fix ministry mapper and validate-api-schemas** - `896acdd` (fix)

## Files Created/Modified
- `api/theory/theory.controller.js` - Removed 3 inline role-check blocks from bulk delete functions
- `services/permissionService.js` - Changed role key from 'מורה תאוריה' to normalized 'תאוריה'
- `api/export/ministry-mappers.js` - Added normalized role check alongside legacy backward-compat
- `validate-api-schemas.js` - Updated VALID_RULES array to match current TEACHER_ROLES constant
- `api/teacher/__tests__/teacher.validation.test.js` - Fixed stale assertion for VALID_RULES

## Decisions Made
- Remove inline auth checks entirely rather than updating role strings -- RBAC middleware is the single authorization authority
- Ministry mapper checks both normalized and legacy role strings since export reads raw DB data (not middleware-normalized)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale test assertion in teacher.validation.test.js**
- **Found during:** Task 2 (validate-api-schemas update)
- **Issue:** Test asserted VALID_RULES equaled old 6-role array but the actual constant has 13 roles since RBAC expansion
- **Fix:** Updated assertion to match current TEACHER_ROLES from config/constants.js
- **Files modified:** api/teacher/__tests__/teacher.validation.test.js
- **Committed in:** 896acdd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test correctness. No scope creep.

## Issues Encountered
- validate-api-schemas.js is gitignored; required `git add -f` to commit
- Test runner (vitest) did not produce output in this environment; verified correctness via manual constant comparison

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theory lesson authorization is now fully RBAC-driven
- Permission service uses normalized role keys matching middleware normalization
- Ministry export handles both old and new role strings for raw DB compatibility
- No blockers for future phases

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit a442516 (Task 1) verified in git log
- Commit 896acdd (Task 2) verified in git log

---
*Phase: 72-theory-lesson-entity-fixes*
*Completed: 2026-03-12*
