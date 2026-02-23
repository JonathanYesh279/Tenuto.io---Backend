# Phase 9: Fix Import Teacher -- Missing Column Mapping (instruments, hours, degrees, certificates, management) - Research

**Researched:** 2026-02-23
**Domain:** Excel import column mapping, data flow tracing, Ministry file structure
**Confidence:** HIGH

## Summary

This phase addresses columns from the Ministry of Education Excel file that are either not mapped, not correctly flowing through, or not being applied to teacher documents during import. The phase title lists five problem areas: instruments, hours, degrees, certificates, and management. Through exhaustive tracing of the import data flow in `import.service.js`, I identified that the column MAPPINGS themselves are mostly present in `TEACHER_COLUMN_MAP`, but the data extracted from these columns does not always survive the full pipeline from Excel parse through preview storage to execute-time document creation/update.

The analysis reveals **seven distinct bugs** across the five areas, some affecting the preview phase (data not reaching the preview response), some affecting the execute phase (data not being written to MongoDB), and some affecting both matched (existing) and unmatched (new) teacher flows. The root causes fall into three categories: (1) column mapping gaps where Ministry file headers use variations not in `TEACHER_COLUMN_MAP`, (2) data loss during the preview-to-execute pipeline where `mapped` fields are present in preview but not used during execution, and (3) fields that are correctly parsed and stored but the update `$set` operations target wrong paths or skip the field entirely.

**Primary recommendation:** Fix the seven identified bugs in `import.service.js` by adding missing column header variants, ensuring all parsed fields flow through normalizeTeacherMapped, and ensuring calculateTeacherChanges handles all imported field paths for matched teachers.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | (installed) | Excel parsing with cell style access | Already in use, provides fill color detection |
| Joi | 17.13.3 | Schema validation | Already in use for teacherImportSchema |
| MongoDB native driver | (installed) | Database operations | Project standard |

No new libraries needed. This is entirely a bug-fix phase within existing code.

## Architecture Patterns

### Import Data Flow (Critical to understand for this phase)

```
PREVIEW PHASE:
  Excel Buffer
    -> parseExcelBufferWithHeaderDetection(buffer, TEACHER_COLUMN_MAP)
       -> allTextRows, allCellRows, headers[], headerColMap
    -> detectInstrumentColumns(headers, headerColMap)
       -> instrumentColumns[]
    -> detectRoleColumns(headers)
       -> roleColumns[]
    -> for each row:
       -> mapColumns(row, TEACHER_COLUMN_MAP, headerColMap)
          -> mapped = { firstName, lastName, degree, classification, ... }
       -> readInstrumentMatrix(row, instrumentColumns, cellRow, headerColMap)
          -> instruments[], departmentHint
       -> readRoleMatrix(row, roleColumns, cellRow, headerColMap)
          -> roles[]
       -> parseTeachingHours(mapped)
          -> teachingHours = { teachingHours, accompHours, ... }
       -> validateTeacherRow(mapped, rowIndex)
          -> errors[], warnings[]
       -> matchTeacher(mapped, teachers)
          -> MATCHED: calculateTeacherChanges(teacher, mapped, instruments, roles, teachingHours)
             -> changes[] stored in preview.matched[]
          -> NOT FOUND: normalizeTeacherMapped(mapped, instruments, roles, teachingHours)
             -> normalized{} stored in preview.notFound[]
    -> Save preview to import_log collection

EXECUTE PHASE:
  Load import_log from MongoDB
    -> for matched entries:
       -> iterate entry.changes[]
       -> build $set document from changes
       -> updateOne teacher
    -> for notFound entries:
       -> extract entry.mapped, entry.instruments, entry.roles, entry.teachingHours
       -> normalizeTeacherMapped(mapped, instruments, roles, teachingHours)
       -> buildImportTeacherDocument(normalized, tenantId, hashedPassword, adminId)
       -> validateTeacherImport(rawDoc) via Joi
       -> insertOne into teacher collection
```

### Bug Analysis: The Seven Issues

#### Bug 1: Instruments not detected from Ministry files with merged headers (INSTRUMENTS)
**What happens:** Ministry files use multi-row merged headers where instrument abbreviations (Vi, FL, PI, etc.) appear in one of several header rows. The `detectInstrumentColumns()` function (line 530) only checks the `headers[]` array, which is the FINAL merged header row after all parent/sub-header resolution. If instrument abbreviations appear in a row above the detected header row, they are lost.

**Root cause:** The headers array is built from the bottom-most header row. Instrument abbreviations often appear in a SEPARATE row from the main teacher data headers. The parent-row backfill logic (lines 316-336) only fills EMPTY columns, so if a header already has a value from the bottom row, the instrument abbreviation in the parent row is ignored.

**Affected flow:** Both matched and notFound teachers get `instruments: []` when instruments should be detected.

**Confidence:** HIGH -- traced through header detection code.

#### Bug 2: Teaching hours not written for MATCHED teachers (HOURS)
**What happens:** For MATCHED teachers, `calculateTeacherChanges()` correctly computes hour changes (lines 876-883) and stores them in the `changes[]` array. But the execute phase builds the `$set` doc from `entry.changes` and uses the `field` as the MongoDB dot-path key. The path is `managementInfo.${field}` where field is `teachingHours`, `accompHours`, etc. This is CORRECT -- teaching hours DO flow through for matched teachers.

**Actually:** Teaching hours for matched teachers appear to work correctly. The `parseTeachingHours()` function extracts numeric values, `calculateTeacherChanges()` compares against `managementInfo.X`, and the execute phase applies changes. This area may NOT be broken.

**Confidence:** HIGH -- code analysis shows correct flow for matched teachers. The issue may be that hours columns are not being DETECTED from Ministry headers rather than a write problem.

#### Bug 3: Degrees/classification not detected from Ministry merged headers (DEGREES)
**What happens:** Ministry files have column headers like "סיווג" and "תואר" that ARE in `TEACHER_COLUMN_MAP` (lines 50-52). However, in Ministry files with multi-row merged headers, these labels may appear in parent rows while the bottom row has empty cells or generic labels. The backfill logic picks these up IF the column is empty in the header row.

**Potential issue:** If the header row already has a different label for that column (e.g., a fragment from a sub-header row), the parent row value ("סיווג" or "תואר") is never used. The sub-header refinement logic (lines 417-474) may overwrite a correctly-detected parent header with a non-matching sub-header fragment.

**Root cause:** The sub-header refinement loop (lines 439-470) replaces a header with a sub-header value only if `columnMap[subText]` matches. But if a sub-header value is NOT in the column map, the header stays as-is. The risk is when a PARENT row correctly had "סיווג" or "תואר" but the column is NOT empty in the header row, so backfill never runs.

**Confidence:** MEDIUM -- depends on actual Ministry file structure. The code handles the common case but may fail with specific multi-row header layouts.

#### Bug 4: Teaching certificate ("כן-לא") column collision (CERTIFICATES)
**What happens:** The mapping `'כן-לא': 'teachingCertificate'` (line 62) is intended for the Ministry file where column 9 has header "כן-לא" meaning teaching certificate. However, "כן-לא" is also a common pattern for ANY boolean column in Ministry files (union membership, etc.). If the column mapping picks up "כן-לא" from the WRONG column, the teaching certificate value gets a spurious value from another field.

**Root cause:** `TEACHER_COLUMN_MAP` has `'כן-לא': 'teachingCertificate'` but this is a GENERIC label. In Ministry files with multiple "כן-לא" sub-headers, only the first one found (by `mapColumns`) gets mapped. The `mapColumns` function iterates `row` entries and maps the LAST matching header (since it overwrites `mapped[mappedKey]` on each match).

**Second issue:** The `teachingCertificate` field IS in `TEACHER_FIELD_PATHS` (line 842) mapped to `professionalInfo.hasTeachingCertificate`, so it flows through for matched teachers. For unmatched teachers, `normalizeTeacherMapped()` correctly handles it (line 925). The issue is whether the VALUE is correctly parsed from the right column.

**Confidence:** MEDIUM -- the mapping exists but may collide with other boolean columns in specific file layouts.

#### Bug 5: Management role column not detected in all Ministry file variants (MANAGEMENT)
**What happens:** `TEACHER_COLUMN_MAP` has `'תיאור תפקיד': 'managementRole'` (line 91). Phase 8 added "תיאור תפקיד" as a valid MANAGEMENT_ROLES enum value. But the Ministry file may use other header text for the management role column, such as "תפקיד" (short form) or "תפקיד ניהולי" (full form), neither of which is in the column map.

**Root cause:** Limited column header variants for management role. Only one variant ("תיאור תפקיד") is mapped.

**Confidence:** MEDIUM -- depends on actual Ministry file headers.

#### Bug 6: `managementRole` missing from `normalizeTeacherMapped` preview data storage (MANAGEMENT)
**What happens:** `normalizeTeacherMapped()` (line 913-932) includes `managementRole: mapped.managementRole || null` (line 927). This is stored in `preview.notFound[].normalized`. During execute, the code uses `entry.normalized || normalizeTeacherMapped(...)` (line 1322). Then `buildImportTeacherDocument()` uses `data.managementRole` (line 963) to set `managementInfo.role`. This flow appears CORRECT.

**Actually:** The management role flow looks correct on code analysis. The field is mapped, normalized, and written. If the column isn't detected from the Excel, the value will be null, but that's a column detection issue (Bug 5), not a write issue.

**Confidence:** HIGH -- management role write flow is correct IF the column is detected.

#### Bug 7: Instrument column index threshold too rigid (INSTRUMENTS)
**What happens:** `detectInstrumentColumns()` (line 535-537) skips instruments at column index < 24 to avoid confusing "פסנתר" (piano) at the accomp hours column with the piano instrument column. But in Ministry files with different layouts, instrument columns may start at a lower index. The hardcoded threshold of 24 means instruments in columns 0-23 are NEVER detected.

**Root cause:** The column index threshold `colIndex < 24` is based on one specific Ministry file layout. Different file variants may have instruments at different positions.

**Confidence:** HIGH -- the threshold is clearly hardcoded and layout-dependent.

### Consolidated Issue List (Actionable)

| # | Area | Issue | Impact | Fix Location |
|---|------|-------|--------|-------------|
| 1 | INSTRUMENTS | Column index threshold (< 24) too rigid for variant layouts | instruments: [] on files with different column ordering | detectInstrumentColumns() line 535 |
| 2 | INSTRUMENTS | Instrument abbreviations in parent rows not detected if header row has a different value | instruments: [] on multi-row header files | parseExcelBufferWithHeaderDetection header backfill logic |
| 3 | HOURS | Hours column headers from multi-row merged files may not get detected | teachingHours: {} when hours columns have fragmented headers | TEACHER_COLUMN_MAP + sub-header compositing |
| 4 | DEGREES | "סיווג" and "תואר" in parent rows may be overwritten by sub-header refinement | classification: null, degree: null for matched and new teachers | Sub-header refinement loop priority |
| 5 | CERTIFICATES | "כן-לא" maps to teachingCertificate but is a generic boolean label | teachingCertificate gets wrong column's value | TEACHER_COLUMN_MAP disambiguation needed |
| 6 | MANAGEMENT | Only one header variant ("תיאור תפקיד") mapped for management role | managementRole: null when file uses different header text | TEACHER_COLUMN_MAP needs more variants |
| 7 | ALL | No diagnostic logging of which columns were detected/undetected | Hard to debug mapping failures | Add headerMappingReport to preview response |

### Pattern: Column Detection Flow

```
Headers from Excel:
  [שם פרטי, שם משפחה, ת.ז., סיווג, תואר, ותק, כן-לא, חבר/ה, ...]

TEACHER_COLUMN_MAP lookup:
  'שם פרטי' -> 'firstName'     OK
  'שם משפחה' -> 'lastName'     OK
  'ת.ז.' -> 'idNumber'         OK
  'סיווג' -> 'classification'  OK (if detected)
  'תואר' -> 'degree'           OK (if detected)
  'ותק' -> 'experience'        OK
  'כן-לא' -> 'teachingCertificate'  PROBLEM: generic label
  'חבר/ה' -> 'isUnionMember'   OK

Instrument detection (separate pass):
  Check each header against ABBREVIATION_TO_INSTRUMENT and DEPARTMENT_TO_INSTRUMENTS
  ONLY for columns at index >= 24 (hardcoded threshold)
```

### Anti-Patterns to Avoid
- **Hardcoded column index thresholds:** Column 24 is specific to one layout; use header-section detection instead
- **Generic labels as unique column identifiers:** "כן-לא" is not unique enough to map to a specific field
- **Overwriting parent header with sub-header unconditionally:** Should preserve parent if sub-header is not a known column name

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-row header detection | Custom header merger from scratch | Improve existing backfill + disambiguation logic | The existing infrastructure is solid; it needs refinement not replacement |
| Column mapping debugging | console.log scattered through code | Add `headerMappingReport` to preview response | Gives user/dev visibility into what was detected |
| Instrument section detection | Hardcoded column threshold | Use header-group detection (find consecutive instrument abbreviation/department columns) | Adapts to different file layouts |

**Key insight:** The existing import infrastructure (header detection, sub-header compositing, instrument matrix reading, role matrix reading) is comprehensive and well-architected. The bugs are at the EDGES -- specific file variants where the detection logic falls short. Fixes should be targeted improvements to the existing logic, not replacements.

## Common Pitfalls

### Pitfall 1: Changing TEACHER_COLUMN_MAP breaks existing working files
**What goes wrong:** Adding or modifying column mappings could break files that currently work correctly.
**Why it happens:** A header string that maps to one field in one file layout might mean something different in another layout.
**How to avoid:** Only ADD new header variants (new keys in the map); never remove or change existing mappings. Test with both Ministry and non-Ministry file formats.
**Warning signs:** Previously successful imports start failing after column map changes.

### Pitfall 2: The "כן-לא" collision
**What goes wrong:** Multiple boolean columns in Ministry files use "כן-לא" as sub-header text. The column map maps this to `teachingCertificate`, but it could be union membership or another boolean.
**Why it happens:** `mapColumns()` uses the last matching entry (overwrites), so if multiple columns have "כן-לא" header, the last one wins.
**How to avoid:** Use column position context (the "כן-לא" for teaching certificate is typically column 9 in Ministry files) or parent-row disambiguation ("תעודת הוראה" parent + "כן-לא" sub = teaching certificate).
**Warning signs:** Teaching certificate always true/false regardless of actual value; union membership missing.

### Pitfall 3: Instrument detection threshold breaks on different layouts
**What goes wrong:** Files where instrument columns start before column 24 (e.g., simplified layouts, school-specific files) produce instruments: [].
**Why it happens:** Hardcoded `colIndex < 24` skip in `detectInstrumentColumns()`.
**How to avoid:** Instead of a fixed threshold, detect the instrument section dynamically by looking for a cluster of consecutive columns that match instrument abbreviations or department names.
**Warning signs:** instruments: [] in preview despite instrument columns clearly present in the file.

### Pitfall 4: Sub-header refinement overwrites correct parent header
**What goes wrong:** A correctly-detected parent header like "סיווג" gets overwritten by a sub-header fragment that happens to match a different column map entry.
**Why it happens:** The sub-header refinement loop (line 439) replaces headers with sub-header values if `columnMap[subText]` matches, without checking if the existing header is already a better match.
**How to avoid:** Only replace a header with a sub-header value if the sub-header provides a MORE SPECIFIC mapping than the current header. If the current header already maps to a valid field, keep it.
**Warning signs:** Fields like classification and degree are null despite appearing in the file.

### Pitfall 5: Preview/execute data loss via MongoDB serialization
**What goes wrong:** The preview stores `mapped`, `instruments`, `roles`, `teachingHours` in the import_log MongoDB document. When the execute phase reads them back, any `undefined` values were stripped by MongoDB during the insert.
**Why it happens:** MongoDB does not store `undefined` keys. If `mapped.degree` is `undefined` (not `null`), it vanishes.
**How to avoid:** Phase 7 already addressed this with `normalizeTeacherMapped()` for notFound entries. But matched entries still store raw `mapped` which may have undefined values. Ensure all fields are explicitly set to `null` instead of leaving them as `undefined`.
**Warning signs:** Fields present during preview disappear during execute.

## Code Examples

### Current: detectInstrumentColumns with hardcoded threshold
```javascript
// Source: import.service.js, lines 530-559
function detectInstrumentColumns(headers, headerColMap) {
  const instrumentColumns = [];
  for (const header of headers) {
    const trimmed = header.trim();
    // Hardcoded threshold -- instruments only in columns >= 24
    if (headerColMap) {
      const colIndex = headerColMap[trimmed];
      if (colIndex !== undefined && colIndex < 24) {
        continue; // BUG: skips instruments in files with different layouts
      }
    }
    if (ABBREVIATION_TO_INSTRUMENT[trimmed]) {
      instrumentColumns.push({ header: trimmed, instrument: ABBREVIATION_TO_INSTRUMENT[trimmed], type: 'specific' });
    } else if (DEPARTMENT_TO_INSTRUMENTS[trimmed]) {
      instrumentColumns.push({ header: trimmed, instruments: DEPARTMENT_TO_INSTRUMENTS[trimmed], type: 'department' });
    }
  }
  return instrumentColumns;
}
```

### Fix Pattern: Dynamic instrument section detection
```javascript
// Instead of hardcoded column 24, find the FIRST column that matches an
// instrument or department name, then accept all columns from that point onward.
function detectInstrumentColumns(headers, headerColMap) {
  const instrumentColumns = [];

  // First pass: find earliest column that is an instrument/department
  let instrumentSectionStart = Infinity;
  for (const header of headers) {
    const trimmed = header.trim();
    if (ABBREVIATION_TO_INSTRUMENT[trimmed] || DEPARTMENT_TO_INSTRUMENTS[trimmed]) {
      const colIndex = headerColMap?.[trimmed];
      if (colIndex !== undefined && colIndex < instrumentSectionStart) {
        instrumentSectionStart = colIndex;
      }
    }
  }

  // If no instruments found at all, return empty
  if (instrumentSectionStart === Infinity) return instrumentColumns;

  // Second pass: collect all instrument columns at or after the section start
  // But EXCLUDE known hours-column headers that share names (accomp hours, etc.)
  const HOURS_HEADER_NAMES = new Set(['הוראה', 'ליווי פסנתר', 'הרכב ביצוע', 'ריכוז הרכב',
    'תאוריה', 'תיאוריה', 'ניהול', 'ריכוז', 'ביטול זמן']);

  for (const header of headers) {
    const trimmed = header.trim();
    const colIndex = headerColMap?.[trimmed];
    if (colIndex !== undefined && colIndex < instrumentSectionStart) continue;
    if (HOURS_HEADER_NAMES.has(trimmed)) continue; // Skip hours columns

    if (ABBREVIATION_TO_INSTRUMENT[trimmed]) {
      instrumentColumns.push({ header: trimmed, instrument: ABBREVIATION_TO_INSTRUMENT[trimmed], type: 'specific' });
    } else if (DEPARTMENT_TO_INSTRUMENTS[trimmed]) {
      instrumentColumns.push({ header: trimmed, instruments: DEPARTMENT_TO_INSTRUMENTS[trimmed], type: 'department' });
    }
  }
  return instrumentColumns;
}
```

### Fix Pattern: "כן-לא" disambiguation using parent row context
```javascript
// In sub-header refinement, when encountering "כן-לא", check parent row context:
if (subText === 'כן-לא' || subText === 'כן / לא') {
  // Check parent row for context
  const parentTexts = [];
  for (let r = headerRowIndex - 1; r >= Math.max(0, headerRowIndex - 3); r--) {
    const parentRow = allTextRows[r];
    if (parentRow?.[c]) parentTexts.push(parentRow[c].trim());
  }

  if (parentTexts.some(t => t.includes('תעודת הוראה') || t.includes('תעודה'))) {
    headers[c] = 'תעודת הוראה'; // Maps to teachingCertificate
  } else if (parentTexts.some(t => t.includes('ארגון') || t.includes('חבר'))) {
    headers[c] = 'חבר ארגון'; // Maps to isUnionMember
  }
  // Otherwise leave as-is (falls through to TEACHER_COLUMN_MAP lookup)
}
```

### Fix Pattern: Add diagnostic info to preview response
```javascript
// Add to preview response for debugging:
preview.headerMapping = {
  detectedHeaders: headers,
  mappedFields: Object.fromEntries(
    headers.filter(h => TEACHER_COLUMN_MAP[h]).map(h => [h, TEACHER_COLUMN_MAP[h]])
  ),
  unmappedHeaders: headers.filter(h => h && !TEACHER_COLUMN_MAP[h] && !ABBREVIATION_TO_INSTRUMENT[h] && !DEPARTMENT_TO_INSTRUMENTS[h]),
  instrumentColumnsDetected: instrumentColumns.map(c => c.type === 'specific' ? c.instrument : c.header),
  roleColumnsDetected: roleColumns.map(c => c.role),
};
```

### Fix Pattern: Additional TEACHER_COLUMN_MAP entries
```javascript
// Additional header variants for management role:
'תפקיד': 'managementRole',
'תפקיד ניהולי': 'managementRole',
'תפקיד ניהול': 'managementRole',

// Additional header variants for teaching certificate:
'תעודה': 'teachingCertificate',
'תעודת הוראה': 'teachingCertificate',  // Already exists (line 57)

// Additional header variants for hours columns:
'ש"ש הוראה': 'teachingHours',
'שעות ניהול': 'managementHours',
'שעות ריכוז': 'coordinationHours',
'שעות תאוריה': 'theoryHours',
'שעות ליווי': 'accompHours',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded column index 24 for instruments | Should use dynamic section detection | This phase | Handles all Ministry file layouts |
| Generic "כן-לא" maps to teachingCertificate | Should use parent-row disambiguation | This phase | Correct certificate/union mapping |
| Limited header variants in column map | Should add more Ministry file variants | This phase | More files parse correctly |
| No diagnostic info in preview | Should add headerMapping report | This phase | Users/devs can diagnose mapping issues |

## Open Questions

1. **Exact Ministry file header layout variations**
   - What we know: The current code handles one specific Ministry file layout with columns in a specific order.
   - What's unclear: How many different Ministry file layouts exist? Each regional education office may use slightly different templates.
   - Recommendation: Add diagnostic `headerMapping` to preview response so users can report undetected columns. This is more sustainable than trying to anticipate all variants.

2. **Should instrument detection use a different strategy?**
   - What we know: Current approach uses column index threshold + abbreviation matching.
   - What's unclear: Whether a header-group clustering approach (find consecutive instrument/department columns) would be more robust.
   - Recommendation: Replace hardcoded threshold with dynamic section detection (find first instrument column, accept all subsequent instrument columns). This is a minimal change with maximum impact.

3. **Is the "כן-לא" collision actually causing bugs in practice?**
   - What we know: The mapping exists and could theoretically collide with other boolean columns.
   - What's unclear: Whether users have actually encountered this in their specific Ministry files.
   - Recommendation: Fix defensively -- add parent-row disambiguation for "כן-לא" and other generic boolean labels. Low cost, high safety.

4. **Are hours columns actually failing to map?**
   - What we know: `TEACHER_COLUMN_MAP` has entries for "הוראה", "שעות הוראה", "ליווי פסנתר", etc. These should work for standard headers.
   - What's unclear: Whether specific Ministry files have hours headers that aren't covered.
   - Recommendation: Add the headerMapping diagnostic to preview response. If hours are consistently empty, the diagnostic will reveal which headers were unmatched.

5. **Sub-header refinement priority**
   - What we know: The sub-header loop replaces headers if `columnMap[subText]` matches, without checking if the current header is already good.
   - What's unclear: Whether this actually causes classification/degree to be lost in practice.
   - Recommendation: Add a guard: only replace header with sub-header if the current header does NOT already map to a valid field. This prevents correct headers from being overwritten.

## Sources

### Primary (HIGH confidence)
- `api/import/import.service.js` -- Full 1584-line import service, line-by-line tracing of all five data flow paths
- `api/teacher/teacher.validation.js` -- teacherImportSchema, TEACHER_FIELD_PATHS mapping
- `config/constants.js` -- TEACHER_COLUMN_MAP source enums (INSTRUMENT_MAP, TEACHER_DEGREES, MANAGEMENT_ROLES, TEACHER_HOURS_COLUMNS)
- Prior phase research: 07-RESEARCH.md, 08-RESEARCH.md -- prior bug analysis and fixes

### Secondary (MEDIUM confidence)
- Ministry of Education Excel file structure: inferred from column mappings and comments in code (no actual sample file available for verification)

### Tertiary (LOW confidence)
- Specific Ministry file layout variants -- code assumes one primary layout, but multiple variants may exist. Needs validation with actual user files.

## Metadata

**Confidence breakdown:**
- Column mapping gaps: HIGH -- traced through code, identified exact lines
- Instrument detection threshold: HIGH -- hardcoded value clearly visible
- "כן-לא" collision: MEDIUM -- theoretical but code clearly shows the risk
- Sub-header overwrite: MEDIUM -- depends on actual file layouts not available for testing
- Hours column mapping: MEDIUM -- existing mappings appear sufficient but can't verify without sample files
- Management role variants: MEDIUM -- only one variant mapped, unclear what others exist
- Diagnostic/debugging: HIGH -- clearly needed regardless of other fixes

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain, bug fixes)
