---
phase: 31-room-data-foundation
plan: 02
subsystem: api, middleware, migration, ui
tags: [room-validation, excel-import, migration, dynamic-validation, tenant, settings]

# Dependency graph
requires:
  - "31-01: Room CRUD API and Settings page room management"
provides:
  - "Dynamic room validation middleware (validateRoomExists) on theory, rehearsal, orchestra routes"
  - "Excel room import endpoint POST /tenant/:id/rooms/import"
  - "Location normalization migration script with --dry-run support"
  - "Frontend Excel import UI button in Settings page"
affects: [32-hours-management-table, 33-unified-schedule-query]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic middleware validation querying tenant settings instead of hardcoded arrays"
    - "Backward compatibility: skip validation when no rooms configured"
    - "Multer memoryStorage for single-endpoint file upload (room Excel import)"
    - "Idempotent migration script with --dry-run flag"

key-files:
  created:
    - "middleware/roomValidation.js"
    - "scripts/migrations/normalize-locations.js"
  modified:
    - "api/theory/theory.validation.js"
    - "api/orchestra/orchestra.validation.js"
    - "middleware/theoryValidation.js"
    - "api/rehearsal/rehearsal.route.js"
    - "api/orchestra/orchestra.route.js"
    - "api/tenant/tenant.service.js"
    - "api/tenant/tenant.controller.js"
    - "api/tenant/tenant.route.js"
    - ".gitignore"
    - "src/services/apiService.js (frontend repo)"
    - "src/pages/Settings.tsx (frontend repo)"

key-decisions:
  - "theoryValidation.validateLocation delegates to roomValidation.validateRoomExists rather than duplicating logic"
  - "Backward compat: tenants with empty rooms[] skip room validation entirely (any location allowed)"
  - "Migration seeds 34 rooms (VALID_THEORY_LOCATIONS) for tenants without rooms configured"
  - "Excel import skips header row if first cell matches common header labels (name, room, etc.)"
  - ".gitignore updated to allow scripts/migrations/ while still ignoring generic migrations/"

patterns-established:
  - "Dynamic validation middleware pattern: query tenant settings at request time"
  - "Migration script pattern: idempotent with --dry-run, bulkWrite for efficiency"

# Metrics
duration: 11min
completed: 2026-03-03
---

# Phase 31 Plan 02: Dynamic Room Validation & Excel Import Summary

**Dynamic room validation middleware replacing hardcoded location arrays, Excel import endpoint with Settings UI, and idempotent location normalization migration script**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-03T00:55:54Z
- **Completed:** 2026-03-03T01:07:00Z
- **Tasks:** 2
- **Files modified:** 12 (9 backend + 2 frontend + 1 gitignore)

## Accomplishments

- Created `middleware/roomValidation.js` with `validateRoomExists` that queries tenant's active rooms from `settings.rooms[]` at request time
- Removed `.valid(...VALID_THEORY_LOCATIONS)` from 3 Joi schemas in `theory.validation.js` (create, bulk create, update)
- Removed `.valid(...VALID_LOCATIONS)` from 2 Joi schemas in `orchestra.validation.js` (create, update)
- Kept `VALID_THEORY_LOCATIONS` and `VALID_LOCATIONS` exported for migration reference and backward compatibility
- Wired `validateRoomExists` middleware into rehearsal create/update and orchestra create/update routes
- Made `theoryValidation.validateLocation` delegate to `validateRoomExists` (theory routes already use it via middleware chains)
- Added `importRooms` to tenant service: parses Excel column A, normalizes names, deduplicates, adds via `$push.$each`
- Added multer-based POST `/:id/rooms/import` route with 5MB limit and xlsx/xls file filter
- Created idempotent migration script that seeds rooms and normalizes location strings across timeBlocks, rehearsals, theory_lessons
- Migration supports `--dry-run` flag and reports unmatched locations for manual review
- Frontend Settings page now has "Import from Excel" button with file picker and success/skip count toast

## Task Commits

Each task was committed atomically:

1. **Task 1: Room Excel import endpoint and dynamic validation middleware** - `617a756` (feat) - Backend repo
2. **Task 2: Location normalization migration** - `a23d2a4` (feat) - Backend repo
3. **Task 2: Frontend import UI** - `506ff3a` (feat) - Frontend repo

## Files Created/Modified

### Created
- `middleware/roomValidation.js` - Dynamic room validation middleware querying tenant.settings.rooms[]
- `scripts/migrations/normalize-locations.js` - Idempotent migration: seed rooms + normalize locations

### Modified (Backend)
- `api/theory/theory.validation.js` - Removed `.valid()` from location in 3 schemas
- `api/orchestra/orchestra.validation.js` - Removed `.valid()` from location in 2 schemas
- `middleware/theoryValidation.js` - Delegates validateLocation to roomValidation.validateRoomExists
- `api/rehearsal/rehearsal.route.js` - Added validateRoomExists to POST/PUT routes
- `api/orchestra/orchestra.route.js` - Added validateRoomExists to POST/PUT routes
- `api/tenant/tenant.service.js` - Added importRooms function with XLSX parsing
- `api/tenant/tenant.controller.js` - Added importRooms handler
- `api/tenant/tenant.route.js` - Added POST /:id/rooms/import with multer
- `.gitignore` - Allow scripts/migrations/ directory

### Modified (Frontend)
- `src/services/apiService.js` - Added tenantService.importRooms() with FormData upload
- `src/pages/Settings.tsx` - Added Excel import button, file picker, import handler

## Decisions Made

- Theory routes already use `validateLocation` from `theoryValidation.js` middleware chains, so making it delegate to `validateRoomExists` was cleaner than rewiring routes
- Backward compatibility: when `rooms.length === 0`, skip validation entirely -- this is critical for existing tenants who haven't set up rooms yet
- Migration seeds the full 34-room VALID_THEORY_LOCATIONS list (includes rooms 1-26, special rooms, theory rooms)
- Excel import detects header rows by matching common labels in Hebrew and English
- The `.gitignore` had a blanket `migrations/` exclusion; added `!scripts/migrations/` exception

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore excluded scripts/migrations/ directory**
- **Found during:** Task 2
- **Issue:** The `.gitignore` had a blanket `migrations/` rule that prevented committing the migration script
- **Fix:** Added `!scripts/migrations/` exception below the existing rule
- **Files modified:** `.gitignore`
- **Commit:** `a23d2a4`

## Issues Encountered
- Frontend Vite build cannot run in WSL due to esbuild platform mismatch (pre-existing, not code-related)
- TypeScript check confirmed zero new errors in Settings.tsx

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dynamic room validation fully wired -- all location-accepting routes validate against tenant rooms
- Excel import ready for admin use on Settings page
- Migration script ready to run against production data with `--dry-run` first
- Room data foundation (Phase 31) is feature-complete after Plan 03 (seed data)

## Self-Check: PASSED

- middleware/roomValidation.js: FOUND
- scripts/migrations/normalize-locations.js: FOUND
- Backend commit 617a756: FOUND
- Backend commit a23d2a4: FOUND
- Frontend commit 506ff3a: FOUND
- Key patterns verified: validateRoomExists exported, importRooms in service/controller/route, migration connects to DB

---
*Phase: 31-room-data-foundation*
*Completed: 2026-03-03*
