# Phase 17: Teacher-Student Linking - Research

**Researched:** 2026-02-27
**Domain:** Teacher name matching from Ministry Excel files, teacherAssignment creation via import, match status display
**Confidence:** HIGH

## Summary

Phase 17 adds teacher-student linking to the student import pipeline. When a Ministry Excel file contains a "המורה" (teacher) column, the preview must match each teacher name against the tenant's existing teacher list, display the match status (resolved/unresolved/ambiguous), and persist the match result in the import_log. When execute runs, it creates a `teacherAssignment` entry on the student document with the matched teacher's `_id`, bypassing the Joi validation that requires `day`, `time`, and `duration` fields (which Ministry files do not provide).

The current codebase already has the foundation: Phase 16 added `teacherName` to `calculateStudentChanges()` as a display-only field (line 1422-1428 in import.service.js), the column map already maps "המורה" to `teacherName` (line 131), and the execute path already skips `teacherName` changes (line 1868-1871). Phase 17 replaces the display-only behavior with actual teacher matching in preview, persists match results, and creates assignments during execute.

The core challenge is name matching: Ministry files store teacher names as a single string (e.g., "ישראל ישראלי") while the database stores `firstName` and `lastName` separately. The match must handle both orderings ("firstName lastName" and "lastName firstName"), be case-insensitive, handle leading/trailing whitespace, and report ambiguous matches (multiple teachers with the same name). The `teacherAssignment` Joi schema requires `day`, `time`, and `duration` as required fields, so import must bypass Joi validation and write directly via MongoDB `$push` -- this was explicitly anticipated in Phase 16's planning notes.

**Primary recommendation:** Add a `matchTeacherByName()` function to the student preview flow that splits the teacher name string and matches against all teachers in both name orderings, returning resolved/unresolved/ambiguous status. Persist match data on each preview entry. During execute, use raw MongoDB `$push` (not through addStudent or Joi) to create minimal teacherAssignment entries with only `teacherId`, `isActive`, `source`, and timestamps.

## Standard Stack

### Core (already in use -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MongoDB native driver | (current) | `$push` teacherAssignment entries, query teachers | Project standard (no Mongoose) |
| ExcelJS | (current) | Already used by import pipeline | No changes needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| config/constants.js | N/A | No new constants needed for Phase 17 | Reference only |
| api/import/import.service.js | N/A | All changes are in this file | Primary modification target |

**No new dependencies required.** Phase 17 is internal refactoring of `import.service.js` to add teacher matching and assignment creation.

## Architecture Patterns

### Current Flow (After Phase 16, Before Phase 17)
```
previewStudentImport:
  For each row:
    mapped.teacherName = raw string from "המורה" column (e.g., "ישראל ישראלי")
    calculateStudentChanges:
      -> pushes { field: 'teacherName', oldValue: null, newValue: 'ישראל ישראלי' }
      -> This is display-only, no matching

executeStudentImport:
  For each matched student change:
    if (change.field === 'teacherName') continue;  // SKIPPED entirely
  For new students:
    teacherAssignments: []  // Always empty
```

### Target Flow (After Phase 17)
```
previewStudentImport:
  1. Fetch all active teachers for tenant (once, before row loop)
  2. For each row:
     mapped.teacherName = raw string from "המורה" column
     NEW: matchTeacherByName(mapped.teacherName, teachers) -> match result
     Store match result on preview entry: { teacherMatch: { status, teacherId?, teacherName?, ... } }
  3. Preview-level summary: { resolvedCount, unresolvedCount, ambiguousCount }

executeStudentImport:
  For each matched student with teacherMatch.status === 'resolved':
    $push teacherAssignment with teacherId (bypass Joi)
  For each new student with teacherMatch.status === 'resolved':
    Include teacherAssignment in initial document
  teacherMatch.status === 'unresolved' or 'ambiguous': skip, already warned in preview
```

### Pattern 1: Teacher Name Matching
**What:** Match a single teacher name string against the tenant's teacher list using both name orderings.
**When to use:** During `previewStudentImport`, for every row where `mapped.teacherName` exists.
**Why both orderings:** Ministry Excel files are inconsistent -- some files use "firstName lastName" ordering, others use "lastName firstName". Hebrew names do not have a reliable first/last ordering convention.

```javascript
// Source: Derived from existing matchTeacher() pattern (import.service.js line 1110)
function matchTeacherByName(nameString, teachers) {
  if (!nameString || !String(nameString).trim()) {
    return { status: 'none' };
  }

  const name = String(nameString).trim();
  const parts = name.split(/\s+/);

  if (parts.length < 2) {
    // Single word -- try matching against firstName OR lastName
    const word = parts[0].toLowerCase();
    const matches = teachers.filter(t =>
      (t.personalInfo?.firstName || '').trim().toLowerCase() === word ||
      (t.personalInfo?.lastName || '').trim().toLowerCase() === word
    );
    if (matches.length === 1) {
      return {
        status: 'resolved',
        teacherId: matches[0]._id.toString(),
        teacherName: `${matches[0].personalInfo?.firstName || ''} ${matches[0].personalInfo?.lastName || ''}`.trim(),
        matchType: 'single_word',
      };
    }
    if (matches.length > 1) {
      return { status: 'ambiguous', candidateCount: matches.length, importedName: name };
    }
    return { status: 'unresolved', importedName: name };
  }

  // Multi-word: try "firstName lastName" and "lastName firstName" orderings
  const part1 = parts[0].toLowerCase();
  const part2 = parts.slice(1).join(' ').toLowerCase();

  const matches = teachers.filter(t => {
    const fn = (t.personalInfo?.firstName || '').trim().toLowerCase();
    const ln = (t.personalInfo?.lastName || '').trim().toLowerCase();
    return (fn === part1 && ln === part2) || (fn === part2 && ln === part1);
  });

  if (matches.length === 1) {
    return {
      status: 'resolved',
      teacherId: matches[0]._id.toString(),
      teacherName: `${matches[0].personalInfo?.firstName || ''} ${matches[0].personalInfo?.lastName || ''}`.trim(),
      matchType: 'name',
    };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', candidateCount: matches.length, importedName: name };
  }
  return { status: 'unresolved', importedName: name };
}
```

### Pattern 2: teacherAssignment Entry for Import (Bypass Joi)
**What:** Create a minimal teacherAssignment without schedule fields (day/time/duration).
**Why:** The Joi schema in `student.validation.js` (line 49-86) and `student-assignments.validation.js` (line 22-152) both require `day`, `time`, and `duration` as `.required()`. Ministry files do not provide these fields for the teacher-student relationship. The import must bypass Joi and write directly via MongoDB `$push`.

```javascript
// Source: Derived from student.service.js addStudentToTeacher (line 744-752)
// Minimal assignment entry for import -- no schedule fields
const importAssignment = {
  teacherId: matchResult.teacherId,        // ObjectId string
  scheduleSlotId: null,
  startDate: new Date(),
  endDate: null,
  isActive: true,
  notes: null,
  source: 'ministry_import',              // NEW: marks origin for future differentiation
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

**Critical detail:** The existing `addStudentToTeacher()` in student.service.js (line 744) already creates assignments WITHOUT `day`, `time`, `duration`, and `scheduleInfo` -- it only sets `teacherId`, `scheduleSlotId: null`, dates, `isActive`, and `notes`. This is the exact pattern the import should follow. The Joi validation is only applied when assignments come through the API/UI path, not when written directly via MongoDB operations.

### Pattern 3: Persisting Match Results in import_log
**What:** Store teacher match results in the preview data that gets saved to `import_log`, so execute never re-runs matching.
**When:** During `previewStudentImport`, before saving the import_log entry.

```javascript
// On each matched entry:
const entry = {
  row: i + 2,
  matchType: match.matchType,
  studentId: match.student._id.toString(),
  studentName: '...',
  importedName: '...',
  changes,
  mapped,
  teacherMatch: matchResult,  // NEW: { status, teacherId?, teacherName?, matchType?, importedName? }
};

// On each notFound entry:
preview.notFound.push({
  row: i + 2,
  importedName: '...',
  mapped,
  teacherMatch: matchResult,  // NEW: same structure
});
```

### Pattern 4: Preventing Duplicate Assignments
**What:** Before creating a teacherAssignment, check if the student already has an active assignment to the same teacher.
**Why:** Re-importing a file should not create duplicate assignments. A student may already be linked to the teacher from a previous import or manual assignment.

```javascript
// During execute, check existing assignments before $push
const existingAssignments = student.teacherAssignments || [];
const alreadyLinked = existingAssignments.some(
  a => a.teacherId === teacherMatch.teacherId && a.isActive
);
if (alreadyLinked) {
  // Skip -- already linked, no duplicate needed
  continue;
}
```

For matched students (where the student doc is already in the DB), the execute loop needs to check existing assignments. For new students (notFound), the initial document starts with `teacherAssignments: []`, so no duplicate check is needed.

### Anti-Patterns to Avoid
- **Routing import assignments through Joi validation:** The Joi schema requires day/time/duration. Import data does not have these. Do NOT modify the Joi schema to make them optional -- that weakens validation for all other paths. Instead, bypass Joi for import assignments.
- **Re-running teacher matching during execute:** Matching should happen ONCE during preview and be persisted in import_log. Execute reads the stored match result. This is consistent with how student matching works (matched/notFound determined at preview, execute reads from log).
- **Setting day/time/duration to dummy values:** Do not set `day: 'ראשון'`, `time: '08:00'`, `duration: 30` as placeholders. These would appear in the schedule UI as real lessons. Leave these fields absent from the import assignment.
- **Modifying the teacherAssignment Joi schema:** Do NOT change the required fields to optional. The schema correctly enforces schedule data for UI-created assignments. Import is a special case that bypasses it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name matching logic | Complex NLP or fuzzy matching | Simple split + both-orderings comparison | Hebrew names have 2 orderings max; existing matchTeacher uses same pattern |
| Assignment creation | Custom assignment builder | Follow addStudentToTeacher pattern (student.service.js line 744) | Already proven, minimal fields, no Joi needed |
| Duplicate detection | Full diff of assignment arrays | Simple `teacherAssignments.some(a => a.teacherId === id && a.isActive)` | Only need to check if same teacher already linked |
| Teacher list fetch | Per-row teacher queries | Single `teacherCollection.find({ isActive: true, tenantId }).toArray()` at start | Same pattern as student list fetch in previewStudentImport (line 1597) |

**Key insight:** The existing `matchTeacher()` function (line 1110-1141) already does firstName+lastName matching for the teacher import flow. The student import needs the INVERSE: given a single name string, split it and try both orderings against the teacher list. The core matching logic is the same, just the input format differs.

## Common Pitfalls

### Pitfall 1: Teacher Name Ordering Ambiguity
**What goes wrong:** Ministry files may store the teacher name as "lastName firstName" in one file and "firstName lastName" in another. A naive "first word = firstName, rest = lastName" approach will fail for one ordering.
**Why it happens:** Hebrew naming conventions are not standardized across Ministry Excel templates. Some districts use "surname first" ordering.
**How to avoid:** Try BOTH orderings: (a) `parts[0]` as firstName and `parts.slice(1)` as lastName, (b) `parts.slice(1)` as firstName and `parts[0]` as lastName. If exactly one teacher matches in either ordering, it is resolved.
**Warning signs:** Many "unresolved" teacher names when the teachers actually exist in the system -- indicates wrong ordering assumption.

### Pitfall 2: Duplicate teacherAssignment on Re-Import
**What goes wrong:** Importing the same file twice creates duplicate teacherAssignment entries on students, each pointing to the same teacher.
**Why it happens:** Execute blindly `$push`es a new assignment without checking if one already exists.
**How to avoid:** Before `$push`, check if `teacherAssignments` already contains an active entry with the same `teacherId`. If so, skip the push. For new students, this is not an issue (first insert creates the array).
**Warning signs:** Students appearing with 2+ identical teacher assignments in the UI.

### Pitfall 3: Joi Validation Blocking Import Assignments
**What goes wrong:** Attempting to create assignments through the normal validation pipeline fails because Ministry files have no day/time/duration data.
**Why it happens:** `teacherAssignmentSchema` (student.validation.js line 49-86) requires `day`, `time`, and `duration`. These are NOT optional.
**How to avoid:** Write directly via MongoDB `$push` (same as `addStudentToTeacher` in student.service.js line 744-760). Do NOT route through Joi validation for import-created assignments.
**Warning signs:** Joi error: "יום הוא שדה חובה" (day is required), "שעה היא שדה חובה" (time is required).

### Pitfall 4: Teacher ID Serialization in import_log
**What goes wrong:** Teacher `_id` is an ObjectId in MongoDB but gets stored as a string in the preview data. When execute reads it back from import_log, the type must be consistent.
**Why it happens:** MongoDB serializes ObjectId to `{ "$oid": "..." }` in some contexts, and `toString()` gives a hex string.
**How to avoid:** Always store `teacherId` as `teacher._id.toString()` (hex string) in the preview match result. This matches how the existing code stores `entry.studentId` (line 1673).
**Warning signs:** `ObjectId.createFromHexString()` throwing on a non-hex value.

### Pitfall 5: teacherName Change Still Showing in Preview After Matching
**What goes wrong:** The `calculateStudentChanges` function still pushes a `teacherName` change (line 1422-1428) even though Phase 17 now handles teacher matching separately. This creates confusing duplicate information in the preview.
**Why it happens:** Phase 16 added `teacherName` to the change detection as a placeholder for Phase 17.
**How to avoid:** Remove or replace the `teacherName` change push from `calculateStudentChanges`. Instead, the teacher match result is stored separately on the preview entry as `teacherMatch`. The frontend should display the teacher match status badge, not the raw name change diff.
**Warning signs:** Preview showing both a "teacherName changed" diff entry AND a teacher match badge for the same row.

### Pitfall 6: Matched Student Already Has Assignments From UI
**What goes wrong:** An existing student already has a teacherAssignment to teacher A (created via UI with full schedule data). Import links them to teacher B. Now the student has two assignments. This is correct behavior (a student can have multiple teachers), but the import should NOT overwrite or remove the existing assignment.
**Why it happens:** Import adds new teacher links without touching existing ones.
**How to avoid:** Use `$push` to ADD the new assignment rather than `$set` on the entire `teacherAssignments` array. This preserves all existing assignments. For matched students where the import teacher is the SAME as an existing teacher, skip the push (duplicate detection).
**Warning signs:** Existing UI-created assignments disappearing after import.

## Code Examples

### Example 1: matchTeacherByName Function
```javascript
// Source: New function for api/import/import.service.js
/**
 * Match a teacher name string (from "המורה" column) against the tenant's teacher list.
 * Handles both "firstName lastName" and "lastName firstName" orderings.
 * Returns: { status: 'resolved'|'unresolved'|'ambiguous'|'none', teacherId?, teacherName?, ... }
 */
function matchTeacherByName(nameString, teachers) {
  if (!nameString || !String(nameString).trim()) {
    return { status: 'none' };
  }

  const name = String(nameString).trim();
  const parts = name.split(/\s+/);

  if (parts.length < 2) {
    // Single word name -- try against both firstName and lastName
    const word = parts[0].toLowerCase();
    const matches = teachers.filter(t =>
      (t.personalInfo?.firstName || '').trim().toLowerCase() === word ||
      (t.personalInfo?.lastName || '').trim().toLowerCase() === word
    );
    if (matches.length === 1) {
      return {
        status: 'resolved',
        teacherId: matches[0]._id.toString(),
        teacherName: `${matches[0].personalInfo?.firstName || ''} ${matches[0].personalInfo?.lastName || ''}`.trim(),
        matchType: 'single_word',
      };
    }
    if (matches.length > 1) {
      return { status: 'ambiguous', candidateCount: matches.length, importedName: name };
    }
    return { status: 'unresolved', importedName: name };
  }

  // Two+ words: try both orderings
  const part1 = parts[0].toLowerCase();
  const part2 = parts.slice(1).join(' ').toLowerCase();

  const matches = teachers.filter(t => {
    const fn = (t.personalInfo?.firstName || '').trim().toLowerCase();
    const ln = (t.personalInfo?.lastName || '').trim().toLowerCase();
    return (fn === part1 && ln === part2) || (fn === part2 && ln === part1);
  });

  if (matches.length === 1) {
    return {
      status: 'resolved',
      teacherId: matches[0]._id.toString(),
      teacherName: `${matches[0].personalInfo?.firstName || ''} ${matches[0].personalInfo?.lastName || ''}`.trim(),
      matchType: 'name',
    };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', candidateCount: matches.length, importedName: name };
  }
  return { status: 'unresolved', importedName: name };
}
```

### Example 2: Preview Integration (previewStudentImport changes)
```javascript
// Source: Modifications to previewStudentImport in api/import/import.service.js
// At the top of the function, after fetching students:
const teacherCollection = await getCollection('teacher');
const teachers = await teacherCollection.find({ isActive: true, tenantId }).toArray();

// Add teacher match summary to preview:
const preview = {
  totalRows: rows.length,
  matched: [],
  notFound: [],
  errors: [],
  warnings: [],
  headerRowIndex,
  matchedColumns,
  teacherMatchSummary: { resolved: 0, unresolved: 0, ambiguous: 0, none: 0 },
};

// Inside the row loop, after matchStudent():
const teacherMatch = matchTeacherByName(mapped.teacherName, teachers);
preview.teacherMatchSummary[teacherMatch.status]++;

// Add warning for unresolved/ambiguous:
if (teacherMatch.status === 'unresolved') {
  preview.warnings.push({
    row: i + 2,
    field: 'teacherName',
    message: `המורה "${teacherMatch.importedName}" לא נמצא ברשימת המורים`,
  });
}
if (teacherMatch.status === 'ambiguous') {
  preview.warnings.push({
    row: i + 2,
    field: 'teacherName',
    message: `נמצאו ${teacherMatch.candidateCount} מורים עם שם דומה ל-"${teacherMatch.importedName}"`,
  });
}

// Attach teacherMatch to both matched and notFound entries:
// On matched entries:
const entry = { ..., teacherMatch };
// On notFound entries:
preview.notFound.push({ ..., teacherMatch });
```

### Example 3: Execute Integration (creating teacherAssignment)
```javascript
// Source: Modifications to executeStudentImport in api/import/import.service.js

// For matched students (existing students):
for (const entry of matched) {
  // ... existing change application logic ...

  // NEW: Create teacherAssignment if teacher was resolved
  const teacherMatch = entry.teacherMatch;
  if (teacherMatch?.status === 'resolved') {
    // Check for duplicate before pushing
    const existingStudent = await studentCollection.findOne(
      { _id: ObjectId.createFromHexString(entry.studentId), tenantId },
      { projection: { teacherAssignments: 1 } }
    );
    const alreadyLinked = (existingStudent?.teacherAssignments || []).some(
      a => a.teacherId === teacherMatch.teacherId && a.isActive !== false
    );

    if (!alreadyLinked) {
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(entry.studentId), tenantId },
        {
          $push: {
            teacherAssignments: {
              teacherId: teacherMatch.teacherId,
              scheduleSlotId: null,
              startDate: new Date(),
              endDate: null,
              isActive: true,
              notes: null,
              source: 'ministry_import',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        }
      );
    }
  }
}

// For new students (notFound): include assignment in initial document
for (const entry of notFound) {
  const teacherMatch = entry.teacherMatch;
  const newStudent = {
    // ... existing fields ...
    teacherAssignments: teacherMatch?.status === 'resolved' ? [{
      teacherId: teacherMatch.teacherId,
      scheduleSlotId: null,
      startDate: new Date(),
      endDate: null,
      isActive: true,
      notes: null,
      source: 'ministry_import',
      createdAt: new Date(),
      updatedAt: new Date(),
    }] : [],
    // ... rest of document ...
  };
}
```

### Example 4: Removing teacherName From calculateStudentChanges
```javascript
// Source: api/import/import.service.js, calculateStudentChanges function
// REMOVE these lines (1421-1428):
//   if (mapped.teacherName && String(mapped.teacherName).trim()) {
//     changes.push({
//       field: 'teacherName',
//       oldValue: null,
//       newValue: mapped.teacherName,
//     });
//   }
// AND REMOVE the execute skip logic (line 1868-1871):
//   if (change.field === 'teacherName') {
//     continue;
//   }
// Teacher matching is now handled via teacherMatch on the preview entry,
// not via the changes array.
```

## State of the Art

| Old Approach (Phase 16) | New Approach (Phase 17) | Impact |
|--------------------------|------------------------|--------|
| `teacherName` as display-only change | `teacherMatch` with resolved/unresolved/ambiguous status | Preview shows actionable match status, not just raw name |
| Execute skips `teacherName` changes | Execute creates `teacherAssignment` for resolved matches | Students are actually linked to their teachers |
| `teacherAssignments: []` on new students | `teacherAssignments: [{ teacherId, ... }]` when resolved | New students start linked to their teacher |
| No teacher fetch during student preview | Teachers loaded once at start of preview | Enables name matching without per-row DB queries |

**Deprecated after Phase 17:**
- `teacherName` field in `calculateStudentChanges` changes array -- replaced by `teacherMatch` on preview entries
- The `if (change.field === 'teacherName') continue;` skip in execute -- no longer needed since teacherName is removed from changes

## Open Questions

1. **Should `source: 'ministry_import'` be added to all import-created assignments?**
   - What we know: Existing `addStudentToTeacher()` does not set a `source` field. The teacherAssignment schema in Joi does not validate for `source`.
   - What's unclear: Whether downstream code checks for `source` or if adding it causes issues.
   - Recommendation: **Yes, add `source: 'ministry_import'`.** MongoDB is schema-less, so adding an extra field to the assignment object is safe. No Joi validation is applied on this path. This allows future features to distinguish import-created assignments from manually-created ones (e.g., for cleanup, reporting, or UI display). If the planner disagrees, omit it -- the feature works without it.

2. **Should the execute path read the student document to check for duplicate assignments?**
   - What we know: For matched students, we need to check if a teacherAssignment to the same teacher already exists. This requires reading the student document.
   - What's unclear: Performance impact of an extra `findOne` per matched student with a resolved teacher.
   - Recommendation: **Yes, check for duplicates.** The alternative (blindly `$push` and accept duplicates) creates data quality issues. The extra read is minimal -- one small projection per matched student, which is typically dozens of rows, not thousands. Alternatively, combine the duplicate check with the existing `updateOne` by adding a filter condition: `{ _id: ..., 'teacherAssignments.teacherId': { $ne: teacherMatch.teacherId } }` -- this makes the update a no-op if the teacher is already linked, avoiding the extra read entirely.

3. **How to handle students where executeStudentImport currently has both changes AND a teacher link?**
   - What we know: The current execute loop processes `entry.changes`. Teacher linking is a separate concern (not in the changes array).
   - What's unclear: Whether the teacher assignment `$push` should be combined into the same `updateOne` as the field changes, or done as a separate operation.
   - Recommendation: **Combine into the same `updateOne`.** The `$push` and `$set` operators can coexist in a single `updateOne` call (this is already proven by the instrumentProgress `$push` logic added in Phase 16-02, line 1901-1913). This is more atomic and reduces DB round-trips.

## Sources

### Primary (HIGH confidence)
- `api/import/import.service.js` -- Full import pipeline including STUDENT_COLUMN_MAP (line 114-136), matchStudent (line 1143-1160), calculateStudentChanges with teacherName handling (line 1342-1431), previewStudentImport (line 1586-1711), executeStudentImport with teacherName skip (line 1842-2016)
- `api/student/student.validation.js` -- teacherAssignmentSchema with required day/time/duration (line 49-86), studentSchema (line 89-143)
- `api/student/student-assignments.validation.js` -- Enhanced teacherAssignment validation also requiring day/time/duration (line 22-152)
- `api/student/student.service.js` -- addStudentToTeacher pattern without day/time/duration (line 744-760), duplicate check pattern (line 684-691)
- `api/teacher/teacher.service.js` -- addStudentToTeacher with schedule variant (line 560-581), matchTeacher reference (for matching pattern)
- `.planning/phases/16-instrument-progress-student-data-enrichment/16-01-PLAN.md` -- Phase 16 planning noting teacherName as Phase 17 concern
- `.planning/phases/16-instrument-progress-student-data-enrichment/16-02-PLAN.md` -- Phase 16 execute noting teacherName skip and $push + $set coexistence

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- Phase 17 success criteria and requirements (TLNK-01, TLNK-02, TLNK-03)
- `.planning/phases/16-instrument-progress-student-data-enrichment/16-RESEARCH.md` -- Phase 16 research confirming Joi bypass approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing codebase analysis
- Architecture: HIGH -- all patterns derived from reading actual production code; teacherAssignment shape verified from 3 independent code paths (student.service, teacher.service, time-block.service)
- Teacher name matching: HIGH -- pattern derived from existing matchTeacher + matchStudent functions in same file
- Joi bypass approach: HIGH -- confirmed by Phase 16 research and planning, verified by reading both Joi schemas (day/time/duration are `required()`), and verified by existing `addStudentToTeacher()` which also does raw `$push` without Joi
- Duplicate prevention: HIGH -- pattern verified from `isTeacherOfStudent` check in student.service.js (line 684-691)
- Pitfalls: HIGH -- identified from actual Joi schema constraints, serialization patterns, and re-import scenarios

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable internal codebase, no external dependency changes)
