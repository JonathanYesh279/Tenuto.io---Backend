# Phase 36: Seed Teacher Schedule Data - Research

**Researched:** 2026-03-03
**Domain:** MongoDB seed scripting, bidirectional schedule data, teacher time blocks with assigned lessons
**Confidence:** HIGH

## Summary

Phase 36 addresses a specific gap in the current dev seed pipeline: `seed-dev-data.js` creates teachers with empty `assignedLessons: []` in their time blocks, and students with `teacherAssignments` whose times are randomly generated (not aligned to actual block ranges). A second script, `seed-schedules.js`, already exists and solves this exact problem -- it rebuilds time blocks with proper fields, packs student lessons back-to-back within blocks, and creates the bidirectional references. However, these are two separate scripts that must be run in sequence, and the room schedule grid currently shows time blocks as empty block-level activities rather than individual student lessons.

The core work is integrating `seed-schedules.js` logic into `seed-dev-data.js` (or orchestrating them as a single pipeline) so that one command produces complete, grid-ready schedule data. The `seed-schedules.js` script is well-structured with three sequential phases (A: rebuild blocks, B: assign students, C: populate assignedLessons) plus verification -- this pattern should be preserved.

**Primary recommendation:** Merge the `seed-schedules.js` logic into `seed-dev-data.js` as a post-processing step after student generation, so `node scripts/seed-dev-data.js --clean` produces complete bidirectional schedule data in a single run.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongodb | ^6.x | Native MongoDB driver (already in project) | Direct DB access for seed scripts |
| bcryptjs | ^2.4.x | Password hashing for admin teacher (already in project) | Used by existing seed script |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | ^16.x | Environment variable loading (already in project) | Loading MONGODB_URI |

**Installation:** No new dependencies needed. All libraries already installed.

## Architecture Patterns

### Existing Seed Script Structure
```
scripts/
  seed-dev-data.js       # Main seed: tenant, teachers, students, orchestras, rehearsals, theory
  seed-schedules.js      # Schedule enrichment: time blocks, back-to-back lessons, bidirectional refs
  seed-rehearsals.js     # Standalone rehearsal seeder (unused when seed-dev-data.js covers rehearsals)
  seed-fresh-start.js    # Minimal seed: super admin + tenant + admin teacher + school year
```

### Pattern 1: Bidirectional Lesson Assignment (from seed-schedules.js)
**What:** Three-phase approach to create consistent schedule data
**When to use:** Whenever creating seed data that must show up in the room schedule grid

The room schedule service (`room-schedule.service.js`) reads `assignedLessons` from teacher time blocks:
- If block has active `assignedLessons`, each lesson becomes a separate grid activity
- If block has NO active `assignedLessons`, the block itself becomes a single activity
- Each lesson needs `lessonStartTime` and `lessonEndTime` (falls back to block times if missing)
- Each lesson needs `studentId` for name lookup

**Phase A -- Rebuild Time Blocks:**
```javascript
// Source: scripts/seed-schedules.js (verified in codebase)
const block = {
  _id: new ObjectId(),
  day,                    // Hebrew day name: 'ראשון', 'שני', etc.
  startTime,              // 'HH:MM' format, 30-min aligned
  endTime,                // 'HH:MM' format
  totalDuration,          // minutes (integer)
  location,               // room name from LOCATIONS array
  notes: null,
  isActive: true,
  assignedLessons: [],    // populated in Phase C
  recurring: { isRecurring: true, excludeDates: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

**Phase B -- Pack Students into Blocks:**
```javascript
// Source: scripts/seed-schedules.js (verified in codebase)
// Student teacherAssignment structure:
{
  _id: new ObjectId(),
  teacherId,              // teacher._id hex string
  isActive: true,
  day,                    // Hebrew day name matching block.day
  time: startTime,        // 'HH:MM' within block range
  duration,               // 30, 45, or 60
  location,               // block.location
  timeBlockId: blockId,   // block._id hex string
  lessonId,               // new ObjectId hex string
  scheduleSlotId,         // new ObjectId hex string
  scheduleInfo: {
    day,
    startTime,
    endTime,
    duration,
    location,
    notes: null,
  },
  startDate: new Date('2024-09-01'),
  endDate: null,
  isRecurring: true,
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

**Phase C -- Populate Teacher assignedLessons:**
```javascript
// Source: scripts/seed-schedules.js (verified in codebase)
// Teacher assignedLesson structure:
{
  _id: lessonId,          // same ObjectId as student's lessonId
  studentId,              // student._id hex string
  studentName,            // "firstName lastName"
  lessonStartTime,        // 'HH:MM' within block range
  lessonEndTime,          // 'HH:MM' = lessonStartTime + duration
  duration,               // 30, 45, or 60
  notes: null,
  isActive: true,
  isRecurring: true,
  startDate: new Date('2024-09-01'),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

### Pattern 2: Back-to-Back Lesson Packing
**What:** Distribute students proportionally across a teacher's blocks, filling lessons back-to-back
**When to use:** Creating realistic schedule data where lessons fill contiguous time within blocks

```javascript
// Source: scripts/seed-schedules.js (verified in codebase)
// Duration distribution: 30 min (50%), 45 min (40%), 60 min (10%)
function pickDuration() {
  const r = Math.random();
  if (r < 0.5) return 30;
  if (r < 0.9) return 45;
  return 60;
}

// Each block gets a proportional share of students
// cursor advances from block.startTime, packing lessons sequentially
// 15-min overflow tolerance for edge cases
```

### Pattern 3: Room Schedule Grid Data Flow
**What:** How seeded data appears in the room schedule grid
**When to use:** Understanding what the grid expects

```
Teacher.teaching.timeBlocks[].assignedLessons[]
  --> room-schedule.service.js getTimeBlockActivities()
    --> For each lesson: { id: blockId_N, source: 'timeBlock', room, startTime: lessonStartTime, endTime: lessonEndTime, teacherName, label: studentName }
    --> For empty blocks: { id: blockId, source: 'timeBlock', room, startTime: blockStart, endTime: blockEnd, teacherName, label: 'שיעור פרטי' }
```

### Anti-Patterns to Avoid
- **Random times in student.teacherAssignments:** The current `seed-dev-data.js` generates `time: generateTime()` which produces times outside the teacher's block range. This breaks the verification in `seed-schedules.js` and means grid displays are incorrect.
- **Missing scheduleInfo:** The original `seed-dev-data.js` does not include `scheduleInfo` on `teacherAssignments`. The validation middleware expects it.
- **Separate scripts requiring manual orchestration:** Having `seed-dev-data.js` and `seed-schedules.js` as separate manual steps means incomplete data if one is forgotten.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time block structure | Minimal block without fields | Copy from seed-schedules.js | Missing `totalDuration`, `isActive`, `recurring`, `notes` causes issues in time-block.service.js |
| Student-block assignment | Random time generation | Back-to-back packing from seed-schedules.js | Random times fall outside block ranges, failing validation |
| Bidirectional refs | Only one side of the reference | Both teacher.assignedLessons AND student.teacherAssignments | Room schedule reads teacher side; student views read student side; consistency checks verify both |
| Verification | Manual DB queries | Automated verification from seed-schedules.js | Catches invalid block refs, missing scheduleInfo, time mismatches |

**Key insight:** The `seed-schedules.js` script already solves every problem Phase 36 describes. The work is integration, not invention.

## Common Pitfalls

### Pitfall 1: Time Block Missing Required Fields
**What goes wrong:** Teacher time blocks created without `totalDuration`, `isActive`, or `recurring` fields
**Why it happens:** `seed-dev-data.js` creates minimal blocks, while `time-block.service.js` and `room-schedule.service.js` expect full structure
**How to avoid:** Use the `generateTimeBlocks()` function from `seed-schedules.js` which includes all fields
**Warning signs:** `calculateBlockUtilization()` returns NaN; `isActive` filter misses blocks

### Pitfall 2: Lesson Times Outside Block Range
**What goes wrong:** Student's `teacherAssignment.time` is before `block.startTime` or after `block.endTime`
**Why it happens:** Original `seed-dev-data.js` uses `generateTime()` which picks any time 08:00-18:00 regardless of block range
**How to avoid:** Use cursor-based back-to-back packing that starts at `block.startTime` and advances
**Warning signs:** Verification shows "Time outside block range" count > 0

### Pitfall 3: lessonId Mismatch Between Teacher and Student
**What goes wrong:** `student.teacherAssignments[].lessonId` does not match any `teacher.assignedLessons[]._id`
**Why it happens:** IDs generated independently on each side instead of sharing a single ObjectId
**How to avoid:** Generate `lessonId` once, use it in both teacher's `assignedLessons._id` and student's `teacherAssignments.lessonId`
**Warning signs:** Data integrity checks report orphaned lesson references

### Pitfall 4: studentId as ObjectId vs String
**What goes wrong:** Room schedule service looks up student names by `studentId` string but ID is stored as ObjectId
**Why it happens:** Inconsistent serialization in seed data
**How to avoid:** Always store `studentId` as `.toHexString()` in `assignedLessons` (string, not ObjectId)
**Warning signs:** All student names show as null in the grid

### Pitfall 5: Teaching Days Not Covering All Weekdays
**What goes wrong:** Week overview shows sparse utilization because teachers only have 2 unique days
**Why it happens:** `usedDays` dedup means each teacher's blocks are on unique days, but with only 2-4 blocks there's limited coverage
**How to avoid:** This is actually acceptable -- real conservatories have partial-week teachers. But ensure ENOUGH teachers to cover all 5 weekdays. With 130 teachers x 2-4 blocks, all days will be well-covered.
**Warning signs:** Week overview shows zero utilization for a specific day

## Code Examples

### Complete assignedLesson entry (teacher-side)
```javascript
// Source: scripts/seed-schedules.js lines 326-340
{
  _id: lessonId,                    // ObjectId
  studentId: student._id.toHexString(),
  studentName: `${firstName} ${lastName}`,
  lessonStartTime: '09:00',         // HH:MM within block range
  lessonEndTime: '09:30',           // HH:MM = start + duration
  duration: 30,                     // minutes
  notes: null,
  isActive: true,
  isRecurring: true,
  startDate: new Date('2024-09-01'),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

### Complete teacherAssignment entry (student-side)
```javascript
// Source: scripts/seed-schedules.js lines 288-318
{
  _id: new ObjectId(),
  teacherId: teacher._id.toHexString(),
  isActive: true,
  day: 'שני',                       // Hebrew day name
  time: '09:00',                    // HH:MM start time
  duration: 30,                     // minutes
  location: 'חדר 3',               // room name
  timeBlockId: block._id.toHexString(),
  lessonId: lessonId.toHexString(),
  scheduleSlotId: scheduleSlotId.toHexString(),
  scheduleInfo: {
    day: 'שני',
    startTime: '09:00',
    endTime: '09:30',
    duration: 30,
    location: 'חדר 3',
    notes: null,
  },
  startDate: new Date('2024-09-01'),
  endDate: null,
  isRecurring: true,
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

### Room Schedule Service reads assignedLessons (verified)
```javascript
// Source: api/room-schedule/room-schedule.service.js lines 359-405
// For each teacher time block on the requested day:
const activeLessons = (block.assignedLessons || []).filter(l => l.isActive !== false);

if (activeLessons.length > 0) {
  // Each lesson -> separate grid cell
  for (let i = 0; i < activeLessons.length; i++) {
    const lesson = activeLessons[i];
    activities.push({
      id: `${blockId}_${i}`,
      source: 'timeBlock',
      room: block.location || '',
      startTime: lesson.lessonStartTime || block.startTime,  // falls back to block times
      endTime: lesson.lessonEndTime || block.endTime,
      teacherName,
      label: studentName || 'שיעור פרטי',
    });
  }
} else {
  // Empty block -> single activity spanning entire block
  activities.push({ id: blockId, source: 'timeBlock', ... });
}
```

### Verification pattern (from seed-schedules.js)
```javascript
// Source: scripts/seed-schedules.js lines 408-501
// Checks performed:
// 1. Each student's teacherAssignment.timeBlockId references a valid block on the correct teacher
// 2. Each student's lesson time falls within the referenced block's time range (15-min tolerance)
// 3. Each student has scheduleInfo populated
// 4. Counts: total blocks, blocks with lessons, total lesson refs, valid assignments
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| seed-dev-data.js creates empty blocks | seed-schedules.js fills them | Phase 31/32 timeframe | Two scripts must be run in sequence |
| Random student lesson times | Back-to-back packing within blocks | seed-schedules.js creation | Lessons properly fit within blocks |
| No scheduleInfo on teacherAssignments | scheduleInfo included | seed-schedules.js creation | Validation middleware works correctly |

**Current gap:**
- `seed-dev-data.js` produces incomplete data (empty assignedLessons, random times)
- `seed-schedules.js` fixes it but must be run separately
- No single command produces grid-ready data

## Open Questions

1. **Merge vs. orchestrate?**
   - What we know: `seed-schedules.js` works as a standalone post-processor; `seed-dev-data.js` creates the base data
   - What's unclear: Whether to inline the logic or create a wrapper script
   - Recommendation: **Inline into seed-dev-data.js.** The schedule enrichment reads from the same in-memory data structures (teachers, students) that seed-dev-data.js just created. Inlining avoids a second DB round-trip to re-read all teachers and students. Add it between step 5 (student creation) and step 6 (orchestra creation) since orchestras/rehearsals/theory are independent of lesson assignments.

2. **Should seed-schedules.js be kept or removed?**
   - What we know: After merging, seed-schedules.js becomes redundant for new seeding but could be useful for re-enriching existing data
   - Recommendation: **Keep it** as a standalone utility for re-running just the schedule enrichment on existing data (e.g., after manual DB edits). Add a note at top saying main path is seed-dev-data.js.

3. **Overflow students**
   - What we know: seed-schedules.js has an overflow handler that force-packs remaining students into 30-min slots extending past block end time (with 15-min tolerance)
   - Recommendation: This is acceptable for seed data. The verification step reports overflow count. With 130 teachers and 1200 students (~9 per teacher), 2-4 blocks of 3-5 hours each (180-300 min) can fit 4-10 students per block, which is more than enough.

## Sources

### Primary (HIGH confidence)
- `scripts/seed-dev-data.js` -- current seed script, 982 lines, creates base data with empty assignedLessons
- `scripts/seed-schedules.js` -- schedule enrichment script, 549 lines, fills assignedLessons and fixes bidirectional refs
- `api/room-schedule/room-schedule.service.js` -- room schedule aggregation service, reads assignedLessons for grid
- `api/schedule/time-block.service.js` -- time block CRUD service, defines assignedLesson structure
- `api/student/student-assignments.validation.js` -- teacherAssignment validation schema

### Secondary (MEDIUM confidence)
- `.planning/phases/31-room-data-foundation/31-03-SUMMARY.md` -- Phase 31-03 completion details
- `.planning/STATE.md` -- current project state and accumulated decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all code already exists in codebase
- Architecture: HIGH - bidirectional pattern fully implemented in seed-schedules.js, room-schedule.service.js verified
- Pitfalls: HIGH - verification step in seed-schedules.js documents exact failure modes
- Data model: HIGH - cross-referenced time-block.service.js, room-schedule.service.js, and validation schema

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- internal codebase patterns, no external dependency changes)
