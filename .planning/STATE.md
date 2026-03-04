# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** Phase 38 — Single-Lesson Reschedule & Detail Modal

## Current Position

Phase: 38 (Single-Lesson Reschedule & Detail Modal)
Plan: 3 of 3 in current phase (gap closure plan 03 added)
Status: Phase 38 COMPLETE (including gap closure)
Last activity: 2026-03-04 — Completed 38-03 (client-side DnD conflict guard)

Progress: [==============] 3/3 plans (Phase 38)

## Performance Metrics

**Previous milestones:** 30 phases, 66 plans across 6 milestones
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)

## Accumulated Context

### Decisions

- v1.6 scope: Room & Hours Management Table (5 phases, 22 requirements)
- Rooms stored in tenant.settings.rooms[] (not separate collection)
- Three data sources to unify: teacher.teaching.timeBlocks[], rehearsal collection, theory_lesson collection
- @dnd-kit for drag-and-drop (~18KB gzipped, frontend only)
- Phase 32 spike: measure aggregation vs materialized collection query time before committing
- Seed data at Phase 31 end to support all subsequent phases
- 31-01: Duplicate room name check is case-sensitive with normalized whitespace
- 31-01: Deactivation (isActive=false) over deletion for referential safety
- 31-01: Tenant sub-resource CRUD pattern: /tenant/:id/{resource}/:resourceId
- 31-02: Dynamic room validation via middleware query (not hardcoded arrays)
- 31-02: Backward compat: skip room validation when tenant has no rooms configured
- 31-02: theoryValidation.validateLocation delegates to roomValidation.validateRoomExists
- 31-02: Migration seeds VALID_THEORY_LOCATIONS (34 rooms) for tenants without rooms
- 31-03: Theory categories subset (6 of 14) sufficient for dev testing
- 31-03: 12 intentional conflicts: 6 same-room, 3 cross-source, 3 teacher double-booking
- 31-03: LOCATIONS array produces 29 rooms; all location fields use consistent `location` name
- 32-01: On-the-fly aggregation with timing instrumentation (no materialized collection yet)
- 32-01: Union-find for transitive conflict grouping across sources
- 32-01: Empty timeBlocks (no assignedLessons) emitted as single block activity for room occupancy
- 32-01: Rehearsal/theory deduplication via MongoDB $group by weekly pattern composite key
- 32-02: TimeBlock move updates entire block (not individual lessons) -- block is the grid unit
- 32-02: Conflict pre-check reuses getRoomSchedule + doTimesOverlap (centralized logic)
- 32-02: Same-day moves only; cross-day moves deferred to Phase 34
- 33-01: SquaresFourIcon for sidebar nav (distinct from CalendarIcon used by rehearsals)
- 33-01: Fixed 08:00-20:00 grid range with 24 half-hour slots
- 33-01: Initial day defaults to current weekday; Saturday wraps to Sunday
- 33-01: Only rooms with activities shown (empty rooms deferred to Phase 34)
- 33-02: ActivityCell as standalone component with exported ActivityData type for Phase 34 reuse
- 33-02: Conflict stacking uses flex-column within grid cell spanning full conflict group time range
- 33-02: Dynamic row heights: 60px base + 32px per stacked conflict item
- 33-02: TooltipProvider wraps each cell with 300ms delay to prevent tooltip spam
- 33-03: BuildingOffice icon for rooms stat card (distinct from MapPinIcon used for locations)
- 33-03: Conflict count card dynamically switches green/red based on count value
- 33-03: Shared utils.ts extracted for timeToMinutes and grid constants (eliminates duplication)
- 33-03: Slot occupancy computed via Set<number> per room for correct overlap handling
- 34-01: Client-side filtering via useMemo (no new API calls) -- schedule data per day is small
- 34-01: Empty rooms from tenant settings merged into filteredRooms for grid display
- 34-01: Stats recomputed from filteredRooms so summary bar reflects active filter state
- 34-01: DAY_NAMES moved to shared utils.ts; minutesToTime added for Plan 34-03
- 34-02: Searchable teacher list via text input + scrollable div (not Radix Select) for Hebrew search
- 34-02: Occupied slot detection via Set<number> per room row for empty cell click targeting
- 34-02: Teachers fetched once on mount (not per dialog open) for performance
- 34-02: CreateDialogState interface: open, room, day, startTime, endTime as dialog prop contract
- 34-03: DndContext wraps only RoomGrid+DragOverlay, not entire page
- 34-03: PointerSensor 8px activation distance prevents click/drag conflict
- 34-03: apiService 409 handler added to preserve conflict details on error object
- 34-03: RTL keyboard navigation accepted as-is; custom coordinateGetter deferred to Phase 35
- 34-03: DroppableCell ID format: room::HH:MM with lastIndexOf parsing for safe room name handling
- 35-01: Tailwind print variant via screens config (raw: 'print') for print: utility classes
- 35-01: handleExportPDF placed after useMemo hooks to avoid block-scoped variable TDZ error
- 35-01: Page header + DaySelector hidden in print; SummaryBar stays visible for context
- 35-02: Local RoomScheduleDay interface in WeekOverview to avoid circular imports with RoomSchedule.tsx
- 35-02: insetInlineStart CSS property for RTL-correct mini-block positioning in WeekMiniGrid
- 35-02: Week cache invalidation via setWeekData(null) on any day-mode schedule reload
- 35-02: DaySelector hidden in week mode since all 6 days are visible simultaneously
- 36-01: Schedule logic ported inline (not imported) from seed-schedules.js for self-contained seed script
- 36-01: Morning/afternoon time block pattern (08-10 or 13-15 start, 3-5hr span) for realistic windows
- 36-01: pickDuration distribution: 30min 50%, 45min 40%, 60min 10%
- 36-01: Cross-reference verification samples 10 random teacher-student pairs for bidirectional consistency
- 37-01: borderAccent pattern: 4px right border per activity type (blue/purple/orange) for at-a-glance identification
- 37-01: Conflict indicator reduced to subtle border border-red-400 (safety net, not primary UX)
- 37-01: WarningCircle icon removed from conflict cells -- prevention over display
- 37-01: SummaryBar already reflects filtered data via filteredRooms chain -- no changes needed
- 37-01: Grid cells widened to 120px min columns, 80px row height, 40px stacked item height
- 37-01: Filter toggle inactive state uses line-through text for clear off visual
- 37-01: generateConflicts function deleted from seed-dev-data.js -- zero intentional conflicts in seed data
- 37-02: Room-level conflicts only in DroppableCell; teacher double-booking caught by backend move API
- 37-02: CreateLessonDialog checks both room and teacher conflicts client-side using loaded schedule data
- 37-02: Student double-booking handled by existing backend checkStudentScheduleConflict in assignLesson
- 37-02: doTimesOverlap ported from backend to frontend utils.ts for client-side conflict detection
- 37-03: Fullscreen route outside Layout (no sidebar/header) via separate Route without Layout wrapper
- 37-03: window.open with _blank for new-tab fullscreen UX (user keeps original tab)
- 37-03: Chrome-free page pattern: Route without Layout wrapper + ProtectedRoute for auth
- 37-04: Table icon (Phosphor) for tabular PDF button; FilePdf icon for grid PDF button
- 37-04: Grid PDF uses 5pt font, 1pt cell padding to fit 24 time columns in landscape
- 37-04: applyFilters extracted as standalone function for reuse in useMemo and PDF callbacks
- 37-04: Spanning activity slots show '...' continuation marker in grid PDF cells
- 37-fix: Hebrew prefix labels (מורה:/תלמיד:) added to ActivityCell 3-line content per verification gap
- 37-05: roomOccupancy Map with key format room::dayIndex for O(1) lookup per room-day pair
- 37-05: pickAvailableRoom returns null on no availability -- callers skip via continue
- 37-05: Orchestra location left as pick(LOCATIONS) -- home room, not time-bound booking
- 37-05: Accent borders widened to border-r-[6px] + border-l-2 for dual-border type identification
- 37-06: silentReloadSchedule skips setLoading to keep grid mounted and scroll preserved during DnD
- 37-06: Optimistic state update in handleDragEnd before API call for instant visual feedback
- 37-06: scrollContainerRef approach removed -- grid never unmounts so scroll is naturally preserved
- 37-07: JSX expression syntax {''} for placeholder instead of HTML attribute to ensure bundler interprets unicode escapes
- 37-07: Skip same-room in teacher double-booking loop to avoid duplicate warnings with room conflict
- 37-07: String() coercion on both sides of teacherId comparison for safety against ObjectId type mismatches
- 37-08: h-screen flex-col layout for fullscreen instead of min-h-screen (ensures grid fills exactly one viewport)
- 37-08: SummaryBar hidden in fullscreen to maximize grid space
- 37-08: Compact DaySelector inline instead of full page header in fullscreen
- 37-08: Grid columns 140px min in fullscreen (vs 120px normal) for wider time slots
- 37-09: Existing Reisinger-Yonatan TTF reused for PDF Hebrew rendering (no new font download)
- 37-09: Fetch-and-cache pattern: font base64 cached in module scope across multiple PDF exports
- 38-01: Conflict exclusion by lessonId field rather than blockId prefix to avoid masking sibling lessons
- 38-01: Empty block cleanup is non-fatal: logged but does not fail the reschedule operation
- 38-01: Duration fallback: uses targetEndTime - targetStartTime when lesson.duration is null
- 38-02: ActivityData extended with lessonId/studentId/duration/blockId as optional fields for backward compat
- 38-02: onClick on ActivityCell only fires when not dragging (isDragging check prevents click-on-drag)
- 38-02: Inline delete confirmation toggle (not window.confirm) for consistent UX within shadcn Dialog
- 38-02: Lesson-level DnD skips optimistic update (new backend entities have unpredictable IDs)
- 38-02: deleteLessonFromBlock reuses existing DELETE /lesson/:teacherId/:timeBlockId/:lessonId route
- 38-03: Client-side conflict guard in handleDragEnd uses same doTimesOverlap + room activities pattern as DroppableCell
- 38-03: schedule added to handleDragEnd useCallback deps since guard reads it directly

### Roadmap Evolution

- Phase 37 added: Room Schedule UX Fixes & Conflict Prevention (fullscreen mode, larger cells, teacher/student label clarity, functional activity type filters, PDF export fix, stronger color coding, conflict prevention at scheduling time)
- Phase 38 added: Single-Lesson Reschedule & Detail Modal (click-to-view lesson detail modal, single-lesson drag-and-drop independent from block, backend reschedule-lesson endpoint, client-side conflict prevention for drops)

### Pending Todos

None.

### Blockers/Concerns

- Phase 32: Aggregation vs materialized collection decision depends on measured query time with seed data
- Phase 34: dnd-kit RTL keyboard navigation needs early validation in Hebrew UI

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 31    | 01   | 14min    | 2     | 6     |
| 31    | 02   | 11min    | 2     | 12    |
| 31    | 03   | 6min     | 1     | 1     |
| 32    | 01   | 4min     | 2     | 5     |
| 32    | 02   | 2min     | 2     | 4     |
| 33    | 01   | 7min     | 2     | 6     |
| 33    | 02   | 10min    | 2     | 2     |
| 33    | 03   | 6min     | 2     | 5     |
| 34    | 01   | 6min     | 2     | 4     |
| 34    | 02   | 8min     | 2     | 3     |
| 34    | 03   | 9min     | 2     | 7     |
| 35    | 01   | 16min    | 2     | 4     |
| 35    | 02   | 11min    | 2     | 4     |
| 36    | 01   | 4min     | 2     | 1     |
| 37    | 01   | 9min     | 2     | 4     |
| 37    | 02   | 8min     | 2     | 5     |
| 37    | 03   | 5min     | 1     | 3     |
| 37    | 04   | 4min     | 2     | 2     |
| 37    | 05   | 3min     | 2     | 2     |
| 37    | 06   | 8min     | 1     | 1     |
| 37    | 07   | 4min     | 1     | 1     |
| 37    | 08   | 3min     | 1     | 3     |
| 37    | 09   | 5min     | 2     | 2     |
| 38    | 01   | 10min    | 2     | 4     |
| 38    | 02   | 9min     | 2     | 5     |
| 38    | 03   | 4min     | 1     | 1     |

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 38-03 (gap closure: client-side DnD conflict guard)
Resume: Phase 38 fully complete (3/3 plans including gap closure). Next milestone/phase TBD.
