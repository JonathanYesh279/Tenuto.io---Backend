---
phase: 40-permission-engine-middleware
plan: 01
subsystem: auth
tags: [rbac, permissions, middleware, scoping, department-filter]

# Dependency graph
requires:
  - phase: 39-01
    provides: "LOCKED_DOMAINS, DOMAIN_ACTIONS, DEFAULT_ROLE_PERMISSIONS, resolveEffectivePermissions"
  - phase: 39-02
    provides: "req.context.effectivePermissions, req.context.coordinatorDepartments, req.context.isAdmin"
provides:
  - "requirePermission(domain, action) middleware exported from auth.middleware.js"
  - "req.permissionScope set to 'all', 'department', or 'own' on authorized requests"
  - "buildScopedFilter with scope parameter for department-based student instrument filtering"
  - "canAccessStudent with scope parameter for scope-aware access checks"
affects: [41-route-migration, 42-admin-provisioning, 43-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [permission-middleware-factory, scope-parameter-propagation, department-instrument-filtering]

key-files:
  created: []
  modified:
    - middleware/auth.middleware.js
    - utils/queryScoping.js

key-decisions:
  - "requirePermission checks LOCKED_DOMAINS before effectivePermissions -- non-admins blocked from settings/roles regardless of tenant customization"
  - "buildScopedFilter department scope filters students by personalInfo.instrument (single string field, not array)"
  - "canAccessStudent returns true for department scope -- list-level filtering is handled by buildScopedFilter, not individual ID checks"
  - "Department scope with empty coordinatorDepartments falls back to own-scope behavior"

patterns-established:
  - "Permission middleware factory: requirePermission(domain, action) returns async middleware that sets req.permissionScope"
  - "Scope propagation: req.permissionScope passed to buildScopedFilter(collection, filter, context, scope) for query scoping"
  - "Backward compatibility: scope parameter defaults to null, preserving existing isAdmin-based logic for legacy callers"

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 40 Plan 01: Permission Engine Middleware Summary

**requirePermission(domain, action) middleware with locked-domain enforcement and department-scoped query filtering via getInstrumentsByDepartment**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T02:09:31Z
- **Completed:** 2026-03-05T02:11:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created requirePermission middleware factory that reads req.context.effectivePermissions and sets req.permissionScope
- Enforced LOCKED_DOMAINS (settings, roles) for non-admin roles before checking effectivePermissions
- Extended buildScopedFilter with optional scope parameter supporting 'all', 'department', and 'own' modes
- Department scope filters students by instruments matching coordinator's departments via getInstrumentsByDepartment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create requirePermission middleware** - `16375d6` (feat)
2. **Task 2: Extend buildScopedFilter for department scope** - `6d22f8a` (feat)

## Files Modified
- `middleware/auth.middleware.js` - Added requirePermission(domain, action) middleware factory with LOCKED_DOMAINS import, auth check, context check, locked domain enforcement, permission scope check, and error handling
- `utils/queryScoping.js` - Added getInstrumentsByDepartment import, scope parameter to buildScopedFilter with department filtering, scope parameter to canAccessStudent

## Decisions Made
- requirePermission checks LOCKED_DOMAINS before effectivePermissions -- even if tenant rolePermissions were tampered, non-admins cannot access settings/roles
- buildScopedFilter department scope filters students by `personalInfo.instrument` (single string field) since students store one primary instrument
- canAccessStudent returns true for department scope -- department-level filtering is handled at the query level by buildScopedFilter, not individual ID checks
- Department scope with empty/missing coordinatorDepartments gracefully falls back to own-scope behavior
- Orchestra/rehearsal collections have no department-based instrument filter under department scope (coordinators see all within tenant)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- requirePermission ready for Phase 41 route migration (replace requireAuth calls with requirePermission)
- buildScopedFilter scope parameter ready for controllers to pass req.permissionScope
- canAccessStudent scope parameter ready for individual access checks in controllers
- All existing code continues to work unchanged (requireAuth preserved, buildScopedFilter defaults to null scope)

## Self-Check: PASSED

All 2 modified files verified on disk. Both task commits (16375d6, 6d22f8a) found in git log.

---
*Phase: 40-permission-engine-middleware*
*Completed: 2026-03-05*
