/**
 * Export Service — Mimshak2025
 *
 * Orchestrates Ministry report generation:
 *   1. Pre-export validation (row limits, unmapped instruments/ensembles)
 *   2. Ensures hours_summary is up-to-date
 *   3. Loads all data
 *   4. Runs mappers
 *   5. Generates 12-sheet Excel via ExcelJS
 *   6. Saves snapshot
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ministryMappers } from './ministry-mappers.js';
import { excelGenerator } from './excel-generator.js';
import { hoursSummaryService } from '../hours-summary/hours-summary.service.js';
import { roundToQuarterHour } from '../../config/constants.js';
import {
  ROW_LIMITS,
  INSTRUMENT_TO_MINISTRY,
  ENSEMBLE_TO_COLUMN,
} from './sheets/_shared.js';

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

  // 3. Pre-export validation (row limits + unmapped data)
  const preValidation = runPreExportValidation(data);
  if (preValidation.errors.length > 0) {
    const err = new Error(preValidation.errors.map((e) => e.message).join('; '));
    err.status = 400;
    err.validationErrors = preValidation.errors;
    throw err;
  }

  // 4. Run all mappers
  const teacherRoster = ministryMappers.mapTeacherRoster(data);
  const studentFull = ministryMappers.mapStudentFull(data);
  const ensembleSchedule = ministryMappers.mapEnsembleSchedule(data);
  const musicTheory = ministryMappers.mapMusicTheory(data);

  const mappedData = { teacherRoster, studentFull, ensembleSchedule, musicTheory };

  // 5. Cross-validate
  const validation = runCrossValidation(data, teacherRoster, ensembleSchedule);
  // Merge pre-export warnings
  validation.warnings.push(...preValidation.warnings);

  // 6. Generate Excel (async — ExcelJS writeBuffer is async)
  const tenantName = data.tenant?.name || '';
  const buffer = await excelGenerator.generateMinistryWorkbook({
    data,
    mappedData,
    metadata: { conservatoryName: tenantName, generatedAt: new Date() },
  });

  // 7. Save snapshot
  const snapshotCollection = await getCollection('ministry_report_snapshots');
  const snapshot = {
    tenantId: tenantId || null,
    reportType: 'full_package',
    schoolYearId: schoolYearId || null,
    generatedBy: userId || null,
    generatedAt: new Date(),
    conservatoryName: tenantName,
    completionPercentage: calculateCompletionPercentage(data),
    validation,
    data: {
      teacherCount: teacherRoster.length,
      studentCount: studentFull.length,
      orchestraCount: ensembleSchedule.length,
      theoryCategories: musicTheory.length,
    },
  };
  await snapshotCollection.insertOne(snapshot);

  return { buffer, validation, snapshot };
}

// ─── Pre-Export Validation ────────────────────────────────────────────────────

function runPreExportValidation(data) {
  const warnings = [];
  const errors = [];

  // Row limit validation
  if (data.students.length > ROW_LIMITS.STUDENT_MAX) {
    errors.push({
      type: 'row_limit_students',
      message: `מספר התלמידים חורג מהפורמט של המשרד (מקסימום ${ROW_LIMITS.STUDENT_MAX}, נמצאו ${data.students.length}). פנה לתמיכה.`,
    });
  }

  if (data.teachers.length > ROW_LIMITS.TEACHER_MAX) {
    errors.push({
      type: 'row_limit_teachers',
      message: `מספר המורים חורג מהפורמט של המשרד (מקסימום ${ROW_LIMITS.TEACHER_MAX}, נמצאו ${data.teachers.length}). פנה לתמיכה.`,
    });
  }

  // Unmapped instrument validation
  const studentsWithInstrument = data.students.filter((s) => {
    const progress = (s.academicInfo?.instrumentProgress || []);
    const primary = progress.find((p) => p.isPrimary) || progress[0];
    return primary?.instrumentName;
  });

  const unmappedInstrStudents = studentsWithInstrument.filter((s) => {
    const progress = (s.academicInfo?.instrumentProgress || []);
    const primary = progress.find((p) => p.isPrimary) || progress[0];
    return !INSTRUMENT_TO_MINISTRY[primary.instrumentName];
  });

  if (unmappedInstrStudents.length > 0) {
    const pct = ((unmappedInstrStudents.length / Math.max(data.students.length, 1)) * 100).toFixed(1);
    if (parseFloat(pct) > 5) {
      errors.push({
        type: 'unmapped_instruments',
        message: `${unmappedInstrStudents.length} תלמידים (${pct}%) עם כלי נגינה לא ממופים. יש לעדכן את מיפוי הכלים.`,
        unmappedInstruments: [...new Set(unmappedInstrStudents.map((s) => {
          const p = (s.academicInfo?.instrumentProgress || []);
          return (p.find((x) => x.isPrimary) || p[0])?.instrumentName;
        }))],
      });
    } else {
      warnings.push({
        type: 'unmapped_instruments',
        message: `${unmappedInstrStudents.length} תלמידים עם כלי נגינה לא ממופים דולגו.`,
      });
    }
  }

  // Unmapped ensemble subType validation
  const ensemblesWithSubType = data.orchestras.filter((e) => e.subType);
  const unmappedEnsembles = ensemblesWithSubType.filter((e) => !ENSEMBLE_TO_COLUMN[e.subType]);

  if (unmappedEnsembles.length > 0) {
    const pct = ((unmappedEnsembles.length / Math.max(data.orchestras.length, 1)) * 100).toFixed(1);
    if (parseFloat(pct) > 5) {
      errors.push({
        type: 'unmapped_ensembles',
        message: `${unmappedEnsembles.length} הרכבים (${pct}%) עם סוג משנה לא ממופה. יש לעדכן את מיפוי ההרכבים.`,
        unmappedSubTypes: [...new Set(unmappedEnsembles.map((e) => e.subType))],
      });
    } else {
      warnings.push({
        type: 'unmapped_ensembles',
        message: `${unmappedEnsembles.length} הרכבים עם סוג משנה לא ממופה דולגו.`,
      });
    }
  }

  return { warnings, errors };
}

// ─── Cross-Validation ────────────────────────────────────────────────────────

function runCrossValidation(data, teacherRosterRows, ensembleScheduleRows) {
  const warnings = [];
  const errors = [];

  // Rule 1: Total ensemble hours from teacher roster = total from ensemble schedule
  let teacherEnsembleTotal = 0;
  for (const row of teacherRosterRows) {
    const val = row.ensembleActualHours;
    if (typeof val === 'number') teacherEnsembleTotal += val;
  }

  let scheduleEnsembleTotal = 0;
  for (const row of ensembleScheduleRows) {
    const val = row.totalActualHours;
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
    const total = row.totalWeeklyHours;
    if (typeof total !== 'number') continue;

    const parts =
      (typeof row.teachingHours === 'number' ? row.teachingHours : 0) +
      (typeof row.accompHours === 'number' ? row.accompHours : 0) +
      (typeof row.ensembleActualHours === 'number' ? row.ensembleActualHours : 0) +
      (typeof row.ensembleCoordHours === 'number' ? row.ensembleCoordHours : 0) +
      (typeof row.theoryHours === 'number' ? row.theoryHours : 0) +
      (typeof row.managementHours === 'number' ? row.managementHours : 0);

    const partsRounded = roundToQuarterHour(parts);
    if (partsRounded !== total) {
      warnings.push({
        type: 'teacher_total_mismatch',
        message: `סה"כ ש"ש של ${row.firstName} ${row.lastName} (${total}) ≠ סכום חלקים (${partsRounded})`,
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

  // Pre-export validation for warnings
  const preValidation = runPreExportValidation(data);

  return {
    completionPercentage: pct,
    missing,
    preExportWarnings: preValidation.warnings,
    preExportErrors: preValidation.errors,
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

  // Tenant profile fields
  const profileFields = [
    'conservatoryProfile.code', 'conservatoryProfile.ownershipName',
    'conservatoryProfile.status', 'conservatoryProfile.stage',
  ];
  if (data.tenant) {
    for (const path of profileFields) {
      total++;
      const val = path.split('.').reduce((o, k) => o?.[k], data.tenant);
      if (val !== null && val !== undefined && val !== '') filled++;
    }
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

  // Tenant profile
  if (data.tenant) {
    const cp = data.tenant.conservatoryProfile;
    if (!cp?.code) missing.push({ type: 'tenant', name: data.tenant.name, field: 'קוד קונסרבטוריון' });
    if (!cp?.ownershipName) missing.push({ type: 'tenant', name: data.tenant.name, field: 'שם בעלות' });
  }

  return missing;
}
