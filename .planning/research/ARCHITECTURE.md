# Architecture Patterns: Ensemble Import Integration

**Domain:** Ensemble/Orchestra Import from Ministry Excel
**Researched:** 2026-02-28
**Confidence:** HIGH (based on direct codebase analysis, no external sources needed)

## Executive Summary

The ensemble import feature must integrate with an established import system that follows a clear preview-then-execute pattern. The existing codebase has three import types (teachers, students, conservatory) that share a common controller/route infrastructure and a unified `executeImport` dispatcher. The ensemble import is most similar to the **student import** (tabular Excel, entity matching, conductor matching) but creates/updates **orchestra** documents rather than student documents. This document specifies exactly which files change, which are new, and how data flows through the system.

## Recommended Architecture

### Pattern: Extend Import Service (Do NOT Create Separate Parser File)

The conservatory import was form-based (fixed cell addresses) and could have justified a separate parser. But ensemble import is **tabular** -- same parsing pattern as teacher/student import. Add it directly to `import.service.js` as `previewEnsembleImport` and the corresponding execute function.

**Rationale:**
- Teacher and student imports both live in `import.service.js` (the tabular pattern home)
- The conservatory import also lives in `import.service.js` despite being form-based
- Creating a separate `ensemble-import.service.js` would break the established single-file pattern
- All imports share the same column-mapping, header-detection, and SheetJS/ExcelJS infrastructure
- The unified `executeImport` dispatcher already routes by `importType` string

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `import.service.js` | New: `previewEnsembleImport`, `executeEnsembleImport` + column map + matching logic | orchestra collection, teacher collection, rehearsal collection, import_log collection |
| `import.controller.js` | New: `previewEnsembleImport` handler (same pattern as existing 3) | import.service.js |
| `import.route.js` | New: `POST /ensembles/preview` route | import.controller.js |
| `orchestra.service.js` | Existing: `addOrchestra`, `updateOrchestra` (called during execute) | orchestra collection, teacher collection |
| `rehearsal.service.js` | Existing: `addRehearsal` or `bulkCreateRehearsals` (called during execute for schedule) | rehearsal collection |
| `apiService.js` (frontend) | New: `previewEnsembleImport(file)` method | backend /api/import/ensembles/preview |
| `ImportData.tsx` (frontend) | New: 4th tab `'ensembles'` with ensemble-specific preview rendering | apiService.importService |

### Data Flow

```
[Excel Upload] --> multer memoryStorage --> req.file.buffer
  --> previewEnsembleImport(buffer, { context })
    --> parseExcelBufferWithHeaderDetection(buffer, ENSEMBLE_COLUMN_MAP)
    --> matchOrchestra(parsed, existingOrchestras)
    --> matchTeacherByName(conductorName, teachers)
    --> calculateChanges(existing, imported)
    --> save to import_log { importType: 'ensembles', status: 'pending', preview, parsedData }
    --> return { importLogId, preview }

[Execute] --> POST /import/execute/:importLogId
  --> executeImport(importLogId)
    --> importType === 'ensembles' --> executeEnsembleImport(log, ...)
      --> for each matched: updateOrchestra fields + update/create rehearsals
      --> for each notFound: addOrchestra + create rehearsals
      --> update import_log status
```

## Integration Points: New vs Modified

### New Code (create from scratch)

| What | Where | Description |
|------|-------|-------------|
| `ENSEMBLE_COLUMN_MAP` | `import.service.js` (constant) | Hebrew header to internal key mapping for ensemble sheet columns |
| `previewEnsembleImport()` | `import.service.js` (function) | Parse Excel, match orchestras, match conductors, build preview |
| `executeEnsembleImport()` | `import.service.js` (function) | Apply previewed changes to orchestra and rehearsal collections |
| `matchOrchestra()` | `import.service.js` (function) | Match imported row to existing orchestra by name within tenant |
| `calculateEnsembleChanges()` | `import.service.js` (function) | Diff imported data against existing orchestra fields |
| `previewEnsembleImport` handler | `import.controller.js` (function) | Controller wrapper, same pattern as existing 3 |
| `previewEnsembleImport` method | `apiService.js` (frontend) | API client method for ensemble import |
| Ensemble preview rendering | `ImportData.tsx` (frontend) | 4th tab + ensemble-specific preview table |

### Modified Code (add to existing)

| What | Where | Change |
|------|-------|--------|
| `importService` export | `import.service.js` line 31-37 | Add `previewEnsembleImport` to exported object |
| `executeImport` dispatcher | `import.service.js` line 2062-2071 | Add `else if (log.importType === 'ensembles')` branch |
| `importController` export | `import.controller.js` line 3-8 | Add `previewEnsembleImport` to exported object |
| Route registration | `import.route.js` | Add `POST /ensembles/preview` route (4 lines) |
| `ImportTab` type | `ImportData.tsx` line 20 | Change to `'teachers' \| 'students' \| 'conservatory' \| 'ensembles'` |
| Tab buttons | `ImportData.tsx` ~line 807-838 | Add 4th tab button for ensembles |
| `handleUpload` | `ImportData.tsx` ~line 681-699 | Add `activeTab === 'ensembles'` branch |
| `importService` object | `apiService.js` ~line 5071 | Add `previewEnsembleImport` method |

### Unchanged Code (reuse as-is)

| What | Why Unchanged |
|------|---------------|
| `parseExcelBufferWithHeaderDetection()` | Generic tabular parser, works with any column map |
| `matchTeacherByName()` | Already handles conductor matching (used in student import) |
| `executeImport()` | Only needs new `else if` branch, dispatcher logic unchanged |
| `orchestra.validation.js` | Validate during execute via existing `validateOrchestra()` |
| `rehearsal.validation.js` | Validate rehearsals via existing `validateRehearsal()` |
| multer config | Same `importUpload` instance, same file size/type limits |
| `import_log` collection | Same collection, new `importType: 'ensembles'` |

## Key Design Decisions

### 1. Orchestra Matching Strategy: Name-Based (Primary) + Type Disambiguation

**Decision:** Match by `name` (case-insensitive, trimmed) within the tenant. If multiple orchestras share the same name, disambiguate by `type` (ensemble/orchestra) and `subType`.

**Rationale:**
- Orchestra names are unique within a conservatory in practice (no one names two ensembles identically)
- The Ministry Excel has the name in column C ("ensemble/orchestra name")
- Unlike teachers (email, ID number, name), orchestras have no persistent identifier across systems
- conductorId is NOT a reliable match key: conductors change between years, and the same conductor may lead multiple ensembles
- Name + type + subType provides sufficient disambiguation for the rare edge case

**Match algorithm:**
```javascript
function matchOrchestra(parsed, orchestras) {
  const name = parsed.name?.trim().toLowerCase();
  if (!name) return null;

  const matches = orchestras.filter(o =>
    (o.name || '').trim().toLowerCase() === name
  );

  if (matches.length === 1) return { orchestra: matches[0], matchType: 'name' };
  if (matches.length > 1) {
    // Disambiguate by subType if available
    if (parsed.subType) {
      const subMatch = matches.find(o => o.subType === parsed.subType);
      if (subMatch) return { orchestra: subMatch, matchType: 'name_subtype' };
    }
    return { orchestra: matches[0], matchType: 'name_ambiguous', duplicateCount: matches.length };
  }
  return null; // Not found -- will create new
}
```

### 2. Schedule Storage: Store as `scheduleSlots` on Orchestra During Import, Create Rehearsals on Execute

**Decision:** During **preview**, parse schedule data (day, startTime, endTime) and store in `parsedData` on the import log. During **execute**, store a lightweight `scheduleSlots` array directly on the orchestra document AND optionally create rehearsal documents.

**Rationale:**
- The Ministry Excel contains **weekly schedule templates** (Activity I: day+time, Activity II: day+time), not individual rehearsal instances
- Creating individual rehearsal documents requires a date range (school year start/end) and generates many documents (30-40 per slot per year)
- The export mapper `mapEnsembleSchedule()` already reads rehearsal documents to reconstruct the schedule -- this is the round-trip contract
- For import, we need BOTH:
  - (a) Quick schedule storage on the orchestra doc for immediate display (`scheduleSlots` field)
  - (b) Rehearsal documents for the export round-trip and attendance tracking

**Orchestra document addition:**
```javascript
// New field on orchestra document (alongside existing fields)
scheduleSlots: [
  { dayOfWeek: 1, startTime: '14:00', endTime: '16:00', label: 'Activity I' },
  { dayOfWeek: 3, startTime: '15:00', endTime: '17:00', label: 'Activity II' },
]
```

**Execute strategy:**
1. Save `scheduleSlots` on the orchestra document (fast, always)
2. Use `rehearsalService.bulkCreateRehearsals()` to generate actual rehearsal instances for the current school year (generates weekly occurrences from school year start to end)
3. Link rehearsal IDs back to `orchestra.rehearsalIds`

**Important:** The `orchestraSchema` in `orchestra.validation.js` will need a new optional `scheduleSlots` field. This is a minor schema addition, not a rewrite.

### 3. Conductor Matching: Reuse `matchTeacherByName()` Directly

**Decision:** Reuse the existing `matchTeacherByName()` function from import.service.js (line 1257) for conductor matching.

**Rationale:**
- The Ministry Excel ensemble sheet has a "conductor name" column (column B: "conductor name")
- `matchTeacherByName()` already handles:
  - Both name orderings (firstName lastName, lastName firstName)
  - Single-word names
  - Ambiguous matches (multiple teachers with same name)
  - Returns structured result: `{ status, teacherId, teacherName, matchType }`
- This is the same function used for teacher matching in the student import (line 1834)
- No modifications needed -- it works with the full teacher list loaded once per preview

### 4. participantCount: Derive from `memberIds.length`, Do NOT Store Separately

**Decision:** Do NOT add a `participantCount` field to the orchestra document. The export already computes `memberCount` from `(orch.memberIds || []).length` (ensembles.sheet.js line 307). The imported participant count from Excel is a **preview display value only**.

**Rationale:**
- Storing participantCount creates a data integrity problem: it drifts from `memberIds.length` as members are added/removed through the UI
- The export mapper already derives this value dynamically
- The imported count is useful during preview to show the user what the Excel says, but should NOT be persisted
- During preview, include it as `importedParticipantCount` for display; during execute, ignore it

**One exception:** If the orchestra is newly created and has no members yet, the imported count provides useful context. Store it as `ministryData.importedParticipantCount` (informational, not authoritative) only for new orchestras.

### 5. Import Log: Same Collection, importType: 'ensembles'

**Decision:** Use the existing `import_log` collection with `importType: 'ensembles'`.

**Rationale:**
- All three existing import types use this collection
- The `executeImport` dispatcher already routes by `importType` string
- Adding a new branch is a 3-line change
- No schema changes needed to import_log itself

### 6. Frontend: 4th Tab Following Exact Same Pattern

**Decision:** Add a 4th tab `'ensembles'` to `ImportData.tsx` using the same 3-step flow (upload -> preview -> results).

**Rationale:**
- The ensemble import is tabular, like teachers/students
- Preview rendering is closer to the teacher/student pattern (table of rows with matched/not-found/error) than the conservatory pattern (field-by-field diff)
- The 4th tab needs its own preview rendering because the columns are different (conductor, schedule, type, subType, performance level) but the container structure is identical

## Column Map Design

The Ministry Excel ensemble sheet (Sheet 5: "ensembles") has a specific structure based on the export sheet builder (ensembles.sheet.js):

```javascript
const ENSEMBLE_COLUMN_MAP = {
  // Column B: Conductor name
  'conductor name': 'conductorName',
  'conductor': 'conductorName',

  // Column C: Ensemble/orchestra name
  'orchestra/ensemble': 'name',
  'ensemble name': 'name',
  'orchestra name': 'name',

  // Column D: Participant count
  'participant count': 'participantCount',
  'participants': 'participantCount',

  // Columns E-H: Activity I
  'day': 'act1Day',        // Will need disambiguation for Activity I vs II
  'from time': 'act1Start',
  'to time': 'act1End',
  'actual hours': 'act1Hours',

  // (Activity II columns I-L use same header names -- need positional disambiguation)

  // Column M: Total hours
  'total weekly hours': 'totalHours',

  // Column N: Coordination hours
  'coordination hours': 'coordHours',

  // Column O: Total reporting hours
  'total for reporting': 'totalReportingHours',

  // Columns P-R: Performance levels (boolean marker columns)
  'beginner': 'levelBeginner',
  'intermediate': 'levelIntermediate',
  'representative': 'levelRepresentative',
};
```

**Actual Hebrew headers from ensembles.sheet.js (line 56-76):**
```javascript
// These are the EXACT headers the Ministry Excel uses:
// Col A: X (active marker)
// Col B: 'שם המנצח' (conductor name)
// Col C: 'תזמורת/הרכב' (orchestra/ensemble name)
// Col D: 'מספר משתתפים' (participant count)
// Col E: 'ביום' (on day) -- Activity I
// Col F: 'משעה' (from time) -- Activity I
// Col G: 'עד שעה' (to time) -- Activity I
// Col H: 'שעות בפועל' (actual hours) -- Activity I
// Col I: 'ביום' (on day) -- Activity II (DUPLICATE header!)
// Col J: 'משעה' (from time) -- Activity II (DUPLICATE header!)
// Col K: 'עד שעה' (to time) -- Activity II (DUPLICATE header!)
// Col L: 'שעות בפועל' (actual hours) -- Activity II (DUPLICATE header!)
// Col M: 'סך ש"ש' (total weekly hours)
// Col N: 'שעות ריכוז' (coordination hours)
// Col O: 'סה"כ לדיווח' (total for reporting)
// Col P: 'התחלתי' (beginner level)
// Col Q: 'ביניים' (intermediate level)
// Col R: 'ייצוגי' (representative level)
```

**Critical parsing challenge:** Activity I and Activity II columns use identical header names. The parser must handle this positionally -- first occurrence maps to Activity I, second to Activity II. This is similar to how the teacher import handles duplicate headers with the `DISAMBIGUATION_MAP` pattern (import.service.js lines 480-518).

**Disambiguation approach:** Use the parent row group headers "Activity I" and "Activity II" (rows 9-10 in the export) to disambiguate duplicate column headers. The existing `parseExcelBufferWithHeaderDetection` already supports parent-row disambiguation via the multi-row header scanning logic (lines 427-537).

## Patterns to Follow

### Pattern 1: Preview-Execute Two-Phase Import
**What:** All imports follow upload -> parse -> preview (save to import_log) -> user confirms -> execute (read from import_log, apply changes).
**When:** Always for imports.
**Why:** Allows user review before destructive changes. Import log provides audit trail and rollback reference.
```javascript
// Preview saves everything needed for execute
const logEntry = {
  importType: 'ensembles',
  tenantId,
  status: 'pending',
  createdAt: new Date(),
  preview,       // Summary for frontend display
  parsedData,    // Full parsed data for execute phase
};
```

### Pattern 2: matchTeacherByName for Conductor Resolution
**What:** Reuse the bidirectional name matcher for conductor names.
**When:** During preview phase.
**Why:** Conductor names from Ministry Excel follow the same format as teacher names in student import.

### Pattern 3: Unified Execute Dispatcher
**What:** Single `executeImport()` routes by `importType` string to type-specific execute functions.
**When:** Execute phase.
**Why:** Single route `POST /import/execute/:importLogId` handles all import types. Frontend uses one `executeImport(importLogId)` call regardless of type.

### Pattern 4: Controller Wrapper Pattern
**What:** Each controller function is a thin wrapper: check `req.file`, call service, return JSON.
**When:** All import controller functions.
```javascript
async function previewEnsembleImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await importService.previewEnsembleImport(req.file.buffer, { context: req.context });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing participantCount as Authoritative
**What:** Adding a `participantCount` field to orchestra documents that gets updated by import.
**Why bad:** Immediately drifts from `memberIds.length`. Creates two competing sources of truth.
**Instead:** Derive count from `memberIds.length` everywhere. Show imported count in preview only.

### Anti-Pattern 2: Creating a Separate Import Service File
**What:** Creating `api/import/ensemble-import.service.js` for the ensemble import logic.
**Why bad:** Breaks the established pattern where all import types live in `import.service.js`. Fragments the shared parsing infrastructure.
**Instead:** Add functions to `import.service.js`. The file is already large (~2200 lines) but cohesive.

### Anti-Pattern 3: Matching Orchestras by conductorId + Type
**What:** Using conductor + type as the match key for orchestra identification.
**Why bad:** Conductors change between years. A conductor may lead multiple ensembles of the same type.
**Instead:** Match by name (case-insensitive) -- orchestras have stable names within a conservatory.

### Anti-Pattern 4: Importing Members from the Ensemble Sheet
**What:** Trying to populate `memberIds` from the ensemble sheet's participant count.
**Why bad:** The ensemble sheet has a COUNT of participants, not a LIST. Member assignment comes from the student sheet (student import) or manual UI.
**Instead:** Leave `memberIds` empty for new orchestras. Existing orchestras keep their current members.

### Anti-Pattern 5: Skipping Rehearsal Creation
**What:** Only storing `scheduleSlots` on the orchestra without creating rehearsal documents.
**Why bad:** The export round-trip reads from `rehearsal` collection. Attendance tracking requires rehearsal documents.
**Instead:** Create rehearsal documents during execute AND store `scheduleSlots` for convenience.

## Preview Data Structure

The preview response structure follows the teacher/student pattern:

```javascript
{
  importLogId: "...",
  preview: {
    totalRows: 12,
    matched: [
      {
        row: 13,                            // Excel row number
        matchType: 'name',                  // or 'name_subtype', 'name_ambiguous'
        orchestraId: '...',                 // Existing orchestra _id
        orchestraName: 'String Orchestra',  // Current name in DB
        importedName: 'String Orchestra',   // Name from Excel
        conductorMatch: {
          status: 'resolved',               // resolved/unresolved/ambiguous/none
          teacherId: '...',
          teacherName: 'David Cohen',
        },
        changes: [
          { field: 'ministryData.coordinationHours', currentValue: 2, newValue: 3 },
          { field: 'performanceLevel', currentValue: 'intermediate', newValue: 'representative' },
        ],
        schedule: {
          act1: { day: 'Monday', start: '14:00', end: '16:00' },
          act2: { day: 'Wednesday', start: '15:00', end: '17:00' },
        },
        importedParticipantCount: 25,
      }
    ],
    notFound: [
      {
        row: 18,
        importedName: 'New Wind Ensemble',
        mapped: { ... },                    // All parsed fields
        conductorMatch: { status: 'resolved', teacherId: '...', teacherName: '...' },
        schedule: { ... },
      }
    ],
    errors: [],
    warnings: [
      { row: 15, field: 'conductorName', message: 'Conductor "..." not found in teacher list' },
    ],
    conductorMatchSummary: { resolved: 8, unresolved: 2, ambiguous: 1, none: 1 },
  }
}
```

## Suggested Build Order

Build order is driven by dependencies -- each step produces what the next step consumes.

### Phase 1: Backend Parser + Preview (no execute yet)
1. Add `ENSEMBLE_COLUMN_MAP` constant to `import.service.js`
2. Add `matchOrchestra()` function
3. Add `previewEnsembleImport()` function (uses `parseExcelBufferWithHeaderDetection`, `matchOrchestra`, `matchTeacherByName`)
4. Add controller handler + route
5. Export from service and controller
6. Test with real Ministry Excel file via API

**Why first:** The parser is the foundation. Preview is read-only (no DB mutations), safe to iterate on.

### Phase 2: Backend Execute
1. Add `executeEnsembleImport()` function
2. Add `else if` branch in `executeImport` dispatcher
3. Handle three cases: update existing orchestra, create new orchestra, create/update rehearsals
4. Add `scheduleSlots` to `orchestraSchema` in `orchestra.validation.js`
5. Test full preview-then-execute flow

**Why second:** Execute depends on preview being stable. Schema changes are minimal (one optional field).

### Phase 3: Frontend Integration
1. Add `previewEnsembleImport(file)` to `importService` in `apiService.js`
2. Extend `ImportTab` type to include `'ensembles'`
3. Add 4th tab button to `ImportData.tsx`
4. Add ensemble-specific preview table rendering
5. Wire up upload/execute for the new tab

**Why third:** Frontend depends on backend API being complete. Tab addition is low-risk -- follows exact same pattern as existing 3 tabs.

## File Change Summary

| File | Action | LOC Estimate |
|------|--------|-------------|
| `api/import/import.service.js` | ADD functions (preview, execute, column map, matching) | ~250-350 |
| `api/import/import.controller.js` | ADD handler function | ~15 |
| `api/import/import.route.js` | ADD route | ~5 |
| `api/orchestra/orchestra.validation.js` | ADD `scheduleSlots` to schema | ~10 |
| `src/services/apiService.js` (frontend) | ADD method | ~20 |
| `src/pages/ImportData.tsx` (frontend) | ADD tab + preview rendering | ~100-150 |
| `config/constants.js` | NO CHANGE | 0 |
| `api/orchestra/orchestra.service.js` | NO CHANGE (used via existing API during execute) | 0 |
| `api/rehearsal/rehearsal.service.js` | NO CHANGE (used via existing API during execute) | 0 |

## Sources

All findings based on direct codebase analysis:
- `api/import/import.service.js` -- existing import patterns, column maps, matching logic
- `api/import/import.controller.js` -- controller wrapper pattern
- `api/import/import.route.js` -- route registration pattern
- `api/orchestra/orchestra.service.js` -- orchestra CRUD, member management
- `api/orchestra/orchestra.validation.js` -- Joi schema, valid types/subtypes
- `api/rehearsal/rehearsal.validation.js` -- rehearsal schema, day/time fields
- `api/export/sheets/ensembles.sheet.js` -- Ministry Excel ensemble sheet structure (columns, headers)
- `api/export/ministry-mappers.js` -- ensemble schedule data mapping (how export works)
- `api/export/sheets/_shared.js` -- ENSEMBLE_TO_COLUMN mapping
- `config/constants.js` -- ORCHESTRA_TYPES, ORCHESTRA_SUB_TYPES, PERFORMANCE_LEVELS
- `src/pages/ImportData.tsx` (frontend) -- tab structure, preview/execute flow
- `src/services/apiService.js` (frontend) -- import service methods
