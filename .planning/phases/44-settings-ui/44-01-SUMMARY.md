---
phase: 44-settings-ui
plan: 01
subsystem: ui
tags: [react, rbac, settings, tabs, radix, modal]

requires:
  - phase: 43-permission-configuration-api-safeguards
    provides: GET /api/settings/roles, PUT /api/teacher/:id/roles endpoints

provides:
  - RBAC constants in frontend enums.ts (TEACHER_ROLES, ROLE_TIERS, etc.)
  - rolesService in apiService.js (getRoles, updateTeacherRoles, etc.)
  - Tabbed Settings page with general and roles tabs
  - StaffRoleTable component with role badges and edit modal
  - EditRoleModal with tier-grouped checkboxes and department coordinator support

affects: [settings-ui, permission-matrix-ui]

tech-stack:
  added: []
  patterns:
    - Role badges colored by tier (admin=red, coordinator=blue, teaching=green, view-only=gray)
    - Radix Tabs for sub-page navigation within Settings

key-files:
  created:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/settings/StaffRoleTable.tsx
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/components/settings/EditRoleModal.tsx
  modified:
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/constants/enums.ts
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js
    - /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/Settings.tsx

key-decisions:
  - "Save button moved inside general tab (not relevant for roles tab)"
  - "Role badges colored by tier for visual hierarchy: admin red, coordinator blue, teaching green, view-only gray"
  - "Department coordinator section uses blue-themed box to distinguish from regular role checkboxes"

duration: 13min
completed: 2026-03-05
---

# Phase 44 Plan 01: Settings UI - Staff Role Assignment Summary

**Tabbed Settings page with staff role table, tier-grouped role checkboxes, and department coordinator multi-select**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-05T09:51:05Z
- **Completed:** 2026-03-05T10:04:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added all RBAC constants to frontend (TEACHER_ROLES, ROLE_TIERS, PERMISSION_DOMAIN_LABELS, etc.)
- Added rolesService to apiService.js with 4 methods matching backend endpoints
- Refactored Settings page to tabbed layout using Radix Tabs
- Created StaffRoleTable with sorted teacher list, tier-colored role badges, and edit buttons
- Created EditRoleModal with grouped checkboxes and conditional department multi-select

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RBAC constants and API service methods** - `5caccd6` (feat)
2. **Task 2: Refactor Settings page to tabs and add staff role assignment UI** - `41842e7` (feat)

## Files Created/Modified
- `src/constants/enums.ts` - RBAC constants (TEACHER_ROLES, ROLE_TIERS, PERMISSION_DOMAIN_LABELS, etc.)
- `src/services/apiService.js` - rolesService with getRoles, updateRolePermissions, resetRolePermissions, updateTeacherRoles
- `src/pages/Settings.tsx` - Refactored to tabbed layout with general settings and roles tabs
- `src/components/settings/StaffRoleTable.tsx` - Staff table with role badges and edit button per row
- `src/components/settings/EditRoleModal.tsx` - Role assignment modal with tier-grouped checkboxes

## Decisions Made
- Save button placed inside general TabsContent rather than global header (only relevant for general settings)
- Role badges colored by tier for quick visual scanning (admin=red, coordinator=blue, teaching=green)
- Department coordinator section has distinct blue background to visually separate from role checkboxes
- Teachers sorted active-first, then alphabetically by lastName for consistent ordering
- Error codes (LAST_ADMIN, INVALID_ROLES, INVALID_DEPARTMENTS) mapped to Hebrew messages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Settings page ready for further RBAC UI features (permission matrix editor in future plans)
- All backend endpoints wired to frontend service layer
- Build passes successfully

---
*Phase: 44-settings-ui*
*Completed: 2026-03-05*
