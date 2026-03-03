---
phase: 31-room-data-foundation
plan: 03
subsystem: scripts, database
tags: [seed-data, mongodb, rooms, rehearsals, theory-lessons, conflicts, testing]

# Dependency graph
requires:
  - "31-01: Room CRUD API and tenant.settings.rooms[] schema"
provides:
  - "Dev seed script producing rooms in tenant.settings.rooms[] (29 rooms)"
  - "Dev seed script producing 120+ rehearsals in rehearsal collection with room-referenced locations"
  - "Dev seed script producing 40+ theory lessons in theory_lesson collection with room-referenced locations"
  - "Dev seed script producing 12 intentional scheduling conflicts (same-room, cross-source, teacher double-booking)"
  - "Dev seed script producing 130 teachers with 390+ time blocks using location field (not room)"
  - "All time slots use 30-minute alignment for grid compatibility"
affects: [32-hours-management-table, 33-unified-schedule-query, 34-drag-drop-scheduling, 35-room-schedule-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Intentional conflict generation pattern: read existing records, create overlapping record in different collection"
    - "Resilient index creation: try/catch per index to skip pre-existing indexes with different names"
    - "30-minute aligned time generation for grid slot compatibility"

key-files:
  created: []
  modified:
    - "scripts/seed-dev-data.js"

key-decisions:
  - "Theory categories subset (6 of 14) sufficient for dev testing"
  - "12 intentional conflicts: 6 same-room, 3 cross-source, 3 teacher double-booking"
  - "LOCATIONS array produces 29 rooms (7 named + 20 numbered + 2 theory)"
  - "Index creation uses individual try/catch to handle pre-existing indexes gracefully"

patterns-established:
  - "Conflict labeling: notes field contains INTENTIONAL_CONFLICT:{type} for easy querying"
  - "Seed script cleanup includes all seeded collections (student, teacher, orchestra, rehearsal, theory_lesson, school_year, tenant)"

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 31 Plan 03: Dev Seed Data Extension Summary

**Extended seed script producing 29 rooms, 130 teachers with 390+ time blocks, 120+ rehearsals, 40+ theory lessons, and 12 intentional scheduling conflicts across all three data sources for Phase 32 grid development**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T01:09:47Z
- **Completed:** 2026-03-03T01:16:03Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Fixed timeBlock field name from `room` to `location` (matching service code and production data)
- Added rooms to `tenant.settings.rooms[]` from LOCATIONS array (29 rooms with _id, name, isActive, createdAt)
- Generated 120+ rehearsals per orchestra (2-3 per orchestra across different days) with room-referenced locations
- Generated 40+ theory lessons across 6 categories with assigned teachers and students
- Created 12 intentional scheduling conflicts: 6 same-room (3 rehearsal vs time-block, 3 theory vs time-block), 3 cross-source (rehearsal vs rehearsal, theory vs rehearsal, theory vs theory), 3 teacher double-booking
- Updated `--clean`/`--drop-only` to include `rehearsal` and `theory_lesson` collections
- All times use 30-minute alignment (minutes are only 00 or 30) for grid slot compatibility
- Updated `generateTime()` to only produce 00 or 30 minute values (removed 15 and 45)
- Also fixed `teacherAssignment.location` in students to reference `teacherTimeBlock.location` instead of `.room`
- Script grew from 547 lines to 982 lines

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend seed script with rooms, rehearsals, theory lessons, and conflicts** - `4e4c37d` (feat)

## Files Created/Modified

- `scripts/seed-dev-data.js` - Extended dev seed script with rooms, rehearsals, theory lessons, intentional conflicts, and resilient index creation

## Decisions Made

- Used a subset of 6 theory categories (out of 14 total VALID_THEORY_CATEGORIES) -- sufficient for dev testing variety
- Generated 5-8 theory lessons per category to ensure 30+ total
- Created 12 intentional conflicts across 3 types for comprehensive Phase 32 conflict detection testing
- Made index creation resilient (individual try/catch) because existing production indexes on orchestra collection have custom names that conflict with auto-generated names
- Replaced unicode box-drawing characters in console output with ASCII equivalents for better cross-platform compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed student teacherAssignment.location referencing old room field**
- **Found during:** Task 1
- **Issue:** `generateStudents()` set `location: teacherTimeBlock.room` but the field was renamed to `teacherTimeBlock.location`
- **Fix:** Changed to `location: teacherTimeBlock.location`
- **Files modified:** `scripts/seed-dev-data.js`
- **Committed in:** `4e4c37d`

**2. [Rule 3 - Blocking] Index creation fails on pre-existing orchestra index**
- **Found during:** Task 1 (verification run)
- **Issue:** `createIndex({ tenantId: 1, isActive: 1 })` on orchestra collection failed because an existing index `idx_reporting_orchestra_tenant` already covered the same key pattern with a different name
- **Fix:** Wrapped each createIndex call in individual try/catch, skipping indexes with error code 85 (IndexOptionsConflict)
- **Files modified:** `scripts/seed-dev-data.js`
- **Committed in:** `4e4c37d`

**3. [Rule 1 - Bug] Theory lesson count too low with original 2-4 per category**
- **Found during:** Task 1 (verification run)
- **Issue:** 6 categories x 2-4 lessons = 12-24, but plan requires 30+ theory lessons
- **Fix:** Increased per-category count to 5-8 lessons, producing 30-48 total
- **Files modified:** `scripts/seed-dev-data.js`
- **Committed in:** `4e4c37d`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 31 (Room Data Foundation) is now COMPLETE: CRUD API (plan 01), dynamic validation (plan 02), seed data (plan 03)
- Seed data provides sufficient volume for Phase 32: 130 teachers, 390+ time blocks, 120+ rehearsals, 40+ theory lessons
- 12 intentional conflicts across all 3 data sources ready for Phase 32 conflict detection development
- All time slots use 30-minute alignment, compatible with grid's 30-minute slot system
- Room names are consistent across all data sources (tenant.settings.rooms[], time blocks, rehearsals, theory lessons)

## Self-Check: PASSED

- scripts/seed-dev-data.js: FOUND
- Commit 4e4c37d: FOUND
- Key patterns verified: settings.rooms, INTENTIONAL_CONFLICT, rehearsal, theory_lesson, location: pick(LOCATIONS)
- Seed script line count: 982 (>= 600 minimum)

---
*Phase: 31-room-data-foundation*
*Completed: 2026-03-03*
