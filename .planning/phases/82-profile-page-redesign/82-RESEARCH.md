# Phase 82: Profile Page Redesign & Credentials Management - Research

**Researched:** 2026-03-22
**Domain:** Full-stack profile UI redesign + password change integration
**Confidence:** HIGH

## Summary

This phase transforms the existing Profile page (`src/pages/Profile.tsx`) into a rich, role-aware dashboard matching the Student Details design pattern established in Phase 80. The existing Profile page already has significant infrastructure in place: gradient header with curved SVG wave, HeroUI avatar, GlassStatCard row, animated tabs with role-based visibility, and design system tokens (rounded-card, border-border, shadow-1). The primary additions are: (1) a 3-column dashboard layout replacing the current single-column layout, (2) a new Credentials tab with password change form, (3) admin-specific conservatory-wide stats, and (4) quick contact actions with Popovers matching the student ProfileCard pattern.

The backend already has a fully functional `POST /auth/change-password` endpoint that verifies the current password, hashes the new one, increments token version, and returns fresh tokens. The frontend apiService does NOT yet expose a `changePassword` method -- only `forcePasswordChange` exists. The main work is: adding the frontend API method, building the Credentials tab UI with strength indicator, restructuring the layout to 3-column, and adding role-aware admin stats.

**Primary recommendation:** Leverage the existing Profile.tsx structure (already 80% aligned with the target) and the existing `POST /auth/change-password` backend endpoint. Focus frontend effort on layout restructure, Credentials tab, and admin stats -- no new backend endpoint needed.

## Standard Stack

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| HeroUI (`@heroui/react`) | Button, Chip, User, Popover, PopoverTrigger, PopoverContent | Project standard -- all UI components must use HeroUI |
| `@phosphor-icons/react` | Icons (LockKeyIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, etc.) | Project standard icon library |
| `framer-motion` | Tab slide animations via animated-tabs component | Already used by animated-tabs |
| Tailwind CSS | Styling with design system tokens | Project standard |

### Supporting (Already Available)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `src/components/ui/GlassStatCard.tsx` | Stat cards with glass morphism | Role-aware statistics row |
| `src/components/ui/animated-tabs.tsx` | Tabs, TabsList, TabsTrigger, TabsContents, TabsContent | Tab container with slide animation |
| `src/utils/nameUtils.ts` | getDisplayName, formatAddress | Profile display name |
| `src/utils/avatarColorHash.ts` | getAvatarColorHex | Deterministic avatar color |
| `src/services/authContext.jsx` | useAuth hook, user object, checkAuthStatus | Auth state management |

### No New Dependencies
No new npm packages needed. Everything required is already in the project.

## Architecture Patterns

### Existing Profile Page Structure (to be enhanced)
```
src/pages/Profile.tsx              -- Main page (MODIFY)
src/components/profile/
  GeneralInfoTab.tsx               -- Personal info display/edit (MODIFY for tokens)
  TeacherStudentsTab.tsx           -- Existing tab (KEEP)
  TeacherScheduleTab.tsx           -- Existing tab (KEEP)
  TeacherAttendanceTab.tsx         -- Existing tab (KEEP)
  ConductorOrchestrasTab.tsx       -- Existing tab (KEEP)
  TheoryTeacherLessonsTab.tsx      -- Existing tab (KEEP)
  CredentialsTab.tsx               -- NEW: Password change form
  ProfileSidebar.tsx               -- NEW: Profile card (right column)
```

### Pattern 1: Gradient Header with Curved SVG Wave (Already Exists)
**What:** Branded gradient band with curved bottom SVG and overlapping HeroUI avatar
**When to use:** Profile page header, matching student ProfileCard
**Status:** Already implemented in current Profile.tsx (lines 356-410). The exact SVG path and gradient colors match the student ProfileCard pattern.
```tsx
// Already in Profile.tsx -- gradient + curved SVG + overlapping avatar
<div className="h-32 w-full" style={{ background: 'linear-gradient(135deg, #6ec49d 0%, #4db8a4 50%, #3aa89e 100%)' }} />
<svg viewBox="0 0 1440 200" preserveAspectRatio="none">
  <path d="M0,200 C480,40 960,40 1440,200 L1440,200 L0,200 Z" fill="white" />
</svg>
```

### Pattern 2: 3-Column Dashboard Layout (From StudentDashboardView)
**What:** Asymmetric grid: profile card (1col) | stats + widgets (2col center-left)
**When to use:** Dashboard-style detail pages
**Example from StudentDashboardView:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <ProfileCard ... />           {/* Right column in RTL */}
  <div className="flex flex-col gap-3">
    {/* 2x2 stat cards + chart */}
  </div>
  <WidgetColumn ... />          {/* Left column in RTL */}
</div>
```

### Pattern 3: Quick Contact Popovers (From Student ProfileCard)
**What:** Icon buttons (Phone, Email, WhatsApp) with Popover dropdowns showing details
**When to use:** Any profile card with contact information
**Key components:** `Button isIconOnly variant="flat" size="sm"` + `Popover` + `PopoverTrigger` + `PopoverContent`
```tsx
<Popover placement="bottom">
  <PopoverTrigger>
    <Button isIconOnly variant="flat" size="sm" aria-label="...">
      <PhoneIcon className="w-4 h-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="p-3 space-y-2.5 min-w-[200px]">...</div>
  </PopoverContent>
</Popover>
```

### Pattern 4: Role-Aware Content (Already Exists)
**What:** Helper functions `isAdmin()`, `isTeacher()`, `isConductor()`, `isTheoryTeacher()` control tab/stat visibility
**Status:** Already implemented in Profile.tsx (lines 171-191). Extend for admin-specific stats.

### Anti-Patterns to Avoid
- **Custom avatar divs:** Always use HeroUI `<User>` component with `getAvatarColorHex` -- never custom divs with initials
- **Hardcoded gray-*/blue-* classes:** Use design tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `rounded-card`, `shadow-1`)
- **Custom tabs:** Always use the animated-tabs component (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContents`, `TabsContent`)
- **Building password strength from scratch:** Use a simple calculation function, not a library

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar display | Custom div with initials | HeroUI `<User>` + `getAvatarColorHex` | Project mandate |
| Tab system | Custom tab buttons | `src/components/ui/animated-tabs.tsx` | Has slide animation, RTL support |
| Stat cards | Custom stat boxes | `GlassStatCard` component | Glass morphism, consistent styling |
| Buttons | Custom `<button>` elements | HeroUI `<Button>` | Project mandate |
| Status badges | Custom colored spans | HeroUI `<Chip>` | Consistent badge styling |
| Contact popovers | Custom dropdowns/modals | HeroUI `<Popover>` | Matches student ProfileCard pattern |
| Password hashing | Custom crypto | Backend `authService.changePassword` (bcrypt) | Already implemented with token rotation |

**Key insight:** The backend password change flow is fully implemented and battle-tested. The frontend just needs an API method and a form.

## Common Pitfalls

### Pitfall 1: Not Updating Auth Tokens After Password Change
**What goes wrong:** Password change succeeds but user gets logged out because tokens aren't refreshed in the frontend
**Why it happens:** Backend `changePassword` returns new `accessToken` and `refreshToken` with incremented `tokenVersion`, but frontend doesn't store them
**How to avoid:** After successful password change API call, update tokens in localStorage AND call `checkAuthStatus(true)` from useAuth
**Warning signs:** User gets 401 errors after password change, or gets logged out

### Pitfall 2: Admin Stats Fetching All Records
**What goes wrong:** Profile page for admin loads ALL students, teachers, orchestras just to count them
**Why it happens:** Dashboard.tsx does exactly this with `apiService.students.getStudents()` -- returns full arrays
**How to avoid:** For admin profile, either reuse the same approach (acceptable for conservatory-sized data ~50-200 records) or add count-only endpoints later. Current approach is fine for MVP.
**Warning signs:** Slow profile load for large tenants

### Pitfall 3: Tab State Lost on Navigation
**What goes wrong:** User changes password, navigates away, comes back -- tab reverts to "general"
**Why it happens:** Tab state managed by local useState, resets on mount
**How to avoid:** The existing `location.state.activeTab` and URL `?tab=` pattern already handles this (Profile.tsx lines 55-73). Use the same for the credentials tab.

### Pitfall 4: Password Strength Indicator Shows Wrong State
**What goes wrong:** Strength indicator doesn't update in real-time or shows misleading colors
**Why it happens:** Complex regex-based validation with edge cases
**How to avoid:** Simple scoring: length (6+ = weak, 8+ = medium, 10+ = strong) + character diversity (uppercase, lowercase, numbers, symbols). Don't over-engineer.

### Pitfall 5: RTL Layout Direction for Password Fields
**What goes wrong:** Password fields show dots right-to-left, confusing users
**Why it happens:** RTL page direction applies to input fields
**How to avoid:** Set `dir="ltr"` and `style={{ textAlign: 'left' }}` on password inputs (same pattern as ForcePasswordChange.tsx)

### Pitfall 6: Missing `changePassword` in apiService
**What goes wrong:** Frontend tries to call a method that doesn't exist
**Why it happens:** Backend has `POST /auth/change-password` but frontend apiService only has `forcePasswordChange`
**How to avoid:** Add `changePassword(currentPassword, newPassword)` to the `auth` section of apiService.js

## Code Examples

### Backend Password Change Endpoint (Already Working)
```
POST /api/auth/change-password
Headers: Authorization: Bearer <accessToken>
Body: { currentPassword: string, newPassword: string }
Response: {
  success: true,
  accessToken: string,      // New token with incremented version
  refreshToken: string,     // New refresh token
  teacher: { ... }           // Updated teacher data
}
Error codes:
  - MISSING_PASSWORDS (400) - missing fields
  - INVALID_PASSWORD (401) - current password wrong
  - WEAK_PASSWORD (400) - newPassword < 6 chars
  - SAME_PASSWORD (400) - same as current
```
Source: `api/auth/auth.service.js` lines 360-446, `api/auth/auth.controller.js` lines 223-278

### Frontend API Method to Add
```typescript
// In apiService.js, auth section:
async changePassword(currentPassword, newPassword) {
  const response = await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword
  });
  // Update stored tokens
  if (response.accessToken) {
    localStorage.setItem('accessToken', response.accessToken);
  }
  if (response.refreshToken) {
    localStorage.setItem('refreshToken', response.refreshToken);
  }
  return response;
}
```

### Password Strength Calculator
```typescript
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 6) score++   // minimum
  if (password.length >= 8) score++   // decent
  if (password.length >= 10) score++  // good length
  if (/[A-Z]/.test(password)) score++ // uppercase
  if (/[0-9]/.test(password)) score++ // numbers
  if (/[^A-Za-z0-9]/.test(password)) score++ // symbols

  if (score <= 2) return { score, label: 'חלשה', color: 'danger' }
  if (score <= 4) return { score, label: 'בינונית', color: 'warning' }
  return { score, label: 'חזקה', color: 'success' }
}
```

### Admin Conservatory-Wide Stats Loading
```typescript
// Reuse same pattern as Dashboard.tsx loadDashboardData
const [students, teachers, orchestras] = await Promise.allSettled([
  apiService.students.getStudents(filters),
  apiService.teachers.getTeachers(filters),
  apiService.orchestras.getOrchestras(filters),
])
// Then count: studentsData.length, teachersData.length, orchestrasData.length
```

### GlassStatCard Usage
```tsx
<GlassStatCard
  value={statistics?.studentsCount ?? 0}
  label="סה״כ תלמידים"
  loading={loadingStats}
  size="sm"
/>
```

### Animated Tabs with Role-Based Visibility
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    {tabs.map((tab) => (
      <TabsTrigger key={tab.id} value={tab.id}>
        <Icon className="w-4 h-4" />
        <span>{tab.label}</span>
      </TabsTrigger>
    ))}
  </TabsList>
  <TabsContents>
    {tabs.map((tab) => (
      <TabsContent key={tab.id} value={tab.id}>
        {activeTab === tab.id && <tab.component />}
      </TabsContent>
    ))}
  </TabsContents>
</Tabs>
```

## State of the Art

| Old Approach (Current Profile.tsx) | New Approach (Phase 82 Target) | Impact |
|---|---|---|
| Single-column layout with stats above tabs | 3-column dashboard: profile card + stats + widgets | Richer visual density |
| Same stats for all roles | Admin sees conservatory totals, teacher sees personal stats | Role-appropriate data |
| No password management | Credentials tab with current+new+confirm+strength | Self-service credential management |
| No contact quick actions | Phone/Email/WhatsApp Popovers | Matches student ProfileCard |
| No profile sidebar card | Dedicated ProfileSidebar with gradient header | Consistent with Student Details |

**What's already done:**
- Gradient header with curved SVG wave and overlapping avatar -- DONE in current Profile.tsx
- GlassStatCard row with role-aware stats -- DONE (though same stats for teacher/admin)
- Animated tabs with role-based visibility -- DONE
- Design system tokens (rounded-card, border-border, shadow-1) -- PARTIALLY DONE (Profile.tsx uses them, GeneralInfoTab mostly uses them)

## Open Questions

1. **Should the 3-column layout include a dedicated profile card column, or keep the existing header-above-tabs approach?**
   - What we know: StudentDashboardView uses a 3-column grid with ProfileCard as first column. Current Profile.tsx has header as a separate full-width card above everything.
   - Recommendation: Convert to 3-column layout matching StudentDashboardView. Move profile identity info into a dedicated ProfileSidebar card (right column in RTL), put stats+role widgets in center/left columns. Keep the gradient header for the page but extract it into a reusable component.

2. **Admin stats: should we add a dedicated backend endpoint or reuse existing list endpoints?**
   - What we know: Dashboard.tsx loads all students/teachers/orchestras and counts them client-side. This works fine for conservatory sizes (50-200 records each).
   - Recommendation: Reuse existing list endpoints for MVP. Add count-only endpoints as future optimization if needed.

3. **Where to store the `changePassword` API method -- auth section of apiService or teacherService?**
   - What we know: `forcePasswordChange` is in `apiService.auth`. The backend route is `POST /auth/change-password` (under auth routes, not teacher routes).
   - Recommendation: Add to `apiService.auth` section, next to `forcePasswordChange`.

## Sources

### Primary (HIGH confidence)
- `src/pages/Profile.tsx` -- Current profile page implementation (472 lines)
- `src/features/students/details/components/dashboard/StudentDashboardView.tsx` -- Target layout pattern
- `src/features/students/details/components/dashboard/ProfileCard.tsx` -- Target card pattern with gradient/avatar/popovers
- `src/components/ui/GlassStatCard.tsx` -- Glass stat card component API
- `src/components/ui/animated-tabs.tsx` -- Tab component API
- `api/auth/auth.service.js` -- Backend changePassword implementation (lines 360-446)
- `api/auth/auth.route.js` -- Route: `POST /auth/change-password` (line 42)
- `api/auth/auth.controller.js` -- Controller handler (lines 223-278)
- `src/components/profile/GeneralInfoTab.tsx` -- Current general info tab
- `src/pages/ForcePasswordChange.tsx` -- Existing password UI patterns

### Verified Facts
- Backend `changePassword` validates current password, enforces min 6 chars, checks not-same, returns new tokens
- Frontend apiService has NO `changePassword` method -- only `forcePasswordChange`
- Profile.tsx already uses design system tokens (rounded-card, border-border, shadow-1)
- Profile.tsx already has gradient header + curved SVG + overlapping HeroUI avatar
- Dashboard.tsx loads admin stats by fetching all records and counting client-side

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already exist in the codebase
- Architecture: HIGH - Patterns directly observed from StudentDashboardView and current Profile.tsx
- Pitfalls: HIGH - Based on actual code analysis of token handling, RTL patterns, and existing password flows
- Backend: HIGH - changePassword endpoint fully implemented and tested

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- all patterns are internal codebase patterns)
