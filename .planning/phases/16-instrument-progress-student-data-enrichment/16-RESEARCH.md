# Phase 16: Instrument Progress + Student Data Enrichment - Research

**Researched:** 2026-02-27
**Domain:** Student import data enrichment (instrumentProgress, stage mapping, change detection, bagrut flagging, school year enrollment)
**Confidence:** HIGH

## Summary

Phase 16 transforms the student import pipeline from storing flat string fields (`academicInfo.instrument`, `academicInfo.ministryStageLevel`) to creating proper `instrumentProgress[]` array entries with `instrumentName`, `isPrimary`, `currentStage`, and `ministryStageLevel`. It also expands the change detection (`calculateStudentChanges`) to diff instrument, stage level, lesson duration, and teacher name -- not just the current 3 fields (studyYears, extraHour, class). Finally, it ensures that executing import on bagrut-flagged students sets `academicInfo.isBagrutCandidate: true` and that newly created students are enrolled in the current school year.

The primary complexity lies in two areas: (1) the `addStudent()` Joi schema requires `instrumentProgress` as a non-empty array with `instrumentName` (from VALID_INSTRUMENTS) and `currentStage` (1-8) as required fields, plus `class` as required -- the import must construct valid objects from partial Ministry data; (2) the `stageToMinistryLevel()` mapping needs to be inverted (Ministry level "א"/"ב"/"ג" to a numeric stage) and the "ב" level maps to stages 4-5, requiring a decision on the default. The existing `executeStudentImport` currently does raw `insertOne` bypassing `addStudent()` entirely, which means new students get no school year enrollment, no Joi validation, and no `instrumentProgress[]`.

**Primary recommendation:** Refactor `executeStudentImport` to route new student creation through a modified path that constructs a valid student document with `instrumentProgress[]`, enrolls in the current school year, and sets `isBagrutCandidate` -- either by calling `addStudent()` (requires the import to construct a Joi-valid payload) or by replicating the essential logic inline (school year enrollment + proper document shape).

## Standard Stack

### Core (already in use -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | (current) | Excel buffer parsing in import.service.js | Already used for all import/export |
| Joi | (current) | Student schema validation (student.validation.js) | Already used for all entity validation |
| MongoDB native driver | (current) | Direct collection operations | Project standard (no Mongoose) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| config/constants.js | N/A | VALID_INSTRUMENTS, VALID_STAGES, MINISTRY_STAGE_LEVELS, stageToMinistryLevel() | Stage mapping, instrument validation |
| school-year.service.js | N/A | getCurrentSchoolYear() | Enrolling new students in current year |

**No new dependencies required.** Phase 16 is purely internal refactoring of `import.service.js` and related functions.

## Architecture Patterns

### Current Student Import Flow (Before Phase 16)
```
Excel Buffer
    |
    v
parseExcelBufferWithHeaderDetection(buffer, STUDENT_COLUMN_MAP)
    |
    v
For each row:
  mapColumns(row, STUDENT_COLUMN_MAP, headerColMap) --> mapped object
  readInstrumentMatrix(row, instrumentColumns, cellRow) --> instruments[]
  validateStudentRow(mapped, rowIndex) --> errors/warnings, splits fullName, converts types
  matchStudent(mapped, students) --> match or null
    |
    v
Preview: { matched: [{changes}], notFound: [{mapped}] }
    |
    v
executeStudentImport:
  matched --> updateOne({ $set: {field: newValue} })  (only studyYears/extraHour/class changes)
  notFound --> raw insertOne({ tenantId, personalInfo, academicInfo: { instrument, class, ... } })
              ^^ NO instrumentProgress, NO school year enrollment, NO isBagrutCandidate
```

### Target Student Import Flow (After Phase 16)
```
Excel Buffer
    |
    v
parseExcelBufferWithHeaderDetection(buffer, STUDENT_COLUMN_MAP)
    |
    v
For each row:
  mapColumns + readInstrumentMatrix + validateStudentRow (same as before)
  NEW: Build instrumentProgressEntry from mapped.instrument + mapped.ministryStageLevel
  NEW: Calculate ministryStageToNumeric(mapped.ministryStageLevel) for currentStage
  matchStudent(mapped, students) --> match or null
    |
    v
Preview: matched --> calculateStudentChanges (EXPANDED: instrument, stage, lessonDuration, teacherName)
         notFound --> mapped (now includes instrumentProgressEntry data)
    |
    v
executeStudentImport:
  matched --> updateOne with EXPANDED change set (includes instrumentProgress, isBagrutCandidate)
  notFound --> construct proper student doc with:
              - instrumentProgress[] array (not flat instrument string)
              - enrollments.schoolYears with current school year
              - academicInfo.isBagrutCandidate (if flagged)
              - teacherAssignments: [] (empty -- Phase 17 handles linking)
```

### Pattern 1: Ministry Stage Level to Numeric Stage Mapping
**What:** Invert the existing `stageToMinistryLevel()` function to map Hebrew level letters back to numeric stages.
**Existing mapping (constants.js line 163-168):**
```
stageToMinistryLevel: 1-3 -> 'א', 4-5 -> 'ב', 6-8 -> 'ג'
```
**Inverse mapping needed:**
```javascript
function ministryLevelToStage(level) {
  const MAP = { 'א': 1, 'ב': 4, 'ג': 6 };
  return MAP[level] || 1;
}
```
**Decision:** For "ב" (stages 4-5), use 4 as the default (lowest in range). This is the safest choice because stage progression is always upward -- a student at "ב" is at LEAST stage 4. Similarly "א" maps to 1 and "ג" maps to 6.

### Pattern 2: Constructing instrumentProgress Entry from Import Data
**What:** Transform flat mapped fields into a valid instrumentProgress array entry.
**Source data from import:** `mapped.instrument` (canonical instrument name from VALID_INSTRUMENTS), `mapped.ministryStageLevel` (Hebrew letter from validated column)
**Target structure (from student.validation.js instrumentProgressSchema):**
```javascript
{
  instrumentName: mapped.instrument,    // Required, must be in VALID_INSTRUMENTS
  isPrimary: true,                      // First/only instrument from import
  currentStage: ministryLevelToStage(mapped.ministryStageLevel) || 1,  // Required, 1-8
  ministryStageLevel: mapped.ministryStageLevel || null,  // Optional
  tests: {}                             // Default empty
}
```

### Pattern 3: Bypassing addStudent() Joi Validation for Import
**What:** The current `executeStudentImport` does raw `insertOne` -- it cannot call `addStudent()` without constructing a fully Joi-valid payload (requires `class` and `instrumentProgress` as required fields). The recommended approach is to replicate the critical `addStudent()` logic inline rather than fight the strict schema.
**Why:** `addStudent()` requires `academicInfo.class` as required and `instrumentProgress` as a non-empty array. Ministry files provide both (class column and instrument/stage), so the import CAN construct a valid payload. However, the strict Joi schema for `teacherAssignments` (requires `day`, `time`, `duration`) means we cannot pass teacher assignments through `addStudent()` -- but that is Phase 17's concern, not Phase 16's.
**Recommendation:** Route through `addStudent()` when the import has enough data to construct a valid payload (instrument + class + stage). If class is missing, use `isAdmin=true` mode which makes class optional. This gives us school year enrollment for free.

### Pattern 4: Expanded Change Detection
**What:** Extend `calculateStudentChanges` to detect changes in instrument, stage, lesson duration, teacher name, and isBagrutCandidate.
**Current implementation (import.service.js line 1320-1338):**
```javascript
function calculateStudentChanges(student, mapped) {
  const fields = [
    { key: 'studyYears', path: 'academicInfo.studyYears' },
    { key: 'extraHour', path: 'academicInfo.extraHour' },
    { key: 'class', path: 'academicInfo.class' },
  ];
  // ... simple string comparison loop
}
```
**Needs to also compare:**
- `instrument` vs `academicInfo.instrumentProgress[0].instrumentName` (primary instrument)
- `ministryStageLevel` vs `academicInfo.instrumentProgress[0].ministryStageLevel`
- `lessonDuration` vs existing lesson duration (if tracked)
- `isBagrutCandidate` vs `academicInfo.isBagrutCandidate`
- `teacherName` vs matched teacher assignment (for display only -- Phase 17 handles linking)

### Anti-Patterns to Avoid
- **Storing flat `academicInfo.instrument` alongside `instrumentProgress[]`:** The current import stores `academicInfo.instrument` as a flat string. This is redundant with `instrumentProgress[].instrumentName`. Phase 16 must stop writing the flat field and ONLY use `instrumentProgress[]`.
- **Bypassing school year enrollment:** The current `executeStudentImport` does raw `insertOne` with no enrollment. New students created this way are invisible in school-year-scoped queries. Must enroll in current school year.
- **Modifying the `studentSchema` Joi to make fields optional for import:** This weakens validation for ALL creation paths (UI + API + import). Better to construct valid data or use `isAdmin` mode.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| School year enrollment | Manual enrollment logic | `addStudent()` service or replicate its `schoolYearService.getCurrentSchoolYear()` + enrollment pattern | `addStudent()` already handles the current-year enrollment edge case (creates year if needed) |
| Stage level mapping | Ad-hoc conditionals | Add `ministryLevelToStage()` to `config/constants.js` next to existing `stageToMinistryLevel()` | Keeps all stage mapping logic co-located and testable |
| Instrument validation | Regex or loose checks | `VALID_INSTRUMENTS.includes(name)` | Already validated in validateStudentRow; same check used throughout codebase |
| Primary instrument detection | Custom logic per call site | Set `isPrimary: true` on first entry | `addStudent()` already does this fallback (line 122-128); import should do the same |

**Key insight:** The `addStudent()` service already handles school year enrollment, primary instrument marking, and teacher assignment initialization. Routing import through it (or replicating its essential logic) avoids duplicating these concerns.

## Common Pitfalls

### Pitfall 1: Missing `currentStage` When Ministry File Has No Stage Column
**What goes wrong:** Some Ministry files may not have a "שלב" column. If `mapped.ministryStageLevel` is undefined/empty and we try to construct an instrumentProgress entry, `currentStage` would be undefined -- but it is a REQUIRED field (Joi validation fails).
**Why it happens:** Not all Ministry Excel files have the same column layout.
**How to avoid:** Default `currentStage` to 1 when `ministryStageLevel` is absent. This is the safest default (lowest stage).
**Warning signs:** Joi validation error: `"academicInfo.instrumentProgress[0].currentStage" is required`

### Pitfall 2: Missing Instrument Leaves instrumentProgress Empty
**What goes wrong:** If a student row has no instrument detected (no instrument column, no department hint auto-assign), the import cannot create an instrumentProgress entry. But `addStudent()` schema requires at least one entry.
**Why it happens:** Student files may not have instrument columns, or the auto-detection fails.
**How to avoid:** When no instrument is detected, skip instrumentProgress creation and fall back to the current flat document shape (without instrumentProgress). Or use a sentinel instrument name. Best approach: skip `addStudent()` and do raw insert for rows with no instrument data, matching current behavior.
**Warning signs:** Empty `instruments[]` from `readInstrumentMatrix` AND no `mapped.instrument` from column map.

### Pitfall 3: Duplicate instrumentProgress Entries on Re-Import
**What goes wrong:** A matched (existing) student is re-imported with the same instrument. The change detection creates a "change" entry that replaces the entire instrumentProgress array, losing test history and other instrument entries.
**Why it happens:** Naive comparison (`JSON.stringify(old) !== JSON.stringify(new)`) treats any difference as a full replacement.
**How to avoid:** For matched students, compare only the PRIMARY instrument's `instrumentName`, `currentStage`, and `ministryStageLevel`. If only these changed, update them with `$set` on the specific array element rather than replacing the whole array. If the instrument name itself changed, that is a real change to surface in preview.
**Warning signs:** Test data (`tests.stageTest`, `tests.technicalTest`) getting wiped on re-import.

### Pitfall 4: isBagrutCandidate Not Applied During Execute
**What goes wrong:** Preview correctly shows `isBagrutCandidate: true` in `mapped`, but execute does not write it to the student document because `calculateStudentChanges` does not include it and the create path does not set it.
**Why it happens:** The current `executeStudentImport` only writes fields from `changes[]` for matched students. For new students, it writes `academicInfo.instrument` but NOT `isBagrutCandidate`.
**How to avoid:** Add `isBagrutCandidate` to both paths: (1) add it to `calculateStudentChanges` field list; (2) include it in the new student document construction.

### Pitfall 5: addStudent() Strict Schema Blocks Import
**What goes wrong:** Calling `addStudent()` fails because Ministry data is incomplete (missing class, missing instrument).
**Why it happens:** `studentSchema` requires `personalInfo.firstName`, `personalInfo.lastName`, `academicInfo.class` (required), and `academicInfo.instrumentProgress` (min 1 item, each requiring instrumentName + currentStage).
**How to avoid:** Two strategies: (A) Call `validateStudent(studentToAdd, false, true)` with `isAdmin=true` which makes `class` optional via `.fork()`. (B) Construct a complete payload: class from `mapped.class` (usually present in Ministry files), instrumentProgress from instrument + stage. If instrument is missing, fall back to raw insert.
**Warning signs:** Joi error `"academicInfo.instrumentProgress" is required` or `"academicInfo.class" is required`

### Pitfall 6: School Year Enrollment Missing for New Students
**What goes wrong:** New students created via import don't appear in school-year-scoped queries (dashboard, student list filtered by year).
**Why it happens:** Current `executeStudentImport` does `insertOne` without `enrollments.schoolYears`.
**How to avoid:** Either route through `addStudent()` (which auto-enrolls) or replicate: fetch `schoolYearService.getCurrentSchoolYear()` and add `{ schoolYearId, isActive: true }` to `enrollments.schoolYears`.

## Code Examples

### Example 1: Ministry Level to Numeric Stage (to add to constants.js)
```javascript
// Source: config/constants.js (inverse of stageToMinistryLevel on line 163)
/**
 * Convert Ministry level (א/ב/ג) to the LOWEST numeric stage in that range.
 * א → 1 (covers stages 1-3), ב → 4 (covers stages 4-5), ג → 6 (covers stages 6-8)
 * Returns 1 as fallback for unknown/empty values.
 */
export function ministryLevelToStage(level) {
  const MAP = { 'א': 1, 'ב': 4, 'ג': 6 };
  return MAP[level] || 1;
}
```

### Example 2: Building instrumentProgress Entry from Import Data
```javascript
// Source: api/import/import.service.js (new helper function)
function buildInstrumentProgressEntry(mapped) {
  if (!mapped.instrument || !VALID_INSTRUMENTS.includes(mapped.instrument)) {
    return null; // Cannot create entry without valid instrument
  }

  return {
    instrumentName: mapped.instrument,
    isPrimary: true,
    currentStage: mapped.ministryStageLevel
      ? ministryLevelToStage(mapped.ministryStageLevel)
      : 1,
    ministryStageLevel: mapped.ministryStageLevel || null,
    tests: {},
  };
}
```

### Example 3: Expanded calculateStudentChanges
```javascript
// Source: api/import/import.service.js (expanded version)
function calculateStudentChanges(student, mapped) {
  const changes = [];

  // Existing flat fields
  const fields = [
    { key: 'studyYears', path: 'academicInfo.studyYears' },
    { key: 'extraHour', path: 'academicInfo.extraHour' },
    { key: 'class', path: 'academicInfo.class' },
  ];

  for (const { key, path } of fields) {
    if (mapped[key] === '' || mapped[key] === null || mapped[key] === undefined) continue;
    const current = getNestedValue(student, path);
    if (String(current ?? '') !== String(mapped[key])) {
      changes.push({ field: path, oldValue: current ?? null, newValue: mapped[key] });
    }
  }

  // Instrument change (compare against primary instrumentProgress entry)
  const primaryProgress = (student.academicInfo?.instrumentProgress || [])
    .find(ip => ip.isPrimary) || (student.academicInfo?.instrumentProgress || [])[0];

  if (mapped.instrument && mapped.instrument !== (primaryProgress?.instrumentName || null)) {
    changes.push({
      field: 'academicInfo.instrumentProgress[0].instrumentName',
      oldValue: primaryProgress?.instrumentName || null,
      newValue: mapped.instrument,
    });
  }

  // Stage level change
  if (mapped.ministryStageLevel) {
    const currentLevel = primaryProgress?.ministryStageLevel || null;
    if (mapped.ministryStageLevel !== currentLevel) {
      changes.push({
        field: 'academicInfo.instrumentProgress[0].ministryStageLevel',
        oldValue: currentLevel,
        newValue: mapped.ministryStageLevel,
      });
    }
  }

  // Lesson duration change
  if (mapped.lessonDuration && typeof mapped.lessonDuration === 'number') {
    // Compare against existing assignment's duration or academicInfo.lessonDuration
    const currentDuration = student.academicInfo?.lessonDuration || null;
    if (mapped.lessonDuration !== currentDuration) {
      changes.push({
        field: 'academicInfo.lessonDuration',
        oldValue: currentDuration,
        newValue: mapped.lessonDuration,
      });
    }
  }

  // isBagrutCandidate change
  if (mapped.isBagrutCandidate !== null && mapped.isBagrutCandidate !== undefined) {
    const current = student.academicInfo?.isBagrutCandidate ?? null;
    if (mapped.isBagrutCandidate !== current) {
      changes.push({
        field: 'academicInfo.isBagrutCandidate',
        oldValue: current,
        newValue: mapped.isBagrutCandidate,
      });
    }
  }

  return changes;
}
```

### Example 4: New Student Document Construction (replacing raw insertOne)
```javascript
// Source: api/import/import.service.js (refactored executeStudentImport notFound loop)
const instrumentEntry = buildInstrumentProgressEntry(mapped);

const newStudent = {
  tenantId,
  personalInfo: {
    firstName: mapped.firstName || '',
    lastName: mapped.lastName || '',
  },
  academicInfo: {
    class: mapped.class || null,
    studyYears: mapped.studyYears ? parseInt(mapped.studyYears) || 1 : 1,
    extraHour: typeof mapped.extraHour === 'boolean' ? mapped.extraHour : false,
    instrumentProgress: instrumentEntry ? [instrumentEntry] : [],
    isBagrutCandidate: mapped.isBagrutCandidate ?? null,
    tests: { bagrutId: null },
  },
  enrollments: {
    orchestraIds: [],
    ensembleIds: [],
    theoryLessonIds: [],
    schoolYears: [{
      schoolYearId: currentSchoolYear._id.toString(),
      isActive: true,
    }],
  },
  teacherAssignments: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Add lessonDuration if present
if (mapped.lessonDuration && typeof mapped.lessonDuration === 'number') {
  newStudent.academicInfo.lessonDuration = mapped.lessonDuration;
}
```

### Example 5: Applying Expanded Changes for Matched Students (execute)
```javascript
// Source: api/import/import.service.js (refactored executeStudentImport matched loop)
// For instrument/stage changes, need to do $set on specific instrumentProgress fields
// rather than the simple { [change.field]: change.newValue } pattern

for (const change of entry.changes) {
  if (change.field.startsWith('academicInfo.instrumentProgress[0].')) {
    // Handle instrumentProgress sub-field updates
    const subField = change.field.replace('academicInfo.instrumentProgress[0].', '');
    // Use MongoDB positional operator or targeted $set
    // e.g., 'academicInfo.instrumentProgress.0.instrumentName'
    updateDoc[`academicInfo.instrumentProgress.0.${subField}`] = change.newValue;

    // Also update currentStage when ministryStageLevel changes
    if (subField === 'ministryStageLevel') {
      updateDoc['academicInfo.instrumentProgress.0.currentStage'] =
        ministryLevelToStage(change.newValue);
    }
  } else {
    updateDoc[change.field] = change.newValue;
  }
}
```

## State of the Art

| Old Approach (current) | New Approach (Phase 16) | Impact |
|------------------------|------------------------|--------|
| `academicInfo.instrument` flat string | `academicInfo.instrumentProgress[]` array | Enables stage tracking, test history, multi-instrument support |
| `academicInfo.ministryStageLevel` flat string | `instrumentProgress[0].ministryStageLevel` + `currentStage` | Stage level lives WITH the instrument, not as a standalone field |
| `calculateStudentChanges` checks 3 fields | Checks 7+ fields (adds instrument, stage, duration, bagrut) | Preview shows all meaningful changes |
| Raw `insertOne` for new students | Full document with instrumentProgress + school year enrollment | New students properly structured and visible in year-scoped queries |
| `isBagrutCandidate` parsed but never written | Written during execute for both new and matched students | Requirement BGRT-02 satisfied |

**Deprecated after Phase 16:**
- `academicInfo.instrument` (flat string) -- replaced by `instrumentProgress[].instrumentName`
- `academicInfo.ministryStageLevel` (flat string on student root) -- replaced by `instrumentProgress[].ministryStageLevel`

## Open Questions

1. **Route through addStudent() vs replicate inline?**
   - What we know: `addStudent()` auto-enrolls in current school year, validates via Joi, marks primary instrument. Current import bypasses it entirely.
   - What's unclear: Whether import data will always have enough to satisfy the strict schema (class + instrumentProgress required). Ministry files usually have class column, but edge cases exist.
   - Recommendation: **Replicate the essential addStudent() logic inline** in `executeStudentImport` rather than calling `addStudent()`. This avoids fighting the strict Joi schema while getting school year enrollment. Fetch `getCurrentSchoolYear()` once before the loop, construct the full document shape, and do `insertOne`. This is the safer path because: (a) import already bypasses Joi; (b) the strict schema requires `class` which may be missing; (c) `addStudent()` does teacher sync which import does not need yet (Phase 17).

2. **Should matched student instrument changes REPLACE or MERGE?**
   - What we know: A matched student may have multiple instrumentProgress entries (e.g., primary piano + secondary violin). Import only provides ONE instrument per row.
   - What's unclear: Should import replace all entries with the single imported one, or update only the primary?
   - Recommendation: **Update only the primary instrument's fields** (instrumentName, currentStage, ministryStageLevel). Do NOT replace the entire array. Use MongoDB `$set` with `instrumentProgress.0.*` for the primary entry. If the import instrument differs from the current primary, surface it as a change in preview but apply it as an update to the first entry.

3. **What happens when a matched student has NO existing instrumentProgress?**
   - What we know: Students created before the instrumentProgress schema may have `instrumentProgress: []` or missing entirely. They may have the legacy flat `academicInfo.instrument` string.
   - What's unclear: How many legacy students exist in production without instrumentProgress.
   - Recommendation: When `instrumentProgress` is empty/missing on a matched student AND the import has instrument data, create a new instrumentProgress entry via `$push` rather than `$set` on index 0. The change detection should check for this case and show it as "adding instrument progress".

4. **Teacher name display in preview (IQAL-03 partial)**
   - What we know: IQAL-03 requires showing teacher name changes in preview. The STUDENT_COLUMN_MAP maps "המורה" to `teacherName`. This is a display-only field for Phase 16 preview.
   - What's unclear: Should Phase 16 show the raw teacher name in preview diff, or wait for Phase 17's matching logic?
   - Recommendation: Phase 16 should include `teacherName` in the expanded change detection for display purposes only. Show it as a change field (`mapped.teacherName` vs "current teacher"). Phase 17 will handle the actual teacher matching and assignment creation.

## Sources

### Primary (HIGH confidence)
- `api/import/import.service.js` -- Full import pipeline: column maps, preview, execute, change detection (read in full)
- `api/student/student.validation.js` -- Joi schemas: studentSchema, studentUpdateSchema, instrumentProgressSchema, teacherAssignmentSchema (read in full)
- `api/student/student.service.js` -- addStudent(), updateStudent(), school year enrollment logic (read in full)
- `config/constants.js` -- VALID_INSTRUMENTS, VALID_STAGES, MINISTRY_STAGE_LEVELS, stageToMinistryLevel() (read in full)
- `api/student/student-assignments.validation.js` -- teacherAssignment Joi schema with required day/time/duration (read in full, confirms blocker)
- `api/export/ministry-mappers.js` -- How export reads instrumentProgress (line 209-213, confirms current data shape expectations)
- `.planning/phases/15-bug-fix-column-map-extensions/15-01-PLAN.md` -- Phase 15 completed work (column map extensions, isBagrutCandidate schema)

### Secondary (MEDIUM confidence)
- `scripts/seed-dev-data.js` -- Canonical instrumentProgress shape in seed data (lines 299-308)
- `api/school-year/school-year.service.js` -- getCurrentSchoolYear() signature and auto-creation logic

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing codebase analysis
- Architecture: HIGH -- all patterns derived from reading actual production code
- Pitfalls: HIGH -- identified from actual Joi schema constraints and current code gaps
- Stage mapping: HIGH -- `stageToMinistryLevel()` is defined in constants.js, inverse mapping is straightforward arithmetic
- addStudent vs inline decision: HIGH -- Joi schema constraints verified directly from source

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable internal codebase, no external dependency changes)
