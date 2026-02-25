---
phase: 13-impersonation
verified: 2026-02-25T21:27:46Z
status: human_needed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Trigger startImpersonation from the browser console (logged in as super admin) — e.g., window.__authContext.startImpersonation('<tenantId>')"
    expected: "Amber banner appears at the top of the page with Hebrew text showing tenant name and admin name, with an Exit button"
    why_human: "Banner visibility and correct Hebrew rendering cannot be verified programmatically"
  - test: "With banner visible, navigate between pages (e.g., students → teachers → dashboard)"
    expected: "Amber banner persists on every page without flickering or disappearing"
    why_human: "React re-render persistence across route transitions requires visual inspection"
  - test: "With banner visible, press F5 to hard-refresh the page"
    expected: "After refresh, banner is still visible (loginType=impersonation and impersonationContext restored from localStorage)"
    why_human: "Post-refresh DOM state requires visual inspection"
  - test: "Click the Exit button (יציאה מהתחזות)"
    expected: "Banner disappears, user lands on /dashboard as super admin without being prompted to log in again"
    why_human: "Full auth state restoration flow (token swap + React context reset) requires visual inspection to confirm no login wall appears"
  - test: "During impersonation, submit any mutating form (e.g., create or update a student)"
    expected: "An IMPERSONATION_ACTION entry appears in GET /api/super-admin/audit-log with both actorId (super admin) and targetId (impersonated teacher)"
    why_human: "Requires a live backend connection to verify the audit entry was written; curl to audit log needed"
---

# Phase 13: Impersonation Verification Report

**Phase Goal:** Super admin can impersonate a tenant's admin to see exactly what they see, with every action audit-logged and a clear visual indicator in the frontend
**Verified:** 2026-02-25T21:27:46Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/super-admin/impersonate/:tenantId returns a JWT that authenticateToken accepts as a valid teacher token | VERIFIED | `startImpersonation` in super-admin.service.js:932 signs a JWT with standard teacher fields (`_id`, `tenantId`, `firstName`, `lastName`, `email`, `roles`, `version`) plus `isImpersonation:true`, `impersonatedBy`, `impersonationSessionId` — same payload structure as `generateAccessToken` |
| 2 | POST /api/super-admin/stop-impersonation logs the session end in platform_audit_log | VERIFIED | `stopImpersonation` in super-admin.service.js:1023 calls `auditTrailService.logAction(AUDIT_ACTIONS.IMPERSONATION_ENDED, ...)` before returning |
| 3 | Every mutating request (POST/PUT/PATCH/DELETE) made with an impersonation token is logged with both super admin identity and impersonated user identity | VERIFIED | `enrichImpersonationContext` middleware (impersonation-audit.middleware.js:44) fires `logImpersonatedAction(req.impersonation, req)` for MUTATING_METHODS; entry records `actorId: superAdminId` and `targetId: impersonatedUserId` |
| 4 | Impersonation of a deactivated tenant returns an error | VERIFIED | super-admin.service.js:946 checks `!tenant.isActive` and throws "Cannot impersonate a deactivated tenant"; controller maps this to 400 |
| 5 | Impersonation of a tenant with no active admin returns an error | VERIFIED | super-admin.service.js:959 checks `!adminTeacher` and throws "No active admin found for this tenant"; controller maps this to 400 |
| 6 | Frontend super admin can start and stop impersonation without re-login | VERIFIED | authContext.jsx:439 stashes super admin token to sessionStorage before swapping to impersonation token; authContext.jsx:510 restores the token BEFORE calling stop-impersonation API (bug fix confirmed) |
| 7 | Amber banner visible on every page during impersonation | VERIFIED | ImpersonationBanner.tsx exported with `fixed top-0 left-0 right-0 z-[100] bg-amber-500`; Layout.tsx:49 renders it as first child unconditionally |
| 8 | Page refresh during impersonation preserves banner and state | VERIFIED | authContext.jsx:135 handles `loginType === 'impersonation'` in `checkAuthStatus` — validates token and calls `setUser({...teacherData, isImpersonating: true})`; ImpersonationBanner re-mounts and reads `impersonationContext` from localStorage |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/super-admin/super-admin.service.js` | startImpersonation and stopImpersonation functions | VERIFIED | Lines 932–1033; both exported in service object at lines 48–49 |
| `api/super-admin/super-admin.controller.js` | startImpersonation and stopImpersonation controller methods | VERIFIED | Lines 373–411; exported at lines 35–36 |
| `api/super-admin/super-admin.route.js` | POST /impersonate/:tenantId and POST /stop-impersonation routes | VERIFIED | Lines 18–19; placed after `router.use(authenticateSuperAdmin)` at line 13 |
| `api/super-admin/super-admin.validation.js` | impersonationStartSchema validation | VERIFIED | Lines 51–53; `tenantId: Joi.string().hex().length(24).required()` |
| `middleware/impersonation-audit.middleware.js` | Audit enrichment middleware | VERIFIED | 60-line file; exports `enrichImpersonationContext`; decodes token, sets `req.impersonation`, fires-and-forgets `logImpersonatedAction` for mutating methods |
| `config/constants.js` | AUDIT_ACTIONS.IMPERSONATION_STARTED, IMPERSONATION_ENDED, IMPERSONATION_ACTION | VERIFIED | Lines 251–253 |
| `services/auditTrail.service.js` | logImpersonatedAction function | VERIFIED | Lines 116–139; writes to PLATFORM_AUDIT_LOG with `actorId`, `actorType: 'super_admin'`, `targetId`, `details.sessionId`, `details.method`, `details.path` |
| `server.js` | enrichImpersonationContext in tenant-scoped route chains | VERIFIED | Imported at line 16; appears 24 times in route chains — after `authenticateToken`, before `buildContext` |
| `src/services/apiService.js` | startImpersonation and stopImpersonation on superAdminService | VERIFIED | Lines 5314–5334; `startImpersonation` POSTs to `/super-admin/impersonate/${tenantId}`, `stopImpersonation` POSTs to `/super-admin/stop-impersonation` with sessionId |
| `src/services/authContext.jsx` | startImpersonation, stopImpersonation, checkAuthStatus impersonation handling, token stashing | VERIFIED | Lines 135–163 (checkAuthStatus), 439–504 (startImpersonation), 506–564 (stopImpersonation), 583–587 (logout cleanup), 604–609 (refreshToken expiry exit); both exposed in context value at lines 655–656 |
| `src/components/ImpersonationBanner.tsx` | Fixed amber banner with tenant name and Exit button | VERIFIED | 87-line substantive component; amber-500 fixed positioning, Hebrew text, reads localStorage, storage event listener for cross-tab, calls `stopImpersonation` on exit |
| `src/components/Layout.tsx` | ImpersonationBanner rendered above all other content | VERIFIED | Imported at line 3; rendered at line 49 as first child of root div, before Sidebar and Header |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| super-admin.service.js | JWT (authenticateToken compatible) | `jwt.sign` with `isImpersonation:true` | WIRED | Token payload at lines 966–982; matches generateAccessToken field names exactly |
| impersonation-audit.middleware.js | auditTrail.service.js | `auditTrailService.logImpersonatedAction(req.impersonation, req)` | WIRED | Line 45 of middleware; function exists and is exported from auditTrail.service.js |
| server.js | impersonation-audit.middleware.js | `enrichImpersonationContext` in 24 tenant-scoped route chains | WIRED | 24 occurrences confirmed in server.js |
| apiService.js | /api/super-admin/impersonate/:tenantId | POST via `apiClient.post` | WIRED | Line 5316 |
| authContext.jsx | apiService.superAdminService | `superAdminService.startImpersonation(tenantId)` and `superAdminService.stopImpersonation(sessionId)` | WIRED | Lines 444 and 528 |
| ImpersonationBanner.tsx | authContext.jsx | `useAuth().stopImpersonation` | WIRED | Line 13 of ImpersonationBanner.tsx |
| Layout.tsx | ImpersonationBanner.tsx | `<ImpersonationBanner />` rendered as first child | WIRED | Lines 3 and 49 of Layout.tsx |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| IMPR-01: Super admin can start impersonation and receive scoped JWT | SATISFIED | JWT signed with teacher payload + 3 impersonation claims; passes through existing authenticateToken unchanged |
| IMPR-02: Every action audit-logged with both identities | SATISFIED | IMPERSONATION_STARTED/ENDED via `logAction`; IMPERSONATION_ACTION per mutating request via fire-and-forget `logImpersonatedAction` |
| IMPR-03: Frontend persistent banner with Exit button | SATISFIED | ImpersonationBanner component with amber fixed banner, Hebrew labels, Exit button that restores super admin session |

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholders, or stub implementations found in any of the 12 key files.

**Critical bug fix confirmed:** In `stopImpersonation()` (authContext.jsx:510), the super admin token is restored to `apiService.client` at step 1 (line 517) BEFORE the stop-impersonation API call at step 2 (line 528). This ensures `authenticateSuperAdmin` middleware accepts the request and writes `IMPERSONATION_ENDED` to the audit log.

### Human Verification Required

#### 1. Banner Visual Appearance

**Test:** Log in as super admin, call `startImpersonation('<tenantId>')` via browser console or UI trigger
**Expected:** Amber banner appears at top of page with Hebrew text "מצב התחזות: צפייה כ-{adminName} ({tenantName})" and a white "יציאה מהתחזות" button
**Why human:** Hebrew text rendering and visual position cannot be verified programmatically

#### 2. Banner Persistence Across Navigation

**Test:** With banner visible, navigate between several pages using the sidebar
**Expected:** Banner stays fixed at the top on every page without disappearing
**Why human:** React Router navigation re-rendering behavior requires visual inspection

#### 3. Banner Persistence After Page Refresh

**Test:** With banner visible, hard-refresh (F5) the page
**Expected:** Banner reappears immediately after reload; no login redirect
**Why human:** localStorage/sessionStorage restoration on reload requires live browser testing

#### 4. Exit Impersonation Full Flow

**Test:** Click the "יציאה מהתחזות" Exit button
**Expected:** Banner disappears, page navigates to /dashboard, user is the super admin again (no re-login required)
**Why human:** Full auth state restoration requires live browser verification; the critical bug fix (token ordering in stopImpersonation) can only be confirmed by observing that IMPERSONATION_ENDED is logged AND no 403 error appears

#### 5. Audit Log Entries

**Test:** During an active impersonation session, create or edit a record (mutating request), then check `GET /api/super-admin/audit-log`
**Expected:** Entries with `action: "IMPERSONATION_ACTION"` appear showing `actorId` (super admin) and `targetId` (impersonated teacher); also `IMPERSONATION_STARTED` and `IMPERSONATION_ENDED` present
**Why human:** Requires a live backend with MongoDB connection to confirm audit entries were written

### Gaps Summary

No automated gaps found. All 8 truths verified, all 12 artifacts exist and are substantive, all 7 key links are wired. The 5 human verification items are standard UX/integration tests that require a running environment.

---

_Verified: 2026-02-25T21:27:46Z_
_Verifier: Claude (gsd-verifier)_
