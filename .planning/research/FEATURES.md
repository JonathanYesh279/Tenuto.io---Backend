# Feature Landscape: Enhanced Student Import

**Domain:** Ministry of Education Excel import for Israeli music conservatory student records
**Researched:** 2026-02-26
**Overall Confidence:** HIGH (based on direct codebase analysis — no web research needed for well-understood domain)

---

## What Already Exists (Do Not Rebuild)

Understanding the baseline prevents re-implementing finished work and clarifies exactly what "enhancement" means.

### Already Built and Working

| Feature | Location | Notes |
|---------|----------|-------|
| Excel upload + multer memoryStorage | `import.service.js` | `previewStudentImport()` + `executeStudentImport()` |
| Header row auto-detection (scores up to 10 rows) | `parseExcelBufferWithHeaderDetection()` | Handles multi-row merged Ministry headers |
| Multi-row merged header backfill | `parseExcelBufferWithHeaderDetection()` | Parent-row climbing for sub-labels |
| Hebrew column mapping (STUDENT_COLUMN_MAP) | `import.service.js` lines 113-133 | Maps שם, כיתה, שנות לימוד, שלב, המורה, זמן שעור |
| `fullName` → `firstName` + `lastName` split | `validateStudentRow()` | Space-split on `\s+` |
| Lesson duration conversion (weekly hours → minutes) | `validateStudentRow()` | 0.75 sh"sh → 45 minutes, handles 2x/3x lesson weeks |
| Ministry stage level (שלב א/ב/ג) parsing + validation | `validateStudentRow()` + `MINISTRY_STAGE_LEVELS` | Validated against `['א', 'ב', 'ג']` |
| Age validation | `validateStudentRow()` | Range 3-99 |
| Study years parsing | `validateStudentRow()` | `parseInt` with null fallback |
| Instrument column detection (colored cells + boolean) | `detectInstrumentColumns()` + `readInstrumentMatrix()` | Checks cell fill color first, text fallback |
| Department → instrument auto-assign (single-instrument dept) | `previewStudentImport()` lines 1533-1555 | Auto-assigns when dept has exactly 1 instrument |
| Student name matching (firstName + lastName exact) | `matchStudent()` | Returns `name_duplicate` when multiple match |
| Duplicate name warning | `previewStudentImport()` | Warns when 2+ students share a name |
| Preview dry-run with import_log persistence | `previewStudentImport()` | Saves to `import_log` with `status: 'pending'` |
| Execute from importLogId | `executeStudentImport()` | Reads pending log, updates/creates students |
| Basic student creation (new students) | `executeStudentImport()` lines 1788-1819 | Creates minimal document without `instrumentProgress[]` |
| Updates: class, studyYears, extraHour | `calculateStudentChanges()` | Only these 3 fields diffed |
| Ministry stage level stored on new students | `executeStudentImport()` line 1812-1815 | `newStudent.academicInfo.ministryStageLevel` (flat field, NOT in instrumentProgress) |
| 3-step frontend flow | `ImportData.tsx` | upload → preview → results |
| Teacher/student tab switching | `ImportData.tsx` | Resets state on tab change |
| Import results summary | `ImportData.tsx` | Shows created/updated/error counts |

### What the Column `המורה` Currently Does

The `המורה` column is parsed into `mapped.teacherName` (a string) and stored in `mapped` — but **nothing in `executeStudentImport()` uses `mapped.teacherName`**. It is visible in the preview `mapped` object but never matched to a teacher record and never written to `teacherAssignments[]`. This is the primary gap.

### What `instrumentProgress[]` Currently Gets From Import

Currently: **nothing**. New students created via import get `academicInfo.instrument` (a flat string field, legacy) and `academicInfo.ministryStageLevel` (a flat string), but `academicInfo.instrumentProgress[]` — the authoritative array schema — is never populated. This means imported students fail the `instrumentProgress.min(1).required()` Joi validation and therefore bypass it (the import bypasses Joi and writes directly with `insertOne`).

---

## Table Stakes

Features users (conservatory administrators) expect from this import flow. Missing = import is not useful for annual re-enrollment.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Teacher-student linking from Excel `המורה` column** | The primary use case for the import — set who teaches whom from the Ministry roster. Without it, imported students are orphaned (no teacher) and the import fails its core purpose. | Medium | `matchTeacher()` already exists and works for teacher import. Must apply it during student import: fuzzy name → `teacherId` → create `teacherAssignment` entry. Teacher DB must be pre-populated (teacher import runs first). |
| **`instrumentProgress[]` creation from instrument/department columns** | Student schema requires `instrumentProgress[]` for all downstream features (stage tests, bagrut eligibility, export). Without it, imported students appear invalid in the system. | Medium | `detectInstrumentColumns()` + `readInstrumentMatrix()` already detect instruments. Gap is only in `executeStudentImport()`: detected instrument must become an `instrumentProgress` entry `{ instrumentName, isPrimary: true, currentStage: 1, ministryStageLevel, tests: {} }`. |
| **`ministryStageLevel` stored in `instrumentProgress[]`** | The שלב column is already parsed (א/ב/ג). It needs to land in `instrumentProgress[0].ministryStageLevel` (not `academicInfo.ministryStageLevel`), because all downstream code (export mapper, student service, UI) reads it from the progress array. | Low | `stageToMinistryLevel()` helper exists in constants. Inverse mapping also exists. |
| **Bagrut program flagging from `מגמת מוסיקה` column** | Conservatory must tag which students are in the music bagrut track at import time — re-enrollment requires this data. | Low | New column map entry needed: `'מגמת מוסיקה': 'isBagrutTrack'`. Detection is boolean/checkmark in Excel. Stored as `academicInfo.isBagrutTrack: true`. Does NOT create a `bagrut` document — just flags the student. |
| **Preview shows enriched student data** | Admin must see teacher-to-student links, instrument assignments, and bagrut flags BEFORE confirming import — not just name + class. Current preview only shows 3 change fields. | Medium | Frontend `ImportData.tsx` needs new `getStudentRowDetails()` helper (mirrors `getTeacherRowDetails()` which already exists). Backend `calculateStudentChanges()` must include the new fields. |
| **Preview summary counts by category** | Admin needs to know: X students matched, Y new, Z with teacher links found, W with unknown teacher names. | Low | Extend the existing preview object to include `teacherLinksFound`, `teacherLinksUnresolved`, `instrumentsDetected` counts. |

## Differentiators

Features that set this import apart from a basic CSV dump. Not expected at first glance, but immediately valuable when discovered.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Fuzzy teacher name matching with confidence score** | Ministry Excel teacher names are often abbreviated or have spelling variations. `"דני לוי"` vs `"דניאל לוי"` both exist. A fuzzy match with low-confidence warning is better than silent failure. | Medium | Add Levenshtein distance or normalized name comparison after exact-match fails. Mark `matchType: 'name_fuzzy'` with a warning in preview. Do NOT auto-link fuzzy matches — show as warning requiring manual review. |
| **Warn on unresolved teacher names** | When `המורה` column has a value but no teacher was found in DB, show a warning with the exact unresolved name so admin can investigate. | Low | Simple: after teacher match attempt, if `matchType === null`, push to `preview.warnings` with `{ field: 'teacherName', message: 'לא נמצא מורה: [name]' }`. |
| **Detect and skip duplicate Excel rows** | Ministry files sometimes have the same student listed twice (two instruments, two teachers). Current code takes first match — should detect and warn. | Low | Check if student was already matched in this import run (Set of matched studentIds). Second occurrence = warning. |
| **Import creates `currentStage` from `ministryStageLevel`** | Reverse-map שלב → `currentStage`: `א` → stage 1, `ב` → stage 4, `ג` → stage 6. These are defensible default entry points when no other stage data exists. | Low | `stageToMinistryLevel()` exists. Inverse: `ministryLevelToDefaultStage()` — add to constants. |
| **Column detection report in preview** | Show admin which Excel columns were recognized: "detected: שלב, המורה, זמן שעור, כינור (colored), מגמת מוסיקה". Reduces confusion when import silently ignores columns. | Low | Backend already computes `headerMappingReport` for teacher import. Add same for student import. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Creating a full `bagrut` document on import** | Bagrut documents require `studentId`, `teacherId`, program pieces, accompanist, etc. Import cannot reliably populate these from a roster file. | Set `academicInfo.isBagrutTrack = true` flag only. Bagrut document creation remains a manual flow in the bagrut module. |
| **Full teacher assignment scheduling (day/time/location)** | Ministry file has `זמן שעור` (lesson duration) but NOT day of week or time. `teacherAssignment` schema requires `day`, `time`, `duration` (all mandatory). Cannot create a valid assignment without day/time. | Store `lessonDuration` in `academicInfo.lessonDuration`. Create `teacherAssignment` with `duration` only, using placeholder `day: 'ראשון'` and `time: '08:00'`, marked with `notes: 'ייובא - יש להגדיר זמן'` — OR simply store the teacher link as a looser reference until scheduling is done manually. See Pitfalls. |
| **Automatic bagrut creation from import** | Bagrut program has complex state (presentations, pieces, accompanists, director evaluation) that cannot come from a ministry file. | Flag only. Admin creates bagrut document separately. |
| **Updating existing `instrumentProgress[]` entries** | If a student already has `instrumentProgress[]` from prior manual entry (stage 5, test results, etc.), the import must NOT overwrite it with stage 1 default from the Excel file. | Only create `instrumentProgress[]` if the array is currently empty. If non-empty, update `ministryStageLevel` only on the primary instrument. Never touch `currentStage`, `tests`, or `isPrimary` on existing entries. |
| **Cross-year import merging** | Importing two years of data at once — the Ministry file is always one school year. | Single year per import. Multiple imports = safe (idempotent match logic). |
| **Importing parent/contact info** | Ministry files do not contain parent phone/email. These are collected separately. | Do not add parent fields to STUDENT_COLUMN_MAP — they will never appear in Ministry files. |

---

## Feature Dependencies

```
Teacher-student linking
  |-- Requires: teacher records already in DB (teacher import runs first)
  |-- Requires: matchTeacher() applied to mapped.teacherName during student preview
  |-- Requires: teacherAssignment shape decision (with or without day/time)
  |
  `-- Preview warning: unresolved teacher names
       |-- Show exact unresolved name in warnings
       `-- Admin action: run teacher import first, then retry student import

instrumentProgress[] creation
  |-- Requires: instrument detected from colored cell OR instrument column
  |-- Requires: ministryStageLevel from שלב column
  |-- Requires: inverse stageLevel → currentStage mapping (new helper)
  |
  `-- Guard: only create if instrumentProgress[] is currently empty

ministryStageLevel in instrumentProgress[]
  |-- Depends on: instrumentProgress[] creation (above)
  |-- Stored at: instrumentProgress[0].ministryStageLevel
  |-- Remove from: academicInfo.ministryStageLevel (flat field — was a stopgap)

Bagrut flagging (isBagrutTrack)
  |-- Requires: new column map entry for 'מגמת מוסיקה'
  |-- Stored at: academicInfo.isBagrutTrack (new boolean field)
  |-- Independent of instrumentProgress[] and teacherAssignment

Enriched preview UX
  |-- Depends on: all backend enrichments (teacher linking, instrumentProgress)
  |-- calculateStudentChanges() must include new fields
  |-- Frontend getStudentRowDetails() mirrors getTeacherRowDetails() pattern
```

---

## MVP Recommendation

Build in this order — each step produces working functionality without breaking existing behavior.

### Step 1: instrumentProgress[] Creation (highest value, no external dependencies)

**Why first:** Unblocks the rest. Currently imported students have no `instrumentProgress[]`, which breaks stage tests, export, and UI display. This is also fully self-contained — does not depend on teacher DB state.

**What to build:**
1. In `executeStudentImport()` for new students: build `instrumentProgress[]` with one entry from the detected instrument + ministryStageLevel + default stage.
2. For existing students being updated: if `instrumentProgress[]` is empty, create it; if non-empty, update only `ministryStageLevel` on primary instrument.
3. Add `currentStage` to the student change diff (`calculateStudentChanges()`).
4. Add `ministryLevelToDefaultStage()` helper to `constants.js`.

**Complexity:** Low-Medium. ~80 lines of new code in `executeStudentImport()` + `calculateStudentChanges()`. No new API endpoints.

### Step 2: Teacher-Student Linking

**Why second:** High value for the annual re-enrollment use case. Depends on teacher records being present (teacher import runs first — existing flow).

**What to build:**
1. In `previewStudentImport()`: for each row with `mapped.teacherName`, attempt `matchTeacher()`. Store resolved `teacherId` and `matchType` in the preview entry.
2. In `calculateStudentChanges()`: if teacher is resolved and student has no active assignment for that teacher, add a change `{ field: 'teacherAssignment', newValue: { teacherId, duration } }`.
3. In `executeStudentImport()`: for teacher link changes, push to `student.teacherAssignments[]` using `associateStudentWithTeacher()` pattern or direct `$push`.
4. `teacherAssignment` shape decision: store `{ teacherId, duration: mapped.lessonDuration, isActive: true, notes: 'ייובא ממשרד החינוך - יש להגדיר זמן שיעור', day: null, time: null }` — use `null` for day/time since they are unknown. The Joi schema allows `null` for optional fields.

**Complexity:** Medium. Teacher name fuzzy matching is the only hard part — start with exact match only (mirrors `matchTeacher()` priority 3 logic). Fuzzy match can be added later as an enhancement.

**Warning generation:**
- Unresolved teacher name → `preview.warnings.push({ field: 'teacherName', message: 'לא נמצא מורה: ${mapped.teacherName}' })`
- Add preview summary counts: `teacherLinksFound`, `teacherLinksUnresolved`.

### Step 3: Bagrut Flagging

**Why third:** Lowest complexity, self-contained, high administrative value.

**What to build:**
1. Add `'מגמת מוסיקה': 'isBagrutTrack'` to `STUDENT_COLUMN_MAP`.
2. In `validateStudentRow()`: parse as boolean using `TRUTHY_VALUES` (same pattern as `extraHour`).
3. In `calculateStudentChanges()`: add diff for `academicInfo.isBagrutTrack`.
4. In `executeStudentImport()`: write `academicInfo.isBagrutTrack` to new and updated students.

**Complexity:** Low. ~15 lines of code total. Pattern is identical to `extraHour` handling.

**Note:** Check if the student collection already uses this field or if it needs to be added to the student Joi schema with `Joi.boolean().default(false)`.

### Step 4: Enriched Preview UX

**Why last:** Depends on steps 1-3. Once backend enrichments are in place, expose them in the frontend.

**What to build:**
1. `calculateStudentChanges()` already returns a diff — extend it to include `instrumentProgress`, `teacherAssignment`, `isBagrutTrack` diffs (steps 1-3 do this).
2. In `ImportData.tsx`: add `getStudentRowDetails()` helper mirroring `getTeacherRowDetails()` (already exists for teachers, lines 152-258 in `ImportData.tsx`). Render: instrument detected, teacher linked/unresolved, stage level, bagrut flag, changes list.
3. Add column detection report to preview: `instrumentColumnsDetected`, `teacherColumnDetected`, `bagrutColumnDetected`.
4. Preview summary row counts: matched/new/skipped with breakdown of teacher links found vs unresolved.

**Complexity:** Low-Medium. Mostly frontend work. Backend changes are already in steps 1-3.

---

## Detailed Behavioral Specifications

### teacherAssignment Shape Decision

The student `teacherAssignment` Joi schema (in `student.validation.js`) requires `day` and `time` as mandatory fields. However, Ministry files do not contain lesson schedule data.

**Decision:** Store teacher link with placeholder day/time that signals "schedule not yet set":

```js
{
  teacherId: resolvedTeacherId,
  duration: mapped.lessonDuration || 45, // from זמן שעור column
  day: 'ראשון',                          // placeholder — not real
  time: '00:00',                          // placeholder — not real
  isActive: true,
  notes: 'ייובא ממשרד החינוך - יש לקבוע זמן שיעור',
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

Alternative: Bypass validation and store `{ teacherId, duration, isActive: true }` with `day` and `time` omitted. This requires either loosening the Joi schema (risky — affects UI-created assignments) or writing directly to MongoDB without Joi validation (acceptable for import, which already does this).

**Recommended approach:** Import bypasses Joi (already does this), writes `{ teacherId, duration, isActive: true, notes: '...' }` without `day`/`time`. Add `day` and `time` as `Joi.optional()` in `teacherAssignmentSchema` to allow this shape. UI-created assignments remain required to have day/time via UI-level validation.

### instrumentProgress[] Creation Logic

```
For NEW students:
  if (mapped.instrument):
    instrumentProgress = [{
      instrumentName: mapped.instrument,
      isPrimary: true,
      currentStage: ministryLevelToDefaultStage(mapped.ministryStageLevel) || 1,
      ministryStageLevel: mapped.ministryStageLevel || null,
      tests: {}
    }]
  else:
    instrumentProgress = []  // Cannot create entry without instrument name

For UPDATED students:
  if (student.academicInfo.instrumentProgress.length === 0 && mapped.instrument):
    → Same as new student above (populate from import)
  elif (student.academicInfo.instrumentProgress.length > 0):
    → Update ministryStageLevel ONLY on primaryInstrument (or first)
    → DO NOT change currentStage, tests, or isPrimary
    → DO NOT add new instruments from import
```

### ministryLevelToDefaultStage() Mapping

```js
export function ministryLevelToDefaultStage(level) {
  // Conservative: use lowest stage in each band
  // א (beginner): stage 1
  // ב (intermediate): stage 4
  // ג (advanced): stage 6
  if (level === 'א') return 1;
  if (level === 'ב') return 4;
  if (level === 'ג') return 6;
  return 1; // safe default when level unknown
}
```

This is conservative — always uses the bottom of each ministry band. Admin can adjust individual students afterward.

### isBagrutTrack Detection

The `מגמת מוסיקה` column in Ministry Excel files typically contains a checkmark character (✓ or V), `כן`, or `1` for students in the bagrut music track. Empty cells or `לא` = not in track.

Detection uses existing `TRUTHY_VALUES` array: `['✓', 'V', 'v', 'x', 'X', '1', 'כן', true, 1, 'true', 'TRUE', 'True']`.

Note: `'x'` and `'X'` are in `TRUTHY_VALUES` which is correct for Israeli Ministry convention where `X` means "yes/selected".

---

## Complexity Assessment

| Feature | Complexity | Backend Changes | Frontend Changes |
|---------|------------|----------------|-----------------|
| `instrumentProgress[]` creation | Low-Medium | `executeStudentImport()`, `calculateStudentChanges()`, `constants.js` | `getStudentRowDetails()` display |
| Teacher-student linking | Medium | `previewStudentImport()`, `executeStudentImport()`, `calculateStudentChanges()` | Preview teacher link display |
| Bagrut flagging | Low | `STUDENT_COLUMN_MAP`, `validateStudentRow()`, `calculateStudentChanges()`, `executeStudentImport()` | Flag display in preview |
| Enriched preview UX | Low-Medium | None (depends on steps 1-3) | `getStudentRowDetails()`, summary counts |
| Fuzzy teacher name matching | Medium | New helper function | Warning display in preview |
| Column detection report | Low | `previewStudentImport()` metadata | Summary panel in preview |

**Total estimated effort: 3-5 days backend + 1-2 days frontend.**

---

## Sources

All findings are HIGH confidence — derived from direct analysis of existing codebase:

- `api/import/import.service.js` — full service (1,950 lines), all existing logic
- `api/student/student.service.js` — `instrumentProgress`, `teacherAssignments`, `setBagrutId` patterns
- `api/student/student.validation.js` — Joi schemas: `instrumentProgressSchema`, `teacherAssignmentSchema`, `studentSchema`
- `api/bagrut/bagrut.validation.js` — bagrut document structure
- `api/bagrut/bagrut.service.js` — bagrut lifecycle
- `api/export/ministry-mappers.js` — how `instrumentProgress` is consumed in export (`mapStudentFull()`)
- `config/constants.js` — `MINISTRY_STAGE_LEVELS`, `VALID_STAGES`, `stageToMinistryLevel()`, `TRUTHY_VALUES`
- `src/pages/ImportData.tsx` — frontend 3-step flow, `getTeacherRowDetails()` pattern to mirror
