/**
 * Tenuto.io Dev Data Seed Script
 *
 * Populates the main Tenuto-DB with realistic test data:
 *   - 1 tenant (school) with rooms in settings.rooms[]
 *   - 1 school year (current)
 *   - ~130 teachers (1 admin with real login credentials)
 *   - ~1,200 students with teacher assignments
 *   - ~50 orchestras/ensembles with members
 *   - ~100-150 rehearsals with room-referenced locations
 *   - ~30-50 theory lessons with room-referenced locations
 *   - 10-15 intentional scheduling conflicts for Phase 32 testing
 *
 * Usage:
 *   node scripts/seed-dev-data.js              # Seed all data
 *   node scripts/seed-dev-data.js --clean      # Drop existing data first, then seed
 *   node scripts/seed-dev-data.js --drop-only  # Only drop seeded data (cleanup)
 *
 * Login credentials after seeding:
 *   Email:    admin@tenuto-dev.com
 *   Password: Admin123
 *   Role:     מנהל (admin)
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';
const TENANT_SLUG = 'dev-conservatory';
// Fixed tenantId so --clean always finds the old data
const TENANT_ID_STR = 'dev-conservatory-001';
const TEACHER_COUNT = 130;
const STUDENT_TARGET = 1200;
const ORCHESTRA_COUNT = 50;
const ADMIN_PASSWORD = 'Admin123';
const ADMIN_EMAIL = 'admin@tenuto-dev.com';

// ─── Constants (inlined to avoid app import side effects) ────────────────────

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const DAY_INDICES = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4 };
const VALID_DURATIONS = [30, 45, 60];
const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

const ORCHESTRA_TYPES = ['הרכב', 'תזמורת'];
const ORCHESTRA_SUB_TYPES = ['כלי נשיפה', 'סימפונית', 'כלי קשת', 'קאמרי קלאסי', 'קולי', 'מקהלה', 'ביג-בנד', "ג'אז-פופ-רוק", 'עממית'];
const PERFORMANCE_LEVELS = ['התחלתי', 'ביניים', 'ייצוגי'];

const LOCATIONS = [
  'אולם ערן', 'סטודיו קאמרי 1', 'סטודיו קאמרי 2', 'אולפן הקלטות',
  'חדר חזרות 1', 'חדר חזרות 2', 'חדר מחשבים',
  ...Array.from({ length: 20 }, (_, i) => `חדר ${i + 1}`),
  'חדר תאוריה א', 'חדר תאוריה ב',
];

const THEORY_CATEGORIES = [
  'תלמידים חדשים ב-ד',
  'מתחילים',
  'מתחילים ב',
  'מתקדמים א',
  'מתקדמים ב',
  'מגמה',
];

const DEPARTMENT_CONFIG = [
  { department: 'כלי קשת', instruments: ['כינור', 'ויולה', "צ'לו", 'קונטרבס'], teachers: 25 },
  { department: 'כלי נשיפה-עץ', instruments: ['חליל צד', 'קלרינט', 'סקסופון', 'אבוב', 'בסון', 'חלילית', 'רקורדר'], teachers: 20 },
  { department: 'כלי נשיפה-פליז', instruments: ['חצוצרה', 'קרן יער', 'טרומבון', 'טובה/בריטון'], teachers: 12 },
  { department: 'מקלדת', instruments: ['פסנתר'], teachers: 22 },
  { department: 'כלי פריטה', instruments: ['גיטרה', 'גיטרה בס', 'גיטרה פופ', 'נבל'], teachers: 18 },
  { department: 'כלי הקשה', instruments: ['תופים', 'כלי הקשה'], teachers: 8 },
  { department: 'קולי', instruments: ['שירה'], teachers: 10 },
  { department: 'כלים אתניים', instruments: ['עוד', 'כלים אתניים'], teachers: 8 },
  { department: 'כלים עממיים', instruments: ['מנדולינה', 'אקורדיון'], teachers: 7 },
];

const ORCHESTRA_NAMES = [
  'תזמורת סימפונית צעירה', 'תזמורת כלי קשת', 'תזמורת נשיפה', 'תזמורת קאמרית',
  'הרכב ג\'אז', 'הרכב רוק', 'מקהלת הקונסרבטוריון', 'מקהלת נוער',
  'הרכב כלי הקשה', 'תזמורת סימפונית בכירה', 'הרכב קאמרי א', 'הרכב קאמרי ב',
  'הרכב כלי נשיפה-עץ', 'הרכב פליז', 'תזמורת עממית', 'הרכב אתני',
  'ביג-בנד', 'הרכב פסנתר', 'הרכב גיטרות', 'מקהלת ילדים',
  'תזמורת מתחילים א', 'תזמורת מתחילים ב', 'הרכב כינורות', 'הרכב צ\'לו',
  'מקהלת בנות', 'מקהלת בנים', 'הרכב סקסופונים', 'הרכב קלרינטים',
  'תזמורת ייצוגית', 'הרכב חלילים', 'הרכב קרנות יער', 'הרכב טרומבונים',
  'תזמורת נוער א', 'תזמורת נוער ב', 'הרכב פריטה', 'מקהלת קאמרית',
  'הרכב פסנתר ארבע ידיים', 'תזמורת כלי מיתר', 'הרכב נבלים', 'הרכב שירה-אינסטרומנטלי',
  'תזמורת קלאסית', 'הרכב רקורדרים', 'הרכב חצוצרות', 'הרכב מנדולינות',
  'תזמורת פופ-רוק', 'הרכב תופים', 'מקהלת הורים', 'הרכב עוד ובוזוקי',
  'תזמורת בארוק', 'הרכב אקורדיונים',
];

const FIRST_NAMES = [
  'יוסי', 'דוד', 'משה', 'אברהם', 'יעקב', 'שרה', 'רחל', 'לאה', 'רבקה', 'מרים',
  'אורי', 'נועם', 'עידן', 'יובל', 'תומר', 'שירה', 'מיכל', 'נועה', 'יעל', 'דנה',
  'איתן', 'אלון', 'גיל', 'רון', 'עומר', 'ליאור', 'אביב', 'טל', 'שחר', 'עדי',
  'אריאל', 'נתן', 'אסף', 'בן', 'דניאל', 'עמית', 'ניר', 'אייל', 'מתן', 'רועי',
  'הדר', 'אורן', 'יונתן', 'אלי', 'שמואל', 'נדב', 'גל', 'ליאם', 'איתמר', 'עמרי',
  'תמר', 'הילה', 'עינב', 'אור', 'ים', 'לין', 'אגם', 'רוני', 'שקד', 'ארבל',
  'נוגה', 'עלמה', 'מאיה', 'ליה', 'אביגיל', 'יהל', 'רז', 'סהר', 'פלג', 'קרן',
];

const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שלום', 'חדד',
  'אזולאי', 'בן דוד', 'מלכה', 'נחמיאס', 'גבאי', 'עמר', 'שמעון', 'ישראלי', 'יוסף', 'חיים',
  'ברק', 'זוהר', 'שפירא', 'גולן', 'אדרי', 'סויסה', 'בנימין', 'עטיה', 'אלבז', 'טל',
  'רוזנברג', 'שטרן', 'קפלן', 'אוחנה', 'מור', 'ברזילי', 'אלוני', 'רגב', 'שרעבי', 'סבג',
  'הרוש', 'בר', 'דור', 'אבן', 'ניסים', 'אלון', 'שני', 'רם', 'נוי', 'חן',
];

const CITIES = [
  'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'ראשון לציון', 'פתח תקווה',
  'נתניה', 'אשדוד', 'רמת גן', 'הרצליה', 'כפר סבא', 'רעננה',
  'הוד השרון', 'גבעתיים', 'רחובות', 'לוד', 'רמלה', 'עכו',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }
function generatePhone() { return `05${randInt(0, 9)}-${randInt(1000000, 9999999)}`; }
function generateTime() {
  const hour = randInt(8, 18);
  const minute = pick([0, 30]);
  return `${pad(hour)}:${pad(minute)}`;
}
function generateAlignedStartTime() {
  const hour = randInt(8, 17);
  const minute = pick([0, 30]);
  return { hour, minute, str: `${pad(hour)}:${pad(minute)}` };
}
function addHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const newH = Math.min(h + hours, 19);
  return `${pad(newH)}:${pad(m)}`;
}
function generateIdNumber() {
  // Generate a valid Israeli ID number (9 digits with check digit)
  const digits = [];
  for (let i = 0; i < 8; i++) digits.push(randInt(0, 9));
  // Calculate check digit using alternating 1,2 multiplier
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let val = digits[i] * ((i % 2 === 0) ? 1 : 2);
    if (val > 9) val -= 9;
    sum += val;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  digits.push(checkDigit);
  return digits.join('');
}
/** Generate dates within the school year (Sep-Jun) for a given day of week */
function generateDatesForDay(dayOfWeek, count) {
  // dayOfWeek: 0=Sunday ... 4=Thursday (matching VALID_DAYS index)
  const dates = [];
  // Start from September 1, 2024
  const start = new Date('2024-09-01');
  // JS getDay(): 0=Sunday, 1=Monday ... 6=Saturday
  // Map our dayOfWeek to JS day: 0->0, 1->1, 2->2, 3->3, 4->4
  const jsDay = dayOfWeek;
  // Find first occurrence of this day
  const current = new Date(start);
  while (current.getDay() !== jsDay) {
    current.setDate(current.getDate() + 1);
  }
  // Collect dates (one per week)
  const end = new Date('2025-06-30');
  while (current <= end && dates.length < count) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

// ─── Data Generation ─────────────────────────────────────────────────────────

function generateTenant() {
  return {
    _id: new ObjectId(),
    tenantId: TENANT_ID_STR,
    slug: TENANT_SLUG,
    name: 'קונסרבטוריון תנועתו - פיתוח',
    city: 'תל אביב',
    director: { name: null, teacherId: null },
    ministryInfo: {
      institutionCode: '550123',
      districtName: 'מחוז תל אביב',
    },
    settings: {
      lessonDurations: [30, 45, 60],
      schoolStartMonth: 9,
    },
    subscription: {
      plan: 'premium',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-08-31'),
      isActive: true,
      maxTeachers: 200,
      maxStudents: 2000,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateSchoolYear() {
  return {
    _id: new ObjectId(),
    tenantId: TENANT_ID_STR,
    name: 'תשפ"ה 2024-2025',
    startDate: new Date('2024-08-20'),
    endDate: new Date('2025-08-01'),
    isCurrent: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function generateTeachers() {
  const teachers = [];
  let nameIdx = 0;

  // Hash the admin password (real bcrypt)
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  for (const dept of DEPARTMENT_CONFIG) {
    for (let i = 0; i < dept.teachers; i++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(nameIdx / FIRST_NAMES.length) % LAST_NAMES.length];
      nameIdx++;

      const instrument = pick(dept.instruments);
      const isAdmin = teachers.length === 0; // First teacher is admin
      const isConductor = teachers.length >= 1 && teachers.length < 13;
      const email = isAdmin ? ADMIN_EMAIL : `teacher${nameIdx}@tenuto-dev.com`;

      const roles = ['מורה'];
      if (isAdmin) roles.push('מנהל');
      if (isConductor) roles.push('מנצח');

      // Generate 2-4 time blocks per teacher
      const timeBlockCount = randInt(2, 4);
      const timeBlocks = [];
      const usedDays = new Set();
      for (let tb = 0; tb < timeBlockCount; tb++) {
        let day = pick(VALID_DAYS);
        // Try to avoid duplicate days
        let attempts = 0;
        while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS); attempts++; }
        usedDays.add(day);

        const startHour = randInt(8, 15);
        const startMin = pick([0, 30]);
        const endHour = startHour + randInt(2, 4);

        timeBlocks.push({
          _id: new ObjectId(),
          day,
          startTime: `${pad(startHour)}:${pad(startMin)}`,
          endTime: `${pad(Math.min(endHour, 19))}:${pad(startMin)}`,
          location: pick(LOCATIONS),
          assignedLessons: [],
        });
      }

      teachers.push({
        _id: new ObjectId(),
        tenantId: TENANT_ID_STR,
        isActive: true,
        personalInfo: {
          firstName,
          lastName,
          phone: generatePhone(),
          email,
          idNumber: generateIdNumber(),
          address: { city: pick(CITIES), street: `רחוב ${pick(LAST_NAMES)} ${randInt(1, 120)}` },
        },
        roles,
        professionalInfo: {
          instruments: [instrument],
          department: dept.department,
        },
        credentials: {
          email,
          password: isAdmin ? adminHash : `$2b$10$fakehash${String(nameIdx).padStart(34, '0')}`,
        },
        teaching: {
          timeBlocks,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return teachers;
}

function generateStudents(teachers) {
  const students = [];
  let nameIdx = 0;

  const basePerTeacher = Math.floor(STUDENT_TARGET / teachers.length);
  let remainder = STUDENT_TARGET - basePerTeacher * teachers.length;

  for (const teacher of teachers) {
    const count = basePerTeacher + (remainder-- > 0 ? 1 : 0);
    const instrument = teacher.professionalInfo.instruments[0];
    const teacherTimeBlock = teacher.teaching.timeBlocks[0];

    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(nameIdx / FIRST_NAMES.length) % LAST_NAMES.length];
      nameIdx++;

      const duration = pick(VALID_DURATIONS);
      const day = teacherTimeBlock.day;
      const time = generateTime();

      students.push({
        _id: new ObjectId(),
        tenantId: TENANT_ID_STR,
        isActive: true,
        personalInfo: {
          firstName,
          lastName,
          phone: generatePhone(),
          email: `student${nameIdx}@tenuto-dev.com`,
          parentPhone: generatePhone(),
          parentName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          idNumber: generateIdNumber(),
          address: { city: pick(CITIES), street: `רחוב ${pick(LAST_NAMES)} ${randInt(1, 200)}` },
        },
        academicInfo: {
          class: pick(VALID_CLASSES),
          instrumentProgress: [
            {
              instrumentName: instrument,
              currentStage: randInt(1, 8),
              isPrimary: true,
              tests: {
                technicalTest: { status: pick(['עבר', 'לא נבחן', 'לא עבר']) },
                stageTest: { status: pick(['עבר', 'לא נבחן', 'לא עבר']) },
              },
            },
          ],
        },
        teacherAssignments: [
          {
            _id: new ObjectId(),
            teacherId: teacher._id.toHexString(),
            isActive: true,
            day,
            time,
            duration,
            location: teacherTimeBlock.location,
            timeBlockId: teacherTimeBlock._id.toHexString(),
            lessonId: new ObjectId().toHexString(),
            scheduleSlotId: new ObjectId().toHexString(),
            startDate: new Date('2024-09-01'),
            endDate: null,
            isRecurring: true,
            notes: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return students;
}

function generateOrchestras(teachers, students, schoolYearId) {
  const orchestras = [];
  // Get conductors (teachers with מנצח role)
  const conductors = teachers.filter(t => t.roles.includes('מנצח'));
  // If not enough conductors, use admin teachers too
  const allConductorCandidates = conductors.length > 0 ? conductors : teachers.slice(0, 12);

  for (let i = 0; i < ORCHESTRA_COUNT; i++) {
    const conductor = allConductorCandidates[i % allConductorCandidates.length];
    const type = pick(ORCHESTRA_TYPES);
    const subType = pick(ORCHESTRA_SUB_TYPES);
    const name = i < ORCHESTRA_NAMES.length ? ORCHESTRA_NAMES[i] : `הרכב ${i + 1}`;

    // Assign 8-30 random students as members
    const memberCount = randInt(8, 30);
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const memberIds = shuffled.slice(0, memberCount).map(s => s._id.toHexString());

    orchestras.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      name,
      type,
      subType,
      performanceLevel: pick(PERFORMANCE_LEVELS),
      conductorId: conductor._id.toHexString(),
      memberIds,
      rehearsalIds: [],
      schoolYearId: schoolYearId.toHexString(),
      location: pick(LOCATIONS),
      ministryData: {
        coordinationHours: parseFloat((Math.random() * 10).toFixed(1)),
        totalReportingHours: parseFloat((Math.random() * 40 + 5).toFixed(1)),
        ministryUseCode: null,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return orchestras;
}

function generateRehearsals(orchestras, schoolYearId) {
  const rehearsals = [];

  for (const orchestra of orchestras) {
    // 2-3 rehearsals per orchestra (different days)
    const rehearsalCount = randInt(2, 3);
    const usedDays = new Set();

    for (let r = 0; r < rehearsalCount; r++) {
      let day = pick(VALID_DAYS);
      let attempts = 0;
      while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS); attempts++; }
      usedDays.add(day);

      const dayIndex = DAY_INDICES[day];
      const start = generateAlignedStartTime();
      const durationHours = pick([1, 1.5, 2]);
      const endHour = Math.min(start.hour + Math.floor(durationHours), 19);
      const endMin = durationHours % 1 === 0.5 ? (start.minute === 0 ? 30 : 0) : start.minute;
      const endHourAdjusted = durationHours % 1 === 0.5 && start.minute === 30 ? endHour + 1 : endHour;
      const endTime = `${pad(Math.min(endHourAdjusted, 19))}:${pad(endMin)}`;

      // Pick one date for this rehearsal (representative)
      const dates = generateDatesForDay(dayIndex, 1);
      const date = dates.length > 0 ? dates[0] : new Date('2024-10-01');

      rehearsals.push({
        _id: new ObjectId(),
        tenantId: TENANT_ID_STR,
        groupId: orchestra._id.toString(),
        type: pick(['תזמורת', 'הרכב']),
        date,
        dayOfWeek: dayIndex,
        startTime: start.str,
        endTime,
        location: pick(LOCATIONS),
        attendance: { present: [], absent: [] },
        notes: '',
        schoolYearId: schoolYearId.toHexString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return rehearsals;
}

function generateTheoryLessons(teachers, students, schoolYearId) {
  const theoryLessons = [];
  const teacherIds = teachers.map(t => t._id);
  const studentIds = students.map(s => s._id);

  for (const category of THEORY_CATEGORIES) {
    // 5-8 lessons per category across different days (some days may repeat)
    const lessonCount = randInt(5, 8);
    const usedDays = new Set();

    for (let l = 0; l < lessonCount; l++) {
      let day = pick(VALID_DAYS);
      let attempts = 0;
      while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS); attempts++; }
      usedDays.add(day);

      const dayIndex = DAY_INDICES[day];
      const start = generateAlignedStartTime();
      // Theory lessons are typically 1-1.5 hours
      const durationHours = pick([1, 1.5]);
      const endHour = Math.min(start.hour + Math.floor(durationHours), 19);
      const endMin = durationHours % 1 === 0.5 ? (start.minute === 0 ? 30 : 0) : start.minute;
      const endHourAdjusted = durationHours % 1 === 0.5 && start.minute === 30 ? endHour + 1 : endHour;
      const endTime = `${pad(Math.min(endHourAdjusted, 19))}:${pad(endMin)}`;

      // Pick one date for this lesson
      const dates = generateDatesForDay(dayIndex, 1);
      const date = dates.length > 0 ? dates[0] : new Date('2024-10-01');

      // Assign 5-15 random students
      const lessonStudentIds = pickN(studentIds, randInt(5, 15)).map(id => id.toString());

      theoryLessons.push({
        _id: new ObjectId(),
        tenantId: TENANT_ID_STR,
        category,
        teacherId: pick(teacherIds).toString(),
        date,
        dayOfWeek: dayIndex,
        startTime: start.str,
        endTime,
        location: pick(LOCATIONS),
        studentIds: lessonStudentIds,
        notes: '',
        schoolYearId: schoolYearId.toHexString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return theoryLessons;
}

/**
 * Create intentional scheduling conflicts for Phase 32 conflict detection testing.
 * Reads existing data and creates conflicting records in different collections.
 */
function generateConflicts(teachers, rehearsals, theoryLessons, schoolYearId) {
  const conflictRehearsals = [];
  const conflictTheoryLessons = [];
  let conflictCount = 0;

  // Helper: find time blocks from teachers
  const allTimeBlocks = [];
  for (const teacher of teachers) {
    for (const tb of teacher.teaching.timeBlocks) {
      allTimeBlocks.push({ ...tb, teacherId: teacher._id.toString() });
    }
  }

  // ── Same-room conflicts (5-7): Two activities in same room at same time ──

  // Type A: Rehearsal conflicts with existing time block (3 conflicts)
  for (let i = 0; i < 3 && i < allTimeBlocks.length; i++) {
    const tb = allTimeBlocks[i];
    const dayIndex = DAY_INDICES[tb.day];
    const dates = generateDatesForDay(dayIndex, 1);
    const date = dates.length > 0 ? dates[0] : new Date('2024-10-15');

    conflictRehearsals.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      groupId: new ObjectId().toString(),
      type: pick(['תזמורת', 'הרכב']),
      date,
      dayOfWeek: dayIndex,
      startTime: tb.startTime,
      endTime: addHours(tb.startTime, 1),
      location: tb.location,
      attendance: { present: [], absent: [] },
      notes: `INTENTIONAL_CONFLICT:same_room - conflicts with time block in ${tb.location} on ${tb.day}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: same_room (rehearsal vs time-block) in room "${tb.location}" on day ${tb.day} at ${tb.startTime}`);
  }

  // Type B: Theory lesson conflicts with existing time block (3 conflicts)
  for (let i = 3; i < 6 && i < allTimeBlocks.length; i++) {
    const tb = allTimeBlocks[i];
    const dayIndex = DAY_INDICES[tb.day];
    const dates = generateDatesForDay(dayIndex, 1);
    const date = dates.length > 0 ? dates[0] : new Date('2024-10-15');

    const studentIds = pickN(teachers.slice(0, 20).map(t => t._id), 8).map(id => id.toString());

    conflictTheoryLessons.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      category: pick(THEORY_CATEGORIES),
      teacherId: pick(teachers.map(t => t._id)).toString(),
      date,
      dayOfWeek: dayIndex,
      startTime: tb.startTime,
      endTime: addHours(tb.startTime, 1),
      location: tb.location,
      studentIds,
      notes: `INTENTIONAL_CONFLICT:same_room - conflicts with time block in ${tb.location} on ${tb.day}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: same_room (theory vs time-block) in room "${tb.location}" on day ${tb.day} at ${tb.startTime}`);
  }

  // ── Cross-source conflicts (3-4): Different source types in same room/time ──

  // Rehearsal vs rehearsal in same room (1 conflict)
  if (rehearsals.length > 0) {
    const existing = rehearsals[0];
    conflictRehearsals.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      groupId: new ObjectId().toString(),
      type: pick(['תזמורת', 'הרכב']),
      date: existing.date,
      dayOfWeek: existing.dayOfWeek,
      startTime: existing.startTime,
      endTime: existing.endTime,
      location: existing.location,
      attendance: { present: [], absent: [] },
      notes: `INTENTIONAL_CONFLICT:cross_source - rehearsal vs rehearsal in ${existing.location}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: cross_source (rehearsal vs rehearsal) in room "${existing.location}" on day ${existing.dayOfWeek} at ${existing.startTime}`);
  }

  // Rehearsal vs theory lesson in same room (1 conflict)
  if (rehearsals.length > 1) {
    const existingRehearsal = rehearsals[1];
    const studentIds = pickN(teachers.slice(0, 15).map(t => t._id), 8).map(id => id.toString());

    conflictTheoryLessons.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      category: pick(THEORY_CATEGORIES),
      teacherId: pick(teachers.map(t => t._id)).toString(),
      date: existingRehearsal.date,
      dayOfWeek: existingRehearsal.dayOfWeek,
      startTime: existingRehearsal.startTime,
      endTime: existingRehearsal.endTime,
      location: existingRehearsal.location,
      studentIds,
      notes: `INTENTIONAL_CONFLICT:cross_source - theory vs rehearsal in ${existingRehearsal.location}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: cross_source (theory vs rehearsal) in room "${existingRehearsal.location}" on day ${existingRehearsal.dayOfWeek} at ${existingRehearsal.startTime}`);
  }

  // Theory vs theory in same room (1 conflict)
  if (theoryLessons.length > 0) {
    const existingTheory = theoryLessons[0];
    const studentIds = pickN(teachers.slice(0, 15).map(t => t._id), 8).map(id => id.toString());

    conflictTheoryLessons.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      category: pick(THEORY_CATEGORIES),
      teacherId: pick(teachers.map(t => t._id)).toString(),
      date: existingTheory.date,
      dayOfWeek: existingTheory.dayOfWeek,
      startTime: existingTheory.startTime,
      endTime: existingTheory.endTime,
      location: existingTheory.location,
      studentIds,
      notes: `INTENTIONAL_CONFLICT:cross_source - theory vs theory in ${existingTheory.location}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: cross_source (theory vs theory) in room "${existingTheory.location}" on day ${existingTheory.dayOfWeek} at ${existingTheory.startTime}`);
  }

  // ── Teacher double-booking (3): Same teacher in two places at same time ──

  // Find teachers that have multiple time blocks on the same day (or use first few teachers)
  const teachersForDoubleBooking = teachers.slice(0, 3);
  for (const teacher of teachersForDoubleBooking) {
    const tb = teacher.teaching.timeBlocks[0];
    const dayIndex = DAY_INDICES[tb.day];
    // Create a theory lesson for this teacher at the same time in a DIFFERENT room
    let conflictRoom = pick(LOCATIONS);
    let attempts = 0;
    while (conflictRoom === tb.location && attempts < 10) {
      conflictRoom = pick(LOCATIONS);
      attempts++;
    }

    const dates = generateDatesForDay(dayIndex, 1);
    const date = dates.length > 0 ? dates[0] : new Date('2024-10-15');
    const studentIds = pickN(teachers.slice(0, 15).map(t => t._id), 8).map(id => id.toString());

    conflictTheoryLessons.push({
      _id: new ObjectId(),
      tenantId: TENANT_ID_STR,
      category: pick(THEORY_CATEGORIES),
      teacherId: teacher._id.toString(),
      date,
      dayOfWeek: dayIndex,
      startTime: tb.startTime,
      endTime: addHours(tb.startTime, 1),
      location: conflictRoom,
      studentIds,
      notes: `INTENTIONAL_CONFLICT:teacher_double_booking - teacher ${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName} booked in ${conflictRoom} AND ${tb.location} at ${tb.startTime}`,
      schoolYearId: schoolYearId.toHexString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conflictCount++;
    console.log(`    Created conflict: teacher_double_booking for "${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}" at ${tb.startTime} on ${tb.day} (${tb.location} vs ${conflictRoom})`);
  }

  return { conflictRehearsals, conflictTheoryLessons, conflictCount };
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function dropSeededData(db) {
  console.log('  Cleaning existing data...');

  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  // Only drop data for our tenant, not the entire collection
  const ops = [];
  if (names.includes('student')) ops.push(db.collection('student').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('teacher')) ops.push(db.collection('teacher').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('orchestra')) ops.push(db.collection('orchestra').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('school_year')) ops.push(db.collection('school_year').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('rehearsal')) ops.push(db.collection('rehearsal').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('theory_lesson')) ops.push(db.collection('theory_lesson').deleteMany({ tenantId: TENANT_ID_STR }));
  if (names.includes('tenant')) ops.push(db.collection('tenant').deleteMany({ slug: TENANT_SLUG }));

  const results = await Promise.all(ops);
  const total = results.reduce((sum, r) => sum + r.deletedCount, 0);
  console.log(`  Deleted ${total} documents`);
}

async function createIndexes(db) {
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');
  const orchestraCol = db.collection('orchestra');
  const rehearsalCol = db.collection('rehearsal');
  const theoryCol = db.collection('theory_lesson');

  // Use individual try/catch to skip indexes that already exist with different names
  const indexOps = [
    () => studentCol.createIndex({ tenantId: 1, isActive: 1 }),
    () => studentCol.createIndex({ 'teacherAssignments.teacherId': 1, 'teacherAssignments.isActive': 1 }),
    () => studentCol.createIndex({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 }),
    () => studentCol.createIndex({ 'academicInfo.instrumentProgress.instrumentName': 1 }),
    () => teacherCol.createIndex({ tenantId: 1, isActive: 1 }),
    () => teacherCol.createIndex({ 'credentials.email': 1, tenantId: 1 }, { unique: true }),
    () => teacherCol.createIndex({ roles: 1 }),
    () => orchestraCol.createIndex({ tenantId: 1, isActive: 1 }),
    () => orchestraCol.createIndex({ conductorId: 1 }),
    () => rehearsalCol.createIndex({ tenantId: 1, isActive: 1 }),
    () => rehearsalCol.createIndex({ tenantId: 1, dayOfWeek: 1, location: 1 }),
    () => theoryCol.createIndex({ tenantId: 1, isActive: 1 }),
    () => theoryCol.createIndex({ tenantId: 1, dayOfWeek: 1, location: 1 }),
  ];

  let created = 0;
  let skipped = 0;
  for (const op of indexOps) {
    try {
      await op();
      created++;
    } catch (err) {
      // Index already exists with a different name — safe to skip
      if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
        skipped++;
      } else {
        throw err;
      }
    }
  }
  if (skipped > 0) {
    console.log(`  (${skipped} indexes already existed with different names, skipped)`);
  }
}

async function seedData(db) {
  // 1. Create tenant
  const tenant = generateTenant();
  await db.collection('tenant').insertOne(tenant);
  console.log(`  Tenant: "${tenant.name}" (slug: ${tenant.slug})`);

  // 2. Create rooms in tenant.settings
  const rooms = LOCATIONS.map(name => ({
    _id: new ObjectId(),
    name,
    isActive: true,
    createdAt: new Date(),
  }));
  await db.collection('tenant').updateOne(
    { _id: tenant._id },
    { $set: { 'settings.rooms': rooms } }
  );
  console.log(`  Rooms: ${rooms.length} rooms in tenant.settings.rooms[]`);

  // 3. Create school year
  const schoolYear = generateSchoolYear();
  await db.collection('school_year').insertOne(schoolYear);
  console.log(`  School year: ${schoolYear.name}`);

  // 4. Create teachers
  const t1 = performance.now();
  const teachers = await generateTeachers();
  await db.collection('teacher').insertMany(teachers);
  const teacherMs = Math.round(performance.now() - t1);
  const totalTimeBlocks = teachers.reduce((sum, t) => sum + t.teaching.timeBlocks.length, 0);
  console.log(`  Teachers: ${teachers.length} with ${totalTimeBlocks} time blocks (${teacherMs}ms)`);

  // Update tenant director to be the admin teacher
  const adminTeacher = teachers[0];
  await db.collection('tenant').updateOne(
    { _id: tenant._id },
    { $set: { 'director.name': `${adminTeacher.personalInfo.firstName} ${adminTeacher.personalInfo.lastName}`, 'director.teacherId': adminTeacher._id.toHexString() } }
  );

  // 5. Create students
  const t2 = performance.now();
  const students = generateStudents(teachers);
  // Insert in batches of 500
  for (let i = 0; i < students.length; i += 500) {
    await db.collection('student').insertMany(students.slice(i, i + 500));
  }
  const studentMs = Math.round(performance.now() - t2);
  console.log(`  Students: ${students.length} (${studentMs}ms)`);

  // 6. Create orchestras
  const t3 = performance.now();
  const orchestras = generateOrchestras(teachers, students, schoolYear._id);
  await db.collection('orchestra').insertMany(orchestras);
  const orchestraMs = Math.round(performance.now() - t3);
  console.log(`  Orchestras: ${orchestras.length} (${orchestraMs}ms)`);

  // 7. Create rehearsals
  const t5 = performance.now();
  const rehearsals = generateRehearsals(orchestras, schoolYear._id);
  await db.collection('rehearsal').insertMany(rehearsals);
  const rehearsalMs = Math.round(performance.now() - t5);
  console.log(`  Rehearsals: ${rehearsals.length} (${rehearsalMs}ms)`);

  // 8. Create theory lessons
  const t6 = performance.now();
  const theoryLessons = generateTheoryLessons(teachers, students, schoolYear._id);
  await db.collection('theory_lesson').insertMany(theoryLessons);
  const theoryMs = Math.round(performance.now() - t6);
  console.log(`  Theory lessons: ${theoryLessons.length} (${theoryMs}ms)`);

  // 9. Create intentional conflicts
  console.log('');
  console.log('  Creating intentional conflicts for Phase 32 testing...');
  const { conflictRehearsals, conflictTheoryLessons, conflictCount } = generateConflicts(
    teachers, rehearsals, theoryLessons, schoolYear._id
  );
  if (conflictRehearsals.length > 0) {
    await db.collection('rehearsal').insertMany(conflictRehearsals);
  }
  if (conflictTheoryLessons.length > 0) {
    await db.collection('theory_lesson').insertMany(conflictTheoryLessons);
  }
  console.log(`  Created ${conflictCount} intentional conflicts for Phase 32 testing`);

  // 10. Create indexes
  const t4 = performance.now();
  await createIndexes(db);
  const indexMs = Math.round(performance.now() - t4);
  console.log(`  Indexes created (${indexMs}ms)`);

  return {
    teachers,
    students,
    orchestras,
    rehearsals: rehearsals.length + conflictRehearsals.length,
    theoryLessons: theoryLessons.length + conflictTheoryLessons.length,
    rooms: rooms.length,
    conflicts: conflictCount,
    adminTeacher,
    totalTimeBlocks,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const dropOnly = args.includes('--drop-only');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const line = '='.repeat(58);
    console.log('');
    console.log(`  ${line}`);
    console.log('    TENUTO.IO -- DEV DATA SEEDER');
    console.log(`    Database: ${DB_NAME}`);
    console.log(`    Tenant: ${TENANT_SLUG}`);
    console.log(`  ${line}`);
    console.log('');

    // Drop existing data if requested
    if (clean || dropOnly) {
      await dropSeededData(db);
      if (dropOnly) {
        console.log('\n  Done. Data cleaned up.\n');
        return;
      }
      console.log('');
    }

    // Seed
    const t0 = performance.now();
    const result = await seedData(db);
    const totalMs = Math.round(performance.now() - t0);

    console.log('');
    console.log(`  ${line}`);
    console.log('    SEEDING COMPLETE');
    console.log(`    Total time: ${totalMs}ms`);
    console.log('');
    console.log('    Login credentials:');
    console.log(`      Email:    ${ADMIN_EMAIL}`);
    console.log(`      Password: ${ADMIN_PASSWORD}`);
    console.log(`      Name:     ${result.adminTeacher.personalInfo.firstName} ${result.adminTeacher.personalInfo.lastName}`);
    console.log(`      Role:     admin`);
    console.log(`      TenantId: ${TENANT_ID_STR}`);
    console.log('');
    console.log('    Data summary:');
    console.log(`      Rooms:          ${result.rooms}`);
    console.log(`      Teachers:       ${result.teachers.length}`);
    console.log(`      Time blocks:    ${result.totalTimeBlocks}`);
    console.log(`      Students:       ${result.students.length}`);
    console.log(`      Orchestras:     ${result.orchestras.length}`);
    console.log(`      Rehearsals:     ${result.rehearsals}`);
    console.log(`      Theory lessons: ${result.theoryLessons}`);
    console.log(`      Conflicts:      ${result.conflicts}`);
    console.log(`  ${line}`);
    console.log('');
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.code === 11000) {
      console.error('\n  Duplicate key error -- run with --clean to drop existing data first.');
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
