/**
 * Room Schedule Aggregation Service
 *
 * Merges three heterogeneous data sources into a unified room-occupancy
 * response with cross-source conflict detection:
 *   1. teacher.teaching.timeBlocks[] (embedded, Hebrew day names)
 *   2. rehearsal collection (standalone, numeric dayOfWeek)
 *   3. theory_lesson collection (standalone, numeric dayOfWeek)
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import { doTimesOverlap, timeToMinutes } from '../../utils/timeUtils.js';
import { ObjectId } from 'mongodb';
import { VALID_DAYS } from '../../config/constants.js';

// ─── Day Mapping ─────────────────────────────────────────────────────────────

const DAY_NAMES = VALID_DAYS; // ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

// ─── Public API ──────────────────────────────────────────────────────────────

export const roomScheduleService = {
  getRoomSchedule,
  moveActivity,
};

/**
 * Get all room occupancy for a given weekday, grouped by room, with conflict flags.
 *
 * @param {number} day - Numeric day 0-5 (0=Sunday)
 * @param {object} options - { context: { tenantId, schoolYearId } }
 * @returns {Promise<object>} Grouped room schedule with conflicts and timing
 */
async function getRoomSchedule(day, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const schoolYearId = options.context?.schoolYearId || null;
  const hebrewDay = DAY_NAMES[day];

  const totalStart = Date.now();

  // Run three source queries in parallel with individual timing
  const [timeBlockResult, rehearsalResult, theoryResult] = await Promise.all([
    timedQuery(() => getTimeBlockActivities(tenantId, hebrewDay, day)),
    timedQuery(() => getRehearsalActivities(tenantId, day, schoolYearId)),
    timedQuery(() => getTheoryActivities(tenantId, day, schoolYearId)),
  ]);

  const allActivities = [
    ...timeBlockResult.data,
    ...rehearsalResult.data,
    ...theoryResult.data,
  ];

  // Group by room
  const { roomMap, unassigned } = groupByRoom(allActivities);

  // Detect conflicts per room (mutates activities in-place)
  let conflictCount = 0;
  for (const activities of Object.values(roomMap)) {
    conflictCount += detectConflicts(activities);
  }
  // Also detect among unassigned
  conflictCount += detectConflicts(unassigned);

  // Build rooms array sorted by room name
  const rooms = Object.entries(roomMap)
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .map(([room, activities]) => ({
      room,
      activities: activities.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
      hasConflicts: activities.some(a => a.hasConflict),
    }));

  const totalMs = Date.now() - totalStart;

  return {
    day,
    dayName: hebrewDay,
    rooms,
    unassigned: unassigned.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    summary: {
      totalRooms: rooms.length,
      totalActivities: allActivities.length,
      conflictCount,
      sources: {
        timeBlock: timeBlockResult.data.length,
        rehearsal: rehearsalResult.data.length,
        theory: theoryResult.data.length,
      },
    },
    timing: {
      queryMs: totalMs,
      sourceMs: {
        timeBlock: timeBlockResult.ms,
        rehearsal: rehearsalResult.ms,
        theory: theoryResult.ms,
      },
    },
  };
}

/**
 * Move an activity (timeBlock, rehearsal, or theory lesson) to a new room/time.
 * Pre-checks for conflicts at the target slot before persisting.
 *
 * @param {object} moveData - Validated move request body
 * @param {string} moveData.activityId - Source activity ID
 * @param {string} moveData.source - 'timeBlock' | 'rehearsal' | 'theory'
 * @param {string} moveData.targetRoom - Target room name
 * @param {string} moveData.targetStartTime - Target start time (HH:MM)
 * @param {string} moveData.targetEndTime - Target end time (HH:MM)
 * @param {string} [moveData.teacherId] - Teacher ID (required for timeBlock)
 * @param {string} [moveData.blockId] - Block ID (required for timeBlock)
 * @param {object} options - { context: { tenantId, schoolYearId } }
 * @returns {Promise<object>} Updated room schedule for the day
 */
async function moveActivity(moveData, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const { activityId, source, targetRoom, targetStartTime, targetEndTime, teacherId, blockId } = moveData;

  // Step 1: Determine the day for the activity being moved
  let numericDay;

  if (source === 'timeBlock') {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne(
      {
        _id: ObjectId.createFromHexString(teacherId),
        tenantId,
        'teaching.timeBlocks._id': ObjectId.createFromHexString(blockId),
      },
      { projection: { 'teaching.timeBlocks.$': 1 } }
    );

    if (!teacher || !teacher.teaching?.timeBlocks?.length) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const block = teacher.teaching.timeBlocks[0];
    const hebrewDay = block.day;
    numericDay = DAY_NAMES.indexOf(hebrewDay);
    if (numericDay === -1) {
      const err = new Error('Invalid day on time block');
      err.code = 'NOT_FOUND';
      throw err;
    }
  } else if (source === 'rehearsal') {
    const rehearsalCollection = await getCollection('rehearsal');
    const rehearsal = await rehearsalCollection.findOne(
      { _id: ObjectId.createFromHexString(activityId), tenantId },
      { projection: { dayOfWeek: 1 } }
    );

    if (!rehearsal) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    numericDay = rehearsal.dayOfWeek;
  } else if (source === 'theory') {
    const theoryCollection = await getCollection('theory_lesson');
    const theory = await theoryCollection.findOne(
      { _id: ObjectId.createFromHexString(activityId), tenantId },
      { projection: { dayOfWeek: 1 } }
    );

    if (!theory) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    numericDay = theory.dayOfWeek;
  }

  // Step 2: Conflict pre-check
  const schedule = await getRoomSchedule(numericDay, options);

  // Collect all activities from rooms + unassigned, filter out the one being moved
  const allActivities = [
    ...schedule.rooms.flatMap((r) => r.activities),
    ...schedule.unassigned,
  ];

  // Determine the ID to exclude (for timeBlock, the block-level id or lesson-level id)
  const excludeId = source === 'timeBlock' ? blockId : activityId;

  const activitiesInTargetRoom = allActivities.filter((a) => {
    // Exclude the activity being moved (match by id or by blockId prefix for timeBlock lessons)
    if (source === 'timeBlock') {
      // TimeBlock activities have id = blockId or blockId_N; exclude all from same block
      if (a.source === 'timeBlock' && (a.id === excludeId || a.id.startsWith(`${excludeId}_`))) {
        return false;
      }
    } else {
      if (a.id === excludeId && a.source === source) {
        return false;
      }
    }
    // Only keep activities in the target room
    return a.room === targetRoom;
  });

  // Check for overlaps with remaining activities in target room
  const conflicts = [];
  for (const activity of activitiesInTargetRoom) {
    if (
      activity.startTime && activity.endTime &&
      doTimesOverlap(targetStartTime, targetEndTime, activity.startTime, activity.endTime)
    ) {
      conflicts.push({
        id: activity.id,
        source: activity.source,
        teacherName: activity.teacherName,
        startTime: activity.startTime,
        endTime: activity.endTime,
      });
    }
  }

  if (conflicts.length > 0) {
    const err = new Error('Conflict detected at target room/time');
    err.code = 'CONFLICT';
    err.conflictsWith = conflicts;
    throw err;
  }

  // Step 3: Per-source update
  if (source === 'timeBlock') {
    const teacherCollection = await getCollection('teacher');
    const result = await teacherCollection.updateOne(
      {
        _id: ObjectId.createFromHexString(teacherId),
        tenantId,
        'teaching.timeBlocks._id': ObjectId.createFromHexString(blockId),
      },
      {
        $set: {
          'teaching.timeBlocks.$.location': targetRoom,
          'teaching.timeBlocks.$.startTime': targetStartTime,
          'teaching.timeBlocks.$.endTime': targetEndTime,
          'teaching.timeBlocks.$.updatedAt': new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
  } else if (source === 'rehearsal') {
    const rehearsalCollection = await getCollection('rehearsal');
    const result = await rehearsalCollection.updateOne(
      { _id: ObjectId.createFromHexString(activityId), tenantId },
      {
        $set: {
          location: targetRoom,
          startTime: targetStartTime,
          endTime: targetEndTime,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
  } else if (source === 'theory') {
    const theoryCollection = await getCollection('theory_lesson');
    const result = await theoryCollection.updateOne(
      { _id: ObjectId.createFromHexString(activityId), tenantId },
      {
        $set: {
          location: targetRoom,
          startTime: targetStartTime,
          endTime: targetEndTime,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      const err = new Error('Activity not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
  }

  // Step 4: Return fresh schedule
  return getRoomSchedule(numericDay, options);
}

// ─── Source Queries ───────────────────────────────────────────────────────────

/**
 * Extract activities from teacher.teaching.timeBlocks[] via aggregation pipeline.
 * If a block has active assignedLessons, emit each lesson as a separate activity.
 * If no active assignedLessons, emit the block itself as a single activity.
 */
async function getTimeBlockActivities(tenantId, hebrewDay, numericDay) {
  const teacherCollection = await getCollection('teacher');

  const pipeline = [
    {
      $match: {
        tenantId,
        isActive: true,
        'teaching.timeBlocks': {
          $elemMatch: { day: hebrewDay, isActive: { $ne: false } },
        },
      },
    },
    { $unwind: '$teaching.timeBlocks' },
    {
      $match: {
        'teaching.timeBlocks.day': hebrewDay,
        'teaching.timeBlocks.isActive': { $ne: false },
      },
    },
    {
      $project: {
        teacherId: { $toString: '$_id' },
        firstName: { $ifNull: ['$personalInfo.firstName', ''] },
        lastName: { $ifNull: ['$personalInfo.lastName', ''] },
        timeBlock: '$teaching.timeBlocks',
      },
    },
  ];

  const rows = await teacherCollection.aggregate(pipeline).toArray();

  // Collect all studentIds for batch lookup
  const studentIdSet = new Set();
  for (const row of rows) {
    const lessons = row.timeBlock.assignedLessons || [];
    for (const lesson of lessons) {
      if (lesson.isActive !== false && lesson.studentId) {
        studentIdSet.add(lesson.studentId);
      }
    }
  }

  // Batch lookup student names
  const studentNameMap = await batchLookupStudentNames([...studentIdSet]);

  // Normalize to unified activities
  const activities = [];
  for (const row of rows) {
    const teacherName = `${row.firstName} ${row.lastName}`.trim();
    const block = row.timeBlock;
    const blockId = block._id ? block._id.toString() : row.teacherId;
    const room = block.location || '';

    const activeLessons = (block.assignedLessons || []).filter(
      (l) => l.isActive !== false
    );

    if (activeLessons.length > 0) {
      // Emit each active lesson as a separate activity
      for (let i = 0; i < activeLessons.length; i++) {
        const lesson = activeLessons[i];
        const studentName = lesson.studentId
          ? studentNameMap.get(lesson.studentId) || null
          : null;

        activities.push({
          id: `${blockId}_${i}`,
          source: 'timeBlock',
          room,
          day: numericDay,
          startTime: lesson.lessonStartTime || block.startTime,
          endTime: lesson.lessonEndTime || block.endTime,
          teacherName,
          teacherId: row.teacherId,
          label: studentName || '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
          activityType: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
          lessonId: lesson._id ? lesson._id.toString() : null,
          studentId: lesson.studentId || null,
          duration: lesson.duration || null,
          blockId,
          hasConflict: false,
          conflictGroupId: null,
        });
      }
    } else {
      // No active lessons: emit the block itself as a single activity
      activities.push({
        id: blockId,
        source: 'timeBlock',
        room,
        day: numericDay,
        startTime: block.startTime,
        endTime: block.endTime,
        teacherName,
        teacherId: row.teacherId,
        label: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
        activityType: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
        lessonId: null,
        studentId: null,
        duration: null,
        blockId,
        hasConflict: false,
        conflictGroupId: null,
      });
    }
  }

  return activities;
}

/**
 * Get rehearsal activities for a given day, deduplicated by weekly pattern.
 */
async function getRehearsalActivities(tenantId, day, schoolYearId) {
  const rehearsalCollection = await getCollection('rehearsal');

  const matchFilter = {
    tenantId,
    dayOfWeek: day,
  };
  if (schoolYearId) {
    matchFilter.schoolYearId = schoolYearId;
  }

  // Deduplicate by weekly pattern using aggregation $group
  const pipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          groupId: '$groupId',
          dayOfWeek: '$dayOfWeek',
          startTime: '$startTime',
          endTime: '$endTime',
          location: '$location',
        },
        rehearsalId: { $first: '$_id' },
        groupId: { $first: '$groupId' },
        startTime: { $first: '$startTime' },
        endTime: { $first: '$endTime' },
        location: { $first: '$location' },
        type: { $first: '$type' },
      },
    },
  ];

  const rows = await rehearsalCollection.aggregate(pipeline).toArray();

  // Batch lookup orchestra names and conductor ids
  const groupIds = [...new Set(rows.map((r) => r.groupId).filter(Boolean))];
  const { orchestraNameMap, conductorIdMap } =
    await batchLookupOrchestras(groupIds);

  // Batch lookup conductor teacher names
  const conductorIds = [...new Set(Object.values(conductorIdMap).filter(Boolean))];
  const conductorNameMap = await batchLookupTeacherNames(conductorIds);

  // Normalize
  return rows.map((row) => {
    const orchestraName = orchestraNameMap.get(row.groupId) || row.type || '\u05D7\u05D6\u05E8\u05D4'; // חזרה
    const conductorId = conductorIdMap.get(row.groupId) || '';
    const teacherName = conductorNameMap.get(conductorId) || '';

    return {
      id: row.rehearsalId.toString(),
      source: 'rehearsal',
      room: row.location || '',
      day,
      startTime: row.startTime,
      endTime: row.endTime,
      teacherName,
      teacherId: conductorId,
      label: orchestraName,
      activityType: '\u05D7\u05D6\u05E8\u05D4', // חזרה
      hasConflict: false,
      conflictGroupId: null,
    };
  });
}

/**
 * Get theory lesson activities for a given day, deduplicated by weekly pattern.
 */
async function getTheoryActivities(tenantId, day, schoolYearId) {
  const theoryCollection = await getCollection('theory_lesson');

  const matchFilter = {
    tenantId,
    dayOfWeek: day,
    isActive: true,
  };
  if (schoolYearId) {
    matchFilter.schoolYearId = schoolYearId;
  }

  // Deduplicate by weekly pattern
  const pipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          category: '$category',
          teacherId: '$teacherId',
          dayOfWeek: '$dayOfWeek',
          startTime: '$startTime',
          endTime: '$endTime',
          location: '$location',
        },
        theoryLessonId: { $first: '$_id' },
        category: { $first: '$category' },
        teacherId: { $first: '$teacherId' },
        startTime: { $first: '$startTime' },
        endTime: { $first: '$endTime' },
        location: { $first: '$location' },
      },
    },
  ];

  const rows = await theoryCollection.aggregate(pipeline).toArray();

  // Batch lookup teacher names
  const teacherIds = [...new Set(rows.map((r) => r.teacherId).filter(Boolean))];
  const teacherNameMap = await batchLookupTeacherNames(teacherIds);

  // Normalize
  return rows.map((row) => ({
    id: row.theoryLessonId.toString(),
    source: 'theory',
    room: row.location || '',
    day,
    startTime: row.startTime,
    endTime: row.endTime,
    teacherName: teacherNameMap.get(row.teacherId) || '',
    teacherId: row.teacherId || '',
    label: row.category || '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4', // תאוריה
    activityType: '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4', // תאוריה
    hasConflict: false,
    conflictGroupId: null,
  }));
}

// ─── Batch Lookups ───────────────────────────────────────────────────────────

/**
 * Batch lookup student names by IDs.
 * @param {string[]} studentIds
 * @returns {Promise<Map<string, string>>} studentId -> "firstName lastName"
 */
async function batchLookupStudentNames(studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;

  const collection = await getCollection('student');
  const objectIds = studentIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  if (!objectIds.length) return map;

  const students = await collection
    .find(
      { _id: { $in: objectIds } },
      { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } }
    )
    .toArray();

  for (const s of students) {
    const name = `${s.personalInfo?.firstName || ''} ${s.personalInfo?.lastName || ''}`.trim();
    map.set(s._id.toString(), name);
  }
  return map;
}

/**
 * Batch lookup teacher names by IDs.
 * @param {string[]} teacherIds
 * @returns {Promise<Map<string, string>>} teacherId -> "firstName lastName"
 */
async function batchLookupTeacherNames(teacherIds) {
  const map = new Map();
  if (!teacherIds.length) return map;

  const collection = await getCollection('teacher');
  const objectIds = teacherIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  if (!objectIds.length) return map;

  const teachers = await collection
    .find(
      { _id: { $in: objectIds } },
      { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } }
    )
    .toArray();

  for (const t of teachers) {
    const name = `${t.personalInfo?.firstName || ''} ${t.personalInfo?.lastName || ''}`.trim();
    map.set(t._id.toString(), name);
  }
  return map;
}

/**
 * Batch lookup orchestra names and conductor IDs.
 * @param {string[]} groupIds
 * @returns {Promise<{ orchestraNameMap: Map, conductorIdMap: Map }>}
 */
async function batchLookupOrchestras(groupIds) {
  const orchestraNameMap = new Map();
  const conductorIdMap = new Map();
  if (!groupIds.length) return { orchestraNameMap, conductorIdMap };

  const collection = await getCollection('orchestra');
  const objectIds = groupIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => ObjectId.createFromHexString(id));

  if (!objectIds.length) return { orchestraNameMap, conductorIdMap };

  const orchestras = await collection
    .find(
      { _id: { $in: objectIds } },
      { projection: { name: 1, conductorId: 1 } }
    )
    .toArray();

  for (const o of orchestras) {
    const id = o._id.toString();
    orchestraNameMap.set(id, o.name || '');
    conductorIdMap.set(id, o.conductorId || '');
  }
  return { orchestraNameMap, conductorIdMap };
}

// ─── Grouping & Conflict Detection ──────────────────────────────────────────

/**
 * Group activities by room. Activities with empty/null/undefined room go to "unassigned".
 */
function groupByRoom(activities) {
  const roomMap = {};
  const unassigned = [];

  for (const activity of activities) {
    const room = activity.room;
    if (!room) {
      unassigned.push(activity);
    } else {
      if (!roomMap[room]) roomMap[room] = [];
      roomMap[room].push(activity);
    }
  }

  return { roomMap, unassigned };
}

/**
 * Detect pairwise time conflicts within a list of activities (same room).
 * Mutates activities in-place: sets hasConflict and conflictGroupId.
 * Uses union-find for transitive conflict grouping.
 *
 * @param {Array} activities - Activities in the same room
 * @returns {number} Number of activities involved in conflicts
 */
function detectConflicts(activities) {
  if (activities.length < 2) return 0;

  // Union-find structure (index-based)
  const parent = activities.map((_, i) => i);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  let hasAnyConflict = false;

  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i];
      const b = activities[j];

      if (
        a.startTime && a.endTime && b.startTime && b.endTime &&
        doTimesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
      ) {
        a.hasConflict = true;
        b.hasConflict = true;
        union(i, j);
        hasAnyConflict = true;
      }
    }
  }

  if (!hasAnyConflict) return 0;

  // Assign conflictGroupIds based on union-find roots
  const rootToGroupId = new Map();
  let groupCounter = 0;
  let conflictCount = 0;

  for (let i = 0; i < activities.length; i++) {
    if (activities[i].hasConflict) {
      const root = find(i);
      if (!rootToGroupId.has(root)) {
        groupCounter++;
        rootToGroupId.set(root, `conflict-${groupCounter}`);
      }
      activities[i].conflictGroupId = rootToGroupId.get(root);
      conflictCount++;
    }
  }

  return conflictCount;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wrap a query function with timing.
 * @param {Function} fn - Async function to time
 * @returns {Promise<{ data: any, ms: number }>}
 */
async function timedQuery(fn) {
  const start = Date.now();
  const data = await fn();
  return { data, ms: Date.now() - start };
}
