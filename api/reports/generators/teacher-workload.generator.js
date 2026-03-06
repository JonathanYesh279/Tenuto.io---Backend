/**
 * Teacher Workload Distribution Generator (TCHR-02)
 *
 * Compares workloads across teachers and flags overloaded (above threshold)
 * and underutilized (below threshold) teachers.
 *
 * Data source: hours_summary collection (pre-computed by hours-summary.service).
 */

import { getInstrumentDepartment } from '../../../config/constants.js';

const DEFAULT_OVERLOAD_THRESHOLD = 30;
const DEFAULT_UNDERLOAD_THRESHOLD = 8;

export default {
  id: 'teacher-workload',
  name: 'התפלגות עומס עבודה',
  description: 'השוואת עומס עבודה בין מורים וזיהוי עומס יתר/חסר',
  category: 'teacher',
  icon: 'ChartBar',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    overloadThreshold: { type: 'number', required: false, default: DEFAULT_OVERLOAD_THRESHOLD },
    underloadThreshold: { type: 'number', required: false, default: DEFAULT_UNDERLOAD_THRESHOLD },
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'classification', label: 'סיווג', type: 'string', sortable: true },
    { key: 'instruments', label: 'כלי נגינה', type: 'string' },
    { key: 'totalWeeklyHours', label: 'סה"כ שעות', type: 'number', sortable: true },
    { key: 'studentCount', label: 'מספר תלמידים', type: 'number', sortable: true },
    { key: 'orchestraCount', label: 'מספר תזמורות', type: 'number', sortable: true },
    { key: 'status', label: 'סטטוס', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const overloadThreshold = params.overloadThreshold ?? DEFAULT_OVERLOAD_THRESHOLD;
    const underloadThreshold = params.underloadThreshold ?? DEFAULT_UNDERLOAD_THRESHOLD;

    const filter = buildFilter(params, scope);

    // Department param filtering
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
      if (filter.teacherId) {
        const paramIds = new Set(filter.teacherId.$in);
        filter.teacherId = { $in: teacherIds.filter((id) => paramIds.has(id)) };
      } else {
        filter.teacherId = { $in: teacherIds };
      }
    }

    const hsCollection = await services.getCollection('hours_summary');
    const docs = await hsCollection.find(filter).sort({ 'teacherInfo.lastName': 1 }).toArray();

    const rows = docs.map((doc) => {
      const totalWeeklyHours = doc.totals?.totalWeeklyHours || 0;
      let status;
      if (totalWeeklyHours > overloadThreshold) {
        status = 'עומס יתר';
      } else if (totalWeeklyHours < underloadThreshold) {
        status = 'תת ניצול';
      } else {
        status = 'תקין';
      }

      return {
        teacherName: `${doc.teacherInfo?.lastName || ''} ${doc.teacherInfo?.firstName || ''}`.trim(),
        classification: doc.teacherInfo?.classification || '',
        instruments: (doc.teacherInfo?.instruments || []).join(', '),
        totalWeeklyHours,
        studentCount: (doc.breakdown?.students || []).length,
        orchestraCount: (doc.breakdown?.orchestras || []).length,
        status,
      };
    });

    const overloadedCount = rows.filter((r) => r.status === 'עומס יתר').length;
    const underutilizedCount = rows.filter((r) => r.status === 'תת ניצול').length;
    const totalHours = rows.reduce((sum, r) => sum + r.totalWeeklyHours, 0);
    const avgHours = rows.length > 0 ? Math.round((totalHours / rows.length) * 100) / 100 : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מורים', value: rows.length, type: 'number' },
          { label: 'עומס יתר', value: overloadedCount, type: 'number' },
          { label: 'תת ניצול', value: underutilizedCount, type: 'number' },
          { label: 'ממוצע שעות', value: avgHours, type: 'number' },
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
        { label: 'עומס יתר', value: 0, type: 'number' },
        { label: 'תת ניצול', value: 0, type: 'number' },
        { label: 'ממוצע שעות', value: 0, type: 'number' },
      ],
    },
  };
}
