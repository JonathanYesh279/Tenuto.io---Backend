# Phase 34: Grid Interaction - Research

**Researched:** 2026-03-03
**Domain:** @dnd-kit drag-and-drop, CSS grid droppable zones, client-side filtering, form dialogs, RTL Hebrew UI
**Confidence:** HIGH

## Summary

Phase 34 adds three interaction capabilities to the Phase 33 read-only room grid: (1) filter controls for teacher name, room name, and activity type, (2) click-to-create lesson in empty cells, and (3) drag-and-drop activity movement with conflict validation. The backend work is already complete -- Phase 32-02 shipped `PUT /api/room-schedule/move` with per-source DB updates, conflict pre-check via `getRoomSchedule + doTimesOverlap`, and 409 conflict response with details. Phase 33 shipped the full read-only grid with `ActivityCell`, `RoomGrid`, `DaySelector`, `SummaryBar`, and `UnassignedRow` components plus shared `utils.ts`. This phase is entirely frontend.

The three plans map cleanly to three independent concerns: **34-01 (Filters)** is pure client-side state filtering of the already-fetched `schedule.rooms` array -- no new API calls, no new dependencies. **34-02 (Click-to-create)** opens a Radix Dialog pre-filled with room/day/time from the clicked cell, then calls the existing `POST /api/schedule/teacher/:teacherId/time-block` endpoint to create a time block. **34-03 (Drag-and-drop)** uses `@dnd-kit/core` (v6.3.1, the stable release) to make `ActivityCell` components draggable and empty grid cells droppable, calling `PUT /api/room-schedule/move` on drop with optimistic UI updates and conflict error handling.

The key technical risks are: (1) @dnd-kit keyboard sensor default arrow key directions may be reversed in RTL -- requires early validation with a custom `coordinateGetter`, (2) the CSS grid layout uses absolute positioning for activity cells which interacts with dnd-kit's transform-based movement -- `DragOverlay` solves this by rendering the dragged element in a portal, and (3) empty cell droppables need careful ID encoding (`room::startTime`) to extract target room and time from the drop event.

**Primary recommendation:** Use `@dnd-kit/core` v6.3.1 (legacy stable API with `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`) rather than the new `@dnd-kit/react` v0.3.x (pre-1.0, API still changing). Implement filters as pure client-side `useMemo` filtering of the schedule data, not as API parameters.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 | DndContext, useDraggable, useDroppable, sensors, collision detection | Stable release, ~10KB core, no external deps, chosen by prior decision |
| @dnd-kit/utilities | ^3.2.2 | CSS utility (CSS.Transform.toString) for drag transforms | Companion to @dnd-kit/core |
| React 18 | ^18.3.1 | Component framework | Project standard |
| TypeScript | ^5.9.3 | Type safety | Project standard |
| Tailwind CSS | Project version | Styling, RTL, responsive | Project standard |
| @radix-ui/react-dialog | ^1.1.15 | Click-to-create form dialog | Already installed |
| @radix-ui/react-select | Already installed | Teacher/room select dropdowns in filters | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx / cn | Already installed | Conditional CSS classes | Drag state styling, filter highlights |
| react-hot-toast | Already installed | Success/error notifications | Move success, conflict error messages |
| @phosphor-icons/react | Already installed | Filter icons, drag handle icon | Filter bar UI elements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core v6.3.1 (legacy stable) | @dnd-kit/react v0.3.x (new) | New version is pre-1.0, API still changing (0.3.2 published 11 days ago). Legacy v6.3.1 is battle-tested. Migration can happen later. |
| Client-side filtering | Server-side filter params on API | The schedule data for one day is small (~60-100 activities). Client-side filtering is instant, avoids extra API calls, and keeps the code simpler. Server-side would only matter at >500 activities/day. |
| @dnd-kit/sortable | No sortable preset | This is NOT a sortable list. Activities move between grid cells (different rooms/times), not reorder within a list. useDroppable + useDraggable are the correct primitives. |

**Installation:**
```bash
cd /mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend
npm install @dnd-kit/core@^6.3.1 @dnd-kit/utilities@^3.2.2
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    RoomSchedule.tsx              # Updated: adds filter state, DndContext wrapper, create dialog state
  components/
    room-schedule/
      DaySelector.tsx             # UNCHANGED from Phase 33
      RoomGrid.tsx                # Updated: grid cells become droppable, activities become draggable
      ActivityCell.tsx            # Updated: wrap with useDraggable, add drag handle
      SummaryBar.tsx              # UNCHANGED from Phase 33
      UnassignedRow.tsx           # UNCHANGED from Phase 33
      utils.ts                   # UNCHANGED from Phase 33
      FilterBar.tsx              # NEW: teacher name search, room select, activity type toggles
      CreateLessonDialog.tsx     # NEW: Radix Dialog form for creating time block in empty cell
      DroppableCell.tsx          # NEW: wrapper for empty grid cells with useDroppable
      DragOverlayContent.tsx     # NEW: visual feedback shown during drag
  services/
    apiService.js                # Already has roomScheduleService.moveActivity + teacherService.getTeachers
```

### Pattern 1: Client-Side Filtering with useMemo
**What:** Filter the `schedule.rooms` array in memory based on filter state (teacher name, room name, activity type). No new API calls.
**When to use:** For all three filter types (EDIT-04, EDIT-05, EDIT-06).
**Example:**
```typescript
// In RoomSchedule.tsx
const [filters, setFilters] = useState({
  teacherName: '',
  roomName: '',
  activityTypes: ['timeBlock', 'rehearsal', 'theory'] as string[],
})

const filteredRooms = useMemo(() => {
  if (!schedule) return []

  return schedule.rooms
    // Filter by room name
    .filter(room => !filters.roomName || room.room.includes(filters.roomName))
    // Filter activities within each room
    .map(room => ({
      ...room,
      activities: room.activities.filter(activity => {
        // Activity type filter
        if (!filters.activityTypes.includes(activity.source)) return false
        // Teacher name filter
        if (filters.teacherName && !activity.teacherName.includes(filters.teacherName)) return false
        return true
      }),
    }))
    // Remove rooms with no matching activities (unless filtering by room name explicitly)
    .filter(room => room.activities.length > 0 || (filters.roomName && room.room.includes(filters.roomName)))
}, [schedule, filters])
```

### Pattern 2: DndContext at Page Level
**What:** Wrap the entire grid in `DndContext` from `@dnd-kit/core`. The page component handles `onDragEnd` by calling `roomScheduleService.moveActivity()`.
**When to use:** For the drag-and-drop interaction (EDIT-02, EDIT-03).
**Example:**
```typescript
// In RoomSchedule.tsx
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // 8px minimum drag before activating
  }),
  useSensor(KeyboardSensor)
)

const [activeActivity, setActiveActivity] = useState<ActivityData | null>(null)

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  setActiveActivity(null)

  if (!over) return // dropped outside any droppable

  const activity = active.data.current as ActivityData & { room: string; teacherId: string }
  const [targetRoom, targetStartTime] = (over.id as string).split('::')

  // Calculate target end time from activity duration
  const durationMinutes = timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)
  const targetEndMinutes = timeToMinutes(targetStartTime) + durationMinutes
  const targetEndTime = minutesToTime(targetEndMinutes)

  // Skip if dropped on same cell
  if (targetRoom === activity.room && targetStartTime === activity.startTime) return

  try {
    const moveData = {
      activityId: activity.id,
      source: activity.source,
      targetRoom,
      targetStartTime,
      targetEndTime,
      ...(activity.source === 'timeBlock' ? { teacherId: activity.teacherId, blockId: extractBlockId(activity.id) } : {}),
    }

    const updatedSchedule = await roomScheduleService.moveActivity(moveData)
    setSchedule(updatedSchedule)
    toast.success('הפעילות הועברה בהצלחה')
  } catch (err) {
    if (err.response?.status === 409) {
      const conflicts = err.response.data.conflicts
      toast.error(`התנגשות: ${conflicts.map(c => c.teacherName).join(', ')} כבר בחדר`)
    } else {
      toast.error('שגיאה בהעברת הפעילות')
    }
    // Reload schedule to reset to server state
    loadSchedule()
  }
}
```

### Pattern 3: Droppable Cell ID Encoding
**What:** Each empty grid cell is a droppable with an ID encoding its room and time slot: `"roomName::HH:MM"`. The `onDragEnd` handler parses this ID to extract target room and start time.
**When to use:** For DroppableCell component IDs.
**Example:**
```typescript
// DroppableCell.tsx
import { useDroppable } from '@dnd-kit/core'

interface DroppableCellProps {
  room: string
  timeSlot: string  // "HH:MM"
  children?: React.ReactNode
}

export default function DroppableCell({ room, timeSlot, children }: DroppableCellProps) {
  const droppableId = `${room}::${timeSlot}`
  const { isOver, setNodeRef } = useDroppable({ id: droppableId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-full w-full transition-colors',
        isOver && 'bg-blue-50 ring-2 ring-blue-300 ring-inset'
      )}
    >
      {children}
    </div>
  )
}
```

### Pattern 4: DragOverlay for Visual Feedback
**What:** Use `DragOverlay` from `@dnd-kit/core` to render a copy of the dragged ActivityCell during drag. This prevents layout issues from the original cell being moved via CSS transforms.
**When to use:** Always, for visual drag feedback.
**Example:**
```typescript
// In RoomSchedule.tsx, inside DndContext
<DragOverlay>
  {activeActivity ? (
    <div className="w-40 opacity-90 shadow-lg">
      <ActivityCell activity={activeActivity} />
    </div>
  ) : null}
</DragOverlay>
```

### Pattern 5: Click-to-Create Empty Cell
**What:** Empty cells (not occupied by any activity) are clickable. Clicking opens a Radix Dialog with room, day, and start time pre-filled. The form lets admin select a teacher, then calls `POST /api/schedule/teacher/:teacherId/time-block` to create a new time block.
**When to use:** For EDIT-01 requirement.
**Example:**
```typescript
// Click handler on empty cell
function handleCellClick(room: string, timeSlot: string) {
  setCreateDialogState({
    open: true,
    room,
    day: selectedDay,
    startTime: timeSlot,
    endTime: addMinutes(timeSlot, 30), // default 30-min duration
  })
}
```

### Pattern 6: Empty Rooms as Grid Rows
**What:** Phase 33 only showed rooms with activities. Phase 34 needs to show ALL rooms (including empty ones) so they can be drop targets and have clickable empty cells.
**When to use:** For the grid rendering in Phase 34.
**Example:**
```typescript
// Fetch tenant rooms list for empty room rows
// The rooms are already available from tenant.settings.rooms[]
// Option A: Fetch from Settings page API
// Option B: Include rooms list in room-schedule API response
// Recommendation: Fetch separately from tenantService.getRooms(tenantId) and merge with schedule data
const allRooms = useMemo(() => {
  const scheduleRoomNames = new Set(schedule?.rooms.map(r => r.room) || [])
  const emptyRooms = tenantRooms
    .filter(r => r.isActive && !scheduleRoomNames.has(r.name))
    .map(r => ({ room: r.name, activities: [], hasConflicts: false }))
  return [...(schedule?.rooms || []), ...emptyRooms]
}, [schedule, tenantRooms])
```

### Anti-Patterns to Avoid
- **Using @dnd-kit/sortable:** This is NOT a sortable list. Activities move between arbitrary cells, not reorder within a list. Use `useDraggable` + `useDroppable` directly.
- **Optimistic UI for drag-and-drop:** Do NOT optimistically move the activity in state before the API responds. The API does conflict validation that the frontend cannot fully replicate (teacher/student conflicts across rooms). Wait for the API response, then update state with the full fresh schedule.
- **Making every time slot a droppable:** With 24 slots x 20+ rooms = 480+ droppables. This is fine for @dnd-kit (it handles hundreds of droppables efficiently), but each droppable needs a DOM node. Use the grid cell divs that already exist as background cells in RoomGrid.
- **Filtering via API parameters:** The schedule for one day is ~60-100 activities. Client-side filtering is instant and avoids network latency. Only move to server-side filtering if data grows beyond 500 activities/day.
- **Building a custom drag implementation:** HTML5 drag-and-drop has poor RTL support, no touch support, and limited visual feedback. Use @dnd-kit which handles all of this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop interaction | Custom mousedown/mousemove/mouseup | @dnd-kit/core | Touch support, keyboard accessibility, collision detection, RTL compat |
| Drag visual feedback | Clone element manually | @dnd-kit DragOverlay | Renders in portal, avoids CSS grid position issues |
| Collision detection | Custom hit-test math | @dnd-kit closestCenter algorithm | Handles edge cases, grid-aware, configurable |
| Form dialog | Custom modal | Radix Dialog (already installed) | Focus trap, escape handling, accessibility, portal rendering |
| Text search filtering | Custom string matching | String.includes() with toLowerCase | Simple substring match is sufficient for teacher/room names |
| Select dropdowns | Custom dropdown | Radix Select (already installed) | Keyboard navigation, ARIA, portal, scroll management |

**Key insight:** @dnd-kit provides the entire drag-and-drop infrastructure (sensors, collision detection, keyboard nav, visual feedback). The custom code is only: (a) encoding droppable cell IDs, (b) calling the move API on drop, and (c) handling the 409 conflict response.

## Common Pitfalls

### Pitfall 1: RTL Keyboard Navigation Reversal
**What goes wrong:** In RTL mode, the user expects Left arrow to move the dragged item to the RIGHT (next time slot) and Right arrow to move LEFT (previous time slot). dnd-kit's default `KeyboardSensor` does not automatically detect RTL direction.
**Why it happens:** The default `coordinateGetter` moves items by pixel offset in screen coordinates, which does not account for logical direction in RTL layouts.
**How to avoid:** Create a custom `coordinateGetter` that swaps Left/Right arrow behavior when `document.dir === 'rtl'` or `getComputedStyle(document.documentElement).direction === 'rtl'`. Test with keyboard-only navigation in the Hebrew UI early.
**Warning signs:** Pressing Left arrow moves the drag preview to the left (towards later times) instead of right (towards earlier times). Users report keyboard drag feels "backwards."

### Pitfall 2: CSS Grid Position vs DnD Transform
**What goes wrong:** Activity cells are positioned using `gridColumn` CSS property. When @dnd-kit applies CSS transforms during drag, the element moves relative to its grid position, causing visual jank or incorrect positioning.
**Why it happens:** @dnd-kit's `useDraggable` applies `transform` to the dragged element. Combined with CSS grid's explicit column placement, the visual result is unpredictable.
**How to avoid:** Use `DragOverlay` component. When drag starts, hide the original element (set `opacity: 0`) and render a clone in the `DragOverlay` portal. The overlay follows the pointer without grid position interference.
**Warning signs:** The dragged element "jumps" when drag starts, or snaps to wrong positions.

### Pitfall 3: TimeBlock ID Parsing for Move API
**What goes wrong:** The move API requires `blockId` and `teacherId` for timeBlock source moves. The activity ID from the grid is `blockId_0`, `blockId_1` (lesson index suffix). Passing the full activity ID as `blockId` causes a 404.
**Why it happens:** Phase 32-02 emits timeBlock activities with `id: ${blockId}_${lessonIndex}`. The move API operates on the BLOCK level, needing the raw `blockId` without the suffix.
**How to avoid:** Parse the activity ID: `const blockId = activity.id.includes('_') ? activity.id.split('_').slice(0, -1).join('_') : activity.id`. Also ensure `teacherId` is available on the activity data (it is -- the API returns `teacherId` on every activity).
**Warning signs:** Move API returns 404 for timeBlock activities despite the activity existing.

### Pitfall 4: Conflict Error Display
**What goes wrong:** The 409 conflict response includes an array of conflicting activities, but the error toast just shows a generic "conflict detected" message without useful details.
**Why it happens:** Not parsing the conflict response body properly.
**How to avoid:** The 409 response body is `{ error: 'Conflict detected', conflicts: [{ id, source, teacherName, startTime, endTime }] }`. Display the conflicting teacher names and times in the error toast or a brief error banner. For example: "התנגשות: דנה כהן (14:00-15:00) כבר בחדר זה" (Conflict: Dana Cohen (14:00-15:00) already in this room).
**Warning signs:** Users see "conflict" but don't know which activity conflicts or why.

### Pitfall 5: Empty Cell Click vs Drag Start
**What goes wrong:** Clicking an empty cell to open the create dialog also triggers drag start if the cell is wrapped in a droppable. Or, starting a drag on an activity triggers the cell click event underneath.
**Why it happens:** Event propagation and the interaction between click handlers and @dnd-kit's sensor activation.
**How to avoid:** @dnd-kit's `PointerSensor` with `activationConstraint: { distance: 8 }` means the drag only starts after 8px of movement. A plain click (no movement) does NOT activate drag. For empty cells, attach the `onClick` handler to the droppable div -- clicks open the create dialog, drags onto the cell trigger the drop. The `isDragging` state from `DndContext` can be used to suppress click handlers during active drags.
**Warning signs:** Create dialog opens when trying to drag, or drag starts when trying to click.

### Pitfall 6: Filter State Resetting on Day Change
**What goes wrong:** When the admin switches days using DaySelector, the filter state resets and the admin loses their filter context.
**Why it happens:** The day change triggers a schedule refetch, and if filters are cleared on refetch, the filter state is lost.
**How to avoid:** Keep filter state independent of schedule data. Filters should persist across day changes. The `filteredRooms` `useMemo` applies filters to whatever schedule data is currently loaded.
**Warning signs:** Admin applies a teacher filter, switches to Tuesday, and the filter is gone.

### Pitfall 7: Create Lesson Requires Teacher Selection
**What goes wrong:** The click-to-create form opens with room/day/time pre-filled, but the admin cannot submit because no teacher is selected and the teacher list is not available.
**Why it happens:** The create time block API requires `teacherId` in the URL path. The room schedule page does not load the teacher list by default.
**How to avoid:** Fetch the teacher list once when the page loads (or lazily when the create dialog opens). Use `teacherService.getTeachers()` to get active teachers. Provide a searchable teacher select in the dialog. Cache the teacher list in state so it's available for subsequent create actions without refetching.
**Warning signs:** Create dialog has no teacher dropdown, or the teacher list takes too long to load when the dialog opens.

## Code Examples

### ActivityCell with useDraggable
```typescript
// Updated ActivityCell.tsx -- add draggable capability
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface ActivityCellProps {
  activity: ActivityData & { room: string; teacherId: string }
  isDragEnabled?: boolean
}

export default function ActivityCell({ activity, isDragEnabled = false }: ActivityCellProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: activity,
    disabled: !isDragEnabled,
  })

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  } : undefined

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDragEnabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'rounded px-1.5 py-1 text-xs overflow-hidden h-full border relative',
        isDragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        colors.bg, colors.text,
        activity.hasConflict ? CONFLICT_BORDER : colors.border
      )}
    >
      {/* ... existing content ... */}
    </div>
  )

  // ... tooltip wrapper ...
}
```

### DroppableCell Component
```typescript
// New: DroppableCell.tsx
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableCellProps {
  room: string
  timeSlot: string
  onClick?: () => void
  children?: React.ReactNode
}

export default function DroppableCell({ room, timeSlot, onClick, children }: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${room}::${timeSlot}`,
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'h-full w-full min-h-[40px] transition-colors',
        isOver && 'bg-blue-50 ring-2 ring-blue-300 ring-inset rounded',
        onClick && 'cursor-pointer hover:bg-gray-50'
      )}
    >
      {children}
    </div>
  )
}
```

### FilterBar Component
```typescript
// New: FilterBar.tsx
import { MagnifyingGlass, Funnel, X } from '@phosphor-icons/react'

interface FilterBarProps {
  filters: {
    teacherName: string
    roomName: string
    activityTypes: string[]
  }
  onFiltersChange: (filters: FilterBarProps['filters']) => void
  rooms: string[]  // available room names for dropdown
}

export default function FilterBar({ filters, onFiltersChange, rooms }: FilterBarProps) {
  const ACTIVITY_TYPE_OPTIONS = [
    { value: 'timeBlock', label: 'שיעור פרטי', color: 'bg-blue-100 text-blue-800' },
    { value: 'rehearsal', label: 'חזרה', color: 'bg-purple-100 text-purple-800' },
    { value: 'theory', label: 'תאוריה', color: 'bg-orange-100 text-orange-800' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Teacher search input */}
      <div className="relative">
        <MagnifyingGlass className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש מורה..."
          value={filters.teacherName}
          onChange={(e) => onFiltersChange({ ...filters, teacherName: e.target.value })}
          className="pr-9 pl-3 py-2 text-sm border rounded-md w-48"
        />
      </div>

      {/* Room select */}
      <select
        value={filters.roomName}
        onChange={(e) => onFiltersChange({ ...filters, roomName: e.target.value })}
        className="py-2 px-3 text-sm border rounded-md"
      >
        <option value="">כל החדרים</option>
        {rooms.map(room => (
          <option key={room} value={room}>{room}</option>
        ))}
      </select>

      {/* Activity type toggles */}
      {ACTIVITY_TYPE_OPTIONS.map(type => {
        const isActive = filters.activityTypes.includes(type.value)
        return (
          <button
            key={type.value}
            onClick={() => {
              const newTypes = isActive
                ? filters.activityTypes.filter(t => t !== type.value)
                : [...filters.activityTypes, type.value]
              onFiltersChange({ ...filters, activityTypes: newTypes })
            }}
            className={cn(
              'px-3 py-1.5 text-xs rounded-full border transition-colors',
              isActive ? type.color + ' border-transparent' : 'bg-gray-50 text-gray-400 border-gray-200'
            )}
          >
            {type.label}
          </button>
        )
      })}

      {/* Clear filters button */}
      {(filters.teacherName || filters.roomName || filters.activityTypes.length < 3) && (
        <button
          onClick={() => onFiltersChange({ teacherName: '', roomName: '', activityTypes: ['timeBlock', 'rehearsal', 'theory'] })}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <X size={12} /> נקה סינון
        </button>
      )}
    </div>
  )
}
```

### Move API Error Handling
```typescript
// Error handling pattern for move API calls
async function handleMoveActivity(moveData: MoveData) {
  try {
    const updatedSchedule = await roomScheduleService.moveActivity(moveData)
    setSchedule(updatedSchedule)
    toast.success('הפעילות הועברה בהצלחה')
  } catch (err: any) {
    const status = err?.response?.status || err?.status
    const data = err?.response?.data || err?.data

    if (status === 409 && data?.conflicts) {
      // Show conflict details
      const conflictNames = data.conflicts
        .map((c: any) => `${c.teacherName} (${c.startTime}-${c.endTime})`)
        .join(', ')
      toast.error(`התנגשות בחדר: ${conflictNames}`)
    } else if (status === 404) {
      toast.error('הפעילות לא נמצאה')
    } else {
      toast.error('שגיאה בהעברת הפעילות')
    }
    // Reload to get fresh server state
    loadSchedule()
  }
}
```

### BlockId Extraction Helper
```typescript
// Helper to extract blockId from timeBlock activity ID
// Activity IDs from API: "blockObjectId" (no lessons) or "blockObjectId_0" (lesson index)
function extractBlockId(activityId: string): string {
  // ObjectIds are 24 hex chars. If the ID is longer, it has a _N suffix
  if (activityId.length > 24 && activityId.includes('_')) {
    // Find the last underscore and check if what follows is a number
    const lastUnderscore = activityId.lastIndexOf('_')
    const suffix = activityId.slice(lastUnderscore + 1)
    if (/^\d+$/.test(suffix)) {
      return activityId.slice(0, lastUnderscore)
    }
  }
  return activityId
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @dnd-kit/core v5.x | @dnd-kit/core v6.3.1 | 2023 | Better performance, improved collision detection |
| @dnd-kit/core (legacy) | @dnd-kit/react v0.3.x (new) | 2025 | New API surface (DragDropProvider, ref-based hooks). Pre-1.0, not recommended for production yet. |
| HTML5 drag-and-drop | @dnd-kit | N/A | HTML5 DnD has no touch support, poor RTL, no keyboard nav. @dnd-kit solves all of these. |

**Deprecated/outdated:**
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`: These are the "legacy" packages. Still fully functional and widely used. The maintainer is building `@dnd-kit/react` as the next generation, but it's v0.3.x and the API is still evolving. Use the legacy packages for this project.

## Open Questions

1. **Cross-Day Move Support**
   - What we know: Phase 32-02 only implemented same-day moves. The `moveActivity` API determines the day from the current activity's data and validates conflicts on that same day. There is no `targetDay` parameter.
   - What's unclear: Should drag-and-drop support moving activities to a different day (e.g., Tuesday to Wednesday)?
   - Recommendation: Do NOT implement cross-day moves in Phase 34. The grid shows one day at a time. Dragging between days would require a completely different UI paradigm (multi-day view or day-to-day navigation). The roadmap explicitly deferred this. If needed later, it requires a backend API change to add `targetDay` parameter.

2. **Teacher/Student Conflict Validation Beyond Room Conflicts**
   - What we know: The move API currently validates room conflicts only (no two activities in the same room at the same time). But EDIT-03 requires validating teacher, student, AND room conflicts.
   - What's unclear: Does the existing conflict check cover teacher conflicts? If a teacher has two activities in different rooms at overlapping times, that is a teacher conflict but NOT a room conflict. The current `moveActivity` only checks the target room.
   - Recommendation: The existing API checks room-level conflicts at the target room. Teacher/student conflicts (same teacher in two rooms at same time) would require additional validation. However, this is a backend enhancement, not a frontend concern. For Phase 34, the frontend should display whatever conflict info the API returns. If the backend needs to be enhanced to check teacher/student conflicts in `moveActivity`, that should be a backend sub-task within 34-03 or a separate mini-phase.

3. **Empty Rooms Data Source**
   - What we know: The room schedule API only returns rooms that have activities. Phase 33 only showed populated rooms. Phase 34 needs to show ALL rooms for drag targets and click-to-create.
   - What's unclear: Should the room schedule API be updated to include all rooms, or should the frontend fetch the room list separately?
   - Recommendation: Fetch the room list separately from `tenantService.getRooms(tenantId)` (already available in apiService.js). Merge with schedule data in `useMemo`. This avoids changing the existing API and keeps the room data source (tenant.settings.rooms) as the single truth for room names.

4. **Which Teacher to Assign When Creating from Empty Cell**
   - What we know: The create time block API requires a `teacherId`. The room grid is room-centric, not teacher-centric.
   - What's unclear: How does the admin select which teacher the new time block belongs to?
   - Recommendation: The create dialog must include a teacher select dropdown. Fetch the teacher list via `teacherService.getTeachers()` when the page loads or when the dialog opens. The teacher select should be searchable (typeahead) since there may be 30-130 teachers.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all relevant source files:
  - Backend: `api/room-schedule/room-schedule.service.js` -- move API implementation, conflict pre-check, 3-source aggregation, activity ID format
  - Backend: `api/room-schedule/room-schedule.controller.js` -- HTTP status codes (200, 400, 404, 409), error response shapes
  - Backend: `api/room-schedule/room-schedule.validation.js` -- moveBody schema (activityId, source, targetRoom, targetStartTime, targetEndTime, teacherId, blockId)
  - Backend: `api/room-schedule/room-schedule.route.js` -- PUT /move admin-only, GET / admin-only
  - Backend: `api/schedule/time-block.service.js` -- createTimeBlock(teacherId, blockData, options)
  - Backend: `api/schedule/time-block.validation.js` -- createTimeBlockSchema (day, startTime, endTime, location, notes)
  - Backend: `api/schedule/time-block.route.js` -- POST /teacher/:teacherId/time-block
  - Frontend: `src/components/room-schedule/*.tsx` -- All Phase 33 components (ActivityCell, RoomGrid, DaySelector, SummaryBar, UnassignedRow, utils.ts)
  - Frontend: `src/pages/RoomSchedule.tsx` -- Current page with data fetching, stats computation, component integration
  - Frontend: `src/services/apiService.js` -- roomScheduleService (getRoomSchedule, moveActivity), teacherService.getTeachers(), tenantService.getRooms()
  - Frontend: `src/components/ui/dialog.tsx` -- Radix Dialog wrapper with framer-motion animations
  - Frontend: `src/components/ui/select.tsx` -- Radix Select wrapper
  - Frontend: `src/components/ui/input.tsx` -- Input component

- **Planning documents**:
  - `.planning/ROADMAP.md` -- Phase 34 description, requirements EDIT-01 through EDIT-06, plan structure
  - `.planning/REQUIREMENTS.md` -- Full requirement definitions
  - `.planning/phases/32-room-schedule-api-conflict-detection/32-02-PLAN.md` -- Move endpoint plan with API contract details
  - `.planning/phases/32-room-schedule-api-conflict-detection/32-02-SUMMARY.md` -- Move endpoint implementation confirmation
  - `.planning/phases/33-read-only-room-grid-ui/33-RESEARCH.md` -- Grid architecture, API response shape, all type interfaces
  - `.planning/phases/33-read-only-room-grid-ui/33-01-PLAN.md` -- Grid skeleton, API service, route registration
  - `.planning/phases/33-read-only-room-grid-ui/33-02-PLAN.md` -- ActivityCell, color coding, conflict stacking
  - `.planning/phases/33-read-only-room-grid-ui/33-03-PLAN.md` -- SummaryBar, UnassignedRow

### Secondary (MEDIUM confidence)
- [@dnd-kit npm package](https://www.npmjs.com/package/@dnd-kit/core) -- Version 6.3.1, last published ~1 year ago
- [@dnd-kit official site](https://dndkit.com/) -- Architecture overview, framework support, DragDropProvider
- [@dnd-kit migration guide](https://dndkit.com/react/guides/migration) -- New @dnd-kit/react v0.3.x API changes (DragDropProvider, useDraggable ref-based API)
- [@dnd-kit collision detection docs](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms) -- closestCenter, closestCorners, rectIntersection algorithms
- [@dnd-kit keyboard sensor docs](https://docs.dndkit.com/api-documentation/sensors/keyboard) -- coordinateGetter customization for keyboard navigation
- [dnd-kit GitHub discussions](https://github.com/clauderic/dnd-kit/discussions/1313) -- Multiple draggable/droppable patterns for grids

### Tertiary (LOW confidence)
- RTL behavior of @dnd-kit keyboard sensor -- No official documentation found specifically addressing RTL. The custom `coordinateGetter` approach is a reasonable inference from the keyboard sensor API docs but has not been verified with an RTL test. **Needs early validation in Phase 34-03.**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @dnd-kit/core v6.3.1 is well-documented and widely used. All other libs already installed.
- Architecture: HIGH - All patterns derived from existing codebase analysis and verified API contracts.
- Pitfalls: HIGH for codebase-specific pitfalls (ID parsing, API error handling). MEDIUM for RTL keyboard behavior (needs validation).
- Filtering: HIGH - Simple client-side `useMemo` on small dataset, no complexity.
- Click-to-create: HIGH - Uses existing time block API and Radix Dialog pattern.
- Drag-and-drop: MEDIUM-HIGH - @dnd-kit core API is well understood, but RTL + CSS grid integration needs testing.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days -- @dnd-kit/core v6.3.1 is stable; the new @dnd-kit/react may reach 1.0 by then but is not needed for this phase)
