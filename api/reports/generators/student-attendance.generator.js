/**
 * Student Attendance Generator (STUD-02)
 *
 * Shows per-student attendance rates with trend indicators, broken down
 * by activity type. Supports filtering by activityType param and
 * scope-based access control (all/department/own).
 *
 * Data source: student collection + activity_attendance collection.
 */

import { getInstrumentsByDepartment, MINISTRY_PRESENT_STATUSES } from '../../../config/constants.js';

export default {
  id: 'student-attendance',
  name: 'נוכחות תלמידים',
  description: 'אחוזי נוכחות לתלמיד עם מגמות לפי סוג פעילות',
  category: 'student',
  icon: 'ChartBar',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    activityType: {
      type: 'string',
      required: false,
      default: 'all',
      allowed: ['all', 'שיעור פרטי', 'תאוריה', 'חזרות', 'תזמורת'],
    },
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'studentName', label: 'שם תלמיד/ה', type: 'string', sortable: true },
    { key: 'class', label: 'כיתה', type: 'string', sortable: true },
    { key: 'primaryInstrument', label: 'כלי נגינה', type: 'string', sortable: true },
    { key: 'totalLessons', label: 'סה"כ שיעורים', type: 'number', sortable: true },
    { key: 'attended', label: 'נוכח/ת', type: 'number', sortable: true },
    { key: 'missed', label: 'חיסורים', type: 'number', sortable: true },
    { key: 'attendanceRate', label: 'אחוז נוכחות', type: 'percentage', sortable: true },
    { key: 'trend', label: 'מגמה', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // 1. Build student filter
    const studentFilter = { tenantId: scope.tenantId, isActive: true };

    // 2. Department param filtering
    let deptInstruments = null;
    if (params.department) {
      deptInstruments = getInstrumentsByDepartment(params.department);
      if (deptInstruments.length === 0) {
        return emptyResult(this.columns);
      }
      studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: deptInstruments };
    }

    // 3. Scope filtering
    if (scope.type === 'department') {
      const allInstruments = scope.departmentIds.flatMap((dept) => getInstrumentsByDepartment(dept));
      if (allInstruments.length === 0) {
        return emptyResult(this.columns);
      }
      if (deptInstruments) {
        const paramSet = new Set(deptInstruments);
        const intersection = allInstruments.filter((i) => paramSet.has(i));
        if (intersection.length === 0) {
          return emptyResult(this.columns);
        }
        studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: intersection };
      } else {
        studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: allInstruments };
      }
    } else if (scope.type === 'own') {
      studentFilter['teacherAssignments.teacherId'] = scope.teacherId;
    }

    // 4. Query students
    const studentCollection = await services.getCollection('student');
    const students = await studentCollection
      .find(studentFilter, { projection: { _id: 1, personalInfo: 1, academicInfo: 1 } })
      .sort({ 'personalInfo.lastName': 1 })
      .toArray();

    if (students.length === 0) {
      return emptyResult(this.columns);
    }

    // 5. Build attendance filter
    const studentIdStrings = students.map((s) => s._id.toString());
    const attendanceFilter = {
      tenantId: scope.tenantId,
      studentId: { $in: studentIdStrings },
      isArchived: { $ne: true },
    };
    if (params.activityType && params.activityType !== 'all') {
      attendanceFilter.activityType = params.activityType;
    }

    // 6. Query attendance records
    const attendanceCollection = await services.getCollection('activity_attendance');
    const attendanceRecords = await attendanceCollection.find(attendanceFilter).toArray();

    // 7. Group by studentId
    const attendanceByStudent = new Map();
    for (const record of attendanceRecords) {
      const sid = record.studentId;
      if (!attendanceByStudent.has(sid)) {
        attendanceByStudent.set(sid, []);
      }
      attendanceByStudent.get(sid).push(record);
    }

    // 8. Map to rows
    const rows = students.map((student) => {
      const sid = student._id.toString();
      const records = attendanceByStudent.get(sid) || [];
      const total = records.length;
      const attended = records.filter((r) => MINISTRY_PRESENT_STATUSES.includes(r.status)).length;
      const late = records.filter((r) => r.status === 'איחור').length;
      const missed = records.filter((r) => r.status === 'לא הגיע/ה').length;
      const attendanceRate = total > 0 ? Math.round((attended / total) * 10000) / 100 : 0;
      const trend = calculateTrend(records);

      const primaryProgress = getPrimaryInstrument(student);

      return {
        studentName: `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim(),
        class: student.academicInfo?.class || '',
        primaryInstrument: primaryProgress?.instrumentName || '',
        totalLessons: total,
        attended,
        missed,
        attendanceRate,
        trend,
      };
    });

    // 9. Summary
    const totalStudents = rows.length;
    const avgRate = totalStudents > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.attendanceRate, 0) / totalStudents * 100) / 100
      : 0;
    const below70 = rows.filter((r) => r.attendanceRate < 70).length;
    const above90 = rows.filter((r) => r.attendanceRate > 90).length;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ תלמידים', value: totalStudents, type: 'number' },
          { label: 'ממוצע נוכחות %', value: avgRate, type: 'number' },
          { label: 'תלמידים מתחת ל-70%', value: below70, type: 'number' },
          { label: 'תלמידים מעל 90%', value: above90, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

function getPrimaryInstrument(student) {
  const progress = student.academicInfo?.instrumentProgress || [];
  const primary = progress.find((p) => p.isPrimary === true);
  return primary || progress[0] || null;
}

function calculateTrend(records) {
  if (records.length < 6) {
    return 'אין מספיק נתונים';
  }

  // Sort by date descending, take last 10
  const sorted = [...records]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const recent5 = sorted.slice(0, 5);
  const older5 = sorted.slice(5);

  if (older5.length === 0) {
    return 'אין מספיק נתונים';
  }

  const recentRate = recent5.filter((r) => MINISTRY_PRESENT_STATUSES.includes(r.status)).length / recent5.length * 100;
  const olderRate = older5.filter((r) => MINISTRY_PRESENT_STATUSES.includes(r.status)).length / older5.length * 100;

  if (recentRate > olderRate + 10) {
    return 'שיפור';
  }
  if (recentRate < olderRate - 10) {
    return 'ירידה';
  }
  return 'יציב';
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ תלמידים', value: 0, type: 'number' },
        { label: 'ממוצע נוכחות %', value: 0, type: 'number' },
        { label: 'תלמידים מתחת ל-70%', value: 0, type: 'number' },
        { label: 'תלמידים מעל 90%', value: 0, type: 'number' },
      ],
    },
  };
}
