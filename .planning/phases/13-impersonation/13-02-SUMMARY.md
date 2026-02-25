---
phase: 13-impersonation
plan: 02
subsystem: ui
tags: [react, impersonation, auth-context, banner, localStorage, sessionStorage]

# Dependency graph
requires:
  - phase: 13-01
    provides: "POST /api/super-admin/impersonate/:tenantId and POST /api/super-admin/stop-impersonation endpoints"
provides:
  - "startImpersonation and stopImpersonation methods on superAdminService in apiService.js"
  - "startImpersonation and stopImpersonation functions in auth context"
  - "ImpersonationBanner component with amber fixed banner and Exit button"
  - "checkAuthStatus handling for loginType=impersonation"
  - "Token stashing in sessionStorage for super admin session preservation"
affects: [14-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token stashing uses sessionStorage (preImpersonation_authToken/loginType/superAdminUser)"
    - "ImpersonationBanner reads localStorage and listens for storage events"
    - "Impersonation token expiry triggers automatic exit via stopImpersonation in refreshToken callback"

key-files:
  created:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/ImpersonationBanner.tsx
  modified:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/authContext.jsx
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/Layout.tsx

key-decisions:
  - "Token stashing uses sessionStorage — survives page refresh within tab, cleared on tab close"
  - "ImpersonationBanner reads from localStorage and listens for storage events for cross-tab awareness"
  - "Impersonation token expiry triggers automatic exit via stopImpersonation in refreshToken callback"
  - "Banner uses fixed positioning with z-[100] to overlay above header — intentional strong visual indicator"
  - "Super admin token restored BEFORE stop-impersonation API call (bug fix: route requires authenticateSuperAdmin)"

patterns-established:
  - "loginType='impersonation' in localStorage signals active impersonation session"
  - "impersonationContext JSON in localStorage carries tenantName, adminName, sessionId, startedAt"
  - "sessionStorage preImpersonation_* keys preserve super admin state for restore on exit"

# Metrics
duration: ~15min (tasks 1-2 executed, checkpoint verified with bug fix)
completed: 2026-02-25
---

# Phase 13 Plan 02: Frontend Impersonation Summary

**Frontend impersonation auth context, token stashing, ImpersonationBanner component, and Layout integration with stop-impersonation JWT bug fix**

## Performance

- **Duration:** ~15 min (across sessions — tasks 1-2 executed, checkpoint with bug fix)
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments
- superAdminService in apiService.js has startImpersonation(tenantId) and stopImpersonation(sessionId) API methods
- authContext has startImpersonation and stopImpersonation functions exposed in context value
- checkAuthStatus handles loginType === 'impersonation' with token validation and auto-exit on expiry
- Token stashing uses sessionStorage (preImpersonation_authToken, preImpersonation_loginType, preImpersonation_superAdminUser)
- ImpersonationBanner.tsx renders fixed amber banner with tenant name, admin name (Hebrew), and Exit button
- Layout.tsx renders ImpersonationBanner as first child (always rendered, self-hides when not impersonating)
- Logout cleans up all impersonation state
- refreshToken exits impersonation on token expiry (no refresh for impersonation tokens by design)
- Bug fix: super admin JWT restored BEFORE stop-impersonation API call (was sending impersonation JWT, causing silent 403)

## Task Commits

1. **Task 1: API methods + auth context impersonation functions** — `7db01ae` (feat)
2. **Task 2: ImpersonationBanner component + Layout wiring** — `b603144` (feat)
3. **Bug fix: stop-impersonation JWT ordering** — `4500836` (fix)

## Files Created/Modified
- `frontend/src/services/apiService.js` — Added startImpersonation and stopImpersonation to superAdminService
- `frontend/src/services/authContext.jsx` — Added startImpersonation, stopImpersonation, impersonation handling in checkAuthStatus/refreshToken/logout
- `frontend/src/components/ImpersonationBanner.tsx` — New amber banner component with Exit button
- `frontend/src/components/Layout.tsx` — Renders ImpersonationBanner as first child

## Decisions Made
- Token stashing uses sessionStorage — survives page refresh within tab, cleared on tab close
- ImpersonationBanner reads from localStorage and listens for storage events to detect cross-tab changes
- Impersonation token expiry triggers automatic exit via stopImpersonation in refreshToken callback
- Banner uses fixed positioning with z-[100] to overlay above header
- Super admin token restored BEFORE stop-impersonation API call (route requires authenticateSuperAdmin)

## Deviations from Plan
- Bug fix added: stopImpersonation was sending impersonation JWT to authenticateSuperAdmin-protected route. Fixed by swapping token restore to step 1 (before API call).

## Issues Encountered
- stop-impersonation JWT ordering bug — discovered during milestone audit, fixed during checkpoint

## User Setup Required
None.

## Next Phase Readiness
- Frontend impersonation foundation complete (IMPR-01, IMPR-02, IMPR-03)
- Phase 14 (Super Admin Frontend) will add the "Impersonate" button to tenant management UI
- No UI entry point for startImpersonation yet — that's Phase 14 scope

## Self-Check: PASSED

- All 4 files verified present on disk
- Commits 7db01ae, b603144, 4500836 verified in git log
- authContext.jsx exports startImpersonation and stopImpersonation in context value
- ImpersonationBanner imported and rendered in Layout.tsx

---
*Phase: 13-impersonation*
*Completed: 2026-02-25*
