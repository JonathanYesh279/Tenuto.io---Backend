---
phase: 06-testing-verification
plan: 01
subsystem: testing
tags: [vitest, mongodb-memory-server, tenant-isolation, jwt, express, supertest]

# Dependency graph
requires:
  - phase: 02-service-layer-query-hardening
    provides: buildScopedFilter, enforceTenant middleware chain, tenant-scoped services
  - phase: 03-write-protection-validation
    provides: stripTenantId middleware
  - phase: 04-super-admin-allowlist
    provides: crossTenantAllowlist, validateAllowlist
provides:
  - Dedicated vitest config for tenant isolation tests (no global mocks)
  - MMS lifecycle manager with patchMongoDBService for real DB testing
  - Two-tenant seed fixtures covering all 11 tenant-scoped collections
  - Express test app builder with real middleware chain
  - JWT minting helper for authenticated test requests
  - npm scripts: test:tenant-isolation, test:ci
affects: [06-02, 06-03, 06-04, 06-05]

# Tech tracking
tech-stack:
  added: [bcryptjs (test fixtures)]
  patterns: [patchMongoDBService-before-import, real-middleware-integration-testing]

key-files:
  created:
    - vitest.config.tenant-isolation.js
    - test/tenant-isolation/setup.js
    - test/tenant-isolation/fixtures/two-tenant-seed.js
    - test/tenant-isolation/helpers/test-app.js
    - test/tenant-isolation/helpers/token.js
  modified:
    - package.json

key-decisions:
  - "bcryptjs over bcrypt for seed fixtures (pure JS, no native ELF binary issues across Windows/WSL)"
  - "patchMongoDBService must be called BEFORE any app module imports (ESM static resolution)"
  - "No setupFiles in vitest config (avoids global test/setup.js mocking tenant guards)"
  - "test-app.js uses real middleware chain matching server.js (not mocked)"
  - "git add -f for test-app.js (gitignore test-*.js pattern targets root throwaway scripts)"

patterns-established:
  - "patchMongoDBService(db) -> dynamic import: Mock DB service before importing app modules for real middleware testing"
  - "tenantChain spread pattern: const tenantChain = [authenticateToken, buildContext, enforceTenant, stripTenantId, addSchoolYearToRequest]"
  - "Stable ObjectIds at module level for cross-test reference consistency"

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 6 Plan 01: Test Infrastructure Summary

**Tenant isolation test scaffold with MMS lifecycle, two-tenant seed fixtures covering 11 collections, and real-middleware Express app builder**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T23:21:19Z
- **Completed:** 2026-02-23T23:26:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Vitest config with process isolation (pool: forks) and no global mocks that would bypass tenant guards
- MMS lifecycle manager with tenantId compound indexes on all 11 collections
- Comprehensive two-tenant seed data (Tenant A: Ra'anana, Tenant B: Rishon) with teachers, students, orchestras, rehearsals, theory lessons, bagrut, school years, hours summaries, attendance, import logs, and ministry report snapshots
- Express app builder that mirrors server.js middleware chain (authenticateToken -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest)
- JWT token minting helper for authenticated test requests
- npm scripts for running tenant isolation tests and CI pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vitest config, MMS setup, and seed fixtures** - `8fbc885` (feat)
2. **Task 2: Create test app builder, token helper, and npm scripts** - `fb04f1d` (feat)

## Files Created/Modified
- `vitest.config.tenant-isolation.js` - Dedicated vitest config with no setupFiles, pool:forks, test env vars
- `test/tenant-isolation/setup.js` - MMS lifecycle: setupTenantIsolationDB, teardownTenantIsolationDB, resetCollections, getTestDb, patchMongoDBService
- `test/tenant-isolation/fixtures/two-tenant-seed.js` - Canonical seed data for 2 tenants across all 11 collections (28 exports)
- `test/tenant-isolation/helpers/test-app.js` - Express app builder with real middleware chain matching server.js
- `test/tenant-isolation/helpers/token.js` - JWT minting helper using real jsonwebtoken
- `package.json` - Added test:tenant-isolation, test:tenant-isolation:watch, test:ci scripts

## Decisions Made
- **bcryptjs over bcrypt:** Native bcrypt binary has ELF header issues on WSL; bcryptjs is pure JS and already in dependencies
- **No setupFiles:** The global test/setup.js mocks requireTenantId, buildScopedFilter, JWT, and bcrypt, which would defeat tenant isolation testing
- **patchMongoDBService pattern:** vi.doMock must run before any ESM imports of app modules; documented prominently in setup.js and test-app.js
- **git add -f for test-app.js:** .gitignore pattern `test-*.js` targets root throwaway scripts, not proper test infrastructure files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched bcrypt to bcryptjs for cross-platform compatibility**
- **Found during:** Task 1 (seed fixture creation)
- **Issue:** Native bcrypt module has invalid ELF header on WSL (Windows/Linux binary mismatch)
- **Fix:** Changed import from `bcrypt` to `bcryptjs` (pure JS implementation, already in dependencies)
- **Files modified:** test/tenant-isolation/fixtures/two-tenant-seed.js
- **Verification:** `node --input-type=module -e 'import * from "./test/tenant-isolation/fixtures/two-tenant-seed.js"'` succeeds
- **Committed in:** 8fbc885 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added import_log and ministry_report_snapshots seed data**
- **Found during:** Task 2 (completeness review)
- **Issue:** Plan specified "all 11 collection types" but initial implementation only covered 9 of 11
- **Fix:** Added importLogA/B and ministrySnapshotA/B documents and seed insertions
- **Files modified:** test/tenant-isolation/fixtures/two-tenant-seed.js
- **Verification:** Module exports 28 items including importLogA, importLogB, ministrySnapshotA, ministrySnapshotB
- **Committed in:** fb04f1d (Task 2 commit)

**3. [Rule 3 - Blocking] Force-added test-app.js past gitignore pattern**
- **Found during:** Task 2 (commit)
- **Issue:** .gitignore rule `test-*.js` (line 197) matched `test-app.js` in test directory
- **Fix:** Used `git add -f` to override gitignore (pattern targets root throwaway scripts, not test infrastructure)
- **Files modified:** git staging only
- **Committed in:** fb04f1d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and completeness. No scope creep.

## Issues Encountered
- Rollup native module error prevents direct Node.js import of vitest config (WSL cross-platform binary issue). Vitest runner handles this internally, so config was verified via static content analysis instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure complete; all subsequent plans (06-02 read isolation, 06-03 write isolation, 06-04 allowlist, 06-05 concurrent) can import these shared utilities
- No blockers for plan 06-02

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (8fbc885, fb04f1d) verified in git log.

---
*Phase: 06-testing-verification*
*Completed: 2026-02-24*
