# Phase 74: Teacher Hours UI & Dashboard Integration - Research

**Researched:** 2026-03-14
**Domain:** Frontend UI integration (React + TypeScript + HeroUI + Tailwind)
**Confidence:** HIGH

## Summary

Phase 74 is a frontend-only phase that wires existing backend hours APIs (Phase 73) into the Teachers list page and admin Dashboard. The backend infrastructure is complete: `GET /hours-summary` returns all teacher hour summaries, `POST /hours-summary/calculate` triggers bulk recalculation, and the teacher list API already returns `weeklyHoursSummary` on each teacher document (dual-write from Phase 73). The frontend `hoursSummaryService` in `apiService.js` already has all four API methods implemented (`getAllSummaries`, `getTeacherSummary`, `calculateTeacher`, `calculateAll`).

The Teachers list page (`src/pages/Teachers.tsx`) currently has 4 GlassStatCard stats, a HeroUI table with 6 columns (name, specialization, roles, studentCount, status, actions), and client-side filtering. The existing `totalTeachingHours` field comes from time block durations (minutes), NOT from the hours-summary calculation. This needs to be replaced with `weeklyHoursSummary.totalWeeklyHours` from the backend. The Dashboard (`src/pages/Dashboard.tsx`) has a `TeacherPerformanceTable` component that shows teacher name, department, student count, and status -- but no hours. There is also an unused `AdminHoursOverview` component already defined at the bottom of Dashboard.tsx that renders a full hours table with recalculate button.

The key implementation challenge is that auto-recalculation on assignment changes does NOT exist on the backend. The `student.service.js` `updateStudent` function does not call `calculateTeacherHours` when `teacherAssignments` change. This means either: (a) add a backend hook in student service to trigger recalculation, or (b) have the frontend trigger recalculation after assignment mutations. Option (a) is cleaner and more reliable.

**Primary recommendation:** Add `weeklyHours` column to Teachers table reading from `weeklyHoursSummary.totalWeeklyHours` (already on teacher docs), add workload color coding, add a dashboard workload widget replacing/augmenting the existing `TeacherPerformanceTable`, and add a backend hook in `student.service.js` to recalculate hours after assignment changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18 | UI framework | Already in use |
| TypeScript | 5.x | Type safety | Already in use |
| HeroUI | latest | Table, Button, Badge, Pagination components | Project standard per CLAUDE.md |
| Tailwind CSS | 3.x | Styling, color coding utilities | Already in use |
| @phosphor-icons/react | latest | Icons (ClockIcon, ArrowsClockwiseIcon) | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| apiService.js | N/A | `hoursSummaryService` methods | All hours API calls |
| GlassStatCard | N/A | Stat cards on Teachers page | Hours-related stats |
| StatCard (v4) | N/A | Dashboard stat cards | Dashboard workload widget |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline color coding | CVA Badge component | Badge is better for semantic "green/yellow/red" but inline Tailwind classes match existing Teachers page patterns |
| React Query | Manual useState+useEffect | React Query would be ideal but Teachers page currently uses manual fetching -- match existing pattern for consistency |

**Installation:**
No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Data Flow for Teacher Hours
```
Backend (already done):
  teacher.weeklyHoursSummary.totalWeeklyHours  <-- dual-write from hours_summary collection
  GET /teacher  -->  enriched with weeklyHoursSummary  <-- already in teacher.service.js line 982

Frontend (to build):
  apiService.teachers.getTeachers()  -->  teacher.weeklyHoursSummary passes through
  Teachers.tsx transforms:  totalWeeklyHours = teacher.weeklyHoursSummary?.totalWeeklyHours || 0
```

### Pattern 1: Workload Color Coding
**What:** Green/yellow/red color coding based on weekly hours thresholds
**When to use:** Hours column in Teachers table, dashboard workload bars
**Example:**
```typescript
// Workload color utility
function getWorkloadColor(hours: number): { bg: string; text: string; label: string } {
  if (hours >= 20) return { bg: 'bg-red-50', text: 'text-red-700', label: 'עומס גבוה' }
  if (hours >= 15) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'עומס בינוני' }
  return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'תקין' }
}
```

### Pattern 2: Teachers Table Column Addition
**What:** Add `weeklyHours` column to HeroUI table
**When to use:** Teachers.tsx heroColumns array and renderCell switch
**Example:**
```typescript
// Add to heroColumns array (after studentCount, before status)
{ uid: 'weeklyHours', name: 'ש"ש' }

// Add to renderCell switch
case 'weeklyHours': {
  const hours = teacher.weeklyHours || 0
  const { bg, text } = getWorkloadColor(hours)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>
      {hours}
    </span>
  )
}
```

### Pattern 3: Dashboard Workload Widget
**What:** Horizontal bar chart showing top teachers by hours, with color-coded bars
**When to use:** Dashboard admin view, Section 4 area (alongside TeacherPerformanceTable)
**Example:**
```typescript
// Fetch hours summaries in Dashboard.loadDashboardData()
// hoursSummaryService.getAllSummaries() already exists
// Sort by totalWeeklyHours descending, take top 8
// Render horizontal bars like the existing instrumentDistribution chart
```

### Pattern 4: Bulk Recalculate Button
**What:** Admin-only button that triggers POST /hours-summary/calculate
**When to use:** Teachers page header (near "Add Teacher") and Dashboard workload widget
**Example:**
```typescript
// Use existing hoursSummaryService.calculateAll()
// Show loading spinner (ArrowsClockwiseIcon with animate-spin)
// Refresh teacher list after completion
```

### Recommended Project Structure
```
src/
  pages/Teachers.tsx                    # Modified: add hours column, stat cards, recalc button
  pages/Dashboard.tsx                   # Modified: add workload widget, load hours data
  components/dashboard/v4/
    TeacherWorkloadWidget.tsx           # NEW: horizontal bar chart with hours
  utils/workloadColors.ts              # NEW: shared color coding utility
```

### Anti-Patterns to Avoid
- **Using totalTeachingHours from time blocks:** The existing `totalTeachingHours` in `apiService.js` calculates from `teaching.timeBlocks` duration (raw minutes). Use `weeklyHoursSummary.totalWeeklyHours` instead -- it includes individual lessons, orchestras, theory, management, etc.
- **Calling calculateAll on page load:** This is an expensive operation. Only trigger on explicit admin action (button click), not automatically.
- **Building a separate hours fetch:** The teacher list API already returns `weeklyHoursSummary`. No need for a parallel `hoursSummaryService.getAllSummaries()` call on the Teachers page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color-coded badges | Custom styled div | Shared utility function + Tailwind classes | Consistency across Teachers table and Dashboard |
| Sortable table columns | Custom sort implementation | HeroUI Table `sortDescriptor` prop | Already supported by HeroUI Table |
| Hours stat calculation | Manual aggregation | Compute from `teachers[]` array in useMemo | Data already loaded, just aggregate client-side |
| Horizontal bar chart | Custom SVG bars | Copy pattern from Dashboard instrumentDistribution | Already proven pattern in the codebase |

**Key insight:** Almost everything needed already exists in the codebase. The `AdminHoursOverview` component in Dashboard.tsx (lines 637-737) has a working recalculate button and hours table -- it just isn't wired into the main admin dashboard view. The instrument distribution horizontal bar chart in Dashboard provides the exact visual pattern needed for the workload widget.

## Common Pitfalls

### Pitfall 1: Wrong Hours Data Source
**What goes wrong:** Using `teacher.totalTeachingHours` (from time blocks, in minutes) instead of `teacher.weeklyHoursSummary.totalWeeklyHours` (calculated, in hours)
**Why it happens:** Teachers.tsx line 177 already computes `totalTeachingHours: Math.round((teacher.totalTeachingHours / 60) * 10) / 10` -- tempting to reuse
**How to avoid:** Always use `weeklyHoursSummary.totalWeeklyHours` which is the pre-calculated value from Phase 73
**Warning signs:** Hours showing as 0 for teachers with students but no time blocks

### Pitfall 2: weeklyHoursSummary May Be Null
**What goes wrong:** `weeklyHoursSummary` is null for teachers who haven't had hours calculated yet
**Why it happens:** Hours are only calculated when explicitly triggered (bulk recalculate or import)
**How to avoid:** Default to 0 with `teacher.weeklyHoursSummary?.totalWeeklyHours || 0` and show a "not calculated" indicator
**Warning signs:** NaN or undefined showing in the hours column

### Pitfall 3: apiService Transform Layer
**What goes wrong:** The `apiService.js` `getTeachers()` method (line 1383) spreads `...teacher` but also computes `totalTeachingHours` from time blocks. If the frontend reads `totalTeachingHours`, it gets the wrong value.
**Why it happens:** Two different "hours" concepts exist: time block durations vs. calculated weekly hours
**How to avoid:** Access `weeklyHoursSummary` directly from the spread teacher object (it passes through from `...teacher`). Add a new computed field like `weeklyHours: teacher.weeklyHoursSummary?.totalWeeklyHours || 0` in the apiService transform.
**Warning signs:** Hours column shows different values than the HoursSummaryTab on teacher details

### Pitfall 4: Auto-Recalculation Scope
**What goes wrong:** Triggering recalculation for ALL teachers when only one teacher's assignment changed
**Why it happens:** Using `calculateAll()` instead of `calculateTeacher(teacherId)`
**How to avoid:** Backend hook in student.service.js should call `calculateTeacherHours` for the specific affected teacher(s) only
**Warning signs:** Slow responses after student assignment changes

### Pitfall 5: Dashboard Already Has Unused Hours Code
**What goes wrong:** Creating duplicate hours fetching/display logic
**Why it happens:** Not noticing `AdminHoursOverview` component (line 637) and `hoursSummaries` state (line 64) already exist in Dashboard.tsx
**How to avoid:** Refactor `AdminHoursOverview` into the new workload widget, reuse existing state variables
**Warning signs:** Two different hours-related API calls in Dashboard

## Code Examples

### Teacher Interface Update (Teachers.tsx)
```typescript
interface Teacher {
  // ... existing fields ...
  weeklyHours: number  // from weeklyHoursSummary.totalWeeklyHours
  hoursBreakdown?: {
    individualLessons: number
    orchestraConducting: number
    theoryTeaching: number
    management: number
  }
}
```

### Teacher Transform Update (Teachers.tsx loadTeachers)
```typescript
const transformedTeachers = filteredTeachers.map(teacher => ({
  // ... existing fields ...
  weeklyHours: teacher.weeklyHoursSummary?.totalWeeklyHours || 0,
  hoursBreakdown: teacher.weeklyHoursSummary ? {
    individualLessons: teacher.weeklyHoursSummary.individualLessons || 0,
    orchestraConducting: teacher.weeklyHoursSummary.orchestraConducting || 0,
    theoryTeaching: teacher.weeklyHoursSummary.theoryTeaching || 0,
    management: teacher.weeklyHoursSummary.management || 0,
  } : null,
}))
```

### Hours Stats for GlassStatCards (Teachers.tsx)
```typescript
const avgWeeklyHours = activeTeachers > 0
  ? Math.round(teachers.reduce((sum, t) => sum + t.weeklyHours, 0) / activeTeachers * 10) / 10
  : 0
const overloadedTeachers = teachers.filter(t => t.weeklyHours >= 20).length
```

### Bulk Recalculate Button
```typescript
const [isRecalculating, setIsRecalculating] = useState(false)

const handleRecalculateAll = async () => {
  setIsRecalculating(true)
  try {
    await hoursSummaryService.calculateAll()
    await loadTeachers() // Refresh data
  } catch (err) {
    console.error('Error recalculating:', err)
  } finally {
    setIsRecalculating(false)
  }
}
```

### Backend Auto-Recalculation Hook (student.service.js)
```javascript
// In updateStudent(), after teacherAssignments change is persisted:
import { hoursSummaryService } from '../hours-summary/hours-summary.service.js';

// After successful update, if teacherAssignments changed:
const affectedTeacherIds = new Set([
  ...oldAssignments.map(a => a.teacherId),
  ...newAssignments.map(a => a.teacherId)
]);

// Fire-and-forget recalculation (don't block the response)
for (const tid of affectedTeacherIds) {
  hoursSummaryService.calculateTeacherHours(tid, schoolYearId, { context })
    .catch(err => console.error(`Hours recalc failed for ${tid}:`, err.message));
}
```

### HeroUI Table Sorting Support
```typescript
const [sortDescriptor, setSortDescriptor] = useState<{ column: string; direction: 'ascending' | 'descending' }>({
  column: 'name',
  direction: 'ascending'
})

// In useMemo for sorting:
const sortedTeachers = [...filteredTeachers].sort((a, b) => {
  if (sortDescriptor.column === 'weeklyHours') {
    return sortDescriptor.direction === 'ascending'
      ? a.weeklyHours - b.weeklyHours
      : b.weeklyHours - a.weeklyHours
  }
  // ... other sort cases
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `totalTeachingHours` from time blocks | `weeklyHoursSummary.totalWeeklyHours` from calculation | Phase 73 (2026-03-14) | Accurate hours including all categories |
| No hours on teacher document | Dual-write: hours_summary + teacher.weeklyHoursSummary | Phase 73 | Fast list/dashboard access without join |
| Manual-only recalculation | Needs auto-recalculation on assignment changes | Phase 74 target | Keeps hours current |

**Deprecated/outdated:**
- `totalTeachingHours` from `teaching.timeBlocks`: Only counts scheduled time block minutes, misses individual lessons, theory, management hours. Keep for backward compat but don't use for display.

## Open Questions

1. **Auto-recalculation trigger scope**
   - What we know: Backend has no hook for auto-recalculation after assignment changes
   - What's unclear: Should this also trigger on orchestra assignment changes, theory lesson changes, or just student teacherAssignments?
   - Recommendation: Start with student teacherAssignment changes only (most common case). Other triggers can be added later.

2. **Sort persistence**
   - What we know: Teachers page persists search/filter state in URL params
   - What's unclear: Should sort column/direction also persist in URL?
   - Recommendation: Yes, add `sort` and `dir` params for consistency with existing pattern

3. **Dashboard widget placement**
   - What we know: Dashboard has Section 4 with TeacherPerformanceTable + rehearsal tracker
   - What's unclear: Should the workload widget replace TeacherPerformanceTable or be a new section?
   - Recommendation: Augment TeacherPerformanceTable with an hours column, and add a new "teacher workload" glassmorphic widget similar to instrument distribution

## Sources

### Primary (HIGH confidence)
- Backend codebase: `api/hours-summary/hours-summary.service.js` -- dual-write architecture, calculation logic
- Backend codebase: `api/hours-summary/hours-summary.route.js` -- 4 endpoints (GET /, GET /teacher/:id, POST /calculate/:id, POST /calculate)
- Backend codebase: `api/teacher/teacher.service.js` line 982 -- `weeklyHoursSummary` included in teacher list response
- Frontend codebase: `src/services/apiService.js` lines 5247-5290 -- `hoursSummaryService` with all 4 methods
- Frontend codebase: `src/pages/Teachers.tsx` -- current table structure, stat cards, filtering patterns
- Frontend codebase: `src/pages/Dashboard.tsx` -- existing `AdminHoursOverview`, `TeacherPerformanceTable`, chart patterns
- Frontend codebase: `src/components/ui/GlassStatCard.tsx` -- stat card component API
- Frontend codebase: `src/features/teachers/details/components/tabs/HoursSummaryTab.tsx` -- existing per-teacher hours display

### Secondary (MEDIUM confidence)
- HeroUI Table sortDescriptor API -- based on codebase usage patterns (verified in existing Table usage)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, verified in codebase
- Architecture: HIGH - backend APIs exist and return correct data, verified by reading service code
- Pitfalls: HIGH - identified from actual codebase inspection (two different "hours" concepts, null handling, existing unused code)
- Auto-recalculation: MEDIUM - backend hook approach is clean but requires modifying student.service.js (backend change in a "frontend-only" phase)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- internal codebase, no external dependency changes expected)
