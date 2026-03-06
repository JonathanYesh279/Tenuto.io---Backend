/**
 * Student-Teacher Assignments Generator (STUD-03)
 *
 * Shows which students are assigned to which teachers and identifies
 * unassigned students. One row per assignment (students with multiple
 * teachers produce multiple rows). Unassigned students get a single
 * row with empty teacher/schedule fields.
 *
 * Data sources: student collection, teacher collection.
 */

import { ObjectId } from 'mongodb';
import { getInstrumentDepartment, getInstrumentsByDepartment } from '../../../config/constants.js';

export default {
  id: 'student-teacher-assignments',
  name: 'שיבוצי מורים-תלמידים',
  description: 'מי לומד אצל מי וזיהוי תלמידים ללא שיבוץ',
  category: 'student',
  icon: 'UserSwitch',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    assignmentStatus: { type: 'string', required: false, default: 'all', allowed: ['all', 'assigned', 'unassigned'] },
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'studentName', label: 'שם תלמיד/ה', type: 'string', sortable: true },
    { key: 'class', label: 'כיתה', type: 'string', sortable: true },
    { key: 'primaryInstrument', label: 'כלי נגינה', type: 'string', sortable: true },
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'day', label: 'יום', type: 'string' },
    { key: 'time', label: 'שעה', type: 'string' },
    { key: 'duration', label: 'משך (דקות)', type: 'number' },
    { key: 'assignmentStatus', label: 'סטטוס שיבוץ', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const filter = { tenantId: scope.tenantId, isActive: true };

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

    // Collect all unique teacher IDs from assignments
    const teacherIdSet = new Set();
    for (const student of students) {
      for (const assignment of student.teacherAssignments || []) {
        if (assignment.isActive !== false && assignment.teacherId) {
          teacherIdSet.add(assignment.teacherId.toString());
        }
      }
    }

    // Bulk-fetch teachers for name lookup
    const teacherLookup = {};
    if (teacherIdSet.size > 0) {
      const teacherObjectIds = [...teacherIdSet].map((id) => new ObjectId(id));
      const teacherCollection = await services.getCollection('teacher');
      const teachers = await teacherCollection
        .find(
          { _id: { $in: teacherObjectIds }, tenantId: scope.tenantId },
          { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } },
        )
        .toArray();

      for (const teacher of teachers) {
        teacherLookup[teacher._id.toString()] =
          `${teacher.personalInfo?.lastName || ''} ${teacher.personalInfo?.firstName || ''}`.trim();
      }
    }

    // Build rows: one per active assignment, or one "unassigned" row if no active assignments
    const rows = [];
    let assignedStudentCount = 0;
    let unassignedStudentCount = 0;
    const uniqueStudentIds = new Set();

    for (const student of students) {
      const studentId = student._id.toString();
      uniqueStudentIds.add(studentId);

      const studentName = `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim();
      const studentClass = student.academicInfo?.class || '';
      const primaryInstrument = getPrimaryInstrumentName(student);

      const activeAssignments = (student.teacherAssignments || []).filter(
        (a) => a.isActive !== false && a.teacherId,
      );

      if (activeAssignments.length === 0) {
        unassignedStudentCount++;
        rows.push({
          studentName,
          class: studentClass,
          primaryInstrument,
          teacherName: '-',
          day: '',
          time: '',
          duration: 0,
          assignmentStatus: 'ללא שיבוץ',
        });
      } else {
        assignedStudentCount++;
        for (const assignment of activeAssignments) {
          const tid = assignment.teacherId.toString();
          rows.push({
            studentName,
            class: studentClass,
            primaryInstrument,
            teacherName: teacherLookup[tid] || '-',
            day: assignment.day || '',
            time: assignment.time || '',
            duration: assignment.duration || 0,
            assignmentStatus: 'משובץ',
          });
        }
      }
    }

    // Filter by assignmentStatus param
    let filteredRows = rows;
    if (params.assignmentStatus === 'assigned') {
      filteredRows = rows.filter((r) => r.assignmentStatus === 'משובץ');
    } else if (params.assignmentStatus === 'unassigned') {
      filteredRows = rows.filter((r) => r.assignmentStatus === 'ללא שיבוץ');
    }

    const totalAssignments = rows.filter((r) => r.assignmentStatus === 'משובץ').length;
    const distinctTeachers = new Set(
      rows.filter((r) => r.teacherName !== '-').map((r) => r.teacherName),
    ).size;

    return {
      columns: this.columns,
      rows: filteredRows,
      summary: {
        items: [
          { label: 'סה"כ תלמידים', value: uniqueStudentIds.size, type: 'number' },
          { label: 'תלמידים משובצים', value: assignedStudentCount, type: 'number' },
          { label: 'תלמידים ללא שיבוץ', value: unassignedStudentCount, type: 'number' },
          { label: 'סה"כ שיבוצים', value: totalAssignments, type: 'number' },
          { label: 'מורים פעילים', value: distinctTeachers, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

function getPrimaryInstrumentName(student) {
  const progress = student.academicInfo?.instrumentProgress || [];
  const primary = progress.find((p) => p.isPrimary === true);
  return (primary || progress[0])?.instrumentName || '';
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ תלמידים', value: 0, type: 'number' },
        { label: 'תלמידים משובצים', value: 0, type: 'number' },
        { label: 'תלמידים ללא שיבוץ', value: 0, type: 'number' },
        { label: 'סה"כ שיבוצים', value: 0, type: 'number' },
        { label: 'מורים פעילים', value: 0, type: 'number' },
      ],
    },
  };
}
