# Phase 35: Polish & Week Overview - Research

**Researched:** 2026-03-03
**Domain:** CSS print media, jsPDF table generation, multi-day data aggregation, room utilization calculation
**Confidence:** HIGH

## Summary

Phase 35 adds three polish features to the room schedule grid: (1) print/export of a single day's schedule, (2) a compact week overview showing all 6 weekdays side by side, and (3) per-room utilization percentage indicators. This phase is entirely frontend -- no new backend endpoints are needed. The existing `GET /api/room-schedule?day=N` endpoint already returns all data needed for each day. The week overview simply fetches all 6 days in parallel via `Promise.all`.

The project already has `jspdf` (v3.0.1) and `jspdf-autotable` (v5.0.2) installed, and `quickActionsService.ts` provides a proven pattern for generating PDF tables with Hebrew text and triggering browser print dialogs. For the day schedule print feature, the cleanest approach is a dual strategy: `window.print()` with `@media print` CSS for quick native printing, plus a jsPDF "export PDF" button for a downloadable file. The native `window.print()` approach requires adding the `print:` variant to the Tailwind config (not currently configured), which is a one-line addition to the `screens` extend.

The week overview is a new view mode (day vs. week) on the same RoomSchedule page. It fetches 6 schedule responses in parallel, transforms them into a compact rooms-by-days matrix, and computes utilization as `(occupiedSlots / totalSlots) * 100` per room across all 6 days. The compact format shows colored blocks (no text) per activity in a mini-grid, with utilization percentage displayed in the room header column. The data model is straightforward since each day's API response already provides rooms with activities and timing data.

**Primary recommendation:** Use `window.print()` with Tailwind `print:` variant for native printing, jsPDF + autoTable for PDF export (reusing the established pattern from `quickActionsService.ts`), and `Promise.all` across 6 `getRoomSchedule(day)` calls for the week overview with client-side utilization computation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^18.3.1 | Component framework | Project standard |
| TypeScript | ^5.9.3 | Type safety | Project standard |
| Tailwind CSS | ^3.4.19 | Styling, RTL, print styles | Project standard |
| jspdf | ^3.0.1 | PDF generation for day schedule export | Already installed, used by quickActionsService |
| jspdf-autotable | ^5.0.2 | Table generation in PDF | Already installed, used by quickActionsService |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @phosphor-icons/react | ^2.1.10 | Print/export button icons | Print and download buttons in toolbar |
| react-hot-toast | ^2.6.0 | Success/error notifications | Export success, fetch error messages |
| clsx / cn | Already installed | Conditional CSS classes | Print-specific visibility, view mode toggling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| window.print() + jsPDF | html2canvas + jsPDF | html2canvas renders the DOM to a canvas image then embeds in PDF. Loses text selectability, larger file size, and struggles with CSS grid + RTL. jsPDF autoTable generates native PDF tables which are smaller and text-selectable. |
| window.print() native | react-to-print library | react-to-print wraps window.print() with React ref targeting. It is 3KB but adds no capability beyond what a print: CSS class + window.print() provides. Not needed for this use case. |
| Fetching 6 days in parallel | New backend "week schedule" endpoint | A new endpoint would reduce HTTP calls from 6 to 1, but each day query is ~50-100ms and 6 parallel calls complete in ~100-150ms total. The added backend complexity is not justified for a single admin tool page with infrequent week view loads. |

**Installation:**
```bash
# No new packages needed - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    RoomSchedule.tsx              # Updated: add view mode state (day/week), print/export buttons
  components/
    room-schedule/
      DaySelector.tsx             # UNCHANGED
      RoomGrid.tsx                # UNCHANGED (used in day view)
      ActivityCell.tsx            # UNCHANGED
      SummaryBar.tsx              # UNCHANGED (used in day view)
      UnassignedRow.tsx           # UNCHANGED
      FilterBar.tsx               # UNCHANGED
      CreateLessonDialog.tsx      # UNCHANGED
      DroppableCell.tsx           # UNCHANGED
      DragOverlayContent.tsx      # UNCHANGED
      utils.ts                    # Updated: add utilization calculation helpers
      PrintableSchedule.tsx       # NEW: print-optimized layout for day schedule
      WeekOverview.tsx            # NEW: compact 6-day side-by-side grid with utilization
      WeekMiniGrid.tsx            # NEW: compact single-day column within week overview
      ScheduleToolbar.tsx         # NEW: print/export/view-mode buttons toolbar
```

### Pattern 1: View Mode Toggle (Day vs Week)
**What:** The RoomSchedule page has a view mode state (`'day' | 'week'`). In day mode, the existing grid is shown with all interaction capabilities. In week mode, a compact read-only overview is shown with utilization indicators.
**When to use:** For switching between PLSH-01/day-view and PLSH-02/week-view.
**Example:**
```typescript
// In RoomSchedule.tsx
const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

// Week data: fetch all 6 days when switching to week mode
const [weekData, setWeekData] = useState<RoomScheduleResponse[] | null>(null)
const [weekLoading, setWeekLoading] = useState(false)

useEffect(() => {
  if (viewMode === 'week') {
    loadWeekData()
  }
}, [viewMode])

const loadWeekData = async () => {
  setWeekLoading(true)
  try {
    const days = await Promise.all(
      [0, 1, 2, 3, 4, 5].map(day => roomScheduleService.getRoomSchedule(day))
    )
    setWeekData(days)
  } catch (err) {
    toast.error('שגיאה בטעינת מבט שבועי')
  } finally {
    setWeekLoading(false)
  }
}

return (
  <div>
    <ScheduleToolbar
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onPrint={handlePrint}
      onExportPDF={handleExportPDF}
    />

    {viewMode === 'day' ? (
      <>
        <DaySelector ... />
        <FilterBar ... />
        <SummaryBar ... />
        <DndContext ...>
          <RoomGrid ... />
        </DndContext>
        <UnassignedRow ... />
      </>
    ) : (
      <WeekOverview
        weekData={weekData}
        tenantRooms={tenantRooms}
        loading={weekLoading}
      />
    )}
  </div>
)
```

### Pattern 2: Native Print with @media print CSS
**What:** Use `window.print()` combined with Tailwind `print:` variant classes to hide interactive elements (sidebar, toolbar, filters, drag handles) and show a clean schedule layout.
**When to use:** For the "Print" button action (quick native printing without PDF generation).
**Example:**
```typescript
// Print handler -- simply triggers browser print dialog
function handlePrint() {
  window.print()
}

// In JSX -- elements to hide during print:
<div className="print:hidden">
  <FilterBar ... />
  <ScheduleToolbar ... />
</div>

// The grid itself shows during print:
<div className="print:overflow-visible print:max-h-none">
  <RoomGrid ... />
</div>
```

### Pattern 3: jsPDF Table Export for Day Schedule
**What:** Generate a PDF file with a table showing all activities for the selected day, grouped by room, using jsPDF + autoTable (same pattern as quickActionsService.ts).
**When to use:** For the "Export PDF" button action (downloadable file).
**Example:**
```typescript
// Pattern from existing quickActionsService.ts
import jsPDF from 'jspdf'
import 'jspdf-autotable'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

function exportDaySchedulePDF(
  dayName: string,
  rooms: RoomScheduleRoom[],
  stats: { totalRooms: number; occupiedSlots: number; freeSlots: number; conflictCount: number }
) {
  const doc = new jsPDF('landscape')

  // Title
  doc.setFont('helvetica')
  doc.setFontSize(16)
  doc.text(`לוח חדרים - יום ${dayName}`, doc.internal.pageSize.width - 20, 20, { align: 'right' })

  doc.setFontSize(10)
  doc.text(`תאריך: ${new Date().toLocaleDateString('he-IL')}`, doc.internal.pageSize.width - 20, 30, { align: 'right' })

  // Stats summary line
  doc.text(
    `חדרים: ${stats.totalRooms} | תפוסות: ${stats.occupiedSlots} | פנויות: ${stats.freeSlots} | התנגשויות: ${stats.conflictCount}`,
    doc.internal.pageSize.width - 20,
    38,
    { align: 'right' }
  )

  // Activities table
  const tableData = rooms.flatMap(room =>
    room.activities.map(activity => [
      room.room,
      activity.startTime,
      activity.endTime,
      activity.teacherName,
      activity.label,
      activity.activityType,
      activity.hasConflict ? 'כן' : '',
    ])
  )

  doc.autoTable({
    startY: 45,
    head: [['חדר', 'התחלה', 'סיום', 'מורה', 'תלמיד/קבוצה', 'סוג', 'התנגשות']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' },
    headStyles: { fillColor: [63, 126, 223], halign: 'right' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      6: { cellWidth: 18 },
    },
  })

  // Download
  doc.save(`room-schedule-${dayName}.pdf`)
}
```

### Pattern 4: Week Overview with Utilization Calculation
**What:** A compact grid showing 6 day columns side by side. Each room gets one row. Each day column shows colored mini-blocks for activities. The room header shows a utilization percentage.
**When to use:** For PLSH-02 and PLSH-03 requirements.
**Example:**
```typescript
// Utilization calculation
function computeRoomUtilization(
  roomName: string,
  weekData: RoomScheduleResponse[],
  totalSlotsPerDay: number // 24 (half-hour slots 08:00-20:00)
): number {
  let occupiedSlots = 0
  const totalSlots = totalSlotsPerDay * 6 // 6 weekdays

  for (const daySchedule of weekData) {
    const room = daySchedule.rooms.find(r => r.room === roomName)
    if (!room) continue

    const occupied = new Set<number>()
    const gridStartMinutes = GRID_START_HOUR * 60

    for (const activity of room.activities) {
      const startMinutes = timeToMinutes(activity.startTime)
      const endMinutes = timeToMinutes(activity.endTime)
      for (let t = startMinutes; t < endMinutes; t += SLOT_DURATION) {
        const slotIndex = Math.floor((t - gridStartMinutes) / SLOT_DURATION)
        if (slotIndex >= 0 && slotIndex < totalSlotsPerDay) {
          occupied.add(slotIndex)
        }
      }
    }
    occupiedSlots += occupied.size
  }

  return totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0
}
```

### Pattern 5: Tailwind Print Variant Configuration
**What:** Add the `print` screen variant to tailwind.config.js so `print:hidden`, `print:block`, etc. work.
**When to use:** Must be configured before any `print:` classes are used.
**Example:**
```javascript
// In tailwind.config.js, under theme.extend.screens:
screens: {
  'xs': '475px',
  'print': { raw: 'print' },
},
```

### Anti-Patterns to Avoid
- **Using html2canvas for PDF export:** It renders the DOM grid to a bitmap image, losing text selectability and producing large files. jsPDF autoTable generates native text tables that are smaller and searchable.
- **Building a separate print page/route:** No need for a separate URL. The `@media print` CSS hides non-printable elements on the existing page. `window.print()` uses the current page.
- **Fetching week data on page load:** Only fetch all 6 days when the admin explicitly switches to week view. Day view is the default and only needs one day's data.
- **Re-implementing the grid for print:** The existing CSS grid layout is already suitable for print with minor adjustments (remove overflow scroll, expand to full width, hide interactive elements). Use print CSS to adapt the existing layout, not build a separate one.
- **Computing utilization on the backend:** Utilization is a frontend calculation from already-fetched data. No new API endpoints or backend changes needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF table generation | Custom canvas-to-PDF or SVG-to-PDF | jsPDF + autoTable | Already installed, proven pattern in quickActionsService.ts, handles pagination |
| Print styling | Manual DOM manipulation for print | Tailwind `print:` variant + `window.print()` | CSS-native solution, no JS DOM surgery, survives component re-renders |
| Multi-day data fetching | Custom batch endpoint | `Promise.all` with 6 existing API calls | Each call is ~50-100ms, 6 parallel calls complete in ~150ms. No backend change needed |
| Utilization percentage | Backend aggregation endpoint | Client-side `Set<number>` slot counting per room | Same algorithm already used in SummaryBar.tsx stats computation, just extended across 6 days |
| View mode toggle | React Router sub-routes | Simple `useState<'day' | 'week'>` | Both views share the same page context (tenant rooms, teachers, filters). No URL routing needed |

**Key insight:** This phase requires zero backend changes. All three features (print, week overview, utilization) are computed entirely from data the existing `GET /api/room-schedule?day=N` endpoint already provides.

## Common Pitfalls

### Pitfall 1: Tailwind print: Variant Not Working
**What goes wrong:** `print:hidden` classes have no effect because the `print` screen variant is not configured in tailwind.config.js.
**Why it happens:** Tailwind v3 does not include the `print` variant by default. It must be added as a custom screen with `raw: 'print'`.
**How to avoid:** Add `'print': { raw: 'print' }` to `theme.extend.screens` in tailwind.config.js BEFORE writing any print: classes. Verify by running the dev server, opening Chrome DevTools, and using "Emulate CSS media type: print" in the Rendering panel.
**Warning signs:** `print:hidden` classes appear in JSX but elements still show during print preview.

### Pitfall 2: CSS Grid Overflow Clipping in Print
**What goes wrong:** The room grid has `overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto` which clips content during print. Only the visible portion prints.
**Why it happens:** Print layout uses the page's CSS including overflow constraints.
**How to avoid:** Add `print:overflow-visible print:max-h-none` to the grid container. This allows the full grid to flow across print pages. Also add `@media print { .overflow-x-auto { overflow: visible !important; } }` as a global print style if Tailwind classes alone are not sufficient.
**Warning signs:** Printed schedule cuts off rooms or time slots that were outside the viewport.

### Pitfall 3: jsPDF Hebrew Text Direction
**What goes wrong:** Hebrew text in jsPDF appears reversed or LTR-aligned in the PDF.
**Why it happens:** jsPDF's default text rendering is LTR. Hebrew text needs right-alignment and potentially a custom font for proper glyph rendering.
**How to avoid:** Use `halign: 'right'` in autoTable styles (as done in quickActionsService.ts). The existing `quickActionsService.ts` already demonstrates working Hebrew text in jsPDF -- follow the exact same pattern. For the table columns, set `halign: 'right'` in both `styles` and `headStyles`. The built-in Helvetica font renders basic Hebrew characters correctly for simple text (names, times); complex ligatures may not render perfectly but are acceptable for a schedule export.
**Warning signs:** Teacher names appear as reversed characters or question marks in the PDF.

### Pitfall 4: Week Overview Fetching 6 Times on Every Switch
**What goes wrong:** Switching between day and week view triggers 6 API calls every time, even if the admin just switched back momentarily.
**Why it happens:** No caching of week data.
**How to avoid:** Cache the week data in state. Only refetch when: (a) switching to week mode and weekData is null, or (b) the admin explicitly requests a refresh. A simple `useRef` for a "last fetched" timestamp can prevent rapid re-fetches. Also, if the admin creates/moves a lesson in day mode and then switches to week mode, the week data should be refreshed (set weekData to null when schedule changes in day mode).
**Warning signs:** Visible loading spinner every time the admin toggles between day and week.

### Pitfall 5: Compact Week View Too Dense to Read
**What goes wrong:** With 27 rooms and 24 time slots per day across 6 days, the week overview is an extremely dense matrix that is hard to interpret.
**Why it happens:** Trying to show the same detail level as the day view in 1/6 the space.
**How to avoid:** The week overview should be COMPACT -- not a full grid. Design options:
  - **Mini-blocks approach:** Each day column shows colored rectangles proportional to their time span, but with NO text. Hover shows a tooltip with details. The visual pattern of colors and density conveys utilization at a glance.
  - **Utilization-focused approach:** Each day-room cell shows only a single colored bar representing utilization percentage (0-100%), not individual activities. Green = low utilization, yellow = medium, red = high.
  - **Recommended:** Use the mini-blocks approach for rooms with few activities (<8) and the utilization bar for rooms with many activities (>=8). This provides detail where it is meaningful and summary where detail would be noise.
**Warning signs:** Text overflows cells, grid is unreadable without zooming.

### Pitfall 6: Print Layout Includes Sidebar and Header
**What goes wrong:** The printed page includes the application sidebar, top header, and other navigation chrome that wastes paper.
**Why it happens:** `window.print()` prints the entire page including the layout wrapper.
**How to avoid:** The Layout component wrapper (sidebar + header) needs `print:hidden` classes on its sidebar and header elements. Alternatively, the room schedule content area needs `print:fixed print:inset-0 print:z-50` to overlay everything during print. The cleanest approach is to add `print:hidden` to the Sidebar component and the top navigation bar, which benefits all future printable pages.
**Warning signs:** Sidebar appears on the left (or right in RTL) of the printed page, wasting 20-25% of paper width.

### Pitfall 7: Week Data Inconsistency After Day-Mode Edits
**What goes wrong:** Admin moves a lesson in day mode, then switches to week view. The week view still shows the old data because it was cached before the edit.
**Why it happens:** Week data is cached in state and not invalidated when day-mode edits occur.
**How to avoid:** When `loadSchedule()` is called after a successful move/create in day mode, also invalidate the week cache: `setWeekData(null)`. This way, switching to week mode triggers a fresh fetch. Since week mode is read-only (no editing), there are no stale-data issues within week mode itself.
**Warning signs:** Activity appears in old position in week view after being moved in day view.

## Code Examples

Verified patterns from existing codebase and official sources:

### ScheduleToolbar Component
```typescript
// NEW: ScheduleToolbar.tsx -- print, export, view mode buttons
import { Printer, FilePdf, CalendarBlank, Calendar } from '@phosphor-icons/react'

interface ScheduleToolbarProps {
  viewMode: 'day' | 'week'
  onViewModeChange: (mode: 'day' | 'week') => void
  onPrint: () => void
  onExportPDF: () => void
}

export default function ScheduleToolbar({
  viewMode,
  onViewModeChange,
  onPrint,
  onExportPDF,
}: ScheduleToolbarProps) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* View mode toggle */}
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
        <button
          onClick={() => onViewModeChange('day')}
          className={cn(
            'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
            viewMode === 'day'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          <CalendarBlank size={16} />
          יום
        </button>
        <button
          onClick={() => onViewModeChange('week')}
          className={cn(
            'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-r',
            viewMode === 'week'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          <Calendar size={16} />
          שבוע
        </button>
      </div>

      {/* Action buttons */}
      <button
        onClick={onPrint}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
      >
        <Printer size={16} />
        הדפסה
      </button>
      <button
        onClick={onExportPDF}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
      >
        <FilePdf size={16} />
        ייצוא PDF
      </button>
    </div>
  )
}
```

### WeekOverview Component Structure
```typescript
// NEW: WeekOverview.tsx -- compact 6-day grid with utilization
import { useMemo } from 'react'
import { DAY_NAMES, timeToMinutes, GRID_START_HOUR, SLOT_DURATION, TOTAL_SLOTS } from './utils'

interface WeekOverviewProps {
  weekData: RoomScheduleResponse[] | null  // array of 6 days (index = day number)
  tenantRooms: Array<{ name: string; isActive: boolean }>
  loading: boolean
}

export default function WeekOverview({ weekData, tenantRooms, loading }: WeekOverviewProps) {
  // Collect all unique room names across all days + tenant rooms
  const allRooms = useMemo(() => {
    const roomSet = new Set<string>()
    for (const day of weekData || []) {
      for (const room of day.rooms) roomSet.add(room.room)
    }
    for (const tr of tenantRooms) {
      if (tr.isActive) roomSet.add(tr.name)
    }
    return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'he'))
  }, [weekData, tenantRooms])

  // Compute per-room utilization across all 6 days
  const utilization = useMemo(() => {
    const map = new Map<string, number>()
    if (!weekData) return map

    for (const roomName of allRooms) {
      let occupied = 0
      const total = TOTAL_SLOTS * 6

      for (const daySchedule of weekData) {
        const room = daySchedule.rooms.find(r => r.room === roomName)
        if (!room) continue

        const slots = new Set<number>()
        const gridStart = GRID_START_HOUR * 60
        for (const activity of room.activities) {
          const start = timeToMinutes(activity.startTime)
          const end = timeToMinutes(activity.endTime)
          for (let t = start; t < end; t += SLOT_DURATION) {
            const idx = Math.floor((t - gridStart) / SLOT_DURATION)
            if (idx >= 0 && idx < TOTAL_SLOTS) slots.add(idx)
          }
        }
        occupied += slots.size
      }

      map.set(roomName, total > 0 ? Math.round((occupied / total) * 100) : 0)
    }
    return map
  }, [weekData, allRooms])

  // Render: room header + 6 day columns + utilization column
  // Grid: columns = [room name (120px)] + [6 day columns] + [utilization bar (80px)]
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div
        className="grid"
        style={{
          gridTemplateColumns: '120px repeat(6, 1fr) 80px',
        }}
      >
        {/* Header row */}
        <div className="bg-gray-50 border-b border-l p-2 text-sm font-medium text-gray-500">חדר</div>
        {DAY_NAMES.map((name, i) => (
          <div key={i} className="bg-gray-50 border-b border-l p-2 text-sm font-medium text-center text-gray-500">
            {name}
          </div>
        ))}
        <div className="bg-gray-50 border-b border-l p-2 text-sm font-medium text-center text-gray-500">ניצולת</div>

        {/* Room rows */}
        {allRooms.map(roomName => {
          const pct = utilization.get(roomName) || 0
          return (
            <div key={roomName} className="contents">
              {/* Room name */}
              <div className="border-b border-l px-3 py-2 text-sm font-medium sticky right-0 bg-white z-10">
                {roomName}
              </div>

              {/* 6 day mini-grids */}
              {(weekData || []).map((daySchedule, dayIdx) => {
                const room = daySchedule.rooms.find(r => r.room === roomName)
                return (
                  <WeekMiniGrid
                    key={dayIdx}
                    activities={room?.activities || []}
                  />
                )
              })}

              {/* Utilization percentage */}
              <div className="border-b border-l px-2 py-2 flex items-center gap-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      pct < 30 ? 'bg-green-400' : pct < 70 ? 'bg-yellow-400' : 'bg-red-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-left">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### WeekMiniGrid Component
```typescript
// NEW: WeekMiniGrid.tsx -- compact activity blocks for one room-day cell
import { timeToMinutes, GRID_START_HOUR, GRID_END_HOUR, SLOT_DURATION } from './utils'
import { ACTIVITY_COLORS } from './ActivityCell'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Activity {
  source: 'timeBlock' | 'rehearsal' | 'theory'
  startTime: string
  endTime: string
  teacherName: string
  label: string
  hasConflict: boolean
}

interface WeekMiniGridProps {
  activities: Activity[]
}

export default function WeekMiniGrid({ activities }: WeekMiniGridProps) {
  const totalMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60 // 720

  return (
    <div className="border-b border-l relative h-10">
      {activities.map((activity, i) => {
        const startOffset = timeToMinutes(activity.startTime) - GRID_START_HOUR * 60
        const endOffset = timeToMinutes(activity.endTime) - GRID_START_HOUR * 60
        const leftPct = (startOffset / totalMinutes) * 100
        const widthPct = ((endOffset - startOffset) / totalMinutes) * 100

        const colors = ACTIVITY_COLORS[activity.source]

        return (
          <TooltipProvider key={i} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'absolute top-1 bottom-1 rounded-sm',
                    colors.bg,
                    activity.hasConflict && 'ring-1 ring-red-400'
                  )}
                  style={{
                    right: `${leftPct}%`,  // RTL: "left" in visual = right in CSS for RTL
                    width: `${Math.max(widthPct, 2)}%`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div>{activity.teacherName} - {activity.label}</div>
                <div className="opacity-70">{activity.startTime}-{activity.endTime}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
```

### Print CSS Global Styles
```css
/* Add to global CSS or index.css */
@media print {
  /* Hide sidebar and top navigation */
  nav, aside, [data-sidebar], .sidebar {
    display: none !important;
  }

  /* Expand content area */
  main {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
  }

  /* Remove grid scroll constraints */
  .overflow-x-auto,
  .overflow-y-auto {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Ensure page breaks work well */
  .page-break-before { page-break-before: always; }
  .page-break-after { page-break-after: always; }
}
```

### Tailwind Config Update
```javascript
// In tailwind.config.js - theme.extend.screens:
screens: {
  'xs': '475px',
  'print': { raw: 'print' },
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas + jsPDF for screenshots | jsPDF autoTable for native PDF tables | Ongoing | Smaller files, text-selectable, better Hebrew support |
| react-to-print library | Native window.print() + CSS @media print | Ongoing | No extra dependency, same result, simpler code |
| Separate print-only pages | @media print CSS on existing pages | Ongoing | No route duplication, print styles co-located with screen styles |

**Deprecated/outdated:**
- `page-break-before` / `page-break-after`: Replaced by `break-before` / `break-after` in modern CSS. However, both are still supported by all browsers. Use the modern `break-*` properties.

## Open Questions

1. **Hebrew Font Rendering in jsPDF**
   - What we know: The existing `quickActionsService.ts` uses `doc.setFont('helvetica')` and Hebrew text works for simple strings (names, dates). The autoTable renders Hebrew content with `halign: 'right'`.
   - What's unclear: Whether all Hebrew characters render correctly in the default Helvetica font, or if a custom Hebrew font TTF needs to be embedded for perfect rendering.
   - Recommendation: Use the same approach as `quickActionsService.ts` (Helvetica + right-align). If Hebrew rendering issues are discovered during implementation, a custom font can be loaded later. This is a LOW-risk item since the existing service already works.

2. **Week Mini-Grid RTL Positioning**
   - What we know: The WeekMiniGrid uses absolute positioning with percentage offsets. In RTL, `right` is the start edge, so activity blocks should be positioned with `right: N%`.
   - What's unclear: Whether CSS `right` percentage positioning in an RTL container works intuitively with the time-to-percentage mapping (earlier time = smaller percentage = closer to right edge).
   - Recommendation: In RTL, `right: 0%` = rightmost edge (visual start). An 08:00 activity has `right: 0%`. A 14:00 activity has `right: 50%`. This maps correctly. If issues arise, use `inset-inline-start` instead of `right` for logical direction support. Test early in implementation.

3. **Print Layout for Week View vs Day View**
   - What we know: The "Print" button should print whatever view is currently active (day or week).
   - What's unclear: Should the PDF export also change based on view mode? (Day export = table of activities; Week export = compact weekly matrix?)
   - Recommendation: The PDF export should match the current view. Day mode export = table of activities for that day. Week mode export = compact weekly overview. However, for Plan 35-01, implement only the day schedule export since the requirement says "print a day's schedule." The week PDF export can be added as a follow-up if needed.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all relevant source files:
  - Frontend: `src/pages/RoomSchedule.tsx` -- Current page with all state management, DndContext, data fetching patterns
  - Frontend: `src/components/room-schedule/*.tsx` -- All 10 existing components (ActivityCell, RoomGrid, DaySelector, SummaryBar, UnassignedRow, FilterBar, CreateLessonDialog, DroppableCell, DragOverlayContent, utils.ts)
  - Frontend: `src/services/quickActionsService.ts` -- Proven jsPDF + autoTable pattern with Hebrew text, print dialog via window.open
  - Frontend: `src/utils/lazyImports.tsx` -- Lazy loading pattern for jsPDF (loadPDFLibraries)
  - Frontend: `src/services/apiService.js` -- roomScheduleService.getRoomSchedule(day) interface
  - Frontend: `tailwind.config.js` -- Current config, missing `print` screen variant
  - Frontend: `package.json` -- jspdf ^3.0.1, jspdf-autotable ^5.0.2 already installed
  - Backend: `api/room-schedule/room-schedule.service.js` -- getRoomSchedule(day, options) accepts day 0-5, returns rooms/activities/summary
  - Backend: `api/room-schedule/room-schedule.controller.js` -- GET handler, response shape
  - Backend: `api/room-schedule/room-schedule.route.js` -- GET / and PUT /move, admin-only

- **Planning documents**:
  - `.planning/ROADMAP.md` -- Phase 35 description, requirements PLSH-01/02/03, success criteria
  - `.planning/REQUIREMENTS.md` -- Full PLSH requirement definitions
  - `.planning/phases/34-grid-interaction/34-RESEARCH.md` -- Phase 34 architecture, all existing patterns
  - `.planning/phases/33-read-only-room-grid-ui/33-RESEARCH.md` -- Phase 33 grid architecture, API response types

### Secondary (MEDIUM confidence)
- [Tailwind CSS print variant discussion](https://github.com/tailwindlabs/tailwindcss/discussions/1425) -- Confirmed `print: { raw: 'print' }` screen config for Tailwind v3
- [CSS print media best practices](https://www.smashingmagazine.com/2018/05/print-stylesheets-in-2018/) -- Print stylesheet patterns, break properties
- [MDN @media print](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Printing) -- Official CSS print specification
- [jsPDF-AutoTable RTL issue #824](https://github.com/simonbengtsson/jsPDF-AutoTable/issues/824) -- Known RTL challenges, workarounds with halign

### Tertiary (LOW confidence)
- Hebrew font rendering completeness in jsPDF Helvetica -- not verified for all Hebrew characters. The existing quickActionsService.ts works for names/dates, but edge cases with diacritics or unusual characters are untested. **Needs validation during 35-01 implementation.**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, no new dependencies needed
- Architecture (print): HIGH - window.print() + @media print is standard browser API; jsPDF pattern proven in existing codebase
- Architecture (week overview): HIGH - Simple parallel fetch of existing API, client-side aggregation from established data patterns
- Architecture (utilization): HIGH - Same slot-counting algorithm already implemented in SummaryBar stats computation
- Pitfalls: HIGH for CSS print layout, MEDIUM for jsPDF Hebrew rendering (known working pattern exists but edge cases possible)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- all libraries are mature, no fast-moving dependencies)
