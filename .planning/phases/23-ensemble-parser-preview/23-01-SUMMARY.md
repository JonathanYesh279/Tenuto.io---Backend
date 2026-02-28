---
phase: 23-ensemble-parser-preview
plan: 01
subsystem: api
tags: [exceljs, excel-parsing, hebrew, ensemble, import]

# Dependency graph
requires: []
provides:
  - "parseEnsembleSheet() - parses Ministry ensemble Excel sheet into structured rows"
  - "decomposeEnsembleName() - decomposes Hebrew ensemble names into type/subType"
  - "excelTimeToHHMM() - converts Excel time serials to HH:MM strings"
  - "detectPerformanceLevel() - detects level from cell background color"
  - "hebrewDayToNumber() + HEBREW_DAY_MAP - Hebrew day name to number conversion"
  - "parseAnalyticsMiniTable() - extracts analytics section from sheet bottom"
  - "IMPORT_TYPES includes 'ensembles'"
affects: [23-02-PLAN, 24-ensemble-execute, 25-ensemble-routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [fixed-position-column-parsing, analytics-boundary-detection, hebrew-name-decomposition]

key-files:
  created: []
  modified:
    - api/import/import.service.js
    - config/constants.js

key-decisions:
  - "Fixed-position column parsing for Activity I/II (duplicate header names)"
  - "SUBTYPE_KEYWORDS ordered longest-first to prevent partial matches"
  - "Analytics boundary detected by keyword match + two consecutive empty rows"
  - "Performance level detection via isColoredCell() on three boolean columns"

patterns-established:
  - "Ensemble name decomposition: prefix detection + keyword matching + participant count fallback"
  - "Multi-row merged header scanning: check parent rows above header for column labels"
  - "Activity column disambiguation: find first/second 'ביום' occurrence, then offset +1/+2/+3 for sub-columns"

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 23 Plan 01: Ensemble Parser Summary

**Excel ensemble sheet parser with fixed-position column mapping, Hebrew name decomposition, and cell-color performance level detection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T07:23:54Z
- **Completed:** 2026-02-28T07:28:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Six ensemble helper functions added: excelTimeToHHMM, HEBREW_DAY_MAP, hebrewDayToNumber, SUBTYPE_KEYWORDS, decomposeEnsembleName, detectPerformanceLevel
- Full parseEnsembleSheet() parser with fixed-position column mapping handling duplicate Activity I/II headers
- Analytics mini-table parser that extracts ensemble type breakdown from the bottom of the sheet
- IMPORT_TYPES updated to include 'ensembles' for the import dispatcher

## Task Commits

Each task was committed atomically:

1. **Task 1: Ensemble helper functions and constants** - `cfbac38` (feat)
2. **Task 2: Ensemble sheet parser with fixed-position column parsing and analytics extraction** - `cdc4aba` (feat)

## Files Created/Modified
- `api/import/import.service.js` - Added 6 helper functions, parseEnsembleSheet(), parseAnalyticsMiniTable(), ENSEMBLE_SHEET_NAME constant; exported parseEnsembleSheet via importService
- `config/constants.js` - Added 'ensembles' to IMPORT_TYPES array

## Decisions Made
- Used fixed-position column mapping (find nth occurrence of 'ביום') instead of header-name lookup to handle duplicate Activity I/II sub-column names
- Ordered SUBTYPE_KEYWORDS with longer/more-specific keywords first ('קאמרי קלאסי' before 'קאמרי') to prevent partial matches
- Analytics boundary detection uses both keyword matching ('סיכום', 'סך גופי', etc.) and two consecutive empty conductor+name rows
- Performance level detection checks cell background color via existing isColoredCell() function, not text values
- Scan parent rows above header (up to 3 rows) for performance level column labels in multi-row merged headers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- parseEnsembleSheet() is ready for Plan 02 (preview endpoint) to consume
- The parser returns structured { parsedRows, analytics, warnings } that Plan 02 will use for conductor matching, orchestra matching, and preview response building
- All helper functions are available internally for reuse by the preview/execute flows

## Self-Check: PASSED

All files exist, all commits verified (cfbac38, cdc4aba).

---
*Phase: 23-ensemble-parser-preview*
*Completed: 2026-02-28*
