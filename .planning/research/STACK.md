# Technology Stack — Student Import Enhancement

**Project:** Tenuto.io v1.2 — Enhanced Student Import
**Researched:** 2026-02-26
**Scope:** Stack ADDITIONS and CHANGES ONLY — existing backend/frontend stack is validated and unchanged.

---

## What Is Already In Place (Do Not Re-Evaluate)

| Technology | Version | Status |
|------------|---------|--------|
| Node.js + Express | existing | LOCKED — no changes |
| MongoDB native driver | ^6.13.0 | LOCKED — no changes |
| ExcelJS | ^4.4.0 | LOCKED — already in use for teacher import |
| multer (memoryStorage) | ^1.4.5-lts.1 | LOCKED — already handles file upload |
| Joi | ^17.13.3 | LOCKED — student validation schema complete |
| React 18 + TypeScript + Vite + Tailwind | existing | LOCKED — no changes |
| @phosphor-icons/react | ^2.1.10 | LOCKED — all icons available |
| react-hot-toast | ^2.6.0 | LOCKED — toast notifications in use |

---

## Stack Decisions for New Capabilities

### 1. Teacher-Name Fuzzy Matching

**Decision: Use native JavaScript — NO new library.**

The existing teacher import already performs exact name matching (`matchTeacher` at line 1079 of `import.service.js`) using first+last name lowercased comparison. The `"המורה"` column is already parsed into `mapped.teacherName` via `STUDENT_COLUMN_MAP` (line 130). The only missing piece is a `matchTeacherByName` helper that splits the `teacherName` string and runs the same exact match used by `matchTeacher`.

Rationale for no fuzzy library:
- Ministry Excel files have authoritative teacher names — the conservatory imports their own staff, so names match precisely or not at all.
- Fuzzy matching would introduce false positives across a small teacher pool (typical: 20-80 teachers per tenant).
- `fast-fuzzy`, `fuse.js`, and `string-similarity` were verified to be absent from both package.json files. Adding any of them for this use case is over-engineering.
- The existing `matchTeacher` already handles the name-match case (priority 3). A parallel `matchTeacherForStudent(teacherNameString, teachers)` function using the same lowercased first+last comparison is sufficient.

**Implementation:** Pure JS in `import.service.js` — split `teacherName` on first space, compare lowercased first and last name. Return `{ teacher, matchType: 'name' } | null`.

Confidence: HIGH (code analysis — no library needed)

---

### 2. instrumentProgress Document Building

**Decision: Build inline in `executeStudentImport` — NO new library.**

The existing `studentSchema` (Joi, `student.validation.js` line 12-46) defines `instrumentProgress` as an array of objects with:
- `instrumentName` (string, VALID_INSTRUMENTS)
- `isPrimary` (boolean, default false)
- `currentStage` (number 1-8)
- `ministryStageLevel` (string א/ב/ג, nullable)
- `tests.stageTest` / `tests.technicalTest` (default objects)

The current `executeStudentImport` writes a flat `instrument` field (line 1799) that does NOT match the schema. This is the core gap.

The fix is to build an `instrumentProgress` array entry from the already-parsed `mapped.instrument` and `mapped.ministryStageLevel` during the execute phase. No validation library beyond the existing Joi schema is needed — the student service's `validateStudent()` already validates this shape.

Stage mapping: `ministryStageLevel` (א/ב/ג) maps to `currentStage` using the inverse of the existing `stageToMinistryLevel` function (already in `constants.js` at line 163):
- א → stage 1 (lowest in the א range, safe default)
- ב → stage 4 (lowest in the ב range)
- ג → stage 6 (lowest in the ג range)

Confidence: HIGH (schema is defined, constants exist, implementation is pure assembly)

---

### 3. Bagrut Flag

**Decision: Add boolean field to student document — NO new collection interaction during import.**

The PROJECT.md explicitly scopes this as: "only flag enrollment, manual setup for program details" (line 66). The existing `bagrut` collection and `setBagrutId` service exist for full bagrut record management.

For import, the approach is:
- Add `'בגרות': 'isBagrutCandidate'` and `'מגמת מוסיקה': 'isBagrutCandidate'` entries to `STUDENT_COLUMN_MAP`.
- Store `academicInfo.isBagrutCandidate: true/false` on the student document during execute.
- No bagrut collection record created — that requires program data that Ministry import does not contain.

This field is NOT in the current `studentSchema` — it needs to be added to the Joi schema as `Joi.boolean().default(false)`. This is a backward-compatible addition (existing documents without the field treat it as falsy).

Confidence: HIGH (codebase analysis confirms field does not exist, scope is clear from PROJECT.md)

---

### 4. teacherAssignment Creation

**Decision: Build minimal teacherAssignment entry WITHOUT schedule slot — NO new service dependency.**

The `teacherAssignmentSchema` (Joi, `student.validation.js` line 49-86) requires `day`, `time`, and `duration` fields which the Ministry Excel file does not contain. However, schedule data is not available at import time.

**Recommended approach:** Write a minimal import-shaped assignment object directly to the student document, bypassing the full `teacherAssignmentSchema` Joi validation. This is consistent with how `executeTeacherImport` writes `$set` patches directly without Joi re-validation:

```javascript
{
  teacherId: matchedTeacher._id.toString(),
  instrumentName: mapped.instrument || null,
  scheduleSlotId: null,
  day: null,        // populated later via schedule UI
  time: null,       // populated later via schedule UI
  duration: mapped.lessonDuration || null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  importedFrom: 'excel',  // import origin marker
}
```

**Teacher record sync:** After writing each student assignment, issue a direct `$push` to the teacher collection to add the student reference. The existing `syncTeacherRecordsForStudentUpdate` in `student.service.js` can be imported, OR a lightweight direct write suffices since import runs as admin.

Confidence: MEDIUM — Joi schema relaxation for import writes is a judgment call, but consistent with the established teacher import pattern.

---

### 5. Frontend Preview Enhancement

**Decision: Extend `ImportData.tsx` types inline — NO new UI library.**

The existing `ImportData.tsx` already has the full preview UI structure. Needed changes:

- Add `teacherName?: string` and `teacherMatchType?: 'name' | 'not_found'` to the preview row interface.
- Add `instrumentProgress?: Array<{instrumentName: string, currentStage: number, ministryStageLevel: string}>` to preview row interface.
- Add `isBagrutCandidate?: boolean` to preview row interface.
- Extend the student branch of the preview table (currently lines 832-845) to show these new fields — similar to how `getTeacherRowDetails` renders teacher data.

The preview table currently renders only "תלמיד חדש - ייווצר ברשומה חדשה" for new students and bare `row.changes.map(c => c.field).join(', ')` for matched students. This needs to be replaced with a richer summary showing instrument, stage level, teacher match, class, and bagrut flag.

All icons needed are already available in `@phosphor-icons/react` (^2.1.10, installed).

Confidence: HIGH (existing UI pattern is clear, all dependencies available)

---

## What NOT to Add

| Rejected Addition | Why Not |
|-------------------|---------|
| `fuse.js` / `fast-fuzzy` for teacher matching | Small, authoritative teacher pool — exact match is sufficient and safer |
| `natural` / `compromise` NLP library | Zero Hebrew NLP support; overkill for name splitting |
| `bull` / `bullmq` job queue | Not needed — imports are small (under 300 rows), complete synchronously in < 2 seconds |
| MongoDB transactions in `executeStudentImport` | Teacher import does not use transactions; scale does not require them |
| New API endpoints | Existing `/import/students/preview` and `/import/execute/:id` are reused |
| React Query mutation for import | Frontend already uses raw `fetch` with FormData; consistency favored |
| New collection for import state | `import_log` collection already exists and stores preview data by `importLogId` |
| Full bagrut record creation during import | Out of scope per PROJECT.md — only flag, not full bagrut record |
| Orchestra/ensemble auto-assignment | Out of scope per PROJECT.md |
| Theory class enrollment from import | Requires matching to existing theory lesson documents — out of scope |

---

## Integration Points

### Backend: Files to Modify

| File | Change Type | What Changes |
|------|------------|--------------|
| `api/import/import.service.js` | Enhance | `STUDENT_COLUMN_MAP` adds bagrut columns; `previewStudentImport` fetches teachers and runs `matchTeacherForStudent`; new `matchTeacherForStudent` helper; `calculateStudentChanges` adds instrumentProgress + teacher + bagrut diff fields; `executeStudentImport` builds `academicInfo.instrumentProgress` array and writes `teacherAssignments` entry |
| `config/constants.js` | Enhance | Add `MINISTRY_STAGE_TO_STAGE` inverse map (א→1, ב→4, ג→6) for import use |
| `api/student/student.validation.js` | Enhance | Add `isBagrutCandidate: Joi.boolean().default(false)` to `academicInfo` in both `studentSchema` and `studentUpdateSchema` |

### Frontend: Files to Modify

| File | Change Type | What Changes |
|------|------------|--------------|
| `src/pages/ImportData.tsx` | Enhance | Update TypeScript interfaces; replace plain "תלמיד חדש" string with rich preview card showing teacher match status, instrument + stage level, class, and bagrut flag; add teacher match status badge for matched students |
| `src/services/apiService.js` | No change | Existing `previewStudentImport` and `executeImport` already call correct endpoints |

### No New Files Required

All logic fits in existing files. The enhancement is purely additive — no new modules, controllers, or routes needed.

---

## Version Verification

| Package | Current Version | Upgrade Needed |
|---------|----------------|----------------|
| exceljs | ^4.4.0 | No — handles all parsing needed |
| joi | ^17.13.3 | No — schema additions are backward compatible |
| mongodb | ^6.13.0 | No — direct document writes are unchanged |
| typescript | ^5.9.3 | No — type additions are purely additive |

Confidence: HIGH — all packages verified from both `package.json` files.

---

## Summary: Zero New Dependencies

This milestone requires **zero new npm packages** on either backend or frontend. Every capability needed — Excel parsing, name matching, document validation, UI rendering, toast notifications, icons — is already present in the installed stack. The work is purely configuration and logic enhancement within existing files.

---

## Sources

- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/api/import/import.service.js` (1957 lines — full code analysis, teacher and student import flows)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/api/student/student.validation.js` (244 lines — full read, instrumentProgress and teacherAssignment schemas)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/api/student/student.service.js` (addStudent and updateStudent flows, lines 110-260)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/config/constants.js` (full read — stageToMinistryLevel at line 163, COLLECTIONS at line 214)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Backend/.planning/PROJECT.md` (scope and out-of-scope constraints)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/pages/ImportData.tsx` (preview UI structure — ImportData.tsx analyzed lines 1-950)
- `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src/services/apiService.js` (importService block, lines 5071-5160)
- Both `package.json` files verified for installed packages (backend and frontend)
