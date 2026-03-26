# Phase 84: Theory Lesson Course Architecture - Research

**Researched:** 2026-03-26
**Domain:** MongoDB document modeling, recurring lesson grouping, roster management, cross-session analytics
**Confidence:** HIGH

## Summary

This phase introduces a **theory_course** collection that groups weekly recurring theory lessons into a logical "course" entity. Currently, theory lessons are individual documents in the `theory_lesson` collection. The `bulkCreateTheoryLessons` function generates multiple per-date lesson documents sharing the same `category`, `teacherId`, `dayOfWeek`, `startTime`, `endTime`, and `location` -- but there is no parent entity linking them. Students are duplicated across every individual lesson's `studentIds` array. Attendance is tracked per-lesson but there is no way to aggregate cross-session analytics for a course without manually filtering by category + teacher + time slot.

The architecture closely mirrors the existing **orchestra-to-rehearsal** pattern: an `orchestra` document holds `memberIds[]` and `rehearsalIds[]`, and each `rehearsal` document has a `groupId` pointing back to the orchestra. The theory_course entity will similarly hold the shared roster (`studentIds[]`) and a reference list of its generated lesson IDs (`lessonIds[]`), while each `theory_lesson` document gains a `courseId` field pointing back to the course.

The frontend already has two components (`TheoryGroupManager.tsx`, `TheoryLessonScheduler.tsx`) with TypeScript interfaces for group-level concepts (`TheoryGroup` with `enrolledStudents`, `schedule`, `curriculum`) and recurring patterns (`isRecurring`, `recurringPattern`). These components are currently using mock/placeholder data and are not connected to the backend. The course entity will provide the real data source for these UIs.

**Primary recommendation:** Create a `theory_course` collection following the orchestra-to-rehearsal pattern (parent entity with `studentIds[]` and `lessonIds[]`), add `courseId` to `theory_lesson` documents, refactor `bulkCreateTheoryLessons` to create the course first then link lessons to it, and build cross-session attendance aggregation via the existing `activity_attendance` collection using `groupId` + date range queries.

## Standard Stack

### Core (already in use -- no new libraries needed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| MongoDB native driver | Data layer, aggregation pipelines | Already in use, no Mongoose |
| Express.js | API routes | Already in use |
| Joi | Validation schemas | Already in use for theory validation |
| React 18 + TypeScript | Frontend | Already in use |
| TanStack Query | Data fetching | Already in use for student details |
| HeroUI | UI components | Already in use |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| dayjs (via dateHelpers.js) | Date calculations | Already wrapped in utils/dateHelpers.js |
| Chart.js + react-chartjs-2 | Cross-session analytics charts | Already in use in attendance views |

**No new installations needed.** This phase extends existing backend modules and connects existing frontend components.

## Architecture Patterns

### Recommended Module Structure
```
api/
  theory/
    theory.route.js          # Add course routes alongside lesson routes
    theory.controller.js     # Add course controller functions
    theory.service.js         # Add course service functions
    theory.validation.js      # Add course validation schemas
    theory-course.service.js  # NEW: Dedicated course service (recommended)
```

**Recommendation:** Create a separate `theory-course.service.js` to avoid making `theory.service.js` (already 999+ lines) even larger. Keep the same route file to maintain the `/api/theory` mount point (add `/api/theory/courses/*` sub-routes).

### Pattern 1: Parent-Child Entity Pattern (Orchestra-Rehearsal Model)
**What:** A parent entity (course) owns child entities (lessons) via bidirectional references.
**When to use:** When multiple time-specific instances share configuration, roster, and need aggregate analytics.
**Source:** Verified from existing codebase (`orchestra` -> `rehearsal` relationship).

```javascript
// theory_course document schema
{
  _id: ObjectId,
  tenantId: string,
  category: string,          // e.g., 'מתחילים ב'
  teacherId: string,
  dayOfWeek: number,         // 0-6
  startTime: string,         // 'HH:MM'
  endTime: string,           // 'HH:MM'
  location: string,
  studentIds: string[],      // SHARED roster -- single source of truth
  lessonIds: string[],       // Generated lesson references
  schoolYearId: string,
  startDate: Date,           // Course start date
  endDate: Date,             // Course end date
  excludeDates: Date[],      // Holiday/skip dates
  notes: string,
  syllabus: string,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date,
}

// theory_lesson document gains:
{
  ...existingFields,
  courseId: string | null,    // Back-reference to parent course (null for standalone)
}
```

### Pattern 2: Shared Roster with Per-Lesson Override
**What:** The course holds the canonical student roster. Individual lessons inherit the roster but can have per-session attendance (present/absent/late).
**When to use:** When students are enrolled in the course, not individual sessions.

```javascript
// Getting effective student list for a lesson:
async function getEffectiveStudentIds(lesson, options) {
  if (lesson.courseId) {
    // Course-linked: use course roster
    const course = await getCourseById(lesson.courseId, options);
    return course.studentIds;
  }
  // Standalone: use lesson's own studentIds
  return lesson.studentIds;
}
```

### Pattern 3: Cross-Session Analytics via Aggregation Pipeline
**What:** Use MongoDB aggregation on `activity_attendance` to compute per-student attendance rates across all sessions in a course.
**Source:** Modeled after existing `getStudentTheoryAttendanceStats` and `orchestra.getStudentAttendanceStats`.

```javascript
// Cross-session attendance aggregation
const pipeline = [
  { $match: {
    sessionId: { $in: course.lessonIds },
    activityType: 'תאוריה',
    tenantId
  }},
  { $group: {
    _id: '$studentId',
    totalSessions: { $sum: 1 },
    attended: { $sum: { $cond: [{ $in: ['$status', ['הגיע/ה', 'איחר/ה']] }, 1, 0] }},
    absences: { $sum: { $cond: [{ $eq: ['$status', 'לא הגיע/ה'] }, 1, 0] }},
    lateCount: { $sum: { $cond: [{ $eq: ['$status', 'איחר/ה'] }, 1, 0] }},
  }},
  { $addFields: {
    attendanceRate: {
      $cond: [{ $eq: ['$totalSessions', 0] }, 0,
        { $multiply: [{ $divide: ['$attended', '$totalSessions'] }, 100] }]
    }
  }}
];
```

### Pattern 4: Backward-Compatible Migration
**What:** Add `courseId: null` to all existing theory_lesson documents. The system treats `courseId: null` lessons as "standalone" (legacy behavior preserved).
**When to use:** Always -- never break existing data.

### Anti-Patterns to Avoid
- **Duplicating roster across lessons:** Currently each lesson has its own `studentIds[]` copied from bulk create. This leads to stale rosters when a student is added/removed mid-semester. The course entity becomes the single source of truth for roster.
- **Querying all lessons to compute analytics:** Use the `activity_attendance` collection with aggregation pipelines, not iterating over `theory_lesson` documents.
- **Creating a separate collection for course analytics:** Store no analytics -- compute them on demand from `activity_attendance`. This follows the existing pattern and avoids stale materialized views.
- **Breaking existing standalone lessons:** All existing lessons have `courseId: null` and continue working exactly as before.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date generation for recurring lessons | Custom date iteration | `generateDatesForDayOfWeek()` from `utils/dateHelpers.js` | Already handles timezone, excludeDates, dayOfWeek validation |
| Tenant scoping | Manual tenantId filters | `buildScopedFilter()` from `utils/queryScoping.js` | Already handles admin vs teacher scoping |
| Validation | Custom field checks | Joi schemas in `theory.validation.js` | Already the pattern, extends naturally |
| Conflict detection | Custom overlap checks | `ConflictDetectionService.validateSingleLesson()` / `validateBulkLessons()` | Already handles room + teacher conflicts |
| Attendance record creation | Custom insert logic | Follow `updateTheoryAttendance()` pattern with `activity_attendance` | Already handles present/absent/late with activityType and groupId |
| Cache invalidation | Custom cache logic | `queryCacheService.invalidate()` | Already in use for theory lessons |

**Key insight:** 90% of the infrastructure already exists. The course entity is a thin parent wrapper that links existing lesson documents and provides a single roster source.

## Common Pitfalls

### Pitfall 1: Roster Desync Between Course and Lessons
**What goes wrong:** If you maintain `studentIds` on both course AND individual lessons, they drift apart when a student is added to the course but old lessons still have the old array.
**Why it happens:** The current system copies `studentIds` into each lesson during bulk create.
**How to avoid:** Course's `studentIds` is the single source of truth. When rendering a lesson's student list, always fetch from the parent course. Only use `theory_lesson.studentIds` for standalone (non-course) lessons.
**Warning signs:** Students appear in some lessons but not others within the same course.

### Pitfall 2: Breaking Existing Attendance Data
**What goes wrong:** Existing `activity_attendance` records reference `sessionId` (theory_lesson._id) and `groupId` (category string). Adding courseId must not break these queries.
**Why it happens:** The attendance system uses `sessionId` and `groupId` -- neither references a course entity.
**How to avoid:** Keep existing `activity_attendance` schema unchanged. For cross-session analytics, query by `sessionId: { $in: course.lessonIds }`. Do NOT add a new field to `activity_attendance`.
**Warning signs:** Attendance analytics return zero after migration.

### Pitfall 3: Bulk Create Regression
**What goes wrong:** Refactoring `bulkCreateTheoryLessons` to create a course first, then lessons, breaks existing frontend forms that don't know about courses.
**Why it happens:** Frontend currently calls `POST /api/theory/bulk-create` with flat data.
**How to avoid:** Make course creation an enhancement to the existing bulk create endpoint, not a breaking change. If `createCourse: true` is passed, create a course entity. Otherwise, behave exactly as before.
**Warning signs:** Existing bulk create forms fail after deployment.

### Pitfall 4: Forgetting to Update Teacher Records
**What goes wrong:** The current system pushes lesson IDs to `teacher.teaching.theoryLessonIds`. A new course entity should also be tracked.
**Why it happens:** Teacher record updates are scattered, not centralized.
**How to avoid:** Add `teaching.theoryCourseIds` to teacher records. Update on course create/delete.
**Warning signs:** Teacher profile doesn't show their courses.

### Pitfall 5: Index Strategy for Cross-Session Queries
**What goes wrong:** Aggregation queries on `activity_attendance` with `sessionId: { $in: [30+ IDs] }` perform full collection scans.
**Why it happens:** No compound index on `{ sessionId, activityType, tenantId }`.
**How to avoid:** Create compound indexes: `{ tenantId: 1, sessionId: 1, activityType: 1 }` on `activity_attendance`, and `{ tenantId: 1, courseId: 1 }` on `theory_lesson`.
**Warning signs:** Slow cross-session analytics queries in production.

## Code Examples

### Creating a Theory Course (Service Layer Pattern)
```javascript
// Source: Modeled after orchestra.service.js addOrchestra + theory.service.js bulkCreateTheoryLessons
async function createTheoryCourse(courseData, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  // 1. Validate course data
  const { error, value } = validateTheoryCourse(courseData);
  if (error) throw new Error(`Validation error: ${error.message}`);

  value.tenantId = tenantId;
  value.createdAt = toUTC(now());
  value.updatedAt = toUTC(now());

  // 2. Insert course document
  const courseCollection = await getCollection('theory_course');
  const courseResult = await courseCollection.insertOne(value);
  const courseId = courseResult.insertedId.toString();

  // 3. Generate lesson dates and create linked lessons
  const utcDates = generateDatesForDayOfWeek(
    value.startDate, value.endDate, value.dayOfWeek, value.excludeDates
  );

  const lessons = utcDates.map(utcDate => ({
    tenantId,
    courseId,  // Link to parent course
    category: value.category,
    teacherId: value.teacherId,
    date: utcDate,
    dayOfWeek: value.dayOfWeek,
    startTime: value.startTime,
    endTime: value.endTime,
    location: value.location,
    studentIds: [...value.studentIds],  // Initial copy for backward compat
    attendance: { present: [], absent: [], late: [] },
    schoolYearId: value.schoolYearId,
    createdAt: toUTC(now()),
    updatedAt: toUTC(now()),
  }));

  // 4. Batch insert lessons
  const lessonCollection = await getCollection('theory_lesson');
  const lessonResult = await lessonCollection.insertMany(lessons, { ordered: false });
  const lessonIds = Object.values(lessonResult.insertedIds).map(id => id.toString());

  // 5. Update course with lesson IDs
  await courseCollection.updateOne(
    { _id: courseResult.insertedId },
    { $set: { lessonIds } }
  );

  // 6. Update teacher record
  const teacherCollection = await getCollection('teacher');
  await teacherCollection.updateOne(
    { _id: ObjectId.createFromHexString(value.teacherId) },
    { $addToSet: { 'teaching.theoryCourseIds': courseId } }
  );

  return { _id: courseId, ...value, lessonIds };
}
```

### Course-Level Student Management
```javascript
// Source: Modeled after orchestra.service.js addMember/removeMember
async function addStudentToCourse(courseId, studentId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const courseCollection = await getCollection('theory_course');

  // Add to course roster
  const result = await courseCollection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(courseId), tenantId },
    {
      $addToSet: { studentIds: studentId },
      $set: { updatedAt: toUTC(now()) },
    },
    { returnDocument: 'after' }
  );

  if (!result) throw new Error(`Course ${courseId} not found`);

  // Update future lessons to include student
  // (past lessons keep their historical roster)
  const lessonCollection = await getCollection('theory_lesson');
  await lessonCollection.updateMany(
    {
      courseId,
      tenantId,
      date: { $gte: toUTC(now()) },  // Only future lessons
    },
    { $addToSet: { studentIds: studentId } }
  );

  // Update student enrollment
  const studentCollection = await getCollection('student');
  await studentCollection.updateOne(
    { _id: ObjectId.createFromHexString(studentId) },
    {
      $addToSet: { 'enrollments.theoryCourseIds': courseId },
      $set: { updatedAt: toUTC(now()) }
    }
  );

  return result;
}
```

### Cross-Session Attendance Analytics
```javascript
// Source: Modeled after orchestra.getStudentAttendanceStats
async function getCourseAttendanceAnalytics(courseId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  // Get course to know lesson IDs
  const course = await getCourseById(courseId, options);

  const activityCollection = await getCollection('activity_attendance');

  // Per-student attendance rates
  const studentStats = await activityCollection.aggregate([
    {
      $match: {
        sessionId: { $in: course.lessonIds },
        activityType: 'תאוריה',
        tenantId,
      }
    },
    {
      $group: {
        _id: '$studentId',
        totalSessions: { $sum: 1 },
        attended: {
          $sum: { $cond: [{ $in: ['$status', ['הגיע/ה', 'איחר/ה']] }, 1, 0] }
        },
        absences: {
          $sum: { $cond: [{ $eq: ['$status', 'לא הגיע/ה'] }, 1, 0] }
        },
        lateCount: {
          $sum: { $cond: [{ $eq: ['$status', 'איחר/ה'] }, 1, 0] }
        },
        lastAttendedDate: {
          $max: { $cond: [{ $in: ['$status', ['הגיע/ה', 'איחר/ה']] }, '$date', null] }
        },
      }
    },
    {
      $addFields: {
        attendanceRate: {
          $cond: [
            { $eq: ['$totalSessions', 0] }, 0,
            { $multiply: [{ $divide: ['$attended', '$totalSessions'] }, 100] }
          ]
        }
      }
    },
    { $sort: { attendanceRate: -1 } }
  ]).toArray();

  // Per-session attendance summary
  const sessionStats = await activityCollection.aggregate([
    {
      $match: {
        sessionId: { $in: course.lessonIds },
        activityType: 'תאוריה',
        tenantId,
      }
    },
    {
      $group: {
        _id: '$sessionId',
        date: { $first: '$date' },
        totalStudents: { $sum: 1 },
        presentCount: {
          $sum: { $cond: [{ $in: ['$status', ['הגיע/ה', 'איחר/ה']] }, 1, 0] }
        },
      }
    },
    { $sort: { date: 1 } }
  ]).toArray();

  return {
    courseId,
    category: course.category,
    totalLessons: course.lessonIds.length,
    totalStudents: course.studentIds.length,
    studentStats,
    sessionStats,
  };
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 84) | Impact |
|------------------------|------------------------|--------|
| Flat `theory_lesson` documents with duplicated `studentIds` per lesson | Parent `theory_course` with shared roster, child lessons linked via `courseId` | Single roster source, no drift |
| No cross-session grouping -- filter by category + teacher + time to find related lessons | Explicit `courseId` on lessons, `lessonIds[]` on course | Direct queries, aggregation by course |
| Attendance stats computed per-individual-lesson only | Aggregation pipeline across all `lessonIds` in course | Course-level attendance rates and trends |
| `bulkCreateTheoryLessons` creates disconnected lessons | Enhanced to optionally create course entity and link lessons | Backward compatible, progressive enhancement |
| Frontend `TheoryGroupManager` uses mock data | Connected to real `theory_course` API | Functional group management UI |

## Database Migration Strategy

### Required Indexes
```javascript
// On theory_course collection (new)
{ tenantId: 1, category: 1, schoolYearId: 1 }
{ tenantId: 1, teacherId: 1 }
{ tenantId: 1, isActive: 1 }

// On theory_lesson collection (add)
{ tenantId: 1, courseId: 1 }

// On activity_attendance collection (verify exists)
{ tenantId: 1, sessionId: 1, activityType: 1 }
```

### Migration Script
1. Add `courseId: null` to all existing `theory_lesson` documents (backward compat)
2. Optionally: Group existing lessons by `{ category, teacherId, dayOfWeek, startTime, endTime, schoolYearId }` and auto-create course entities for each group
3. Create indexes on new fields

## Open Questions

1. **Should auto-grouping be done for existing data?**
   - What we know: Existing lessons share the same bulk-create parameters but have no parent entity
   - What's unclear: Whether the user wants existing lessons retroactively grouped into courses
   - Recommendation: Provide a migration script that optionally groups existing lessons, but don't run it automatically. Let the user decide.

2. **Should course deletion cascade-delete all lessons?**
   - What we know: Orchestra deactivation clears `rehearsalIds` and cascade-deletes rehearsals. Theory lesson deletion already cascade-deletes `activity_attendance` records.
   - What's unclear: Whether deleting a course should delete all its lessons and their attendance records, or just unlink them (set `courseId: null`)
   - Recommendation: Default to cascade delete (matching orchestra pattern). Provide a `softDelete` option that just deactivates the course and unlinks lessons.

3. **How should mid-course roster changes affect past lessons?**
   - What we know: When a student joins the course, future lessons should include them. Past lessons should remain unchanged (historical accuracy).
   - What's unclear: Whether the "effective roster" for a lesson should always be computed from the course, or if lessons should snapshot the roster at creation time
   - Recommendation: Future lessons inherit course roster changes. Past lessons keep their `studentIds` snapshot. The `getEffectiveStudentIds` function handles this by checking `lesson.date` vs `now()`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `api/theory/theory.service.js` (999+ lines) - Full theory lesson CRUD, bulk create, attendance
- Codebase analysis: `api/theory/theory.validation.js` - Joi schemas, categories, locations
- Codebase analysis: `api/theory/theory.controller.js` - 923 lines, all controller functions
- Codebase analysis: `api/theory/theory.route.js` - Complete route definitions with middleware
- Codebase analysis: `api/orchestra/orchestra.service.js` - Orchestra-rehearsal parent-child pattern
- Codebase analysis: `api/rehearsal/rehearsal.service.js` - Rehearsal creation with groupId back-reference
- Codebase analysis: `api/rehearsal/rehearsal.validation.js` - Rehearsal schema with groupId
- Codebase analysis: Phase 83 RESEARCH.md - Attendance data architecture (`activity_attendance` is canonical source, uses `sessionId` not `activityId`)
- Frontend analysis: `TheoryGroupManager.tsx` - Existing group management UI with mock data
- Frontend analysis: `TheoryLessonScheduler.tsx` - Existing scheduler with recurring pattern interfaces
- Frontend analysis: `theoryLessonUtils.ts` - TypeScript interfaces and utility functions

### Secondary (MEDIUM confidence)
- MongoDB aggregation pipeline patterns - Based on existing `getStudentAttendanceStats` in both theory.service.js and orchestra.service.js

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all patterns verified from existing codebase
- Architecture: HIGH - Parent-child pattern directly mirrors existing orchestra-rehearsal relationship
- Pitfalls: HIGH - Identified from actual codebase analysis (roster duplication, index needs, backward compat)
- Migration: MEDIUM - Auto-grouping existing data needs user input on desired behavior

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no external dependency changes expected)
