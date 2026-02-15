/**
 * Hours Summary Service
 *
 * Calculates weekly ש"ש (teaching hours) per teacher for Ministry of Education reporting.
 * Pre-computes and caches results in the hours_summary collection.
 *
 * Data sources (all single-source-of-truth):
 *   - Student teacherAssignments → individual lesson hours
 *   - Teacher teaching.timeBlocks → scheduled time blocks
 *   - Teacher managementInfo → management, accompaniment, coordination hours
 *   - Orchestra → conducting/rehearsal hours
 *   - Theory lessons → group teaching hours
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { minutesToWeeklyHours, roundToQuarterHour } from '../../config/constants.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';

export const hoursSummaryService = {
  calculateTeacherHours,
  calculateAllTeacherHours,
  getHoursSummary,
  getHoursSummaryByTeacher,
};

/**
 * Calculate weekly hours for a single teacher and persist to hours_summary.
 */
async function calculateTeacherHours(teacherId, schoolYearId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    const orchestraCollection = await getCollection('orchestra');
    const theoryCollection = await getCollection('theory_lesson');

    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      tenantId,
    });
    if (!teacher) throw new Error(`Teacher ${teacherId} not found`);

    // 1. Individual lesson hours from student teacherAssignments
    const students = await studentCollection
      .find({
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.isActive': true,
        tenantId,
      })
      .toArray();

    let individualMinutes = 0;
    const studentBreakdown = [];

    for (const student of students) {
      const activeAssignments = (student.teacherAssignments || []).filter(
        (a) => a.teacherId === teacherId && a.isActive
      );

      for (const assignment of activeAssignments) {
        const duration = assignment.scheduleInfo?.duration || 45; // default 45 min
        individualMinutes += duration;
        studentBreakdown.push({
          studentId: student._id.toString(),
          studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
          instrument: student.academicInfo?.instrument || '',
          weeklyMinutes: duration,
        });
      }
    }

    // 2. Orchestra / rehearsal hours from conducting
    const conductingOrchestraIds = teacher.conducting?.orchestraIds || [];
    let orchestraMinutes = 0;
    const orchestraBreakdown = [];

    if (conductingOrchestraIds.length > 0) {
      const orchestras = await orchestraCollection
        .find({
          _id: {
            $in: conductingOrchestraIds.map((id) =>
              ObjectId.createFromHexString(id)
            ),
          },
          isActive: true,
          tenantId,
        })
        .toArray();

      for (const orch of orchestras) {
        // Estimate weekly rehearsal minutes from the orchestra schedule
        // Default 90 min per rehearsal, 1x/week
        const weeklyRehearsalMinutes = orch.ministryData?.totalReportingHours
          ? orch.ministryData.totalReportingHours * 60
          : 90;
        orchestraMinutes += weeklyRehearsalMinutes;
        orchestraBreakdown.push({
          orchestraId: orch._id.toString(),
          name: orch.name,
          type: orch.type,
          weeklyMinutes: weeklyRehearsalMinutes,
        });
      }
    }

    // 3. Theory lesson hours
    let theoryMinutes = 0;
    const theoryBreakdown = [];

    // Find distinct theory lessons this teacher teaches in the current school year
    const theoryLessons = await theoryCollection
      .find({
        teacherId,
        tenantId,
        ...(schoolYearId ? { schoolYearId } : {}),
      })
      .toArray();

    // Group by category + dayOfWeek to get unique weekly slots
    const theorySlots = new Map();
    for (const lesson of theoryLessons) {
      const key = `${lesson.category}_${lesson.dayOfWeek}_${lesson.startTime}`;
      if (!theorySlots.has(key)) {
        const startParts = (lesson.startTime || '00:00').split(':').map(Number);
        const endParts = (lesson.endTime || '00:45').split(':').map(Number);
        const duration =
          endParts[0] * 60 + endParts[1] - (startParts[0] * 60 + startParts[1]);
        theorySlots.set(key, {
          category: lesson.category,
          dayOfWeek: lesson.dayOfWeek,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          weeklyMinutes: duration > 0 ? duration : 45,
        });
      }
    }

    for (const slot of theorySlots.values()) {
      theoryMinutes += slot.weeklyMinutes;
      theoryBreakdown.push(slot);
    }

    // 4. Management hours (from teacher.managementInfo)
    const mgmt = teacher.managementInfo || {};
    const managementMinutes = (mgmt.managementHours || 0) * 60;
    const accompMinutes = (mgmt.accompHours || 0) * 60;
    const coordMinutes = (mgmt.ensembleCoordHours || 0) * 60;
    const travelMinutes = (mgmt.travelTimeHours || 0) * 60;

    // 5. Totals
    const totalMinutes =
      individualMinutes +
      orchestraMinutes +
      theoryMinutes +
      managementMinutes +
      accompMinutes +
      coordMinutes +
      travelMinutes;

    const summary = {
      teacherId,
      tenantId,
      schoolYearId: schoolYearId || null,
      calculatedAt: new Date(),
      totals: {
        totalMinutes,
        totalWeeklyHours: roundToQuarterHour(minutesToWeeklyHours(totalMinutes)),
        individualLessons: roundToQuarterHour(minutesToWeeklyHours(individualMinutes)),
        orchestraConducting: roundToQuarterHour(minutesToWeeklyHours(orchestraMinutes)),
        theoryTeaching: roundToQuarterHour(minutesToWeeklyHours(theoryMinutes)),
        management: roundToQuarterHour(minutesToWeeklyHours(managementMinutes)),
        accompaniment: roundToQuarterHour(minutesToWeeklyHours(accompMinutes)),
        ensembleCoordination: roundToQuarterHour(minutesToWeeklyHours(coordMinutes)),
        travelTime: roundToQuarterHour(minutesToWeeklyHours(travelMinutes)),
      },
      breakdown: {
        students: studentBreakdown,
        orchestras: orchestraBreakdown,
        theory: theoryBreakdown,
      },
      teacherInfo: {
        firstName: teacher.personalInfo?.firstName || '',
        lastName: teacher.personalInfo?.lastName || '',
        idNumber: teacher.personalInfo?.idNumber || '',
        classification: teacher.professionalInfo?.classification || '',
        instruments: teacher.professionalInfo?.instruments || [],
      },
    };

    // Persist to hours_summary collection (upsert)
    const hsCollection = await getCollection('hours_summary');
    await hsCollection.updateOne(
      { teacherId, schoolYearId: schoolYearId || null, tenantId },
      { $set: summary },
      { upsert: true }
    );

    return summary;
  } catch (err) {
    console.error(`Error calculating hours for teacher ${teacherId}:`, err.message);
    throw new Error(`Error calculating teacher hours: ${err.message}`);
  }
}

/**
 * Re-calculate hours for all teachers in a tenant/school-year.
 */
async function calculateAllTeacherHours(schoolYearId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  try {
    const teacherCollection = await getCollection('teacher');
    const filter = { isActive: true, tenantId };

    const teachers = await teacherCollection
      .find(filter, { projection: { _id: 1 } })
      .toArray();

    const results = [];
    for (const teacher of teachers) {
      try {
        const summary = await calculateTeacherHours(
          teacher._id.toString(),
          schoolYearId,
          options
        );
        results.push(summary);
      } catch (err) {
        console.error(`Skipping teacher ${teacher._id}: ${err.message}`);
        results.push({ teacherId: teacher._id.toString(), error: err.message });
      }
    }

    return {
      totalTeachers: teachers.length,
      calculated: results.filter((r) => !r.error).length,
      errors: results.filter((r) => r.error).length,
      results,
    };
  } catch (err) {
    console.error('Error calculating all teacher hours:', err.message);
    throw new Error(`Error calculating all teacher hours: ${err.message}`);
  }
}

/**
 * Get cached hours summaries for a tenant/school-year.
 */
async function getHoursSummary(schoolYearId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  try {
    const hsCollection = await getCollection('hours_summary');
    const filter = { tenantId };
    if (schoolYearId) filter.schoolYearId = schoolYearId;

    return await hsCollection.find(filter).sort({ 'teacherInfo.lastName': 1 }).toArray();
  } catch (err) {
    console.error('Error getting hours summary:', err.message);
    throw new Error(`Error getting hours summary: ${err.message}`);
  }
}

/**
 * Get cached hours summary for a specific teacher.
 */
async function getHoursSummaryByTeacher(teacherId, schoolYearId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  try {
    const hsCollection = await getCollection('hours_summary');
    const filter = { teacherId, tenantId };
    if (schoolYearId) filter.schoolYearId = schoolYearId;

    return await hsCollection.findOne(filter);
  } catch (err) {
    console.error(`Error getting hours for teacher ${teacherId}:`, err.message);
    throw new Error(`Error getting teacher hours: ${err.message}`);
  }
}
