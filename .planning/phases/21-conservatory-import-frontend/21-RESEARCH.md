# Phase 21: Conservatory Import Frontend - Research

**Researched:** 2026-02-27
**Domain:** React frontend — extending existing import page with conservatory tab, side-by-side diff preview, and execute flow
**Confidence:** HIGH

## Summary

Phase 21 adds a third tab to the existing `ImportData.tsx` page for importing conservatory profile data from a Ministry of Education Excel form. The backend API is fully implemented in Phase 20 — this phase is purely frontend work within the existing import page component and the `apiService.js` service layer.

The existing import page (`src/pages/ImportData.tsx`, ~1113 lines) follows a 3-step flow (upload -> preview -> results) with two tabs (teachers/students). The conservatory tab reuses the same 3-step flow but the preview step is fundamentally different: instead of a table of matched/unmatched rows, it shows a **side-by-side diff** of 22 field-level comparisons (current value vs. imported value), with changed fields visually highlighted. The backend returns a `preview.fields[]` array where each entry has `{ field, label, currentValue, importedValue, changed }`, plus `changedCount` and `unchangedCount` summary stats.

The execute step reuses the existing `importService.executeImport(importLogId)` call — the backend dispatcher handles routing to the conservatory handler based on `importType: 'conservatory'`. The results step is simpler than teacher/student imports: it shows a success message with the count of updated fields (no rows/errors/creates breakdown needed).

**Primary recommendation:** Add a `'conservatory'` case to the existing `ImportTab` type and `ImportData` component. The upload step needs a new `ConservatoryFileGuide` component. The preview step needs a new diff-table renderer (not reusing the teacher/student row-table). The results step is a simplified version of the existing pattern. Add `previewConservatoryImport(file)` to `importService` in `apiService.js`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.1 | Component framework | Already in use throughout frontend |
| TypeScript | (project config) | Type safety | Already in use, all pages are .tsx |
| Tailwind CSS | (project config) | Styling | Already used on every page, RTL support via custom plugin |
| @phosphor-icons/react | ^2.1.10 | Icons | Already used in ImportData.tsx (UploadIcon, FileXlsIcon, etc.) |
| react-hot-toast | ^2.6.0 | User notifications | Already used in ImportData.tsx for success/error toasts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| StepProgress component | (internal) | 3-step progress indicator | Already imported and used in ImportData.tsx |
| Card/CardHeader/CardContent | (internal) | Settings-style card layout | Used in Settings.tsx, could be used for diff display |
| apiService importService | (internal) | API calls | Add previewConservatoryImport method |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline diff table | react-diff library | Overkill — we have structured field data, not text diffs |
| Custom tab buttons | @radix-ui/react-tabs | Tabs component exists but import page uses custom button tabs — follow existing pattern |
| New page component | Extending ImportData.tsx | Conservatory import is a natural third tab, not a separate page |

**Installation:**
```bash
# No new packages needed — all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure
```
Frontend changes:
src/
├── pages/
│   └── ImportData.tsx            # MODIFY: Add 'conservatory' tab + diff preview + results
├── services/
│   └── apiService.js             # MODIFY: Add previewConservatoryImport to importService
└── (no new files needed — single component modification)
```

### Pattern 1: Extending ImportTab Union Type
**What:** The existing `ImportTab` type is `'teachers' | 'students'`. Add `'conservatory'` as a third option. The entire component branches on `activeTab` throughout — upload handler, preview rendering, results rendering all check the current tab.

**When to use:** When the conservatory tab needs different behavior in each step.

**Example:**
```typescript
// Source: Existing pattern in ImportData.tsx lines 19-20
type ImportTab = 'teachers' | 'students' | 'conservatory'

// Upload handler — line 612
const result = activeTab === 'teachers'
  ? await importService.previewTeacherImport(file)
  : activeTab === 'students'
    ? await importService.previewStudentImport(file)
    : await importService.previewConservatoryImport(file)
```

### Pattern 2: Conservatory Preview Data Shape (Different from Teacher/Student)
**What:** The teacher/student preview returns `{ matched[], notFound[], errors[], warnings[] }` — arrays of row objects. The conservatory preview returns `{ fields[], changedCount, unchangedCount, warnings[] }` — an array of field-level diffs.

**When to use:** The preview rendering must detect which shape it's dealing with. Use `activeTab` to branch, or add a type guard.

**Backend response shape (from Phase 20 implementation):**
```typescript
interface ConservatoryPreviewData {
  importLogId: string
  preview: {
    fields: Array<{
      field: string        // e.g. "conservatoryProfile.code"
      label: string        // e.g. "קוד קונסרבטוריון" (Hebrew display name)
      currentValue: string | null
      importedValue: string | null
      changed: boolean
    }>
    changedCount: number   // e.g. 14
    unchangedCount: number // e.g. 8
    warnings: any[]
  }
}
```

### Pattern 3: Side-by-Side Diff Table
**What:** The preview for conservatory shows a 3-column table: Field Label | Current Value | Imported Value. Changed rows are highlighted with a colored background. Unchanged rows show values in muted gray.

**When to use:** Always for the conservatory tab preview step.

**Example:**
```tsx
// Diff row rendering pattern
{fields.map((f) => (
  <tr key={f.field} className={f.changed ? 'bg-amber-50' : ''}>
    <td className="font-medium text-gray-700">{f.label}</td>
    <td className={f.changed ? 'text-red-500 line-through' : 'text-gray-500'}>
      {f.currentValue || '---'}
    </td>
    <td className={f.changed ? 'text-green-700 font-medium' : 'text-gray-500'}>
      {f.importedValue || '---'}
    </td>
  </tr>
))}
```

### Pattern 4: Conservatory Execute Result Shape
**What:** The conservatory execute endpoint returns `{ success: true, updatedFields: number }` — much simpler than teacher/student which return `{ totalRows, successCount, createdCount, errorCount, ... }`.

**When to use:** The results step for conservatory should show a simple success message with updated field count, not the full 5-stat grid used for teachers/students.

### Anti-Patterns to Avoid
- **Reusing the teacher/student preview table for conservatory:** The preview data shapes are completely different. Teacher/student has matched/notFound/errors arrays of row objects; conservatory has a flat `fields[]` array. Don't force-fit one into the other.
- **Creating a separate page component:** The conservatory import naturally belongs as a third tab on the existing import page. Don't create a new route/page.
- **Extracting allPreviewRows for conservatory:** The `allPreviewRows` variable merges `matched`, `notFound`, and `errors` arrays — these don't exist in the conservatory response. Conservatory preview needs its own rendering path.
- **Checking `matched.length + notFound.length` for execute button:** Conservatory has no matched/notFound arrays. The execute button should check `changedCount > 0` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload/drag-drop | New upload component | Existing upload zone in ImportData.tsx | Already has drag, file validation, loading spinner |
| Step progress indicator | Custom stepper | Existing StepProgress component | Already imported and working |
| Toast notifications | Custom notification system | react-hot-toast (already used) | Consistent UX across all import tabs |
| API call pattern | Custom fetch logic | Extend importService in apiService.js | Follow existing pattern for teacher/student previews |
| Tab button styling | New tab component | Existing button-based tab pattern | Match existing teachers/students tab buttons |

**Key insight:** Almost every UI primitive needed already exists in the ImportData.tsx component. The main new work is the diff table (which is a simple HTML table with conditional styling) and the conservatory-specific file guide.

## Common Pitfalls

### Pitfall 1: PreviewData Type Mismatch
**What goes wrong:** The existing `PreviewData` interface expects `preview.matched`, `preview.notFound`, `preview.errors` arrays. Using the same type for conservatory will cause TypeScript errors or runtime crashes when accessing `.matched.length`.
**Why it happens:** Conservatory preview response has a completely different shape (`preview.fields[]` instead of `preview.matched[]`).
**How to avoid:** Create a new `ConservatoryPreviewData` interface for the conservatory tab. Use a union type or separate state variable. Or use `any` with careful runtime checks.
**Warning signs:** "Cannot read property 'length' of undefined" errors when switching to conservatory tab preview.

### Pitfall 2: Execute Button Logic
**What goes wrong:** The existing execute button is disabled when `previewData.preview.matched.length === 0 && previewData.preview.notFound.length === 0`. This crashes for conservatory preview because those arrays don't exist.
**Why it happens:** The disable logic assumes teacher/student preview shape.
**How to avoid:** Branch the execute button's disabled condition based on `activeTab`. For conservatory, disable when `changedCount === 0`.
**Warning signs:** Execute button always disabled on conservatory tab, or JavaScript error.

### Pitfall 3: Results Display Assuming Row-Based Stats
**What goes wrong:** The results display shows totalRows, successCount, createdCount, skippedCount, errorCount. Conservatory returns `{ success: true, updatedFields: number }` — no row-based stats.
**Why it happens:** Different import types have different result shapes.
**How to avoid:** Branch the results step rendering based on `activeTab`. Conservatory results should show a simple "X fields updated successfully" message.
**Warning signs:** "undefined" appearing in results stats, or NaN values.

### Pitfall 4: State Not Resetting on Tab Switch
**What goes wrong:** If user is in preview step on teachers tab, switches to conservatory tab, the preview data from teachers is still in state and gets rendered incorrectly.
**Why it happens:** The existing `handleTabChange` already calls `resetState()` which clears `previewData` — this should work. But if additional conservatory-specific state is added, it must also be reset.
**How to avoid:** Ensure `resetState()` clears ALL state including any conservatory-specific additions.
**Warning signs:** Stale data from another tab appearing after switch.

### Pitfall 5: Missing apiService Method
**What goes wrong:** Frontend calls `importService.previewConservatoryImport(file)` but the method doesn't exist in `apiService.js`.
**Why it happens:** The backend endpoint exists (Phase 20) but the frontend service layer hasn't been updated.
**How to avoid:** Add `previewConservatoryImport(file)` method to `importService` in `apiService.js`, following the exact same pattern as `previewTeacherImport` and `previewStudentImport`.
**Warning signs:** "importService.previewConservatoryImport is not a function" error.

### Pitfall 6: RTL Layout in Diff Table
**What goes wrong:** The diff table columns appear in wrong order or text alignment is off in RTL mode.
**Why it happens:** The page uses `dir="rtl"` which reverses table column order. "Current" should appear on the right (first in reading order for Hebrew) and "Imported" on the left.
**How to avoid:** Design the diff table with RTL in mind. The column order in HTML should be: Label | Current | Imported (which in RTL renders as Imported | Current | Label from left to right, but the reading direction is right-to-left so Label is first).
**Warning signs:** Columns appearing backwards, arrow indicating direction of change pointing wrong way.

## Code Examples

Verified patterns from the existing codebase:

### apiService.js — Add previewConservatoryImport
```javascript
// Source: Pattern from existing previewTeacherImport (apiService.js:5072-5101)
async previewConservatoryImport(file) {
  try {
    console.log('Uploading conservatory import file for preview');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${apiClient.baseURL}/import/conservatory/preview`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiClient.getStoredToken()}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error importing conservatory file');
    }

    const result = await response.json();
    console.log('Conservatory import preview ready');
    return result;
  } catch (error) {
    console.error('Error previewing conservatory import:', error);
    throw error;
  }
}
```

### TypeScript Interface for Conservatory Preview
```typescript
// Source: Derived from backend response in import.service.js:2018-2046
interface ConservatoryPreviewField {
  field: string           // e.g. "conservatoryProfile.code"
  label: string           // e.g. "קוד קונסרבטוריון"
  currentValue: string | null
  importedValue: string | null
  changed: boolean
}

interface ConservatoryPreviewData {
  importLogId: string
  preview: {
    fields: ConservatoryPreviewField[]
    changedCount: number
    unchangedCount: number
    warnings: any[]
  }
}

interface ConservatoryImportResult {
  success: boolean
  updatedFields: number
}
```

### Tab Button Pattern (existing)
```tsx
// Source: ImportData.tsx lines 720-743
// Add third tab button following exact same pattern:
<button
  onClick={() => handleTabChange('conservatory')}
  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
    activeTab === 'conservatory'
      ? 'bg-primary-500/10 text-primary-600 border border-primary-500/20'
      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
  }`}
>
  <BuildingOfficeIcon size={16} weight="regular" />
  פרטי קונסרבטוריון
</button>
```

### Diff Table Rendering Pattern
```tsx
// Source: Derived from backend fields[] shape + existing preview table styling
function ConservatoryDiffPreview({ fields }: { fields: ConservatoryPreviewField[] }) {
  return (
    <div className="rounded-3xl shadow-sm bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">השוואת נתונים</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80">
              <th className="text-right py-3 px-4 font-medium text-gray-600 text-xs uppercase tracking-wider">שדה</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 text-xs uppercase tracking-wider">ערך נוכחי</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 text-xs uppercase tracking-wider">ערך מיובא</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((f) => (
              <tr key={f.field} className={`transition-colors ${f.changed ? 'bg-amber-50/60' : 'hover:bg-gray-50/50'}`}>
                <td className="py-3 px-4 font-medium text-gray-700">{f.label}</td>
                <td className={`py-3 px-4 ${f.changed ? 'text-red-500 line-through' : 'text-gray-500'}`}>
                  {f.currentValue || <span className="text-gray-300">---</span>}
                </td>
                <td className={`py-3 px-4 ${f.changed ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  {f.importedValue || <span className="text-gray-300">---</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Upload Handler Branching
```typescript
// Source: ImportData.tsx handleFile callback (line 600-624)
const handleFile = useCallback(async (file: File) => {
  // ... file validation same as existing ...
  try {
    setLoading(true)
    let result
    if (activeTab === 'teachers') {
      result = await importService.previewTeacherImport(file)
    } else if (activeTab === 'students') {
      result = await importService.previewStudentImport(file)
    } else {
      result = await importService.previewConservatoryImport(file)
    }
    setPreviewData(result)
    setImportState('preview')
  } catch (error: any) {
    toast.error(error.message || 'Error processing file')
  } finally {
    setLoading(false)
  }
}, [activeTab])
```

### Execute Button Disabled Logic
```tsx
// Source: Derived from existing pattern (line 1024) + conservatory shape
disabled={executing || (
  activeTab === 'conservatory'
    ? (previewData?.preview as any)?.changedCount === 0
    : (previewData?.preview?.matched?.length === 0 && previewData?.preview?.notFound?.length === 0)
)}
```

### Conservatory File Guide Component
```tsx
// Source: Pattern from existing TeacherFileStructureGuide and student guide
function ConservatoryFileGuide() {
  return (
    <div className="rounded-3xl shadow-sm bg-white p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">קובץ פרטי קונסרבטוריון</h3>
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-4">
        <div className="flex items-start gap-2">
          <InfoIcon size={20} weight="fill" className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">קובץ מימשק משרד החינוך - פרטי קונסרבטוריון</p>
            <p className="text-xs text-blue-700 mt-0.5">
              יש להעלות את קובץ ה-Excel של פרטי הקונסרבטוריון כפי שהתקבל ממשרד החינוך.
              הקובץ מכיל גיליון אחד עם פרטי המוסד בפורמט טופס (לא טבלה).
            </p>
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-600 space-y-2">
        <p>השדות שייקראו מהקובץ:</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
          <span>שם קונסרבטוריון</span>
          <span>קוד קונסרבטוריון</span>
          <span>שם בעלות / רשות</span>
          <span>אשכול חברתי</span>
          <span>סטטוס</span>
          <span>יחידה מקדמת</span>
          <span>מספר עוסק (ח.פ.)</span>
          <span>שלב קונסרבטוריון</span>
          <span>מנהל/ת</span>
          <span>סמל ישוב</span>
          <span>טלפון משרד / נייד</span>
          <span>רשות גדולה / קטנה</span>
          <span>דוא"ל</span>
          <span>מחלקה עיקרית</span>
          <span>כתובת</span>
          <span>סטטוס פיקוח</span>
          <span>מחוז</span>
          <span>מקדם עיר מעורבת</span>
        </div>
      </div>
    </div>
  )
}
```

## Backend API Reference (Phase 20 — Already Implemented)

### POST /api/import/conservatory/preview
- **Auth:** `requireAuth(['מנהל'])` (admin only)
- **Body:** `multipart/form-data` with `file` field (.xlsx)
- **Response:** `{ importLogId: string, preview: { fields: ConservatoryPreviewField[], changedCount: number, unchangedCount: number, warnings: [] } }`
- **22 fields returned** — 19 conservatoryProfile fields + name (tenant.name) + director.name + managerName (maps to both conservatoryProfile.managerName AND director.name)

### POST /api/import/execute/:importLogId
- **Auth:** `requireAuth(['מנהל'])` (admin only)
- **Body:** none (importLogId in URL)
- **Response for conservatory type:** `{ success: true, updatedFields: number }`
- **Existing endpoint — already handles conservatory via dispatcher** (checks `log.importType === 'conservatory'`)

### Execute Behavior (conservatory-specific)
- Reads `parsedData` from the import_log entry
- Fetches current tenant, merges parsed fields with existing `conservatoryProfile`
- Updates `conservatoryProfile`, `director.name`, and optionally `tenant.name`
- Preserves any manually-entered fields not present in the Excel

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two-tab import page | Three-tab import page | Phase 21 | New conservatory tab alongside teachers/students |
| Row-based preview only | Row-based + field-level diff | Phase 21 | Conservatory uses diff view, teachers/students keep row table |
| No conservatory API method | previewConservatoryImport in importService | Phase 21 | Frontend service layer extended |

## Open Questions

1. **Should the conservatory tab show the execute confirmation as a count of changed fields or as a full field list?**
   - What we know: Backend returns `{ success: true, updatedFields: N }`. The preview already showed the full diff.
   - What's unclear: Whether users want a re-confirmation of which specific fields changed before executing.
   - Recommendation: Show the changed count in the execute button text (e.g., "עדכן X שדות"). The full diff is visible above. A modal confirmation is unnecessary — the preview IS the confirmation step.

2. **Should the page subtitle update when conservatory tab is active?**
   - What we know: Current subtitle is "ייבוא מורים ותלמידים מקובץ Excel" (line 715).
   - Recommendation: Update dynamically based on tab. For conservatory: "ייבוא פרטי קונסרבטוריון מקובץ Excel".

3. **What icon to use for the conservatory tab?**
   - What we know: Teachers tab uses GraduationCapIcon, Students tab uses UsersIcon. Phosphor Icons has BuildingOffice, Buildings, Bank icons.
   - Recommendation: Use `BuildingsIcon` from @phosphor-icons/react. It represents an institution/building, distinct from GraduationCap (teachers) and Users (students). Settings page already uses BuildingIcon for general info section.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/pages/ImportData.tsx` — complete existing component (1113 lines), all patterns, types, tab flow
- Codebase: `src/services/apiService.js` — importService methods (lines 5071-5145), tenantService methods (lines 4967-5010)
- Codebase: `api/import/import.service.js` — backend previewConservatoryImport (lines 1980-2047), executeConservatoryImport (lines 2089-2141)
- Codebase: `api/import/import.controller.js` — controller with previewConservatoryImport handler
- Codebase: `api/import/import.route.js` — route: POST /conservatory/preview
- Codebase: `api/tenant/tenant.validation.js` — conservatoryProfile schema (19 fields, all nullable strings)
- Codebase: `src/pages/Settings.tsx` — existing settings page pattern (344 lines)
- Codebase: `package.json` — React 18.3.1, @phosphor-icons/react 2.1.10, react-hot-toast 2.6.0, Tailwind

### Secondary (MEDIUM confidence)
- Phase 20 RESEARCH.md — backend API design, preview response shape, execute behavior
- Codebase: `src/components/feedback/ProgressIndicators.tsx` — StepProgress component interface

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in the exact component being modified
- Architecture: HIGH — patterns derived from reading the actual ImportData.tsx code (1113 lines analyzed)
- Backend API shape: HIGH — read directly from implemented import.service.js (Phase 20 complete)
- Pitfalls: HIGH — all based on actual code structure analysis (TypeScript types, conditional rendering branches)
- UI design: MEDIUM — diff table styling is a recommendation, not derived from existing code (no diff table exists yet)

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable — component patterns unlikely to change)
