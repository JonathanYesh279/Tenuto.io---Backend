# Technology Stack -- Ensemble Import from Ministry Excel

**Project:** Tenuto.io v1.4 -- Ensemble Import
**Researched:** 2026-02-28
**Scope:** Stack ADDITIONS and CHANGES ONLY for ensemble/orchestra import from Ministry Excel

---

## Key Finding: No New Dependencies Required

The existing stack handles every requirement for ensemble import. This is a feature addition, not a technology addition. The project already has SheetJS for cell-addressed Excel parsing, Joi for validation, MongoDB native driver for upserts, and the full import preview/execute infrastructure.

---

## What Is Already In Place (Do Not Re-Evaluate)

| Technology | Version | Status |
|------------|---------|--------|
| Node.js + Express | existing | LOCKED |
| MongoDB native driver | ^6.13.0 | LOCKED |
| SheetJS (`xlsx`) | ^0.18.5 | LOCKED -- already used for conservatory import |
| ExcelJS | ^4.4.0 | LOCKED -- used for teacher/student import (NOT needed here) |
| multer (memoryStorage) | ^1.4.5-lts.1 | LOCKED -- handles file upload |
| Joi | ^17.13.3 | LOCKED -- orchestra validation schema exists |
| React 18 + TypeScript + Vite + Tailwind | existing | LOCKED |
| @phosphor-icons/react | existing | LOCKED |
| react-hot-toast | existing | LOCKED |
| Vitest + MongoDB Memory Server | existing | LOCKED |

---

## Stack Decisions for Ensemble Import

### 1. Excel Parsing Library: SheetJS (Already Installed)

**Decision: Use SheetJS (`xlsx` ^0.18.5) for ensemble import. Do NOT use ExcelJS.**

Rationale:
1. The ensemble sheet has a **fixed structure** (headers rows 9-12, data rows 13-45) with known cell addresses -- this is the exact pattern where SheetJS excels (direct cell access via `ws['B13']`).
2. SheetJS correctly reads **cached formula results** as raw values (`.v` property), critical for time columns containing `HOUR(G-F)+MINUTE(G-F)/60` formulas.
3. SheetJS handles **merged cells** natively via `ws['!merges']` array -- merged group headers (E9:H10 = "Activity I", I9:L10 = "Activity II", P9:R10 = "Performance Level") store values in the top-left cell.
4. The conservatory import already established the SheetJS pattern (`parseConservatoryExcel` at import.service.js:1909), so the ensemble parser follows the same approach.
5. ExcelJS is needed only when **row iteration with style/color detection** is required (teacher/student imports use `isColoredCell`). Ensemble import reads values from known positions -- no style detection needed.

**Confidence: HIGH** -- Verified via existing `parseConservatoryExcel` function using identical cell-access pattern. Verified via SheetJS docs that merged cells store value in top-left cell (https://docs.sheetjs.com/docs/csf/features/merges/).

### 2. Time Value Conversion: Plain Arithmetic (No Library)

**Decision: Implement 5-line utility function in-house.**

Excel stores time as day fractions (0.7083 = 17:00). The conversion is trivial:

```javascript
function excelTimeToHHMM(serial) {
  if (serial == null || typeof serial !== 'number') return null;
  const totalMinutes = Math.round(serial * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
// 0.7083 -> 1020 minutes -> 17:00
// 0.7917 -> 1140 minutes -> 19:00
```

Why no library:
- **dayjs** (already installed): Cannot convert Excel serial numbers -- it has no concept of Excel date serials. Only parses time strings like "17:00".
- **SheetJS `XLSX.SSF.parse_date_code()`**: Could work but is underdocumented for time-only values and returns a complex object `{D, T, y, m, d, H, M, S, q, u}`. Plain arithmetic is simpler.
- The output format `"HH:MM"` matches exactly what the rehearsal schema expects (pattern: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/` in rehearsal.validation.js:24).

**Confidence: HIGH** -- Verified via SheetJS docs: "the fractional part of the date code serves as the time marker. Excel assumes each day has exactly 86400 seconds." (https://docs.sheetjs.com/docs/csf/features/dates/)

### 3. Conductor Name Matching: Exact Match Against Teacher DB (No Library)

**Decision: Use exact firstName+lastName matching against existing teachers. No fuzzy matching library.**

The parsing flow:
1. Parse conductor name string from cell B (column 2) of each data row.
2. Split on first space: `"יוסי כהן"` -> firstName: `"יוסי"`, lastName: `"כהן"`.
3. Query teacher collection with case-insensitive exact match on `personalInfo.firstName` + `personalInfo.lastName` within the tenant.
4. Return matched teacher `_id` or mark as `not_found` in preview.

Why no fuzzy matching:
- Ministry Excel files contain the **same teacher names** that the conservatory entered -- these are their own staff.
- Hebrew name fuzzy matching has high false-positive risk with short, common names (e.g., "דן" vs "דני").
- The teacher pool is small (20-80 per tenant) -- manual resolution in preview UI is fast.
- Existing teacher import uses exact matching (priority 3 in `matchTeacher` at import.service.js:7).

**Confidence: HIGH** -- Codebase analysis confirms exact name matching is established pattern.

### 4. Orchestra Validation: Existing Joi Schema (No Changes)

**Decision: Reuse `orchestraSchema` from `orchestra.validation.js` for validation during execute phase.**

The existing schema already validates:
- `name` (required string)
- `type` (enum: 'הרכב' | 'תזמורת')
- `subType` (enum: 9 values including 'כלי נשיפה', 'סימפונית', etc.)
- `performanceLevel` (enum: 'התחלתי' | 'ביניים' | 'ייצוגי')
- `conductorId` (required string)
- `memberIds` (array of strings, default [])
- `ministryData.coordinationHours` (number, 0-50)
- `ministryData.totalReportingHours` (number, 0-100)

The only field NOT in the import is `location` (defaults to 'חדר 1') and `schoolYearId` (auto-populated from current school year, same as `addOrchestra`).

**Confidence: HIGH** -- Direct code analysis of orchestra.validation.js.

### 5. Hebrew Day Name Resolution: Constant Map (No Library)

**Decision: Add reverse day-name map to constants or inline in parser.**

The ensemble sheet has Hebrew day names ("ראשון", "שני", etc.) in the Activity I/II day columns. The rehearsal schema requires `dayOfWeek` as integer (0-6). The export mapper already has this array at ministry-mappers.js:269:

```javascript
const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
```

The import parser needs the reverse:
```javascript
const DAY_NAME_TO_NUMBER = {
  'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6
};
```

**Confidence: HIGH** -- Direct correspondence with existing export code.

---

## What NOT to Add

| Rejected Library | Why Tempting | Why NOT to Add |
|-----------------|-------------|----------------|
| `xlsx-populate` | Better merged cell API | SheetJS already handles merges via `ws['!merges']`; adding a second xlsx lib is wasteful |
| `fuse.js` / `fast-fuzzy` | Fuzzy conductor matching | Small teacher pool + Hebrew names = high false-positive risk; exact match sufficient |
| `date-fns` / `moment` | Time parsing | 5 lines of arithmetic; no library warranted |
| `lodash` | Utility functions | Not used anywhere in codebase; not needed |
| `bull` / `bullmq` | Job queue for import | Ensembles are max 33 rows; synchronous processing completes in milliseconds |
| New validation library | Schema for parsed rows | Joi already installed and orchestra schema exists |

---

## Integration Points

### Backend Files to Modify

| File | Change | Rationale |
|------|--------|-----------|
| `api/import/import.service.js` | Add `parseEnsembleExcel(buffer)`, `previewEnsembleImport(buffer, options)`, `executeEnsembleImport(log, ...)` | Core parsing logic following conservatory import pattern |
| `api/import/import.service.js` (line ~2069) | Add `else if (log.importType === 'ensembles')` branch in `executeImport()` | Extend import type routing |
| `api/import/import.service.js` (exports, line ~31) | Add `previewEnsembleImport` to `importService` exports | Expose new function |
| `api/import/import.controller.js` | Add `previewEnsembleImport` handler function | Route handler following existing pattern |
| `api/import/import.route.js` | Add `POST /ensembles/preview` route with `requireAuth(['מנהל'])` | New endpoint, same multer + auth |

### Backend Files to Reuse (No Modification Needed)

| File | What to Reuse |
|------|---------------|
| `api/orchestra/orchestra.service.js` | `addOrchestra()`, `updateOrchestra()`, `getOrchestras()` for matching/creating |
| `api/orchestra/orchestra.validation.js` | `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS`, `validateOrchestra()` |
| `api/rehearsal/rehearsal.service.js` | `bulkCreateRehearsals()` for creating rehearsal records from parsed time slots |
| `api/export/sheets/_shared.js` | `composeName()` for conductor name formatting during comparison |
| `config/constants.js` | `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS` |

### Frontend Files to Modify

| File | Change | Rationale |
|------|--------|-----------|
| `src/pages/ImportData.tsx` | Add `'ensembles'` to `ImportTab` union type; add 4th tab button; add ensemble preview/results UI sections | New import tab, consistent with existing tab pattern |
| `src/services/apiService.js` | Add `previewEnsembleImport(file)` method to `importService` object | API call for new endpoint |

### Frontend Files to Reuse (No Modification Needed)

| File | What to Reuse |
|------|---------------|
| `src/components/feedback/ProgressIndicators.tsx` | `StepProgress` for upload/preview/results flow |

---

## Column-to-Cell Mapping (Ministry Excel Structure)

Based on analysis of the export sheet builder at `api/export/sheets/ensembles.sheet.js`, the Ministry Excel has this fixed structure:

| Col# | Letter | Content | Cell Value Type |
|------|--------|---------|-----------------|
| 1 | A | Active marker | String ("X" or empty) |
| 2 | B | Conductor name | String (Hebrew full name) |
| 3 | C | Ensemble/orchestra name | String |
| 4 | D | Participant count | Number |
| 5 | E | Activity I - Day | String (Hebrew day name) |
| 6 | F | Activity I - Start time | Excel time serial (e.g., 0.7083 = 17:00) |
| 7 | G | Activity I - End time | Excel time serial |
| 8 | H | Activity I - Hours | Number (formula cached result) |
| 9 | I | Activity II - Day | String (Hebrew day name) |
| 10 | J | Activity II - Start time | Excel time serial |
| 11 | K | Activity II - End time | Excel time serial |
| 12 | L | Activity II - Hours | Number (formula cached result) |
| 13 | M | Total hours | Number (formula cached result) |
| 14 | N | Coordination hours | Number |
| 15 | O | Total reporting hours | Number (formula cached result) |
| 16 | P | Performance: beginner (התחלתי) | String ("X" or empty) |
| 17 | Q | Performance: intermediate (ביניים) | String ("X" or empty) |
| 18 | R | Performance: representative (ייצוגי) | String ("X" or empty) |

**Data rows:** 13-45 (33 ensemble slots), starting after header rows 9-12.

**Confidence: HIGH** -- Directly verified from export sheet builder code (ensembles.sheet.js lines 56-76 for headers, lines 90-168 for data).

---

## Parsing Strategy Comparison

| Aspect | Teacher/Student (ExcelJS) | Conservatory (SheetJS) | Ensemble (SheetJS) |
|--------|--------------------------|----------------------|-------------------|
| Structure | Variable tabular rows | Fixed cell addresses | Fixed cell grid |
| Header detection | Dynamic scan first 10 rows | Not needed (known cells) | Not needed (rows 9-12 are fixed) |
| Data start | After detected header | N/A (form layout) | Always row 13 |
| Cell access | Row iteration + column map | Direct `ws['E5']` | Direct `ws['B13']` through `ws['R45']` |
| Style needed? | Yes (colored cells) | No | No (X markers, not colors) |
| Library | ExcelJS | SheetJS | **SheetJS** (same pattern as conservatory) |

---

## Installation

```bash
# No new packages required.
# All dependencies already in package.json.
```

---

## Version Verification

| Package | Current Version | Upgrade Needed? |
|---------|----------------|-----------------|
| xlsx (SheetJS) | ^0.18.5 | No -- cell access, merged cells, formula results all supported |
| joi | ^17.13.3 | No -- orchestra schema exists |
| mongodb | ^6.13.0 | No -- standard CRUD operations |
| multer | ^1.4.5-lts.1 | No -- same upload config |
| express | ^4.21.2 | No -- standard routing |

**Confidence: HIGH** -- All versions verified from `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/package.json`.

---

## Summary: Zero New Dependencies

This milestone requires **zero new npm packages** on either backend or frontend. Every capability needed -- Excel parsing with cell addressing, merged cell handling, time serial conversion, conductor name matching, orchestra validation, UI tabs -- is already present in the installed stack. The work is purely logic implementation within existing files, following the conservatory import pattern for parsing and the teacher/student import pattern for preview/execute flow.

---

## Sources

- SheetJS merged cells: https://docs.sheetjs.com/docs/csf/features/merges/
- SheetJS dates/times: https://docs.sheetjs.com/docs/csf/features/dates/
- SheetJS cell objects: https://docs.sheetjs.com/docs/csf/cell/
- SheetJS sheet objects: https://docs.sheetjs.com/docs/csf/sheet/
- Existing codebase: `api/import/import.service.js` (parseConservatoryExcel at line 1909)
- Existing codebase: `api/export/sheets/ensembles.sheet.js` (column structure, lines 56-168)
- Existing codebase: `api/orchestra/orchestra.validation.js` (orchestra schema)
- Existing codebase: `api/rehearsal/rehearsal.validation.js` (time format HH:MM, dayOfWeek 0-6)
- Existing codebase: `api/export/ministry-mappers.js` (mapEnsembleSchedule at line 266, day name array)
- Existing codebase: `package.json` (all dependency versions)
