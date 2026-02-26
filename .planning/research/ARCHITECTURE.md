# Architecture Patterns: Enhanced Student Import

**Domain:** Ministry of Education Excel import for music school student data
**Researched:** 2026-02-26
**Milestone:** Enhanced student import (teacher matching, instrumentProgress, bagrut flag, frontend preview parity)
**Confidence:** HIGH (direct codebase analysis — all integration points verified from source)

---

## System Context: What Already Exists

The student import pipeline is fully operational. The changes are **targeted enhancements to an existing 1900-line service**, not a new system.

### Existing Flow (Do Not Break)

```
POST /import/students/preview
  |
  v
multer.memoryStorage() — file never touches disk
  |
  v
importService.previewStudentImport(buffer, { context })
  |
  +---> parseExcelBufferWithHeaderDetection(buffer, STUDENT_COLUMN_MAP)
  |       |
  |       +---> Multi-row Hebrew header detection
  |       +---> Returns: { rows, cellRows, headerColMap, headerRowIndex, matchedColumns }
  |
  +---> detectInstrumentColumns(headers)
  +---> mapColumns(row, STUDENT_COLUMN_MAP)  — maps Hebrew headers to internal keys
  +---> validateStudentRow(mapped, rowIndex)  — validates, coerces types, splits fullName
  +---> matchStudent(mapped, students)        — name-only match (firstName + lastName)
  +---> calculateStudentChanges(student, mapped) — diff: class, studyYears, extraHour only
  |
  +---> importLogCollection.insertOne({ importType: 'students', preview, status: 'pending' })
  |
  v
{ importLogId, preview: { matched, notFound, errors, warnings, headerRowIndex, matchedColumns } }

POST /import/execute/:importLogId
  |
  v
importService.executeImport(importLogId, userId, { context })
  |
  v
executeStudentImport(log, ...)
  |
  +---> For matched entries: $set flat fields (class, studyYears, extraHour) via change.field paths
  +---> For notFound entries: insertOne minimal student document
  |       (personalInfo, academicInfo: { class, studyYears, extraHour, instrument, age })
  v
{ totalRows, matchedCount, successCount, createdCount, errorCount, skippedCount, errors }
```

### Current STUDENT_COLUMN_MAP (confirmed from source)

```javascript
'המורה': 'teacherName',        // EXISTS — parsed but UNUSED in matching/storage
'שלב': 'ministryStageLevel',   // EXISTS — validated but stored as flat field, not in instrumentProgress
'כלי': 'instrument',           // EXISTS — flat single instrument, not instrumentProgress array
'כלי נגינה': 'instrument',     // EXISTS
```

The `teacherName` key is already extracted from the "המורה" column but never used beyond being stored in the import log. `ministryStageLevel` is validated but written to `academicInfo.ministryStageLevel` (flat), not into `instrumentProgress[].ministryStageLevel`.

---

## Integration Point 1: Teacher Matching ("המורה" Column)

### Current State

`mapped.teacherName` is populated in `previewStudentImport` via `STUDENT_COLUMN_MAP['המורה'] = 'teacherName'`, but the existing `calculateStudentChanges()` and `executeStudentImport()` ignore it entirely. The teacher collection is not queried during student import.

### Target State

When `mapped.teacherName` exists, resolve it to a `teacherId` from the `teacher` collection using name-matching. On execute, create a `teacherAssignment` object on the student document via `$push`.

### Exact Integration Points

**File:** `api/import/import.service.js`

**1. New function `matchTeacherByName(teacherName, teachers)` (NEW — ~20 lines)**

Location: alongside existing `matchTeacher()` and `matchStudent()` functions (~line 1079).

```javascript
// Strategy: split "שם מלא" string → firstName + lastName, then case-insensitive match.
// Same split logic as validateStudentRow fullName split (space-delimited, first word = firstName).
function matchTeacherByName(teacherName, teachers) {
  if (!teacherName) return null;
  const parts = teacherName.trim().split(/\s+/);
  if (parts.length < 2) return null;           // Cannot match without both name parts
  const fn = parts[0].toLowerCase();
  const ln = parts.slice(1).join(' ').toLowerCase();
  const match = teachers.find(
    (t) =>
      (t.personalInfo?.firstName || '').trim().toLowerCase() === fn &&
      (t.personalInfo?.lastName || '').trim().toLowerCase() === ln
  );
  return match ? { teacher: match, matchType: 'name' } : null;
}
```

**2. Load teacher collection in `previewStudentImport()` (MODIFY — ~3 lines)**

Currently only loads students:
```javascript
const students = await studentCollection.find(filter).toArray();
```

Add after that line:
```javascript
const teacherCollection = await getCollection('teacher');
const teachers = await teacherCollection.find({ isActive: true, tenantId }).toArray();
```

**3. Call `matchTeacherByName()` in the preview loop (MODIFY — ~15 lines)**

Inside the per-row loop in `previewStudentImport()`, after `mapColumns()`:
```javascript
let matchedTeacher = null;
if (mapped.teacherName) {
  const teacherMatch = matchTeacherByName(mapped.teacherName, teachers);
  if (teacherMatch) {
    mapped.resolvedTeacherId = teacherMatch.teacher._id.toString();
    matchedTeacher = teacherMatch.teacher;
  } else {
    preview.warnings.push({
      row: i + 2,
      field: 'teacherName',
      message: `מורה לא נמצא: "${mapped.teacherName}"`,
    });
  }
}
```

Store `resolvedTeacherId` in the `matched` / `notFound` preview entries so execute has it.

**4. `calculateStudentChanges()` — add teacher assignment diff (MODIFY — ~15 lines)**

Currently only diffs: `studyYears`, `extraHour`, `class`. Add:
```javascript
// Teacher assignment diff
if (mapped.resolvedTeacherId) {
  const hasExistingAssignment = (student.teacherAssignments || []).some(
    (a) => a.teacherId === mapped.resolvedTeacherId && a.isActive
  );
  if (!hasExistingAssignment) {
    changes.push({
      field: 'teacherAssignment',
      newValue: mapped.resolvedTeacherId,
      action: 'add',
    });
  }
}
```

**5. `executeStudentImport()` — write teacherAssignment (MODIFY — ~25 lines)**

**For matched students** (inside the existing `for (const entry of matched)` loop):
```javascript
const teacherAssignmentChange = (entry.changes || []).find(
  (c) => c.field === 'teacherAssignment' && c.action === 'add'
);
if (teacherAssignmentChange) {
  const newAssignment = {
    teacherId: teacherAssignmentChange.newValue,
    scheduleSlotId: null,
    startDate: new Date(),
    endDate: null,
    isActive: true,
    notes: 'ייבוא ממשרד החינוך',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await studentCollection.updateOne(
    { _id: ObjectId.createFromHexString(entry.studentId), tenantId },
    { $push: { teacherAssignments: newAssignment } }
  );
}
```

**For new students** (inside the existing `for (const entry of notFound)` loop), during `insertOne`:
```javascript
// Add to newStudent construction:
if (mapped.resolvedTeacherId) {
  newStudent.teacherAssignments = [{
    teacherId: mapped.resolvedTeacherId,
    scheduleSlotId: null,
    startDate: new Date(),
    endDate: null,
    isActive: true,
    notes: 'ייבוא ממשרד החינוך',
    createdAt: new Date(),
    updatedAt: new Date(),
  }];
} else {
  newStudent.teacherAssignments = [];
}
```

### Data Flow: Teacher Matching

```
Excel row: "המורה" = "יונה אברהם"
  |
  v
STUDENT_COLUMN_MAP['המורה'] = 'teacherName'  (already exists)
mapped.teacherName = "יונה אברהם"
  |
  v
matchTeacherByName("יונה אברהם", teachers)
  → split → firstName="יונה", lastName="אברהם"
  → case-insensitive find in teacher collection
  → returns { teacher: { _id: ObjectId("..."), ... }, matchType: 'name' }
  |
  v
mapped.resolvedTeacherId = teacher._id.toString()
(stored in preview entry)
  |
  v  [on execute]
$push teacherAssignments: { teacherId: resolvedTeacherId, isActive: true, ... }
```

### Constraint: teacherAssignment Validation Schema

The full `teacherAssignmentSchema` in `student.validation.js` requires `day`, `time`, `duration` — these are NOT present in Excel import data. The import bypasses Joi validation and writes directly to MongoDB via `updateOne`/`insertOne`. The assignment shape used by `student.service.js` in `addStudentTeacherAssociation()` (lines 743-753) omits `day/time/duration` when creating from the service layer, which sets a precedent for partial assignment creation. Import should follow the same minimal shape.

---

## Integration Point 2: InstrumentProgress Array

### Current State

`mapped.instrument` (single string) is stored as `academicInfo.instrument` on new students. `mapped.ministryStageLevel` (Ministry level: 'א'/'ב'/'ג') is stored as `academicInfo.ministryStageLevel` (flat). Neither populates `academicInfo.instrumentProgress[]`.

### Target State

When `mapped.instrument` exists for a new student, build an `instrumentProgress` entry. When `mapped.ministryStageLevel` exists, include it in that entry. For matched (existing) students, update the existing `instrumentProgress` entry for that instrument if found, or push a new one.

### Exact Integration Points

**File:** `api/import/import.service.js`

**1. New function `buildInstrumentProgressEntry(instrument, ministryStageLevel)` (NEW — ~20 lines)**

Location: alongside `calculateStudentChanges()` (~line 1311).

```javascript
// Map Ministry stage level (א/ב/ג) → numeric stage range midpoint
// א = stages 1-3 → use 1 (beginning), ב = stages 4-5 → use 4, ג = stages 6-8 → use 6
const MINISTRY_LEVEL_TO_STAGE = { 'א': 1, 'ב': 4, 'ג': 6 };

function buildInstrumentProgressEntry(instrument, ministryStageLevel) {
  return {
    instrumentName: instrument,
    isPrimary: true,
    currentStage: MINISTRY_LEVEL_TO_STAGE[ministryStageLevel] || 1,
    ministryStageLevel: ministryStageLevel || null,
    tests: {
      stageTest: { status: 'לא נבחן' },
      technicalTest: { status: 'לא נבחן' },
    },
  };
}
```

**2. `calculateStudentChanges()` — add instrumentProgress diff (MODIFY — ~25 lines)**

```javascript
// InstrumentProgress diff
if (mapped.instrument && VALID_INSTRUMENTS.includes(mapped.instrument)) {
  const existingEntry = (student.academicInfo?.instrumentProgress || []).find(
    (p) => p.instrumentName === mapped.instrument
  );
  if (!existingEntry) {
    // Instrument not in student's progress — add it
    changes.push({
      field: 'instrumentProgress',
      action: 'add',
      instrument: mapped.instrument,
      ministryStageLevel: mapped.ministryStageLevel || null,
    });
  } else if (mapped.ministryStageLevel && existingEntry.ministryStageLevel !== mapped.ministryStageLevel) {
    // Update ministry stage level on existing entry
    changes.push({
      field: 'instrumentProgress',
      action: 'updateStageLevel',
      instrument: mapped.instrument,
      ministryStageLevel: mapped.ministryStageLevel,
    });
  }
}
```

**3. `executeStudentImport()` — write instrumentProgress (MODIFY — ~30 lines)**

**For matched students:**
```javascript
for (const change of entry.changes) {
  if (change.field === 'instrumentProgress' && change.action === 'add') {
    const newEntry = buildInstrumentProgressEntry(change.instrument, change.ministryStageLevel);
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(entry.studentId), tenantId },
      { $push: { 'academicInfo.instrumentProgress': newEntry } }
    );
  } else if (change.field === 'instrumentProgress' && change.action === 'updateStageLevel') {
    await studentCollection.updateOne(
      {
        _id: ObjectId.createFromHexString(entry.studentId),
        tenantId,
        'academicInfo.instrumentProgress.instrumentName': change.instrument,
      },
      {
        $set: {
          'academicInfo.instrumentProgress.$.ministryStageLevel': change.ministryStageLevel,
          updatedAt: new Date(),
        }
      }
    );
  }
}
```

**For new students** — replace the existing flat `academicInfo.instrument` with the array:
```javascript
// Replace existing:
//   academicInfo: { instrument: mapped.instrument || null, ... }
// With:
academicInfo: {
  class: mapped.class || null,
  studyYears: mapped.studyYears ? parseInt(mapped.studyYears) || 1 : 1,
  extraHour: typeof mapped.extraHour === 'boolean' ? mapped.extraHour : false,
  instrumentProgress: mapped.instrument && VALID_INSTRUMENTS.includes(mapped.instrument)
    ? [buildInstrumentProgressEntry(mapped.instrument, mapped.ministryStageLevel)]
    : [],
  age: mapped.age ? parseInt(mapped.age) || null : null,
  lessonDuration: (mapped.lessonDuration && typeof mapped.lessonDuration === 'number')
    ? mapped.lessonDuration : undefined,
  tests: { bagrutId: null },
},
```

### Constraint: `instrumentProgress.currentStage` is a required field validated by `instrumentProgressSchema`

The Joi schema (`student.validation.js` line 18-19) requires `currentStage` to be one of `VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8]`. The import bypasses Joi but must still write a valid integer. The `MINISTRY_LEVEL_TO_STAGE` map above ensures a valid stage is always set. Do NOT write `null` or `undefined` for `currentStage`.

---

## Integration Point 3: Bagrut Flag ("מגמת מוסיקה" Column)

### Current State

The "מגמת מוסיקה" column exists in the Ministry export (column AA in `students.sheet.js`) but is NOT in `STUDENT_COLUMN_MAP`. The student schema has `academicInfo.tests.bagrutId` (a reference to a bagrut document), not a simple boolean flag. There is no `isMusicMajor` or equivalent boolean field currently on the student document.

### Target State

A "מגמת מוסיקה" column in student import Excel should set a boolean flag `academicInfo.isMusicMajor: true` on the student document. This is a new field — the existing `academicInfo.tests.bagrutId` is a foreign key reference (linking to a bagrut exam document) and is separate from the "is this student in the music track" flag.

### Exact Integration Points

**File:** `api/import/import.service.js`

**1. Add to `STUDENT_COLUMN_MAP` (MODIFY — 1 line)**

```javascript
'מגמת מוסיקה': 'isMusicMajor',
'מגמה': 'isMusicMajor',         // Abbreviated form
```

**2. `validateStudentRow()` — coerce to boolean (MODIFY — ~5 lines)**

```javascript
if (mapped.isMusicMajor !== undefined && mapped.isMusicMajor !== '') {
  mapped.isMusicMajor = TRUTHY_VALUES.includes(mapped.isMusicMajor) ||
    mapped.isMusicMajor === true;
}
```

**3. `calculateStudentChanges()` — add isMusicMajor diff (MODIFY — ~8 lines)**

```javascript
if (mapped.isMusicMajor !== undefined) {
  const current = student.academicInfo?.isMusicMajor ?? false;
  if (Boolean(current) !== Boolean(mapped.isMusicMajor)) {
    changes.push({
      field: 'academicInfo.isMusicMajor',
      oldValue: current,
      newValue: mapped.isMusicMajor,
    });
  }
}
```

The existing `for (const change of entry.changes)` loop in `executeStudentImport()` already handles `updateDoc[change.field] = change.newValue`. Because `academicInfo.isMusicMajor` is a dot-notation MongoDB path, this will write correctly via `$set` with no additional changes to the execute function.

**4. For new students** — add to `newStudent` construction (MODIFY — ~3 lines):

```javascript
if (typeof mapped.isMusicMajor === 'boolean') {
  newStudent.academicInfo.isMusicMajor = mapped.isMusicMajor;
}
```

### Decision: Separate from `bagrutId`

The existing `academicInfo.tests.bagrutId` is a document reference (ObjectId string) to a `bagrut` collection record. "מגמת מוסיקה" is a simpler flag meaning "this student participates in the music track." These are related but distinct concepts. Keeping them separate avoids the complexity of auto-creating bagrut documents during import.

---

## Integration Point 4: Frontend Preview Parity

### Current State

The preview table in `ImportData.tsx` has a **tab-conditional branch** (line 829-848):

```tsx
{activeTab === 'teachers' ? (
  getTeacherRowDetails(row)   // Rich: instruments, roles, hours, changes with Hebrew labels
) : (
  <>
    {row.changes && row.changes.length > 0 && (
      <span>{row.changes.map((c: any) => c.field || c).join(', ')}</span>  // Raw field paths
    )}
    {row.status === 'not_found' && (
      <span className="text-blue-600">תלמיד חדש - ייווצר ברשומה חדשה</span>  // No details
    )}
  </>
)}
```

The student branch shows raw field paths (`academicInfo.class`, `academicInfo.studyYears`) and no detail for new students.

### Target State

Add `getStudentRowDetails(row)` helper function mirroring `getTeacherRowDetails(row)`. Display Hebrew labels for all student fields including the three new fields (teacher, instrumentProgress, isMusicMajor).

### Exact Integration Points

**File:** `src/pages/ImportData.tsx`

**1. New helper `formatStudentChange(change)` (NEW — ~50 lines)**

Location: after `formatTeacherChange()` (~line 150).

```tsx
function formatStudentChange(change: any): string {
  const field = change.field || change.path || ''
  const newValue = change.newValue

  const studentFieldLabels: Record<string, string> = {
    'academicInfo.class': 'כיתה',
    'academicInfo.studyYears': 'שנות לימוד',
    'academicInfo.extraHour': 'שעה נוספת',
    'academicInfo.isMusicMajor': 'מגמת מוסיקה',
  }

  if (studentFieldLabels[field]) {
    const label = studentFieldLabels[field]
    if (field === 'academicInfo.extraHour' || field === 'academicInfo.isMusicMajor') {
      return `${label}: ${newValue ? 'כן' : 'לא'}`
    }
    return `${label}: ${newValue}`
  }

  if (field === 'teacherAssignment' && change.action === 'add') {
    return `מורה: הוספת שיוך מורה`
  }

  if (field === 'instrumentProgress') {
    if (change.action === 'add') {
      const stageLabel = change.ministryStageLevel ? ` (שלב ${change.ministryStageLevel})` : ''
      return `כלי נגינה: הוספת ${change.instrument}${stageLabel}`
    }
    if (change.action === 'updateStageLevel') {
      return `שלב: עדכון ל-${change.ministryStageLevel} (${change.instrument})`
    }
  }

  return `${field}: ${newValue}`
}
```

**2. New helper `getStudentRowDetails(row)` (NEW — ~80 lines)**

Location: after `getTeacherRowDetails()` (~line 260).

Structure mirrors `getTeacherRowDetails()`. For `not_found` rows, display:
- Instrument (from `mapped.instrument`)
- Teacher name (from `mapped.teacherName`) with resolved/unresolved indicator
- Ministry stage level (from `mapped.ministryStageLevel`)
- Music major flag (from `mapped.isMusicMajor`)
- Class, study years

For `matched` rows, display formatted changes using `formatStudentChange()`.

**3. Replace student branch in preview table (MODIFY — ~10 lines)**

Replace the raw field-path span block with:
```tsx
{activeTab === 'teachers' ? (
  getTeacherRowDetails(row)
) : (
  getStudentRowDetails(row)
)}
```

**4. Update `PreviewRow` interface (MODIFY — ~3 lines)**

The existing `changes?: string[]` type is too narrow. Teacher import already uses `changes: any[]`. Student changes now include objects with `field`, `action`, `instrument`, etc. The interface already accommodates this via the `any[]` type used in the teacher branch — no type change needed if already `any[]`.

---

## Component Boundaries

### Files Modified (Backend)

| File | Type | Change | Risk |
|------|------|--------|------|
| `api/import/import.service.js` | Core service | Add teacher matching, instrumentProgress building, isMusicMajor flag | MEDIUM — modifies 1900-line production service |
| `config/constants.js` | Constants | None needed — `VALID_INSTRUMENTS`, `MINISTRY_STAGE_LEVELS` already present | - |

### Files NOT Modified (Backend)

| File | Why Not |
|------|---------|
| `api/import/import.controller.js` | No new endpoints; existing `previewStudentImport` and `executeImport` endpoints unchanged |
| `api/import/import.route.js` | No route changes |
| `api/student/student.service.js` | Import bypasses the service layer, writes directly to MongoDB. No service layer involvement. |
| `api/student/student.validation.js` | Import bypasses Joi validation. Schema awareness needed for shape correctness, but no file changes. |

### Files Modified (Frontend)

| File | Type | Change | Risk |
|------|------|--------|------|
| `src/pages/ImportData.tsx` | UI component | Add `getStudentRowDetails()`, `formatStudentChange()`, update preview table branch | LOW — additive only, no existing logic removed |

### Files NOT Modified (Frontend)

| File | Why Not |
|------|---------|
| `src/services/apiService.js` | API contract unchanged — same endpoints, same response shape (new fields are additive) |

---

## Data Flow: Full Enhanced Import

```
Excel: "שם פרטי"="דנה", "שם משפחה"="כהן", "המורה"="יונה אברהם",
       "כלי"="כינור", "שלב"="ב", "מגמת מוסיקה"="כן", "כיתה"="ז"
  |
  v  [previewStudentImport]
mapColumns()
  → mapped.firstName = "דנה"
  → mapped.lastName = "כהן"
  → mapped.teacherName = "יונה אברהם"
  → mapped.instrument = "כינור"
  → mapped.ministryStageLevel = "ב"
  → mapped.isMusicMajor = "כן"
  → mapped.class = "ז"
  |
  v
validateStudentRow()
  → mapped.isMusicMajor = true  (TRUTHY_VALUES coercion)
  → VALID_INSTRUMENTS check passes for "כינור"
  → MINISTRY_STAGE_LEVELS check passes for "ב"
  |
  v
matchTeacherByName("יונה אברהם", teachers)
  → mapped.resolvedTeacherId = "67a1b2c3..."
  |
  v
matchStudent("דנה", "כהן", students)
  → match found → entry.studentId = "66f1a2b3..."
  |
  v
calculateStudentChanges(student, mapped)
  → change: { field: 'academicInfo.class', newValue: 'ז' }
  → change: { field: 'teacherAssignment', action: 'add', newValue: '67a1b2c3...' }
  → change: { field: 'instrumentProgress', action: 'add', instrument: 'כינור', ministryStageLevel: 'ב' }
  → change: { field: 'academicInfo.isMusicMajor', newValue: true }
  |
  v  [stored in import_log preview.matched entry]
  |
  v  [executeStudentImport]
$set: { 'academicInfo.class': 'ז', 'academicInfo.isMusicMajor': true }
$push: { teacherAssignments: { teacherId: '67a1b2c3...', isActive: true, notes: 'ייבוא ממשרד החינוך', ... } }
$push: { 'academicInfo.instrumentProgress': { instrumentName: 'כינור', currentStage: 4, ministryStageLevel: 'ב', ... } }
```

---

## Patterns to Follow

### Pattern 1: Extend Column Map, Not Parser

**What:** Add new Hebrew header → internal key mappings to `STUDENT_COLUMN_MAP`. The parser (`parseExcelBufferWithHeaderDetection`) handles the rest automatically.

**When:** Any new Excel column to support.

**Example:** `'מגמת מוסיקה': 'isMusicMajor'` — parser already handles extraction, validation and execute just need to know the key name.

### Pattern 2: Preview Stores All Resolved State, Execute Just Applies It

**What:** All matching, resolution, and diff calculation happens in preview. The import log captures the full resolved state (including `resolvedTeacherId`, `changes` array with action metadata). Execute reads the log and applies changes without re-resolving.

**When:** All import logic.

**Why this matters:** Changing this pattern (re-resolving on execute) would introduce a race condition where a teacher is deleted between preview and execute. Always use the resolved state from the log.

### Pattern 3: Direct MongoDB Writes for Import (Bypass Joi)

**What:** Import service uses `studentCollection.updateOne()` / `insertOne()` directly, not via `student.service.js`. This is intentional — the service layer has complex validations (teacher assignment day/time requirements, relationship sync cascades) that are inappropriate for bulk import.

**When:** All import execute operations.

**Gotcha:** Because Joi is bypassed, the import code must manually enforce correct document shape. Use the existing student documents as shape reference, not the validation schema. Specifically:
- `instrumentProgress[].currentStage` must be in `[1, 2, 3, 4, 5, 6, 7, 8]`
- `teacherAssignments[].teacherId` must be a string (not ObjectId)
- `academicInfo.tests.bagrutId` should default to `null` on new students

### Pattern 4: Mirror Teacher Preview Quality for Student Preview

**What:** The teacher preview renders rich Hebrew-labeled detail for each row. Student preview should use the same component structure (`getStudentRowDetails` mirroring `getTeacherRowDetails`).

**When:** Frontend preview table.

**Implementation:** Both helpers follow the same pattern: check `row.status`, render a `<div className="space-y-1 text-xs">` with labeled sub-items, fall back to "אין שינויים" when nothing changed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Re-Query Teacher Collection on Execute

**What goes wrong:** Querying the teacher collection again in `executeStudentImport()` to resolve teacher names.

**Why bad:** The import log already contains `resolvedTeacherId` from preview. Re-querying is redundant, slower, and creates a race condition (teacher could be deleted between preview and execute).

**Instead:** Use `entry.mapped.resolvedTeacherId` directly from the stored import log.

### Anti-Pattern 2: Creating a teacherAssignment with scheduleSlotId

**What goes wrong:** Setting `scheduleSlotId` to a generated or placeholder value during import.

**Why bad:** `scheduleSlotId` is a real reference to a time-block slot in the teacher's `teaching.timeBlocks` array. Import does not have schedule data. A fake scheduleSlotId would corrupt the relationship model.

**Instead:** Always set `scheduleSlotId: null` for import-created assignments. The teacher can assign a schedule slot later through the UI.

### Anti-Pattern 3: Using `$set` for instrumentProgress (Instead of `$push`)

**What goes wrong:** Writing `$set: { 'academicInfo.instrumentProgress': [newEntry] }` for matched students.

**Why bad:** This replaces the entire array, deleting any existing instrument progress entries the student already has.

**Instead:** Use `$push: { 'academicInfo.instrumentProgress': newEntry }` for new instruments. For stage-level updates on existing entries, use the positional `$` operator with a filter on `instrumentName`.

### Anti-Pattern 4: Auto-Fuzzy-Matching Teacher Names

**What goes wrong:** Using Levenshtein distance or partial string matching for teacher name resolution.

**Why bad:** Fuzzy matching creates false positives at scale. "יונה אברהם" matching to "יואב אברהם" is worse than no match. The teacher import already uses exact name matching (priority 3 in `matchTeacher()`). Student import should be consistent.

**Instead:** Exact case-insensitive match only. Unmatched teacher names become warnings, not errors. The user can fix the Excel and re-import.

### Anti-Pattern 5: Triggering Teacher Sync on Import

**What goes wrong:** Calling `syncTeacherRecordsForStudentUpdate()` or other cascade sync functions after writing teacher assignments during import.

**Why bad:** The sync functions (used in `student.service.js` updateStudent) create time-block lessons in the teacher's `teaching.timeBlocks`. Import creates assignment-only links — no schedule slots exist yet. The sync would fail or create phantom records.

**Instead:** Write `teacherAssignments` directly without triggering sync. The teacher-student relationship is established correctly by the `$push`. Schedule linking happens later through normal UI flows.

---

## Build Order (Dependency-Driven)

```
Step 1: STUDENT_COLUMN_MAP additions + validateStudentRow() coercions
  -- Add 'מגמת מוסיקה' → 'isMusicMajor' mapping
  -- Add isMusicMajor boolean coercion in validateStudentRow
  Deps: none
  Risk: LOW — additive column map changes

Step 2: matchTeacherByName() function + teacher collection load in preview
  -- New function alongside existing matchTeacher()
  -- Load teacher collection in previewStudentImport (3 lines)
  -- Resolve teacherId in preview loop
  Deps: Step 1 (column map must include teacherName, which already exists)
  Risk: LOW — new function, additive load

Step 3: buildInstrumentProgressEntry() + calculateStudentChanges() extensions
  -- New helper function with MINISTRY_LEVEL_TO_STAGE map
  -- Extend calculateStudentChanges() with 3 new change types
  Deps: Step 2 (resolvedTeacherId must be set before calculateStudentChanges runs)
  Risk: LOW-MEDIUM — modifying a core diff function

Step 4: executeStudentImport() — apply new change types
  -- Handle 'teacherAssignment' change → $push teacherAssignments
  -- Handle 'instrumentProgress' add → $push academicInfo.instrumentProgress
  -- Handle 'instrumentProgress' updateStageLevel → positional $set
  -- Handle 'academicInfo.isMusicMajor' → already handled by existing $set loop
  -- Update newStudent construction for notFound entries
  Deps: Steps 1-3 (changes array must contain correct change objects)
  Risk: MEDIUM — modifies execute function, must not affect existing matched student logic

Step 5: Frontend — formatStudentChange() + getStudentRowDetails()
  -- New helper functions
  -- Replace raw-field student branch in preview table
  Deps: Steps 1-4 (preview response must include new change types to display them)
  Risk: LOW — additive, affects display only
```

**Ordering rationale:**

Backend changes build on each other strictly: column map → validation → preview matching → diff calculation → execute application. The frontend change is last because it depends on the backend returning richer preview data with the new change types. Each step is independently testable: after Step 2, teacher names appear in preview warnings. After Step 3, the changes array is populated correctly (verifiable by inspecting the import_log). After Step 4, the DB writes are correct.

---

## Scalability Considerations

| Concern | At current scale (<200 students/import) | At 1000+ students/import |
|---------|----------------------------------------|--------------------------|
| Teacher collection load | `find({ isActive: true, tenantId })` → ~100-200 docs, in-memory | Same — teacher count is bounded by school size, not import size |
| Per-row teacher match | O(n) linear scan over teachers array | Still O(n) — 200 teachers × 1000 students = 200K comparisons, <100ms |
| Instrument $push per row | One extra `updateOne` per matched student with new instrument | Could batch into bulkWrite. At 1000 students, 1000 updateOnes = ~2-3s. Acceptable. |
| import_log document size | Preview object grows (changes arrays are larger) | MongoDB 16MB doc limit not a concern at 1000 students |

For current school sizes (<500 students per import), no batching is needed. If import files with >1000 students become common, the instrument $push operations should be batched with `bulkWrite`.

---

## Sources

- `api/import/import.service.js` — full read (1950 lines, HIGH confidence)
- `api/student/student.service.js` — teacher assignment patterns, lines 740-770 (HIGH confidence)
- `api/student/student.validation.js` — instrumentProgressSchema, teacherAssignmentSchema (HIGH confidence)
- `api/export/sheets/students.sheet.js` — "מגמת מוסיקה" column existence confirmed (HIGH confidence)
- `src/pages/ImportData.tsx` — full read (962 lines, HIGH confidence)
- `config/constants.js` — VALID_INSTRUMENTS, MINISTRY_STAGE_LEVELS, VALID_STAGES (HIGH confidence)
- All confidence ratings are HIGH — research is based on direct codebase analysis, not external sources
