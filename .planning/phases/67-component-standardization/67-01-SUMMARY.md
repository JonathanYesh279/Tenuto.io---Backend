---
phase: 67-component-standardization
plan: 01
subsystem: ui
tags: [tailwind, cva, design-tokens, semantic-colors, neutral-scale, density-tokens]

requires:
  - phase: 66-design-system-foundation
    provides: "neutral color scale, semantic tokens (success, foreground), shadow tokens, typography scale, table density tokens"
provides:
  - "Zero gray-NNN classes in src/components/ui/ -- all migrated to neutral-NNN or semantic tokens"
  - "Badge success variant using bg-success semantic token"
  - "Card CVA variants (default/elevated/outlined) with preserved hover prop"
  - "Table density token spacing (table-cell-px, table-cell-py, table-header-py)"
  - "CardTitle using text-h2 semantic type scale"
affects: [67-02, 67-03, 68-layout-primitives, 69-css-cleanup]

tech-stack:
  added: []
  patterns:
    - "CVA card variants pattern for shadow/border control"
    - "Semantic color tokens (bg-success, text-foreground, text-muted-foreground) preferred over raw scale for primary/secondary text"
    - "Density tokens for table cell padding instead of hardcoded px-4 py-3"

key-files:
  created: []
  modified:
    - "src/components/ui/badge.tsx"
    - "src/components/ui/Card.tsx"
    - "src/components/ui/Table.tsx"
    - "src/components/ui/DesignSystem.tsx"
    - "src/components/ui/ConfirmDeleteDialog.tsx"
    - "src/components/ui/ConfirmationModal.tsx"

key-decisions:
  - "Use text-foreground/text-muted-foreground semantic tokens for dialog text instead of neutral-900/neutral-700"
  - "Keep graduated (purple) and pending (orange) badge variants as-is -- no semantic token equivalent"
  - "CardTitle uses text-h2 (includes font-weight:600) so font-semibold removed to avoid redundancy"

patterns-established:
  - "CVA variants on Card: default=shadow-1, elevated=shadow-2, outlined=shadow-none+border-2"
  - "hover prop kept separate from CVA variants (boolean, not a variant axis)"

duration: 8min
completed: 2026-03-10
---

# Phase 67 Plan 01: Component Standardization - Token Adoption Summary

**Migrated all gray-NNN to neutral-NNN/semantic tokens in ui/ components, added CVA Card variants, and applied table density tokens**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T21:55:54Z
- **Completed:** 2026-03-10T22:04:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Eliminated all gray-NNN Tailwind classes from src/components/ui/ (replaced with neutral-NNN or semantic tokens)
- Badge success variant now uses bg-success semantic token instead of bg-green-500
- Card component has CVA variants (default/elevated/outlined) with backward-compatible default
- Table cells use density tokens (table-cell-px, table-cell-py, table-header-py) instead of hardcoded px-4 py-3
- CardTitle uses text-h2 semantic type scale (24px/600, identical visual output)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate gray-NNN to neutral-NNN + semantic tokens** - `08e79f9` (feat)
2. **Task 2: Add CVA variants to Card component** - `09881fa` (feat)

## Files Created/Modified
- `src/components/ui/badge.tsx` - Success uses bg-success, inactive uses bg-neutral-100
- `src/components/ui/Card.tsx` - CVA cardVariants, text-h2 CardTitle, exported cardVariants
- `src/components/ui/Table.tsx` - Density token spacing, neutral StatusBadge
- `src/components/ui/DesignSystem.tsx` - Neutral StatusBadge inactive variant
- `src/components/ui/ConfirmDeleteDialog.tsx` - text-foreground for item name
- `src/components/ui/ConfirmationModal.tsx` - text-muted-foreground for description

## Decisions Made
- Used text-foreground/text-muted-foreground semantic tokens for dialog text rather than neutral-900/neutral-700 -- semantic tokens are more maintainable and dark-mode-ready
- Kept graduated (purple) and pending (orange) badge variants unchanged -- no semantic token equivalents exist yet
- CardTitle text-h2 includes font-weight:600 via the type scale definition, so font-semibold was removed to avoid redundancy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All ui/ shared components now use token-backed classes (neutral, semantic, density)
- Card CVA pattern established -- ready for Plan 02 (Button/Dialog standardization)
- Pre-existing TypeScript errors in BagrutCard.tsx (padding prop) and BagrutForm.tsx are unrelated to this plan

---
*Phase: 67-component-standardization*
*Completed: 2026-03-10*
