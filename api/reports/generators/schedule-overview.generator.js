/**
 * Orchestra/Theory Schedule Generator (DEPT-05)
 *
 * Weekly ensemble and theory class schedule with teacher/conductor
 * assignments, room locations, and participant counts.
 *
 * Data sources: rehearsal, theory_lesson, orchestra, teacher collections
 */

import { ObjectId } from 'mongodb';
import { VALID_DAYS } from '../../../config/constants.js';

export default {
  id: 'schedule-overview',
  name: 'מערכת תזמורות ותאוריה',
  description: 'לוח זמנים שבועי של הרכבים ושיעורי תאוריה עם שיבוץ מורים וחדרים',
  category: 'schedule',
  icon: 'Calendar',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    day: { type: 'string', required: false },
    activityType: {
      type: 'string',
      required: false,
      default: 'all',
      allowed: ['all', 'rehearsal', 'theory'],
    },
  },
  columns: [
    { key: 'dayName', label: 'יום', type: 'string', sortable: true },
    { key: 'startTime', label: 'שעת התחלה', type: 'string', sortable: true },
    { key: 'endTime', label: 'שעת סיום', type: 'string' },
    { key: 'activityName', label: 'פעילות', type: 'string', sortable: true },
    { key: 'activityType', label: 'סוג', type: 'string', sortable: true },
    { key: 'teacherName', label: 'מורה/מנצח', type: 'string', sortable: true },
    { key: 'room', label: 'חדר', type: 'string', sortable: true },
    { key: 'memberCount', label: 'משתתפים', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // Schedule overview not meaningful for individual teacher
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    // Determine which days to query
    const daysToQuery = params.day !== undefined && params.day !== ''
      ? [Number(params.day)]
      : [0, 1, 2, 3, 4, 5];

    const activityType = params.activityType || 'all';

    // Collect rehearsals and theory lessons across all days
    const allRehearsals = [];
    const allTheoryLessons = [];

    for (const dayNum of daysToQuery) {
      if (dayNum < 0 || dayNum > 5) continue;

      const queries = [];

      if (activityType === 'all' || activityType === 'rehearsal') {
        queries.push(
          getRehearsals(services, scope.tenantId, dayNum, params.schoolYearId)
            .then((docs) => { allRehearsals.push(...docs); })
        );
      }

      if (activityType === 'all' || activityType === 'theory') {
        queries.push(
          getTheoryLessons(services, scope.tenantId, dayNum, params.schoolYearId)
            .then((docs) => { allTheoryLessons.push(...docs); })
        );
      }

      await Promise.all(queries);
    }

    // Deduplicate rehearsals by groupId+dayOfWeek+startTime+endTime+location
    const rehearsalMap = new Map();
    for (const r of allRehearsals) {
      const key = `${r.groupId}_${r.dayOfWeek}_${r.startTime}_${r.endTime}_${r.location || ''}`;
      if (!rehearsalMap.has(key)) rehearsalMap.set(key, r);
    }
    const uniqueRehearsals = [...rehearsalMap.values()];

    // Deduplicate theory lessons by category+teacherId+dayOfWeek+startTime
    const theoryMap = new Map();
    for (const t of allTheoryLessons) {
      const key = `${t.category}_${t.teacherId}_${t.dayOfWeek}_${t.startTime}`;
      if (!theoryMap.has(key)) theoryMap.set(key, t);
    }
    const uniqueTheory = [...theoryMap.values()];

    // Batch-resolve orchestra and teacher names
    const orchestraIds = [...new Set(
      uniqueRehearsals.map((r) => r.groupId).filter(Boolean)
    )];

    const orchestraMap = await batchLookupOrchestras(services, orchestraIds);

    // Collect all teacher IDs to resolve
    const teacherIdSet = new Set();
    for (const [, orch] of orchestraMap) {
      if (orch.conductorId) teacherIdSet.add(orch.conductorId);
    }
    for (const t of uniqueTheory) {
      if (t.teacherId) teacherIdSet.add(t.teacherId);
    }

    const teacherNameMap = await batchLookupTeachers(services, [...teacherIdSet]);

    // Build rows
    const rows = [];

    for (const r of uniqueRehearsals) {
      const orch = orchestraMap.get(r.groupId) || {};
      const conductorName = orch.conductorId ? (teacherNameMap.get(orch.conductorId) || '') : '';
      const memberCount = orch.memberCount || 0;

      rows.push({
        dayNum: r.dayOfWeek,
        dayName: VALID_DAYS[r.dayOfWeek] || '',
        startTime: r.startTime || '',
        endTime: r.endTime || '',
        activityName: orch.name || '',
        activityType: 'חזרה',
        teacherName: conductorName,
        room: r.location || '',
        memberCount,
      });
    }

    for (const t of uniqueTheory) {
      const tName = t.teacherId ? (teacherNameMap.get(t.teacherId) || '') : '';

      rows.push({
        dayNum: t.dayOfWeek,
        dayName: VALID_DAYS[t.dayOfWeek] || '',
        startTime: t.startTime || '',
        endTime: t.endTime || '',
        activityName: t.category || '',
        activityType: 'תאוריה',
        teacherName: tName,
        room: t.location || '',
        memberCount: 0,
      });
    }

    // Sort by day (numeric), then startTime
    rows.sort((a, b) => {
      if (a.dayNum !== b.dayNum) return a.dayNum - b.dayNum;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    // Remove the helper dayNum field
    for (const row of rows) {
      delete row.dayNum;
    }

    // Summary
    const rehearsalCount = uniqueRehearsals.length;
    const theoryCount = uniqueTheory.length;
    const distinctRooms = new Set(rows.map((r) => r.room).filter(Boolean)).size;
    const distinctTeachers = new Set(rows.map((r) => r.teacherName).filter(Boolean)).size;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ פעילויות', value: rows.length, type: 'number' },
          { label: 'חזרות', value: rehearsalCount, type: 'number' },
          { label: 'שיעורי תאוריה', value: theoryCount, type: 'number' },
          { label: 'חדרים בשימוש', value: distinctRooms, type: 'number' },
          { label: 'מורים/מנצחים', value: distinctTeachers, type: 'number' },
        ],
      },
    };
  },
};

// --- Data queries ---

async function getRehearsals(services, tenantId, dayNum, schoolYearId) {
  const collection = await services.getCollection('rehearsal');
  const filter = { tenantId, dayOfWeek: dayNum };
  if (schoolYearId) filter.schoolYearId = schoolYearId;

  return collection
    .find(filter, { projection: { groupId: 1, dayOfWeek: 1, startTime: 1, endTime: 1, location: 1, type: 1 } })
    .toArray();
}

async function getTheoryLessons(services, tenantId, dayNum, schoolYearId) {
  const collection = await services.getCollection('theory_lesson');
  const filter = { tenantId, dayOfWeek: dayNum, isActive: true };
  if (schoolYearId) filter.schoolYearId = schoolYearId;

  return collection
    .find(filter, { projection: { category: 1, teacherId: 1, dayOfWeek: 1, startTime: 1, endTime: 1, location: 1 } })
    .toArray();
}

async function batchLookupOrchestras(services, orchestraIds) {
  if (orchestraIds.length === 0) return new Map();

  const collection = await services.getCollection('orchestra');
  const objectIds = orchestraIds
    .filter(Boolean)
    .map((id) => {
      try { return ObjectId.createFromHexString(id.toString()); } catch { return null; }
    })
    .filter(Boolean);

  if (objectIds.length === 0) return new Map();

  const docs = await collection
    .find({ _id: { $in: objectIds } }, { projection: { name: 1, conductorId: 1, memberIds: 1 } })
    .toArray();

  const map = new Map();
  for (const doc of docs) {
    map.set(doc._id.toString(), {
      name: doc.name || '',
      conductorId: doc.conductorId || null,
      memberCount: (doc.memberIds || []).length,
    });
  }
  return map;
}

async function batchLookupTeachers(services, teacherIds) {
  if (teacherIds.length === 0) return new Map();

  const collection = await services.getCollection('teacher');
  const objectIds = teacherIds
    .filter(Boolean)
    .map((id) => {
      try { return ObjectId.createFromHexString(id.toString()); } catch { return null; }
    })
    .filter(Boolean);

  if (objectIds.length === 0) return new Map();

  const docs = await collection
    .find({ _id: { $in: objectIds } }, { projection: { personalInfo: 1 } })
    .toArray();

  const map = new Map();
  for (const doc of docs) {
    const name = `${doc.personalInfo?.lastName || ''} ${doc.personalInfo?.firstName || ''}`.trim();
    map.set(doc._id.toString(), name);
  }
  return map;
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ פעילויות', value: 0, type: 'number' },
        { label: 'חזרות', value: 0, type: 'number' },
        { label: 'שיעורי תאוריה', value: 0, type: 'number' },
        { label: 'חדרים בשימוש', value: 0, type: 'number' },
        { label: 'מורים/מנצחים', value: 0, type: 'number' },
      ],
    },
  };
}
