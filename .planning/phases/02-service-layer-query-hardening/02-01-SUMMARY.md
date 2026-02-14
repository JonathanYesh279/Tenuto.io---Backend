---
phase: 02-service-layer-query-hardening
plan: 01
subsystem: infra
tags: [multi-tenant, middleware, security, tenant-isolation, express]

# Dependency graph
requires:
  - phase: 01-audit-infrastructure
    provides: "Query inventory, enforcement checklist, compound tenant indexes"
provides:
  - "Hardened buildScopedFilter with TENANT_GUARD throw on null tenantId"
  - "enforceTenant middleware applied to all 15 data-access route groups"
  - "Tenant-scoped buildContext student access query"
  - "Tenant-scoped addSchoolYearToRequest school year lookup (IDOR fix)"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, service-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [TENANT_GUARD fail-fast, enforceTenant route-level defense-in-depth]

key-files:
  created: []
  modified:
    - utils/queryScoping.js
    - server.js
    - middleware/tenant.middleware.js
    - middleware/school-year.middleware.js

key-decisions:
  - "buildScopedFilter throws instead of silently skipping null tenantId (fail-fast over silent failure)"
  - "enforceTenant placed between buildContext and addSchoolYearToRequest in middleware chain"
  - "Admin/auth/super-admin/health/files/tenant/config routes exempt from enforceTenant"
  - "Student access query conditional on teacher.tenantId existence (backward compat)"
  - "School year IDOR fix uses req.context.tenantId with fallback to req.teacher.tenantId"

patterns-established:
  - "TENANT_GUARD: All tenant-required utilities throw with 'TENANT_GUARD:' prefix on missing tenantId"
  - "enforceTenant middleware: Route-level tenant enforcement as defense-in-depth layer"
  - "Conditional tenantId filter: Only add tenantId to filter if it exists (backward compat during migration)"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 02 Plan 01: Infrastructure Query Hardening Summary

**Fail-fast TENANT_GUARD in buildScopedFilter, enforceTenant on all 15 data routes, tenant-scoped buildContext and school year IDOR fix**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T23:26:48Z
- **Completed:** 2026-02-14T23:29:09Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- buildScopedFilter now throws `TENANT_GUARD` error instead of silently skipping null tenantId
- enforceTenant middleware applied to all 15 data-access route groups with comment documenting exempt routes
- buildContext student access query scoped by teacher.tenantId (prevents cross-tenant student ID loading)
- addSchoolYearToRequest school year lookup scoped by tenantId (fixes IDOR vulnerability)

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden buildScopedFilter to throw on null tenantId** - `b56368d` (feat)
2. **Task 2: Add enforceTenant middleware to all data-access routes** - `431f9c4` (feat)
3. **Task 3: Fix tenant scoping in buildContext and addSchoolYearToRequest** - `dd73705` (feat)

## Files Created/Modified
- `utils/queryScoping.js` - Hardened buildScopedFilter with TENANT_GUARD throw on null tenantId
- `server.js` - enforceTenant imported and applied to 15 data-access route groups with exemption comments
- `middleware/tenant.middleware.js` - buildContext student access query now includes tenantId filter
- `middleware/school-year.middleware.js` - School year ID lookup now tenant-scoped (IDOR fix)

## Decisions Made
- buildScopedFilter throws instead of silently skipping null tenantId -- fail-fast is safer than silent skip since downstream code assumes tenant isolation
- enforceTenant placed between buildContext and addSchoolYearToRequest -- must have context built first, but should reject before school year lookup
- Student access query tenantId filter is conditional on teacher.tenantId existence -- avoids breaking edge cases where tenantId is not yet set (enforceTenant catches this upstream)
- School year IDOR fix uses req.context.tenantId with fallback to req.teacher.tenantId -- req.context is preferred (set by buildContext which runs first in chain) but fallback ensures backward compat

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Infrastructure hardening complete -- all subsequent service plans (02-02 through 02-08) can now rely on:
  - buildScopedFilter throwing on missing tenantId (no silent skips)
  - enforceTenant blocking requests without tenant context at the route level
  - buildContext providing tenant-scoped student access lists
  - addSchoolYearToRequest preventing school year IDOR
- Services can safely adopt `buildScopedFilter(collection, filter, req.context)` knowing it will fail-fast if context is missing

## Self-Check: PASSED

- All 4 modified files exist on disk
- All 3 task commits verified in git log (b56368d, 431f9c4, dd73705)
- SUMMARY.md created successfully

---
*Phase: 02-service-layer-query-hardening*
*Completed: 2026-02-14*
