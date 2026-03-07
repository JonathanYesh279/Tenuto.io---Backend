---
phase: 58-conflict-detection-engine
verified: 2026-03-07T15:00:00Z
status: gaps_found
score: 5/7 must-haves verified
gaps:
  - truth: "Conflict responses include activity type, name, time range, and room (single rehearsal CRUD)"
    status: failed
    reason: "addRehearsal and updateRehearsal catch blocks wrap CONFLICT errors with new Error(), stripping .code and .conflicts properties. Controller message fallback returns 409 but with conflicts: undefined"
    artifacts:
      - path: "api/rehearsal/rehearsal.service.js"
        issue: "Lines 197-199 (addRehearsal) and 288-290 (updateRehearsal): catch blocks do 'throw new Error(Failed to ...: ${err})' which wraps the CONFLICT error, stripping custom properties (.code, .conflicts). Bulk path at line 545 correctly re-throws BULK_CONFLICT errors before the generic wrap, but single-rehearsal paths lack equivalent preservation."
    missing:
      - "Add CONFLICT error preservation in addRehearsal catch block (same pattern as BULK_CONFLICT in bulkCreateRehearsals line 545)"
      - "Add CONFLICT error preservation in updateRehearsal catch block"
---

# Phase 58: Conflict Detection Engine Verification Report

**Phase Goal:** Users are warned about scheduling conflicts before they create double-booked rehearsals
**Verified:** 2026-03-07T15:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Creating a rehearsal that overlaps an existing time block, rehearsal, or theory lesson in the same room returns a 409 conflict error with details | PARTIAL | 409 IS returned via message fallback, but `conflicts` property is `undefined` due to error wrapping bug |
| 2 | Updating a rehearsal to a time/room that conflicts returns a 409 conflict error with details | PARTIAL | Same bug as #1 -- error wrapping strips `.conflicts` property |
| 3 | A conductor scheduled for two activities at the same time triggers a teacher-schedule conflict warning | VERIFIED | `rehearsalConflictService.js` lines 219-250 query for conductor double-booking and return teacher-type conflicts |
| 4 | Conflict responses include activity type, name, time range, and room | PARTIAL | Conflict objects in rehearsalConflictService.js are correctly structured (type, activityType, activityName, conflictingTime, room, description), but they are lost in single-rehearsal CRUD due to error wrapping |
| 5 | Bulk rehearsal creation validates all generated dates for conflicts before inserting any | VERIFIED | `rehearsal.service.js` lines 442-466 iterate all dates, check each, and throw BULK_CONFLICT before transaction |
| 6 | Bulk conflict response reports per-date conflict details | VERIFIED | Controller lines 228-235 return 409 with dateConflicts array, totalDates, conflictingDates |
| 7 | If any date has a conflict, zero rehearsals are inserted (all-or-nothing) | VERIFIED | BULK_CONFLICT is thrown before the withTransaction block (line 459-466), so no inserts occur |

**Score:** 5/7 truths verified (2 partial due to error wrapping bug)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/rehearsalConflictService.js` | Cross-source conflict detection | VERIFIED | 341 lines, exports `checkRehearsalConflicts`, queries rehearsal, theory_lesson, teacher collections. 6 parallel queries via Promise.all. Conflict objects include type, activityType, activityName, conflictingTime, room, description. |
| `api/rehearsal/rehearsal.service.js` | Rehearsal CRUD with conflict checking | VERIFIED (with bug) | Imports and calls `checkRehearsalConflicts` in addRehearsal (line 144), updateRehearsal (line 264), and bulkCreateRehearsals (line 446). Bug: catch blocks strip CONFLICT error properties in single-rehearsal paths. |
| `api/rehearsal/rehearsal.controller.js` | 409 conflict responses | VERIFIED | Handles CONFLICT (line 90), BULK_CONFLICT (line 228) with 409 status. Message fallback catches wrapped errors. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| rehearsal.service.js | rehearsalConflictService.js | `import checkRehearsalConflicts` | WIRED | Line 23: `import { checkRehearsalConflicts } from '../../services/rehearsalConflictService.js'` |
| rehearsal.controller.js | client | `res.status(409)` | WIRED | Lines 91, 123, 229 return 409 for CONFLICT and BULK_CONFLICT errors |
| rehearsalConflictService.js | rehearsal collection | MongoDB query | WIRED | `getCollection('rehearsal')` at lines 104, 221 |
| rehearsalConflictService.js | theory_lesson collection | MongoDB query | WIRED | `getCollection('theory_lesson')` at lines 140, 257 |
| rehearsalConflictService.js | teacher collection | MongoDB query for timeBlocks | WIRED | `getCollection('teacher')` at lines 171, 284 |
| rehearsalConflictService.js | orchestra collection | conductorId lookup | WIRED | `getCollection('orchestra')` at line 45 for conductor resolution |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| api/rehearsal/rehearsal.service.js | 197-199 | CONFLICT error wrapped with `new Error()`, stripping `.code` and `.conflicts` | BLOCKER | Single-rehearsal create returns 409 with no conflict details |
| api/rehearsal/rehearsal.service.js | 288-290 | Same error wrapping in updateRehearsal | BLOCKER | Single-rehearsal update returns 409 with no conflict details |

### Human Verification Required

### 1. Room Conflict Detection End-to-End

**Test:** Create a rehearsal with same room, overlapping time as an existing rehearsal
**Expected:** 409 response with conflict details showing the conflicting rehearsal's name, time, room
**Why human:** Need running server + database with test data to verify full round-trip

### 2. Teacher/Conductor Conflict Detection

**Test:** Create a rehearsal for an orchestra whose conductor already has a theory lesson at that time
**Expected:** 409 response with teacher-type conflict showing the theory lesson details
**Why human:** Requires specific data setup with conductor linked to orchestra

### Gaps Summary

There is one bug that affects two of the seven truths. In `addRehearsal` and `updateRehearsal`, the generic catch block wraps all errors with `throw new Error(...)`, which strips the custom `.code` and `.conflicts` properties from CONFLICT errors. The controller's message-based fallback (`err.message?.includes('Scheduling conflict')`) does catch the wrapped error and returns a 409 status, so the user IS warned -- but `err.conflicts` is `undefined`, so the response body lacks the actionable details (activity type, name, time, room) needed to resolve the conflict.

The fix is straightforward: add the same preservation pattern used in `bulkCreateRehearsals` (line 545: `if (err.code === 'BULK_CONFLICT') { throw err; }`) to both `addRehearsal` and `updateRehearsal` catch blocks for `err.code === 'CONFLICT'`.

The bulk creation path works correctly because it already has this preservation.

---

_Verified: 2026-03-07T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
