---
phase: 74-teacher-hours-ui-dashboard-integration
plan: 01
subsystem: ui
tags: [react, heroui, tailwind, sorting, stat-cards, workload]

requires:
  - phase: 73-teacher-hours-import-refactor
    provides: weeklyHoursSummary dual-write on teacher documents

provides:
  - Shared workload color utility (workloadColors.ts)
  - Weekly hours column on Teachers table with color-coded badges
  - HeroUI table sorting for name, studentCount, weeklyHours
  - Average weekly hours and overloaded teacher count stat cards
  - Admin bulk recalculate button wired to hoursSummaryService.calculateAll()
  - GlassStatCard valueClassName prop for alert-colored values

affects: [teacher-details, dashboard, hours-summary]

tech-stack:
  added: []
  patterns:
    - "workloadColors utility for consistent green/yellow/red thresholds across UI"
    - "HeroUI sortDescriptor + onSortChange for client-side table sorting"

key-files:
  created:
    - src/utils/workloadColors.ts
  modified:
    - src/pages/Teachers.tsx
    - src/components/ui/GlassStatCard.tsx

key-decisions:
  - "GlassStatCard extended with valueClassName prop for red overloaded count (Rule 2 deviation)"
  - "weeklyHoursSummary.totalWeeklyHours used as data source, NOT totalTeachingHours (time blocks)"
  - "Sorting is client-side using useMemo with sortDescriptor state"

patterns-established:
  - "workloadColors.ts: getWorkloadColor(hours) returns {bg, text, label} for <15/15-20/20+ thresholds"
  - "GlassStatCard valueClassName prop overrides default text color for alert values"

duration: 7min
completed: 2026-03-14
---

# Phase 74 Plan 01: Teachers Page Hours Column & Stat Cards Summary

**Color-coded weekly hours column with sorting, workload stat cards, and admin recalculate button on Teachers list page**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T09:48:34Z
- **Completed:** 2026-03-14T09:55:33Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created shared workloadColors.ts utility for green/yellow/red hour thresholds
- Added weeklyHours column to Teachers table with color-coded badges (emerald <15, amber 15-20, red 20+)
- Added HeroUI table sorting support for name, student count, and weekly hours columns
- Replaced 4 stat cards with 5: kept totals/active/instruments, added average weekly hours and overloaded count
- Added admin-only "חשב ש"ש" bulk recalculate button with loading state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared workload color utility and add hours column to Teachers table** - `63b2b8d` (feat)

## Files Created/Modified
- `src/utils/workloadColors.ts` - Shared workload color coding utility (green/yellow/red thresholds)
- `src/pages/Teachers.tsx` - Teachers list with hours column, sorting, stat cards, recalc button
- `src/components/ui/GlassStatCard.tsx` - Added valueClassName prop for alert-colored values

## Decisions Made
- Used weeklyHoursSummary.totalWeeklyHours (from Phase 73 dual-write), NOT totalTeachingHours (time block minutes)
- Client-side sorting via useMemo + sortDescriptor state (all teachers loaded at once)
- Removed "ממוצע תלמידים/מורה" stat card (less useful) to make room for hours-related cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added valueClassName prop to GlassStatCard**
- **Found during:** Task 1 (stat cards implementation)
- **Issue:** Plan specifies `text-red-600` for overloaded count value, but GlassStatCard had no prop to override value text color
- **Fix:** Added optional `valueClassName` prop to GlassStatCard that overrides the default `text-slate-900` when provided
- **Files modified:** src/components/ui/GlassStatCard.tsx
- **Verification:** TypeScript compiles, prop correctly applied
- **Committed in:** 63b2b8d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Minor component enhancement necessary for plan requirements. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Teachers list page shows workload data from Phase 73 dual-write
- workloadColors.ts utility available for reuse in teacher details page (Plan 02)
- Ready for Plan 02 (Teacher Details Hours Summary Tab) and Plan 03 (Dashboard integration)

---
*Phase: 74-teacher-hours-ui-dashboard-integration*
*Completed: 2026-03-14*
