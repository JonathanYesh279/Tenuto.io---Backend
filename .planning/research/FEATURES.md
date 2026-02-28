# Feature Landscape: Ensemble Import from Ministry Excel

**Domain:** Ministry of Education Excel import for ensemble/orchestra data in Israeli music conservatories
**Researched:** 2026-02-28
**Overall Confidence:** HIGH (based on direct codebase analysis of existing export sheet, orchestra model, import patterns, and Ministry Excel structure)

---

## What Already Exists (Do Not Rebuild)

Understanding the baseline prevents re-implementing finished work and clarifies exactly what "ensemble import" needs to add.

### Already Built and Working

| Feature | Location | Notes |
|---------|----------|-------|
| Excel upload + multer memoryStorage | `import.route.js` | 10MB limit, .xlsx/.xls filter |
| Preview/execute flow with import_log | `import.service.js` | `previewX() -> executeImport(importLogId)` pattern |
| SheetJS (XLSX) parser for form-style files | `parseConservatoryExcel()` | Fixed cell address parsing, handles formula results |
| ExcelJS parser for tabular files | `parseExcelBufferWithHeaderDetection()` | Multi-row merged header detection, backfill from parent rows |
| Orchestra CRUD | `orchestra.service.js` | Full `addOrchestra()`, `updateOrchestra()`, member mgmt, conductor linking |
| Orchestra validation schema | `orchestra.validation.js` | Joi with `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS`, `conductorId` required |
| Orchestra model fields | `orchestra.validation.js` | `name`, `type`, `subType`, `performanceLevel`, `conductorId`, `memberIds[]`, `rehearsalIds[]`, `schoolYearId`, `location`, `ministryData`, `isActive` |
| Rehearsal CRUD + bulk create | `rehearsal.service.js` | `addRehearsal()`, `bulkCreateRehearsals()` with dayOfWeek/startTime/endTime |
| Ensemble export sheet | `ensembles.sheet.js` | Rows: active marker, conductor name, ensemble name, member count, Activity I (day/start/end/hours), Activity II, totals, coordination hours, performance level columns |
| Ensemble export mapper | `ministry-mappers.js` `mapEnsembleSchedule()` | Maps orchestras + rehearsals to export rows |
| Ensemble subType column mapping | `_shared.js` `ENSEMBLE_TO_COLUMN` | 10 subTypes mapped to columns Q-Y |
| Constants: types/subTypes/levels | `config/constants.js` | `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS` |
| Conductor lookup in export | `ministry-mappers.js` | `teacherMap.get(orch.conductorId)` with `composeName()` |
| Teacher matching by name | `import.service.js` `matchTeacherByName()` | Fuzzy name matching already exists for student import |
| Frontend import page with tabs | `ImportData.tsx` | 3 tabs: teachers/students/conservatory |
| Frontend apiService import methods | `apiService.js` | `previewTeacherImport()`, `previewStudentImport()`, `previewConservatoryImport()`, `executeImport()` |

### What the Export Sheet Reveals About Ministry Format

The export sheet (`ensembles.sheet.js`) is the inverse of what we need to parse. The Ministry Excel ensemble sheet has:

**Sheet name:** `'הרכבי ביצוע'`
**Header rows:** 9-12 (group headers in rows 9-10, sub-headers in row 12)
**Data starts:** Row 13

**Columns (from export builder):**

| Col | Header | Content |
|-----|--------|---------|
| A (1) | X | Active marker |
| B (2) | שם המנצח | Conductor full name |
| C (3) | תזמורת/הרכב | Ensemble name string (e.g., "תז' כלי נשיפה ייצוגית") |
| D (4) | מספר משתתפים | Participant count (number) |
| E-H (5-8) | פעילות I: ביום / משעה / עד שעה / שעות בפועל | Activity I schedule |
| I-L (9-12) | פעילות II: ביום / משעה / עד שעה / שעות בפועל | Activity II schedule |
| M (13) | סך ש"ש | Total weekly hours (formula: H+L) |
| N (14) | שעות ריכוז | Coordination hours |
| O (15) | סה"כ לדיווח | Total reporting hours (formula: M+N) |
| P-R (16-18) | רמת ביצוע: התחלתי / ביניים / ייצוגי | Performance level (X in one column) |
| T (20) | בדיקה | Validation formula |

### Key Insight: Ensemble Name IS the Structured Data

The Ministry Excel does NOT have separate columns for type, subType, and performanceLevel. Instead, the ensemble name string in column C encodes all three:

- `"תז' כלי נשיפה ייצוגית"` = type: תזמורת, subType: כלי נשיפה, level: ייצוגי
- `"הרכב קאמרי קלאסי 1"` = type: הרכב, subType: קאמרי קלאסי, instance: 1
- `"מקהלה ייצוגית"` = type: הרכב, subType: מקהלה, level: ייצוגי
- `"ג'אז/פופ/רוק 3"` = type: הרכב, subType: ג'אז-פופ-רוק, instance: 3

The performance level columns (P-R) provide a secondary source for level classification.

---

## Table Stakes

Features that conservatory administrators expect from ensemble import. Missing = import is not useful for annual ensemble setup.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Parse ensemble rows from Ministry Excel sheet** | The core function -- read row-by-row tabular data from the "הרכבי ביצוע" sheet. Without it, no import. Must handle the specific sheet by name (not first sheet) since the Ministry file is a multi-sheet workbook. | Medium | SheetJS can target sheets by name. Row parsing is well-understood from existing parsers. Key difference from teacher/student import: must locate the correct sheet in a multi-sheet workbook. |
| **Ensemble name string parsing (type/subType/level extraction)** | The ensemble name in column C is a composite string that must be decomposed into the app's structured fields (`type`, `subType`, `performanceLevel`). This is the hardest parsing challenge and the most error-prone. | High | Requires a deterministic parser/mapping table covering all known Ministry naming patterns. See "Name Parsing Rules" section below. |
| **Conductor name matching** | Column B has the conductor's full name. Must resolve to a `teacherId` in the database. Conductors MUST exist before ensemble import (teacher import runs first). | Medium | `matchTeacherByName()` already exists and handles fuzzy name matching. The same function used for student import teacher linking works here. Single-match = assign. Multiple-match = warn. No-match = warn but still allow import (conductor can be assigned manually later). |
| **Schedule data parsing (Activity I + II)** | Columns E-L contain weekly rehearsal day/time data. Must extract `dayOfWeek`, `startTime`, `endTime` for up to 2 weekly rehearsal slots per ensemble. | Medium | Day names are Hebrew (ראשון through שבת) -- need reverse mapping from `VALID_DAYS` to dayOfWeek index (0-6). Time values may be Excel time serial numbers (fractional day values like 0.625 = 15:00) or strings. SheetJS handles time conversion. |
| **Performance level extraction** | Columns P-R use "X" markers in one of three columns (התחלתי / ביניים / ייצוגי). Must read which column has the X. Also extract from name string as secondary source. | Low | Simple column-check logic. Performance level columns P/Q/R (16/17/18) -- check for truthy value. |
| **Participant count capture** | Column D has the number of participants. This is metadata for the Ministry report (NOT a member list). Must store as `ministryData.participantCount` or similar -- NOT as actual memberIds. | Low | Direct numeric read. Important: member count from import is a declared number, not a list of student IDs. The app's `memberIds[]` array is populated separately through the student enrollment UI. |
| **Preview with diff against existing orchestras** | Admin must see what will be created vs. updated before confirming. Must match imported ensembles to existing orchestras by name (primary) or by type+subType combination. | Medium | Matching logic: exact name match first, then fuzzy match (normalized name). Preview must show: matched (with changes highlighted), new (to create), unmatched existing (not in import -- leave alone, DO NOT delete). |
| **Execute: create/update orchestras** | Apply the previewed changes. Create new orchestra documents, update existing ones with schedule/conductor/level changes. | Medium | Uses existing `orchestraService.addOrchestra()` for new, direct collection updates for existing (bypassing validation for bulk efficiency). Must set `tenantId`, `schoolYearId`, and link conductor via `conducting.orchestraIds`. |
| **Ministry data fields** | Store `coordinationHours` (column N) and `totalReportingHours` (column O) in `ministryData` on the orchestra document. These are Ministry-specific reporting fields, not operational data. | Low | Already in orchestra schema: `ministryData: { coordinationHours, totalReportingHours, ministryUseCode }`. Direct write. |
| **Frontend: 4th tab on import page** | Add "הרכבים" tab alongside teachers/students/conservatory on the import page. Must follow the same upload -> preview -> results flow. | Medium | Pattern established by 3 existing tabs. Need new tab icon, state management, and preview/results rendering specific to ensemble data shape. |

---

## Name Parsing Rules (Critical Feature Detail)

The ensemble name string in column C of the Ministry Excel is the primary data source. Parsing it into structured fields is the highest-complexity feature.

### Known Ministry Naming Patterns

Based on the project context provided:

| Ministry Name Pattern | Type | SubType | Level | Instance |
|----------------------|------|---------|-------|----------|
| `תז' כלי נשיפה ייצוגית` | תזמורת | כלי נשיפה | ייצוגי | - |
| `תז' כלי נשיפה עתודה` | תזמורת | כלי נשיפה | ביניים | - |
| `תז' כלי נשיפה צעירה` | תזמורת | כלי נשיפה | התחלתי | - |
| `תז' כלי קשת עתודה` | תזמורת | כלי קשת | ביניים | - |
| `תז' סימפונית ייצוגית` | תזמורת | סימפונית | ייצוגי | - |
| `הרכב קאמרי קלאסי 1` ... `14` | הרכב | קאמרי קלאסי | - | 1-14 |
| `הרכב קולי 1` ... `3` | הרכב | קולי | - | 1-3 |
| `מקהלה ייצוגית` | הרכב | מקהלה | ייצוגי | - |
| `מקהלה צעירה` | הרכב | מקהלה | התחלתי | - |
| `ג'אז/פופ/רוק 1` ... `9` | הרכב | ג'אז-פופ-רוק | - | 1-9 |

### Level Keyword Mapping

Ministry Hebrew keywords to app performance levels:

| Keyword in Name | Maps To |
|----------------|---------|
| `ייצוגית` / `ייצוגי` | ייצוגי |
| `עתודה` | ביניים |
| `צעירה` / `צעיר` | התחלתי |

**Note:** `עתודה` (literally "reserve/cadets") is the Ministry's term for intermediate-level ensembles. This is a domain-specific mapping that must be hardcoded.

### Type Detection Rules

1. Name starts with `תז'` or `תזמורת` => type = `תזמורת`
2. Name starts with `הרכב` => type = `הרכב`
3. Name starts with `מקהלה` => type = `הרכב`, subType = `מקהלה`
4. Name starts with `ג'אז` or `ג'ז` => type = `הרכב`, subType = `ג'אז-פופ-רוק`
5. Fallback: type = `הרכב` (safer default -- most ensembles are הרכב)

### SubType Detection Rules

After stripping type prefix and level suffix:

| Remaining Text | SubType |
|---------------|---------|
| `כלי נשיפה` | כלי נשיפה |
| `סימפונית` | סימפונית |
| `כלי קשת` | כלי קשת |
| `קאמרי קלאסי` | קאמרי קלאסי |
| `קולי` | קולי |
| `מקהלה` | מקהלה |
| `ביג-בנד` / `ביג בנד` | ביג-בנד |
| `ג'אז` / `פופ` / `רוק` | ג'אז-פופ-רוק |
| `עממית` | עממית |

### Implementation Recommendation

Build a `parseEnsembleName(nameString)` function that returns `{ type, subType, performanceLevel, instanceNumber, originalName }`. Use an ordered array of regex/keyword rules, not a flat lookup table, because:

1. Order matters (check `תז'` before falling to default)
2. Level keywords can appear in different positions
3. Instance numbers need stripping before subType matching
4. Ministry files may have slight spelling variations

---

## Differentiators

Features that set the import apart from basic bulk creation. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Rehearsal schedule auto-creation** | When Activity I/II data includes day+time, automatically create weekly rehearsal documents linked to the imported orchestra. Saves admin from manually setting up rehearsal schedules after import. | High | Must interact with `rehearsalService.bulkCreateRehearsals()` which needs `orchestraId`, `startDate`, `endDate`, `dayOfWeek`, `startTime`, `endTime`, `location`, `schoolYearId`. The start/end dates come from the school year, not the Excel. Creates individual rehearsal instances for each week. This is a secondary action after orchestra creation. |
| **Smart matching for existing orchestras** | Beyond exact name match, match by `type + subType + performanceLevel` combination, or by conductor + subType. Handles cases where the admin renamed an orchestra but the Ministry file uses the standard name. | Medium | Useful for re-imports (start of new school year, same ensembles with updated schedules). Without this, every re-import creates duplicates. |
| **Ensemble name normalization** | Normalize imported names to consistent format (`instanceNumber` appended as ` #N`, Hebrew quotation marks standardized, whitespace normalized). Prevents duplicates from slight formatting differences. | Low | String normalization before matching. |
| **Cross-validation with teacher import data** | After import, verify that conductors referenced in ensemble import have `ensembleHours > 0` in their teacher import data. Flag mismatches as warnings. | Low | Read-only check against existing teacher data. Pure validation, no side effects. |
| **Batch import summary with hours reconciliation** | After import, show total ensemble hours vs. total teacher ensemble hours and flag discrepancies. This is the same cross-validation the export does (`runCrossValidation` in `export.service.js`). | Low | Re-use existing cross-validation logic from export service. |
| **Dry-run conductor assignment** | In preview, show which conductors were matched and which are unresolved. Allow admin to manually assign unresolved conductors from a dropdown before executing. | High | Requires frontend dropdown with teacher list per unresolved row. The existing teacher matching returns candidates. Frontend must allow selection. This is a "nice to have" but significantly improves UX for first-time imports where conductor names in Excel may differ from database names. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Auto-assign students to imported orchestras** | Ministry Excel only has participant COUNT (column D), not a student list. Attempting to auto-match students to orchestras would be unreliable and destructive (could remove existing manual assignments). | Store `ministryData.declaredParticipantCount` as metadata. Student-orchestra membership is managed through the existing enrollment UI, not import. |
| **Delete orchestras not in import file** | Absence from the import file does NOT mean the orchestra should be removed. Conservatories may have ensembles not reported to the Ministry. Deletion is a destructive action that should never be automated. | Import only creates or updates. Existing orchestras not in the import are left untouched. |
| **Import from multiple sheets simultaneously** | The Ministry workbook has many sheets, but each should be imported independently (teacher sheet, student sheet, ensemble sheet, conservatory profile). Combining them in one action creates a confusing preview and unclear error attribution. | Keep separate import tabs. The user imports ensembles from the ensemble sheet only. |
| **Automatic rehearsal attendance import** | Even if the Ministry file had attendance data (it does not), automatically overwriting attendance records would destroy manually-tracked data. | Rehearsal attendance is managed through the existing attendance UI. |
| **Override existing orchestra members on import** | The import has no student list, only a count. Overwriting `memberIds[]` would destroy all existing enrollment data. | Preserve `memberIds[]` on existing orchestras during import update. Only update metadata fields (schedule, conductor, level, coordination hours). |
| **Parse ensemble data from the student sheet** | The student sheet has ensemble columns (Q-Y) showing which students belong to which ensemble. Trying to reverse-engineer orchestra membership from this would be fragile and duplicative. | Ensemble-to-student membership comes from the orchestra management UI, not import. |

---

## Feature Dependencies

```
Parse ensemble sheet from multi-sheet workbook
  |
  v
Ensemble name parser (type/subType/level extraction)
  |
  v
Conductor name matching (uses existing matchTeacherByName)
  |
  v
Schedule data parsing (Activity I + II)
  |
  v
Preview with diff against existing orchestras
  |                                  |
  v                                  v
Execute: create/update          Frontend: 4th tab
  |
  v
[Optional] Rehearsal schedule auto-creation
```

**Critical path:** Parse sheet -> Parse names -> Match conductors -> Preview -> Execute

**Independent of critical path:**
- Frontend tab can be built in parallel with backend parsing
- Performance level extraction is a sub-task of name parsing
- Ministry data fields are a sub-task of execute

---

## MVP Recommendation

### Phase 1: Core Parsing + Preview (Must Have)

1. **Sheet selection** -- locate "הרכבי ביצוע" sheet in the multi-sheet workbook using SheetJS
2. **Row parsing** -- extract columns A-R, T from data rows (starting row 13, skip header rows 9-12)
3. **Name parser** -- `parseEnsembleName()` decomposing Ministry strings into type/subType/performanceLevel
4. **Conductor matching** -- reuse `matchTeacherByName()` for column B
5. **Schedule extraction** -- parse Activity I + II day/time values
6. **Performance level** -- read X markers from columns P-R (secondary to name parsing)
7. **Coordination hours** -- read column N
8. **Preview** -- match against existing orchestras, show create/update/unchanged counts
9. **Import log** -- save to `import_log` with `importType: 'ensembles'`

### Phase 2: Execute + Frontend

1. **Execute** -- create new orchestras, update existing ones (schedule, conductor, level, ministry data)
2. **Conductor linking** -- update teacher's `conducting.orchestraIds` for new assignments
3. **Frontend tab** -- 4th "הרכבים" tab on import page with upload/preview/results flow
4. **Constants update** -- add `'ensembles'` to `IMPORT_TYPES` in `config/constants.js`

### Defer

- **Rehearsal auto-creation**: Complex interaction with school year dates and bulk rehearsal creation. Better as a separate follow-up after core import is proven stable. Creates many documents (one per week per ensemble) with significant rollback complexity.
- **Manual conductor assignment in preview**: Requires significant frontend work (dropdowns per row) for an edge case. Admin can edit conductor in the orchestra management UI after import.
- **Cross-validation with teacher hours**: Read-only check that adds informational value but does not affect the core import flow.

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `api/export/sheets/ensembles.sheet.js` -- Ministry Excel ensemble sheet structure (columns, headers, data start row)
  - `api/export/ministry-mappers.js` `mapEnsembleSchedule()` -- how ensemble data maps to/from the sheet
  - `api/export/sheets/_shared.js` -- `ENSEMBLE_TO_COLUMN` mapping, `SHEET_NAMES`
  - `api/orchestra/orchestra.validation.js` -- orchestra schema with all valid types/subTypes/levels
  - `api/orchestra/orchestra.service.js` -- `addOrchestra()`, `updateOrchestra()` with conductor linking
  - `api/rehearsal/rehearsal.validation.js` -- rehearsal schema with dayOfWeek/startTime/endTime
  - `api/import/import.service.js` -- existing import patterns (preview/execute flow, teacher matching)
  - `config/constants.js` -- `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS`
  - Project context (ensemble name patterns from actual Ministry files)
