# Project Research Summary

**Project:** Tenuto.io v1.4 — Ensemble Import from Ministry Excel
**Domain:** Excel-based bulk import for multi-tenant Israeli music conservatory SaaS
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

This milestone adds a 4th import type (ensembles/orchestras) to an existing preview-then-execute import system that already handles teachers, students, and conservatory profile data. The work is a feature addition with zero new dependencies — SheetJS, Joi, MongoDB native driver, and all frontend libraries are already installed and already used in adjacent import code. The correct implementation approach is to add three functions to `import.service.js` (column map, preview, execute), one handler to `import.controller.js`, one route to `import.route.js`, and a 4th tab to the frontend `ImportData.tsx`. The pattern is established; the substance is net-new.

The hardest part of this milestone is not the infrastructure — it is the domain logic. Ministry of Education Excel files encode ensemble type, subType, and performance level as composite Hebrew name strings (e.g., `"תז' כלי נשיפה ייצוגית"`) that must be decomposed into the system's structured enum fields. This name decomposition is the critical path: wrong output here causes Joi validation failures, silent orchestra skips, and cross-validation failures in the existing export system. An explicit ordered regex/keyword rule set must be built and unit-tested against every known Ministry naming pattern before any execute logic is written.

The second major risk is orchestral reference integrity during bulk creation. The existing `addOrchestra()` function performs orchestra insert and teacher `conducting.orchestraIds` push as two separate non-atomic writes — acceptable for single-UI creation but dangerous in a loop of 15+ orchestras. A dedicated bulk-import execute path must collect all orchestra IDs then execute a single `bulkWrite` for teacher updates rather than calling `addOrchestra()` per row. With these two concerns addressed, the remaining work follows well-established codebase patterns with no novel architecture required.

---

## Key Findings

### Recommended Stack

No new npm packages are needed on either the backend or frontend. Every required capability is already installed. SheetJS (`xlsx` ^0.18.5) handles the ensemble sheet parsing — the same library already used for conservatory import — using direct cell-address access (`ws['B13']`) for the fixed-structure Ministry Excel. Excel time serial numbers (fractional day values like 0.7083 = 17:00) are converted with a 5-line arithmetic utility; no date library is warranted. Conductor name matching reuses the existing `matchTeacherByName()` function. Orchestra validation reuses the existing Joi `orchestraSchema` with one minor optional field addition.

**Core technologies:**
- **SheetJS (`xlsx` ^0.18.5)**: Excel parsing — direct cell-address access for the fixed Ministry structure; handles merged headers and formula cached results (`.v` property)
- **MongoDB native driver (`bulkWrite`)**: Atomic teacher reference updates during execute; never call `addOrchestra()` in a loop
- **Joi (`orchestra.validation.js`)**: Reused schema validation during execute; minor addition of optional `scheduleSlots` array field
- **`matchTeacherByName()` (existing function in `import.service.js`)**: Conductor resolution — handles bidirectional Hebrew name ordering, ambiguity detection
- **React 18 + Tailwind (existing)**: 4th import tab following the same pattern as the first 3 tabs

**What NOT to add:**
- No `xlsx-populate`, `fuse.js`, `date-fns`, `lodash`, `bull`, or any second xlsx library
- No separate `ensemble-import.service.js` file — add to existing `import.service.js`
- No separate validation library — Joi already handles orchestra schema

See `.planning/research/STACK.md` for full version table, rejected-library rationale, and complete column-to-cell mapping.

### Expected Features

**Must have (table stakes):**
- Parse ensemble rows from the "הרכבי ביצוע" sheet in a multi-sheet Ministry workbook (target by sheet name, not first sheet)
- Decompose composite ensemble name strings into `type`, `subType`, `performanceLevel` — the highest-complexity feature
- Match conductor name (column B: "שם המנצח") to a `teacherId` via `matchTeacherByName()`
- Parse Activity I and Activity II schedule data: Hebrew day name → `dayOfWeek` 0-6, Excel time serial → "HH:MM"
- Extract performance level from "X" marker columns P/Q/R ("התחלתי" / "ביניים" / "ייצוגי") as secondary source
- Store `coordinationHours` (col N) and `totalReportingHours` (col O) in `orchestra.ministryData`
- Preview with diff: matched orchestras (changes highlighted), new orchestras, conductor match status summary
- Execute: create new orchestras, update existing ones (schedule, conductor, level, ministry data only — preserve `memberIds[]`)
- Frontend 4th tab ("הרכבים") with upload → preview → results flow

**Should have (differentiators):**
- Composite key matching for re-import deduplication (name + conductorId + schoolYearId) to prevent duplicate orchestras
- Preview shows conductor match summary: `{ resolved: N, ambiguous: N, unresolved: N }`
- Flag unrecognized ensemble names in preview with `unmappedEnsembles[]` rather than silently skipping
- Store `ministryData.importedParticipantCount` on new orchestras only (for Ministry-vs-system comparison in preview)

**Defer (v2+):**
- Rehearsal auto-creation: complex school year date range interaction, generates 840+ documents, rollback complexity — store `scheduleSlots[]` on orchestra instead
- Manual conductor assignment dropdown in preview UI: edge case, admin can fix in orchestra UI post-import
- Cross-validation against teacher import hours: read-only informational check, not blocking

**Explicit anti-features (never build):**
- Auto-assign students from participant count — Excel has count, not list
- Delete orchestras absent from import file — absence is not deletion
- Override existing `memberIds[]` during update — preserve all member links
- Import from multiple sheets simultaneously — each sheet is a separate import action

See `.planning/research/FEATURES.md` for full feature dependency graph, name parsing rules table, and complete MVP recommendation.

### Architecture Approach

The ensemble import extends the existing monolithic `import.service.js` (~2200 lines) with new functions following the established single-file pattern. All three existing import types live in this file; a separate `ensemble-import.service.js` would fragment shared parsing infrastructure and break the pattern. The `executeImport()` dispatcher needs only a new `else if (log.importType === 'ensembles')` branch. The key non-obvious architectural decision is to use **purpose-built cell-address parsing** (not generic header detection) because the ensemble sheet's duplicate Activity I/II column headers ("ביום", "משעה", "עד שעה" appear twice each) would confuse header-based approaches. Fixed column positions A-R are stable across Ministry templates.

**Major components:**

1. **`parseEnsembleExcel(buffer)`** — SheetJS-based row extractor targeting "הרכבי ביצוע" sheet by name; reads rows 13-45 at fixed column positions; validates rows by content pattern (ensemble name present, no "סה"כ" total rows)
2. **`parseEnsembleName(nameString)`** — ordered regex rule array decomposing composite Hebrew names into `{ type, subType, performanceLevel, instanceNumber, originalName }`; the critical-path domain logic function; handles abbreviations (`"תז'"` = `"תזמורת"`), feminine forms (`"ייצוגית"` = `"ייצוגי"`), and Ministry-specific terms (`"עתודה"` = `"ביניים"`)
3. **`matchOrchestra(parsed, existingOrchestras)`** — composite key matching (normalized name + conductorId + schoolYearId) enabling idempotent re-imports
4. **`previewEnsembleImport(buffer, { context })`** — orchestrates parsing, name decomposition, conductor matching, orchestra matching; saves full `parsedData` to `import_log` with `importType: 'ensembles'`; returns structured preview response
5. **`executeEnsembleImport(log, db, context)`** — bulk-safe path: `insertMany` new orchestras → collect `insertedIds` → single `bulkWrite` for all teacher `conducting.orchestraIds` updates; `updateMany` for existing orchestras
6. **Frontend 4th tab** — tabular preview rendering (conductor match status, type/subType/schedule columns) in `ImportData.tsx` following exact teacher/student pattern

**Data flow:**
```
Excel Upload → multer buffer → previewEnsembleImport()
  → parseEnsembleExcel()       → rows[]
  → parseEnsembleName()        → { type, subType, performanceLevel }
  → matchOrchestra()           → matched[] + notFound[]
  → matchTeacherByName()       → conductorId | unresolved
  → save import_log { importType: 'ensembles', status: 'pending', parsedData }
  → return { importLogId, preview }

Execute → POST /import/execute/:importLogId
  → executeEnsembleImport()
  → insertMany new orchestras  → collect insertedIds
  → bulkWrite teacher refs     → $addToSet conducting.orchestraIds
  → updateMany existing        → schedule, conductor, level, ministryData only
  → update import_log          → status: 'completed'
```

**Schema changes (minimal):**
- `orchestra.validation.js`: add optional `scheduleSlots` array (weekly template storage)
- `orchestra.validation.js`: add `ministryData.importedParticipantCount` (integer, nullable)

See `.planning/research/ARCHITECTURE.md` for full file change table with LOC estimates, preview response data structure, and anti-pattern documentation.

### Critical Pitfalls

1. **Bidirectional reference desync during bulk import** — `addOrchestra()` does two non-atomic writes; a failed teacher push leaves orphaned conductor references and breaks `hours-summary.service.js` calculations. Prevention: dedicated bulk execute function with `insertMany` then `bulkWrite`, using `$addToSet` for idempotent teacher updates. Never call `addOrchestra()` in a loop. This is Phase 2's most important constraint.

2. **No orchestra deduplication strategy** — orchestras have no email or ID number; re-importing the same file creates duplicate orchestras that double-count conducted hours in the export. Prevention: `matchOrchestra()` using composite key `(normalizedName + conductorId + schoolYearId + tenantId)`. Preview must show matched-vs-new counts before any execute.

3. **Ensemble name decomposition errors** — Ministry names encode type/subType/level as composite Hebrew strings with abbreviations and feminine forms. Wrong decomposition causes Joi validation failures (subType not in enum) or silent column mismatches in the `ENSEMBLE_TO_COLUMN` export mapper. Prevention: ordered regex/keyword rule array, exhaustive unit tests for all known patterns, preview surfaces unrecognized names in `unmappedEnsembles[]` rather than silently skipping.

4. **`conductorId` required constraint blocking import** — `orchestra.validation.js` requires `conductorId` as a hard required string. Unresolved conductors would silently fail Joi validation and drop entire orchestras. Prevention: preview explicitly shows 4 conductor states (resolved / ambiguous / unresolved / none); execute must handle unresolved via a dedicated path (skip with `partialResults.skipped[]` entry, or bypass Joi for import writes).

5. **Excel time fraction misinterpretation** — time columns contain fractional day values (0.7083 = 17:00), not strings. Raw `.v` value gives "0.7083333", which fails the HH:MM regex. Prevention: `excelTimeToHHMM()` converter handling both string and numeric inputs; prefer SheetJS `.w` (formatted) when available, fall back to arithmetic conversion; validate all converted times against the rehearsal schema regex before including in preview.

6. **Merged-cell header detection failure** — the ensemble sheet's rows 9-12 multi-row merged structure defeats generic header detection. The existing `parseExcelBufferWithHeaderDetection()` should NOT be used for this sheet. Prevention: purpose-built parser using fixed column positions (A=active, B=conductor, C=name, D=count, E-H=Activity I, I-L=Activity II, M=total, N=coord, O=reporting, P-R=levels) with content-based row validation.

See `.planning/research/PITFALLS.md` for 16 total pitfalls with phase-specific warnings and integration risk matrix.

---

## Implications for Roadmap

Based on research, the milestone decomposes into 3 phases following the dependency chain: parser must be stable before execute, execute must be complete before frontend can render results meaningfully.

### Phase 1: Backend Parser and Preview Endpoint

**Rationale:** The parser is the sole risk-bearing foundation. All downstream work depends on correct parsing and name decomposition. Preview is read-only (no DB mutations) so the domain logic can be iterated safely against real Ministry Excel files without data risk. Every subsequent phase becomes straightforward once this is solid.

**Delivers:**
- `ENSEMBLE_COLUMN_MAP` constant with Hebrew header definitions
- `parseEnsembleExcel(buffer)` — SheetJS cell-address row extractor for fixed Ministry structure
- `parseEnsembleName(nameString)` — ordered decomposition with unit tests covering all known Ministry patterns
- `excelTimeToHHMM(value)` — robust time converter (string and numeric inputs)
- `DAY_NAME_TO_NUMBER` reverse map with aliases for "יום ראשון", abbreviated forms, etc.
- `matchOrchestra()` — composite key matching against existing orchestras
- `previewEnsembleImport(buffer, { context })` — full preview saved to import_log
- Controller handler + `POST /import/ensembles/preview` route
- `IMPORT_TYPES` constant updated to include `'ensembles'`

**Addresses:** All table stakes features 1-8 (parsing and preview)
**Avoids:** Pitfalls 2, 3, 4, 5, 6 (all parsing and matching pitfalls)
**Research flag:** Standard pattern — no deeper research needed; all patterns established in codebase and Ministry format reverse-engineered from export sheet builder

### Phase 2: Backend Execute and Schema Updates

**Rationale:** Execute depends on a stable preview shape from Phase 1 (the `parsedData` stored in import_log must have the correct structure). This phase contains the highest-risk write operations that require careful implementation.

**Delivers:**
- `executeEnsembleImport()` — bulk-safe: `insertMany` then single `bulkWrite` for teacher refs; never loops `addOrchestra()`
- Optional `scheduleSlots` field added to orchestra Joi schema (stores weekly template; avoids 840+ rehearsal documents)
- `ministryData.importedParticipantCount` added to orchestra schema
- School year ID explicitly threaded through import request to orchestra creation (prevents wrong-year assignment)
- Coordination hours written to `orchestra.ministryData.coordinationHours`; checked against `teacher.managementInfo` before overwrite
- `executeImport` dispatcher updated with `else if (log.importType === 'ensembles')` branch (3-line change)
- Import log status lifecycle: `pending → completed | partial | failed`

**Addresses:** Table stakes execute features; ministry data storage; school year scoping
**Avoids:** Pitfalls 1, 9, 10, 11, 15 (execute and data model pitfalls)
**Research flag:** Standard pattern — execute mirrors existing teacher/student pattern exactly; one design decision needed (conductorId optionality, see Gaps)

### Phase 3: Frontend Integration

**Rationale:** Frontend depends on the backend API contract being final (preview response shape from Phase 1, execute endpoint from Phase 2). Tab addition is low-risk; follows the exact same upload/preview/results pattern as the 3 existing tabs.

**Delivers:**
- `previewEnsembleImport(file)` method added to `importService` in `apiService.js`
- `ImportTab` type union extended: `'teachers' | 'students' | 'conservatory' | 'ensembles'`
- 4th tab button ("הרכבים") in `ImportData.tsx`
- Ensemble-specific preview table: conductor match status column, type/subType/performanceLevel columns, schedule (day + time) columns, diff summary for matched orchestras
- Upload → preview → results flow wired to backend endpoints
- Warning display for unresolved conductors and unrecognized ensemble names

**Addresses:** Frontend tab table stakes feature
**Avoids:** Pitfall 14 (IMPORT_TYPES constant already updated in Phase 1)
**Research flag:** Standard pattern — near-identical to teachers/students tabs; no novel UI patterns required

### Phase Ordering Rationale

- Parser before execute: decomposition errors discovered during preview are just warnings; discovered during execute they are data corruption incidents.
- Execute before frontend: the preview response shape must be finalized before frontend renders it; changing the shape after frontend is built requires two-pass fixes.
- No rehearsal auto-creation in this milestone: generating per-week rehearsal documents (30-40 per ensemble per year) requires school year date range, creates rollback complexity, and is better as a separate explicit action. `scheduleSlots[]` on the orchestra document provides the weekly template for the export round-trip.
- Frontend tab can be scaffolded in parallel with backend Phase 2 if the Phase 1 preview response shape is agreed and stable.

### Research Flags

Phases needing deeper research during planning:
- **None.** All three phases use established codebase patterns. Name decomposition rules are fully documented in FEATURES.md and PITFALLS.md. No external API research, no third-party service integration, no novel architecture.

Phases with standard patterns (skip research-phase):
- **All three phases.** Stack is locked. Integration points verified by direct codebase analysis. Ministry Excel format is fully documented from the existing export sheet builder.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed by `package.json` analysis; SheetJS cell-access pattern proven in existing `parseConservatoryExcel()`; time conversion verified via SheetJS docs |
| Features | HIGH | Ministry Excel structure reverse-engineered from `ensembles.sheet.js` (live code); all column positions and header names confirmed; orchestra and rehearsal schemas read directly |
| Architecture | HIGH | All integration points verified with exact file/line references; 3 existing import types provide a clear, consistent pattern to follow |
| Pitfalls | HIGH | All 16 pitfalls traced to specific code paths: `addOrchestra()` bidirectional write, `orchestra.validation.js` required `conductorId`, `hours-summary.service.js` read path, all confirmed by direct code analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **Ministry name variants in the wild:** Name decomposition rules are based on known patterns from project context, not a corpus of actual Ministry files from multiple conservatories. Edge cases (unusual spacing, alternate abbreviations, non-standard subType names) will surface during testing against real files. The `parseEnsembleName()` function must return `{ unmapped: true, originalName }` for unrecognized names rather than throwing or silently producing wrong data. Handle during Phase 1 implementation.

- **School year selection UX:** The import request must carry an explicit `schoolYearId` (Pitfall 10). The API design question — dropdown in the upload step defaulting to current school year, or auto-detection from file header metadata (rows 1-8 sometimes contain the year) — should be decided at the start of Phase 1. Recommendation: dropdown defaulting to current school year (same as student import).

- **`conductorId` optionality during execute:** The orchestra Joi schema hard-requires `conductorId`. Two options for unresolved conductors: (a) skip them during execute, include in `partialResults.skipped[]` with reason; (b) bypass Joi for import writes and store with `conductorId: null`, marked `status: 'pending_conductor'`. Option (a) is simpler and safer; confirm before building Phase 2 execute path.

- **Rehearsal document creation:** Both ARCHITECTURE.md and PITFALLS.md independently recommend deferring rehearsal document creation (store `scheduleSlots[]` on orchestra, let admin generate rehearsals via existing UI). Confirm this deferral with the team before Phase 2 coding to avoid rework.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `api/export/sheets/ensembles.sheet.js` — Ministry Excel ensemble sheet structure (columns A-R, header rows 9-12, data rows 13-45)
- `api/export/ministry-mappers.js` — `mapEnsembleSchedule()`: confirms round-trip contract for ensemble data
- `api/export/sheets/_shared.js` — `ENSEMBLE_TO_COLUMN` subType-to-column mapping, `SHEET_NAMES`, `composeName()`
- `api/orchestra/orchestra.validation.js` — Joi schema, all valid enums (`ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS`), required `conductorId`
- `api/orchestra/orchestra.service.js` — `addOrchestra()` bidirectional write logic (source of Pitfall 1)
- `api/rehearsal/rehearsal.validation.js` — HH:MM time format regex, `dayOfWeek` 0-6, `bulkCreateSchema`
- `api/import/import.service.js` — existing import patterns, `matchTeacherByName()` (line 1257), `parseConservatoryExcel()` (line 1909), column map pattern, preview/execute flow
- `api/import/import.controller.js` — controller wrapper pattern
- `api/import/import.route.js` — route registration pattern with `requireAuth`
- `api/hours-summary/hours-summary.service.js` — how `conducting.orchestraIds` feeds into teacher hour totals
- `config/constants.js` — `ORCHESTRA_TYPES`, `ORCHESTRA_SUB_TYPES`, `PERFORMANCE_LEVELS`, `IMPORT_TYPES`
- `src/pages/ImportData.tsx` (frontend) — 3-tab structure, upload/preview/results flow
- `src/services/apiService.js` (frontend) — `importService` methods at ~line 5071
- `package.json` — all dependency versions confirmed

### Secondary (HIGH confidence — official documentation)

- SheetJS merged cells: https://docs.sheetjs.com/docs/csf/features/merges/
- SheetJS dates and times: https://docs.sheetjs.com/docs/csf/features/dates/
- SheetJS cell objects: https://docs.sheetjs.com/docs/csf/cell/
- SheetJS sheet objects: https://docs.sheetjs.com/docs/csf/sheet/

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
