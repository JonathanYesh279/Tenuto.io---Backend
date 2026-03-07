/**
 * Dashboard KPI Service
 *
 * Computes KPI cards with trend indicators and anomaly alerts
 * for the admin dashboard overview.
 *
 * Data sources: student, teacher, orchestra, hours_summary, import_log, school_year
 */

import { ObjectId } from 'mongodb';

/**
 * Valid drillTo targets — these MUST stay in sync with registered generator IDs
 * in api/reports/generators/*.generator.js. If a generator ID changes, update
 * the corresponding drillTo value in the KPI_DEFINITIONS below and ALERTS.
 */
const VALID_DRILL_TARGETS = [
  'student-enrollment',
  'teacher-roster',
  'teacher-hours-summary',
  'orchestra-participation',
  'student-teacher-assignments',
  'data-quality',
  'import-history',
];

/**
 * Builds the dashboard KPI response with trend data and alerts.
 *
 * @param {object} scope - Report scope from buildReportScope ({ type, tenantId })
 * @param {string} schoolYearId - Current school year ID
 * @param {{ services: { getCollection: Function } }} options
 * @returns {Promise<{ kpis: object[], alerts: object[] }>}
 */
export async function buildDashboard(scope, schoolYearId, { services }) {
  // Dashboard is admin-only; handle 'own' scope gracefully
  if (scope.type === 'own') {
    return { kpis: [], alerts: [] };
  }

  const { getCollection } = services;
  const tenantId = scope.tenantId;

  // --- Fetch collections ---
  const [studentCol, teacherCol, orchestraCol, hoursSummaryCol, importLogCol, schoolYearCol] =
    await Promise.all([
      getCollection('student'),
      getCollection('teacher'),
      getCollection('orchestra'),
      getCollection('hours_summary'),
      getCollection('import_log'),
      getCollection('school_year'),
    ]);

  // --- Find previous school year for trend calculation ---
  const previousYearId = await findPreviousSchoolYear(schoolYearCol, tenantId, schoolYearId);

  // --- Compute current metrics ---
  const currentMetrics = await computeMetrics(
    { studentCol, teacherCol, orchestraCol, hoursSummaryCol },
    tenantId,
    schoolYearId
  );

  // --- Compute previous metrics for trends ---
  let previousMetrics = null;
  if (previousYearId) {
    previousMetrics = await computeMetrics(
      { studentCol, teacherCol, orchestraCol, hoursSummaryCol },
      tenantId,
      previousYearId
    );
  }

  // --- Build KPI cards ---
  const kpis = [
    buildKpi('activeStudents', 'תלמידים פעילים', currentMetrics.activeStudents, 'count', previousMetrics?.activeStudents, 'student-enrollment'),
    buildKpi('activeTeachers', 'מורים פעילים', currentMetrics.activeTeachers, 'count', previousMetrics?.activeTeachers, 'teacher-roster'),
    buildKpi('totalWeeklyHours', 'שעות שבועיות', currentMetrics.totalWeeklyHours, 'hours', previousMetrics?.totalWeeklyHours, 'teacher-hours-summary'),
    buildKpi('orchestraCount', 'הרכבים', currentMetrics.orchestraCount, 'count', previousMetrics?.orchestraCount, 'orchestra-participation'),
    buildKpi('assignmentRate', 'אחוז שיבוץ', currentMetrics.assignmentRate, 'percentage', previousMetrics?.assignmentRate, 'student-teacher-assignments'),
    buildKpi('dataQualityScore', 'ציון איכות נתונים', currentMetrics.dataQualityScore, 'score', previousMetrics?.dataQualityScore, 'data-quality'),
  ];

  // --- Build alerts ---
  const alerts = buildAlerts(currentMetrics, importLogCol, tenantId);
  const resolvedAlerts = await alerts;

  return { kpis, alerts: resolvedAlerts };
}

/**
 * Finds the previous school year for trend comparison.
 */
async function findPreviousSchoolYear(schoolYearCol, tenantId, currentYearId) {
  if (!currentYearId) return null;

  try {
    const years = await schoolYearCol
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .toArray();

    const currentIndex = years.findIndex(
      (y) => y._id.toString() === currentYearId.toString()
    );

    if (currentIndex < 0 || currentIndex >= years.length - 1) return null;

    return years[currentIndex + 1]._id.toString();
  } catch {
    return null;
  }
}

/**
 * Computes all metric values for a given school year.
 */
async function computeMetrics(collections, tenantId, schoolYearId) {
  const { studentCol, teacherCol, orchestraCol, hoursSummaryCol } = collections;
  const tenantFilter = { tenantId, isActive: true };

  // Run independent queries in parallel
  const [
    activeStudents,
    activeTeachers,
    totalWeeklyHoursResult,
    orchestraCount,
    studentsForAssignment,
    unassignedStudentCount,
    idleTeacherData,
  ] = await Promise.all([
    // 1. Active students count
    studentCol.countDocuments(tenantFilter),

    // 2. Active teachers count
    teacherCol.countDocuments(tenantFilter),

    // 3. Total weekly hours from hours_summary
    hoursSummaryCol
      .aggregate([
        { $match: { tenantId, schoolYearId } },
        { $group: { _id: null, total: { $sum: '$totals.totalWeeklyHours' } } },
      ])
      .toArray(),

    // 4. Orchestra count (year-scoped)
    orchestraCol.countDocuments({ tenantId, schoolYearId }),

    // 5. Active students count for assignment rate
    studentCol.countDocuments(tenantFilter),

    // 6. Students without assignments
    studentCol.countDocuments({
      ...tenantFilter,
      $or: [
        { teacherAssignments: { $exists: false } },
        { teacherAssignments: { $size: 0 } },
      ],
    }),

    // 7. Idle teachers: teachers not referenced in any student's teacherAssignments
    getIdleTeacherCount(studentCol, teacherCol, tenantId),
  ]);

  const totalWeeklyHours = totalWeeklyHoursResult[0]?.total || 0;

  // Assignment rate
  const assignedStudents = activeStudents - unassignedStudentCount;
  const assignmentRate =
    activeStudents > 0
      ? Math.round((assignedStudents / activeStudents) * 1000) / 10
      : 0;

  // Data quality score: 100 - high-severity anomalies (unassigned students + idle teachers)
  const highSeverityCount = unassignedStudentCount + idleTeacherData;
  const dataQualityScore = Math.max(0, 100 - highSeverityCount);

  return {
    activeStudents,
    activeTeachers,
    totalWeeklyHours,
    orchestraCount,
    assignmentRate,
    dataQualityScore,
    // Additional data for alerts
    _unassignedStudentCount: unassignedStudentCount,
    _idleTeacherCount: idleTeacherData,
  };
}

/**
 * Counts teachers who have no students assigned to them.
 */
async function getIdleTeacherCount(studentCol, teacherCol, tenantId) {
  // Get all assigned teacher IDs from students
  const assignedTeacherIds = await studentCol
    .aggregate([
      { $match: { tenantId, isActive: true } },
      { $unwind: '$teacherAssignments' },
      { $group: { _id: null, ids: { $addToSet: '$teacherAssignments.teacherId' } } },
    ])
    .toArray();

  const assignedIds = new Set(
    (assignedTeacherIds[0]?.ids || []).map((id) => id.toString())
  );

  const totalTeachers = await teacherCol.countDocuments({ tenantId, isActive: true });
  return totalTeachers - assignedIds.size;
}

/**
 * Builds a single KPI card object.
 */
function buildKpi(id, label, value, unit, previousValue, drillTo) {
  return {
    id,
    label,
    value,
    unit,
    trend: computeTrend(value, previousValue),
    drillTo,
  };
}

/**
 * Computes trend delta and direction.
 */
function computeTrend(current, previous) {
  if (previous === null || previous === undefined) return null;

  if (previous === 0 && current === 0) {
    return { delta: 0, direction: 'stable' };
  }

  if (previous === 0) {
    return { delta: 100, direction: 'up' };
  }

  const delta = Math.round(((current - previous) / previous) * 1000) / 10;
  let direction;

  if (Math.abs(delta) < 1) {
    direction = 'stable';
  } else if (delta > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return { delta, direction };
}

/**
 * Builds alert array based on current metrics and import history.
 */
async function buildAlerts(metrics, importLogCol, tenantId) {
  const alerts = [];

  // Idle teachers
  if (metrics._idleTeacherCount > 0) {
    alerts.push({
      id: 'idle-teachers',
      type: 'idle-teachers',
      severity: 'warning',
      message: `${metrics._idleTeacherCount} מורים ללא תלמידים`,
      drillTo: 'data-quality',
    });
  }

  // Unassigned students
  if (metrics._unassignedStudentCount > 0) {
    alerts.push({
      id: 'unassigned-students',
      type: 'unassigned-students',
      severity: 'warning',
      message: `${metrics._unassignedStudentCount} תלמידים ללא שיבוץ`,
      drillTo: 'data-quality',
    });
  }

  // Stale imports
  try {
    const latestImport = await importLogCol
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (latestImport.length === 0 || latestImport[0].createdAt < thirtyDaysAgo) {
      alerts.push({
        id: 'stale-imports',
        type: 'stale-imports',
        severity: 'info',
        message: 'לא בוצע ייבוא נתונים מעל 30 יום',
        drillTo: 'import-history',
      });
    }
  } catch {
    // If import_log collection doesn't exist, skip alert
  }

  // Low data quality
  if (metrics.dataQualityScore < 80) {
    alerts.push({
      id: 'low-data-quality',
      type: 'low-data-quality',
      severity: 'warning',
      message: `ציון איכות נתונים נמוך: ${metrics.dataQualityScore}`,
      drillTo: 'data-quality',
    });
  }

  return alerts;
}
