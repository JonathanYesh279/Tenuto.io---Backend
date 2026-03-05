---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
  - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/authContext.jsx
  - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/Login.tsx
  - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/ForcePasswordChange.tsx
  - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/App.tsx
autonomous: true
must_haves:
  truths:
    - "Admin who logs in with requiresPasswordChange sees fullscreen password change form instead of dashboard"
    - "Admin can set a new password (min 6 chars) and is then redirected to dashboard"
    - "If admin refreshes page while requiresPasswordChange is true, they are still forced to the password change screen"
    - "After successful password change, user token is updated and app continues normally"
  artifacts:
    - path: "src/pages/ForcePasswordChange.tsx"
      provides: "Fullscreen forced password change UI"
      min_lines: 60
    - path: "src/services/apiService.js"
      provides: "forcePasswordChange API method"
      contains: "forcePasswordChange"
    - path: "src/services/authContext.jsx"
      provides: "requiresPasswordChange on user state + clearRequiresPasswordChange helper"
      contains: "requiresPasswordChange"
  key_links:
    - from: "src/pages/Login.tsx"
      to: "src/pages/ForcePasswordChange.tsx"
      via: "navigate to /force-password-change when requiresPasswordChange is true"
      pattern: "force-password-change"
    - from: "src/pages/ForcePasswordChange.tsx"
      to: "/api/auth/force-password-change"
      via: "apiService.auth.forcePasswordChange"
      pattern: "forcePasswordChange"
    - from: "src/App.tsx"
      to: "src/pages/ForcePasswordChange.tsx"
      via: "ProtectedRoute redirects to /force-password-change"
      pattern: "requiresPasswordChange"
---

<objective>
Implement forced password change flow for tenant admins whose passwords were reset by super admin.

Purpose: When a super admin resets a tenant admin's password, the admin gets a default password with `requiresPasswordChange: true`. On next login, they must set a new password before accessing the app.

Output: ForcePasswordChange page, updated auth flow, route guard preventing app access until password is changed.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Backend endpoints already exist and are fully functional:
- POST /auth/force-password-change — accepts { newPassword }, requires auth token, returns new tokens + teacher object
- Login response already includes requiresPasswordChange: true/false on teacher object

Frontend files to modify:
@/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
@/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/authContext.jsx
@/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/Login.tsx
@/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/App.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add forcePasswordChange API method and wire requiresPasswordChange through auth state</name>
  <files>
    /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
    /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/authContext.jsx
  </files>
  <action>
    1. In apiService.js, add `forcePasswordChange` method near the existing `resetPassword` method (around line 506):
       ```
       async forcePasswordChange(newPassword) {
         const response = await apiClient.post('/auth/force-password-change', { newPassword });
         if (response.accessToken) {
           apiClient.setToken(response.accessToken);
         }
         return response;
       }
       ```
       This uses the authenticated endpoint (token already set from login). On success, it updates the in-memory token with the new one returned by the backend.

    2. In authContext.jsx, add `requiresPasswordChange` to BOTH normalizedUser objects:

       a. In the `login()` function (around line 343), add to normalizedUser:
          `requiresPasswordChange: basicUserData?.requiresPasswordChange || loginResponse?.teacher?.requiresPasswordChange || false`
          Note: basicUserData comes from loginResponse.teacher which has requiresPasswordChange at top level.

       b. In the `checkAuthStatus()` function (around line 227), add to normalizedUser:
          `requiresPasswordChange: userData?.credentials?.requiresPasswordChange || userData?.requiresPasswordChange || false`
          Note: The full teacher fetch via getTeacher returns the teacher document which has credentials.requiresPasswordChange.

    3. In authContext.jsx, add a `clearRequiresPasswordChange` function exposed in the context value:
       ```
       const clearRequiresPasswordChange = useCallback(() => {
         setUser(prev => prev ? { ...prev, requiresPasswordChange: false } : prev)
       }, [])
       ```
       Add `clearRequiresPasswordChange` to the AuthContext.Provider value object (find where `login`, `logout`, etc. are provided).

    4. In authContext.jsx login() function: After setting the user, check `requiresPasswordChange`. The login function should return it so Login.tsx can act on it:
       The existing `return { success: true, user: normalizedUser }` already returns the user — Login.tsx will check `result.user.requiresPasswordChange`.
  </action>
  <verify>
    Grep apiService.js for "forcePasswordChange" — should find the new method.
    Grep authContext.jsx for "requiresPasswordChange" — should find it in both normalizedUser blocks and in clearRequiresPasswordChange.
    Grep authContext.jsx for "clearRequiresPasswordChange" — should find it in the provider value.
  </verify>
  <done>
    apiService has forcePasswordChange method calling POST /auth/force-password-change.
    authContext normalizedUser includes requiresPasswordChange in both login and checkAuthStatus flows.
    clearRequiresPasswordChange function is exposed via auth context.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create ForcePasswordChange page and wire Login.tsx + App.tsx routing</name>
  <files>
    /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/ForcePasswordChange.tsx
    /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/Login.tsx
    /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/App.tsx
  </files>
  <action>
    1. Create `ForcePasswordChange.tsx` — fullscreen page matching Login's glassmorphism style:
       - Same background image, overlay, glassmorphism card as Login.tsx
       - RTL direction, font-reisinger-yonatan throughout
       - Icon: LockKey from @phosphor-icons/react (or Lock if LockKey unavailable — check existing imports in the codebase)
       - Title: "הגדרת סיסמה חדשה" (Set New Password)
       - Subtitle: "נדרש לשנות סיסמה לפני כניסה למערכת" (Password change required before accessing the system)
       - Two password fields: "סיסמה חדשה" (new password) and "אימות סיסמה" (confirm password)
       - Validation: min 6 chars, passwords must match, show inline error messages
       - Submit button: "שמירה והמשך" (Save and Continue)
       - Loading state with spinner (same pattern as Login)
       - Error display in red glassmorphism box (same as Login error style)
       - On success: call `clearRequiresPasswordChange()` from useAuth(), then `navigate('/dashboard')`
       - Calls `apiService.auth.forcePasswordChange(newPassword)` — NOT changePassword (forcePasswordChange doesn't need currentPassword)
       - Import apiService directly for the API call, useAuth for clearRequiresPasswordChange and user state

    2. Update `Login.tsx`:
       - Import useAuth's full return (already has `login`) — no new import needed
       - After successful login (line 48, before `navigate('/dashboard')`), check `result?.user?.requiresPasswordChange`:
         ```
         if (result?.user?.requiresPasswordChange) {
           navigate('/force-password-change')
           return
         }
         navigate('/dashboard')
         ```
       - Same check after `handleTenantSelect` success (line 69, before `navigate('/dashboard')`)

    3. Update `App.tsx`:
       - Import ForcePasswordChange page (NOT lazy loaded — it's a critical auth flow page, keep it simple):
         `import ForcePasswordChange from './pages/ForcePasswordChange'`
       - Add route BEFORE the protected routes (alongside /login, /forgot-password, /reset-password):
         `<Route path="/force-password-change" element={<ForcePasswordChange />} />`
       - In `ProtectedRoute` component: after the `isAuthenticated` check passes (line 160-162), add a redirect check:
         ```
         if (user?.requiresPasswordChange && location.pathname !== '/force-password-change') {
           return <Navigate to="/force-password-change" replace />
         }
         ```
         This goes BEFORE the super admin path check (line 164). This ensures that even on page refresh, a user with requiresPasswordChange cannot access any protected route.
  </action>
  <verify>
    Check that ForcePasswordChange.tsx exists and has the glassmorphism styling.
    Check Login.tsx for the requiresPasswordChange redirect in both handleSubmit and handleTenantSelect.
    Check App.tsx for the /force-password-change route and the ProtectedRoute guard.
    Run `cd /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend && npx tsc --noEmit --pretty 2>&1 | head -30` to verify no TypeScript errors.
  </verify>
  <done>
    ForcePasswordChange.tsx renders fullscreen password change form with glassmorphism style.
    Login.tsx redirects to /force-password-change when requiresPasswordChange is true.
    App.tsx ProtectedRoute blocks all protected pages when requiresPasswordChange is true.
    TypeScript compilation has no new errors.
  </done>
</task>

</tasks>

<verification>
1. Login with a tenant admin account that has requiresPasswordChange: true
2. Verify redirect to /force-password-change instead of /dashboard
3. Try navigating directly to /dashboard — should redirect back to /force-password-change
4. Enter mismatched passwords — should show validation error
5. Enter password shorter than 6 chars — should show validation error
6. Enter valid matching passwords — should succeed, redirect to /dashboard
7. Refresh page — should now access dashboard normally (requiresPasswordChange is false)
</verification>

<success_criteria>
- Tenant admin with requiresPasswordChange=true is forced to set new password before accessing any page
- Password change form matches Login page visual style (glassmorphism, RTL, Hebrew)
- After successful password change, user can access the app normally
- Route guard prevents bypassing by direct URL navigation
- Page refresh while requiresPasswordChange=true still forces password change
</success_criteria>

<output>
After completion, create `.planning/quick/1-forced-password-change-flow-after-admin-/1-SUMMARY.md`
</output>
