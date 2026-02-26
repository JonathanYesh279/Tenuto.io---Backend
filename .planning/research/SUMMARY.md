# Project Research Summary

**Project:** Tenuto.io v1.2 — Enhanced Student Import
**Domain:** Ministry of Education Excel import for Israeli music conservatory student records
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

This milestone enhances an existing, working student import pipeline — not a greenfield build. The system already parses Ministry of Education Excel files, detects Hebrew columns, matches students by name, and runs a preview/execute two-phase flow. Four critical gaps exist in the current implementation: the teacher name column (`המורה`) is parsed but never resolved to a teacher record; `instrumentProgress[]` is never populated for imported students even though all downstream features (export, stage tests, data integrity) require it; the Ministry stage level (א/ב/ג) is stored as a flat field rather than inside `instrumentProgress[]` where the rest of the codebase reads it; and the student preview UI shows raw field paths instead of the rich Hebrew-labeled detail that the teacher preview already provides.

The recommended approach is a strict dependency-ordered build: fix the `detectInstrumentColumns` bug first (one line, prerequisite), then build `instrumentProgress[]` creation (highest downstream impact, fully self-contained), then teacher-student linking (requires teachers to be in DB first), then bagrut flagging (lowest complexity), and finally the frontend preview enhancement (depends on all backend enrichments). All four capabilities require zero new npm dependencies — every tool needed is already installed. The implementation is entirely additive changes to `api/import/import.service.js` (backend) and `src/pages/ImportData.tsx` (frontend), with no new endpoints, routes, or services.

The defining risk of this milestone is the `teacherAssignment` Joi schema: it requires `day`, `time`, and `duration` which Ministry files do not provide. Attempting to create valid assignments through the service layer will fail schema validation. The recommended mitigation is to write import-shaped assignments directly via MongoDB (`$push`) bypassing Joi, storing `{ teacherId, isActive: true, notes: 'ייבוא ממשרד החינוך' }` without `day`/`time`. A second high-severity risk is that the current `executeStudentImport` bypasses `addStudent()`, which means school year enrollment and the `isPrimary` guard are never run for imported students — this must be addressed by routing through `addStudent()` with `isAdmin: true` or explicitly replicating those side effects.

## Key Findings

### Recommended Stack

The stack requires zero new dependencies. ExcelJS (^4.4.0), multer memoryStorage (^1.4.5-lts.1), Joi (^17.13.3), and the MongoDB native driver (^6.13.0) already handle all parsing, validation, and persistence. On the frontend, `@phosphor-icons/react` (^2.1.10) and `react-hot-toast` (^2.6.0) cover all UI needs. Teacher name matching requires no fuzzy library — the conservatory imports its own staff (20-80 teachers per tenant) and exact case-insensitive match is both sufficient and safer than fuzzy matching that could produce false positives.

**Core technologies (all existing, no changes):**
- ExcelJS: Excel parsing with Hebrew multi-row header detection — already handles Ministry file format
- MongoDB native driver: direct `$push`/`$set` operations during import — intentional bypass of service layer
- Joi: schema awareness for correct document shape; bypassed during import writes (same pattern as teacher import)
- multer memoryStorage: file never touches disk — locked
- React 18 + TypeScript + Vite: UI framework — no changes
- Pure JavaScript name-split matching: replaces need for `fuse.js` or `fast-fuzzy` — teacher pool is small and authoritative

See `.planning/research/STACK.md` for full version verification and rejected additions.

### Expected Features

The single highest-value gap is teacher-student linking: imported students are currently orphaned with no teacher assignment, which defeats the primary purpose of the annual re-enrollment import. The second most impactful gap is `instrumentProgress[]`: without it, imported students fail data integrity checks, export to Ministry format shows blank instrument columns, and stage test features do not apply to any imported student.

**Must have (table stakes):**
- `instrumentProgress[]` creation from `instrument`/`department` columns — all downstream features require it; currently absent for all imported students
- Teacher-student linking from `המורה` column — primary use case for annual re-enrollment; currently parsed but never applied
- `ministryStageLevel` stored in `instrumentProgress[]` — currently stored as a flat field; downstream code reads from the array
- Enriched preview UX showing teacher match status, instrument, stage, and bagrut flag — admin must review before confirming

**Should have (differentiators):**
- Unresolved teacher name warnings with exact name shown — enables admin to investigate and re-import
- Preview summary counts: teacher links found vs unresolved vs ambiguous
- Column detection report in preview — shows which Excel columns were recognized
- Duplicate row detection (same student listed twice with different instruments)

**Defer (v2+):**
- Fuzzy teacher name matching — exact match is sufficient; fuzzy risks false positives more than it helps
- Full bagrut document creation during import — requires program data Ministry files do not contain; flag only
- Orchestra/ensemble auto-assignment — out of scope per PROJECT.md
- Full teacher assignment scheduling (day/time/location) — Ministry files do not contain lesson schedule data

See `.planning/research/FEATURES.md` for behavioral specifications and the MVP build order.

### Architecture Approach

The enhancement is purely additive within the existing 1,900-line `import.service.js`. The fundamental pattern — preview stores all resolved state, execute just applies it — must be respected. All teacher name resolution happens at preview time, with resolved `teacherId` persisted in the `import_log` document. Execute reads from the log and never re-queries the teacher collection, eliminating any race condition between preview and execute. All import writes go directly to MongoDB collections, bypassing the `student.service.js` layer (consistent with how teacher import works).

**Major integration points:**
1. `previewStudentImport()` — add teacher collection load, `matchTeacherByName()` call, and `resolvedTeacherId` storage in each preview entry
2. `calculateStudentChanges()` — extend to diff `teacherAssignment`, `instrumentProgress`, and `academicInfo.isMusicMajor`
3. `executeStudentImport()` — handle three new change types (`$push` for teacher assignment and instrument progress, `$set` for isMusicMajor); rebuild new student construction to include `instrumentProgress[]`
4. `ImportData.tsx` — add `getStudentRowDetails()` and `formatStudentChange()` to replace the bare-field-path student preview branch

**Patterns to follow:**
- Extend column map, not the parser: add new Hebrew headers to `STUDENT_COLUMN_MAP`; the parser handles the rest automatically
- Preview stores all resolved state; execute applies it without re-resolving
- Direct MongoDB writes for import (bypass Joi) — import already does this intentionally
- Mirror teacher preview quality for student preview: `getStudentRowDetails()` mirrors `getTeacherRowDetails()`

**Anti-patterns to avoid:**
- Re-querying teacher collection on execute (race condition + redundant)
- Using `$set` for `instrumentProgress` on matched students (destroys existing array)
- Setting a real or placeholder `scheduleSlotId` (corrupts the relationship model)
- Triggering `syncTeacherRecordsForStudentUpdate()` after import (creates phantom time-block records)

See `.planning/research/ARCHITECTURE.md` for exact line-level integration points with code snippets.

### Critical Pitfalls

Research identified 4 critical/high pitfalls and 9 moderate/minor ones. The top 5 that must be designed around before writing code:

1. **teacherAssignment schema requires day/time/duration that Ministry files cannot provide** — Avoid by writing import-shaped assignments directly via MongoDB `$push`, bypassing Joi. Store `{ teacherId, isActive: true, notes: 'ייבוא ממשרד החינוך' }` without schedule fields. Do NOT use placeholder day/time values — this creates garbage schedule data. (PITFALLS.md Pitfall 1)

2. **executeStudentImport bypasses addStudent(), losing school year enrollment and isPrimary guard** — All imported students are currently invisible to school-year-scoped queries. Fix by routing through `addStudent(student, null, true, options)` with `isAdmin: true`, or explicitly replicating `schoolYearService.getCurrentSchoolYear()` enrollment and `isPrimary` enforcement. Option 1 (route through service) is strongly preferred. (PITFALLS.md Pitfall 2)

3. **detectInstrumentColumns missing headerColMap in student import path** — Existing one-line bug at `import.service.js` lines 1490-1491: `detectInstrumentColumns(headers)` is called without `headerColMap`. Teacher path passes both arguments correctly. This bug causes instrument column misdetection. Must fix before building `instrumentProgress` on top of instrument detection. (PITFALLS.md Pitfall 6)

4. **Hebrew name ambiguity: wrong teacher silently linked to all students** — Exact match only; never silently take `matches[0]` when multiple teachers share a name. Surface ambiguous matches as preview warnings requiring manual review. Also try both name orderings (first+last and last+first) and strip RTL/LTR Unicode marks before comparing. (PITFALLS.md Pitfall 4)

5. **Teacher match result not stored in import_log; execute may re-match differently** — `resolvedTeacherId` must be persisted in the `import_log` preview entry at preview time. Execute reads `entry.teacherMatch.teacherId` directly from the log — never re-runs matching. (PITFALLS.md Pitfall 7)

See `.planning/research/PITFALLS.md` for the full 13-pitfall analysis with detection methods and integration risk matrix.

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall severity matrix in PITFALLS.md, the build must proceed in strict dependency order. Each step is independently verifiable and does not break existing behavior.

### Phase 1: Bug Fix Prerequisites + Column Map Extensions

**Rationale:** Two pre-existing bugs and one missing column mapping must be fixed before any enhancement is built on top of them. Building `instrumentProgress` on an incorrect instrument detection foundation causes all subsequent work to fail at runtime. These fixes are low-risk (one-liner + additive column map entries) and produce no user-visible change on their own.

**Delivers:** Correct instrument column detection for student import; `isMusicMajor` and abbreviated `מגמה` column recognized by the parser.

**Addresses:**
- Fix `detectInstrumentColumns(headers)` to `detectInstrumentColumns(headers, headerColMap)` — existing one-line bug (Pitfall 6)
- Add `'מגמת מוסיקה': 'isMusicMajor'` and `'מגמה': 'isMusicMajor'` to `STUDENT_COLUMN_MAP`
- Add `isMusicMajor` boolean coercion in `validateStudentRow()` using existing `TRUTHY_VALUES` pattern

**Avoids:** Pitfall 6 (instrument mis-detection corrupts all downstream instrumentProgress work)

**Research flag:** None needed — well-defined bug fix with exact line numbers in codebase. Standard pattern.

---

### Phase 2: instrumentProgress[] Creation + School Year Enrollment

**Rationale:** Highest downstream impact, fully self-contained (no external dependencies on teacher DB state). Every downstream system — export, data integrity, stage tests, Ministry report generation — reads from `instrumentProgress[]`. Fixing this for both new and matched students immediately unlocks all of those features for imported students. The school year enrollment side effect must be addressed in this same phase because it is a prerequisite for newly imported students to appear in any school-year-scoped query.

**Delivers:** All imported students have a valid `instrumentProgress[]` with correct `instrumentName`, `isPrimary: true`, `currentStage` (derived from ministryStageLevel via `MINISTRY_LEVEL_TO_STAGE` constant), and `ministryStageLevel`. New students are enrolled in the current school year. Data integrity checks pass for imported students. Ministry export shows correct instrument columns.

**Addresses:**
- New `buildInstrumentProgressEntry(instrument, ministryStageLevel)` function
- Named constant `MINISTRY_LEVEL_TO_STAGE = { 'א': 1, 'ב': 4, 'ג': 6 }` with business-rule comment
- `calculateStudentChanges()` extended: diffs `instrumentProgress` (add vs updateStageLevel actions)
- `executeStudentImport()` extended: `$push` for new instrument entries, positional `$set` for stage-level updates on matched students
- New student construction rebuilt to include `instrumentProgress[]` (replacing flat `academicInfo.instrument`)
- School year enrollment: route new students through `addStudent()` service with `isAdmin: true`, or explicitly replicate enrollment step

**Avoids:** Pitfall 2 (missing school year enrollment), Pitfall 3 (schema requires instrumentProgress), Pitfall 10 (undocumented business rule mapping), Pitfall 12 (update vs create inconsistency)

**Research flag:** One decision point before coding — whether to route new student creation through `addStudent()` service (recommended) or replicate school year enrollment inline. This is a team decision, not a research question. Must be resolved before Phase 2 coding starts.

---

### Phase 3: Teacher-Student Linking

**Rationale:** Second highest value (core re-enrollment use case). Depends on teacher records already being in the database (teacher import runs first — existing established flow). The architectural decisions about teacher assignment shape and import_log persistence must be locked before any teacher-linking code is written.

**Delivers:** Students imported from Ministry files are linked to their teachers via `teacherAssignment` entries stored directly via MongoDB `$push`. Preview shows teacher match status (resolved/unresolved/ambiguous) for each student row. Unresolved teacher names surface as actionable warnings with the exact name. Frequency analysis groups multiple rows with the same unresolved name into a single actionable warning.

**Addresses:**
- New `matchTeacherByName(teacherName, teachers)` function (exact case-insensitive, both name orderings, Unicode mark stripping)
- Teacher collection loaded in `previewStudentImport()` with `{ isActive: true, tenantId }` filter
- `resolvedTeacherId` and `teacherMatch` metadata stored in each preview entry and persisted in `import_log`
- `calculateStudentChanges()` extended: checks for existing active assignment before adding `teacherAssignment` change
- `executeStudentImport()`: `$push teacherAssignments` with import-shaped object `{ teacherId, isActive: true, notes: 'ייבוא ממשרד החינוך' }` — no `day`/`time`, `scheduleSlotId: null`
- Preview warnings for unresolved names and frequency grouping for repeated unresolved names

**Avoids:** Pitfall 1 (schema validation failure for missing day/time), Pitfall 4 (wrong teacher silently linked), Pitfall 7 (teacher match not persisted in import_log), Pitfall 11 (duplicate unresolved name produces many individual warnings instead of one grouped warning)

**Research flag:** None needed — all integration points and the teacherAssignment shape decision are documented in ARCHITECTURE.md with exact code snippets.

---

### Phase 4: Bagrut Flagging

**Rationale:** Lowest complexity of the four features. Independent of phases 2 and 3 (does not depend on teacher or instrument data). The column map entry for `מגמת מוסיקה` was already added in Phase 1; Phase 4 completes the feature by wiring it through `calculateStudentChanges()` and new student construction.

**Delivers:** Students in the music bagrut track are flagged with `academicInfo.isMusicMajor: true` at import time. Admins then create the full bagrut document (with program pieces, teacher, accompanist) through the existing manual bagrut flow.

**Addresses:**
- `calculateStudentChanges()`: diff `academicInfo.isMusicMajor` for matched students
- `executeStudentImport()`: existing `$set` loop already handles dot-notation paths; isMusicMajor handled automatically
- New student construction: write `academicInfo.isMusicMajor` when truthy
- Note: column map entry and boolean coercion already done in Phase 1

**Avoids:** Pitfall 8 (bagrut requires two-document atomic write — prevented by using flag instead of full record)

**Research flag:** None needed — explicit scope boundary (flag only, not full record) is clear from PROJECT.md. Pattern is identical to `extraHour` handling — ~15 lines total.

---

### Phase 5: Enriched Preview UI

**Rationale:** Purely dependent on phases 2-4. Once backend enrichments are in place and the preview response includes teacher match status, instrument progress changes, and bagrut flag, the frontend can render them. This phase has the lowest risk (additive display code, no existing logic removed) but the highest user-visible impact.

**Delivers:** Student import preview shows the same quality of detail as teacher import preview: instrument detected, teacher linked/unresolved/ambiguous, stage level, music major flag, changes list with Hebrew labels. Summary counts show teacher links resolved vs unresolved. Column detection report shows which Excel columns were recognized.

**Addresses:**
- New `formatStudentChange(change)` helper (maps field paths to Hebrew labels, handles action types: add/updateStageLevel/teacherAssignment)
- New `getStudentRowDetails(row)` helper (mirrors `getTeacherRowDetails()` — same component structure with `<div className="space-y-1 text-xs">`)
- Replace bare-field-path student branch with `getStudentRowDetails(row)` call
- Add summary stats panel above preview table: teacher links resolved/unresolved/ambiguous counts
- Separate TypeScript interfaces for `TeacherPreviewRow` and `StudentPreviewRow` (prevents tab-switch data shape collision)
- Address 50-row preview limit: add filter tabs (All / Teacher resolved / Unresolved / Ambiguous) for navigating 1,293-student imports

**Avoids:** Pitfall 5 (teacher/student preview data shape collision), Pitfall 9 (50-row limit hides most teacher match results at 1,293 students)

**Research flag:** None needed — `getTeacherRowDetails()` (lines 152-258 in `ImportData.tsx`) is the direct template to mirror.

---

### Phase Ordering Rationale

- **Phase 1 before everything else:** The `detectInstrumentColumns` bug is a hard prerequisite. Building instrument progress on top of broken detection creates cascading failures that are difficult to debug. Column map additions in Phase 1 also unblock Phase 4 (bagrut).
- **Phase 2 before Phase 3:** `instrumentProgress[]` is fully self-contained and does not depend on teacher DB state. Completing Phase 2 alone delivers a meaningful system improvement. Teacher linking (Phase 3) depends on teacher records being pre-populated via the teacher import flow.
- **Phase 3 before Phase 4:** Teacher linking is the highest-value remaining feature after instrumentProgress. Bagrut flagging is trivially small (15 lines) and independent.
- **Phase 5 last:** Purely a display layer. All backend changes must be in place before the frontend can meaningfully render the enriched preview data.
- This ordering directly mirrors the FEATURES.md MVP build order and the ARCHITECTURE.md dependency graph.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1:** Bug fix + column map extension — single-line fix with exact location known; additive changes
- **Phase 3:** Teacher matching — exact implementation with code snippets in ARCHITECTURE.md; precedent set by teacher import
- **Phase 4:** Bagrut flagging — 15 lines total, mirrors existing `extraHour` pattern exactly
- **Phase 5:** Frontend preview — direct mirror of existing `getTeacherRowDetails()` function

Phases requiring one pre-implementation decision before coding begins:
- **Phase 2:** One architectural decision — route new student creation through `addStudent()` service layer (recommended) vs replicate school year enrollment inline. Not a research question; a team decision. Resolve before Phase 2 coding starts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified from both `package.json` files; zero new dependencies confirmed by inspecting installed packages |
| Features | HIGH | Based on direct codebase analysis; all gaps traced to specific line numbers in production code |
| Architecture | HIGH | All integration points verified with exact line numbers and code snippets from production files |
| Pitfalls | HIGH | All 13 pitfalls traced to specific code paths in production files; detection methods and line numbers included |

**Overall confidence: HIGH**

All research is based on direct analysis of production code — not web research or community consensus. Every claim is traceable to a specific file and line number in the Tenuto.io codebase.

### Gaps to Address

- **School year enrollment decision (Phase 2):** Route new students through `addStudent()` service (recommended) vs inline replication. Validate that `addStudent()` with `isAdmin: true` does not conflict with the multi-tenant `buildContext` pattern during import. Import runs as admin — context is available. Recommend testing this path first before committing to inline replication.

- **`ministryStageLevel` to `currentStage` mapping values:** ARCHITECTURE.md uses `{ 'א': 1, 'ב': 4, 'ג': 6 }` and PITFALLS.md uses `{ 'א': 1, 'ב': 3, 'ג': 6 }` (different ב values: 4 vs 3). At implementation time, verify against `stageToMinistryLevel()` in `config/constants.js` line 163 and pick the value that is most defensible for the intermediate band. Document the mapping with a comment explaining the business rationale regardless of which value is chosen.

- **50-row preview table limit (Phase 5):** PITFALLS.md flags this as a moderate issue at 1,293 students. The filter-tabs approach is recommended over increasing the raw limit. Implementation approach for filter tabs (client-side filtering of `allPreviewRows`) should be designed during Phase 5 to avoid state management complexity.

- **teacherAssignment shape consistency:** FEATURES.md recommends `{ teacherId, duration, isActive, notes }` without `day`/`time`. ARCHITECTURE.md recommends `{ teacherId, scheduleSlotId: null, startDate, endDate, isActive, notes }` without `day`/`time`. These are compatible — at implementation time use the more complete ARCHITECTURE.md shape. Both agree on the core principle: no `day`, no `time`, no real `scheduleSlotId`.

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `api/import/import.service.js` (1,957 lines) — full import pipeline: both teacher and student flows, column maps, matching functions, preview/execute flow
- `api/student/student.validation.js` (244 lines) — `instrumentProgressSchema`, `teacherAssignmentSchema`, `studentSchema`
- `api/student/student-assignments.validation.js` — `validateTeacherAssignmentsWithDB` DB consistency validation
- `api/student/student.service.js` — `addStudent()` side effects (school year enrollment, isPrimary guard, teacher sync, lines 110-260)
- `api/bagrut/bagrut.service.js` — two-document write pattern; `addBagrut()` + `setBagrutId()` coupling
- `api/export/ministry-mappers.js` — `mapStudentFull()` reads `instrumentProgress` for Ministry export
- `api/export/sheets/students.sheet.js` — confirms `מגמת מוסיקה` column exists in export output
- `config/constants.js` — `VALID_INSTRUMENTS`, `MINISTRY_STAGE_LEVELS`, `VALID_STAGES`, `stageToMinistryLevel()`, `TRUTHY_VALUES`
- `src/pages/ImportData.tsx` (962 lines) — full preview UI, `getTeacherRowDetails()` template (lines 152-258), 50-row limit (line 823), tab switching
- `src/services/apiService.js` — import service block (lines 5071-5160); no changes needed
- `.planning/PROJECT.md` — scope boundaries and explicit out-of-scope items
- Both `package.json` files (backend + frontend) — verified installed packages; zero new dependencies confirmed

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
*Files synthesized: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
