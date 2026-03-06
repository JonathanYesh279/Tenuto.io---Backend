/**
 * Teacher Salary Projection Generator (TCHR-03)
 *
 * Returns per-teacher estimated salary based on weekly hours multiplied
 * by classification/degree-based hourly rates. Provides weekly, monthly,
 * and annual cost projections.
 *
 * Data sources: hours_summary collection (pre-computed) + teacher collection (degree lookup).
 */

import { ObjectId } from 'mongodb';
import { getInstrumentDepartment } from '../../../config/constants.js';

/**
 * Hourly rate lookup table (ILS) -- classification x degree.
 * These are configurable reference rates based on standard Israeli Ministry
 * of Education guidelines for music conservatories. Actual rates may vary
 * by institution and collective agreement.
 */
const HOURLY_RATES = {
  'ממשיך': {
    'תואר שלישי': 95,
    'תואר שני': 85,
    'תואר ראשון': 75,
    'מוסמך בכיר': 70,
    'מוסמך': 65,
    'בלתי מוסמך': 55,
    '_default': 65,
  },
  'חדש': {
    'תואר שלישי': 85,
    'תואר שני': 75,
    'תואר ראשון': 65,
    'מוסמך בכיר': 60,
    'מוסמך': 55,
    'בלתי מוסמך': 45,
    '_default': 55,
  },
  '_default': 60,
};

/**
 * Looks up the hourly rate for a classification/degree combination.
 * Falls back through classification._default, then global _default.
 */
function getHourlyRate(classification, degree) {
  const classificationRates = HOURLY_RATES[classification];
  if (!classificationRates || typeof classificationRates !== 'object') {
    return HOURLY_RATES._default;
  }
  return classificationRates[degree] || classificationRates._default || HOURLY_RATES._default;
}

export default {
  id: 'teacher-salary-projection',
  name: 'תחזית שכר מורים',
  description: 'הערכת שכר לפי שעות, סיווג ודרגה',
  category: 'teacher',
  icon: 'CurrencyCircleDollar',
  roles: ['מנהל'],
  params: {
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'idNumber', label: 'ת.ז.', type: 'string' },
    { key: 'classification', label: 'סיווג', type: 'string', sortable: true },
    { key: 'degree', label: 'דרגה', type: 'string', sortable: true },
    { key: 'totalWeeklyHours', label: 'שעות שבועיות', type: 'number', sortable: true },
    { key: 'hourlyRate', label: 'תעריף לשעה', type: 'currency', sortable: true },
    { key: 'weeklyProjection', label: 'עלות שבועית', type: 'currency', sortable: true },
    { key: 'monthlyProjection', label: 'עלות חודשית', type: 'currency', sortable: true },
    { key: 'annualProjection', label: 'עלות שנתית', type: 'currency', sortable: true },
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
      if (filter.teacherId) {
        const paramIds = new Set(filter.teacherId.$in);
        filter.teacherId = { $in: teacherIds.filter((id) => paramIds.has(id)) };
      } else {
        filter.teacherId = { $in: teacherIds };
      }
    }

    const hsCollection = await services.getCollection('hours_summary');
    const docs = await hsCollection.find(filter).sort({ 'teacherInfo.lastName': 1 }).toArray();

    if (docs.length === 0) {
      return emptyResult(this.columns);
    }

    // Batch-load teacher docs for degree lookup
    const teacherIdSet = [...new Set(docs.map((d) => d.teacherId))];
    const teacherCollection = await services.getCollection('teacher');
    const teacherDocs = await teacherCollection
      .find(
        {
          _id: { $in: teacherIdSet.map((id) => new ObjectId(id)) },
          tenantId: scope.tenantId,
        },
        { projection: { professionalInfo: 1 } }
      )
      .toArray();

    const teacherMap = new Map();
    for (const t of teacherDocs) {
      teacherMap.set(t._id.toString(), t);
    }

    const rows = docs.map((doc) => {
      const teacher = teacherMap.get(doc.teacherId) || {};
      const classification = doc.teacherInfo?.classification || '';
      const degree = teacher.professionalInfo?.degree || 'לא צוין';
      const totalWeeklyHours = doc.totals?.totalWeeklyHours || 0;
      const hourlyRate = getHourlyRate(classification, degree);
      const weeklyProjection = Math.round(totalWeeklyHours * hourlyRate * 100) / 100;
      const monthlyProjection = Math.round(weeklyProjection * 4.33 * 100) / 100;
      const annualProjection = Math.round(monthlyProjection * 10 * 100) / 100;

      return {
        teacherName: `${doc.teacherInfo?.lastName || ''} ${doc.teacherInfo?.firstName || ''}`.trim(),
        idNumber: doc.teacherInfo?.idNumber || '',
        classification,
        degree,
        totalWeeklyHours,
        hourlyRate,
        weeklyProjection,
        monthlyProjection,
        annualProjection,
      };
    });

    const totalMonthly = rows.reduce((sum, r) => sum + r.monthlyProjection, 0);
    const totalAnnual = rows.reduce((sum, r) => sum + r.annualProjection, 0);
    const avgRate = rows.length > 0
      ? Math.round((rows.reduce((sum, r) => sum + r.hourlyRate, 0) / rows.length) * 100) / 100
      : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מורים', value: rows.length, type: 'number' },
          { label: 'עלות חודשית כוללת', value: Math.round(totalMonthly * 100) / 100, type: 'currency' },
          { label: 'עלות שנתית כוללת', value: Math.round(totalAnnual * 100) / 100, type: 'currency' },
          { label: 'תעריף ממוצע לשעה', value: avgRate, type: 'currency' },
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
        { label: 'עלות חודשית כוללת', value: 0, type: 'currency' },
        { label: 'עלות שנתית כוללת', value: 0, type: 'currency' },
        { label: 'תעריף ממוצע לשעה', value: 0, type: 'currency' },
      ],
    },
  };
}
