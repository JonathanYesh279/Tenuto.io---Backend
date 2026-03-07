/**
 * Rehearsal Conflict Detection Service
 *
 * Checks room and teacher/conductor conflicts across all three activity types
 * (rehearsals, theory lessons, time blocks) before a rehearsal is created or updated.
 *
 * Does NOT modify the existing conflictDetectionService.js (theory-specific).
 */

import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { doTimesOverlap } from '../utils/timeUtils.js';
import {
  createAppDate,
  getStartOfDay,
  getEndOfDay,
  getDayOfWeek,
} from '../utils/dateHelpers.js';
import { requireTenantId } from '../middleware/tenant.middleware.js';
import { VALID_DAYS } from '../config/constants.js';

/**
 * Check for room and teacher/conductor conflicts before creating or updating a rehearsal.
 *
 * @param {object} rehearsalData - { date, startTime, endTime, location, groupId }
 * @param {object} options - { context: { tenantId, schoolYearId }, excludeRehearsalId }
 * @returns {Promise<{ hasConflicts: boolean, roomConflicts: Array, teacherConflicts: Array }>}
 */
export async function checkRehearsalConflicts(rehearsalData, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const { date, startTime, endTime, location, groupId } = rehearsalData;
  const excludeRehearsalId = options.excludeRehearsalId || null;

  // Parse the rehearsal date for queries
  const targetDate = createAppDate(date);
  const startOfDay = getStartOfDay(targetDate);
  const endOfDay = getEndOfDay(targetDate);
  const dayOfWeek = getDayOfWeek(targetDate);
  const hebrewDay = VALID_DAYS[dayOfWeek]; // Convert numeric day to Hebrew name for timeBlock matching

  // Look up the orchestra to get the conductorId
  let conductorId = null;
  if (groupId) {
    try {
      const orchestraCollection = await getCollection('orchestra');
      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(groupId),
        tenantId,
      });
      if (orchestra) {
        conductorId = orchestra.conductorId || null;
      }
    } catch (err) {
      console.warn(`Could not look up orchestra ${groupId}: ${err.message}`);
    }
  }

  // Run all conflict queries in parallel
  const [
    roomRehearsalConflicts,
    roomTheoryConflicts,
    roomTimeBlockConflicts,
    teacherRehearsalConflicts,
    teacherTheoryConflicts,
    teacherTimeBlockConflicts,
  ] = await Promise.all([
    // Room conflicts
    findRoomRehearsalConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, location, excludeRehearsalId),
    findRoomTheoryConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, location),
    findRoomTimeBlockConflicts(tenantId, hebrewDay, startTime, endTime, location),
    // Teacher/conductor conflicts (only if we have a conductorId)
    conductorId ? findTeacherRehearsalConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, conductorId, excludeRehearsalId) : Promise.resolve([]),
    conductorId ? findTeacherTheoryConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, conductorId) : Promise.resolve([]),
    conductorId ? findTeacherTimeBlockConflicts(tenantId, hebrewDay, startTime, endTime, conductorId) : Promise.resolve([]),
  ]);

  const roomConflicts = [
    ...roomRehearsalConflicts,
    ...roomTheoryConflicts,
    ...roomTimeBlockConflicts,
  ];

  const teacherConflicts = [
    ...teacherRehearsalConflicts,
    ...teacherTheoryConflicts,
    ...teacherTimeBlockConflicts,
  ];

  return {
    hasConflicts: roomConflicts.length > 0 || teacherConflicts.length > 0,
    roomConflicts,
    teacherConflicts,
  };
}

// ── Room Conflict Queries ──────────────────────────────────────────────────

/**
 * Find rehearsals in the same room with overlapping time on the same date.
 */
async function findRoomRehearsalConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, location, excludeRehearsalId) {
  if (!location) return [];

  const collection = await getCollection('rehearsal');
  const query = {
    tenantId,
    location,
    date: { $gte: startOfDay, $lte: endOfDay },
  };

  if (excludeRehearsalId) {
    query._id = { $ne: ObjectId.createFromHexString(excludeRehearsalId) };
  }

  const rehearsals = await collection.find(query).toArray();

  // Look up orchestra names for conflicting rehearsals
  const groupIds = [...new Set(rehearsals.filter(r => r.groupId).map(r => r.groupId))];
  const orchestraNames = await lookupOrchestraNames(groupIds);

  return rehearsals
    .filter(r => doTimesOverlap(startTime, endTime, r.startTime, r.endTime))
    .map(r => ({
      type: 'room',
      activityType: '\u05D7\u05D6\u05E8\u05D4', // חזרה
      activityName: orchestraNames.get(r.groupId) || '\u05D7\u05D6\u05E8\u05D4',
      conflictingTime: `${r.startTime}-${r.endTime}`,
      room: r.location,
      conflictId: r._id.toString(),
      description: `\u05D4\u05D7\u05D3\u05E8 ${r.location} \u05EA\u05E4\u05D5\u05E1 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D7\u05D6\u05E8\u05D4 "${orchestraNames.get(r.groupId) || ''}" \u05D1\u05E9\u05E2\u05D5\u05EA ${r.startTime}-${r.endTime}`,
    }));
}

/**
 * Find theory lessons in the same room with overlapping time on the same date.
 */
async function findRoomTheoryConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, location) {
  if (!location) return [];

  const collection = await getCollection('theory_lesson');
  const query = {
    tenantId,
    location,
    isActive: true,
    date: { $gte: startOfDay, $lte: endOfDay },
  };

  const lessons = await collection.find(query).toArray();

  return lessons
    .filter(l => doTimesOverlap(startTime, endTime, l.startTime, l.endTime))
    .map(l => ({
      type: 'room',
      activityType: '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4', // תאוריה
      activityName: l.category || '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4',
      conflictingTime: `${l.startTime}-${l.endTime}`,
      room: l.location,
      conflictId: l._id.toString(),
      description: `\u05D4\u05D7\u05D3\u05E8 ${l.location} \u05EA\u05E4\u05D5\u05E1 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05E9\u05D9\u05E2\u05D5\u05E8 \u05EA\u05D0\u05D5\u05E8\u05D9\u05D4 "${l.category || ''}" \u05D1\u05E9\u05E2\u05D5\u05EA ${l.startTime}-${l.endTime}`,
    }));
}

/**
 * Find time blocks in the same room with overlapping time on the same day of week.
 * TimeBlocks repeat weekly so we match by dayOfWeek (Hebrew name) and location.
 */
async function findRoomTimeBlockConflicts(tenantId, hebrewDay, startTime, endTime, location) {
  if (!location || !hebrewDay) return [];

  const collection = await getCollection('teacher');
  const teachers = await collection.find({
    tenantId,
    isActive: true,
    'teaching.timeBlocks': {
      $elemMatch: {
        day: hebrewDay,
        location,
        isActive: { $ne: false },
      },
    },
  }, {
    projection: {
      'personalInfo.firstName': 1,
      'personalInfo.lastName': 1,
      'teaching.timeBlocks': 1,
    },
  }).toArray();

  const conflicts = [];
  for (const teacher of teachers) {
    const blocks = (teacher.teaching?.timeBlocks || []).filter(
      b => b.day === hebrewDay && b.location === location && b.isActive !== false
    );

    for (const block of blocks) {
      if (doTimesOverlap(startTime, endTime, block.startTime, block.endTime)) {
        const teacherName = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim();
        conflicts.push({
          type: 'room',
          activityType: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
          activityName: `\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9 - ${teacherName}`,
          conflictingTime: `${block.startTime}-${block.endTime}`,
          room: location,
          conflictId: block._id ? block._id.toString() : teacher._id.toString(),
          description: `\u05D4\u05D7\u05D3\u05E8 ${location} \u05EA\u05E4\u05D5\u05E1 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9 \u05E9\u05DC ${teacherName} \u05D1\u05E9\u05E2\u05D5\u05EA ${block.startTime}-${block.endTime}`,
        });
      }
    }
  }

  return conflicts;
}

// ── Teacher/Conductor Conflict Queries ─────────────────────────────────────

/**
 * Find other rehearsals where the same conductor is scheduled at an overlapping time.
 */
async function findTeacherRehearsalConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, conductorId, excludeRehearsalId) {
  const collection = await getCollection('rehearsal');
  const rehearsals = await collection.find({
    tenantId,
    date: { $gte: startOfDay, $lte: endOfDay },
    ...(excludeRehearsalId ? { _id: { $ne: ObjectId.createFromHexString(excludeRehearsalId) } } : {}),
  }).toArray();

  // Filter to rehearsals whose orchestra has this conductor
  const groupIds = [...new Set(rehearsals.filter(r => r.groupId).map(r => r.groupId))];
  const orchestraCollection = await getCollection('orchestra');
  const orchestras = await orchestraCollection.find({
    _id: { $in: groupIds.filter(id => ObjectId.isValid(id)).map(id => ObjectId.createFromHexString(id)) },
    tenantId,
    conductorId,
  }).toArray();

  const conductorOrchestraIds = new Set(orchestras.map(o => o._id.toString()));
  const orchestraNames = new Map(orchestras.map(o => [o._id.toString(), o.name || '']));

  return rehearsals
    .filter(r => conductorOrchestraIds.has(r.groupId) && doTimesOverlap(startTime, endTime, r.startTime, r.endTime))
    .map(r => ({
      type: 'teacher',
      activityType: '\u05D7\u05D6\u05E8\u05D4', // חזרה
      activityName: orchestraNames.get(r.groupId) || '\u05D7\u05D6\u05E8\u05D4',
      conflictingTime: `${r.startTime}-${r.endTime}`,
      room: r.location || '',
      conflictId: r._id.toString(),
      description: `\u05D4\u05DE\u05E0\u05E6\u05D7/\u05EA \u05EA\u05E4\u05D5\u05E1/\u05D4 \u05D1\u05D7\u05D6\u05E8\u05D4 "${orchestraNames.get(r.groupId) || ''}" \u05D1\u05E9\u05E2\u05D5\u05EA ${r.startTime}-${r.endTime}`,
    }));
}

/**
 * Find theory lessons where the conductor is the teacher at an overlapping time.
 */
async function findTeacherTheoryConflicts(tenantId, startOfDay, endOfDay, startTime, endTime, conductorId) {
  const collection = await getCollection('theory_lesson');
  const lessons = await collection.find({
    tenantId,
    teacherId: conductorId,
    isActive: true,
    date: { $gte: startOfDay, $lte: endOfDay },
  }).toArray();

  return lessons
    .filter(l => doTimesOverlap(startTime, endTime, l.startTime, l.endTime))
    .map(l => ({
      type: 'teacher',
      activityType: '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4', // תאוריה
      activityName: l.category || '\u05EA\u05D0\u05D5\u05E8\u05D9\u05D4',
      conflictingTime: `${l.startTime}-${l.endTime}`,
      room: l.location || '',
      conflictId: l._id.toString(),
      description: `\u05D4\u05DE\u05E0\u05E6\u05D7/\u05EA \u05EA\u05E4\u05D5\u05E1/\u05D4 \u05D1\u05E9\u05D9\u05E2\u05D5\u05E8 \u05EA\u05D0\u05D5\u05E8\u05D9\u05D4 "${l.category || ''}" \u05D1\u05E9\u05E2\u05D5\u05EA ${l.startTime}-${l.endTime}`,
    }));
}

/**
 * Find time blocks where the conductor has private lessons at overlapping times.
 */
async function findTeacherTimeBlockConflicts(tenantId, hebrewDay, startTime, endTime, conductorId) {
  if (!hebrewDay) return [];

  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(conductorId),
    tenantId,
    isActive: true,
  }, {
    projection: { 'teaching.timeBlocks': 1 },
  });

  if (!teacher) return [];

  const blocks = (teacher.teaching?.timeBlocks || []).filter(
    b => b.day === hebrewDay && b.isActive !== false
  );

  const conflicts = [];
  for (const block of blocks) {
    if (doTimesOverlap(startTime, endTime, block.startTime, block.endTime)) {
      conflicts.push({
        type: 'teacher',
        activityType: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9', // שיעור פרטי
        activityName: '\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9',
        conflictingTime: `${block.startTime}-${block.endTime}`,
        room: block.location || '',
        conflictId: block._id ? block._id.toString() : conductorId,
        description: `\u05D4\u05DE\u05E0\u05E6\u05D7/\u05EA \u05EA\u05E4\u05D5\u05E1/\u05D4 \u05D1\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9 \u05D1\u05E9\u05E2\u05D5\u05EA ${block.startTime}-${block.endTime}`,
      });
    }
  }

  return conflicts;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Batch lookup orchestra names by groupId strings.
 */
async function lookupOrchestraNames(groupIds) {
  const map = new Map();
  if (!groupIds.length) return map;

  const collection = await getCollection('orchestra');
  const objectIds = groupIds
    .filter(id => ObjectId.isValid(id))
    .map(id => ObjectId.createFromHexString(id));

  if (!objectIds.length) return map;

  const orchestras = await collection
    .find({ _id: { $in: objectIds } }, { projection: { name: 1 } })
    .toArray();

  for (const o of orchestras) {
    map.set(o._id.toString(), o.name || '');
  }
  return map;
}
