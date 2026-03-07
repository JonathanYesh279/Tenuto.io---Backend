import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import {
  DEFAULT_ATTENDANCE_ALERT_SETTINGS,
  MINISTRY_PRESENT_STATUSES,
  COLLECTIONS,
} from '../../config/constants.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('attendanceAlert.service');

export const attendanceAlertService = {
  getTenantAlertSettings,
  evaluateFlaggedStudents,
  getAttendanceDashboard,
  getStudentAttendanceSummary,
};

/**
 * Get the attendance alert settings for a tenant.
 * Falls back to DEFAULT_ATTENDANCE_ALERT_SETTINGS if not configured.
 */
async function getTenantAlertSettings(tenantId) {
  const tid = requireTenantId(tenantId);
  const tenantCol = await getCollection(COLLECTIONS.TENANT);
  const tenant = await tenantCol.findOne(
    { _id: ObjectId.createFromHexString(tid) },
    { projection: { 'settings.attendanceAlerts': 1 } }
  );

  if (!tenant) {
    throw new Error(`Tenant with id ${tid} not found`);
  }

  return tenant.settings?.attendanceAlerts || { ...DEFAULT_ATTENDANCE_ALERT_SETTINGS };
}

/**
 * Evaluate flagged students for a specific orchestra based on attendance thresholds.
 * Returns only students that have at least one flag.
 */
async function evaluateFlaggedStudents(orchestraId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  // Get orchestra to retrieve memberIds
  const orchestraCol = await getCollection(COLLECTIONS.ORCHESTRA);
  const orchestra = await orchestraCol.findOne({
    _id: ObjectId.createFromHexString(orchestraId),
    tenantId,
  });

  if (!orchestra) {
    throw new Error(`Orchestra with id ${orchestraId} not found`);
  }

  const memberIds = orchestra.memberIds || [];
  if (memberIds.length === 0) {
    return [];
  }

  // Get alert settings
  const settings = await getTenantAlertSettings(tenantId);
  if (!settings.isEnabled) {
    return [];
  }

  // Fetch attendance records for all members in this orchestra
  const activityCol = await getCollection(COLLECTIONS.ACTIVITY_ATTENDANCE);
  const records = await activityCol
    .find({
      groupId: orchestraId,
      studentId: { $in: memberIds },
      tenantId,
      isArchived: { $ne: true },
    })
    .sort({ date: -1 })
    .toArray();

  // Group records by studentId
  const recordsByStudent = {};
  for (const record of records) {
    if (!recordsByStudent[record.studentId]) {
      recordsByStudent[record.studentId] = [];
    }
    recordsByStudent[record.studentId].push(record);
  }

  // Batch-fetch student names
  const studentCol = await getCollection(COLLECTIONS.STUDENT);
  const studentDocs = await studentCol
    .find(
      {
        _id: { $in: memberIds.map(id => ObjectId.createFromHexString(id)) },
        tenantId,
      },
      { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } }
    )
    .toArray();

  const studentNameMap = {};
  for (const s of studentDocs) {
    studentNameMap[s._id.toString()] =
      `${s.personalInfo?.firstName || ''} ${s.personalInfo?.lastName || ''}`.trim() || 'Unknown';
  }

  // Evaluate each member
  const flagged = [];
  for (const studentId of memberIds) {
    const studentRecords = recordsByStudent[studentId] || [];
    const totalRehearsals = studentRecords.length;

    // Calculate consecutive absences (from most recent)
    let consecutiveAbsences = 0;
    for (const record of studentRecords) {
      if (!MINISTRY_PRESENT_STATUSES.includes(record.status)) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }

    // Calculate absence rate
    const absentCount = studentRecords.filter(
      r => !MINISTRY_PRESENT_STATUSES.includes(r.status)
    ).length;
    const absenceRate =
      totalRehearsals > 0 ? Math.round((absentCount / totalRehearsals) * 100 * 100) / 100 : 0;
    const attendanceRate =
      totalRehearsals > 0 ? Math.round(((totalRehearsals - absentCount) / totalRehearsals) * 100 * 100) / 100 : 100;

    // Check flag conditions
    const flags = [];

    // Flag 1: consecutive absences
    if (consecutiveAbsences >= settings.consecutiveAbsences) {
      flags.push({
        reason: 'consecutive_absences',
        value: consecutiveAbsences,
        threshold: settings.consecutiveAbsences,
      });
    }

    // Flag 2: high absence rate (only if enough rehearsals)
    if (
      totalRehearsals >= settings.minimumRehearsals &&
      absenceRate >= settings.absenceRateThreshold
    ) {
      flags.push({
        reason: 'high_absence_rate',
        value: absenceRate,
        threshold: settings.absenceRateThreshold,
      });
    }

    if (flags.length > 0) {
      flagged.push({
        studentId,
        studentName: studentNameMap[studentId] || 'Unknown',
        flags,
        attendanceRate,
        totalRehearsals,
        consecutiveAbsences,
      });
    }
  }

  return flagged;
}

/**
 * Get attendance dashboard with per-orchestra stats, monthly trends,
 * flagged students across all orchestras, and summary.
 */
async function getAttendanceDashboard(options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const { startDate, endDate } = options;

  // Get active orchestras
  const orchestraCol = await getCollection(COLLECTIONS.ORCHESTRA);
  const orchestras = await orchestraCol
    .find({ tenantId, isActive: true })
    .toArray();

  // Build date filter for activity_attendance
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const activityFilter = {
    tenantId,
    isArchived: { $ne: true },
  };
  if (startDate || endDate) {
    activityFilter.date = dateFilter;
  }

  const activityCol = await getCollection(COLLECTIONS.ACTIVITY_ATTENDANCE);

  // Batch-fetch conductor names
  const conductorIds = [...new Set(orchestras.map(o => o.conductorId).filter(Boolean))];
  const teacherCol = await getCollection(COLLECTIONS.TEACHER);
  let conductorMap = {};
  if (conductorIds.length > 0) {
    const conductorDocs = await teacherCol
      .find(
        {
          _id: { $in: conductorIds.map(id => ObjectId.createFromHexString(id)) },
          tenantId,
        },
        { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } }
      )
      .toArray();
    for (const c of conductorDocs) {
      conductorMap[c._id.toString()] =
        `${c.personalInfo?.firstName || ''} ${c.personalInfo?.lastName || ''}`.trim() || 'Unknown';
    }
  }

  // Per-orchestra attendance stats
  const perOrchestra = [];
  const allFlaggedStudents = [];
  const seenStudentIds = new Set();
  let totalStudentsTracked = 0;
  let overallPresent = 0;
  let overallTotal = 0;

  for (const orchestra of orchestras) {
    const orchestraId = orchestra._id.toString();
    const memberCount = (orchestra.memberIds || []).length;

    // Get attendance records for this orchestra
    const orchestraFilter = { ...activityFilter, groupId: orchestraId };
    const records = await activityCol.find(orchestraFilter).toArray();

    const totalRehearsals = new Set(records.map(r => r.sessionId)).size;
    const presentCount = records.filter(r => MINISTRY_PRESENT_STATUSES.includes(r.status)).length;
    const totalRecords = records.length;
    const averageAttendanceRate =
      totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100 * 100) / 100 : 100;

    overallPresent += presentCount;
    overallTotal += totalRecords;

    // Get flagged students for this orchestra
    let flaggedStudentCount = 0;
    try {
      const flagged = await evaluateFlaggedStudents(orchestraId, options);
      flaggedStudentCount = flagged.length;

      for (const fs of flagged) {
        if (!seenStudentIds.has(fs.studentId)) {
          seenStudentIds.add(fs.studentId);
          allFlaggedStudents.push({
            ...fs,
            orchestraName: orchestra.name,
            orchestraId,
          });
        }
      }
    } catch (err) {
      log.warn({ orchestraId, err: err.message }, 'Failed to evaluate flagged students');
    }

    // Track unique students
    for (const mid of orchestra.memberIds || []) {
      if (!seenStudentIds.has(mid)) {
        totalStudentsTracked++;
      }
    }

    perOrchestra.push({
      orchestraId,
      orchestraName: orchestra.name,
      conductorName: conductorMap[orchestra.conductorId] || null,
      totalRehearsals,
      memberCount,
      averageAttendanceRate,
      flaggedStudentCount,
    });
  }

  // Monthly trends (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const trendFilter = {
    tenantId,
    isArchived: { $ne: true },
    date: { $gte: sixMonthsAgo },
  };

  const trendRecords = await activityCol.find(trendFilter).toArray();
  const monthlyBuckets = {};
  for (const record of trendRecords) {
    const monthKey = new Date(record.date).toISOString().substring(0, 7);
    if (!monthlyBuckets[monthKey]) {
      monthlyBuckets[monthKey] = { total: 0, present: 0, sessions: new Set() };
    }
    monthlyBuckets[monthKey].total++;
    if (MINISTRY_PRESENT_STATUSES.includes(record.status)) {
      monthlyBuckets[monthKey].present++;
    }
    monthlyBuckets[monthKey].sessions.add(record.sessionId);
  }

  const monthlyTrends = Object.entries(monthlyBuckets)
    .map(([month, data]) => ({
      month,
      totalSessions: data.sessions.size,
      attendanceRate:
        data.total > 0 ? Math.round((data.present / data.total) * 100 * 100) / 100 : 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const overallAttendanceRate =
    overallTotal > 0
      ? Math.round((overallPresent / overallTotal) * 100 * 100) / 100
      : 100;

  return {
    perOrchestra,
    monthlyTrends,
    flaggedStudents: allFlaggedStudents,
    summary: {
      totalOrchestras: orchestras.length,
      totalStudentsTracked: totalStudentsTracked + seenStudentIds.size,
      overallAttendanceRate,
      totalFlagged: allFlaggedStudents.length,
    },
  };
}

/**
 * Get detailed attendance summary for a single student.
 */
async function getStudentAttendanceSummary(studentId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  const activityCol = await getCollection(COLLECTIONS.ACTIVITY_ATTENDANCE);
  const records = await activityCol
    .find({
      studentId,
      tenantId,
      isArchived: { $ne: true },
    })
    .sort({ date: -1 })
    .toArray();

  const totalSessions = records.length;
  const attendedCount = records.filter(r =>
    MINISTRY_PRESENT_STATUSES.includes(r.status)
  ).length;
  const lateCount = records.filter(r => r.status === 'איחור').length;
  const absentCount = records.filter(r => r.status === 'לא הגיע/ה').length;
  const attendanceRate =
    totalSessions > 0
      ? Math.round((attendedCount / totalSessions) * 100 * 100) / 100
      : 100;

  // Consecutive absences from most recent
  let consecutiveAbsences = 0;
  for (const record of records) {
    if (!MINISTRY_PRESENT_STATUSES.includes(record.status)) {
      consecutiveAbsences++;
    } else {
      break;
    }
  }

  // Recent history (last 10)
  const recentHistory = records.slice(0, 10).map(r => ({
    date: r.date,
    activityType: r.activityType,
    activityName: r.groupId || r.sessionId || null,
    status: r.status,
  }));

  // Evaluate flags for this student
  const settings = await getTenantAlertSettings(tenantId);
  const flags = [];

  if (settings.isEnabled) {
    if (consecutiveAbsences >= settings.consecutiveAbsences) {
      flags.push({
        reason: 'consecutive_absences',
        value: consecutiveAbsences,
        threshold: settings.consecutiveAbsences,
      });
    }

    const absenceRate =
      totalSessions > 0
        ? Math.round((absentCount / totalSessions) * 100 * 100) / 100
        : 0;
    if (
      totalSessions >= settings.minimumRehearsals &&
      absenceRate >= settings.absenceRateThreshold
    ) {
      flags.push({
        reason: 'high_absence_rate',
        value: absenceRate,
        threshold: settings.absenceRateThreshold,
      });
    }
  }

  return {
    studentId,
    attendanceRate,
    totalSessions,
    attended: attendedCount,
    late: lateCount,
    absent: absentCount,
    consecutiveAbsences,
    recentHistory,
    flags,
    alertSettings: {
      consecutiveAbsences: settings.consecutiveAbsences,
      absenceRateThreshold: settings.absenceRateThreshold,
    },
  };
}
