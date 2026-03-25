# Phase 83: Attendance Feature Deep Review - Research

**Researched:** 2026-03-25
**Domain:** Attendance data consistency, cross-entity sync, UI correctness
**Confidence:** HIGH

## Summary

This phase addresses a deep review of the attendance feature across the entire stack. The attendance system spans multiple backend services (`rehearsal.service.js`, `orchestra.service.js`, `attendanceAlert.service.js`, `analytics/attendance.service.js`, `schedule/attendance.service.js`, `theory/theory.service.js`) and multiple frontend components (`AttendanceManagement.tsx`, `AttendanceManager.tsx`, `RehearsalAttendance.tsx`, `IndividualLessonAttendance.tsx`, `TeacherAttendanceTab.tsx`, student `AttendanceTab.tsx`).

The most critical finding is a **field naming inconsistency bug**: the `attendanceAlert.service.js` queries `activity_attendance` documents by `activityId` field, but the canonical write path in `rehearsal.service.js` stores data with `sessionId` field. This means the entire attendance alert dashboard (flagged students, per-orchestra stats, monthly trends) returns empty/zero data for all orchestras. This is a silent data correctness bug with no error messages -- it simply returns zeros.

Additional findings include: mock/random data in the student `AttendanceTab.tsx` (absence reasons and trends use `Math.random()`), a `date` field type inconsistency (stored as ISO string in some records, BSON Date in others), hardcoded stat changes in UI (`+12 this month`, `+2.5%`), and a duplicate/legacy `RehearsalAttendance.tsx` component that sends data in the wrong format.

**Primary recommendation:** Fix the `activityId`/`sessionId` field naming bug first (affects all attendance dashboard data), then address UI mock data replacement, and finally audit cross-entity sync consistency.

## Standard Stack

### Core (already in use -- no new libraries needed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| MongoDB native driver | Data layer | Already in use, no Mongoose |
| Express.js | API routes | Already in use |
| Joi | Validation | Already in use for rehearsal validation |
| React 18 + TypeScript | Frontend | Already in use |
| TanStack Query | Data fetching | Already in use for student details |
| HeroUI | UI components | Already in use for AttendanceManagement page |
| Chart.js + react-chartjs-2 | Charts | Already in use in student AttendanceTab |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| framer-motion | Animations | Already used in AttendanceManagement for bounce cards |
| react-hot-toast | Notifications | Already used for save confirmations |

**No new installations needed.** This phase is purely audit/fix of existing code.

## Architecture Patterns

### Data Flow Architecture

The attendance system has a dual-write pattern:

```
[User marks attendance in UI]
       |
       v
[rehearsalService.updateAttendance()]
       |
       +----> [1] DELETE existing activity_attendance records for sessionId
       +----> [2] INSERT new activity_attendance records (CANONICAL SOURCE)
       +----> [3] UPDATE rehearsal.attendance cache (DERIVED/DENORMALIZED)
       |
       All three in a MongoDB transaction
```

**Canonical source of truth:** `activity_attendance` collection
**Denormalized cache:** `rehearsal.attendance` object (present/absent/late arrays)

### Entity Relationships

```
orchestra
  ├── memberIds[]        -- string array of student IDs
  ├── rehearsalIds[]     -- string array of rehearsal IDs (kept in sync)
  └── conductorId        -- teacher who runs it

rehearsal
  ├── groupId            -- orchestra ID
  ├── attendance         -- { present: [], absent: [], late: [] } (CACHE)
  └── attendanceCount    -- { present, absent, late, total } (CACHE)

activity_attendance (CANONICAL)
  ├── studentId          -- string
  ├── sessionId          -- rehearsal or theory lesson ID
  ├── activityType       -- 'תזמורת', 'הרכב', 'תאוריה', 'שיעור פרטי'
  ├── groupId            -- orchestra ID or theory category
  ├── date               -- ISO string OR BSON Date (INCONSISTENT!)
  ├── status             -- 'הגיע/ה', 'לא הגיע/ה', 'איחור'
  └── tenantId           -- tenant scope
```

### Pattern: Field Naming Convention
**The field stored is `sessionId`** in activity_attendance documents.
All write paths use `sessionId`:
- `rehearsal.service.js` line 999: `sessionId: rehearsalId`
- `theory.service.js` line 665/677/692: `sessionId: theoryLessonId`
- `orchestra.service.js` line 379: `sessionId: { $in: rehearsalIds }`

### Anti-Patterns Found

- **activityId vs sessionId mismatch:** `attendanceAlert.service.js` queries by `activityId` (line 78, 242) but data is stored with `sessionId`. This is the critical bug.
- **Mock data in production components:** Student `AttendanceTab.tsx` uses `Math.random()` for absence reasons (line 207-214) and trend data (line 228).
- **Hardcoded change indicators:** Student `AttendanceTab.tsx` shows `+12 this month`, `+2.5%`, `#3 ranking` that are static strings, not computed from data.
- **Duplicate attendance UI components:** `RehearsalAttendance.tsx` (legacy) and `AttendanceManager.tsx` (current) both exist. `RehearsalAttendance.tsx` sends `attendanceList` format instead of `records` format.
- **Year selector missing 2026:** Student `AttendanceTab.tsx` only has [2023, 2024, 2025] in year dropdown.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date comparison across types | Custom string/date comparison | Normalize all dates to one type | Mixed ISO string and BSON Date causes filter failures |
| Attendance rate calculation | Different formulas per service | Single shared utility | Currently 4+ different calculation patterns exist |
| Status classification | Inline status checks | `MINISTRY_PRESENT_STATUSES` constant | Already exists in `config/constants.js`, but not all services use it |

**Key insight:** The attendance rate calculation is duplicated across 6+ service files with slight variations. A shared utility function would prevent inconsistencies.

## Common Pitfalls

### Pitfall 1: activityId vs sessionId Field Naming (CRITICAL BUG)
**What goes wrong:** `attendanceAlert.service.js` queries `activity_attendance` by `activityId` field, but all write paths store data with `sessionId` field. Result: dashboard shows zero attendance data, zero flagged students, zero everything.
**Why it happens:** The alert service was written referencing `orchestra.rehearsalIds` as "activity IDs" but the actual field name in activity_attendance documents is `sessionId`.
**How to avoid:** Rename all `activityId` references in `attendanceAlert.service.js` to `sessionId`.
**Warning signs:** Attendance dashboard shows 0% rates or null for all orchestras despite having attendance data.
**Affected lines:**
- `attendanceAlert.service.js:78` -- `activityId: { $in: rehearsalIds }` should be `sessionId`
- `attendanceAlert.service.js:242` -- same fix needed
- `attendanceAlert.service.js:245` -- `records.map(r => r.activityId)` should be `r.sessionId`
- `attendanceAlert.service.js:312` -- `record.activityId` should be `record.sessionId`
- `attendanceAlert.service.js:393` -- `activityName: r.activityId` should be `r.sessionId`

### Pitfall 2: date Field Type Inconsistency
**What goes wrong:** The `date` field in `activity_attendance` is stored as ISO string by the rehearsal service (passes through `rehearsal.date` which is a string), but some services filter with `new Date()` objects (BSON Date comparison). String-to-Date comparisons in MongoDB may not match correctly.
**Why it happens:** Phase 76-02 identified this: "activity_attendance.date stored as ISO string, not BSON Date -- date filters must use string comparison."
**How to avoid:** The `attendanceAlert.service.js:getAttendanceDashboard()` already handles this with string comparison (line 194). But `analytics/attendance.service.js` uses `new Date()` for date filters (lines 59-63, 176-179), which may fail to match string-stored dates.
**Warning signs:** Date-filtered queries return fewer records than expected.

### Pitfall 3: Attendance Rate Default Value Inconsistency
**What goes wrong:** Different services return different defaults when no records exist: some return `0`, some return `null`, some return `'0'` (string).
**Why it happens:** No shared convention for empty-data defaults.
**How to avoid:** Per Phase 76-02 decision: "Default attendance rate is null/0 when no records (not 100%)". Standardize to `null` when no records, `0` for computed-but-zero scenarios.

### Pitfall 4: attendanceCount.total Meaning
**What goes wrong:** Confusion about what `attendanceCount.total` represents.
**Why it happens:** Per Phase 75-01 decision: "attendanceCount.total uses records.length (all marked students including late), not present+absent sum." The total includes all marked students. If a member is unmarked, they are NOT counted in total.
**How to avoid:** Always use `records.length` for total, not `present + absent`.

### Pitfall 5: Frontend || Fallback for Legacy Rehearsals
**What goes wrong:** Old rehearsals created before Phase 75 may not have `attendanceCount` field.
**Why it happens:** The field was added in Phase 75; existing documents were not backfilled.
**How to avoid:** Per Phase 75-01: "Frontend || fallback pattern for backward compat with rehearsals lacking server attendanceCount."

### Pitfall 6: RehearsalAttendance.tsx Sends Wrong Format
**What goes wrong:** The legacy `RehearsalAttendance.tsx` component sends `{ rehearsalId, attendanceList }` format, but the backend expects `{ records: [{studentId, status, notes}] }`.
**Why it happens:** Component was written before the Phase 75 attendance API redesign.
**How to avoid:** Either remove this component or update it to use `rehearsalService.updateAttendance(rehearsalId, records)` format like `AttendanceManager.tsx` does.

## Code Examples

### Current Correct Save Pattern (AttendanceManager.tsx)
```typescript
// Source: src/components/AttendanceManager.tsx line 118-131
const records = []
attendanceMap.forEach((entry, studentId) => {
  if (entry.status !== 'unmarked') {
    records.push({
      studentId,
      status: STATUS_MAP[entry.status], // Maps 'present' -> 'הגיע/ה'
      notes: entry.notes,
    })
  }
})
await rehearsalService.updateAttendance(rehearsal._id, records)
```

### Bug: attendanceAlert.service.js Uses Wrong Field Name
```javascript
// Source: api/attendance-alerts/attendanceAlert.service.js line 76-83
// BUG: queries by 'activityId' but data stored with 'sessionId'
const records = await activityCol
  .find({
    activityId: { $in: rehearsalIds },  // <-- BUG: should be 'sessionId'
    studentId: { $in: memberIds },
    tenantId,
    isArchived: { $ne: true },
  })
  .sort({ date: -1 })
  .toArray();
```

### Correct Field Name Usage (rehearsal.service.js)
```javascript
// Source: api/rehearsal/rehearsal.service.js line 993-1006
const activityDocs = records.map(record => ({
  studentId: record.studentId,
  activityType: rehearsal.type,
  groupId: rehearsal.groupId,
  sessionId: rehearsalId,        // <-- Correct field name
  date: rehearsal.date,
  status: record.status,
  notes: record.notes || '',
  teacherId: teacherId.toString(),
  tenantId,
  createdAt: currentTime,
}));
```

### Mock Data That Needs Replacement (student AttendanceTab.tsx)
```typescript
// Source: src/features/students/details/components/tabs/AttendanceTab.tsx line 203-215
// BUG: Uses random data instead of real absence reasons
const absenceReasons = useMemo(() => {
  if (!attendanceRecords) return {}
  const reasons: Record<string, number> = {
    'מחלה': Math.floor(Math.random() * 5) + 1,        // FAKE
    'אירוע משפחתי': Math.floor(Math.random() * 3) + 1, // FAKE
    // ...
  }
  return reasons
}, [attendanceRecords])
```

## Identified Issues Summary

### Critical (must fix)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | `activityId` vs `sessionId` field mismatch | `attendanceAlert.service.js` lines 78, 242, 245, 312, 393 | Entire attendance dashboard returns empty/zero data |

### High (should fix)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 2 | Mock/random data in student AttendanceTab | `AttendanceTab.tsx` lines 207-214, 228 | Shows fake data to users |
| 3 | Hardcoded stat changes | `AttendanceTab.tsx` lines 297, 305, 454-462 | Misleading "+12 this month" etc |
| 4 | Year selector missing 2026 | `AttendanceTab.tsx` line 500 | Can't view current year data |
| 5 | Legacy `RehearsalAttendance.tsx` sends wrong format | `RehearsalAttendance.tsx` line 176 | Would fail if used |

### Medium (should fix if in scope)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | `analytics/attendance.service.js` uses `new Date()` for filtering | Lines 59-63, 176-179 | May miss ISO-string-stored dates |
| 7 | Attendance rate formula varies across services | Multiple files | Slight inconsistencies possible |
| 8 | `attendanceAlertService.getStudentAttendanceSummary` date comparison | Line 358-359 | May use wrong comparison type |

### Low (cleanup)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 9 | `RehearsalAttendance.tsx` is dead code | Component likely unused | Code bloat |
| 10 | `IndividualLessonAttendance.tsx` status mismatch | Uses 'excused' status not in backend | Potential save failure |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `attendance.present/absent` arrays on rehearsal | `activity_attendance` collection (canonical) + rehearsal cache | Phase 75 (v1.9) | Canonical source moved to dedicated collection |
| Single attendance component | `AttendanceManager.tsx` with auto-save | Phase 76 | Better UX, but old component still exists |
| Global attendance stats | Per-orchestra dashboard + flagged students | Phase 76 | Dashboard broken due to field name bug |

## Open Questions

1. **Is `RehearsalAttendance.tsx` used anywhere?**
   - What we know: `AttendanceManager.tsx` is used by `AttendanceManagement.tsx` page
   - What's unclear: Whether any route or component still renders `RehearsalAttendance.tsx`
   - Recommendation: Search for imports; if unused, remove it

2. **Should the `date` field type be normalized?**
   - What we know: Rehearsal dates are stored as strings; some services expect Date objects
   - What's unclear: How many existing records have string vs Date types
   - Recommendation: Audit the collection, then decide: either normalize all to Date (migration) or standardize all queries to handle strings

3. **Are private lesson attendance records (`שיעור פרטי`) actually written?**
   - What we know: `schedule/attendance.service.js` reads from `activity_attendance` where `activityType = 'שיעור פרטי'`
   - What's unclear: Which write path creates these records (not found in rehearsal or theory services)
   - Recommendation: Verify if `IndividualLessonAttendance.tsx` has a working save path

## Cross-Entity Sync Matrix

| When This Happens | These Must Stay In Sync |
|-------------------|------------------------|
| Attendance marked for rehearsal | `activity_attendance` records + `rehearsal.attendance` cache + `rehearsal.attendanceCount` |
| Student removed from orchestra | `orchestra.memberIds` + `student.enrollments.orchestraIds` + attendance records (should be archived?) |
| Rehearsal deleted | `rehearsal` doc + `orchestra.rehearsalIds` + `activity_attendance` records (archived) |
| Orchestra deactivated | `orchestra.isActive` + `orchestra.rehearsalIds` cleared + rehearsals deleted + attendance archived |
| Bulk rehearsals deleted by date | `rehearsal` docs + `orchestra.rehearsalIds` + attendance archived |

Current sync status:
- Rehearsal create/delete: SYNCED (uses transactions)
- Attendance update: SYNCED (uses transactions)
- Student add/remove from orchestra: PARTIALLY SYNCED (manual rollback, not transaction-based)
- Orchestra deactivation: SYNCED (uses transactions)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all attendance-related files
- `api/rehearsal/rehearsal.service.js` -- updateAttendance function (canonical write path)
- `api/attendance-alerts/attendanceAlert.service.js` -- dashboard and flagged student queries
- `api/analytics/attendance.service.js` -- analytics aggregation
- `api/schedule/attendance.service.js` -- private lesson attendance stats
- `api/theory/theory.service.js` -- theory attendance write path
- `api/orchestra/orchestra.service.js` -- orchestra member attendance stats
- `config/constants.js` -- ATTENDANCE_STATUSES, MINISTRY_PRESENT_STATUSES
- `src/components/AttendanceManager.tsx` -- current attendance marking UI
- `src/pages/AttendanceManagement.tsx` -- dashboard page
- `src/features/students/details/components/tabs/AttendanceTab.tsx` -- student attendance view
- `src/components/rehearsal/RehearsalAttendance.tsx` -- legacy attendance component

### Secondary (MEDIUM confidence)
- Phase 75-01 and 76-02 prior decisions from CLAUDE.md memory
- Phase 75/76 planning docs in `.planning/phases/`

## Metadata

**Confidence breakdown:**
- Critical bug (activityId/sessionId): HIGH -- verified by direct code comparison of write and read paths
- UI mock data issues: HIGH -- verified by reading component source
- Cross-entity sync analysis: HIGH -- verified by reading all service transaction code
- Date type inconsistency: MEDIUM -- confirmed by comment in attendanceAlert.service.js but not DB-verified
- Private lesson write path: LOW -- could not locate the write path; may exist in unexamined code

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, codebase-specific findings)
