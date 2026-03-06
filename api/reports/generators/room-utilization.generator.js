/**
 * Room Utilization Generator (DEPT-03)
 *
 * Per-room occupancy percentage, peak hours, available time slots,
 * and scheduling conflict counts across individual lessons, rehearsals,
 * and theory lessons.
 *
 * Data sources: teacher.teaching.timeBlocks[], rehearsal, theory_lesson
 */

import { VALID_DAYS } from '../../../config/constants.js';
import { timeToMinutes, doTimesOverlap } from '../../../utils/timeUtils.js';

const OPERATING_START = '08:00';
const OPERATING_END = '20:00';
const OPERATING_MINUTES = timeToMinutes(OPERATING_END) - timeToMinutes(OPERATING_START); // 720

export default {
  id: 'room-utilization',
  name: 'ניצולת חדרים',
  description: 'אחוז תפוסה, שעות שיא וזמינות לכל חדר',
  category: 'schedule',
  icon: 'Door',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    day: { type: 'string', required: false },
  },
  columns: [
    { key: 'room', label: 'חדר', type: 'string', sortable: true },
    { key: 'totalActivities', label: 'פעילויות', type: 'number', sortable: true },
    { key: 'occupiedMinutes', label: 'דקות תפוסות', type: 'number', sortable: true },
    { key: 'occupancyPercent', label: 'אחוז תפוסה', type: 'percentage', sortable: true },
    { key: 'peakHour', label: 'שעת שיא', type: 'string' },
    { key: 'availableSlots', label: 'משבצות פנויות', type: 'number', sortable: true },
    { key: 'conflictCount', label: 'התנגשויות', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // Room utilization not meaningful for individual teacher
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    // Determine which days to analyze
    const daysToAnalyze = params.day !== undefined && params.day !== ''
      ? [Number(params.day)]
      : [0, 1, 2, 3, 4, 5];

    // Collect all activities across analyzed days
    const allActivities = []; // { room, startTime, endTime, day }

    for (const dayNum of daysToAnalyze) {
      const hebrewDay = VALID_DAYS[dayNum];
      if (!hebrewDay) continue;

      const [timeBlockActivities, rehearsalActivities, theoryActivities] = await Promise.all([
        getTimeBlockActivities(services, scope.tenantId, hebrewDay),
        getRehearsalActivities(services, scope.tenantId, dayNum, params.schoolYearId),
        getTheoryActivities(services, scope.tenantId, dayNum, params.schoolYearId),
      ]);

      for (const act of [...timeBlockActivities, ...rehearsalActivities, ...theoryActivities]) {
        if (act.room) {
          allActivities.push({ ...act, day: dayNum });
        }
      }
    }

    // Group by room
    const roomMap = new Map(); // room -> [{ startTime, endTime, day }]
    for (const act of allActivities) {
      if (!roomMap.has(act.room)) roomMap.set(act.room, []);
      roomMap.get(act.room).push(act);
    }

    const numberOfDays = daysToAnalyze.length;
    const totalAvailableMinutes = OPERATING_MINUTES * numberOfDays;

    // Build rows
    const rows = [];
    for (const [room, activities] of roomMap) {
      const totalActivities = activities.length;

      const occupiedMinutes = activities.reduce((sum, a) => {
        if (!a.startTime || !a.endTime) return sum;
        const dur = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
        return sum + Math.max(0, dur);
      }, 0);

      const occupancyPercent = totalAvailableMinutes > 0
        ? Math.round((occupiedMinutes / totalAvailableMinutes) * 1000) / 10
        : 0;

      const peakHour = computePeakHour(activities);

      const availableSlots = Math.floor((totalAvailableMinutes - occupiedMinutes) / 30);

      const conflictCount = countConflicts(activities);

      rows.push({
        room,
        totalActivities,
        occupiedMinutes,
        occupancyPercent,
        peakHour,
        availableSlots: Math.max(0, availableSlots),
        conflictCount,
      });
    }

    // Sort by room name (Hebrew locale)
    rows.sort((a, b) => a.room.localeCompare(b.room, 'he'));

    // Summary
    const totalRooms = rows.length;
    const totalActs = rows.reduce((s, r) => s + r.totalActivities, 0);
    const avgOccupancy = totalRooms > 0
      ? Math.round(rows.reduce((s, r) => s + r.occupancyPercent, 0) / totalRooms * 10) / 10
      : 0;
    const busiestRoom = totalRooms > 0
      ? rows.reduce((best, r) => r.occupancyPercent > best.occupancyPercent ? r : best, rows[0]).room
      : '-';
    const totalConflicts = rows.reduce((s, r) => s + r.conflictCount, 0);

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ חדרים', value: totalRooms, type: 'number' },
          { label: 'סה"כ פעילויות', value: totalActs, type: 'number' },
          { label: 'ממוצע תפוסה', value: avgOccupancy, type: 'percentage' },
          { label: 'חדר עמוס ביותר', value: busiestRoom, type: 'string' },
          { label: 'סה"כ התנגשויות', value: totalConflicts, type: 'number' },
        ],
      },
    };
  },
};

// --- Data source queries ---

async function getTimeBlockActivities(services, tenantId, hebrewDay) {
  const teacherCollection = await services.getCollection('teacher');

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
        room: { $ifNull: ['$teaching.timeBlocks.location', ''] },
        startTime: '$teaching.timeBlocks.startTime',
        endTime: '$teaching.timeBlocks.endTime',
      },
    },
  ];

  const results = await teacherCollection.aggregate(pipeline).toArray();
  return results.filter((r) => r.room);
}

async function getRehearsalActivities(services, tenantId, dayNum, schoolYearId) {
  const rehearsalCollection = await services.getCollection('rehearsal');
  const filter = { tenantId, dayOfWeek: dayNum };
  if (schoolYearId) filter.schoolYearId = schoolYearId;

  const docs = await rehearsalCollection
    .find(filter, { projection: { location: 1, startTime: 1, endTime: 1 } })
    .toArray();

  return docs
    .filter((d) => d.location)
    .map((d) => ({ room: d.location, startTime: d.startTime, endTime: d.endTime }));
}

async function getTheoryActivities(services, tenantId, dayNum, schoolYearId) {
  const theoryCollection = await services.getCollection('theory_lesson');
  const filter = { tenantId, dayOfWeek: dayNum, isActive: true };
  if (schoolYearId) filter.schoolYearId = schoolYearId;

  const docs = await theoryCollection
    .find(filter, { projection: { location: 1, startTime: 1, endTime: 1 } })
    .toArray();

  return docs
    .filter((d) => d.location)
    .map((d) => ({ room: d.location, startTime: d.startTime, endTime: d.endTime }));
}

// --- Computation helpers ---

function computePeakHour(activities) {
  const hourCounts = new Array(12).fill(0); // hours 08-19

  for (const act of activities) {
    if (!act.startTime || !act.endTime) continue;
    const startMin = timeToMinutes(act.startTime);
    const endMin = timeToMinutes(act.endTime);

    for (let h = 8; h < 20; h++) {
      const hourStart = h * 60;
      const hourEnd = (h + 1) * 60;
      // Activity overlaps this hour if it starts before hour ends and ends after hour starts
      if (startMin < hourEnd && endMin > hourStart) {
        hourCounts[h - 8]++;
      }
    }
  }

  let maxIdx = 0;
  for (let i = 1; i < hourCounts.length; i++) {
    if (hourCounts[i] > hourCounts[maxIdx]) maxIdx = i;
  }

  const peakH = maxIdx + 8;
  return `${peakH.toString().padStart(2, '0')}:00`;
}

function countConflicts(activities) {
  let conflicts = 0;

  // Group by day
  const byDay = new Map();
  for (const act of activities) {
    const d = act.day;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(act);
  }

  for (const dayActivities of byDay.values()) {
    for (let i = 0; i < dayActivities.length; i++) {
      for (let j = i + 1; j < dayActivities.length; j++) {
        const a = dayActivities[i];
        const b = dayActivities[j];
        if (a.startTime && a.endTime && b.startTime && b.endTime) {
          if (doTimesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            conflicts++;
          }
        }
      }
    }
  }

  return conflicts;
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ חדרים', value: 0, type: 'number' },
        { label: 'סה"כ פעילויות', value: 0, type: 'number' },
        { label: 'ממוצע תפוסה', value: 0, type: 'percentage' },
        { label: 'חדר עמוס ביותר', value: '-', type: 'string' },
        { label: 'סה"כ התנגשויות', value: 0, type: 'number' },
      ],
    },
  };
}
