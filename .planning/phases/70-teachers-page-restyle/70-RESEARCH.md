# Phase 70: Teachers Page Restyle & Login Activity Badges - Research

**Researched:** 2026-03-12
**Domain:** Backend login tracking + Frontend page restyle (Express/MongoDB + React/HeroUI)
**Confidence:** HIGH

## Summary

This phase has two distinct workstreams: (1) a small backend change to track login counts and expose them in the teacher list API, and (2) a frontend restyle of the Teachers page to match the Students page pattern exactly.

The backend work is straightforward. The auth service already sets `credentials.lastLogin` on every successful login (4 places in `auth.service.js`). Adding a `$inc` for `credentials.loginCount` alongside the existing `$set` for `lastLogin` is minimal. The `_enrichWithStudentCounts` function in `teacher.service.js` already enriches teacher list responses -- adding `loginCount` and `lastLogin` from the teacher document itself (not a separate aggregation) is trivial.

The frontend work is the bulk of this phase. The current Teachers page uses a custom `Table` component, plain `<select>` and `<input>` for filters, and a load-more pagination pattern. The Students page (the reference) uses HeroUI `Table` + `Pagination`, `GlassSelect` for filters, `SearchInput` for search, `HeroBadge` wrapping `User` for avatar+badge, and the `getAvatarColor` hash function. The Teachers page must be rewritten to match this pattern exactly. All shared components (GlassStatCard, GlassSelect, SearchInput) already exist and are verified working in the Students page.

**Primary recommendation:** Add `$inc: { 'credentials.loginCount': 1 }` to all 4 login update calls in auth.service.js, expose `loginCount`/`lastLogin` in the teacher list enrichment, then rewrite the Teachers page JSX to mirror the Students page structure using HeroUI Table/Pagination/Badge/User components.

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @heroui/react | (installed) | Table, Pagination, Badge, User, Chip, Button | Already used in Students page |
| @radix-ui/react-select | (installed) | Underpins GlassSelect | Already used in Students page |
| @phosphor-icons/react | (installed) | Icons throughout UI | Already used project-wide |
| clsx | (installed) | Conditional classnames | Already used project-wide |

### Shared UI Components (reuse, do NOT duplicate)
| Component | Path | Purpose | Used In |
|-----------|------|---------|---------|
| GlassStatCard | `components/ui/GlassStatCard.tsx` | Stat cards with green-blue gradient | Students, Teachers (already), Orchestras, Rehearsals, Bagruts |
| GlassSelect | `components/ui/GlassSelect.tsx` | Filter dropdowns with glass morphism | Students |
| SearchInput | `components/ui/SearchInput.tsx` | Search field with loading spinner | Students, Teachers (already) |
| StatusBadge | `components/domain/index` | Active/inactive status chip | Students, Teachers (already) |
| InstrumentBadge | `components/domain/index` | Instrument display chip | Students, Teachers (already) |
| Badge (shadcn) | `components/ui/badge.tsx` | Generic badge | Students |

**Installation:** No new packages needed.

## Architecture Patterns

### Backend: Login Count Tracking

The auth service has **4 places** where `credentials.lastLogin` is updated on successful auth:

| Location | Line | Context |
|----------|------|---------|
| `auth.service.js` login() | ~116 | Standard email/password login |
| `auth.service.js` acceptInvitation() | ~412 | First-time invitation acceptance |
| `auth.service.js` resetPassword() | ~501 | Post-reset login |
| `auth.service.js` (other) | ~723 | Another auth path |

All 4 must get `$inc: { 'credentials.loginCount': 1 }` added to their `$set` operations.

**Pattern: Atomic $inc alongside $set**
```javascript
// Current pattern (auth.service.js ~line 111-120):
await collection.updateOne(
  { _id: teacher._id },
  {
    $set: {
      'credentials.refreshToken': refreshToken,
      'credentials.lastLogin': new Date(),
      updatedAt: new Date(),
    },
  }
)

// New pattern -- add $inc as sibling to $set:
await collection.updateOne(
  { _id: teacher._id },
  {
    $set: {
      'credentials.refreshToken': refreshToken,
      'credentials.lastLogin': new Date(),
      updatedAt: new Date(),
    },
    $inc: {
      'credentials.loginCount': 1,
    },
  }
)
```

**Note:** MongoDB allows `$set` and `$inc` in the same update document. `$inc` on a field that does not yet exist creates it with the increment value (so existing teachers without `loginCount` will get `1` on first login -- no migration needed).

### Backend: Exposing loginCount in Teacher List API

The `_enrichWithStudentCounts` function (teacher.service.js ~line 945) already enriches teacher docs. The `loginCount` and `lastLogin` fields are already on the teacher document under `credentials.*`. The frontend just needs to read them from `teacher.credentials.loginCount` and `teacher.credentials.lastLogin`.

**However**, the teacher list API currently returns the full teacher document. The `credentials` object includes sensitive data (password hash, refresh token). Two options:

1. **Add a projection** to exclude sensitive credential fields but include `loginCount`/`lastLogin` -- this is the correct approach
2. **Enrich in `_enrichWithStudentCounts`** by extracting `credentials.loginCount` and `credentials.lastLogin` to top-level fields

**Recommended: Option 2** -- extract to top-level in the enrichment function:
```javascript
return teachers.map(t => ({
  ...t,
  studentCount: countMap.get(t._id.toString()) || 0,
  loginCount: t.credentials?.loginCount || 0,
  lastLogin: t.credentials?.lastLogin || null,
}));
```

This avoids leaking credential data and keeps the response shape clean for the frontend.

### Frontend: Teachers Page Structure (mirror Students page exactly)

**Current Teachers page problems:**
1. Uses custom `Table` component instead of HeroUI `Table`
2. Uses plain `<input>` for instrument filter instead of `GlassSelect`
3. Uses plain `<select>` for role filter instead of `GlassSelect`
4. Uses "load more" pagination instead of HeroUI `Pagination`
5. Uses `UserCircleIcon` placeholder instead of HeroUI `User` with colored avatar
6. No badge on avatar (Students has absence count badge)

**Target structure (from Students page):**

```
Page Layout:
  - Page Header (title + subtitle)
  - GlassStatCard row (4 cards, grid cols-2 lg:cols-4)
  - Filter bar (SearchInput + GlassSelect dropdowns + Add button + view toggle)
  - HeroUI Table with:
    - TableHeader/TableColumn
    - TableBody with renderCell callback
    - User component for name column (colored avatar + name + description)
    - HeroBadge wrapping User for login count badge
    - Pagination as bottomContent
  - Grid view alternative
```

### Pattern: Avatar Color Hash (copy from Students)
```typescript
const AVATAR_COLORS: Array<'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = [
  'primary', 'secondary', 'success', 'warning', 'danger'
]

function getAvatarColor(name: string): typeof AVATAR_COLORS[number] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
```

### Pattern: Login Activity Badge (blue, always shown if count > 0)
```typescript
// Students use absence badge with warning/danger colors.
// Teachers use login count badge with primary (blue) color.
const userEl = (
  <User
    avatarProps={{
      radius: 'full',
      size: 'md',
      showFallback: true,
      name: teacherName,
      color: avatarColor,
    }}
    description={teacher.email || ''}
    name={teacherName}
  />
)

// Blue badge showing login count
if (loginCount > 0) {
  return (
    <HeroBadge content={loginCount} color="primary" size="sm" shape="circle">
      {userEl}
    </HeroBadge>
  )
}
return userEl
```

### Pattern: HeroUI Table with Pagination
```typescript
const tableRowsPerPage = 20
const tablePages = Math.ceil(filteredTeachers.length / tableRowsPerPage)
const paginatedTeachers = React.useMemo(() => {
  const start = (tablePage - 1) * tableRowsPerPage
  return filteredTeachers.slice(start, start + tableRowsPerPage)
}, [filteredTeachers, tablePage])

<HeroTable
  aria-label="..."
  isHeaderSticky
  bottomContent={
    tablePages > 1 ? (
      <div className="flex w-full justify-center">
        <Pagination
          isCompact showControls showShadow
          color="primary"
          page={tablePage}
          total={tablePages}
          onChange={setTablePage}
        />
      </div>
    ) : null
  }
  bottomContentPlacement="outside"
  classNames={{
    base: 'flex-1 min-h-0 animate-table-rows',
    wrapper: 'h-full',
    th: 'bg-default-100 text-default-600',
    thead: '[&>tr]:border-b-0',
    tr: 'transition-colors duration-150 hover:bg-primary/5',
    td: 'py-3',
  }}
>
```

### Teacher HeroUI Table Columns
```typescript
const heroColumns = [
  { uid: 'name', name: 'שם המורה' },
  { uid: 'specialization', name: 'התמחות' },
  { uid: 'roles', name: 'תפקידים' },
  { uid: 'studentCount', name: 'מס\' תלמידים' },
  { uid: 'status', name: 'סטטוס' },
  { uid: 'actions', name: 'פעולות' },
]
```

### Anti-Patterns to Avoid
- **Duplicating shared components:** Do NOT create teacher-specific variants of GlassStatCard, GlassSelect, or SearchInput. Import from `components/ui/`.
- **Using custom Table instead of HeroUI Table:** The whole point is to match Students -- must use HeroUI Table.
- **Load-more pagination:** Replace with HeroUI Pagination (numbered pages). The current Teachers page fetches paginated data from API but uses load-more UX -- switch to client-side pagination of all loaded data (same as Students which sets STUDENTS_PER_PAGE to 10000).
- **Forgetting to handle $inc on non-existent field:** MongoDB $inc creates the field if missing -- no migration needed, but verify this in tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar with colored initials | Custom div with initials | HeroUI `User` component with `avatarProps` | Handles fallback, colors, sizing automatically |
| Badge on avatar | Absolute-positioned span | HeroUI `Badge` wrapping `User` | Handles positioning, sizing, animation |
| Pagination controls | Custom page buttons | HeroUI `Pagination` | Handles edge cases, RTL, keyboard nav |
| Filter dropdowns | Plain `<select>` or custom dropdown | `GlassSelect` (already built) | Glass morphism styling, Radix accessibility |
| Search with debounce | Custom input with timer | `SearchInput` (already built) | Loading state, clear button, consistent styling |

**Key insight:** Every UI element needed already exists in the codebase -- either as a shared component or as a HeroUI import. The task is assembly, not creation.

## Common Pitfalls

### Pitfall 1: Credential Data Leaking in API Response
**What goes wrong:** The teacher list API returns full documents including `credentials.password`, `credentials.refreshToken`
**Why it happens:** No projection is applied to the `find()` query
**How to avoid:** Extract `loginCount`/`lastLogin` to top-level fields in `_enrichWithStudentCounts`, do NOT send raw `credentials` object to frontend. Consider adding a projection to the find() query as a future cleanup.
**Warning signs:** Frontend accessing `teacher.credentials.loginCount` -- should be `teacher.loginCount`

### Pitfall 2: Teachers Page Still Using Load-More After Restyle
**What goes wrong:** The current page loads 20 teachers at a time with "load more" button. If we just swap components but keep this pattern, pagination won't work correctly.
**Why it happens:** The Students page actually loads ALL students (STUDENTS_PER_PAGE = 10000) and paginates client-side.
**How to avoid:** Either (a) load all teachers at once like Students does and paginate client-side, or (b) use server-side pagination with proper page navigation. Option (a) is simpler and matches Students exactly.
**Warning signs:** Mix of server-side pagination state and client-side HeroUI Pagination

### Pitfall 3: Missing $inc in One of the 4 Auth Paths
**What goes wrong:** Login count is inconsistent because only some auth paths increment it
**Why it happens:** There are 4 separate places in auth.service.js that update lastLogin
**How to avoid:** Search for ALL occurrences of `'credentials.lastLogin'` in auth.service.js and invitation.service.js. Add `$inc` to each one.
**Warning signs:** Teachers who logged in via invitation acceptance or password reset don't have loginCount incremented

### Pitfall 4: Filter Bar Instrument Dropdown Still Uses Custom Input
**What goes wrong:** The current Teachers page has a custom searchable instrument dropdown with show/hide state. Replacing with GlassSelect means losing the search-within-dropdown feature.
**Why it happens:** GlassSelect is a simple Radix Select -- it doesn't support search/typeahead natively.
**How to avoid:** Use GlassSelect with a static list of instruments (same as Students page). The instrument list is small enough (~19 items) that search is not needed.
**Warning signs:** Trying to add search to GlassSelect (overengineering)

### Pitfall 5: Grid View TeacherCard Incompatibility
**What goes wrong:** The grid view uses `TeacherCard` component which may not match the new data shape
**Why it happens:** TeacherCard expects a specific data structure
**How to avoid:** Keep the grid view working with the same transformed data. TeacherCard already works -- just ensure the data mapping is preserved.
**Warning signs:** Grid view crashes after restyle

## Code Examples

### Backend: Add loginCount to auth update (auth.service.js)
```javascript
// In login() function, around line 111-120:
await collection.updateOne(
  { _id: teacher._id },
  {
    $set: {
      'credentials.refreshToken': refreshToken,
      'credentials.lastLogin': new Date(),
      updatedAt: new Date(),
    },
    $inc: {
      'credentials.loginCount': 1,
    },
  }
)
```

### Backend: Expose loginCount in teacher list (teacher.service.js)
```javascript
// In _enrichWithStudentCounts, modify the return map:
return teachers.map(t => ({
  ...t,
  studentCount: countMap.get(t._id.toString()) || 0,
  loginCount: t.credentials?.loginCount || 0,
  lastLogin: t.credentials?.lastLogin || null,
}));
```

### Frontend: Teacher renderCell with avatar + login badge
```typescript
const renderCell = React.useCallback((teacher: any, columnKey: string) => {
  switch (columnKey) {
    case 'name': {
      const loginCount = teacher.loginCount || 0
      const avatarColor = getAvatarColor(teacher.name || '')

      const userEl = (
        <User
          avatarProps={{
            radius: 'full',
            size: 'md',
            showFallback: true,
            name: teacher.name,
            color: avatarColor,
          }}
          description={teacher.email || ''}
          name={teacher.name}
        />
      )

      if (loginCount > 0) {
        return (
          <HeroBadge content={loginCount} color="primary" size="sm" shape="circle">
            {userEl}
          </HeroBadge>
        )
      }
      return userEl
    }
    case 'specialization':
      return teacher.specialization && teacher.specialization !== 'לא צוין'
        ? <InstrumentBadge instrument={teacher.specialization} />
        : <span className="text-default-400">--</span>
    case 'roles':
      return teacher.rolesDisplay || 'לא מוגדר'
    case 'studentCount':
      return <span className="text-sm">{teacher.studentCount}</span>
    case 'status':
      return <StatusBadge status={teacher.isActive ? 'פעיל' : 'לא פעיל'} />
    case 'actions':
      return (/* same action buttons as current */)
    default:
      return teacher[columnKey] ?? ''
  }
}, [])
```

### Frontend: GlassSelect filters (replacing plain select/input)
```typescript
<GlassSelect
  value={filters.instrument || '__all__'}
  onValueChange={(v) => setFilters(prev => ({ ...prev, instrument: v === '__all__' ? '' : v }))}
  placeholder="כל הכלים"
  options={[
    { value: '__all__', label: 'כל הכלים' },
    { value: 'כינור', label: 'כינור' },
    { value: 'ויולה', label: 'ויולה' },
    // ... all instruments
  ]}
/>
<GlassSelect
  value={filters.role || '__all__'}
  onValueChange={(v) => setFilters(prev => ({ ...prev, role: v === '__all__' ? '' : v }))}
  placeholder="כל התפקידים"
  options={[
    { value: '__all__', label: 'כל התפקידים' },
    { value: 'מורה', label: 'מורה' },
    { value: 'ניצוח', label: 'ניצוח' },
    { value: 'מדריך הרכב', label: 'מדריך הרכב' },
    { value: 'מנהל', label: 'מנהל' },
    { value: 'תאוריה', label: 'תאוריה' },
    { value: 'מגמה', label: 'מגמה' },
    { value: 'ליווי פסנתר', label: 'ליווי פסנתר' },
    { value: 'הלחנה', label: 'הלחנה' },
  ]}
/>
```

## State of the Art

| Old Approach (current Teachers) | New Approach (match Students) | Impact |
|--------------------------------|-------------------------------|--------|
| Custom `Table` component | HeroUI `Table` with `TableHeader`/`TableBody`/`TableRow`/`TableCell` | Consistent look, built-in features |
| `UserCircleIcon` placeholder | HeroUI `User` with colored avatar initials | Visual consistency with Students |
| No login badge | `HeroBadge` wrapping `User` with blue login count | New feature |
| Plain `<select>` for role filter | `GlassSelect` | Glass morphism, accessibility |
| Custom searchable `<input>` for instrument filter | `GlassSelect` | Simpler, consistent |
| "Load more" button | HeroUI `Pagination` (numbered pages) | Consistent with Students |
| No `loginCount` tracking | `$inc` on each login | New backend feature |

## Open Questions

1. **Should all auth paths increment loginCount?**
   - What we know: There are 4 places that update `lastLogin` -- standard login, invitation acceptance, password reset, and one more
   - What's unclear: Should invitation acceptance count as a "login" for the badge?
   - Recommendation: Yes, increment on all paths. The badge represents "activity" not just password logins.

2. **Teacher list data loading strategy**
   - What we know: Students page loads ALL at once (limit=10000) and paginates client-side. Teachers page currently loads 20 at a time.
   - What's unclear: Is the teacher count per tenant small enough to load all at once?
   - Recommendation: Yes -- a conservatory typically has 10-50 teachers. Load all at once (limit=0) like the current non-paginated path, and paginate client-side with HeroUI Pagination.

3. **Should credentials be projected out of teacher list query?**
   - What we know: Currently full teacher documents are returned including credentials
   - What's unclear: Whether this is a security concern that should be fixed now
   - Recommendation: Extract loginCount/lastLogin to top-level in enrichment. Fixing the broader credential projection is out of scope for this phase but should be noted as tech debt.

## Sources

### Primary (HIGH confidence)
- `api/auth/auth.service.js` -- verified 4 locations where `credentials.lastLogin` is updated (lines ~116, ~412, ~501, ~723)
- `api/teacher/teacher.service.js` -- verified `_enrichWithStudentCounts` enrichment pattern and `getTeachers` response shape
- `src/pages/Students.tsx` -- verified HeroUI Table, Pagination, Badge, User usage pattern (lines ~707-1135)
- `src/pages/Teachers.tsx` -- verified current implementation uses custom Table, plain selects, load-more (841 lines)
- `src/components/ui/GlassStatCard.tsx` -- verified interface and usage (115 lines)
- `src/components/ui/GlassSelect.tsx` -- verified interface: `{ value, onValueChange, options, placeholder }` (207 lines)
- `src/components/ui/SearchInput.tsx` -- verified interface: `{ value, onChange, onClear, placeholder, isLoading }` (47 lines)
- `api/teacher/invitation.service.js` -- verified line 101 also updates `credentials.lastLogin`

### Secondary (MEDIUM confidence)
- MongoDB documentation on `$inc` behavior with non-existent fields (creates with increment value)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components verified in codebase, no new dependencies
- Architecture patterns: HIGH - directly copied from working Students page implementation
- Backend login tracking: HIGH - verified all 4 update locations in auth.service.js
- Pitfalls: HIGH - identified from direct code comparison between Teachers and Students pages

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- no external dependencies changing)
