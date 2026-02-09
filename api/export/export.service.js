/**
 * Export Service
 *
 * Orchestrates Ministry report generation:
 *   1. Ensures hours_summary is up-to-date
 *   2. Loads all data
 *   3. Runs cross-validation
 *   4. Generates mappers → Excel
 *   5. Saves snapshot
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { ministryMappers } from './ministry-mappers.js';
import { excelGenerator } from './excel-generator.js';
import { hoursSummaryService } from '../hours-summary/hours-summary.service.js';
import { roundToQuarterHour } from '../../config/constants.js';

export const exportService = {
  generateFullReport,
  getCompletionStatus,
  crossValidate,
};

/**
 * Generate the full Ministry report package.
 * Returns an Excel buffer + validation results.
 */
async function generateFullReport(tenantId, schoolYearId, userId) {
  // 1. Recalculate all teacher hours (ensure up-to-date)
  await hoursSummaryService.calculateAllTeacherHours(tenantId, schoolYearId);

  // 2. Load all data
  const data = await ministryMappers.loadExportData(tenantId, schoolYearId);

  // 3. Run all mappers
  const teacherRoster = ministryMappers.mapTeacherRoster(data);
  const studentData = ministryMappers.mapStudentData(data);
  const studentEnsembles = ministryMappers.mapStudentEnsembles(data);
  const musicTheory = ministryMappers.mapMusicTheory(data);
  const ensembleSchedule = ministryMappers.mapEnsembleSchedule(data);
  const ensembleSummary = ministryMappers.mapEnsembleSummary(data, ensembleSchedule);

  // 4. Cross-validate
  const validation = runCrossValidation(data, teacherRoster, ensembleSchedule);

  // 5. Generate Excel
  const tenantName = data.tenant?.name || '';
  const buffer = excelGenerator.generateMinistryWorkbook(
    { teacherRoster, studentData, studentEnsembles, musicTheory, ensembleSchedule, ensembleSummary },
    { conservatoryName: tenantName, generatedAt: new Date() }
  );

  // 6. Save snapshot
  const snapshotCollection = await getCollection('ministry_report_snapshots');
  const snapshot = {
    tenantId: tenantId || null,
    reportType: 'full_package',
    schoolYearId: schoolYearId || null,
    generatedBy: userId || null,
    generatedAt: new Date(),
    completionPercentage: calculateCompletionPercentage(data),
    validation,
    data: {
      teacherCount: teacherRoster.length,
      studentCount: studentData.length,
      orchestraCount: ensembleSchedule.length,
      theoryCategories: musicTheory.length - 3, // exclude summary rows
    },
  };
  await snapshotCollection.insertOne(snapshot);

  return { buffer, validation, snapshot };
}

// ─── Cross-Validation ────────────────────────────────────────────────────────

function runCrossValidation(data, teacherRosterRows, ensembleScheduleRows) {
  const warnings = [];
  const errors = [];

  // Rule 1: Total ensemble hours from teacher roster = total from ensemble schedule
  let teacherEnsembleTotal = 0;
  for (const row of teacherRosterRows) {
    const val = row['ש"ש הרכבים בפועל'];
    if (typeof val === 'number') teacherEnsembleTotal += val;
  }

  let scheduleEnsembleTotal = 0;
  for (const row of ensembleScheduleRows) {
    const val = row['סה"כ ש"ש בפועל'];
    if (typeof val === 'number') scheduleEnsembleTotal += val;
  }

  teacherEnsembleTotal = roundToQuarterHour(teacherEnsembleTotal);
  scheduleEnsembleTotal = roundToQuarterHour(scheduleEnsembleTotal);

  if (teacherEnsembleTotal !== scheduleEnsembleTotal) {
    warnings.push({
      type: 'hours_mismatch',
      message: `ש"ש הרכבים ממצבת מורים (${teacherEnsembleTotal}) ≠ מלוח הרכבים (${scheduleEnsembleTotal})`,
      teacherTotal: teacherEnsembleTotal,
      scheduleTotal: scheduleEnsembleTotal,
    });
  }

  // Rule 2: Every ensemble has a conductor
  for (const orch of data.orchestras) {
    if (!orch.conductorId) {
      warnings.push({
        type: 'missing_conductor',
        message: `להרכב "${orch.name}" אין מנצח/מדריך מוגדר`,
        orchestraId: orch._id.toString(),
      });
    }
  }

  // Rule 3: Every conductor has orchestras
  const conductorIds = new Set(data.orchestras.map((o) => o.conductorId).filter(Boolean));
  for (const teacher of data.teachers) {
    const tid = teacher._id.toString();
    const hasConductorRole = (teacher.roles || []).includes('מנצח') || (teacher.roles || []).includes('מדריך הרכב');
    const conductsOrchestras = conductorIds.has(tid);
    if (hasConductorRole && !conductsOrchestras) {
      warnings.push({
        type: 'conductor_no_orchestras',
        message: `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''} מוגדר כמנצח/מדריך אך אינו מנצח על אף הרכב`,
        teacherId: tid,
      });
    }
  }

  // Rule 4: Each teacher's total = sum of parts
  for (const row of teacherRosterRows) {
    const total = row['סה"כ ש"ש'];
    if (typeof total !== 'number') continue;

    const parts =
      (typeof row['ש"ש הוראה'] === 'number' ? row['ש"ש הוראה'] : 0) +
      (typeof row['ש"ש ליווי פסנתר'] === 'number' ? row['ש"ש ליווי פסנתר'] : 0) +
      (typeof row['ש"ש ריכוז'] === 'number' ? row['ש"ש ריכוז'] : 0) +
      (typeof row['ש"ש תאוריה'] === 'number' ? row['ש"ש תאוריה'] : 0) +
      (typeof row['ש"ש הרכבים בפועל'] === 'number' ? row['ש"ש הרכבים בפועל'] : 0) +
      (typeof row['ש"ש ריכוז הרכבים'] === 'number' ? row['ש"ש ריכוז הרכבים'] : 0);

    const partsRounded = roundToQuarterHour(parts);
    if (partsRounded !== total) {
      warnings.push({
        type: 'teacher_total_mismatch',
        message: `סה"כ ש"ש של ${row['שם פרטי']} ${row['שם משפחה']} (${total}) ≠ סכום חלקים (${partsRounded})`,
      });
    }
  }

  return { warnings, errors, isValid: errors.length === 0 };
}

async function crossValidate(tenantId, schoolYearId) {
  const data = await ministryMappers.loadExportData(tenantId, schoolYearId);
  const teacherRoster = ministryMappers.mapTeacherRoster(data);
  const ensembleSchedule = ministryMappers.mapEnsembleSchedule(data);
  return runCrossValidation(data, teacherRoster, ensembleSchedule);
}

// ─── Completion Status ───────────────────────────────────────────────────────

async function getCompletionStatus(tenantId, schoolYearId) {
  const data = await ministryMappers.loadExportData(tenantId, schoolYearId);
  const pct = calculateCompletionPercentage(data);
  const missing = findMissingData(data);

  return {
    completionPercentage: pct,
    missing,
    counts: {
      teachers: data.teachers.length,
      students: data.students.length,
      orchestras: data.orchestras.length,
      theoryLessons: data.theoryLessons.length,
      hoursSummaries: data.hoursSummaries.length,
    },
  };
}

function calculateCompletionPercentage(data) {
  let filled = 0;
  let total = 0;

  // Teacher required fields
  const teacherFields = [
    'personalInfo.firstName', 'personalInfo.lastName', 'personalInfo.idNumber',
    'personalInfo.birthYear', 'professionalInfo.classification', 'professionalInfo.degree',
    'professionalInfo.instruments',
  ];

  for (const t of data.teachers) {
    for (const path of teacherFields) {
      total++;
      const val = path.split('.').reduce((o, k) => o?.[k], t);
      if (val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)) {
        filled++;
      }
    }
  }

  // Student required fields
  const studentFields = [
    'personalInfo.firstName', 'personalInfo.lastName',
    'academicInfo.class', 'academicInfo.studyYears',
  ];

  for (const s of data.students) {
    for (const path of studentFields) {
      total++;
      const val = path.split('.').reduce((o, k) => o?.[k], s);
      if (val !== null && val !== undefined && val !== '') filled++;
    }
    // instrumentProgress must have at least one entry
    total++;
    if ((s.academicInfo?.instrumentProgress || []).length > 0) filled++;
  }

  // Orchestra required fields
  for (const o of data.orchestras) {
    total++;
    if (o.conductorId) filled++;
    total++;
    if (o.subType) filled++;
  }

  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function findMissingData(data) {
  const missing = [];

  for (const t of data.teachers) {
    const name = `${t.personalInfo?.firstName || ''} ${t.personalInfo?.lastName || ''}`.trim();
    if (!t.personalInfo?.idNumber) missing.push({ type: 'teacher', name, field: 'מספר זהות' });
    if (!t.personalInfo?.birthYear) missing.push({ type: 'teacher', name, field: 'שנת לידה' });
    if (!t.professionalInfo?.classification) missing.push({ type: 'teacher', name, field: 'סיווג' });
    if (!t.professionalInfo?.degree) missing.push({ type: 'teacher', name, field: 'תואר' });
    if (!(t.professionalInfo?.instruments || []).length) missing.push({ type: 'teacher', name, field: 'כלי נגינה' });
  }

  for (const s of data.students) {
    const name = `${s.personalInfo?.firstName || ''} ${s.personalInfo?.lastName || ''}`.trim();
    if (!s.academicInfo?.class) missing.push({ type: 'student', name, field: 'כיתה' });
    if (s.academicInfo?.studyYears == null) missing.push({ type: 'student', name, field: 'שנות לימוד' });
  }

  for (const o of data.orchestras) {
    if (!o.conductorId) missing.push({ type: 'orchestra', name: o.name, field: 'מנצח/מדריך' });
    if (!o.subType) missing.push({ type: 'orchestra', name: o.name, field: 'סוג משנה' });
  }

  return missing;
}
