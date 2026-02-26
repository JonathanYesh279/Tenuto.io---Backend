# Domain Pitfalls: Enhanced Student Import

**Domain:** Adding teacher-student linking, instrumentProgress creation, and enhanced preview to existing music school import pipeline
**Researched:** 2026-02-26
**Confidence:** HIGH (based on direct codebase analysis of import.service.js, student.validation.js, student-assignments.validation.js, bagrut.service.js, and ImportData.tsx — all production files)

---

## Executive Summary

This analysis covers pitfalls specific to **adding** four interconnected features to the existing 962-line import pipeline:

1. Teacher matching from the Hebrew "המורה" column and creating `teacherAssignment` records
2. Building `instrumentProgress` array entries from the existing `instrument` field
3. Mapping Ministry `ministryStageLevel` (א/ב/ג) to internal `currentStage` (1-8)
4. Enhancing the 962-line `ImportData.tsx` preview UI without breaking teacher import

The system has several hard constraints that dramatically shape what is and is not possible. `teacherAssignment` requires `{ teacherId, day, time, duration }` — three of these four fields are missing from Ministry files. Student name matching is exact only (no fuzzy matching). The `studentSchema` Joi validation requires `instrumentProgress[].currentStage` as a number (1-8), but Ministry files only provide `ministryStageLevel` as א/ב/ג. These constraints force architectural decisions that are not obvious until you read the validation code.

The four most dangerous pitfalls are:

1. **teacherAssignment schema will reject import-created records** — the schema requires `day`, `time`, and `duration` as mandatory fields, but Ministry files only have the teacher name. Creating records without these fields fails Joi validation silently in the wrong path.
2. **importProgress creation bypasses the full student service path** — `executeStudentImport` writes directly to MongoDB without going through `addStudent()`, so the instrumentProgress primary-instrument guard and schoolYear enrollment do not run.
3. **Teacher name matching has no fallback for ambiguous Hebrew names** — `matchStudent()` already shows the pattern: multiple matches collapse to first match with a warning. Teacher name matching needs the same treatment but the consequences are worse (wrong teacher gets linked to 1,293 students).
4. **Adding student-specific preview UI to ImportData.tsx will break teacher preview** — the tab switching resets state but the preview data shape differs between teacher and student imports. The existing `getTeacherRowDetails()` function accesses `row.instruments`, `row.roles`, `row.teachingHours` — the student rows have none of these.

---

## Critical Pitfalls

Mistakes that cause data loss, validation failures, or require architectural rework.

### Pitfall 1: teacherAssignment Schema Requires Fields Ministry Files Cannot Provide

**What goes wrong:**
Developer reads `STUDENT_COLUMN_MAP` and sees `'המורה': 'teacherName'` — the teacher name column is already parsed. They resolve the teacher name to a teacher `_id`, then try to insert a `teacherAssignment` record. Joi validation in `student-assignments.validation.js` immediately rejects the record because `day`, `time`, and `duration` are all `required()` with no defaults.

```javascript
// student-assignments.validation.js (lines 72-94) — these are REQUIRED:
day: Joi.string().valid(...VALID_DAYS).required(),
time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
duration: Joi.number().valid(...VALID_DURATIONS).required(),
```

Ministry files contain: teacher name, instrument, class, study years, lesson duration (as weekly hours). They do NOT contain: lesson day, lesson start time. The schema will never pass without these fields.

**Why it happens:**
The `teacherAssignment` schema was designed for the interactive schedule builder where all fields are selected by the user. Import data from Ministry files is fundamentally incomplete for this schema. The schema's strictness is correct for the UI path but blocks the import path entirely.

**Consequences:**
- All attempts to create `teacherAssignment` records during import silently fail (if done through `addStudent`) or throw Joi validation errors (if done through the update path)
- Developer wastes time debugging why the insert doesn't take
- If developer bypasses validation and inserts raw docs, the `validateTeacherAssignmentsWithDB` function in `student.service.js` will later reject them or apply fixes that corrupt the intent
- Teacher-student relationship is never created despite import appearing to succeed

**Detection:**
- `validateTeacherAssignmentsWithDB` logs `VALIDATION_ERROR` for missing `day`/`time`/`duration`
- MongoDB writes succeed but the stored documents have null/undefined for required fields
- Teacher's `teaching.timeBlocks` does not contain the imported student (no bidirectional sync happened)

**Prevention:**
Two viable approaches (choose one before writing any code):

**Approach A: Deferred Linking (Recommended)**
Do not create `teacherAssignment` records during import. Instead:
1. Store `teacherName` as a separate field on the student doc: `academicInfo.importedTeacherName`
2. After import, show a "Link Teachers" UI step where the admin confirms/specifies the schedule details
3. This makes the import correct and complete; teacher linking happens as a second deliberate step

**Approach B: Soft Assignment (Import-Only Schema)**
1. Create a separate schema for import-created teacher associations: `{ teacherId, source: 'import', importedAt, isScheduled: false }`
2. Store in a different field than `teacherAssignments` (e.g., `pendingTeacherLinks`)
3. These are NOT validated by `validateTeacherAssignmentsWithDB` and do NOT trigger the sync path in `student.service.js`
4. Displayed in the UI as "unscheduled links" until the teacher confirms schedule details

**Approach C: Placeholder Values (Fragile, not recommended)**
Fill `day`/'time'/'duration' with placeholder values. This creates garbage data in the schedule system and causes `addSchoolYearToRequest` and the hours calculation to produce wrong results.

**Which phase should address it:** Phase 1 of this milestone — this architectural decision must be made before writing any import code that touches teacher linking.

---

### Pitfall 2: executeStudentImport Bypasses addStudent(), Missing Critical Side Effects

**What goes wrong:**
`executeStudentImport` in `import.service.js` (lines 1788-1823) inserts new student documents directly via `studentCollection.insertOne(newStudent)`. This bypasses `addStudent()` in `student.service.js`, which means these side effects do NOT run for imported students:

1. **schoolYear enrollment** — `addStudent()` lines 131-152 auto-enrolls the student in the current school year. Direct insert skips this entirely. Imported students have no `enrollments.schoolYears` entry.
2. **instrumentProgress isPrimary guard** — `addStudent()` lines 122-128 ensures one instrument has `isPrimary: true`. Direct insert does not run this guard.
3. **Teacher assignment sync** — `addStudent()` lines 171-188 syncs teacher records when `teacherAssignments` are populated at creation time.
4. **Joi schema defaults** — `validateStudent()` applies Joi defaults (empty arrays for `enrollments`, etc.). Direct insert does not run Joi, so defaults are not applied.

**Why it happens:**
The existing `executeStudentImport` was written to be fast and simple. It bypasses the service layer intentionally to avoid the complexity of `addStudent`. But adding instrumentProgress creation and teacher linking to the import requires the side effects that only exist in the service layer.

**Consequences:**
- Imported students do not appear in the current school year's student list until manually enrolled
- Queries filtering by `enrollments.schoolYears.schoolYearId` exclude all imported students
- If `instrumentProgress` is created during import without the isPrimary guard, the export service (`export.service.js` lines 120-127) cannot find the primary instrument and returns null for that student's instrument in Ministry reports
- `hours_summary` calculations that depend on school year enrollment produce wrong results for imported students

**Detection:**
- After import, query: `db.student.find({ 'enrollments.schoolYears': { $exists: false } })` — this returns all improperly imported students
- The student list filtered by current school year does not show newly imported students
- Export to Ministry format shows blank instrument columns for imported students

**Prevention:**
Two options:
1. **Route through `addStudent()`**: Build the full student object and call `addStudent(studentToAdd, null, true, options)` (isAdmin=true skips permission checks). This gets all side effects for free. Slower but correct.
2. **Replicate the side effects in executeStudentImport**: Explicitly run `schoolYearService.getCurrentSchoolYear()`, build the `enrollments.schoolYears` array, enforce `isPrimary` on instrumentProgress, and call the school year enrollment step. This is a maintenance burden — every future `addStudent` side effect must be mirrored here.

Option 1 is strongly recommended because the service layer is the canonical place for business logic.

**Which phase should address it:** Immediately — this affects the correctness of every student created by the import, not just those with teacher links or instrument progress.

---

### Pitfall 3: studentSchema Requires instrumentProgress at Creation Time

**What goes wrong:**
Developer looks at the import flow and sees `newStudent.academicInfo.instrument` being set (line 1799). They assume this is sufficient. But the canonical `studentSchema` in `student.validation.js` requires `academicInfo.instrumentProgress` as an array with at least one entry (`min(1).required()`), and each entry requires `instrumentName` (one of `VALID_INSTRUMENTS`) and `currentStage` (one of `VALID_STAGES`: 1-8).

Ministry files have:
- `instrument` (a text string, e.g., "כינור") — already parsed into `mapped.instrument`
- `ministryStageLevel` (א, ב, or ג) — already parsed into `mapped.ministryStageLevel`

Ministry files do NOT have:
- `currentStage` as a number (1-8)

The import service bypasses `addStudent()` and builds `newStudent` directly, so Joi validation doesn't run and the missing `instrumentProgress` doesn't surface as an error — it's silently absent. But the downstream code (export, teacher-lessons aggregation, data-integrity service) all assume `instrumentProgress` exists.

**Why it happens:**
The import was written before `instrumentProgress` became required. The `newStudent` object built in `executeStudentImport` (lines 1789-1815) does not include `instrumentProgress` at all. The `academicInfo.instrument` field is a legacy flat field; `instrumentProgress` is the current source of truth.

**Consequences:**
- `data-integrity.service.js` line 16 flags all imported students as invalid: `requiredFields: ['academicInfo.instrumentProgress']`
- `export.service.js` lines 120-127 calls `instrumentProgress.find(p => p.isPrimary) || instrumentProgress[0]` — on an empty/absent array, this returns undefined, producing blank instrument cells in Ministry export
- `teacher-lessons.service.js` lines 111-113 does a `$filter` on `instrumentProgress` — absent array causes the aggregation to return null for the instrument name

**Detection:**
- Data integrity check returns "missing required field: instrumentProgress" for all imported students
- Ministry export shows empty instrument column for all imported students
- `db.student.find({ 'academicInfo.instrumentProgress': { $exists: false } })` returns non-empty result set after import

**Prevention:**
When building the new student document during import:

```javascript
// Map ministryStageLevel → currentStage
const MINISTRY_STAGE_TO_CURRENT = {
  'א': 1,  // Ministry level aleph → internal stage 1 (beginning)
  'ב': 3,  // Ministry level bet → internal stage 3 (intermediate)
  'ג': 6,  // Ministry level gimel → internal stage 6 (advanced)
};

// Build instrumentProgress if instrument is known
if (mapped.instrument && VALID_INSTRUMENTS.includes(mapped.instrument)) {
  newStudent.academicInfo.instrumentProgress = [{
    instrumentName: mapped.instrument,
    isPrimary: true,
    currentStage: MINISTRY_STAGE_TO_CURRENT[mapped.ministryStageLevel] || 1,
    ministryStageLevel: mapped.ministryStageLevel || null,
    tests: {},
  }];
} else {
  // Student has no known instrument — cannot create instrumentProgress
  // Log a warning; the student will fail data integrity checks
  warnings.push({ row: entry.row, field: 'instrumentProgress', message: 'כלי נגינה לא ידוע — אין instrumentProgress' });
}
```

The mapping from ministryStageLevel to currentStage is a business decision. The specific numbers (1, 3, 6) above are a reasonable default but must be confirmed with domain experts. Document this mapping explicitly in code comments.

**Which phase should address it:** Same phase as instrumentProgress creation.

---

### Pitfall 4: Hebrew Name Matching Returns Wrong Teacher When Name is Common

**What goes wrong:**
`matchStudent()` already demonstrates the pattern: when multiple students match the same name, it takes `matches[0]` and adds a `name_duplicate` warning. For students this is acceptable because they are being updated, not created as a relationship. For teacher-student linking, taking the wrong teacher silently links all ~1,293 students to the wrong instructor.

Common Israeli music teacher first names (שרה, מיכל, דוד, יוסי) combined with common last names create real ambiguity. Ministry files have one "המורה" column with the teacher's full name as typed by a Ministry clerk — not normalized, not matching the internal `firstName`/`lastName` split.

**Why it happens:**
The existing `matchTeacher()` function (lines 1079-1110) does exact-match by `firstName.toLowerCase() + lastName.toLowerCase()` after splitting a full name on whitespace. This means:
- "שרה כהן" splits to firstName="שרה", lastName="כהן"
- If the teacher is stored as firstName="שרה" lastName="כהן הלוי" → no match
- If there are two teachers named "דוד לוי" → always matches the first one found in the DB query result (indeterminate order)

Additionally, the Ministry file may write the teacher's name in reverse order (family name first in some layouts) or with a middle name or initials.

**Consequences:**
- 50-100 students silently linked to the wrong teacher
- Wrong teacher gets visibility into students' records (`_studentAccessIds` is built from `teacherAssignments`)
- Correct teacher has no access to their own students in the system
- No error or warning is raised because the match appears successful

**Detection:**
- After import, run: `db.student.aggregate([{ $unwind: '$teacherAssignments' }, { $group: { _id: '$teacherAssignments.teacherId', count: { $sum: 1 } } }, { $sort: { count: -1 } }])` — a teacher with an unusually high count is a sign of false matches
- Teachers report seeing students they do not know
- Students report missing teachers in their profile

**Prevention:**
1. **Exact match only, report unresolved as warnings** — never silently take `matches[0]` when multiple exist; surface them as unresolved requiring manual review
2. **Show teacher match quality in preview** — for each student row with a teacher name, show: "Matched to [Teacher Name] (exact)" or "Ambiguous — 2 teachers with this name, manual assignment needed"
3. **Normalize before matching**:
   - Strip leading/trailing whitespace and invisible RTL/LTR marks (the codebase already does `replace(/[\u200F\u200E\uFEFF\u200B]/g, '')` — apply this to teacher names too)
   - Try both orderings: "שם משפחה" first and "שם פרטי" first
   - Compare against `personalInfo.firstName + ' ' + personalInfo.lastName` AND `personalInfo.lastName + ' ' + personalInfo.firstName`
4. **Never store a teacherAssignment based on an ambiguous match** — flag as unresolved

**Which phase should address it:** Teacher matching phase, before any teacher-student linking is written.

---

## Moderate Pitfalls

Mistakes that cause bugs, poor UX, or significant rework but are recoverable.

### Pitfall 5: ImportData.tsx Tab Switch Assumes Symmetric Preview Data Shape

**What goes wrong:**
The existing preview state in `ImportData.tsx` is a single `previewData` state variable. Teacher import preview rows have `row.instruments`, `row.roles`, `row.teachingHours`, `row.teachingSubjects`. Student import preview rows have `row.mapped`, `row.changes`, `row.duplicateCount`. The `allPreviewRows` array merges matched/notFound/errors and sorts by row number.

When adding student-specific preview details (instrument detected, teacher name matched, stage level), developers add new fields to the student row shape. If these fields overlap with teacher-specific field names (e.g., adding `row.instruments` to student rows to show detected instruments), the teacher preview `getTeacherRowDetails()` function will accidentally render student instrument data in teacher rows when the tab is teachers.

**Why it happens:**
The `activeTab` state determines which detail renderer is called, but `resetState()` clears `previewData` on tab change. The risk is during development when a developer tests one tab and forgets the other. The shapes are similar enough that TypeScript won't catch the collision (both use `any[]` for preview arrays).

**Consequences:**
- Teacher import preview shows wrong field labels or data from previous student import state
- Student import preview renders nothing for the "changes" column because `getTeacherRowDetails()` looks for `row.changes` in a format it doesn't recognize

**Detection:**
- Switch from student tab to teacher tab without resetting — check if teacher preview renders correctly
- Verify `resetState()` is called on every tab change (it is, at line 454-457, but only if the tab actually changes)

**Prevention:**
1. Keep preview data shapes explicitly separate — define separate TypeScript interfaces for `TeacherPreviewRow` and `StudentPreviewRow`
2. Guard all field accesses with `activeTab` checks, not just the top-level renderer
3. Add a TypeScript discriminated union for preview rows: `{ type: 'teacher'; ...teacherFields } | { type: 'student'; ...studentFields }`
4. For the student detail renderer, create a separate `getStudentRowDetails()` function analogous to `getTeacherRowDetails()` — do not add student-specific cases into `getTeacherRowDetails()`

**Which phase should address it:** Frontend preview enhancement phase. Must be done before adding any student-specific preview fields.

---

### Pitfall 6: previewStudentImport Passes Wrong headerColMap to detectInstrumentColumns

**What goes wrong:**
Line 1490-1491 of `import.service.js`:

```javascript
const headers = Object.keys(rows[0]);  // <-- headers from first ROW, not from parsed header row
const instrumentColumns = detectInstrumentColumns(headers);  // <-- no headerColMap passed
```

`detectInstrumentColumns` has a two-argument signature: `detectInstrumentColumns(headers, headerColMap)`. Without `headerColMap`, the `colIndex < instrumentSectionStart` threshold check cannot work — `colIndex` will always be `undefined`, and the instrument section start detection will fail silently.

Meanwhile, the teacher import path at line 1443 correctly passes both arguments: `detectInstrumentColumns(parsedHeaders, headerColMap)`.

This is an existing bug in the current code that will become more impactful when instrument columns are used for `instrumentProgress` creation (currently the bug means instruments may be mis-detected, but the `academicInfo.instrument` field is set anyway — once instrumentProgress depends on this, the miss rate matters more).

**Why it happens:**
The student import was added after the teacher import path and the `detectInstrumentColumns` function signature was updated. The student path was not updated to pass `headerColMap`.

**Consequences:**
- Instrument columns that appear before column 24 (the old hardcoded threshold) may be incorrectly classified
- Students whose instrument is detected via department column rather than specific instrument column may get wrong instruments
- `instrumentProgress` created from a mis-detected instrument name fails the `instrumentProgressSchema` validation (`.valid(...VALID_INSTRUMENTS)`) — the entire student insert fails

**Detection:**
- Upload a student Ministry file with instruments in columns before position 24
- Check the `warnings` array for "כלי לא מוכר" warnings — these indicate a mis-detected instrument name

**Prevention:**
Fix the existing bug before adding instrumentProgress creation:

```javascript
// Replace lines 1490-1491 with:
const headers = Object.keys(rows[0]);
const instrumentColumns = detectInstrumentColumns(headers, headerColMap);  // pass headerColMap
```

This is a one-line fix but it must be validated before building instrumentProgress creation on top of it.

**Which phase should address it:** Before instrumentProgress creation (bug fix prerequisite).

---

### Pitfall 7: import_log Stores importType='students' but Does Not Store Teacher Match Results

**What goes wrong:**
The `import_log` document saved during `previewStudentImport` stores the full `preview` object including `preview.matched` and `preview.notFound`. When `executeStudentImport` runs later, it reads the preview from `import_log` and processes it.

If teacher matching is added to the preview phase (resolving "המורה" to a teacher `_id`), the teacher `_id` must be stored in `preview.matched[].mapped.teacherId` or a similar field within the `import_log` document. If not, `executeStudentImport` has no way to know which teacher was matched without re-running the matching logic against the live teacher collection — which may produce different results if teachers were added/removed between preview and execute.

**Why it happens:**
The current preview stores `mapped.teacherName` (the raw text from the file) but not the resolved `teacherId`. This is fine today because teacher linking is not implemented. Once teacher matching is added to the preview phase, the result must be persisted.

**Consequences:**
- Preview shows "Matched to דוד לוי (שם מלא)" but execute re-runs matching and now matches a different teacher
- Two different teachers get linked depending on the timing of execute relative to preview
- Execute tries to create a `teacherAssignment` with `teacherId = null` because the match is not re-run

**Prevention:**
Store teacher match results in the `import_log` preview:

```javascript
// In preview.matched[] and preview.notFound[] entries:
{
  ...existingFields,
  teacherMatch: {
    teacherId: resolvedTeacher._id.toString(),
    teacherName: `${resolvedTeacher.personalInfo.firstName} ${resolvedTeacher.personalInfo.lastName}`,
    matchType: 'exact' | 'ambiguous' | 'not_found',
    ambiguousOptions: []  // filled when matchType === 'ambiguous'
  }
}
```

`executeStudentImport` reads `entry.teacherMatch.teacherId` directly rather than re-running matching.

**Which phase should address it:** Teacher matching phase, when the preview data shape is extended.

---

### Pitfall 8: Bagrut Flag Requires a Separate Collection Write — Not Just a Student Field

**What goes wrong:**
Developer sees `student.academicInfo.tests.bagrutId` and assumes bagrut flagging means setting `bagrutId: 'flagged'` or `bagrutId: true` on the student document. But examining `bagrut.service.js` reveals that:

1. `addBagrut()` inserts a full document in the `bagrut` collection (line 124)
2. It then calls `studentService.setBagrutId()` to set `student.academicInfo.tests.bagrutId` to the `bagrut._id` (line 128)
3. The `setBagrutId` function updates the student record with the ObjectId of the bagrut document

Creating a bagrut record during import requires creating TWO documents atomically: the bagrut document and the student reference update. If only the student's `bagrutId` field is set (without creating the bagrut document), every subsequent call to `getBagrutByStudentId()` returns `null` despite `bagrutId` being set.

Additionally, `addBagrut()` checks for duplicate bagrut records: `collection.findOne({ studentId: value.studentId, isActive: true, tenantId })`. If import runs twice, the second run will find the existing bagrut and throw `'Bagrut for student X already exists'`.

**Why it happens:**
Bagrut is a complex entity with its own lifecycle (presentations, grading, program pieces). The import might want to "flag" a student as a bagrut candidate without creating the full bagrut entity. But the system has no "draft" or "flagged" state — it either exists or it does not.

**Prevention:**
Three clean approaches:
1. **Do not create bagrut records during import** — instead, set a flag field: `student.academicInfo.isBagrutCandidate: true` (requires adding this field to the schema). Admins then create the bagrut record explicitly.
2. **Create a minimal stub bagrut record** — call `bagrutService.addBagrut({ studentId, tenantId, ... })` with minimal required fields. Must be done within the same import transaction or with rollback handling.
3. **Use the existing `setBagrutId()` only if a full bagrut already exists** — import does not create bagrut records, only links existing ones.

Option 1 is recommended for import. Bagrut creation should remain a deliberate user action.

**Which phase should address it:** Bagrut flagging phase.

---

### Pitfall 9: Preview Table Renders at Most 50 Rows — Teacher Names Are Not Visible at Scale

**What goes wrong:**
Line 823 of `ImportData.tsx`: `allPreviewRows.slice(0, 50)`. With 1,293 students, 97% of the preview is invisible. When adding teacher name match status to the preview (showing which students have resolved/unresolved/ambiguous teacher matches), the admin cannot see most of the matching results.

The teacher ambiguity warnings are currently rendered in the `warnings` array displayed above the table, but the warnings only show `row` numbers — not student names. With 1,293 rows and 50 visible, it is impossible to review teacher assignments in the current UI.

**Why it happens:**
The 50-row limit was set when import files were small (single-school teacher lists, ~30-50 teachers). Student Ministry files have up to 1,293 rows.

**Prevention:**
1. Add a summary section above the table specifically for teacher matching: "392 students matched to teachers / 45 unresolved / 3 ambiguous"
2. Add filter tabs to the preview table: "All | Teacher resolved | Unresolved | Ambiguous" — this lets admins focus on problem rows without removing the 50-row limit entirely
3. Optionally paginate the preview table rather than hard-limiting to 50 rows
4. Show teacher match status in the existing preview column ("שינויים / הערות") for student rows — a compact one-liner like "כלי: כינור | מורה: דוד לוי" or "מורה: לא נמצא"

**Which phase should address it:** Preview enhancement phase.

---

## Minor Pitfalls

Issues that cause friction but are easy to fix once identified.

### Pitfall 10: ministryStageLevel → currentStage Mapping Is a Business Rule, Not a Technical Rule

**What goes wrong:**
Ministry stages א/ב/ג do not have a canonical mapping to the internal stages 1-8. Different conservatories may interpret the mapping differently. Hardcoding the mapping in `import.service.js` without documenting it creates invisible business logic that will be questioned by every new admin who notices that "stage ג = 6" rather than "stage ג = 7 or 8".

**Prevention:**
1. Add the mapping as a named constant with a comment explaining the convention:
   ```javascript
   // Ministry levels: א (beginning, year 1-2) → stage 1
   //                  ב (intermediate, year 3-4) → stage 3
   //                  ג (advanced, year 5+) → stage 6
   // These are heuristic defaults; individual student stages should be reviewed after import
   const MINISTRY_STAGE_TO_INTERNAL_STAGE = { 'א': 1, 'ב': 3, 'ג': 6 };
   ```
2. Surface the mapped stage in the preview: "שלב: ג → שלב פנימי: 6 (ניתן לשינוי אחרי ייבוא)"
3. Do NOT use `studyYears` to derive stage — there is no reliable formula

**Which phase should address it:** instrumentProgress creation phase.

---

### Pitfall 11: Duplicate Teacher Name in Import File Matches Same Teacher Twice

**What goes wrong:**
If a teacher appears in two student rows with the same name but is only found once in the DB, the matcher returns the same teacher `_id` twice. This is correct behavior. But if the teacher's name is spelled differently in two rows ("דוד לוי" and "ד. לוי"), one match succeeds and the other fails. No warning is raised for the failed match, leaving some students without a teacher link while others in the same cohort are linked.

**Prevention:**
After teacher matching, group unresolved teacher names: if "ד. לוי" appears 30 times and all 30 are unresolved, surface this as a single actionable item in the preview: "30 students list 'ד. לוי' as teacher — no match found. Did you mean 'דוד לוי'?"

This requires a name-frequency analysis pass in the preview, not individual row processing.

**Which phase should address it:** Teacher matching phase.

---

### Pitfall 12: Updating Existing Students During Import Overwrites academicInfo.instrument But Not instrumentProgress

**What goes wrong:**
The current `calculateStudentChanges()` (lines 1311-1329) diffs `studyYears`, `extraHour`, and `class`. It does NOT diff `instrument` or `instrumentProgress`. When an existing student is matched during import, the instrument column in the Ministry file is ignored for updates.

If instrumentProgress creation is added for new student creation but not for updates, existing students will have mismatched `academicInfo.instrument` (updated flat field from previous imports) and `instrumentProgress` (never updated from import). Over time the two fields diverge.

**Prevention:**
Decide explicitly: should import update `instrumentProgress` for existing students? If yes, add it to `calculateStudentChanges()`. If no, document this limitation in the preview UI: "כלי נגינה ושלב לא מתעדכנים עבור תלמידים קיימים".

**Which phase should address it:** instrumentProgress creation phase, when the decision about updates vs creates is made.

---

### Pitfall 13: The 'המורה' Column Is in Both TEACHER_COLUMN_MAP and STUDENT_COLUMN_MAP with Different Mappings

**What goes wrong:**
In `import.service.js`:

```javascript
// TEACHER_COLUMN_MAP line 107:
'המורה': 'fullName',   // teacher sheet: this is the TEACHER'S own full name

// STUDENT_COLUMN_MAP line 130:
'המורה': 'teacherName',  // student sheet: this is the STUDENT'S teacher's name
```

These are different fields with the same Hebrew column header. The parser selects the correct map based on which import function is called (`previewTeacherImport` vs `previewStudentImport`). If someone accidentally calls the wrong function (or the route passes the wrong import type), teacher names in the student file will be parsed as the student's own name and vice versa.

**Prevention:**
This is already correctly handled by the two separate column maps. The risk is during testing: if a developer uploads a teacher file to the student endpoint or vice versa, the error messages will be confusing. Add a validation check at parse time: if `importType === 'students'` and the parsed header row contains "מספר זהות" (an ID number — a teacher file indicator), warn that the wrong file type may have been uploaded.

**Which phase should address it:** Import type validation — a quick defensive check, can be added any time.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Teacher name matching | No fuzzy matching; ambiguous names silently match first result (Pitfall 4) | CRITICAL | Exact match only; surface ambiguous and unresolved as errors requiring manual review |
| teacherAssignment creation | Schema requires day/time/duration missing from Ministry files (Pitfall 1) | CRITICAL | Use deferred linking or soft assignment; do NOT try to satisfy the full schema at import time |
| instrumentProgress creation | Bypassing addStudent() loses schoolYear enrollment and isPrimary guard (Pitfall 2) | HIGH | Route through addStudent() with isAdmin=true; or replicate side effects explicitly |
| instrumentProgress creation | Validation requires instrumentName in VALID_INSTRUMENTS and currentStage 1-8 (Pitfall 3) | HIGH | Map ministryStageLevel → currentStage with documented constants; skip instrumentProgress if instrument unknown |
| instrumentProgress creation | detectInstrumentColumns missing headerColMap in student path (Pitfall 6) | HIGH | Fix one-line bug before building on top of instrument detection |
| ministryStageLevel mapping | Arbitrary business rule hardcoded silently (Pitfall 10) | MODERATE | Named constant with comment; surface mapped stage in preview |
| Bagrut flagging | Bagrut requires two-document atomic write; no "flag" state exists (Pitfall 8) | MODERATE | Use isBagrutCandidate field instead; defer bagrut creation to explicit user action |
| Preview enhancement | Teacher preview data shape collides with student preview fields (Pitfall 5) | MODERATE | Separate TypeScript interfaces; separate renderer functions |
| Preview enhancement | 50-row preview limit hides most of 1,293-student teacher match results (Pitfall 9) | MODERATE | Add summary stats and filter tabs for teacher match status |
| import_log persistence | Teacher match results not stored; re-matching on execute may differ (Pitfall 7) | MODERATE | Store teacherMatch.teacherId in preview data in import_log |
| Existing student updates | instrument update vs instrumentProgress update inconsistency (Pitfall 12) | LOW | Decide policy explicitly; document in preview UI if instrumentProgress not updated |
| Import type safety | 'המורה' header means different things in teacher vs student maps (Pitfall 13) | LOW | Defensive file type check at parse time |
| Name frequency | Multiple rows with same unresolved teacher name produce 1 useful warning, not N (Pitfall 11) | LOW | Frequency analysis pass on unresolved teacher names |

---

## Integration Risk Matrix

How the new features interact with each other and the existing system.

| Feature A | Feature B | Compound Risk | Severity |
|-----------|-----------|---------------|----------|
| Teacher name matching | teacherAssignment creation | Teacher is found by name but assignment cannot be created due to schema validation — ambiguous success in preview, silent failure in execute | CRITICAL |
| instrumentProgress creation | executeStudentImport bypass of addStudent | instrumentProgress is created but schoolYear enrollment is not — student cannot be found by school year filters | HIGH |
| instrumentProgress creation | detectInstrumentColumns bug | Instrument detected incorrectly → instrumentProgress.instrumentName not in VALID_INSTRUMENTS → insert fails | HIGH |
| Teacher matching at preview | import_log persistence | Teacher resolved at preview time but teacherId not stored → execute re-matches differently or fails | HIGH |
| Bagrut flagging | existing bagrut check in addBagrut | Re-importing same file creates duplicate bagrut records or throws error on second run | MODERATE |
| Preview enhancement | 50-row table limit | Teacher match quality summary is correct but individual row review impossible at 1,293 rows | MODERATE |
| ministryStageLevel mapping | instrumentProgress validation | Stage mapping produces value outside VALID_STAGES → Joi rejects the instrumentProgress entry | MODERATE |

---

## Sources

- Direct codebase analysis:
  - `api/import/import.service.js` — full 1,947-line import service (both strategy paths, student and teacher)
  - `api/student/student.validation.js` — `instrumentProgressSchema`, `teacherAssignmentSchema`, `studentSchema` (Joi structure)
  - `api/student/student-assignments.validation.js` — `validateTeacherAssignmentsWithDB` with DB consistency checks
  - `api/student/student.service.js` — `addStudent()` side effects (schoolYear, isPrimary, sync)
  - `api/bagrut/bagrut.service.js` — two-document write pattern for bagrut creation
  - `src/pages/ImportData.tsx` — 962-line frontend, preview data shape, 50-row limit, tab switching
- Pattern: direct insert vs service layer side effects — common source of missing business logic in import pipelines
- Confidence for all findings: HIGH (all claims traceable to specific line numbers in production code)
