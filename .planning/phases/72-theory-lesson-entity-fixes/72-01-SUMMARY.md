---
phase: 72-theory-lesson-entity-fixes
plan: 01
subsystem: ui
tags: [react, roles, theory-lessons, backward-compat, rbac]

requires:
  - phase: 17-rbac-admin-provisioning
    provides: Normalized role names (תאוריה instead of מורה תאוריה)
provides:
  - Theory lesson teacher dropdown filters matching both normalized and legacy role names
  - TeacherForm instrument validation using normalized role
  - Profile.tsx theory teacher detection without dead English role strings
affects: [72-02-theory-lesson-entity-fixes]

tech-stack:
  added: []
  patterns:
    - "Dual-role filter pattern: roles.some(r => r === 'תאוריה' || r === 'מורה תאוריה') for backward compat"

key-files:
  created: []
  modified:
    - src/components/TheoryLessonForm.tsx
    - src/components/BulkTheoryUpdateTab.tsx
    - src/components/TeacherForm.tsx
    - src/pages/Profile.tsx
    - src/components/TeacherCard.tsx
    - src/components/teachers/RoleDistributionPanel.tsx

key-decisions:
  - "Dual-role check (תאוריה + מורה תאוריה) for API-facing filters since DB may have either string"
  - "TeacherForm uses only normalized role since VALID_ROLES already has תאוריה — no backward compat needed there"
  - "Display-only color maps retain legacy entries as backward compat"
  - "Profile.tsx removed dead 'theory_teacher' English role, added 'תאוריה' case in display switch"

patterns-established:
  - "Role normalization: functional filters use dual-check, form creation uses normalized only, display maps keep both"

duration: 7min
completed: 2026-03-12
---

# Phase 72 Plan 01: Theory Teacher Role Normalization Summary

**Fixed critical theory lesson teacher dropdown bug by normalizing role filters from legacy 'מורה תאוריה' to 'תאוריה' with backward-compat fallback across 6 frontend files**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T16:12:30Z
- **Completed:** 2026-03-12T16:19:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Fixed empty teacher dropdown in theory lesson forms (TheoryLessonForm + BulkTheoryUpdateTab)
- Normalized TeacherForm instrument validation to use 'תאוריה' role
- Removed dead 'theory_teacher' English role reference from Profile.tsx
- Added backward-compat comments to display color maps in TeacherCard and RoleDistributionPanel

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix theory teacher dropdown filters** - `c75224e` (fix)
2. **Task 2: Normalize remaining frontend role references** - `085fe17` (fix)

## Files Created/Modified
- `src/components/TheoryLessonForm.tsx` - Theory teacher dropdown filter uses dual-role check
- `src/components/BulkTheoryUpdateTab.tsx` - Bulk update teacher filter uses dual-role check
- `src/components/TeacherForm.tsx` - Instrument requirement validation uses normalized 'תאוריה'
- `src/pages/Profile.tsx` - Theory teacher detection uses 'תאוריה' with legacy fallback
- `src/components/TeacherCard.tsx` - Updated backward-compat comments on color maps
- `src/components/teachers/RoleDistributionPanel.tsx` - Updated backward-compat comments

## Decisions Made
- Dual-role check pattern for API-facing filters (DB may have either role string)
- TeacherForm uses only normalized role (VALID_ROLES already has 'תאוריה')
- Display-only color maps retain legacy entries for backward compatibility
- Removed dead 'theory_teacher' English role from Profile, added normalized 'תאוריה' case

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in memoryManager.ts and securityUtils.ts (WeakRef, type mismatches) -- unrelated to our changes, not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Role normalization complete for theory lesson entity files
- Plan 72-02 can proceed with theory lesson entity fixes (if applicable)
- Note: Other files (Dashboard, Header, Layout, Sidebar, BagrutRoleView) still reference 'theory_teacher' -- these are outside scope of this plan

---
*Phase: 72-theory-lesson-entity-fixes*
*Completed: 2026-03-12*
