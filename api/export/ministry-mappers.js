/**
 * Ministry of Education Data Mappers — Mimshak2025
 *
 * Transforms DB data into structured data objects with English keys.
 * Sheet builders handle Hebrew labels, positioning, and formatting.
 *
 * Mappers:
 *   1. mapTeacherRoster — teacher data + hours + instruments + subjects
 *   2. mapStudentFull — merged student data + department + ensembles
 *   3. mapEnsembleSchedule — ensemble schedule with rehearsal slots
 *   4. mapMusicTheory — theory categories with counts
 */

import { getCollection } from '../../services/mongoDB.service.js';
import {
  INSTRUMENT_MAP,
  minutesToWeeklyHours,
  roundToQuarterHour,
  stageToMinistryLevel,
} from '../../config/constants.js';
import {
  INSTRUMENT_TO_MINISTRY,
  ENSEMBLE_TO_COLUMN,
  composeName,
  timeDiffMinutes,
} from './sheets/_shared.js';

export const ministryMappers = {
  loadExportData,
  mapTeacherRoster,
  mapStudentFull,
  mapEnsembleSchedule,
  mapMusicTheory,
};

// ─── Shared Data Loader ──────────────────────────────────────────────────────

async function loadExportData(tenantId, schoolYearId) {
  const [
    teacherCollection,
    studentCollection,
    orchestraCollection,
    rehearsalCollection,
    theoryCollection,
    hoursSummaryCollection,
    tenantCollection,
  ] = await Promise.all([
    getCollection('teacher'),
    getCollection('student'),
    getCollection('orchestra'),
    getCollection('rehearsal'),
    getCollection('theory_lesson'),
    getCollection('hours_summary'),
    getCollection('tenant'),
  ]);

  const tenantFilter = tenantId ? { tenantId } : {};
  const syFilter = schoolYearId ? { schoolYearId } : {};

  const [teachers, students, orchestras, rehearsals, theoryLessons, hoursSummaries, tenant] =
    await Promise.all([
      teacherCollection.find({ isActive: true, ...tenantFilter }).sort({ 'personalInfo.lastName': 1 }).toArray(),
      studentCollection.find({ isActive: true, ...tenantFilter }).sort({ 'personalInfo.lastName': 1 }).toArray(),
      orchestraCollection.find({ isActive: true, ...tenantFilter, ...syFilter }).toArray(),
      rehearsalCollection.find({ isActive: true, ...tenantFilter, ...syFilter }).toArray(),
      theoryCollection.find({ isActive: true, ...tenantFilter, ...syFilter }).toArray(),
      hoursSummaryCollection.find({ ...tenantFilter, ...(schoolYearId ? { schoolYearId } : {}) }).toArray(),
      tenantId ? tenantCollection.findOne({ tenantId }) : null,
    ]);

  // Build lookup maps
  const teacherMap = new Map(teachers.map((t) => [t._id.toString(), t]));
  const orchestraMap = new Map(orchestras.map((o) => [o._id.toString(), o]));
  const hoursSummaryMap = new Map(hoursSummaries.map((h) => [h.teacherId, h]));

  // Group rehearsals by orchestraId (groupId)
  const rehearsalsByOrchestra = new Map();
  for (const r of rehearsals) {
    const key = r.groupId || r.orchestraId;
    if (!rehearsalsByOrchestra.has(key)) rehearsalsByOrchestra.set(key, []);
    rehearsalsByOrchestra.get(key).push(r);
  }

  // Build student → orchestra membership map
  const studentOrchestraMap = new Map();
  for (const s of students) {
    const oids = s.enrollments?.orchestraIds || [];
    studentOrchestraMap.set(s._id.toString(), oids);
  }

  return {
    teachers,
    students,
    orchestras,
    rehearsals,
    theoryLessons,
    hoursSummaries,
    tenant,
    teacherMap,
    orchestraMap,
    hoursSummaryMap,
    rehearsalsByOrchestra,
    studentOrchestraMap,
  };
}

// ─── Sheet 3: Teacher Roster ─────────────────────────────────────────────────

function mapTeacherRoster(data) {
  const { teachers, hoursSummaryMap } = data;
  const rows = [];

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const tid = t._id.toString();
    const hs = hoursSummaryMap.get(tid);
    const pi = t.personalInfo || {};
    const prof = t.professionalInfo || {};
    const mgmt = t.managementInfo || {};

    // Hours from hours_summary (single source of truth)
    const teachingHours = hs?.totals?.individualLessons ?? null;
    const accompHours = hs?.totals?.accompaniment ?? mgmt.accompHours ?? null;
    const ensembleActualHours = hs?.totals?.orchestraConducting ?? null;
    const ensembleCoordHours = hs?.totals?.ensembleCoordination ?? mgmt.ensembleCoordHours ?? null;
    const theoryHours = hs?.totals?.theoryTeaching ?? null;
    const managementHours = mgmt.managementHours ?? null;
    const travelTimeHours = hs?.totals?.travelTime ?? mgmt.travelTimeHours ?? null;

    // Calculate total (sum of parts, excluding travel time)
    const parts = [teachingHours, accompHours, ensembleActualHours, ensembleCoordHours, theoryHours, managementHours];
    const totalWeeklyHours = parts.some((v) => typeof v === 'number')
      ? roundToQuarterHour(parts.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0))
      : null;

    // Instrument boolean map (abbreviation -> true/false)
    const teacherInstruments = prof.instruments || [];
    const instrumentBooleans = {};
    for (const inst of INSTRUMENT_MAP) {
      instrumentBooleans[inst.abbreviation] = teacherInstruments.includes(inst.name);
    }

    // Teaching subjects + roles
    const subjects = prof.teachingSubjects || [];
    const roles = t.roles || [];

    rows.push({
      index: i + 1,
      lastName: pi.lastName || '',
      firstName: pi.firstName || '',
      idNumber: pi.idNumber || '',
      birthYear: pi.birthYear || '',
      classification: prof.classification || '',
      degree: prof.degree || '',
      hasTeachingCertificate: prof.hasTeachingCertificate ? 'כן' : 'לא',
      seniorityYears: prof.teachingExperienceYears ?? '',
      unionMember: prof.isUnionMember ? 'כן' : 'לא',
      phone: pi.phone || '',
      email: pi.email || t.credentials?.email || '',

      // Hours (direct DB values)
      teachingHours,
      accompHours,
      ensembleActualHours,
      ensembleCoordHours,
      theoryHours,
      managementRole: mgmt.role || '',
      managementHours,
      travelTimeHours,
      totalWeeklyHours,

      // Composed name (for formula column W)
      fullName: `${pi.firstName || ''} ${pi.lastName || ''}`.trim(),

      // Instrument booleans
      instrumentBooleans,

      // Teaching subjects
      teachingSubjects: {
        pianoAccomp: subjects.includes('ליווי פסנתר'),
        conducting: subjects.includes('ניצוח') || roles.includes('מנצח'),
        theory: subjects.includes('תאוריה') || roles.includes('מורה תאוריה'),
        composition: subjects.includes('הלחנה'),
        librarian: subjects.includes('ספרנות תזמורות'),
        other: subjects.includes('אחר'),
      },
    });
  }

  return rows;
}

// ─── Sheet 4: Student Full (merged student + ensemble) ───────────────────────

function mapStudentFull(data) {
  const { students, teacherMap, orchestraMap } = data;
  const rows = [];

  for (const s of students) {
    const pi = s.personalInfo || {};
    const ai = s.academicInfo || {};

    // Primary instrument progress
    const progress = ai.instrumentProgress || [];
    const primaryProgress = progress.find((p) => p.isPrimary) || progress[0];
    const instrumentName = primaryProgress?.instrumentName || '';
    const stage = primaryProgress?.currentStage || '';
    const ministryLevel = primaryProgress?.ministryStageLevel || stageToMinistryLevel(stage) || '';

    // Primary teacher (first active assignment)
    const activeAssignment = (s.teacherAssignments || []).find((a) => a.isActive);
    const teacher = activeAssignment ? teacherMap.get(activeAssignment.teacherId) : null;
    const teacherName = teacher ? composeName(teacher.personalInfo) : '';

    // Lesson duration → ש"ש
    const durationMinutes = activeAssignment?.scheduleInfo?.duration || 45;
    const lessonHours = roundToQuarterHour(minutesToWeeklyHours(durationMinutes));

    // Full name for column B
    const fullName = `${pi.firstName || ''} ${pi.lastName || ''}`.trim() || pi.fullName || '';

    // Department column (from INSTRUMENT_TO_MINISTRY mapping)
    const instrMapping = INSTRUMENT_TO_MINISTRY[instrumentName] || null;

    // Ensemble columns (from student's orchestraIds → orchestra subType → ENSEMBLE_TO_COLUMN)
    const orchestraIds = s.enrollments?.orchestraIds || [];
    const ensembleColumns = {};
    for (const oid of orchestraIds) {
      const orch = orchestraMap.get(oid);
      if (!orch) continue;
      const subType = orch.subType;
      const col = subType ? ENSEMBLE_TO_COLUMN[subType] : null;
      if (col) {
        ensembleColumns[col] = ensembleColumns[col]
          ? `${ensembleColumns[col]}, ${orch.name}`
          : orch.name;
      }
    }

    rows.push({
      fullName,
      age: pi.age || '',
      grade: ai.class || '',
      yearsOfStudy: ai.studyYears ?? '',
      stage: ministryLevel,
      teacherName,
      lessonDuration: lessonHours,
      extraLessonType: ai.extraHour ?? '',
      instrumentName,
      instrMapping,       // { col, value } or null
      ensembleColumns,    // { Q: 'name', R: 'name', ... }
    });
  }

  return rows;
}

// ─── Sheet 5: Ensemble Schedule ──────────────────────────────────────────────

function mapEnsembleSchedule(data) {
  const { orchestras, rehearsalsByOrchestra, teacherMap } = data;
  const rows = [];
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  for (const orch of orchestras) {
    const oid = orch._id.toString();
    const conductor = orch.conductorId ? teacherMap.get(orch.conductorId) : null;
    const conductorName = conductor ? composeName(conductor.personalInfo) : '';

    // Get distinct weekly rehearsal slots, sorted by dayOfWeek
    const allRehearsals = rehearsalsByOrchestra.get(oid) || [];
    const weeklySlots = new Map();
    for (const r of allRehearsals) {
      const key = `${r.dayOfWeek}_${r.startTime}`;
      if (!weeklySlots.has(key)) {
        weeklySlots.set(key, {
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        });
      }
    }
    const sortedSlots = [...weeklySlots.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    // Activity I
    const act1 = sortedSlots[0];
    const act1Minutes = act1 ? timeDiffMinutes(act1.startTime, act1.endTime) : 0;
    const act1Hours = act1 ? roundToQuarterHour(minutesToWeeklyHours(act1Minutes)) : null;

    // Activity II
    const act2 = sortedSlots[1] || null;
    const act2Minutes = act2 ? timeDiffMinutes(act2.startTime, act2.endTime) : 0;
    const act2Hours = act2 ? roundToQuarterHour(minutesToWeeklyHours(act2Minutes)) : null;

    const totalActualHours = roundToQuarterHour(minutesToWeeklyHours(act1Minutes + act2Minutes));
    const coordHours = orch.ministryData?.coordinationHours ?? null;
    const totalReportingHours = typeof coordHours === 'number'
      ? roundToQuarterHour(totalActualHours + coordHours)
      : totalActualHours;

    const memberCount = (orch.memberIds || []).length;

    rows.push({
      isActive: true,
      conductorName,
      name: orch.name,
      memberCount,
      act1Day: act1 ? dayNames[act1.dayOfWeek] || '' : '',
      act1Start: act1?.startTime || '',
      act1End: act1?.endTime || '',
      act1Hours,
      act2Day: act2 ? dayNames[act2.dayOfWeek] || '' : '',
      act2Start: act2?.startTime || '',
      act2End: act2?.endTime || '',
      act2Hours,
      totalActualHours,
      coordHours,
      totalReportingHours,
      performanceLevel: orch.performanceLevel || '',
      subType: orch.subType || '',
    });
  }

  return rows;
}

// ─── Sheet 6: Music Theory ───────────────────────────────────────────────────

function mapMusicTheory(data) {
  const { theoryLessons } = data;

  // Fixed 7 category names in Ministry order
  const categoryOrder = [
    'תורת המוסיקה שנה ראשונה',
    'תורת המוסיקה שנה שנייה',
    'תורת המוסיקה שנה שלישית',
    'תורת המוסיקה שנה רביעית',
    'תורת המוסיקה שנה חמישית',
    'תורת המוסיקה שנה שישית ואילך',
    'אלתור (קבוצתי)',
  ];

  // Group theory lessons by category
  const categoryGroups = new Map();
  for (const lesson of theoryLessons) {
    if (!categoryGroups.has(lesson.category)) {
      categoryGroups.set(lesson.category, []);
    }
    categoryGroups.get(lesson.category).push(lesson);
  }

  const rows = [];

  for (const category of categoryOrder) {
    const lessons = categoryGroups.get(category) || [];

    // Count unique weekly slots
    const weeklySlots = new Map();
    const allStudentIds = new Set();

    for (const lesson of lessons) {
      const slotKey = `${lesson.dayOfWeek}_${lesson.startTime}`;
      if (!weeklySlots.has(slotKey)) {
        weeklySlots.set(slotKey, {
          duration: timeDiffMinutes(lesson.startTime, lesson.endTime) || 45,
        });
      }
      for (const sid of lesson.studentIds || []) {
        allStudentIds.add(sid);
      }
    }

    const groupCount = weeklySlots.size;
    const studentCount = allStudentIds.size;
    const weeklyMinutes = [...weeklySlots.values()].reduce((sum, s) => sum + s.duration, 0);
    const weeklyHours = roundToQuarterHour(minutesToWeeklyHours(weeklyMinutes));

    rows.push({
      category,
      groupCount,
      studentCount,
      weeklyHours,
    });
  }

  return rows;
}
