/**
 * Department Comparison Generator (DEPT-02)
 *
 * Presents side-by-side metrics across all 9 instrument departments
 * with ratios, averages, and distribution percentages.
 *
 * Data sources: teacher, student, hours_summary collections.
 */

import {
  INSTRUMENT_DEPARTMENTS,
  getInstrumentDepartment,
} from '../../../config/constants.js';

export default {
  id: 'department-comparison',
  name: 'השוואת מחלקות',
  description: 'השוואה צד-אל-צד של מדדים בין כל 9 המחלקות',
  category: 'department',
  icon: 'Table',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {},
  columns: [
    { key: 'department', label: 'מחלקה', type: 'string', sortable: true },
    { key: 'studentCount', label: 'תלמידים', type: 'number', sortable: true },
    { key: 'teacherCount', label: 'מורים', type: 'number', sortable: true },
    { key: 'studentTeacherRatio', label: 'יחס תלמיד/מורה', type: 'number', sortable: true },
    { key: 'totalWeeklyHours', label: 'שעות שבועיות', type: 'number', sortable: true },
    { key: 'avgHoursPerTeacher', label: 'ממוצע שעות למורה', type: 'number', sortable: true },
    { key: 'avgHoursPerStudent', label: 'ממוצע שעות לתלמיד', type: 'number', sortable: true },
    { key: 'percentOfTotalHours', label: 'אחוז משעות כוללות', type: 'percentage', sortable: true },
    { key: 'percentOfTotalStudents', label: 'אחוז מתלמידים', type: 'percentage', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    // Determine which departments to show
    let departments = [...INSTRUMENT_DEPARTMENTS];

    if (scope.type === 'department') {
      const deptSet = new Set(scope.departmentIds);
      departments = departments.filter((d) => deptSet.has(d));
    }

    if (departments.length === 0) {
      return emptyResult(this.columns);
    }

    const baseFilter = { tenantId: scope.tenantId };

    // Bulk fetch all data in parallel
    const teacherCollection = await services.getCollection('teacher');
    const studentCollection = await services.getCollection('student');
    const hsCollection = await services.getCollection('hours_summary');

    const hsFilter = { ...baseFilter };
    if (params.schoolYearId) {
      hsFilter.schoolYearId = params.schoolYearId;
    }

    const [teachers, students, hoursDocs] = await Promise.all([
      teacherCollection
        .find({ ...baseFilter, isActive: true }, { projection: { _id: 1, 'professionalInfo.instruments': 1 } })
        .toArray(),
      studentCollection
        .find({ ...baseFilter, isActive: true }, { projection: { 'academicInfo.instrumentProgress': 1 } })
        .toArray(),
      hsCollection.find(hsFilter).toArray(),
    ]);

    // Build teacher -> department map
    const teacherDeptMap = new Map();
    for (const t of teachers) {
      const instruments = t.professionalInfo?.instruments || [];
      const depts = new Set();
      for (const instr of instruments) {
        const dept = getInstrumentDepartment(instr);
        if (dept) depts.add(dept);
      }
      teacherDeptMap.set(t._id.toString(), depts);
    }

    // Count teachers per department
    const teacherCountByDept = {};
    for (const depts of teacherDeptMap.values()) {
      for (const dept of depts) {
        teacherCountByDept[dept] = (teacherCountByDept[dept] || 0) + 1;
      }
    }

    // Count students per department (primary instrument)
    const studentCountByDept = {};
    for (const s of students) {
      const progress = s.academicInfo?.instrumentProgress || [];
      const primary = progress.find((p) => p.isPrimary) || progress[0];
      if (primary?.instrumentName) {
        const dept = getInstrumentDepartment(primary.instrumentName);
        if (dept) {
          studentCountByDept[dept] = (studentCountByDept[dept] || 0) + 1;
        }
      }
    }

    // Aggregate hours per department
    const hoursByDept = {};
    for (const doc of hoursDocs) {
      const teacherDepts = teacherDeptMap.get(doc.teacherId);
      if (teacherDepts && teacherDepts.size > 0) {
        for (const dept of teacherDepts) {
          hoursByDept[dept] = (hoursByDept[dept] || 0) + (doc.totals?.totalWeeklyHours || 0);
        }
      }
    }

    // Compute totals for percentage calculations
    const totalStudentsAll = departments.reduce((sum, d) => sum + (studentCountByDept[d] || 0), 0);
    const totalHoursAll = departments.reduce((sum, d) => sum + (hoursByDept[d] || 0), 0);

    // Build rows for all departments
    const rows = departments.map((dept) => {
      const studentCount = studentCountByDept[dept] || 0;
      const teacherCount = teacherCountByDept[dept] || 0;
      const totalWeeklyHours = Math.round((hoursByDept[dept] || 0) * 100) / 100;

      const studentTeacherRatio = teacherCount > 0
        ? Math.round((studentCount / teacherCount) * 100) / 100
        : 0;
      const avgHoursPerTeacher = teacherCount > 0
        ? Math.round((totalWeeklyHours / teacherCount) * 100) / 100
        : 0;
      const avgHoursPerStudent = studentCount > 0
        ? Math.round((totalWeeklyHours / studentCount) * 100) / 100
        : 0;
      const percentOfTotalHours = totalHoursAll > 0
        ? Math.round((totalWeeklyHours / totalHoursAll) * 1000) / 10
        : 0;
      const percentOfTotalStudents = totalStudentsAll > 0
        ? Math.round((studentCount / totalStudentsAll) * 1000) / 10
        : 0;

      return {
        department: dept,
        studentCount,
        teacherCount,
        studentTeacherRatio,
        totalWeeklyHours,
        avgHoursPerTeacher,
        avgHoursPerStudent,
        percentOfTotalHours,
        percentOfTotalStudents,
      };
    });

    // Sort by department name (Hebrew locale)
    rows.sort((a, b) => a.department.localeCompare(b.department, 'he'));

    // Summary
    const activeDepts = rows.filter((r) => r.studentCount > 0 || r.teacherCount > 0).length;
    const largestByStudents = rows.reduce((max, r) => (r.studentCount > max.studentCount ? r : max), rows[0]);
    const largestByHours = rows.reduce((max, r) => (r.totalWeeklyHours > max.totalWeeklyHours ? r : max), rows[0]);
    const overallRatio = totalStudentsAll > 0 && teachers.length > 0
      ? Math.round((totalStudentsAll / teachers.length) * 100) / 100
      : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מחלקות פעילות', value: activeDepts, type: 'number' },
          { label: 'מחלקה גדולה ביותר (תלמידים)', value: largestByStudents?.department || '-', type: 'string' },
          { label: 'מחלקה גדולה ביותר (שעות)', value: largestByHours?.department || '-', type: 'string' },
          { label: 'יחס תלמיד/מורה ממוצע', value: overallRatio, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ מחלקות פעילות', value: 0, type: 'number' },
        { label: 'מחלקה גדולה ביותר (תלמידים)', value: '-', type: 'string' },
        { label: 'מחלקה גדולה ביותר (שעות)', value: '-', type: 'string' },
        { label: 'יחס תלמיד/מורה ממוצע', value: 0, type: 'number' },
      ],
    },
  };
}
