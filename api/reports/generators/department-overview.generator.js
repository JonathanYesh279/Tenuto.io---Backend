/**
 * Department Overview Generator (DEPT-01)
 *
 * Returns per-department counts of students, teachers, total weekly hours,
 * and average hours per teacher.
 *
 * Data sources: teacher, student, hours_summary collections.
 */

import {
  INSTRUMENT_DEPARTMENTS,
  getInstrumentDepartment,
  getInstrumentsByDepartment,
} from '../../../config/constants.js';

export default {
  id: 'department-overview',
  name: 'סקירת מחלקות',
  description: 'נתוני תלמידים, מורים, שעות ותזמורות לכל מחלקה',
  category: 'department',
  icon: 'ChartBar',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'department', label: 'מחלקה', type: 'string', sortable: true },
    { key: 'studentCount', label: 'תלמידים', type: 'number', sortable: true },
    { key: 'teacherCount', label: 'מורים', type: 'number', sortable: true },
    { key: 'totalWeeklyHours', label: 'שעות שבועיות', type: 'number', sortable: true },
    { key: 'avgHoursPerTeacher', label: 'ממוצע שעות למורה', type: 'number', sortable: true },
    { key: 'orchestraCount', label: 'תזמורות/הרכבים', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    // Determine which departments to show
    let departments = [...INSTRUMENT_DEPARTMENTS];

    if (params.department) {
      departments = departments.filter((d) => d === params.department);
    }

    if (scope.type === 'department') {
      const deptSet = new Set(scope.departmentIds);
      departments = departments.filter((d) => deptSet.has(d));
    }

    if (departments.length === 0) {
      return emptyResult(this.columns);
    }

    const baseFilter = { tenantId: scope.tenantId };

    // Bulk fetch: teachers, students, hours_summary in parallel
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

    // Build teacher -> department map (a teacher can belong to multiple departments)
    const teacherDeptMap = new Map(); // teacherId -> Set<department>
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

    // Count students per department (by primary instrument from instrumentProgress)
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
        // Distribute hours to each department the teacher belongs to
        // (if teacher has multiple departments, each gets the full hours -- same teacher counted in each)
        for (const dept of teacherDepts) {
          hoursByDept[dept] = (hoursByDept[dept] || 0) + (doc.totals?.totalWeeklyHours || 0);
        }
      }
    }

    // Build rows
    const rows = departments.map((dept) => {
      const teacherCount = teacherCountByDept[dept] || 0;
      const totalWeeklyHours = Math.round((hoursByDept[dept] || 0) * 100) / 100;
      const avgHoursPerTeacher = teacherCount > 0
        ? Math.round((totalWeeklyHours / teacherCount) * 100) / 100
        : 0;

      return {
        department: dept,
        studentCount: studentCountByDept[dept] || 0,
        teacherCount,
        totalWeeklyHours,
        avgHoursPerTeacher,
        orchestraCount: 0, // Orchestra-to-department mapping not available; shown in summary only
      };
    });

    // Sort by department name (Hebrew locale)
    rows.sort((a, b) => a.department.localeCompare(b.department, 'he'));

    // Compute summary
    const totalStudents = rows.reduce((sum, r) => sum + r.studentCount, 0);
    const totalTeachers = rows.reduce((sum, r) => sum + r.teacherCount, 0);
    const totalHours = rows.reduce((sum, r) => sum + r.totalWeeklyHours, 0);
    const deptsWithData = rows.filter((r) => r.studentCount > 0 || r.teacherCount > 0).length;
    const avgHoursPerDept = deptsWithData > 0
      ? Math.round((totalHours / deptsWithData) * 100) / 100
      : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מחלקות', value: deptsWithData, type: 'number' },
          { label: 'סה"כ תלמידים', value: totalStudents, type: 'number' },
          { label: 'סה"כ מורים', value: totalTeachers, type: 'number' },
          { label: 'סה"כ שעות שבועיות', value: Math.round(totalHours * 100) / 100, type: 'number' },
          { label: 'ממוצע שעות למחלקה', value: avgHoursPerDept, type: 'number' },
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
        { label: 'סה"כ מחלקות', value: 0, type: 'number' },
        { label: 'סה"כ תלמידים', value: 0, type: 'number' },
        { label: 'סה"כ מורים', value: 0, type: 'number' },
        { label: 'סה"כ שעות שבועיות', value: 0, type: 'number' },
        { label: 'ממוצע שעות למחלקה', value: 0, type: 'number' },
      ],
    },
  };
}
