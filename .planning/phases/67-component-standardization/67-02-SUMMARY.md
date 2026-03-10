---
phase: 67-component-standardization
plan: 02
subsystem: ui
tags: [cva-button, action-button, delegation, input-tokens, dialog-tokens, css-deprecation]

requires:
  - phase: 67-component-standardization
    plan: 01
    provides: "CVA Card variants, neutral/semantic token migration in ui/ components"
provides:
  - "ActionButton delegates to CVA Button — single canonical button implementation"
  - "Legacy .btn-* CSS classes marked DEPRECATED in components.css and index.css"
  - "Input horizontal padding uses spacing-element token"
  - "Dialog padding uses spacing-card token"
  - "DialogTitle and EmptyState heading use text-h3 semantic type scale"
affects: [67-03, 69-css-cleanup]

tech-stack:
  added: []
  patterns:
    - "ActionButton as thin wrapper delegating to CVA Button with variant/size mapping"
    - "Token-backed spacing (spacing-element, spacing-card) instead of hardcoded Tailwind values"
    - "CSS deprecation comments with migration target phase reference"

key-files:
  created: []
  modified:
    - "src/components/ui/DesignSystem.tsx"
    - "src/components/ui/input.tsx"
    - "src/components/ui/dialog.tsx"
    - "src/styles/components.css"
    - "src/index.css"

key-decisions:
  - "ActionButton maps primary->default, secondary->secondary, danger->destructive, success->default+className override"
  - "Dialog gap-4 kept as-is (16px reasonable for dialog sections, no exact token match)"
  - "DialogTitle text-h3 is deliberate 2px increase (18px->20px) for Hebrew readability"
  - "Input py-2 kept as-is (no semantic token for vertical input padding)"

duration: 3min
completed: 2026-03-10
---

# Phase 67 Plan 02: Button Consolidation, Input/Dialog Token Standardization Summary

**ActionButton delegates to CVA Button, .btn-* CSS deprecated, Input/Dialog use token-backed spacing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T22:04:03Z
- **Completed:** 2026-03-10T22:07:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ActionButton now renders CVA Button internally with variant/size prop mapping (no standalone button implementation)
- Success variant uses className override for bg-success-500 colors
- Loading spinner and icon props pass through as Button children
- EmptyState heading uses text-h3 semantic type scale (was text-xl font-semibold)
- Legacy .btn-* CSS classes in components.css have block deprecation comment referencing Phase 69 cleanup
- Legacy .btn class in index.css has inline deprecation comment
- Input horizontal padding changed from px-3 to px-spacing-element (same 12px value, now token-backed)
- Dialog padding changed from p-6 to p-spacing-card (same 24px value, now token-backed)
- DialogTitle changed from text-lg font-semibold to text-h3 (20px/600 semantic type scale)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor ActionButton to delegate to CVA Button + deprecate .btn-* CSS** - `2511780` (feat)
2. **Task 2: Standardize Input and Dialog with token-backed spacing** - `5906834` (feat)

## Files Created/Modified
- `src/components/ui/DesignSystem.tsx` - ActionButton delegates to CVA Button, EmptyState uses text-h3
- `src/components/ui/input.tsx` - px-spacing-element replaces px-3
- `src/components/ui/dialog.tsx` - p-spacing-card replaces p-6, text-h3 replaces text-lg font-semibold
- `src/styles/components.css` - DEPRECATED block comment on .btn-* section
- `src/index.css` - DEPRECATED inline comment on .btn class

## Decisions Made
- ActionButton variant mapping: primary->default, secondary->secondary, danger->destructive, success->default with className override
- Dialog gap-4 (16px) kept as-is -- spacing-element (12px) too tight, spacing-card (24px) too wide for section gaps
- DialogTitle text-h3 is a deliberate 2px increase (18px to 20px) per Phase 66 Hebrew readability decision
- Input py-2 remains hardcoded -- no semantic token exists for vertical input padding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CVA Button is now the single canonical button (ActionButton delegates to it)
- All shared Input/Dialog components use token-backed spacing
- Ready for Plan 03 (remaining component standardization)
- Pre-existing TypeScript errors in BagrutCard.tsx, BagrutForm.tsx, AdditionalRehearsalsModal.tsx are unrelated

---
*Phase: 67-component-standardization*
*Completed: 2026-03-10*
