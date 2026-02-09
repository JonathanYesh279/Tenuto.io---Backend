/**
 * Ministry of Education Data Mappers
 *
 * Transforms DB data into sheet-ready rows for the 5 Ministry Excel sheets:
 *   1. Teacher Roster (מצבת כח-אדם להוראה)
 *   2. Student Data (נתוני תלמידים)
 *   3. Student Ensemble Assignments (שיבוץ תלמידים להרכבים)
 *   4. Music Theory (תורת המוזיקה)
 *   5. Ensemble Schedule (לוח הרכבי ביצוע)
 *   6. Ensembles Summary (סיכום הרכבים) — aggregation sheet
 *
 * All mappers receive pre-loaded data (single DB fetch) and return row arrays.
 */

import { getCollection } from '../../services/mongoDB.service.js';
import {
  INSTRUMENT_MAP,
  ORCHESTRA_SUB_TYPES,
  getInstrumentDepartment,
  getInstrumentAbbreviation,
  minutesToWeeklyHours,
  roundToQuarterHour,
  stageToMinistryLevel,
} from '../../config/constants.js';

export const ministryMappers = {
  loadExportData,
  mapTeacherRoster,
  mapStudentData,
  mapStudentEnsembles,
  mapMusicTheory,
  mapEnsembleSchedule,
  mapEnsembleSummary,
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
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function composeName(personalInfo) {
  const fn = personalInfo?.firstName || '';
  const ln = personalInfo?.lastName || '';
  return `${fn} ${ln}`.trim() || personalInfo?.fullName || '';
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function timeDiffMinutes(start, end) {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 0;
}

// ─── Sheet 1: Teacher Roster (מצבת כח-אדם להוראה) ───────────────────────────

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

    // Section 1: Personal Details
    const row = {
      'מס"ד': i + 1,
      'שם משפחה': pi.lastName || '',
      'שם פרטי': pi.firstName || '',
      'מספר זהות': pi.idNumber || '',
      'שנת לידה': pi.birthYear || '',
      'סיווג': prof.classification || '',
      'תואר': prof.degree || '',
      'תעודת הוראה': prof.hasTeachingCertificate ? 'כן' : 'לא',
      'ותק בהוראה': prof.teachingExperienceYears || '',
      'חבר ארגון': prof.isUnionMember ? 'כן' : 'לא',
      'טלפון': pi.phone || '',
      'דוא"ל': pi.email || '',
    };

    // Section 2: Teaching Hours
    row['ש"ש הוראה'] = hs?.totals?.individualLessons ?? '';
    row['ש"ש ליווי פסנתר'] = hs?.totals?.accompaniment ?? mgmt.accompHours ?? '';

    // Section 3: Management Hours
    row['ש"ש ריכוז'] = mgmt.managementHours ?? '';
    row['תפקיד ריכוז'] = mgmt.role || '';
    row['ש"ש תאוריה'] = hs?.totals?.theoryTeaching ?? '';

    // Section 4: Ensemble & Total
    row['ש"ש הרכבים בפועל'] = hs?.totals?.orchestraConducting ?? '';
    row['ש"ש ריכוז הרכבים'] = hs?.totals?.ensembleCoordination ?? mgmt.ensembleCoordHours ?? '';
    row['סה"כ ש"ש'] = hs?.totals?.totalWeeklyHours ?? '';
    row['ש"ש נסיעות'] = hs?.totals?.travelTime ?? mgmt.travelTimeHours ?? '';

    // Section 5: Instrument Matrix — one column per instrument
    const teacherInstruments = prof.instruments || [];
    for (const inst of INSTRUMENT_MAP) {
      row[inst.abbreviation] = teacherInstruments.includes(inst.name) ? '✓' : '';
    }

    // Section 6: Teaching Subjects
    const subjects = prof.teachingSubjects || [];
    const roles = t.roles || [];
    row['ליווי פסנתר'] = subjects.includes('ליווי פסנתר') ? '✓' : '';
    row['ניצוח'] = subjects.includes('ניצוח') || roles.includes('מנצח') ? '✓' : '';
    row['תאוריה'] = subjects.includes('תאוריה') || roles.includes('מורה תאוריה') ? '✓' : '';
    row['הלחנה'] = subjects.includes('הלחנה') ? '✓' : '';
    row['ספרנות תזמורות'] = subjects.includes('ספרנות תזמורות') ? '✓' : '';
    row['אחר'] = subjects.includes('אחר') ? '✓' : '';

    rows.push(row);
  }

  return rows;
}

// ─── Sheet 2: Student Data (נתוני תלמידים) ──────────────────────────────────

function mapStudentData(data) {
  const { students, teacherMap } = data;
  const rows = [];

  for (const s of students) {
    const pi = s.personalInfo || {};
    const ai = s.academicInfo || {};

    // Primary instrument progress
    const primaryProgress = (ai.instrumentProgress || []).find((p) => p.isPrimary) || ai.instrumentProgress?.[0];
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

    // Department from instrument
    const department = getInstrumentDepartment(instrumentName);

    const row = {
      'שם משפחה': pi.lastName || '',
      'שם פרטי': pi.firstName || '',
      'גיל': pi.age || '',
      'כיתה': ai.class || '',
      'שנות לימוד': ai.studyYears ?? '',
      'שלב': ministryLevel,
      'שם מורה': teacherName,
      'ש"ש שיעור': lessonHours,
      'שעה נוספת': ai.extraHour ?? '',
      'כלי נגינה': instrumentName,
      'מחלקה': department || '',
    };

    rows.push(row);
  }

  return rows;
}

// ─── Sheet 3: Student Ensemble Assignments (שיבוץ תלמידים להרכבים) ──────────

function mapStudentEnsembles(data) {
  const { students, orchestraMap } = data;
  const rows = [];

  // Ensemble type columns (one per ORCHESTRA_SUB_TYPES)
  const ensembleColumns = [
    'כלי נשיפה',
    'סימפונית',
    'כלי קשת',
    'עממית',
    'ביג-בנד',
    'מקהלה',
    'קולי',
    'קאמרי קלאסי',
    "ג'אז-פופ-רוק",
    'תאוריה',
    'הגנת מוזיקה',
    'לאומית/פולקלור',
  ];

  for (const s of students) {
    const pi = s.personalInfo || {};
    const orchestraIds = s.enrollments?.orchestraIds || [];

    const row = {
      'שם משפחה': pi.lastName || '',
      'שם פרטי': pi.firstName || '',
    };

    // Initialize all columns to empty
    for (const col of ensembleColumns) {
      row[col] = '';
    }

    // Place each orchestra in its subType column
    for (const oid of orchestraIds) {
      const orch = orchestraMap.get(oid);
      if (!orch) continue;
      const subType = orch.subType;
      if (subType && ensembleColumns.includes(subType)) {
        // If multiple orchestras of same subType, comma-separate
        row[subType] = row[subType] ? `${row[subType]}, ${orch.name}` : orch.name;
      }
    }

    rows.push(row);
  }

  return rows;
}

// ─── Sheet 4: Music Theory (תורת המוזיקה) ───────────────────────────────────

function mapMusicTheory(data) {
  const { theoryLessons, students, tenant } = data;
  const rows = [];

  // Group theory lessons by category
  const categoryGroups = new Map();
  for (const lesson of theoryLessons) {
    if (!categoryGroups.has(lesson.category)) {
      categoryGroups.set(lesson.category, []);
    }
    categoryGroups.get(lesson.category).push(lesson);
  }

  let totalGroups = 0;
  let totalStudents = 0;
  let totalHours = 0;

  for (const [category, lessons] of categoryGroups) {
    // Count unique weekly slots (group by dayOfWeek + startTime to avoid counting
    // recurring instances as separate groups)
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

    totalGroups += groupCount;
    totalStudents += studentCount;
    totalHours += weeklyHours;

    rows.push({
      'קטגוריה': category,
      'מספר קבוצות': groupCount,
      'מספר תלמידים': studentCount,
      'ש"ש שבועיות': weeklyHours,
      'שעות מאושרות': '', // Ministry fills this
    });
  }

  // Summary rows
  const totalActiveStudents = students.length;
  const participationPct = totalActiveStudents > 0
    ? Math.round((totalStudents / totalActiveStudents) * 100)
    : 0;

  rows.push({
    'קטגוריה': 'סה"כ',
    'מספר קבוצות': totalGroups,
    'מספר תלמידים': totalStudents,
    'ש"ש שבועיות': roundToQuarterHour(totalHours),
    'שעות מאושרות': '',
  });

  rows.push({
    'קטגוריה': 'אחוז השתתפות',
    'מספר קבוצות': '',
    'מספר תלמידים': `${participationPct}%`,
    'ש"ש שבועיות': '',
    'שעות מאושרות': '',
  });

  rows.push({
    'קטגוריה': 'מנהל/ת הקונסרבטוריון',
    'מספר קבוצות': '',
    'מספר תלמידים': tenant?.director?.name || '',
    'ש"ש שבועיות': '',
    'שעות מאושרות': '',
  });

  return rows;
}

// ─── Sheet 5: Ensemble Schedule (לוח הרכבי ביצוע) ───────────────────────────

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

    // Activity I (first rehearsal slot)
    const act1 = sortedSlots[0];
    const act1Minutes = act1 ? timeDiffMinutes(act1.startTime, act1.endTime) : 0;
    const act1Hours = act1 ? roundToQuarterHour(minutesToWeeklyHours(act1Minutes)) : '';

    // Activity II (second rehearsal slot, if exists)
    const act2 = sortedSlots[1] || null;
    const act2Minutes = act2 ? timeDiffMinutes(act2.startTime, act2.endTime) : 0;
    const act2Hours = act2 ? roundToQuarterHour(minutesToWeeklyHours(act2Minutes)) : '';

    const totalActualHours = roundToQuarterHour(
      minutesToWeeklyHours(act1Minutes + act2Minutes)
    );
    const coordHours = orch.ministryData?.coordinationHours ?? '';
    const totalReportingHours = orch.ministryData?.totalReportingHours ??
      (typeof coordHours === 'number'
        ? roundToQuarterHour(totalActualHours + coordHours)
        : totalActualHours);

    rows.push({
      'שם מנצח/מדריך': conductorName,
      'שם הרכב': orch.name,
      'סוג': orch.subType || orch.type || '',
      'מספר משתתפים': (orch.memberIds || []).length,
      'פעילות I - יום': act1 ? dayNames[act1.dayOfWeek] || '' : '',
      'פעילות I - שעת התחלה': act1?.startTime || '',
      'פעילות I - שעת סיום': act1?.endTime || '',
      'פעילות I - ש"ש': act1Hours,
      'פעילות II - יום': act2 ? dayNames[act2.dayOfWeek] || '' : '',
      'פעילות II - שעת התחלה': act2?.startTime || '',
      'פעילות II - שעת סיום': act2?.endTime || '',
      'פעילות II - ש"ש': act2Hours,
      'סה"כ ש"ש בפועל': totalActualHours,
      'ש"ש הנחיה וריכוז': coordHours,
      'סה"כ ש"ש לדיווח': totalReportingHours,
      'רמת ביצוע': orch.performanceLevel || '',
      'שימוש משרד': '', // Ministry fills this
    });
  }

  return rows;
}

// ─── Sheet 6: Ensembles Summary (סיכום הרכבים) ──────────────────────────────

function mapEnsembleSummary(data, ensembleScheduleRows) {
  const { orchestras, students } = data;

  // Total ensembles
  const totalEnsembles = orchestras.length;
  const totalParticipants = orchestras.reduce((sum, o) => sum + (o.memberIds || []).length, 0);

  // Total hours from ensemble schedule
  let totalActualHours = 0;
  let totalCoordHours = 0;
  let totalReportingHours = 0;
  for (const row of ensembleScheduleRows) {
    if (typeof row['סה"כ ש"ש בפועל'] === 'number') totalActualHours += row['סה"כ ש"ש בפועל'];
    if (typeof row['ש"ש הנחיה וריכוז'] === 'number') totalCoordHours += row['ש"ש הנחיה וריכוז'];
    if (typeof row['סה"כ ש"ש לדיווח'] === 'number') totalReportingHours += row['סה"כ ש"ש לדיווח'];
  }

  // Performance level distribution
  const levelCounts = {};
  for (const o of orchestras) {
    const level = o.performanceLevel || 'לא מוגדר';
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  }

  // Breakdown by subType
  const subTypeCounts = {};
  for (const o of orchestras) {
    const st = o.subType || 'אחר';
    subTypeCounts[st] = (subTypeCounts[st] || 0) + 1;
  }

  // Chamber ensemble payment rules
  const chamberCount = orchestras.filter(
    (o) => o.subType === 'קאמרי קלאסי' || o.type === 'הרכב'
  ).length;
  const chamberHours = Math.floor(chamberCount / 10); // 1 weekly hour per 10 chamber ensembles

  const totalStudents = students.length;
  const extraStudents = Math.max(0, totalStudents - 450);
  const extraHours = Math.floor(extraStudents / 50) * 2; // +2 per 50 students above 450

  const rows = [
    { 'סיכום': 'סה"כ הרכבים', 'ערך': totalEnsembles },
    { 'סיכום': 'סה"כ משתתפים', 'ערך': totalParticipants },
    { 'סיכום': 'סה"כ ש"ש בפועל', 'ערך': roundToQuarterHour(totalActualHours) },
    { 'סיכום': 'סה"כ ש"ש ריכוז', 'ערך': roundToQuarterHour(totalCoordHours) },
    { 'סיכום': 'סה"כ ש"ש לדיווח', 'ערך': roundToQuarterHour(totalReportingHours) },
    { 'סיכום': '', 'ערך': '' },
    { 'סיכום': '--- פילוח רמת ביצוע ---', 'ערך': '' },
  ];

  for (const [level, count] of Object.entries(levelCounts)) {
    rows.push({ 'סיכום': level, 'ערך': count });
  }

  rows.push({ 'סיכום': '', 'ערך': '' });
  rows.push({ 'סיכום': '--- פילוח לפי סוג ---', 'ערך': '' });

  for (const [st, count] of Object.entries(subTypeCounts)) {
    rows.push({ 'סיכום': st, 'ערך': count });
  }

  rows.push({ 'סיכום': '', 'ערך': '' });
  rows.push({ 'סיכום': '--- חישוב תשלום הרכבים קאמריים ---', 'ערך': '' });
  rows.push({ 'סיכום': 'הרכבים קאמריים', 'ערך': chamberCount });
  rows.push({ 'סיכום': 'ש"ש הרכבים (1 לכל 10)', 'ערך': chamberHours });
  rows.push({ 'סיכום': 'תלמידים מעל 450', 'ערך': extraStudents });
  rows.push({ 'סיכום': 'ש"ש נוספות (+2 לכל 50)', 'ערך': extraHours });

  return rows;
}
