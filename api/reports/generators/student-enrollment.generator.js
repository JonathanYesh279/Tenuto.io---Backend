/**
 * Student Enrollment Status Generator (STUD-01)
 *
 * Shows active/inactive student counts broken down by instrument and class.
 * Supports filtering by status, department, and class params, plus
 * scope-based access control (all/department/own).
 *
 * Data source: student collection.
 */

import { getInstrumentDepartment, getInstrumentsByDepartment } from '../../../config/constants.js';

export default {
  id: 'student-enrollment',
  name: 'סטטוס רישום תלמידים',
  description: 'סטטוס פעיל/לא פעיל עם פילוח לפי כלי נגינה וכיתה',
  category: 'student',
  icon: 'Users',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    status: { type: 'string', required: false, default: 'all', allowed: ['all', 'active', 'inactive'] },
    department: { type: 'string', required: false },
    class: { type: 'string', required: false },
  },
  columns: [
    { key: 'studentName', label: 'שם תלמיד/ה', type: 'string', sortable: true },
    { key: 'class', label: 'כיתה', type: 'string', sortable: true },
    { key: 'primaryInstrument', label: 'כלי נגינה ראשי', type: 'string', sortable: true },
    { key: 'department', label: 'מחלקה', type: 'string', sortable: true },
    { key: 'studyYears', label: 'שנות לימוד', type: 'number', sortable: true },
    { key: 'currentStage', label: 'שלב נוכחי', type: 'number', sortable: true },
    { key: 'isActive', label: 'סטטוס', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const filter = { tenantId: scope.tenantId };

    // Status filter
    if (params.status === 'active') {
      filter.isActive = true;
    } else if (params.status === 'inactive') {
      filter.isActive = false;
    }
    // 'all' or undefined: no isActive filter

    // Class filter
    if (params.class) {
      filter['academicInfo.class'] = params.class;
    }

    // Department param filtering
    let deptInstruments = null;
    if (params.department) {
      deptInstruments = getInstrumentsByDepartment(params.department);
      if (deptInstruments.length === 0) {
        return emptyResult(this.columns);
      }
      filter['academicInfo.instrumentProgress.instrumentName'] = { $in: deptInstruments };
    }

    // Scope-based filtering
    if (scope.type === 'department') {
      const allInstruments = scope.departmentIds.flatMap((dept) => getInstrumentsByDepartment(dept));
      if (allInstruments.length === 0) {
        return emptyResult(this.columns);
      }
      // Intersect with department param filter if set
      if (deptInstruments) {
        const paramSet = new Set(deptInstruments);
        const intersection = allInstruments.filter((i) => paramSet.has(i));
        if (intersection.length === 0) {
          return emptyResult(this.columns);
        }
        filter['academicInfo.instrumentProgress.instrumentName'] = { $in: intersection };
      } else {
        filter['academicInfo.instrumentProgress.instrumentName'] = { $in: allInstruments };
      }
    } else if (scope.type === 'own') {
      filter['teacherAssignments.teacherId'] = scope.teacherId;
    }

    const studentCollection = await services.getCollection('student');
    const students = await studentCollection
      .find(filter)
      .sort({ 'personalInfo.lastName': 1 })
      .toArray();

    const rows = students.map((student) => {
      const primaryProgress = getPrimaryInstrument(student);
      const instrumentName = primaryProgress?.instrumentName || '';
      return {
        studentName: `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim(),
        class: student.academicInfo?.class || '',
        primaryInstrument: instrumentName,
        department: instrumentName ? (getInstrumentDepartment(instrumentName) || '') : '',
        studyYears: student.academicInfo?.studyYears || 0,
        currentStage: primaryProgress?.currentStage || 0,
        isActive: student.isActive ? 'פעיל/ה' : 'לא פעיל/ה',
      };
    });

    const activeCount = rows.filter((r) => r.isActive === 'פעיל/ה').length;
    const inactiveCount = rows.length - activeCount;
    const instrumentSet = new Set(rows.map((r) => r.primaryInstrument).filter(Boolean));
    const classSet = new Set(rows.map((r) => r.class).filter(Boolean));

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ תלמידים', value: rows.length, type: 'number' },
          { label: 'פעילים', value: activeCount, type: 'number' },
          { label: 'לא פעילים', value: inactiveCount, type: 'number' },
          { label: 'כלי נגינה שונים', value: instrumentSet.size, type: 'number' },
          { label: 'כיתות שונות', value: classSet.size, type: 'number' },
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

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ תלמידים', value: 0, type: 'number' },
        { label: 'פעילים', value: 0, type: 'number' },
        { label: 'לא פעילים', value: 0, type: 'number' },
        { label: 'כלי נגינה שונים', value: 0, type: 'number' },
        { label: 'כיתות שונות', value: 0, type: 'number' },
      ],
    },
  };
}
