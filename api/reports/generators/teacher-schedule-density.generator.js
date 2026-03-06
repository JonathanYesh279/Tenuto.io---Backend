/**
 * Teacher Schedule Density Generator (DEPT-04)
 *
 * Per-teacher time-block utilization and gap analysis. Shows how
 * efficiently each teacher's scheduled blocks are filled with
 * assigned lessons and identifies scheduling gaps.
 *
 * Data source: teacher.teaching.timeBlocks[]
 */

import { getInstrumentsByDepartment } from '../../../config/constants.js';
import { timeToMinutes } from '../../../utils/timeUtils.js';

export default {
  id: 'teacher-schedule-density',
  name: 'צפיפות מערכת מורים',
  description: 'כיסוי משבצות זמן וניתוח פערים במערכת מורים',
  category: 'schedule',
  icon: 'CalendarBlank',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'totalBlocks', label: 'משבצות זמן', type: 'number', sortable: true },
    { key: 'totalBlockMinutes', label: 'דקות מתוכננות', type: 'number', sortable: true },
    { key: 'assignedLessonCount', label: 'שיעורים משובצים', type: 'number', sortable: true },
    { key: 'assignedMinutes', label: 'דקות משובצות', type: 'number', sortable: true },
    { key: 'utilizationPercent', label: 'ניצולת', type: 'percentage', sortable: true },
    { key: 'activeDays', label: 'ימים פעילים', type: 'number', sortable: true },
    { key: 'gapCount', label: 'פערים', type: 'number', sortable: true },
    { key: 'longestGapMinutes', label: 'פער ארוך ביותר (דקות)', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const filter = {
      tenantId: scope.tenantId,
      isActive: true,
      'teaching.timeBlocks.0': { $exists: true },
    };

    // Department param filtering
    if (params.department) {
      const instruments = getInstrumentsByDepartment(params.department);
      if (instruments.length === 0) return emptyResult(this.columns);
      filter['personalInfo.instrument'] = { $in: instruments };
    }

    // Scope-based filtering
    if (scope.type === 'department') {
      const deptInstruments = (scope.departmentIds || []).flatMap((d) => getInstrumentsByDepartment(d));
      if (deptInstruments.length === 0) return emptyResult(this.columns);

      if (filter['personalInfo.instrument']) {
        // Intersect with param-based instruments
        const paramSet = new Set(filter['personalInfo.instrument'].$in);
        const intersection = deptInstruments.filter((i) => paramSet.has(i));
        if (intersection.length === 0) return emptyResult(this.columns);
        filter['personalInfo.instrument'] = { $in: intersection };
      } else {
        filter['personalInfo.instrument'] = { $in: deptInstruments };
      }
    } else if (scope.type === 'own') {
      filter._id = services.toObjectId(scope.teacherId);
    }

    const teacherCollection = await services.getCollection('teacher');
    const teachers = await teacherCollection
      .find(filter, { projection: { personalInfo: 1, 'teaching.timeBlocks': 1 } })
      .toArray();

    const rows = teachers.map((teacher) => {
      const timeBlocks = (teacher.teaching?.timeBlocks || []).filter(
        (b) => b.isActive !== false
      );

      const totalBlocks = timeBlocks.length;

      const totalBlockMinutes = timeBlocks.reduce((sum, b) => {
        if (!b.startTime || !b.endTime) return sum;
        return sum + Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
      }, 0);

      // Count assigned lessons and their minutes
      let assignedLessonCount = 0;
      let assignedMinutes = 0;

      for (const block of timeBlocks) {
        const lessons = (block.assignedLessons || []).filter((l) => l.isActive !== false);
        assignedLessonCount += lessons.length;

        for (const lesson of lessons) {
          if (lesson.duration) {
            assignedMinutes += lesson.duration;
          } else if (lesson.lessonStartTime && lesson.lessonEndTime) {
            assignedMinutes += Math.max(
              0,
              timeToMinutes(lesson.lessonEndTime) - timeToMinutes(lesson.lessonStartTime)
            );
          }
        }
      }

      const utilizationPercent = totalBlockMinutes > 0
        ? Math.round((assignedMinutes / totalBlockMinutes) * 1000) / 10
        : 0;

      // Active days
      const daySet = new Set();
      for (const b of timeBlocks) {
        if (b.day) daySet.add(b.day);
      }
      const activeDays = daySet.size;

      // Gap analysis
      const { gapCount, longestGapMinutes } = analyzeGaps(timeBlocks);

      const teacherName = `${teacher.personalInfo?.lastName || ''} ${teacher.personalInfo?.firstName || ''}`.trim();

      return {
        teacherName,
        totalBlocks,
        totalBlockMinutes,
        assignedLessonCount,
        assignedMinutes,
        utilizationPercent,
        activeDays,
        gapCount,
        longestGapMinutes,
      };
    });

    // Sort by teacher name
    rows.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'he'));

    // Summary
    const totalTeachers = rows.length;
    const avgUtilization = totalTeachers > 0
      ? Math.round(rows.reduce((s, r) => s + r.utilizationPercent, 0) / totalTeachers * 10) / 10
      : 0;
    const avgActiveDays = totalTeachers > 0
      ? Math.round(rows.reduce((s, r) => s + r.activeDays, 0) / totalTeachers * 10) / 10
      : 0;
    const totalGaps = rows.reduce((s, r) => s + r.gapCount, 0);
    const mostGapsTeacher = totalTeachers > 0
      ? rows.reduce((best, r) => r.gapCount > best.gapCount ? r : best, rows[0]).teacherName
      : '-';

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מורים עם מערכת', value: totalTeachers, type: 'number' },
          { label: 'ממוצע ניצולת', value: avgUtilization, type: 'percentage' },
          { label: 'ממוצע ימים פעילים', value: avgActiveDays, type: 'number' },
          { label: 'סה"כ פערים', value: totalGaps, type: 'number' },
          { label: 'מורה עם הכי הרבה פערים', value: mostGapsTeacher, type: 'string' },
        ],
      },
    };
  },
};

// --- Helpers ---

/**
 * Analyze gaps between consecutive time blocks on the same day.
 * A gap is any positive time between one block's endTime and the next block's startTime.
 */
function analyzeGaps(timeBlocks) {
  // Group blocks by day
  const byDay = new Map();
  for (const block of timeBlocks) {
    if (!block.day || !block.startTime || !block.endTime) continue;
    if (!byDay.has(block.day)) byDay.set(block.day, []);
    byDay.get(block.day).push(block);
  }

  let gapCount = 0;
  let longestGapMinutes = 0;

  for (const dayBlocks of byDay.values()) {
    // Sort by start time
    dayBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (let i = 0; i < dayBlocks.length - 1; i++) {
      const currentEnd = timeToMinutes(dayBlocks[i].endTime);
      const nextStart = timeToMinutes(dayBlocks[i + 1].startTime);
      const gap = nextStart - currentEnd;

      if (gap > 0) {
        gapCount++;
        if (gap > longestGapMinutes) longestGapMinutes = gap;
      }
    }
  }

  return { gapCount, longestGapMinutes };
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ מורים עם מערכת', value: 0, type: 'number' },
        { label: 'ממוצע ניצולת', value: 0, type: 'percentage' },
        { label: 'ממוצע ימים פעילים', value: 0, type: 'number' },
        { label: 'סה"כ פערים', value: 0, type: 'number' },
        { label: 'מורה עם הכי הרבה פערים', value: '-', type: 'string' },
      ],
    },
  };
}
