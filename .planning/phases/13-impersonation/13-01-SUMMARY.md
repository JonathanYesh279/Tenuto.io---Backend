---
phase: 13-impersonation
plan: 01
subsystem: auth
tags: [jwt, impersonation, audit-trail, middleware, super-admin]

# Dependency graph
requires:
  - phase: 11-tenant-lifecycle
    provides: "Tenant isActive gating in authenticateToken, audit trail service"
  - phase: 10-bug-fixes
    provides: "Super admin auth refresh and route infrastructure"
provides:
  - "POST /api/super-admin/impersonate/:tenantId endpoint"
  - "POST /api/super-admin/stop-impersonation endpoint"
  - "enrichImpersonationContext middleware for all tenant-scoped routes"
  - "logImpersonatedAction audit function for mutating request logging"
  - "IMPERSONATION_STARTED, IMPERSONATION_ENDED, IMPERSONATION_ACTION audit constants"
affects: [13-impersonation, 14-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fire-and-forget audit logging for impersonation actions", "JWT claim extension for impersonation context"]

key-files:
  created:
    - middleware/impersonation-audit.middleware.js
  modified:
    - api/super-admin/super-admin.service.js
    - api/super-admin/super-admin.controller.js
    - api/super-admin/super-admin.route.js
    - api/super-admin/super-admin.validation.js
    - config/constants.js
    - services/auditTrail.service.js
    - server.js

key-decisions:
  - "Impersonation token mirrors generateAccessToken payload exactly plus 3 impersonation claims (isImpersonation, impersonatedBy, impersonationSessionId)"
  - "enrichImpersonationContext uses jwt.decode (not verify) since authenticateToken already verified"
  - "Audit logging for mutating requests is fire-and-forget (not awaited) to avoid slowing down requests"
  - "Middleware inserted after authenticateToken in all 23 tenant-scoped route chains"

patterns-established:
  - "Impersonation tokens: standard teacher JWT + isImpersonation/impersonatedBy/impersonationSessionId claims"
  - "req.impersonation object set by middleware when impersonation token detected"
  - "Fire-and-forget audit pattern: auditTrailService.logImpersonatedAction(req.impersonation, req) without await"

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 13 Plan 01: Impersonation Backend Summary

**Super admin impersonation endpoints with scoped JWT, audit enrichment middleware, and fire-and-forget mutating action logging across all tenant routes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T22:25:10Z
- **Completed:** 2026-02-24T22:30:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Super admin can POST /api/super-admin/impersonate/:tenantId and receive a JWT that passes through authenticateToken as a valid teacher token
- Impersonation token includes isImpersonation, impersonatedBy, and impersonationSessionId claims alongside standard teacher fields
- IMPERSONATION_STARTED and IMPERSONATION_ENDED logged to platform_audit_log on session start/stop
- Mutating requests (POST/PUT/PATCH/DELETE) during impersonation are logged as IMPERSONATION_ACTION via fire-and-forget audit
- enrichImpersonationContext middleware wired into all 23 tenant-scoped route chains in server.js
- authenticateToken and buildContext middleware remain completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add impersonation service functions, validation, and AUDIT_ACTIONS constants** - `62024e7` (feat)
2. **Task 2: Add controller, routes, audit enrichment middleware, and wire into server.js** - `9c3a357` (feat)

## Files Created/Modified
- `config/constants.js` - Added IMPERSONATION_STARTED, IMPERSONATION_ENDED, IMPERSONATION_ACTION to AUDIT_ACTIONS
- `api/super-admin/super-admin.validation.js` - Added impersonationStartSchema (tenantId hex string validation)
- `services/auditTrail.service.js` - Added logImpersonatedAction function for mutating request audit
- `api/super-admin/super-admin.service.js` - Added startImpersonation (JWT generation) and stopImpersonation (audit log)
- `api/super-admin/super-admin.controller.js` - Added startImpersonation and stopImpersonation controller methods
- `api/super-admin/super-admin.route.js` - Added POST /impersonate/:tenantId and POST /stop-impersonation routes
- `middleware/impersonation-audit.middleware.js` - New middleware: decodes impersonation tokens, sets req.impersonation, logs mutating actions
- `server.js` - Imported and wired enrichImpersonationContext into all tenant-scoped route chains

## Decisions Made
- Impersonation token mirrors `generateAccessToken` payload exactly (same _id, tenantId, firstName, lastName, email, roles, version) plus three impersonation claims -- this ensures authenticateToken accepts it without modification
- `enrichImpersonationContext` uses `jwt.decode()` (not `verify`) since `authenticateToken` already verified the signature
- Audit logging for mutating requests is fire-and-forget (not awaited) to avoid adding latency to impersonated requests
- Middleware is placed after `authenticateToken` and before `buildContext` in the chain, needing only `req.teacher` to be set
- GET requests during impersonation are NOT logged as audit entries (only debug log) to avoid audit noise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend impersonation foundation complete (IMPR-01 and IMPR-02)
- Ready for Phase 13 Plan 02 (frontend impersonation UI) which consumes these endpoints
- Frontend needs to store impersonation token separately from regular auth token to avoid localStorage collision
- Impersonation token expires in 1h (matching regular access token TTL)
- No refresh token is issued for impersonation sessions (intentional -- forces re-impersonation)

## Self-Check: PASSED

- All 9 files verified present on disk
- Commit 62024e7 verified in git log
- Commit 9c3a357 verified in git log
- All 8 modified files pass `node --check` syntax validation
- authenticateToken middleware unchanged (0 lines diff)
- buildContext middleware unchanged (0 lines diff)

---
*Phase: 13-impersonation*
*Completed: 2026-02-24*
