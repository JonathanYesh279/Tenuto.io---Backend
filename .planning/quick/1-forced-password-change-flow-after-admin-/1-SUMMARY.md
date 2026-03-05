---
phase: quick-1
plan: 01
subsystem: auth
tags: [auth, password-change, forced-reset, frontend]
dependency-graph:
  requires: [backend-force-password-change-endpoint]
  provides: [frontend-forced-password-change-flow]
  affects: [auth-flow, login-routing, protected-routes]
tech-stack:
  added: []
  patterns: [glassmorphism-auth-page, route-guard-redirect]
key-files:
  created:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/ForcePasswordChange.tsx
  modified:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/authContext.jsx
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/Login.tsx
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/App.tsx
decisions:
  - LockKeyIcon used for visual identity (lock with key motif fits password-change UX)
  - Amber color scheme for icon/border to signal caution/action-required (distinct from Login's purple)
  - ForcePasswordChange imported statically (not lazy) since it's a critical auth gate
metrics:
  duration: 6min
  completed: 2026-03-06
  tasks: 2
  files: 5
---

# Quick Task 1: Forced Password Change Flow Summary

Frontend forced password change with glassmorphism UI, route guards, and token refresh on success.

## What Was Done

### Task 1: API Method + Auth State (18417f2)
- Added `forcePasswordChange(newPassword)` method to apiService.auth calling POST /auth/force-password-change
- Added `requiresPasswordChange` to normalizedUser in both `login()` and `checkAuthStatus()` flows in authContext.jsx
- Added `clearRequiresPasswordChange()` helper exposed via AuthContext provider value
- On successful API call, new accessToken is stored via `apiClient.setToken()`

### Task 2: ForcePasswordChange Page + Routing (4f3ff9c)
- Created ForcePasswordChange.tsx -- fullscreen glassmorphism page matching Login style
- Password validation: min 6 chars, confirmation match, inline Hebrew error messages
- Login.tsx redirects to /force-password-change in both handleSubmit and handleTenantSelect when requiresPasswordChange is true
- App.tsx ProtectedRoute blocks ALL protected routes when requiresPasswordChange is true, redirecting to /force-password-change
- Route added alongside /login, /forgot-password, /reset-password (public auth routes)

## Deviations from Plan

None -- plan executed exactly as written.

## Auth Gates

None encountered.

## Verification

- TypeScript compilation: zero new errors
- forcePasswordChange method found in apiService.js
- requiresPasswordChange wired through both login and checkAuthStatus normalizedUser objects
- clearRequiresPasswordChange exposed in AuthContext provider value
- Login.tsx has redirect in both submit handlers
- ProtectedRoute guard prevents bypass via direct URL navigation
- ForcePasswordChange.tsx has glassmorphism styling, RTL, Hebrew labels, validation

## Self-Check: PASSED

All files verified present, all commits verified in git log.
