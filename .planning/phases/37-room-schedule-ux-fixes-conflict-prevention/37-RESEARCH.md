# Phase 37: Room Schedule UX Fixes & Conflict Prevention - Research

**Researched:** 2026-03-03
**Domain:** Frontend UX (React grid, @dnd-kit drag-and-drop, jsPDF export), Backend conflict detection, Seed data cleanup
**Confidence:** HIGH

## Summary

Phase 37 improves the existing v1.6 room schedule grid across five areas: cell readability (larger cells with 3-line content), conflict prevention (pre-checks on create and drag-and-drop), visual polish (accent borders, improved filter states), a dedicated fullscreen route, and PDF export enhancements (grid-style + tabular, week export with 6 pages). No new scheduling capabilities are added.

The existing codebase is well-structured for these changes. The frontend uses 13 components in `src/components/room-schedule/` with a single page at `src/pages/RoomSchedule.tsx`. The backend provides `GET /api/room-schedule?day=N` and `PUT /api/room-schedule/move` with existing room-level conflict detection via union-find. The `@dnd-kit/core` v6.3.1 already provides `isOver` on droppable cells. jsPDF v3.0.1 + jspdf-autotable v5.0.2 are installed and working for tabular export.

**Primary recommendation:** Split into 4-5 plans: (1) cell size + readability + accent borders, (2) conflict prevention on create + DnD, (3) fullscreen route, (4) filter UX + summary bar fix, (5) PDF export overhaul + seed cleanup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Cell size & readability:** 120px+ column width, 80px+ row height. Three lines: teacher name (with "מורה:" prefix), student/group name (with "תלמיד:" prefix), time range (e.g. 08:00-08:30). Dedicated fullscreen page route with no sidebar/header.
- **Visual clarity:** Keep light pastel backgrounds + add 4px right border in strong accent color per activity type. Conflicts prevented not displayed; keep subtle red border as safety net. Remove 12 intentional conflicts from seed script.
- **Conflict prevention:** Pre-check in create dialog (load existing activities, show warning, block submission). DnD visual feedback (red/disabled for conflict, green for available). All three types: room overlaps, teacher double-booking, student double-booking. Hebrew error messages with specific who/what details.
- **Filter & export:** Activity type toggles update summary bar stats to reflect only filtered activities. Both grid-style visual PDF AND tabular data PDF. Week PDF = 6 pages (Sun-Fri). Filters affect export ("what you see is what you export").

### Claude's Discretion
- Exact fullscreen route path and navigation UX
- Grid-style PDF layout implementation approach
- Drop zone visual feedback styling (exact colors/animations)
- How to efficiently pre-check conflicts in the create dialog (API call vs. using already-loaded schedule data)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop | Already used in RoomGrid; useDroppable provides isOver for feedback |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers | Already used in ActivityCell for drag transforms |
| jsPDF | 3.0.1 | PDF generation | Already used for tabular export in RoomSchedule.tsx |
| jspdf-autotable | 5.0.2 | Table PDF generation | Already used for tabular data layout |
| react-router-dom | (current) | Routing | Already used; need new Route for fullscreen page |
| react-hot-toast | (current) | Toast notifications | Already used for success/error messages |
| @phosphor-icons/react | (current) | Icons | Already used throughout room-schedule components |

### Supporting (No New Dependencies Needed)
All work uses existing libraries. No new npm packages required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF manual grid drawing | html2canvas + jsPDF | html2canvas captures pixel-perfect but is slow, has RTL issues, and produces large files. Manual drawing gives full control over RTL text placement. |
| Custom collision detection | @dnd-kit closestCenter | Default rectangle intersection works fine for grid cells; no need to change collision algorithm. |

## Architecture Patterns

### Current Component Structure (No Changes)
```
src/
  pages/
    RoomSchedule.tsx          # Main page (DndContext, state, handlers)
    RoomScheduleFullscreen.tsx # NEW: Fullscreen variant (no Layout wrapper)
  components/room-schedule/
    ActivityCell.tsx           # Single activity display (draggable)
    CreateLessonDialog.tsx     # Create lesson form dialog
    DaySelector.tsx            # Day tab selector
    DragOverlayContent.tsx     # Drag ghost overlay
    DroppableCell.tsx          # Drop target cell
    FilterBar.tsx              # Teacher/room/type filters
    RoomGrid.tsx               # Grid layout (columns x rows)
    ScheduleToolbar.tsx        # View mode, print, export buttons
    SummaryBar.tsx             # Stats cards row
    UnassignedRow.tsx          # Activities without rooms
    WeekMiniGrid.tsx           # Mini timeline for week view
    WeekOverview.tsx           # Week overview grid
    utils.ts                   # Shared constants and helpers
```

### Pattern 1: Fullscreen Route (Claude's Discretion)
**What:** A dedicated `/room-schedule/fullscreen` route that renders RoomSchedule without the Layout wrapper.
**When to use:** When user wants maximum screen real estate for the schedule grid.
**Recommendation:** Create a thin wrapper page that renders the same components but without the `<Layout>` wrapper. Add a "fullscreen" button on the main page that opens this route (via `window.open` or `<Link>`), and an "exit fullscreen" button on the fullscreen page that navigates back.

**Implementation approach:**
```typescript
// In App.tsx - new route WITHOUT Layout wrapper
<Route
  path="/room-schedule/fullscreen"
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <Suspense fallback={<PageLoadingFallback message="..." />}>
        <RoomScheduleFullscreen />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

The fullscreen page reuses all room-schedule components but adds its own minimal header with an exit button. Since Layout provides sidebar+header via `no-print` CSS classes, the fullscreen route simply skips the `<Layout>` wrapper entirely.

### Pattern 2: Conflict Pre-Check in Create Dialog (Claude's Discretion)
**What:** Before allowing submission, check if the target room+time is already occupied.
**Recommendation:** Use already-loaded schedule data (client-side check) rather than a new API call.

**Rationale:**
- The `schedule` state in RoomSchedule.tsx contains ALL activities for the current day, already loaded.
- The create dialog is only opened for the current day, so the data is already available.
- Client-side check is instant (no network round-trip) and covers room conflicts immediately.
- For teacher and student double-booking, we need to check ALL rooms (not just the target room), but the schedule data already contains all rooms for the day.
- Pass the full schedule data to CreateLessonDialog as a prop, and check for overlaps using the same `doTimesOverlap` logic.

**For teacher double-booking specifically:** The schedule response includes `teacherId` on every activity. When a teacher is selected in the create dialog, scan all activities across all rooms for that day to find any that overlap with the selected time range and belong to the same teacher.

**For student double-booking:** This requires knowing which students are assigned to which lesson times. The current schedule API does NOT include student IDs -- it only includes `label` (student name). For true student double-booking prevention during CREATE, we would need either:
1. An API endpoint that checks student conflicts (the backend `checkStudentScheduleConflict` function already exists in `time-block.service.js`)
2. Or accept that create-from-grid only creates teacher time blocks (not student assignments), so student conflicts are not applicable at this stage.

**Decision:** Since `CreateLessonDialog` creates time blocks via `teacherScheduleService.createTimeBlock()` (which calls `POST /teacher/:id/time-block`), and the backend `time-block.service.js` line 47-59 already validates time block conflicts for the teacher, the backend already prevents teacher self-conflicts. Room conflicts need client-side pre-checking since the create-time-block endpoint doesn't know about rehearsals/theory in the same room.

### Pattern 3: DnD Conflict Visual Feedback (Claude's Discretion)
**What:** Show red/green visual feedback on drop targets while dragging.
**Implementation:** The `DroppableCell` already receives `isOver` from `useDroppable`. To add conflict awareness, pass the currently dragged activity's time range down through DndContext, and in each DroppableCell, check if dropping would create a conflict.

**Approach using `useDndContext`:**
```typescript
// In DroppableCell, access the active drag item:
import { useDndContext } from '@dnd-kit/core'

const { active } = useDndContext()
const draggedActivity = active?.data?.current as ActivityData | undefined

// Check if this cell would conflict:
// If the cell already has an activity AND the dragged item would overlap, show red.
// If the cell is empty or non-overlapping, show green.
```

**Visual styling recommendation:**
- Available drop zone (isOver + no conflict): `bg-green-50 ring-2 ring-green-400 ring-inset`
- Conflicting drop zone (isOver + conflict): `bg-red-50 ring-2 ring-red-400 ring-inset cursor-not-allowed`
- Not hovered: no change (current behavior)

### Pattern 4: Grid-Style Visual PDF (Claude's Discretion)
**What:** A PDF that mirrors the on-screen grid layout (rooms as rows, time slots as columns).
**Recommendation:** Use jsPDF's low-level drawing API (`rect`, `text`, `line`) rather than html2canvas.

**Rationale:**
- html2canvas has known RTL rendering issues and produces large bitmap PDFs
- jsPDF's drawing API gives pixel-precise control over cell placement
- The grid is fundamentally a table with merged cells (activities spanning multiple slots)
- jspdf-autotable can handle the basic grid structure with custom cell rendering

**Implementation approach:**
```typescript
// Use jsPDF autoTable with custom theme and cell hooks:
doc.autoTable({
  theme: 'grid',
  styles: { fontSize: 6, cellPadding: 1, halign: 'right' },
  // Columns: Room header + 24 time slots
  head: [['חדר', '08:00', '08:30', ... , '19:30']],
  body: roomRows,  // Each row = room name + cell content per slot
  didDrawCell: (data) => {
    // Custom cell rendering for activity colors, borders
  }
})
```

Alternatively, for full visual fidelity, use pure jsPDF drawing:
```typescript
const CELL_W = 10; // mm per 30-min slot
const CELL_H = 12; // mm per room row
const HEADER_W = 25; // mm for room name column

for (const [roomIdx, room] of filteredRooms.entries()) {
  const y = startY + roomIdx * CELL_H;
  // Draw room name
  doc.text(room.room, HEADER_W - 2, y + CELL_H / 2, { align: 'right' });
  // Draw activities with colored backgrounds
  for (const activity of room.activities) {
    const startSlot = (timeToMinutes(activity.startTime) - 480) / 30;
    const endSlot = (timeToMinutes(activity.endTime) - 480) / 30;
    const x = HEADER_W + startSlot * CELL_W;
    const w = (endSlot - startSlot) * CELL_W;
    doc.setFillColor(...activityColor);
    doc.rect(x, y, w, CELL_H, 'F');
    doc.setFontSize(5);
    doc.text(activity.teacherName, x + w - 1, y + 4, { align: 'right' });
  }
}
```

**Recommendation:** Use the autoTable approach for the grid PDF as it handles pagination, Hebrew text, and cell boundaries automatically. Reserve pure drawing only if autoTable cannot achieve the merged-cell look.

### Anti-Patterns to Avoid
- **DO NOT use html2canvas for PDF:** RTL issues, bitmap quality, large file sizes.
- **DO NOT add a new API endpoint for conflict pre-checks in create dialog:** The schedule data is already loaded client-side.
- **DO NOT modify the backend conflict detection union-find:** It works correctly. Changes are frontend-only for visual feedback.
- **DO NOT remove the conflict detection/display code entirely:** Keep it as a safety net per user decision. Just make it subtle (thin red border).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom mouse/touch handlers | @dnd-kit/core (already used) | Already integrated, handles touch/keyboard/pointer |
| PDF tables | Manual coordinate math for tables | jspdf-autotable (already used) | Handles pagination, Hebrew alignment, cell padding |
| Time overlap detection | Custom overlap logic | `doTimesOverlap` from `utils/timeUtils.js` | Already exists and tested on backend; port to frontend utils.ts |
| Route protection | Custom auth check | `<ProtectedRoute>` component (already used) | Already handles role-based access |

**Key insight:** Almost everything needed already exists in the codebase. This phase is about refining existing components, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: CSS Grid Column Width with Larger Cells
**What goes wrong:** Increasing cell width from `minmax(80px, 1fr)` to `minmax(120px, 1fr)` makes the grid exceed viewport width, causing horizontal scroll issues.
**Why it happens:** 24 columns x 120px = 2880px minimum, which exceeds most screens.
**How to avoid:** The grid already has `overflow-x-auto`. Ensure the fullscreen route uses `100vw` width. The larger cells are intentional -- horizontal scrolling is acceptable and already supported.
**Warning signs:** Grid appears squished or time headers misaligned.

### Pitfall 2: DnD Conflict Feedback Requires Knowing All Occupied Slots
**What goes wrong:** DroppableCell only knows if IT is empty, but the dragged activity might span multiple slots.
**Why it happens:** A 45-min activity dropped at 10:00 occupies 10:00 and 10:30 slots. Checking only the 10:00 cell misses the 10:30 conflict.
**How to avoid:** When checking for conflicts during drag, calculate the full time range of the dragged activity (startTime + duration) and check ALL slots it would occupy against ALL existing activities in that room. The `occupiedSlots` Set in RoomGrid already does this computation.
**Warning signs:** Activities appear to drop successfully on partially-occupied ranges.

### Pitfall 3: Fullscreen Route Must Still Have Auth
**What goes wrong:** Creating a route outside `<Layout>` and forgetting to wrap it in `<ProtectedRoute>`.
**Why it happens:** Layout and auth are visually associated but technically separate.
**How to avoid:** Always wrap in `<ProtectedRoute allowedRoles={['admin']}>`.

### Pitfall 4: PDF Hebrew Text Direction
**What goes wrong:** Hebrew text in jsPDF renders left-to-right or garbled.
**Why it happens:** jsPDF's default font doesn't support Hebrew. The existing code already works because jspdf-autotable handles RTL with `halign: 'right'`.
**How to avoid:** Continue using `halign: 'right'` in all PDF text operations. For the grid-style PDF, use `doc.text(str, x, y, { align: 'right' })` consistently. Test with Hebrew room names and teacher names.
**Warning signs:** Text appears as boxes or question marks in the PDF.

### Pitfall 5: Summary Bar Not Updating with Filters
**What goes wrong:** User decision says summary should reflect filtered data. Currently, the `stats` useMemo already computes from `filteredRooms` (line 315-348 of RoomSchedule.tsx), so this may already work correctly.
**Verification needed:** Check if the summary bar updates when activity type toggles are clicked. The current code at line 316 uses `filteredRooms` which IS filtered. However, the `sources` breakdown in the original `schedule.summary` is NOT filtered. The user wants the stats to reflect filtered view.
**How to avoid:** Ensure all stats are computed from `filteredRooms`, not from `schedule.summary`.

### Pitfall 6: Seed Script Conflict Removal Must Not Break Non-Conflict Data
**What goes wrong:** Removing `generateConflicts()` from seed-dev-data.js removes the rehearsal and theory lesson records that were intentional conflicts, but the script might reference them elsewhere.
**Why it happens:** The conflict records are created separately and inserted via `insertMany`.
**How to avoid:** Simply remove/comment out step 9 in the seed script main function (lines 1107-1119) and the `generateConflicts` function. The rest of the seeding is independent.

### Pitfall 7: Create Dialog Conflict Check -- Race Condition
**What goes wrong:** User opens dialog, another admin moves an activity, user submits and creates a double-booking.
**Why it happens:** Client-side pre-check uses stale data.
**How to avoid:** The backend `time-block.service.js` already validates teacher time block conflicts server-side. The client-side check is a UX convenience, not a security boundary. For room conflicts specifically (cross-source), the backend moveActivity has conflict detection but createTimeBlock does not check room conflicts against rehearsals/theory. Consider adding room conflict check to the create-time-block backend endpoint as a future enhancement, or accept the race condition as very unlikely (admin-only feature, single-user editing typical).

## Code Examples

### Example 1: Current Grid Template (to be modified)
```typescript
// Source: RoomGrid.tsx line 173
style={{
  gridTemplateColumns: '120px repeat(24, minmax(80px, 1fr))',  // Current
  // Change to:
  // gridTemplateColumns: '140px repeat(24, minmax(120px, 1fr))',  // Wider cells
}}
```

### Example 2: Current ActivityCell Content (to be modified)
```typescript
// Source: ActivityCell.tsx lines 100-105
// Current: 2 lines (teacher name, label)
<div className="font-medium truncate leading-tight">
  {activity.teacherName}
</div>
<div className="truncate leading-tight text-[10px] opacity-80">
  {activity.label}
</div>

// Target: 3 lines with prefixes + time range
<div className="font-medium truncate leading-tight text-[11px]">
  מורה: {activity.teacherName}
</div>
<div className="truncate leading-tight text-[10px] opacity-80">
  תלמיד: {activity.label}
</div>
<div className="truncate leading-tight text-[9px] opacity-60">
  {activity.startTime}-{activity.endTime}
</div>
```

### Example 3: Accent Border per Activity Type
```typescript
// Source: ActivityCell.tsx ACTIVITY_COLORS constant
// Add a borderAccent field:
const ACTIVITY_COLORS = {
  timeBlock: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    borderAccent: 'border-r-4 border-r-blue-600',  // NEW: thick right border
    text: 'text-blue-900',
    label: 'שיעור פרטי',
  },
  rehearsal: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    borderAccent: 'border-r-4 border-r-purple-600',
    text: 'text-purple-900',
    label: 'חזרה',
  },
  theory: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    borderAccent: 'border-r-4 border-r-orange-600',
    text: 'text-orange-900',
    label: 'תאוריה',
  },
}
```

### Example 4: DroppableCell with Conflict Awareness
```typescript
// Enhanced DroppableCell.tsx
import { useDroppable, useDndContext } from '@dnd-kit/core'

export default function DroppableCell({ room, timeSlot, isEmpty, occupiedSlots, roomActivities, onClick }) {
  const { isOver, setNodeRef } = useDroppable({ id: `${room}::${timeSlot}` })
  const { active } = useDndContext()

  // Determine if dropping here would conflict
  let wouldConflict = false
  if (isOver && active?.data?.current) {
    const draggedActivity = active.data.current
    const dragDuration = timeToMinutes(draggedActivity.endTime) - timeToMinutes(draggedActivity.startTime)
    const dropStartMin = timeToMinutes(timeSlot)
    const dropEndMin = dropStartMin + dragDuration
    // Check all activities in this room for overlap
    wouldConflict = roomActivities.some(a =>
      a.id !== draggedActivity.id &&
      doTimesOverlap(minutesToTime(dropStartMin), minutesToTime(dropEndMin), a.startTime, a.endTime)
    )
  }

  return (
    <div
      ref={setNodeRef}
      onClick={isEmpty ? onClick : undefined}
      className={cn(
        'h-full w-full transition-colors',
        isOver && !wouldConflict && 'bg-green-50 ring-2 ring-green-400 ring-inset rounded',
        isOver && wouldConflict && 'bg-red-50 ring-2 ring-red-400 ring-inset rounded cursor-not-allowed',
        !isOver && isEmpty && onClick && 'cursor-pointer hover:bg-gray-50'
      )}
    />
  )
}
```

### Example 5: Week PDF with 6 Pages
```typescript
// In handleExportPDF, week mode:
if (viewMode === 'week' && weekData) {
  const doc = new jsPDF({ orientation: 'landscape' })
  for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
    if (dayIdx > 0) doc.addPage()
    const dayData = weekData[dayIdx]
    // Render day title
    doc.text(`לוח חדרים - יום ${DAY_NAMES[dayIdx]}`, pageWidth - 14, 15, { align: 'right' })
    // Render table for this day
    doc.autoTable({ ... })
  }
  doc.save('room-schedule-week.pdf')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conflict visualization (red borders, stacking) | Conflict prevention (pre-checks, blocked submission) | Phase 37 | Conflicts should never appear in production |
| Small cells with tooltip hover | Large cells with 3-line readable content | Phase 37 | No hover needed for basic info |
| Single tabular PDF export | Dual PDF: grid-style visual + tabular data | Phase 37 | Admin can choose format |
| Per-day PDF | Week PDF (6 pages, one per day) | Phase 37 | One file for full week |

## Key Files to Modify

### Frontend Files
| File | Changes |
|------|---------|
| `src/pages/RoomSchedule.tsx` | PDF export overhaul (grid + tabular, week mode), pass schedule data to CreateLessonDialog for conflict pre-check |
| `src/pages/RoomScheduleFullscreen.tsx` | **NEW** - Fullscreen variant without Layout |
| `src/components/room-schedule/RoomGrid.tsx` | Grid template column/row sizes (120px+/80px+) |
| `src/components/room-schedule/ActivityCell.tsx` | 3-line content, prefix labels, accent border, reduced conflict styling |
| `src/components/room-schedule/DroppableCell.tsx` | Conflict-aware visual feedback (green/red) during drag |
| `src/components/room-schedule/CreateLessonDialog.tsx` | Conflict pre-check before submission |
| `src/components/room-schedule/FilterBar.tsx` | Improved toggle visual states |
| `src/components/room-schedule/SummaryBar.tsx` | (verify already uses filtered data) |
| `src/components/room-schedule/ScheduleToolbar.tsx` | Fullscreen button, PDF format selector |
| `src/components/room-schedule/utils.ts` | Add doTimesOverlap helper (port from backend) |
| `src/App.tsx` | New Route for fullscreen page |

### Backend Files
| File | Changes |
|------|---------|
| `scripts/seed-dev-data.js` | Remove `generateConflicts()` call and function |
| `scripts/seed-schedules.js` | Ensure no conflicts in schedule seeding (verify existing logic) |

## Open Questions

1. **Backend room conflict check on create-time-block**
   - What we know: `time-block.service.js` validates teacher self-conflicts but NOT cross-source room conflicts (rehearsals/theory in same room).
   - What's unclear: Should we add room conflict checking to the create-time-block backend endpoint?
   - Recommendation: Accept client-side-only pre-check for now. The create dialog already shows which room/time is occupied. Adding backend room conflict checking is a nice-to-have but not required since it's admin-only with typically single-user editing.

2. **Student double-booking in create dialog**
   - What we know: CreateLessonDialog creates time blocks, not student lesson assignments. Student assignment happens separately.
   - What's unclear: The user decision says "all three conflict types prevented" including student double-booking. But create-from-grid creates an empty time block, not a student lesson.
   - Recommendation: Student double-booking check applies to the time-block service's `assignLesson` flow, which already has `checkStudentScheduleConflict`. For the create dialog, focus on room and teacher conflicts.

3. **Grid-style PDF with merged cells**
   - What we know: jspdf-autotable supports colSpan but documentation is sparse.
   - What's unclear: Whether autoTable can handle activities spanning 2-3 columns visually.
   - Recommendation: Start with autoTable; fall back to manual rect drawing if merged cells don't work. Either approach is viable.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: All 13 room-schedule component files read in full
- Codebase inspection: Backend room-schedule service, controller, route, validation read in full
- Codebase inspection: seed-dev-data.js and seed-schedules.js read in full
- Codebase inspection: conflictDetectionService.js, time-block.service.js conflict logic read
- Codebase inspection: Layout.tsx, App.tsx routing, apiService.js endpoints read
- Codebase inspection: timeUtils.js (backend) and utils.ts (frontend) read in full

### Secondary (MEDIUM confidence)
- [@dnd-kit collision detection docs](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms) - useDndContext, isOver, active properties
- [jsPDF GitHub](https://github.com/parallax/jsPDF) - drawing API, text alignment
- [jsPDF-GenerateGrid](https://github.com/attebury/jsPDF-GenerateGrid) - grid alignment approach

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and working
- Architecture: HIGH -- direct codebase inspection, minimal architectural changes
- Pitfalls: HIGH -- based on actual code analysis, not speculation
- PDF grid approach: MEDIUM -- jspdf-autotable merged cells not personally verified, but fallback approach is clear

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no fast-moving dependencies)
