/**
 * Student Weekly Schedule Aggregation Service
 *
 * Provides a single endpoint that reads live data from three sources:
 *   1. teacher.teaching.timeBlocks[] (individual lessons)
 *   2. rehearsal collection (orchestra rehearsals)
 *   3. theory_lesson collection (theory lessons)
 *
 * This is the single source of truth for a student's weekly schedule.
 * No stale snapshots — always reads live data.
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import { VALID_DAYS } from '../../config/constants.js';
import { addMinutesToTime } from '../../utils/timeUtils.js';
import { ObjectId } from 'mongodb';

// ─── Public API ──────────────────────────────────────────────────────────────

export const studentScheduleService = {
  getStudentWeeklySchedule,
};

/**
 * Get a student's complete weekly schedule from live data sources.
 *
 * @param {string} studentId - Student ObjectId string
 * @param {object} options - { context: { tenantId, schoolYearId } }
 * @returns {Promise<object>} { individualLessons, orchestraRehearsals, theoryLessons, meta }
 */
async function getStudentWeeklySchedule(studentId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const schoolYearId = options.context?.schoolYearId || null;

  // 1. Fetch student and filter to active assignments
  const studentCollection = await getCollection('student');
  const student = await studentCollection.findOne(
    { _id: ObjectId.createFromHexString(studentId), tenantId },
    { projection: { teacherAssignments: 1, 'enrollments.orchestraIds': 1 } }
  );

  if (!student) {
    const err = new Error('Student not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const activeAssignments = (student.teacherAssignments || []).filter(
    (a) => a.isActive !== false
  );

  // Run all three data source resolutions in parallel
  const [individualLessons, orchestraRehearsals, theoryLessons] = await Promise.all([
    resolveIndividualLessons(activeAssignments, tenantId),
    resolveOrchestraRehearsals(studentId, student.enrollments?.orchestraIds, tenantId, schoolYearId),
    resolveTheoryLessons(studentId, tenantId, schoolYearId),
  ]);

  return {
    individualLessons,
    orchestraRehearsals,
    theoryLessons,
    meta: {
      studentId,
      totalActivities: individualLessons.length + orchestraRehearsals.length + theoryLessons.length,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ─── Individual Lessons (from live timeBlocks) ───────────────────────────────

/**
 * Resolve individual lesson schedule from live teacher timeBlock data.
 * Batch-fetches teachers, then maps each active assignment to its timeBlock/lesson.
 */
async function resolveIndividualLessons(activeAssignments, tenantId) {
  if (!activeAssignments.length) return [];

  // Collect unique teacher IDs
  const teacherIdSet = new Set();
  for (const a of activeAssignments) {
    if (a.teacherId) teacherIdSet.add(a.teacherId);
  }

  if (teacherIdSet.size === 0) return [];

  // Batch-fetch teachers with timeBlocks and name/instrument
  const teacherCollection = await getCollection('teacher');
  const teacherObjectIds = [...teacherIdSet]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  const teachers = await teacherCollection
    .find(
      { _id: { $in: teacherObjectIds }, tenantId },
      {
        projection: {
          'teaching.timeBlocks': 1,
          'personalInfo.firstName': 1,
          'personalInfo.lastName': 1,
          'professionalInfo.instrument': 1,
        },
      }
    )
    .toArray();

  // Build teacher map
  const teacherMap = new Map();
  for (const t of teachers) {
    teacherMap.set(t._id.toString(), t);
  }

  // Resolve each assignment
  const lessons = [];
  for (const assignment of activeAssignments) {
    const teacher = teacherMap.get(assignment.teacherId);
    if (!teacher) continue;

    const teacherName = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim();
    const instrument = teacher.professionalInfo?.instrument || null;

    if (assignment.timeBlockId) {
      // Live timeBlock resolution
      const timeBlocks = teacher.teaching?.timeBlocks || [];
      const block = timeBlocks.find(
        (b) => b._id && b._id.toString() === assignment.timeBlockId && b.isActive !== false
      );

      if (!block) continue;

      // Find the specific lesson in the block
      const lesson = (block.assignedLessons || []).find(
        (l) => l._id && l._id.toString() === assignment.lessonId && l.isActive !== false
      );

      if (!lesson) continue;

      const day = block.day;
      const dayOfWeek = VALID_DAYS.indexOf(day);

      lessons.push({
        id: assignment.lessonId,
        type: 'individual',
        day,
        dayOfWeek,
        startTime: lesson.lessonStartTime,
        endTime: lesson.lessonEndTime,
        duration: lesson.duration || null,
        location: block.location || null,
        teacherId: assignment.teacherId,
        teacherName,
        instrument,
      });
    } else if (assignment.day && assignment.time) {
      // Legacy fallback: use top-level assignment fields (NOT scheduleInfo)
      const day = assignment.day;
      const dayOfWeek = VALID_DAYS.indexOf(day);
      const startTime = assignment.time;
      const duration = assignment.duration || 45;
      const endTime = addMinutesToTime(startTime, duration);

      lessons.push({
        id: assignment.lessonId || `legacy_${assignment.teacherId}`,
        type: 'individual',
        day,
        dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : null,
        startTime,
        endTime,
        duration,
        location: assignment.location || null,
        teacherId: assignment.teacherId,
        teacherName,
        instrument,
        isLegacy: true,
      });
    }
    // If neither timeBlockId nor day/time: skip (truly unscheduled)
  }

  return lessons;
}

// ─── Orchestra Rehearsals ────────────────────────────────────────────────────

/**
 * Resolve orchestra rehearsals for a student.
 * Checks both enrollments.orchestraIds and orchestra.memberIds for membership.
 */
async function resolveOrchestraRehearsals(studentId, enrollmentOrchestraIds, tenantId, schoolYearId) {
  const orchestraCollection = await getCollection('orchestra');

  // Find orchestras where student is in memberIds
  const memberOrchestras = await orchestraCollection
    .find(
      { tenantId, memberIds: studentId },
      { projection: { _id: 1 } }
    )
    .toArray();

  const memberOrchestraIds = memberOrchestras.map((o) => o._id.toString());

  // Merge with enrollments.orchestraIds and deduplicate
  const allOrchestraIdStrings = new Set([
    ...(enrollmentOrchestraIds || []),
    ...memberOrchestraIds,
  ]);

  if (allOrchestraIdStrings.size === 0) return [];

  const orchestraObjIds = [...allOrchestraIdStrings]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  // Fetch orchestra details for names and conductor IDs
  const orchestras = await orchestraCollection
    .find(
      { _id: { $in: orchestraObjIds } },
      { projection: { name: 1, conductorId: 1 } }
    )
    .toArray();

  const orchestraNameMap = new Map();
  const conductorIdMap = new Map();
  for (const o of orchestras) {
    const id = o._id.toString();
    orchestraNameMap.set(id, o.name || '');
    conductorIdMap.set(id, o.conductorId || '');
  }

  // Fetch rehearsals for these orchestras
  const rehearsalCollection = await getCollection('rehearsal');
  const rehearsalFilter = {
    tenantId,
    groupId: { $in: [...allOrchestraIdStrings] },
  };
  if (schoolYearId) {
    rehearsalFilter.schoolYearId = schoolYearId;
  }

  const rehearsals = await rehearsalCollection.find(rehearsalFilter).toArray();

  // Deduplicate by weekly pattern (same as room-schedule.service.js)
  const seen = new Set();
  const deduped = [];
  for (const r of rehearsals) {
    const key = `${r.groupId}|${r.dayOfWeek}|${r.startTime}|${r.endTime}|${r.location || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Batch resolve conductor names
  const conductorIds = [...new Set([...conductorIdMap.values()].filter(Boolean))];
  const conductorNameMap = await batchLookupTeacherNames(conductorIds, tenantId);

  // Build result
  return deduped.map((r) => {
    const orchestraName = orchestraNameMap.get(r.groupId) || '';
    const conductorId = conductorIdMap.get(r.groupId) || '';
    const conductorName = conductorNameMap.get(conductorId) || '';

    return {
      id: r._id.toString(),
      type: 'orchestra',
      day: VALID_DAYS[r.dayOfWeek] || '',
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      location: r.location || null,
      orchestraId: r.groupId,
      orchestraName,
      conductorId,
      conductorName,
    };
  });
}

// ─── Theory Lessons ──────────────────────────────────────────────────────────

/**
 * Resolve theory lessons for a student.
 */
async function resolveTheoryLessons(studentId, tenantId, schoolYearId) {
  const theoryCollection = await getCollection('theory_lesson');

  const filter = {
    tenantId,
    studentIds: studentId,
    isActive: { $ne: false },
  };
  if (schoolYearId) {
    filter.schoolYearId = schoolYearId;
  }

  const theoryLessons = await theoryCollection.find(filter).toArray();

  // Deduplicate by weekly pattern (same as room-schedule.service.js)
  const seen = new Set();
  const deduped = [];
  for (const t of theoryLessons) {
    const key = `${t.category || ''}|${t.teacherId || ''}|${t.dayOfWeek}|${t.startTime}|${t.endTime}|${t.location || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }

  // Batch resolve teacher names
  const teacherIds = [...new Set(deduped.map((t) => t.teacherId).filter(Boolean))];
  const teacherNameMap = await batchLookupTeacherNames(teacherIds, tenantId);

  return deduped.map((t) => ({
    id: t._id.toString(),
    type: 'theory',
    day: VALID_DAYS[t.dayOfWeek] || '',
    dayOfWeek: t.dayOfWeek,
    startTime: t.startTime,
    endTime: t.endTime,
    location: t.location || null,
    category: t.category || null,
    teacherId: t.teacherId || null,
    teacherName: teacherNameMap.get(t.teacherId) || '',
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Batch lookup teacher names by IDs.
 * @param {string[]} teacherIds
 * @param {string} tenantId
 * @returns {Promise<Map<string, string>>} teacherId -> "firstName lastName"
 */
async function batchLookupTeacherNames(teacherIds, tenantId) {
  const map = new Map();
  if (!teacherIds.length) return map;

  const collection = await getCollection('teacher');
  const objectIds = teacherIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  if (!objectIds.length) return map;

  const teachers = await collection
    .find(
      { _id: { $in: objectIds }, tenantId },
      { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } }
    )
    .toArray();

  for (const t of teachers) {
    const name = `${t.personalInfo?.firstName || ''} ${t.personalInfo?.lastName || ''}`.trim();
    map.set(t._id.toString(), name);
  }
  return map;
}
