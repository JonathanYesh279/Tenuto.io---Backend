/**
 * Year-over-Year Comparison Generator (INST-01)
 *
 * Compares key institutional metrics between two selected school years.
 * Data sources: hours_summary, orchestra, student, school_year collections.
 */

export default {
  id: 'year-over-year-comparison',
  name: 'השוואה שנתית',
  description: 'השוואת מדדים מרכזיים בין שנות לימודים',
  category: 'institutional',
  icon: 'TrendUp',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    comparisonYearId: { type: 'string', required: true },
  },
  columns: [
    { key: 'metric', label: 'מדד', type: 'string', sortable: true },
    { key: 'currentValue', label: 'שנה נוכחית', type: 'number', sortable: true },
    { key: 'comparisonValue', label: 'שנת השוואה', type: 'number', sortable: true },
    { key: 'change', label: 'שינוי', type: 'number', sortable: true },
    { key: 'changePercent', label: 'שינוי באחוזים', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    const { schoolYearId, comparisonYearId } = params;

    if (!comparisonYearId) {
      return {
        columns: this.columns,
        rows: [],
        summary: {
          items: [{ label: 'שגיאה', value: 'לא נבחרה שנת השוואה', type: 'string' }],
        },
      };
    }

    const hsCollection = await services.getCollection('hours_summary');
    const orchestraCollection = await services.getCollection('orchestra');
    const studentCollection = await services.getCollection('student');
    const schoolYearCollection = await services.getCollection('school_year');

    // Fetch school year names
    const [currentYear, comparisonYear] = await Promise.all([
      schoolYearId
        ? schoolYearCollection.findOne({ _id: services.toObjectId(schoolYearId) })
        : null,
      schoolYearCollection.findOne({ _id: services.toObjectId(comparisonYearId) }),
    ]);

    const currentYearName = currentYear?.name || 'שנה נוכחית';
    const comparisonYearName = comparisonYear?.name || 'שנת השוואה';

    // Build base filter
    const baseFilter = { tenantId: scope.tenantId };

    // Collect metrics for both years in parallel
    const [currentMetrics, comparisonMetrics] = await Promise.all([
      collectMetrics(baseFilter, schoolYearId, hsCollection, orchestraCollection, studentCollection),
      collectMetrics(baseFilter, comparisonYearId, hsCollection, orchestraCollection, studentCollection),
    ]);

    // Build rows
    const metricDefs = [
      { key: 'teacherCount', label: 'מורים עם שעות' },
      { key: 'totalWeeklyHours', label: 'סה"כ שעות שבועיות' },
      { key: 'avgWeeklyHours', label: 'ממוצע שעות למורה' },
      { key: 'orchestraCount', label: 'תזמורות/הרכבים' },
      { key: 'hoursSummaryCount', label: 'רשומות שעות' },
      { key: 'activeStudentCount', label: 'תלמידים פעילים' },
      { key: 'enrolledStudentCount', label: 'תלמידים עם שיוך' },
    ];

    const rows = metricDefs.map(({ key, label }) => {
      const current = currentMetrics[key] || 0;
      const comparison = comparisonMetrics[key] || 0;
      const change = Math.round((current - comparison) * 100) / 100;
      const changePercent =
        comparison !== 0 ? Math.round(((current - comparison) / comparison) * 10000) / 100 : 0;

      return {
        metric: label,
        currentValue: Math.round(current * 100) / 100,
        comparisonValue: Math.round(comparison * 100) / 100,
        change,
        changePercent,
      };
    });

    const improved = rows.filter((r) => r.change > 0).length;
    const declined = rows.filter((r) => r.change < 0).length;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'שנה נוכחית', value: currentYearName, type: 'string' },
          { label: 'שנת השוואה', value: comparisonYearName, type: 'string' },
          { label: 'מדדים בשיפור', value: improved, type: 'number' },
          { label: 'מדדים בירידה', value: declined, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

async function collectMetrics(baseFilter, schoolYearId, hsCollection, orchestraCollection, studentCollection) {
  const hsFilter = { ...baseFilter };
  if (schoolYearId) {
    hsFilter.schoolYearId = schoolYearId;
  }

  const orchestraFilter = { ...baseFilter };
  if (schoolYearId) {
    orchestraFilter.schoolYearId = schoolYearId;
  }

  const [hoursDocs, orchestraCount, activeStudentCount, enrolledStudentCount] = await Promise.all([
    hsCollection.find(hsFilter).toArray(),
    orchestraCollection.countDocuments(orchestraFilter),
    studentCollection.countDocuments({ ...baseFilter, isActive: true }),
    studentCollection.countDocuments({
      ...baseFilter,
      isActive: true,
      'teacherAssignments.0': { $exists: true },
    }),
  ]);

  // Distinct teachers from hours_summary
  const teacherIdSet = new Set(hoursDocs.map((d) => d.teacherId));
  const totalWeeklyHours = hoursDocs.reduce((sum, d) => sum + (d.totals?.totalWeeklyHours || 0), 0);

  return {
    teacherCount: teacherIdSet.size,
    totalWeeklyHours,
    avgWeeklyHours: teacherIdSet.size > 0 ? totalWeeklyHours / teacherIdSet.size : 0,
    orchestraCount,
    hoursSummaryCount: hoursDocs.length,
    activeStudentCount,
    enrolledStudentCount,
  };
}

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'שנה נוכחית', value: '-', type: 'string' },
        { label: 'שנת השוואה', value: '-', type: 'string' },
        { label: 'מדדים בשיפור', value: 0, type: 'number' },
        { label: 'מדדים בירידה', value: 0, type: 'number' },
      ],
    },
  };
}
