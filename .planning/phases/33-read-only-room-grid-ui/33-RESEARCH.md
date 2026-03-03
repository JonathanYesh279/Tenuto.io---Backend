# Phase 33: Read-Only Room Grid UI - Research

**Researched:** 2026-03-03
**Domain:** React frontend grid UI, RTL layout, data visualization, API integration
**Confidence:** HIGH

## Summary

Phase 33 builds the frontend visual grid that consumes the Phase 32 `GET /api/room-schedule?day=N` endpoint. The grid displays rooms as rows and 30-minute time slots as columns, with day tabs for switching weekdays, color-coded activity cells, conflict indicators, and a summary statistics bar. This is a read-only view -- drag-and-drop interaction is deferred to Phase 34.

The frontend stack is React 18 + TypeScript + Vite + Tailwind CSS with Radix UI primitives (tabs, tooltips, dialogs), Phosphor Icons, and `apiService.js` for all HTTP communication. The project does NOT use React Query for data fetching in most pages (Dashboard and others use direct `apiService` calls with `useState`/`useEffect`), though `@tanstack/react-query` is installed. The UI is entirely RTL Hebrew with hardcoded strings (no i18n). The grid is a custom HTML table/CSS grid -- no third-party grid or calendar library is needed for this read-only matrix view.

The API response (from Phase 32) returns `{ day, dayName, rooms: [{ room, activities: [...], hasConflicts }], unassigned: [...], summary: { totalRooms, totalActivities, conflictCount, sources }, timing }`. Each activity has `{ id, source, room, day, startTime, endTime, teacherName, teacherId, label, activityType, hasConflict, conflictGroupId }`. The frontend must transform this into a rooms-by-timeslots matrix, determine which 30-minute columns each activity spans, and render cells accordingly with color coding by `source` (timeBlock = blue, rehearsal = purple, theory = orange) and red border for `hasConflict: true`.

**Primary recommendation:** Build a new `RoomSchedule` page at `/room-schedule` with three sub-components: `DaySelector` (Radix Tabs), `RoomGrid` (CSS grid or HTML table with sticky row headers), and `SummaryBar` (stat cards). Use direct `apiService` calls with `useState`/`useEffect` to match existing page patterns. No new npm dependencies needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^18.3.1 | Component framework | Project standard |
| TypeScript | (project version) | Type safety | Project standard |
| Tailwind CSS | (project version) | Styling, RTL, responsive | Project standard |
| @radix-ui/react-tabs | ^1.1.13 | Day selector tabs | Already installed, used in project |
| @radix-ui/react-tooltip | ^1.2.8 | Activity cell tooltips | Already installed, used in project |
| @radix-ui/react-dialog | ^1.1.15 | Room settings modal | Already installed, used in project |
| @phosphor-icons/react | ^2.1.10 | Icons for stats, UI elements | Project standard |
| clsx | ^2.0.0 | Conditional CSS classes | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Variant-based cell styling | For activity type color variants |
| framer-motion | ^10.16.4 | Subtle entrance animations | Optional polish for grid loading |
| react-hot-toast | ^2.6.0 | Error notifications | API fetch errors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS grid | react-big-calendar | react-big-calendar is day/time calendar, not rooms-x-time matrix. Wrong abstraction for this layout. |
| Custom CSS grid | AG Grid / TanStack Table | Over-engineered for a read-only display grid. These are data table libraries, not schedule matrices. |
| Direct apiService calls | React Query (useQuery) | React Query is installed but most existing pages use direct calls with useState/useEffect. Follow existing patterns for consistency. Future refactor could adopt React Query project-wide. |

**Installation:**
```bash
# No new packages needed - all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    RoomSchedule.tsx          # Main page component (route: /room-schedule)
  components/
    room-schedule/
      DaySelector.tsx         # Day tabs (Sun-Fri) using Radix Tabs
      RoomGrid.tsx            # Main grid: rooms x time slots matrix
      ActivityCell.tsx         # Individual activity cell with color coding
      SummaryBar.tsx           # Statistics bar (rooms, occupied, free, conflicts)
      UnassignedRow.tsx        # Unassigned activities display
      RoomSettingsModal.tsx    # Quick-access room management modal
  services/
    apiService.js             # Add roomScheduleService export (new section)
```

### Pattern 1: Page Data Fetching (existing pattern)
**What:** Pages use `useState` + `useEffect` for data loading, calling `apiService` methods directly.
**When to use:** For the RoomSchedule page's initial load and day-change refetches.
**Example:**
```typescript
// Source: existing pages/Dashboard.tsx pattern
const [schedule, setSchedule] = useState<RoomScheduleResponse | null>(null)
const [loading, setLoading] = useState(true)
const [selectedDay, setSelectedDay] = useState(0) // Sunday

useEffect(() => {
  loadSchedule()
}, [selectedDay])

const loadSchedule = async () => {
  try {
    setLoading(true)
    const result = await roomScheduleService.getRoomSchedule(selectedDay)
    setSchedule(result)
  } catch (err) {
    toast.error('שגיאה בטעינת לוח החדרים')
    console.error(err)
  } finally {
    setLoading(false)
  }
}
```

### Pattern 2: API Service Extension (existing pattern)
**What:** Add a new named export to `apiService.js` following the same pattern as `tenantService`, `theoryService`, etc.
**When to use:** For all room-schedule API calls.
**Example:**
```javascript
// In apiService.js -- add new section
export const roomScheduleService = {
  async getRoomSchedule(day) {
    try {
      const response = await apiClient.get('/room-schedule', { day });
      return response;
    } catch (error) {
      console.error('Error fetching room schedule:', error);
      throw error;
    }
  },
};

// Also add to default export
export default {
  // ... existing services ...
  roomSchedule: roomScheduleService,
};
```

### Pattern 3: Time Slot Grid Layout with CSS Grid
**What:** A CSS grid where columns are 30-minute time slots (08:00-20:00 = 24 columns) and rows are rooms. Activities span multiple columns based on their duration.
**When to use:** For the main RoomGrid component.
**Example:**
```typescript
// Source: custom pattern for this feature
// Time range: 08:00 to 20:00 = 24 half-hour slots
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

// Calculate column span for an activity
function getGridColumns(startTime: string, endTime: string): { start: number; span: number } {
  const startMinutes = timeToMinutes(startTime) - 8 * 60 // offset from 08:00
  const endMinutes = timeToMinutes(endTime) - 8 * 60
  const startCol = Math.floor(startMinutes / 30) + 2 // +2 for room header column (1-based grid)
  const span = Math.ceil((endMinutes - startMinutes) / 30)
  return { start: startCol, span: Math.max(span, 1) }
}

// Grid CSS: first column is room name (sticky), remaining are time slots
// grid-template-columns: 120px repeat(24, minmax(80px, 1fr))
```

### Pattern 4: RTL Grid Layout
**What:** The grid must be RTL -- room names on the right, time progresses leftward. Since the app is RTL via Tailwind, `direction: rtl` is already applied. The grid needs to account for RTL direction in CSS grid positioning.
**When to use:** Always, for all grid rendering.
**Example:**
```typescript
// CSS grid in RTL: columns flow right-to-left naturally
// Room header is in the rightmost position (first column in RTL)
// Time slots flow from right (early) to left (late)
// Use `style={{ gridColumn: `${start} / span ${span}` }}` -- CSS grid handles RTL automatically

// Tailwind approach:
// <div className="grid overflow-x-auto" style={{
//   gridTemplateColumns: '120px repeat(24, minmax(80px, 1fr))',
//   direction: 'rtl'  // inherited from app root
// }}>
```

### Pattern 5: Color Coding by Activity Source
**What:** Activities are color-coded by their `source` field from the API response: `timeBlock` = blue (private lessons), `rehearsal` = purple, `theory` = orange. Conflicts get a red border.
**When to use:** For ActivityCell component styling.
**Example:**
```typescript
// Color map matching existing SimpleWeeklyGrid.tsx conventions
const ACTIVITY_COLORS = {
  timeBlock: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-900',
    label: 'שיעור פרטי',
  },
  rehearsal: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-900',
    label: 'חזרה',
  },
  theory: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-900',
    label: 'תאוריה',
  },
} as const

// Conflict styling override
const CONFLICT_STYLE = 'border-2 border-red-500 ring-2 ring-red-200'
```

### Pattern 6: Day Selector with Radix Tabs
**What:** Six tabs for Sunday through Friday using the existing Radix `Tabs` component.
**When to use:** For the DaySelector component.
**Example:**
```typescript
// Source: existing components/ui/tabs.tsx wrapper
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

<Tabs value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
  <TabsList>
    {DAY_NAMES.map((name, index) => (
      <TabsTrigger key={index} value={String(index)}>
        {name}
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

### Anti-Patterns to Avoid
- **Using react-big-calendar for this grid:** It is a calendar widget (time axis is vertical, days are columns). The room grid has time as columns and rooms as rows -- completely different layout.
- **One API call per room:** The Phase 32 API returns ALL rooms for a day in one call. Do not make per-room requests.
- **Re-computing conflicts on frontend:** The API already flags `hasConflict` and `conflictGroupId` on each activity. The frontend only needs to read these flags and apply styles.
- **Hardcoding room list:** The API response includes rooms with their activities. The room list comes from the API, not from a separate rooms query.
- **Ignoring empty rooms:** The API returns only rooms that have activities. The room list from `tenant.settings.rooms[]` (available in the Settings page) could be cross-referenced, but for Phase 33 the API response is sufficient -- empty rooms simply do not appear as rows. Phase 34/35 may add empty room rows for drag-drop targets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Day tab selector | Custom tab component | Radix `Tabs` (already installed) | Keyboard navigation, ARIA, focus management |
| Tooltip on hover | Custom tooltip div | Radix `Tooltip` (already installed) | Positioning, portal, accessibility |
| Modal for room settings | Custom overlay | Radix `Dialog` (already installed) | Focus trap, escape handling, portal |
| Time-to-column math | Per-component calculation | Shared `timeToMinutes` utility | Matches backend `utils/timeUtils.js` convention |
| Toast notifications | Custom notification | `react-hot-toast` (already installed) | Consistent with existing pages |
| CSS class merging | String concatenation | `clsx` + `cn` (already installed) | Project convention from `@/lib/utils` |

**Key insight:** The frontend already has all the UI primitives needed. The novel work is the CSS grid layout for the rooms-x-timeslots matrix and the data transformation from the API response shape to grid cell positions.

## Common Pitfalls

### Pitfall 1: Activities Spanning Partial Slots
**What goes wrong:** An activity from 14:00 to 14:45 spans 1.5 thirty-minute slots. Rounding to 1 slot cuts off content; rounding to 2 slots creates visual gap.
**Why it happens:** Not all activities align to 30-minute boundaries. Private lessons can be 30, 45, 60, or 90 minutes.
**How to avoid:** Use `Math.ceil((endMinutes - startMinutes) / 30)` for column span. A 45-minute lesson gets 2 columns (spanning the full hour visually). The cell content shows exact times. This matches the "30-minute grid resolution" requirement.
**Warning signs:** Cells look too narrow for their content, or cells overlap adjacent cells.

### Pitfall 2: Horizontal Scroll with Sticky Room Headers
**What goes wrong:** When the grid is wider than the viewport and the user scrolls horizontally, the room name column scrolls away and the user loses context of which room each row belongs to.
**Why it happens:** Standard CSS grid does not support `position: sticky` on grid items across the block axis in all browsers.
**How to avoid:** Use `position: sticky; right: 0; z-index: 10` on the room name cells (since the layout is RTL, the room header is on the right). Alternatively, use a two-part layout: a fixed-width room names column and a scrollable time-slots area, synced by shared row heights. The sticky approach is simpler.
**Warning signs:** Room names disappear when scrolling right-to-left (in RTL, this means scrolling to see later time slots).

### Pitfall 3: RTL Grid Column Ordering
**What goes wrong:** In RTL, CSS grid columns flow right-to-left. `grid-column: 2` refers to the second column from the right, not the left. Developers used to LTR may place activities in wrong columns.
**Why it happens:** CSS grid respects the `direction` property. In RTL, column 1 is the rightmost.
**How to avoid:** In RTL mode, column 1 = room header (rightmost), column 2 = first time slot (08:00), column 25 = last time slot (19:30). The `gridColumn` calculation `startCol / span N` works correctly because both room header and time slots are ordered the same way the grid renders. Test with known data: an 08:00 activity should appear immediately adjacent to the room header.
**Warning signs:** Activities appear at wrong times, or the grid looks reversed.

### Pitfall 4: Too Many Rooms Causing Vertical Overflow
**What goes wrong:** With 27 rooms (7 named + 20 numbered in seed data), the grid becomes very tall. Users cannot see summary statistics or navigate efficiently.
**Why it happens:** Each room row has a minimum height for readability (~60-80px), multiplied by 27 rooms = 1600-2160px.
**How to avoid:** Make the grid area scrollable vertically with a max-height (e.g., `calc(100vh - 200px)`). Use sticky column headers (time slots) at the top. The summary bar should be outside the scroll area (above or below).
**Warning signs:** Page is extremely long, summary bar requires scrolling to the very bottom.

### Pitfall 5: API Response Shape Mismatch
**What goes wrong:** The frontend expects a certain field name but the API uses a different one, causing undefined values in the grid.
**Why it happens:** Not verifying the actual API response from Phase 32 implementation.
**How to avoid:** The actual response shape from `room-schedule.service.js` is verified:
```
{
  day: number,
  dayName: string,
  rooms: [{ room: string, activities: [...], hasConflicts: boolean }],
  unassigned: [...],
  summary: { totalRooms, totalActivities, conflictCount, sources: { timeBlock, rehearsal, theory } },
  timing: { queryMs, sourceMs: { timeBlock, rehearsal, theory } }
}
```
Each activity has: `{ id, source, room, day, startTime, endTime, teacherName, teacherId, label, activityType, hasConflict, conflictGroupId }`.
Note: `summary.totalRooms` = rooms array length (only rooms with activities). Free slots must be computed on the frontend from `(totalRooms * 24 - occupiedSlots)`.
**Warning signs:** Blank cells where data should appear, undefined errors in console.

### Pitfall 6: Overlapping Activities in Same Room
**What goes wrong:** Two activities in the same room at the same time (a conflict) both try to occupy the same grid cells, causing visual overlap or one hiding the other.
**Why it happens:** The CSS grid places both activities in the same column range.
**How to avoid:** For conflicted activities in the same room, stack them vertically within the row (sub-rows) or show them as split cells. The simplest approach: increase the row height for rooms with conflicts and render conflicting activities stacked (one above the other within the same row). Each activity gets `hasConflict: true` from the API, so the frontend knows which cells need special layout.
**Warning signs:** Activities overlapping visually, some activities hidden behind others.

### Pitfall 7: Initial Day Selection
**What goes wrong:** The grid loads with Sunday (day 0) selected by default, but Sunday may have few/no activities, giving a misleading first impression.
**Why it happens:** Naive default of `useState(0)`.
**How to avoid:** Default to the current day of the week (`new Date().getDay()`), capped at 5 (Friday). If Saturday (6), default to 0 (Sunday). This shows the most relevant data on initial load.
**Warning signs:** Users always see an empty grid first and have to click to find populated days.

## Code Examples

Verified patterns from the existing codebase:

### apiService Extension for Room Schedule
```javascript
// Source: pattern from apiService.js tenantService section
export const roomScheduleService = {
  async getRoomSchedule(day) {
    try {
      const response = await apiClient.get('/room-schedule', { day });
      return response;
    } catch (error) {
      console.error('Error fetching room schedule:', error);
      throw error;
    }
  },

  async moveActivity(moveData) {
    try {
      const response = await apiClient.put('/room-schedule/move', moveData);
      return response;
    } catch (error) {
      console.error('Error moving activity:', error);
      throw error;
    }
  },
};
```

### Route Registration in App.tsx
```typescript
// Source: existing App.tsx pattern for admin-only pages
const RoomSchedule = lazyWithRetry(() => import('./pages/RoomSchedule'), 'RoomSchedule')

// In AppRoutes:
<Route
  path="/room-schedule"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout>
        <Suspense fallback={<LoadingSpinner text="loading room schedule..." />}>
          <RoomSchedule />
        </Suspense>
      </Layout>
    </ProtectedRoute>
  }
/>
```

### Sidebar Navigation Entry
```typescript
// Source: existing Sidebar.tsx adminNavigation array
// Add between 'חזרות' (rehearsals) and 'בגרויות' (bagruts) in the management category
{ name: 'לוח חדרים', href: '/room-schedule', Icon: CalendarIcon, category: 'management', roles: ['admin'] },
```

### TypeScript Interfaces for API Response
```typescript
// Derived from verified room-schedule.service.js response shape
interface RoomScheduleActivity {
  id: string
  source: 'timeBlock' | 'rehearsal' | 'theory'
  room: string
  day: number
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  teacherName: string
  teacherId: string
  label: string      // Student name, orchestra name, or category
  activityType: string  // Hebrew: שיעור פרטי, חזרה, תאוריה
  hasConflict: boolean
  conflictGroupId: string | null
}

interface RoomScheduleRoom {
  room: string
  activities: RoomScheduleActivity[]
  hasConflicts: boolean
}

interface RoomScheduleSummary {
  totalRooms: number
  totalActivities: number
  conflictCount: number
  sources: {
    timeBlock: number
    rehearsal: number
    theory: number
  }
}

interface RoomScheduleResponse {
  day: number
  dayName: string
  rooms: RoomScheduleRoom[]
  unassigned: RoomScheduleActivity[]
  summary: RoomScheduleSummary
  timing: {
    queryMs: number
    sourceMs: {
      timeBlock: number
      rehearsal: number
      theory: number
    }
  }
}
```

### Time Slot Calculation Utility
```typescript
// Frontend equivalent of backend utils/timeUtils.js
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Generate time slot headers (08:00 to 19:30 = 24 slots)
const GRID_START_HOUR = 8
const GRID_END_HOUR = 20
const SLOT_DURATION = 30

const TIME_SLOTS: string[] = []
for (let minutes = GRID_START_HOUR * 60; minutes < GRID_END_HOUR * 60; minutes += SLOT_DURATION) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}
// Result: ['08:00', '08:30', '09:00', ..., '19:30'] (24 entries)

// Calculate grid placement for an activity
function getActivityGridPlacement(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const gridStartMinutes = GRID_START_HOUR * 60

  // Clamp to grid boundaries
  const clampedStart = Math.max(startMinutes, gridStartMinutes)
  const clampedEnd = Math.min(endMinutes, GRID_END_HOUR * 60)

  // Column index (1-based, offset by 1 for room header column)
  const startCol = Math.floor((clampedStart - gridStartMinutes) / SLOT_DURATION) + 2
  const endCol = Math.ceil((clampedEnd - gridStartMinutes) / SLOT_DURATION) + 2

  return { startCol, endCol, span: endCol - startCol }
}
```

### Summary Statistics Calculation
```typescript
// Compute derived stats from API response
function computeStats(response: RoomScheduleResponse) {
  const totalSlots = response.rooms.length * TIME_SLOTS.length
  const occupiedSlotCount = response.rooms.reduce((sum, room) => {
    // Count unique slots occupied by activities in this room
    const occupied = new Set<number>()
    for (const activity of room.activities) {
      const start = timeToMinutes(activity.startTime)
      const end = timeToMinutes(activity.endTime)
      for (let t = start; t < end; t += SLOT_DURATION) {
        const slotIndex = Math.floor((t - GRID_START_HOUR * 60) / SLOT_DURATION)
        if (slotIndex >= 0 && slotIndex < TIME_SLOTS.length) {
          occupied.add(slotIndex)
        }
      }
    }
    return sum + occupied.size
  }, 0)

  return {
    totalRooms: response.summary.totalRooms,
    occupiedSlots: occupiedSlotCount,
    freeSlots: totalSlots - occupiedSlotCount,
    conflictCount: response.summary.conflictCount,
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-teacher schedule view (WeeklyCalendarGrid) | Room-centric grid (this phase) | Phase 33 | Admin sees all rooms simultaneously instead of one teacher at a time |
| react-big-calendar for schedule display | Custom CSS grid for room matrix | Phase 33 | react-big-calendar is a time-based calendar, not a rooms-x-time matrix |
| No room schedule UI | RoomSchedule page with grid | Phase 33 | First visual overview of room utilization |

**Existing components to learn from (not reuse directly):**
- `SimpleWeeklyGrid.tsx` -- Color coding conventions for activity types (blue=individual, purple=orchestra, orange=theory). Same colors should be used.
- `WeeklyCalendarGrid.tsx` -- Uses react-big-calendar for time-based display. Wrong abstraction for rooms-x-time matrix.
- `StatsCard.tsx` -- Reusable for summary statistics bar. Supports multiple color variants.
- Radix `Tabs` -- Already wrapped in `components/ui/tabs.tsx`. Use directly for day selector.

## Open Questions

1. **Grid Time Range (08:00-20:00)**
   - What we know: The existing WeeklyCalendarGrid uses 08:00-20:00. Seed data generates time blocks between 08:00 and 19:00.
   - What's unclear: Should the grid time range be fixed (08:00-20:00) or dynamic based on actual data?
   - Recommendation: Use fixed 08:00-20:00 (24 half-hour slots). This matches the existing calendar convention and provides a consistent grid width. Activities outside this range (unlikely but possible) are clipped to grid boundaries.

2. **Empty Rooms Display**
   - What we know: The API only returns rooms that have activities. The tenant may have rooms with no activities on a given day.
   - What's unclear: Should empty rooms (no activities) appear as rows in the grid?
   - Recommendation: For Phase 33 (read-only), show only rooms with activities. Empty rooms add visual noise without value in a read-only view. Phase 34 (drag-and-drop) will need to show empty rooms as drop targets.

3. **Room Settings Modal Scope (Plan 33-02)**
   - What we know: Plan 33-02 mentions "room settings modal." The Settings page already has full room CRUD.
   - What's unclear: How much room management should be accessible from the grid page?
   - Recommendation: Provide a lightweight modal that shows the room list with a link to the full Settings page. Do not duplicate the full CRUD -- just provide quick visibility and a navigation shortcut.

4. **Unassigned Activities Display (Plan 33-03)**
   - What we know: The API returns `unassigned` array -- activities with no room assignment.
   - What's unclear: How should these be displayed?
   - Recommendation: Add a special row at the bottom of the grid labeled "(ללא חדר)" with a distinct background (gray/muted). This makes unassigned activities visible and encourages admins to assign them rooms.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all relevant source files:
  - `api/room-schedule/room-schedule.service.js` -- Verified API response shape, activity fields, summary structure
  - `api/room-schedule/room-schedule.controller.js` -- Verified endpoint URL and error handling
  - `api/room-schedule/room-schedule.route.js` -- Verified: `GET /` and `PUT /move`, admin-only
  - `api/room-schedule/room-schedule.validation.js` -- Day range 0-5, time format HH:MM
  - `api/tenant/tenant.service.js` -- Room CRUD methods, room data shape
  - Frontend `src/services/apiService.js` -- API client pattern, service export pattern
  - Frontend `src/components/ui/tabs.tsx` -- Radix Tabs wrapper
  - Frontend `src/components/ui/StatsCard.tsx` -- Stats card with color variants
  - Frontend `src/components/ui/tooltip.tsx` -- Radix Tooltip wrapper
  - Frontend `src/components/ui/badge.tsx` -- Badge variants for status display
  - Frontend `src/components/ui/Card.tsx` -- Card component wrapper
  - Frontend `src/components/schedule/SimpleWeeklyGrid.tsx` -- Color coding conventions (blue/purple/orange)
  - Frontend `src/components/schedule/WeeklyCalendarGrid.tsx` -- react-big-calendar usage (NOT suitable for room grid)
  - Frontend `src/components/Sidebar.tsx` -- Navigation structure, admin nav array
  - Frontend `src/App.tsx` -- Route registration, lazy loading, ProtectedRoute pattern
  - Frontend `src/pages/Settings.tsx` -- Room management UI, tenant data loading
  - Frontend `src/pages/Dashboard.tsx` -- Page data fetching pattern with useState/useEffect
  - Frontend `package.json` -- All installed dependencies verified

- **Planning documents**:
  - `.planning/ROADMAP.md` -- Phase 33 success criteria, plan structure, requirement mapping
  - `.planning/REQUIREMENTS.md` -- GRID-01 through GRID-07 requirement definitions
  - `.planning/STATE.md` -- Current phase position, prior decisions
  - `.planning/phases/32-room-schedule-api-conflict-detection/32-RESEARCH.md` -- API design, data source analysis

### Secondary (MEDIUM confidence)
- CSS Grid RTL behavior -- standard CSS specification, well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, no new dependencies
- Architecture: HIGH - Page structure, routing, API integration patterns verified from existing code
- Pitfalls: HIGH - Grid layout pitfalls derived from RTL + CSS Grid + actual data analysis
- API integration: HIGH - Response shape verified directly from implemented Phase 32 service code

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- internal codebase patterns, no external dependency concerns)
