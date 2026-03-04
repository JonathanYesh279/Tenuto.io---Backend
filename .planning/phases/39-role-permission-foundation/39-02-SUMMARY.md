---
phase: 39-role-permission-foundation
plan: 02
subsystem: auth
tags: [rbac, permissions, middleware, admin-tier, buildContext]

# Dependency graph
requires:
  - phase: 39-01
    provides: "ADMIN_TIER_ROLES, COORDINATOR_ROLES, DEFAULT_ROLE_PERMISSIONS, resolveEffectivePermissions"
provides:
  - "authenticateToken uses ADMIN_TIER_ROLES for admin detection (not just מנהל)"
  - "req.context.effectivePermissions populated from tenant.rolePermissions or DEFAULT_ROLE_PERMISSIONS fallback"
  - "req.context.isCoordinator and req.context.coordinatorDepartments for coordinator-tier teachers"
  - "req.context.isAdmin uses ADMIN_TIER_ROLES check (not hardcoded מנהל)"
affects: [40-permission-engine, 41-route-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin-tier-detection, permission-resolution-in-middleware, coordinator-detection]

key-files:
  created: []
  modified:
    - middleware/auth.middleware.js
    - middleware/tenant.middleware.js
    - utils/queryScoping.js

key-decisions:
  - "isAdminTier helper function kept private (not exported) in auth.middleware -- only used internally"
  - "buildContext does a separate DB query for tenant.rolePermissions (small projection by _id) -- acceptable overhead, will be optimized later"
  - "Silently falls back to DEFAULT_ROLE_PERMISSIONS on DB error (log.warn, no 500)"

patterns-established:
  - "Admin-tier detection via ADMIN_TIER_ROLES.includes() replaces all hardcoded מנהל checks in middleware"
  - "effectivePermissions computed once per request in buildContext, available on req.context for downstream use"

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 39 Plan 02: Middleware Admin-Tier and Permission Resolution Summary

**Updated auth/tenant middleware to detect all admin-tier roles and populate req.context.effectivePermissions from tenant.rolePermissions with DEFAULT_ROLE_PERMISSIONS fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T23:30:21Z
- **Completed:** 2026-03-04T23:32:09Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Replaced all hardcoded `includes('מנהל')` checks in auth.middleware.js with `isAdminTier()` using ADMIN_TIER_ROLES
- Added `isAdminTier` helper function to auth.middleware.js for consistent admin detection
- Updated buildContext in tenant.middleware.js to load tenant.rolePermissions from DB and resolve effectivePermissions
- Added coordinatorDepartments and isCoordinator to req.context for coordinator-tier teachers
- Updated queryScoping.js with ADMIN_TIER_ROLES import and JSDoc documenting upstream dependency
- All admin-tier roles (מנהל, סגן מנהל, מזכירות) now get `isAdmin: true` in both req.user and req.context

## Task Commits

Each task was committed atomically:

1. **Task 1: Update auth middleware and buildContext to use admin-tier roles and resolve effective permissions** - `9fc86d6` (feat)

## Files Modified
- `middleware/auth.middleware.js` - Added ADMIN_TIER_ROLES import, isAdminTier() helper, replaced 3 hardcoded מנהל checks
- `middleware/tenant.middleware.js` - Added ObjectId/ADMIN_TIER_ROLES/COORDINATOR_ROLES/permissions imports, tenant rolePermissions DB query, effectivePermissions/isCoordinator/coordinatorDepartments in req.context
- `utils/queryScoping.js` - Added ADMIN_TIER_ROLES import and JSDoc note documenting upstream isAdmin dependency

## Decisions Made
- isAdminTier helper kept as private function in auth.middleware (not exported) -- only used internally for two checks
- buildContext queries tenant collection separately for rolePermissions (small indexed projection by _id) -- acceptable overhead until Phase 40 optimization
- DB errors during tenant.rolePermissions fetch silently fall back to DEFAULT_ROLE_PERMISSIONS with log.warn (no 500 error to client)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- req.context.effectivePermissions ready for Phase 40 requirePermission() middleware
- Admin-tier roles (סגן מנהל, מזכירות) now immediately treated as admin across all existing routes
- Coordinator detection ready for Phase 40 department-scoped permission checks
- No breaking changes to existing requireAuth behavior -- fully backward compatible

## Self-Check: PASSED

All 3 modified files verified on disk. Task commit (9fc86d6) found in git log.

---
*Phase: 39-role-permission-foundation*
*Completed: 2026-03-05*
