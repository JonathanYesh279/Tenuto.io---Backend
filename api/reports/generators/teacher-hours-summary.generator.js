/**
 * Teacher Hours Summary Generator (TCHR-01)
 *
 * Returns per-teacher weekly hours with breakdown by category
 * (individualLessons, orchestraConducting, theoryTeaching, management,
 * accompaniment, ensembleCoordination, coordination, breakTime, travelTime).
 *
 * Data source: hours_summary collection (pre-computed by hours-summary.service).
 */

import { getInstrumentDepartment } from '../../../config/constants.js';

export default {
  id: 'teacher-hours-summary',
  name: 'סיכום שעות מורים',
  description: 'שעות שבועיות לכל מורה עם פירוט לפי קטגוריה',
  category: 'teacher',
  icon: 'Clock',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'idNumber', label: 'ת.ז.', type: 'string' },
    { key: 'classification', label: 'סיווג', type: 'string', sortable: true },
    { key: 'individualLessons', label: 'שיעורים פרטיים', type: 'number', sortable: true },
    { key: 'orchestraConducting', label: 'ניצוח', type: 'number', sortable: true },
    { key: 'theoryTeaching', label: 'תאוריה', type: 'number', sortable: true },
    { key: 'management', label: 'ניהול', type: 'number', sortable: true },
    { key: 'accompaniment', label: 'ליווי', type: 'number', sortable: true },
    { key: 'ensembleCoordination', label: 'ריכוז הרכבים', type: 'number', sortable: true },
    { key: 'coordination', label: 'תיאום', type: 'number', sortable: true },
    { key: 'breakTime', label: 'הפסקות', type: 'number', sortable: true },
    { key: 'travelTime', label: 'נסיעות', type: 'number', sortable: true },
    { key: 'totalWeeklyHours', label: 'סה"כ שעות', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const filter = buildFilter(params, scope);

    // Department param filtering: resolve teacherIds whose instruments map to the department
    if (params.department) {
      const teacherIds = await getTeacherIdsByDepartment(params.department, scope, services);
      if (teacherIds.length === 0) {
        return emptyResult(this.columns);
      }
      filter.teacherId = { $in: teacherIds };
    }

    // Scope-based department filtering
    if (scope.type === 'department') {
      const teacherIds = await getTeacherIdsByDepartments(scope.departmentIds, scope, services);
      if (teacherIds.length === 0) {
        return emptyResult(this.columns);
      }
      // Merge with existing teacherId filter if department param was also set
      if (filter.teacherId) {
        const paramIds = new Set(filter.teacherId.$in);
        filter.teacherId = { $in: teacherIds.filter((id) => paramIds.has(id)) };
      } else {
        filter.teacherId = { $in: teacherIds };
      }
    }

    const hsCollection = await services.getCollection('hours_summary');
    const docs = await hsCollection.find(filter).sort({ 'teacherInfo.lastName': 1 }).toArray();

    const rows = docs.map((doc) => ({
      teacherName: `${doc.teacherInfo?.lastName || ''} ${doc.teacherInfo?.firstName || ''}`.trim(),
      idNumber: doc.teacherInfo?.idNumber || '',
      classification: doc.teacherInfo?.classification || '',
      individualLessons: doc.totals?.individualLessons || 0,
      orchestraConducting: doc.totals?.orchestraConducting || 0,
      theoryTeaching: doc.totals?.theoryTeaching || 0,
      management: doc.totals?.management || 0,
      accompaniment: doc.totals?.accompaniment || 0,
      ensembleCoordination: doc.totals?.ensembleCoordination || 0,
      coordination: doc.totals?.coordination || 0,
      breakTime: doc.totals?.breakTime || 0,
      travelTime: doc.totals?.travelTime || 0,
      totalWeeklyHours: doc.totals?.totalWeeklyHours || 0,
    }));

    const totalHours = rows.reduce((sum, r) => sum + r.totalWeeklyHours, 0);
    const avgHours = rows.length > 0 ? Math.round((totalHours / rows.length) * 100) / 100 : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מורים', value: rows.length, type: 'number' },
          { label: 'ממוצע שעות שבועיות', value: avgHours, type: 'number' },
          { label: 'סה"כ שעות שבועיות', value: Math.round(totalHours * 100) / 100, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

function buildFilter(params, scope) {
  const filter = { tenantId: scope.tenantId };

  if (params.schoolYearId) {
    filter.schoolYearId = params.schoolYearId;
  }

  if (scope.type === 'own') {
    filter.teacherId = scope.teacherId;
  }

  return filter;
}

async function getTeacherIdsByDepartment(department, scope, services) {
  const teacherCollection = await services.getCollection('teacher');
  const teachers = await teacherCollection
    .find(
      { tenantId: scope.tenantId, isActive: true },
      { projection: { _id: 1, 'professionalInfo.instruments': 1 } }
    )
    .toArray();

  return teachers
    .filter((t) =>
      (t.professionalInfo?.instruments || []).some(
        (instr) => getInstrumentDepartment(instr) === department
      )
    )
    .map((t) => t._id.toString());
}

async function getTeacherIdsByDepartments(departmentIds, scope, services) {
  const deptSet = new Set(departmentIds);
  const teacherCollection = await services.getCollection('teacher');
  const teachers = await teacherCollection
    .find(
      { tenantId: scope.tenantId, isActive: true },
      { projection: { _id: 1, 'professionalInfo.instruments': 1 } }
    )
    .toArray();

  return teachers
    .filter((t) =>
      (t.professionalInfo?.instruments || []).some((instr) => deptSet.has(getInstrumentDepartment(instr)))
    )
    .map((t) => t._id.toString());
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ מורים', value: 0, type: 'number' },
        { label: 'ממוצע שעות שבועיות', value: 0, type: 'number' },
        { label: 'סה"כ שעות שבועיות', value: 0, type: 'number' },
      ],
    },
  };
}
