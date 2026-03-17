# Phase 79: Rehearsal Form Redesign - Research

**Researched:** 2026-03-18
**Domain:** React form component redesign - design system migration
**Confidence:** HIGH

## Summary

The RehearsalForm component (`src/components/RehearsalForm.tsx`, 639 lines) is a self-contained modal with two modes (single rehearsal / bulk recurring). It currently uses raw HTML elements (`<select>`, `<input>`, `<textarea>`, `<button>`) with hardcoded `gray-*`, `red-*`, and `blue-*` Tailwind classes, and a custom fixed-overlay modal pattern without focus trap or ARIA support.

The codebase already has fully migrated reference components: **OrchestraForm** (uses FormField, shadcn Select with SelectGroup/SelectLabel, shadcn Input, shadcn Button, semantic tokens) and **AddTeacherModal** (uses React Hook Form + shadcn Dialog + FormField + all design system primitives). The RehearsalForm is the last major form to be migrated.

The migration is a UI-only refactor: all form state management, validation logic (`validateRehearsalForm`, `validateBulkRehearsalForm`), submit handlers, ConflictDetector integration, and component interface (props) must remain unchanged. The form does NOT use React Hook Form currently and should NOT be migrated to it -- this phase is purely about replacing raw HTML elements and hardcoded colors with design system components.

**Primary recommendation:** Follow the OrchestraForm pattern exactly -- replace the custom overlay with shadcn Dialog, replace all raw inputs/selects/buttons with design system components, replace the custom tab toggle with Radix Tabs, and replace all hardcoded color classes with semantic tokens. Do NOT change the existing useState-based form management.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn Dialog | (Radix) | Modal with focus trap, ARIA, Escape, scroll lock | Already in `ui/dialog.tsx` with Framer Motion entrance |
| shadcn Select | (Radix) | Dropdowns with SelectGroup/SelectLabel grouping | Already in `ui/select.tsx`, used by OrchestraForm |
| shadcn Input | - | Text/date/time inputs with consistent styling | Already in `ui/input.tsx` |
| shadcn Textarea | - | Multi-line text input | Already in `ui/textarea.tsx` |
| Radix Tabs | - | Mode toggle (single/bulk) | Already in `ui/tabs.tsx` |
| FormField | - | Label + error display + required asterisk wrapper | Already in `ui/form-field.tsx` |
| Button (shadcn) | - | All action buttons with CVA variants | Already in `ui/button.tsx` with Framer Motion tap |
| Badge | - | Exclude date chips, preview date count | Already in `ui/badge.tsx` with CVA variants |
| @phosphor-icons/react | - | All icons (already used in current form) | Existing dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cn (lib/utils) | - | Conditional class merging | Every component with conditional styles |
| Framer Motion | - | Dialog entrance animation | Built into shadcn Dialog already |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Tabs for mode toggle | HeroUI Tabs | Memory note says "all tabs use HeroUI Tabs" but codebase actually uses Radix Tabs component in `ui/tabs.tsx`. Use the existing Radix Tabs component for consistency with the rest of the design system. |

**Installation:**
No new packages needed -- all components already exist in the project.

## Architecture Patterns

### Pattern 1: Dialog-Controlled Modal (from AddTeacherModal / existing pattern)
**What:** The form currently manages its own overlay. With shadcn Dialog, the parent controls open/close state via the `open` prop.
**When to use:** Every modal form in the app.

**Critical integration detail:** The RehearsalForm is rendered by THREE callers:
1. `Rehearsals.tsx` -- conditionally renders with `{showCreateForm && <RehearsalForm .../>}`
2. `Rehearsals.tsx` -- conditionally renders with `{showEditForm && editingRehearsal && <RehearsalForm .../>}`
3. `Sidebar.tsx` -- wraps in its OWN overlay div, then conditionally renders `{showRehearsalForm && <RehearsalForm .../>}`

**The Sidebar has a double-overlay problem:** Sidebar wraps in `<div className="fixed inset-0 bg-black bg-opacity-50 ...">` AND the form also renders its own `<div className="fixed inset-0 bg-black bg-opacity-50 ...">`. When migrating to shadcn Dialog, the form will handle its own overlay via DialogOverlay, so the Sidebar wrapper must be updated to remove its redundant overlay.

**Recommended approach:** Make RehearsalForm accept an `open` boolean and `onOpenChange` callback instead of `onCancel`. Wrap the entire form content in `<Dialog open={open} onOpenChange={onOpenChange}>`. Each caller passes its existing boolean state.

### Pattern 2: FormField Wrapper (from OrchestraForm)
**What:** Every form field wrapped in `<FormField label="..." htmlFor="..." error={errors.fieldName} required>` for consistent label, asterisk, and error display.
**Example from OrchestraForm:**
```tsx
<FormField label="שם התזמורת" htmlFor="name" error={errors.name} required>
  <div className="relative">
    <MusicNotesIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    <Input
      id="name"
      value={formData.name}
      onChange={(e) => handleInputChange('name', e.target.value)}
      aria-invalid={!!errors.name}
      aria-describedby={errors.name ? 'name-error' : undefined}
      className={cn("ps-9", errors.name && "border-destructive focus-visible:ring-destructive")}
      placeholder="הזן שם לתזמורת"
    />
  </div>
</FormField>
```

### Pattern 3: Grouped Select (from OrchestraForm location dropdown)
**What:** Location dropdown uses SelectGroup + SelectLabel to group by room category (halls, studios, rehearsal rooms, classrooms, theory rooms, other).
**Example from OrchestraForm:**
```tsx
<Select value={formData.location} onValueChange={(val) => handleInputChange('location', val)}>
  <SelectTrigger id="location" className={cn(errors.location && "border-destructive focus:ring-destructive")}>
    <SelectValue placeholder="בחר מיקום" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>אולמות</SelectLabel>
      {VALID_LOCATIONS.filter(loc => loc.includes('אולם')).map(location => (
        <SelectItem key={location} value={location}>{location}</SelectItem>
      ))}
    </SelectGroup>
    {/* ... more groups */}
  </SelectContent>
</Select>
```

### Pattern 4: Semantic Token Color Mapping
**What:** Replace all hardcoded Tailwind colors with semantic tokens.

| Current (hardcoded) | Replace with (semantic) |
|---------------------|------------------------|
| `text-gray-900` | `text-foreground` |
| `text-gray-700` | `text-foreground` or `text-muted-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `border-gray-300` | `border-input` or `border-border` |
| `border-gray-200` | `border-border` |
| `bg-gray-100` | `bg-muted` |
| `bg-gray-600` | use Button component instead |
| `hover:bg-gray-50` | `hover:bg-accent` |
| `hover:bg-gray-700` | use Button component instead |
| `text-red-500` | `text-destructive` (handled by FormField) |
| `text-red-600` | `text-destructive` (handled by FormField) |
| `text-red-800` | `text-destructive` |
| `border-red-200` | `border-destructive/30` |
| `border-red-300` | `border-destructive` |
| `bg-red-50` | `bg-destructive/10` |
| `bg-blue-50` | `bg-primary/5` or `bg-muted` |
| `text-blue-600` | `text-primary` |
| `text-blue-700` | `text-primary` |
| `text-blue-900` | `text-foreground` |
| `bg-white` | `bg-background` |

### Pattern 5: Radix Tabs for Mode Toggle
**What:** Replace the custom single/bulk toggle with Radix Tabs.
```tsx
<Tabs value={mode} onValueChange={(val) => setMode(val as 'single' | 'bulk')}>
  <TabsList className="w-full">
    <TabsTrigger value="single" className="flex-1">חזרה יחידה</TabsTrigger>
    <TabsTrigger value="bulk" className="flex-1">חזרות חוזרות</TabsTrigger>
  </TabsList>
  <TabsContent value="single">
    {/* single form fields */}
  </TabsContent>
  <TabsContent value="bulk">
    {/* bulk form fields */}
  </TabsContent>
</Tabs>
```

### Pattern 6: Exclude Date Chips with Badge
**What:** Replace the custom `bg-gray-100 rounded px-2 py-1` chip pattern for excluded dates with Badge + dismiss button.
```tsx
<Badge variant="secondary" className="gap-1">
  {new Date(date).toLocaleDateString('he-IL')}
  <button type="button" onClick={() => handleRemoveExcludeDate(date)} className="hover:text-destructive">
    <XIcon className="w-3 h-3" />
  </button>
</Badge>
```

### Anti-Patterns to Avoid
- **Double overlay:** The Sidebar wraps RehearsalForm in its own overlay. After migration, the Sidebar must use `<Dialog>` controlled open/close, not a wrapper div.
- **Mixing raw and design system elements:** Do not leave any `<select>`, `<input>`, or `<button>` (non-component) in the form.
- **Changing form logic during UI refactor:** The useState-based form management, validation functions, ConflictDetector props, and submit handler must remain untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay + focus trap | Custom `fixed inset-0` div | shadcn Dialog (Radix Dialog) | Focus trap, Escape key, scroll lock, ARIA labels, Framer Motion entrance all built in |
| Form field labels + errors | Custom `<label>` + `<p>` for errors | FormField component | Consistent pattern, accessibility (aria-describedby), required asterisk |
| Dropdown with categories | Raw `<select>` with flat options | shadcn Select with SelectGroup/SelectLabel | Accessible grouped dropdown, consistent styling |
| Mode toggle | Custom button group with `bg-gray-100` | Radix Tabs (TabsList + TabsTrigger + TabsContent) | Keyboard navigation, ARIA tabpanel, semantic active state |
| Dismissible chips | Custom `bg-gray-100` divs | Badge component with dismiss button | Consistent styling, proper tokens |
| Buttons | Raw `<button>` with inline Tailwind | shadcn Button with variant prop | CVA variants, Framer Motion tap animation, consistent sizing |

**Key insight:** Every UI element in this form already has a design system equivalent in `src/components/ui/`. This is a pure replacement task with zero new component creation needed.

## Common Pitfalls

### Pitfall 1: shadcn Dialog max-width for wide forms
**What goes wrong:** Default DialogContent has `max-w-lg` (32rem / 512px). The current form uses `max-w-2xl` (42rem / 672px).
**Why it happens:** DialogContent defaults are optimized for simple confirmation dialogs.
**How to avoid:** Pass `className="max-w-2xl"` to DialogContent to match the current form width.
**Warning signs:** Form fields cramped, layout broken on desktop.

### Pitfall 2: Dialog scroll behavior for long forms
**What goes wrong:** DialogContent uses `fixed` positioning with `translate`. Long forms with many fields (especially bulk mode with preview dates) need scrolling.
**Why it happens:** Default DialogContent doesn't handle overflow.
**How to avoid:** Add `max-h-[85vh] overflow-y-auto` to the DialogContent className, or wrap content in a scrollable inner div.
**Warning signs:** Content cut off, unable to reach submit button.

### Pitfall 3: Radix Select does not support empty string values
**What goes wrong:** The current form uses `<option value="">בחר תזמורת</option>` as placeholder. Radix Select's `SelectItem` cannot have `value=""`.
**Why it happens:** Radix Select treats empty string as no selection.
**How to avoid:** Use `SelectValue placeholder="בחר תזמורת"` for the unselected state. The Select should have `value={formValue || undefined}` so that when formValue is `""`, it shows the placeholder.
**Warning signs:** Placeholder not showing, or "בחר תזמורת" appearing as a selectable item.

### Pitfall 4: Three separate callers need updating
**What goes wrong:** Updating RehearsalForm but not its callers leads to broken modals.
**Why it happens:** The form is used in Rehearsals.tsx (create), Rehearsals.tsx (edit), Sidebar.tsx, and RehearsalDetails.tsx.
**How to avoid:** Update all 4 call sites. The Sidebar is the most complex because it wraps in its own overlay div that must be removed.
**Warning signs:** Double overlay (darker than expected backdrop), click-outside not working.

### Pitfall 5: date/time input type with shadcn Input
**What goes wrong:** shadcn Input is a generic wrapper. `type="date"` and `type="time"` inputs have browser-native UI that may look different from other shadcn inputs.
**Why it happens:** Date/time pickers are browser-controlled, not shadcn-styled.
**How to avoid:** This is acceptable -- just use `<Input type="date" />` and `<Input type="time" />`. The border, focus ring, and sizing will be consistent. The picker chrome is browser-native.
**Warning signs:** None -- this is expected behavior.

### Pitfall 6: Radix Tabs unmounts inactive TabsContent
**What goes wrong:** If Radix Tabs unmounts the inactive tab's content, form state in useState survives (since it's in the parent), but any uncontrolled DOM state would be lost.
**Why it happens:** Default Radix Tabs behavior unmounts inactive panels.
**How to avoid:** This form uses controlled state (useState) for all fields, so tab switching is safe. The current conditional rendering (`mode === 'single' ? ... : ...`) already unmounts/remounts. Use `forceMount` on TabsContent if needed, but it should not be necessary here.
**Warning signs:** Form fields resetting when switching tabs (won't happen with useState).

### Pitfall 7: ConflictDetector rendering inside Dialog
**What goes wrong:** ConflictDetector is rendered inside the form. If it has any z-index issues or portal-based rendering, it could conflict with the Dialog portal.
**Why it happens:** Dialog renders in a portal at the end of body.
**How to avoid:** ConflictDetector is a plain component (no portals), so it will render fine inside Dialog. Just ensure it's within the form layout flow.
**Warning signs:** ConflictDetector rendering behind the dialog overlay.

## Code Examples

### Complete Dialog Structure for RehearsalForm
```tsx
// Source: codebase patterns from OrchestraForm + AddTeacherModal + dialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Props change: onCancel becomes part of Dialog's onOpenChange
interface RehearsalFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orchestras: Array<{...}>
  existingRehearsals?: Rehearsal[]
  onSubmit: (data: RehearsalFormData | BulkRehearsalData, isBulk: boolean) => Promise<void>
  initialData?: Partial<RehearsalFormData>
}

// Usage in Dialog:
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{initialData ? 'ערוך חזרה' : 'חזרה חדשה'}</DialogTitle>
      {!initialData && (
        <DialogDescription>צור חזרה יחידה או סדרת חזרות חוזרות</DialogDescription>
      )}
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tabs, fields, ConflictDetector, actions */}
    </form>
  </DialogContent>
</Dialog>
```

### Error Display with Semantic Tokens
```tsx
// Replace: bg-red-50 border border-red-200 rounded p-4 + text-red-800
// With:
{errors.submit && (
  <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4">
    <p className="text-destructive text-sm">{errors.submit}</p>
  </div>
)}
```

### Preview Dates with Semantic Tokens
```tsx
// Replace: bg-blue-50 + text-blue-600/700/900
// With:
{previewDates.length > 0 && (
  <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
    <div className="flex items-center mb-2">
      <WarningCircleIcon className="w-4 h-4 text-primary ml-1" />
      <span className="text-sm font-medium text-foreground">
        תיווצרו {previewDates.length} חזרות
      </span>
    </div>
    <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto">
      {/* date list */}
    </div>
  </div>
)}
```

### Form Actions with Design System Buttons
```tsx
// Replace raw buttons with:
<div className="flex justify-end gap-3 pt-4 border-t border-border">
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    ביטול
  </Button>
  <Button type="submit" disabled={loading || hasCriticalConflicts}>
    {loading ? 'שומר...' : (initialData ? 'עדכן חזרה' :
      mode === 'single' ? 'צור חזרה' : `צור ${previewDates.length} חזרות`)}
  </Button>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom `fixed inset-0` overlay | shadcn Dialog (Radix + Framer Motion) | Phase 67 (2026-03-10) | Focus trap, ARIA, animation built in |
| Raw `<label>` + error `<p>` | FormField component | Phase 67 | Consistent error display, required asterisk |
| Raw `<select>` | shadcn Select (Radix) | Phase 67 | Accessible, grouped options, consistent styling |
| Raw `<button>` | shadcn Button (CVA + Framer Motion) | Phase 67 | Consistent variants, tap animation |
| Hardcoded `gray-*` colors | Semantic tokens (`text-foreground`, `bg-muted`, etc.) | Phase 66 (2026-03-10) | Theme-ready, consistent palette |

## Open Questions

1. **Should the props interface change from `onCancel` to `onOpenChange`?**
   - What we know: shadcn Dialog uses `onOpenChange` pattern. Current form uses `onCancel`.
   - What's unclear: Whether to keep backward compatibility or modernize the interface.
   - Recommendation: Change to `open` + `onOpenChange` props to align with Dialog pattern. Update all 4 callers. The callers already manage boolean state (`showCreateForm`, `showEditForm`, `showRehearsalForm`).

2. **Should the Sidebar wrapper overlay be removed?**
   - What we know: Sidebar wraps in its own `<div className="fixed inset-0 bg-black bg-opacity-50">` AND the form has its own overlay.
   - What's unclear: Whether Sidebar intentionally double-wraps for z-index reasons.
   - Recommendation: Remove the Sidebar's outer overlay. With shadcn Dialog, the Dialog portal handles z-index (z-50) and overlay correctly.

3. **Should the "add exclude date" button use Button component or remain a small icon button?**
   - What we know: Current is a `bg-gray-600` button with PlusIcon.
   - Recommendation: Use `<Button type="button" size="icon" variant="outline">` for the add button.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - `src/components/RehearsalForm.tsx` (639 lines, current implementation)
- **Codebase inspection** - `src/components/OrchestraForm.tsx` (455 lines, reference pattern)
- **Codebase inspection** - `src/components/modals/AddTeacherModal.tsx` (reference for Dialog usage)
- **Codebase inspection** - `src/components/ui/dialog.tsx` (Radix + Framer Motion Dialog)
- **Codebase inspection** - `src/components/ui/form-field.tsx` (FormField wrapper)
- **Codebase inspection** - `src/components/ui/select.tsx` (Radix Select with groups)
- **Codebase inspection** - `src/components/ui/tabs.tsx` (Radix Tabs)
- **Codebase inspection** - `src/components/ui/button.tsx` (CVA Button)
- **Codebase inspection** - `src/components/ui/badge.tsx` (CVA Badge)
- **Codebase inspection** - `src/components/ui/textarea.tsx` (Textarea)
- **Codebase inspection** - `src/pages/Rehearsals.tsx` (caller 1+2, lines 378-408)
- **Codebase inspection** - `src/pages/RehearsalDetails.tsx` (caller 3)
- **Codebase inspection** - `src/components/Sidebar.tsx` (caller 4, double-overlay issue)
- **Codebase inspection** - `src/constants/locations.ts` (VALID_LOCATIONS array)

### Secondary (MEDIUM confidence)
- Memory notes on design system decisions (Phase 66-67 token foundation, component standardization)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components already exist in codebase, verified by direct inspection
- Architecture: HIGH - clear reference patterns in OrchestraForm and AddTeacherModal
- Pitfalls: HIGH - identified through direct codebase analysis (double overlay, Radix Select empty value, multiple callers)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable - all components already built)
