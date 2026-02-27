# Phase 20: Conservatory Excel Parser + API - Research

**Researched:** 2026-02-27
**Domain:** Excel form-style parsing, tenant data update, preview/execute import pattern
**Confidence:** HIGH

## Summary

Phase 20 adds the ability to parse a Ministry of Education conservatory profile Excel form and import the extracted data into the tenant's `conservatoryProfile` and `director` fields. Unlike the existing teacher/student imports which parse tabular data with rows of entities, this is a **form-style parser** that reads label/value pairs from fixed cell positions in a single-sheet workbook.

The Excel file has been fully analyzed. It contains a single sheet (`פרטי_קונסרבטוריון`) with 44 rows and 38 columns. Labels appear in columns C and H; values appear in columns E and J respectively. Most values are VLOOKUP formula results that resolve to strings/numbers. The form includes conservatory name, code, ownership, status, director info, contact details, stage, cluster, district, and other institutional fields. There are exactly 19 extractable fields that map directly to the existing `conservatoryProfile` schema plus `director.name` on the tenant document.

**Primary recommendation:** Build a dedicated `parseConservatoryExcel()` function that reads specific cell addresses (not header-based column detection), produce a flat key-value map, and follow the existing preview/execute pattern to update the tenant via `tenantService.updateTenant()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | ^4.4.0 | Parse uploaded .xlsx buffer | Already used by existing import service; handles formulas, merged cells, cell values |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| multer | (existing) | Handle multipart file upload | Already configured in import.route.js with memoryStorage |
| Joi | (existing) | Validate parsed data | tenantUpdateSchema already validates conservatoryProfile fields |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ExcelJS | SheetJS/xlsx | ExcelJS already installed and proven in codebase; no reason to add a second library |
| Fixed cell addresses | Header detection | Form-style Excel has no headers to detect; fixed positions are the correct approach |

**Installation:**
```bash
# No new packages needed — all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure
```
api/import/
├── import.route.js          # ADD: POST /conservatory/preview route
├── import.controller.js     # ADD: previewConservatoryImport, executeConservatoryImport
├── import.service.js         # ADD: parseConservatoryExcel(), previewConservatoryImport(), executeConservatoryImport()
└── (no new files needed)
```

The conservatory import integrates into the existing import module rather than creating new files. This follows the established pattern where all import types share the same route prefix (`/api/import/`), controller, and service.

### Pattern 1: Fixed Cell Address Parsing (Form-Style Excel)

**What:** Unlike teacher/student imports that detect headers and iterate rows, the conservatory Excel is a fixed-layout form. Each field has a known cell address (e.g., `E5` = conservatory name, `J5` = code, `E14` = director name).

**When to use:** When the Excel document is a form (label/value pairs in specific cells), not a data table.

**Cell-to-Field Mapping (from actual file analysis):**

```javascript
// Left column: Label in C, Value in E
const LEFT_COLUMN_FIELDS = [
  { row: 5, label: 'קונסרבטוריון', valueCol: 'E', field: 'name' },           // tenant.name
  { row: 7, label: 'שם בעלות / רשות', valueCol: 'E', field: 'ownershipName' },
  { row: 9, label: 'סטטוס', valueCol: 'E', field: 'status' },
  { row: 11, label: 'מספר עוסק', valueCol: 'E', field: 'businessNumber' },
  { row: 14, label: 'מנהל/ת', valueCol: 'E', field: 'managerName' },          // Also → director.name
  { row: 16, label: 'טלפון משרד', valueCol: 'E', field: 'officePhone' },
  { row: 18, label: 'טלפון נייד', valueCol: 'E', field: 'mobilePhone' },
  { row: 20, label: 'דוא"ל', valueCol: 'E', field: 'email' },
  { row: 22, label: 'כתובת למשלוח דואר', valueCol: 'E', field: 'address' },
];

// Right column: Label in H, Value in J
const RIGHT_COLUMN_FIELDS = [
  { row: 5, label: 'קוד קונסרבטוריון', valueCol: 'J', field: 'code' },
  { row: 9, label: 'אשכול חברתי', valueCol: 'J', field: 'socialCluster' },
  { row: 11, label: 'יחידה מקדמת', valueCol: 'J', field: 'supportUnit' },
  { row: 14, label: 'שלב קונסרבטוריון', valueCol: 'J', field: 'stageDescription' },
  { row: 16, label: 'סמל ישוב', valueCol: 'J', field: 'cityCode' },
  { row: 18, label: 'רשות גדולה / קטנה', valueCol: 'J', field: 'sizeCategory' },
  { row: 20, label: 'מחלקה עיקרית', valueCol: 'J', field: 'mainDepartment' },
  { row: 22, label: 'סטטוס פיקוח', valueCol: 'J', field: 'supervisionStatus' },
  { row: 24, label: 'מחוז משרד החינוך', valueCol: 'J', field: 'district' },
];

// Special cells
// I14 = stage letter (e.g. "C"), used alongside J14 stageDescription
// E12 (via I12/J12) = mixedCityFactor (VLOOKUP, may be empty)
// Row 3 = school year label (informational only)
// Row 24 col E = submission date (user-entered, not imported)
// Rows 27-31 = manager notes (merged cells, C28:J31)
```

**Key Implementation Notes from Excel Analysis:**
1. Most value cells contain **VLOOKUP formulas** with a `result` property — the parser must extract `cell.value.result` not `cell.value`
2. Some formula results are `null` (e.g., row 7 ownershipName for Raanana) — these should be imported as `null`, not skipped
3. The `code` field at J5 has formula result `80` (number) — must be coerced to string for schema compatibility
4. The `socialCluster` at J9 has result `8` (number) — same coercion needed
5. The `businessNumber` at E11 has result `500287008` (number) — coerce to string
6. The `cityCode` at J16 has result `8700` (number) — coerce to string
7. The `supportUnit` at J11 has result `1` (number) — coerce to string
8. The `email` at E20 may contain multiple emails separated by semicolons (e.g., `"limora@raanana.muni.il;raananamusiccenter@gmail.com"`)
9. Row 14 I14 = stage letter `"C"`, J14 = full description `"שלב ג' ( מתקדם )"` — import the letter as `stage` and description as `stageDescription`
10. Manager notes are in merged cells C28:J31 — read from C28 only

### Pattern 2: Preview/Execute with Diff Comparison

**What:** Follow the existing import pattern: upload returns a preview with current vs. imported values, then a separate execute endpoint applies the changes. However, since this is a single-entity update (one tenant, not 130 teachers), the flow is simpler.

**Preview Response Shape:**
```javascript
{
  importLogId: "...",          // Stored in import_log for the execute step
  preview: {
    fields: [
      {
        field: "conservatoryProfile.code",
        label: "קוד קונסרבטוריון",
        currentValue: null,
        importedValue: "80",
        changed: true
      },
      {
        field: "director.name",
        label: "מנהל/ת הקונסרבטוריון",
        currentValue: "לימור אקטע",
        importedValue: "לימור אקטע",
        changed: false
      },
      // ... all fields
    ],
    changedCount: 14,
    unchangedCount: 5,
    warnings: []
  }
}
```

**Execute Flow:**
1. Read import_log entry by importLogId
2. Build `$set` update with dot-notation paths (NOT replace the whole conservatoryProfile object)
3. Call the update through tenant service or directly with dot-notation `$set`
4. Update import_log status to 'completed'

### Pattern 3: Dot-Notation $set for Partial Updates

**What:** MongoDB's `$set` operator replaces entire nested objects when given an object value. The existing `tenantService.updateTenant()` uses `{ $set: value }` where `value` comes from Joi validation. If we pass `{ conservatoryProfile: { code: '80' } }`, it REPLACES the entire conservatoryProfile, losing all other fields.

**Solution:** The execute step must either:
- (a) Build a flat object with dot-notation keys: `{ 'conservatoryProfile.code': '80', 'conservatoryProfile.status': 'רשות מקומית', ... }` and call `$set` directly, OR
- (b) Read the current tenant, merge the imported values with existing conservatoryProfile, then pass the complete merged object to `updateTenant()`

**Recommendation:** Option (b) — merge and pass complete object. This works with the existing `updateTenant()` without modifications. The preview step already reads the current tenant data for diff comparison, so the merged object is trivially available.

### Anti-Patterns to Avoid
- **Header detection for form-style Excel:** The existing teacher import scans for header rows and matches column names. This is wrong for a form layout — it would find zero matches. Use fixed cell addresses.
- **Creating new files for a small feature:** This is ~200 lines of parser + ~50 lines of controller additions. It fits cleanly in the existing import module files.
- **Replacing entire conservatoryProfile via $set:** Would wipe any fields not present in the Excel. Always merge with current values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel formula resolution | Manual formula evaluation | ExcelJS `cell.value.result` | Formulas are pre-computed by Excel; just read the cached result |
| Tenant update validation | Custom validation logic | Existing `tenantUpdateSchema` from Joi | Already validates all conservatoryProfile fields |
| File upload handling | Custom body parser | Existing multer memoryStorage config | Already configured in import.route.js |
| Import logging | Custom audit trail | Existing `import_log` collection pattern | Same pattern used by teacher/student imports |

**Key insight:** This phase requires almost no new infrastructure. The parser is ~150 lines of cell-address lookups, and the preview/execute endpoints follow the exact same pattern as teacher/student imports.

## Common Pitfalls

### Pitfall 1: Formula Cells Return Objects, Not Values
**What goes wrong:** Reading `worksheet.getCell('E5').value` returns `{ formula: "IF(E5=\"\",...)", result: "רעננה" }` instead of the string `"רעננה"`.
**Why it happens:** ExcelJS preserves formula metadata. Form cells in Ministry files are almost all VLOOKUP formulas.
**How to avoid:** Use a `getCellValue()` helper that extracts `.result` from formula objects:
```javascript
function getCellValue(cell) {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && ('formula' in val || 'sharedFormula' in val)) {
    return val.result ?? null;
  }
  if (typeof val === 'object' && val.richText) {
    return val.richText.map(r => r?.text ?? '').join('');
  }
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return val;
}
```
**Warning signs:** All parsed values showing as `[object Object]`.

### Pitfall 2: Numeric Values Need String Coercion
**What goes wrong:** Fields like `code` (80), `cityCode` (8700), `businessNumber` (500287008) parse as numbers but the Joi schema expects strings.
**Why it happens:** VLOOKUP results are typed by the source data. Numeric codes come through as numbers.
**How to avoid:** Coerce all parsed values to strings (or null): `String(value)` for non-null values.
**Warning signs:** Joi validation errors on conservatoryProfile fields.

### Pitfall 3: Null Formula Results
**What goes wrong:** Some VLOOKUP formulas return `null` when the lookup key doesn't exist in the source table (e.g., `ownershipName` for Raanana returns `null`).
**Why it happens:** The Ministry Excel uses a master lookup table that may not have all fields populated for every conservatory.
**How to avoid:** Treat `null` results as valid — don't skip the field, import it as `null`. The diff should show `currentValue: "some old value" → importedValue: null` so the admin can decide.
**Warning signs:** Missing fields in the preview that should appear.

### Pitfall 4: $set Replacing Entire Nested Objects
**What goes wrong:** Calling `tenantService.updateTenant(id, { conservatoryProfile: parsedData })` replaces the ENTIRE conservatoryProfile, wiping any fields not in the Excel.
**Why it happens:** MongoDB `$set` with an object value replaces the whole sub-document.
**How to avoid:** Merge parsed values with existing tenant data before updating. The preview step already fetches current tenant data — reuse it.
**Warning signs:** Fields that were manually entered on the Settings page disappearing after import.

### Pitfall 5: Multiple Emails in a Single Cell
**What goes wrong:** The email field (`E20`) may contain multiple emails separated by semicolons.
**Why it happens:** Ministry forms allow multiple contact emails.
**How to avoid:** Store as-is (the schema accepts any string). Optionally parse and take the first email, but the full string is more faithful to the source.
**Warning signs:** Email validation failures if a strict email validator is applied.

## Code Examples

### Parsing a Form-Style Excel File

```javascript
// Source: Codebase pattern from api/import/import.service.js + Excel analysis
async function parseConservatoryExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('הקובץ לא מכיל גליונות');

  // Helper: extract resolved value from any cell type
  function getCellValue(cellAddress) {
    const cell = worksheet.getCell(cellAddress);
    const val = cell.value;
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && ('formula' in val || 'sharedFormula' in val)) {
      const result = val.result;
      if (result === null || result === undefined) return null;
      if (typeof result === 'object' && result.error) return null; // #NUM!, #REF!, etc.
      return result;
    }
    if (typeof val === 'object' && val.richText) {
      return val.richText.map(r => r?.text ?? '').join('');
    }
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return val;
  }

  // Coerce to string (for fields where Joi expects string but Excel has number)
  function toStr(val) {
    if (val === null || val === undefined) return null;
    return String(val).trim() || null;
  }

  const parsed = {
    // Left column (label C, value E)
    name: toStr(getCellValue('E5')),
    ownershipName: toStr(getCellValue('E7')),
    status: toStr(getCellValue('E9')),
    businessNumber: toStr(getCellValue('E11')),
    managerName: toStr(getCellValue('E14')),
    officePhone: toStr(getCellValue('E16')),
    mobilePhone: toStr(getCellValue('E18')),
    email: toStr(getCellValue('E20')),
    address: toStr(getCellValue('E22')),

    // Right column (label H, value J)
    code: toStr(getCellValue('J5')),
    socialCluster: toStr(getCellValue('J9')),
    supportUnit: toStr(getCellValue('J11')),
    stage: toStr(getCellValue('I14')),           // Stage letter (e.g., "C")
    stageDescription: toStr(getCellValue('J14')), // Full text (e.g., "שלב ג' ( מתקדם )")
    cityCode: toStr(getCellValue('J16')),
    sizeCategory: toStr(getCellValue('J18')),
    mainDepartment: toStr(getCellValue('J20')),
    supervisionStatus: toStr(getCellValue('J22')),
    district: toStr(getCellValue('J24')),

    // Mixed city factor (separate row)
    mixedCityFactor: toStr(getCellValue('I12')) || toStr(getCellValue('E12')),

    // Manager notes (merged cells C28:J31, value in top-left corner)
    managerNotes: toStr(getCellValue('C28')),
  };

  return parsed;
}
```

### Building Preview Response with Diff

```javascript
// Source: Derived from existing import preview pattern in import.service.js
async function previewConservatoryImport(buffer, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  // Parse Excel
  const parsed = await parseConservatoryExcel(buffer);

  // Fetch current tenant data for diff
  const tenant = await tenantService.getTenantById(tenantId);
  const currentProfile = tenant.conservatoryProfile || {};
  const currentDirector = tenant.director || {};

  // Field mapping: parsed key → { tenantPath, label }
  const FIELD_MAP = [
    { key: 'code', path: 'conservatoryProfile.code', label: 'קוד קונסרבטוריון' },
    { key: 'name', path: 'name', label: 'שם קונסרבטוריון' },  // tenant.name, not conservatoryProfile
    { key: 'ownershipName', path: 'conservatoryProfile.ownershipName', label: 'שם בעלות / רשות' },
    { key: 'status', path: 'conservatoryProfile.status', label: 'סטטוס' },
    { key: 'businessNumber', path: 'conservatoryProfile.businessNumber', label: 'מספר עוסק (ח.פ.)' },
    { key: 'managerName', path: 'conservatoryProfile.managerName', label: 'מנהל/ת הקונסרבטוריון' },
    { key: 'managerName', path: 'director.name', label: 'שם מנהל/ת (director)' },
    { key: 'officePhone', path: 'conservatoryProfile.officePhone', label: 'טלפון משרד' },
    { key: 'mobilePhone', path: 'conservatoryProfile.mobilePhone', label: 'טלפון נייד' },
    { key: 'email', path: 'conservatoryProfile.email', label: 'דוא"ל' },
    { key: 'address', path: 'conservatoryProfile.address', label: 'כתובת' },
    { key: 'socialCluster', path: 'conservatoryProfile.socialCluster', label: 'אשכול חברתי' },
    { key: 'supportUnit', path: 'conservatoryProfile.supportUnit', label: 'יחידה מקדמת' },
    { key: 'stage', path: 'conservatoryProfile.stage', label: 'שלב (קוד)' },
    { key: 'stageDescription', path: 'conservatoryProfile.stageDescription', label: 'שלב (תיאור)' },
    { key: 'cityCode', path: 'conservatoryProfile.cityCode', label: 'סמל ישוב' },
    { key: 'sizeCategory', path: 'conservatoryProfile.sizeCategory', label: 'רשות גדולה / קטנה' },
    { key: 'mainDepartment', path: 'conservatoryProfile.mainDepartment', label: 'מחלקה עיקרית' },
    { key: 'supervisionStatus', path: 'conservatoryProfile.supervisionStatus', label: 'סטטוס פיקוח' },
    { key: 'district', path: 'conservatoryProfile.district', label: 'מחוז' },
    { key: 'mixedCityFactor', path: 'conservatoryProfile.mixedCityFactor', label: 'מקדם עיר מעורבת' },
    { key: 'managerNotes', path: 'conservatoryProfile.managerNotes', label: 'הערות מנהל/ת' },
  ];

  // Build diff
  const fields = FIELD_MAP.map(({ key, path, label }) => {
    const currentValue = path.split('.').reduce((obj, k) => obj?.[k], tenant) ?? null;
    const importedValue = parsed[key] ?? null;
    return {
      field: path,
      label,
      currentValue: currentValue !== null ? String(currentValue) : null,
      importedValue: importedValue !== null ? String(importedValue) : null,
      changed: String(currentValue ?? '') !== String(importedValue ?? ''),
    };
  });

  const changedCount = fields.filter(f => f.changed).length;

  // Save to import_log
  const preview = { fields, changedCount, unchangedCount: fields.length - changedCount, warnings: [] };
  const importLogCollection = await getCollection('import_log');
  const logEntry = {
    importType: 'conservatory',
    tenantId,
    status: 'pending',
    createdAt: new Date(),
    preview,
    parsedData: parsed,  // Store parsed data for execute step
  };
  const result = await importLogCollection.insertOne(logEntry);

  return { importLogId: result.insertedId.toString(), preview };
}
```

### Execute Endpoint

```javascript
// Source: Derived from existing executeImport pattern
async function executeConservatoryImport(importLogId, userId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  const importLogCollection = await getCollection('import_log');
  const log = await importLogCollection.findOne({
    _id: ObjectId.createFromHexString(importLogId),
    tenantId,
    importType: 'conservatory',
  });
  if (!log) throw new Error('ייבוא לא נמצא');
  if (log.status !== 'pending') throw new Error('הייבוא כבר בוצע או נכשל');

  // Mark as processing
  await importLogCollection.updateOne(
    { _id: log._id },
    { $set: { status: 'processing', startedAt: new Date() } }
  );

  try {
    const parsed = log.parsedData;

    // Read current tenant and merge
    const tenant = await tenantService.getTenantById(tenantId);
    const mergedProfile = { ...(tenant.conservatoryProfile || {}), ...parsed };
    // Remove 'name' from mergedProfile (it goes to tenant.name, not conservatoryProfile)
    delete mergedProfile.name;
    delete mergedProfile.managerName; // Handled separately below

    const updateData = {
      conservatoryProfile: {
        ...mergedProfile,
        managerName: parsed.managerName,
      },
      director: {
        ...(tenant.director || {}),
        name: parsed.managerName,
      },
    };
    // Optionally update tenant.name if parsed
    if (parsed.name) updateData.name = parsed.name;

    await tenantService.updateTenant(tenantId, updateData);

    // Mark completed
    await importLogCollection.updateOne(
      { _id: log._id },
      { $set: { status: 'completed', completedAt: new Date(), uploadedBy: userId } }
    );

    return { success: true, updatedFields: Object.keys(parsed).filter(k => parsed[k] !== null).length };
  } catch (err) {
    await importLogCollection.updateOne(
      { _id: log._id },
      { $set: { status: 'failed', error: err.message, completedAt: new Date() } }
    );
    throw err;
  }
}
```

## Existing Infrastructure Analysis

### Tenant Update Mechanism (CONFIRMED WORKING)
- `PUT /api/tenant/:id` exists and is protected by `requireAuth(['מנהל'])`
- `tenantService.updateTenant()` validates with `tenantUpdateSchema` (which accepts partial `conservatoryProfile`)
- Uses `{ $set: value }` — so passing a complete merged `conservatoryProfile` object works correctly
- **Confidence: HIGH** — read from actual code

### conservatoryProfile Schema (19 fields, ALL NULLABLE)
All fields accept `null` or empty string with string type, defaulting to `null`:
```
code, ownershipName, status, socialCluster, businessNumber, supportUnit,
mixedCityFactor, stage, stageDescription, officePhone, mobilePhone,
cityCode, sizeCategory, mainDepartment, supervisionStatus, email,
address, managerName, managerNotes, district
```
**Confidence: HIGH** — read from `tenant.validation.js`

### Director Fields (separate from conservatoryProfile)
`director.name` and `director.teacherId` are top-level on the tenant document. The Excel provides the director's name at E14 — this should populate BOTH `conservatoryProfile.managerName` AND `director.name`.

### Import Pattern (preview → import_log → execute)
The existing flow stores preview results + parsed data in `import_log` with `status: 'pending'`, returns an `importLogId` to the client, then the execute endpoint reads the log entry and applies changes. This pattern should be followed exactly.

### Route Registration
Import routes are registered in `import.route.js`. New routes needed:
- `POST /api/import/conservatory/preview` — upload + parse + preview
- `POST /api/import/conservatory/execute/:importLogId` — apply changes (or reuse existing `/execute/:importLogId` with type check)

### Excel File Characteristics (from actual parsing)
| Property | Value |
|----------|-------|
| Sheet count | 1 |
| Sheet name | פרטי_קונסרבטוריון |
| Row count | 44 |
| Column count | 38 |
| Merged cells | ~20 ranges (headers, notes area) |
| Formula cells | ~25 (all VLOOKUPs from external reference table `MainTbCons`) |
| Data layout | Label/value pairs in columns C/E (left) and H/J (right) |
| Row 1-3 | Headers (title, year, budget) |
| Row 5-24 | Data fields |
| Row 27-31 | Manager notes (merged) |
| Row 32-44 | Empty (column AK has zeros) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Header-detection parsing | Fixed cell addresses | N/A (new feature) | Form-style requires different parser than row-based imports |
| Replace whole conservatoryProfile | Merge before update | N/A (design decision) | Prevents losing manually-entered fields |

## Open Questions

1. **Should `tenant.name` be updated from the Excel?**
   - What we know: E5 contains the conservatory name ("רעננה"). The tenant already has a `name` field.
   - What's unclear: The Excel value is just the city name, not the full name (e.g., "קונסרבטוריון רעננה"). The tenant.name is likely already more descriptive.
   - Recommendation: Include it in the preview diff but let the admin decide via the preview UI. The execute step should only update fields that changed.

2. **Should we handle different Excel layouts?**
   - What we know: The Ministry issues a standard form. Different conservatories receive the same template.
   - What's unclear: Whether older versions had different cell positions.
   - Recommendation: Start with the known layout. Add a validation check that verifies expected labels exist at expected positions (e.g., confirm C5 contains "קונסרבטוריון"). If labels don't match, return a helpful error.

3. **Should the execute endpoint reuse the existing `/execute/:importLogId` route or have its own?**
   - What we know: The existing execute checks `log.importType` and dispatches to `executeTeacherImport` or `executeStudentImport`.
   - Recommendation: Add `'conservatory'` case to the existing execute dispatcher. This keeps one route for all import types.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `api/import/import.service.js` — existing parsing patterns, preview/execute flow
- Codebase analysis: `api/tenant/tenant.validation.js` — conservatoryProfile schema (19 fields)
- Codebase analysis: `api/tenant/tenant.service.js` — updateTenant uses $set with Joi-validated value
- Codebase analysis: `api/tenant/tenant.route.js` — PUT /:id exists, admin-only
- Codebase analysis: `api/import/import.route.js` — multer configuration, route patterns
- Excel file analysis: `/mnt/c/Users/yona2/Documents/Tenuto.io/מידע/פרטי_קונסרבטוריון-משרד החינוך.xlsx` — all 44 rows dumped and mapped

### Secondary (MEDIUM confidence)
- Codebase analysis: `api/export/sheets/profile.sheet.js` — confirms field usage patterns for conservatoryProfile in export
- Frontend analysis: `src/pages/Settings.tsx` — confirms Settings page does NOT currently show conservatoryProfile (Phase 22 scope)
- Frontend analysis: `src/pages/ImportData.tsx` — confirms 3-step import UI pattern (upload → preview → results)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — follows exact existing patterns from teacher/student import
- Excel cell mapping: HIGH — derived from actual file parsing, every cell address verified
- Pitfalls: HIGH — all based on observed data (formula objects, null results, numeric coercion)

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable — form format unlikely to change mid-year)
