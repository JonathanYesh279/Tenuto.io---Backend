---
phase: 09-fix-import-teacher-missing-column-mapping-instruments-hours-degrees-certificates-management
plan: 01
subsystem: api
tags: [excel-import, column-mapping, ministry-files, header-detection, instruments, hours]

# Dependency graph
requires:
  - phase: 08-fix-import-teacher-bugs-wrong-labels-missing-enums-failed-creation
    provides: "Expanded TEACHER_DEGREES, MANAGEMENT_ROLES enums and teacherImportSchema"
  - phase: 07-fix-import-teacher-feature-null-properties-after-import
    provides: "normalizeTeacherMapped, buildImportTeacherDocument, Joi validation for imports"
provides:
  - "Dynamic instrument column detection (no hardcoded threshold)"
  - "Parent-row instrument abbreviation backfill for multi-row merged headers"
  - "Sub-header refinement guard preventing overwrite of valid parent headers"
  - "Boolean column disambiguation using parent-row context"
  - "10 new column header variants (management role, hours, certificate)"
  - "headerMappingReport diagnostic in preview response"
affects: [import-teacher, ministry-excel, frontend-import-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic section detection for instrument columns instead of hardcoded index threshold"
    - "Parent-row context disambiguation for generic sub-header labels"
    - "headerMappingReport diagnostic pattern for column mapping visibility"

key-files:
  created: []
  modified:
    - "api/import/import.service.js"

key-decisions:
  - "Dynamic instrumentSectionStart replaces hardcoded colIndex < 24 threshold"
  - "KNOWN_NON_INSTRUMENT_HEADERS set prevents hours columns from being treated as instruments"
  - "Sub-header refinement only replaces headers when current header is NOT already mapped"
  - "Parent-row context resolves generic boolean labels to specific fields"
  - "parsedHeaders from parseExcelBufferWithHeaderDetection used instead of Object.keys(rows[0])"

patterns-established:
  - "headerMappingReport: diagnostic object in preview response for debugging unmapped columns"
  - "KNOWN_NON_INSTRUMENT_HEADERS: exclusion set pattern for disambiguating shared header names"

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 9 Plan 01: Fix Import Teacher Column Mapping Summary

**Dynamic instrument detection, sub-header guard, boolean disambiguation, 10 new header variants, and headerMappingReport diagnostic for Ministry Excel teacher imports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T12:30:39Z
- **Completed:** 2026-02-23T12:35:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced hardcoded column index threshold (colIndex < 24) with dynamic instrument section detection that adapts to any Ministry file layout
- Added parent-row instrument abbreviation backfill so instruments in merged header rows are detected
- Added sub-header refinement guard preventing correct headers (classification, degree) from being overwritten
- Added parent-row context disambiguation for generic boolean labels (teaching certificate vs union membership)
- Added 10 new column header variants (3 management role, 6 hours, 1 certificate) to TEACHER_COLUMN_MAP
- Added headerMappingReport diagnostic to preview response for debugging unmapped columns
- Added roleColumnsDetected to preview response

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix core column detection logic** - `67d390c` (fix)
2. **Task 2: Add column mapping variants and diagnostic headerMappingReport** - `15cf6c4` (feat)

## Files Created/Modified
- `api/import/import.service.js` - Fixed instrument detection (dynamic threshold), sub-header guard, boolean disambiguation, added 10 header variants, added headerMappingReport diagnostic, exposed parsed headers from parseExcelBufferWithHeaderDetection

## Decisions Made
- Dynamic `instrumentSectionStart` detection: scans ALL headers to find the earliest instrument/department column, then accepts columns from that point onward. This adapts to any file layout instead of assuming instruments start at column 24.
- `KNOWN_NON_INSTRUMENT_HEADERS` set: prevents hours column headers that share names with instruments (e.g., "ליווי פסנתר") from being treated as instrument columns.
- Sub-header guard (`!columnMap[headers[c]]`): only replaces a header with a sub-header value if the current header does NOT already map to a valid field. This preserves correct parent headers like "סיווג" and "תואר".
- Parent-row disambiguation for "כן-לא": checks parent rows for context words ("תעודת הוראה"/"תעודה" vs "ארגון"/"חבר") to determine which boolean field the column represents. The generic fallback `'כן-לא': 'teachingCertificate'` is preserved for files without multi-row headers.
- Used `parsedHeaders` from `parseExcelBufferWithHeaderDetection` return value instead of `Object.keys(rows[0])` for instrument/role detection in preview, ensuring all detected headers (including parent-row backfilled instruments) are available.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All seven identified column mapping bugs are fixed
- headerMappingReport provides visibility into which columns are detected/unmapped for future debugging
- No new dependencies added; all changes are within existing import.service.js
- Frontend may want to display headerMappingReport and roleColumnsDetected in the import preview UI

---
*Phase: 09-fix-import-teacher-missing-column-mapping-instruments-hours-degrees-certificates-management*
*Completed: 2026-02-23*
