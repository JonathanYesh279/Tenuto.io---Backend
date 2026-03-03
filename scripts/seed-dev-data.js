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
// Fixed ObjectId so --clean always finds the old data and auth works
const TENANT_OID = new ObjectId('aaa000000000000000000001');
const TENANT_ID_STR = TENANT_OID.toHexString();
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

// ─── Room Occupancy Tracking ─────────────────────────────────────────────────

/** Global map: key = `${room}::${dayIndex}`, value = [{start, end}] minute ranges */
const roomOccupancy = new Map();

function isRoomAvailable(room, dayIndex, startMin, endMin) {
  const key = `${room}::${dayIndex}`;
  const entries = roomOccupancy.get(key);
  if (!entries) return true;
  return !entries.some(e => startMin < e.end && endMin > e.start);
}

/**
 * Find an available room for the given day + time range.
 * Shuffles LOCATIONS, returns the first available room.
 * Records occupancy on success. Returns null if no room is free.
 */
function pickAvailableRoom(dayIndex, startMin, endMin) {
  const shuffled = [...LOCATIONS].sort(() => Math.random() - 0.5);
  for (const room of shuffled) {
    if (isRoomAvailable(room, dayIndex, startMin, endMin)) {
      const key = `${room}::${dayIndex}`;
      if (!roomOccupancy.has(key)) roomOccupancy.set(key, []);
      roomOccupancy.get(key).push({ start: startMin, end: endMin });
      return room;
    }
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }
function generatePhone() { return `05${randInt(0, 9)}-${randInt(1000000, 9999999)}`; }
function generateAlignedStartTime() {
  const hour = randInt(8, 17);
  const minute = pick([0, 30]);
  return { hour, minute, str: `${pad(hour)}:${pad(minute)}` };
}

// ─── Schedule Helpers (ported from seed-schedules.js) ────────────────────────

function minutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad(h)}:${pad(m)}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Pick a lesson duration with distribution: 30 min (50%), 45 min (40%), 60 min (10%)
 */
function pickDuration() {
  const r = Math.random();
  if (r < 0.5) return 30;
  if (r < 0.9) return 45;
  return 60;
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
    _id: TENANT_OID,
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

      // Generate 2-4 time blocks per teacher (morning/afternoon pattern)
      const timeBlockCount = randInt(2, 4);
      const timeBlocks = [];
      const usedDays = new Set();
      for (let tb = 0; tb < timeBlockCount; tb++) {
        let day = pick(VALID_DAYS);
        // Try to avoid duplicate days
        let attempts = 0;
        while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS); attempts++; }
        usedDays.add(day);

        // Morning (08-10 start) or afternoon (13-15 start) with 2-3 hour span
        const isMorning = Math.random() < 0.5;
        let startHour, spanHours;
        if (isMorning) {
          startHour = randInt(8, 10);
          spanHours = randInt(2, 3);
        } else {
          startHour = randInt(13, 15);
          spanHours = randInt(2, 3);
        }
        const startMin = pick([0, 30]);
        const startTotalMin = startHour * 60 + startMin;
        const endTotalMin = startTotalMin + spanHours * 60;
        const dayIndex = DAY_INDICES[day];
        const room = pickAvailableRoom(dayIndex, startTotalMin, endTotalMin);
        if (!room) continue; // skip this time block if no room available
        const location = room;

        timeBlocks.push({
          _id: new ObjectId(),
          day,
          startTime: minutesToTime(startTotalMin),
          endTime: minutesToTime(endTotalMin),
          totalDuration: spanHours * 60,
          location,
          isActive: true,
          recurring: { isRecurring: true, excludeDates: [] },
          notes: null,
          assignedLessons: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Ensure every teacher has at least 1 time block
      if (timeBlocks.length === 0) {
        // Try multiple day/time combos to find an available room
        let fallbackRoom = null;
        let fallbackDay, fbStart, fbEnd, fbDayIndex;
        for (let attempt = 0; attempt < 20 && !fallbackRoom; attempt++) {
          fallbackDay = pick(VALID_DAYS);
          fbDayIndex = DAY_INDICES[fallbackDay];
          fbStart = randInt(8, 16) * 60 + pick([0, 30]);
          fbEnd = fbStart + 120;
          fallbackRoom = pickAvailableRoom(fbDayIndex, fbStart, fbEnd);
        }
        // Last resort: random room (may conflict, but teacher needs at least 1 block)
        if (!fallbackRoom) fallbackRoom = pick(LOCATIONS);
        timeBlocks.push({
          _id: new ObjectId(),
          day: fallbackDay,
          startTime: minutesToTime(fbStart),
          endTime: minutesToTime(fbEnd),
          totalDuration: 120,
          location: fallbackRoom,
          isActive: true,
          recurring: { isRecurring: true, excludeDates: [] },
          notes: null,
          assignedLessons: [],
          createdAt: new Date(),
          updatedAt: new Date(),
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

/**
 * Generate students with properly-aligned teacherAssignments.
 * Uses cursor-based back-to-back packing to place students within teacher time blocks.
 * Returns { students, lessonRefs } where lessonRefs is Map(teacherId -> Map(blockId -> lesson[]))
 */
function generateStudents(teachers) {
  const students = [];
  const lessonRefs = new Map(); // teacherId -> Map(blockId -> lessonRef[])
  let nameIdx = 0;
  let overflowCount = 0;

  const basePerTeacher = Math.floor(STUDENT_TARGET / teachers.length);
  let remainder = STUDENT_TARGET - basePerTeacher * teachers.length;

  for (const teacher of teachers) {
    const count = basePerTeacher + (remainder-- > 0 ? 1 : 0);
    const instrument = teacher.professionalInfo.instruments[0];
    const teacherId = teacher._id.toHexString();
    const teacherName = `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}`;

    // Build block slots with cursor-based packing
    const blocks = teacher.teaching.timeBlocks;
    const blockSlots = blocks.map(b => ({
      block: b,
      capacity: timeToMinutes(b.endTime) - timeToMinutes(b.startTime),
      cursor: timeToMinutes(b.startTime),
      endMin: timeToMinutes(b.endTime),
    }));
    const totalCapacity = blockSlots.reduce((sum, bs) => sum + bs.capacity, 0);

    // Collect this teacher's students in order so we can pack them
    const teacherStudents = [];
    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(nameIdx / FIRST_NAMES.length) % LAST_NAMES.length];
      nameIdx++;
      teacherStudents.push({ firstName, lastName, nameIdx });
    }

    // Distribute students proportionally across blocks
    let studentIdx = 0;
    const lessonsByBlock = new Map(); // blockId -> lesson[]

    for (const bs of blockSlots) {
      const blockId = bs.block._id.toHexString();
      if (!lessonsByBlock.has(blockId)) lessonsByBlock.set(blockId, []);

      // Proportional share of students for this block
      const share = Math.round((bs.capacity / totalCapacity) * teacherStudents.length);

      for (let j = 0; j < share && studentIdx < teacherStudents.length; j++) {
        const duration = pickDuration();

        // Check if lesson fits in block (strict: no overflow past block end)
        if (bs.cursor + duration > bs.endMin) {
          break;
        }

        const s = teacherStudents[studentIdx];
        const lessonId = new ObjectId();
        const scheduleSlotId = new ObjectId();
        const lessonStartMin = bs.cursor;
        const lessonEndMin = bs.cursor + duration;
        const startTime = minutesToTime(lessonStartMin);
        const endTime = minutesToTime(lessonEndMin);
        const day = bs.block.day;
        const location = bs.block.location;

        const student = _buildStudent(s, nameIdx, instrument, {
          teacherId,
          day,
          time: startTime,
          duration,
          location,
          blockId,
          lessonId: lessonId.toHexString(),
          scheduleSlotId: scheduleSlotId.toHexString(),
          endTime,
        });
        students.push(student);

        // Collect lesson ref for teacher's assignedLessons
        lessonsByBlock.get(blockId).push({
          _id: lessonId,
          studentId: student._id.toHexString(),
          studentName: `${s.firstName} ${s.lastName}`,
          lessonStartTime: startTime,
          lessonEndTime: endTime,
          duration,
          notes: null,
          isActive: true,
          isRecurring: true,
          startDate: new Date('2024-09-01'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        bs.cursor = lessonEndMin;
        studentIdx++;
      }
    }

    // Handle remaining students: force 30-min slots into block with most remaining capacity
    while (studentIdx < teacherStudents.length && blockSlots.length > 0) {
      // Find block with most remaining capacity
      let bestSlot = blockSlots[0];
      for (const bs of blockSlots) {
        const remaining = bs.endMin - bs.cursor;
        const bestRemaining = bestSlot.endMin - bestSlot.cursor;
        if (remaining > bestRemaining) bestSlot = bs;
      }

      // Stop if no block has enough room (strict: no overflow past block end)
      const duration = 30; // Force minimum for overflow
      if (bestSlot.cursor + duration > bestSlot.endMin) {
        break; // All blocks full — remaining students unassigned
      }

      const s = teacherStudents[studentIdx];
      const lessonId = new ObjectId();
      const scheduleSlotId = new ObjectId();
      const lessonStartMin = bestSlot.cursor;
      const lessonEndMin = bestSlot.cursor + duration;
      const startTime = minutesToTime(lessonStartMin);
      const endTime = minutesToTime(lessonEndMin);
      const day = bestSlot.block.day;
      const location = bestSlot.block.location;
      const blockId = bestSlot.block._id.toHexString();

      if (!lessonsByBlock.has(blockId)) lessonsByBlock.set(blockId, []);

      const student = _buildStudent(s, nameIdx, instrument, {
        teacherId,
        day,
        time: startTime,
        duration,
        location,
        blockId,
        lessonId: lessonId.toHexString(),
        scheduleSlotId: scheduleSlotId.toHexString(),
        endTime,
      });
      students.push(student);

      lessonsByBlock.get(blockId).push({
        _id: lessonId,
        studentId: student._id.toHexString(),
        studentName: `${s.firstName} ${s.lastName}`,
        lessonStartTime: startTime,
        lessonEndTime: endTime,
        duration,
        notes: null,
        isActive: true,
        isRecurring: true,
        startDate: new Date('2024-09-01'),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      bestSlot.cursor += duration;
      studentIdx++;
      overflowCount++;
    }

    lessonRefs.set(teacherId, lessonsByBlock);
  }

  if (overflowCount > 0) {
    console.log(`  (${overflowCount} overflow students packed into 30-min slots)`);
  }

  return { students, lessonRefs };
}

/** Build a single student document with aligned teacherAssignment */
function _buildStudent(s, nameIdx, instrument, assignment) {
  return {
    _id: new ObjectId(),
    tenantId: TENANT_ID_STR,
    isActive: true,
    personalInfo: {
      firstName: s.firstName,
      lastName: s.lastName,
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
        teacherId: assignment.teacherId,
        isActive: true,
        day: assignment.day,
        time: assignment.time,
        duration: assignment.duration,
        location: assignment.location,
        timeBlockId: assignment.blockId,
        lessonId: assignment.lessonId,
        scheduleSlotId: assignment.scheduleSlotId,
        scheduleInfo: {
          day: assignment.day,
          startTime: assignment.time,
          endTime: assignment.endTime,
          duration: assignment.duration,
          location: assignment.location,
          notes: null,
        },
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
  };
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

      // Conflict-aware room selection
      const startTotalMin = timeToMinutes(start.str);
      const endTotalMin = timeToMinutes(endTime);
      const room = pickAvailableRoom(dayIndex, startTotalMin, endTotalMin);
      if (!room) continue; // skip this rehearsal if no room available

      rehearsals.push({
        _id: new ObjectId(),
        tenantId: TENANT_ID_STR,
        groupId: orchestra._id.toString(),
        type: pick(['תזמורת', 'הרכב']),
        date,
        dayOfWeek: dayIndex,
        startTime: start.str,
        endTime,
        location: room,
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

      // Conflict-aware room selection
      const startTotalMin = timeToMinutes(start.str);
      const endTotalMin = timeToMinutes(endTime);
      const room = pickAvailableRoom(dayIndex, startTotalMin, endTotalMin);
      if (!room) continue; // skip this theory lesson if no room available

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
        location: room,
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

// ─── Database Operations ─────────────────────────────────────────────────────

async function dropSeededData(db) {
  console.log('  Cleaning ALL existing data...');

  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  // Drop ALL data from all relevant collections (all tenants)
  const ops = [];
  if (names.includes('student')) ops.push(db.collection('student').deleteMany({}));
  if (names.includes('teacher')) ops.push(db.collection('teacher').deleteMany({}));
  if (names.includes('orchestra')) ops.push(db.collection('orchestra').deleteMany({}));
  if (names.includes('school_year')) ops.push(db.collection('school_year').deleteMany({}));
  if (names.includes('rehearsal')) ops.push(db.collection('rehearsal').deleteMany({}));
  if (names.includes('theory_lesson')) ops.push(db.collection('theory_lesson').deleteMany({}));
  if (names.includes('tenant')) ops.push(db.collection('tenant').deleteMany({}));
  if (names.includes('import_log')) ops.push(db.collection('import_log').deleteMany({}));

  const results = await Promise.all(ops);
  const total = results.reduce((sum, r) => sum + r.deletedCount, 0);
  console.log(`  Deleted ${total} documents across all tenants`);
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
  // Clear room occupancy for re-runs
  roomOccupancy.clear();

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

  // 5. Create students (with aligned teacherAssignments)
  const t2 = performance.now();
  const { students, lessonRefs } = generateStudents(teachers);
  // Insert in batches of 500
  for (let i = 0; i < students.length; i += 500) {
    await db.collection('student').insertMany(students.slice(i, i + 500));
  }
  const studentMs = Math.round(performance.now() - t2);
  console.log(`  Students: ${students.length} (${studentMs}ms)`);

  // 5b. Populate assignedLessons on teacher time blocks
  const t2b = performance.now();
  const enrichOps = [];
  let totalLessons = 0;
  let enrichedTeachers = 0;

  for (const teacher of teachers) {
    const teacherId = teacher._id.toHexString();
    const blockRefs = lessonRefs.get(teacherId);
    if (!blockRefs) continue;

    let hasLessons = false;
    const updatedBlocks = teacher.teaching.timeBlocks.map(block => {
      const lessons = blockRefs.get(block._id.toHexString()) || [];
      totalLessons += lessons.length;
      if (lessons.length > 0) hasLessons = true;
      return { ...block, assignedLessons: lessons };
    });

    if (hasLessons) enrichedTeachers++;

    // Update in-memory teacher for downstream use (conflicts, etc.)
    teacher.teaching.timeBlocks = updatedBlocks;

    enrichOps.push({
      updateOne: {
        filter: { _id: teacher._id },
        update: {
          $set: {
            'teaching.timeBlocks': updatedBlocks,
            updatedAt: new Date(),
          },
        },
      },
    });
  }

  // bulkWrite in batches of 50
  for (let i = 0; i < enrichOps.length; i += 50) {
    await db.collection('teacher').bulkWrite(enrichOps.slice(i, i + 50));
  }
  const enrichMs = Math.round(performance.now() - t2b);
  console.log(`  Schedule enrichment: ${totalLessons} lessons across ${enrichedTeachers} teachers (${enrichMs}ms)`);

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

  // 9. Create indexes
  const t4 = performance.now();
  await createIndexes(db);
  const indexMs = Math.round(performance.now() - t4);
  console.log(`  Indexes created (${indexMs}ms)`);

  // 10. Verification step
  console.log('');
  console.log('  ── Schedule Verification ──');
  const tv = performance.now();

  // Build teacher block lookup
  const teacherBlockMap = new Map();
  const blockRangeMap = new Map();
  let verifyLessonRefs = 0;
  let blocksWithLessons = 0;
  let verifyTotalBlocks = 0;

  for (const t of teachers) {
    const tId = t._id.toHexString();
    const blockIds = new Set();
    for (const block of (t.teaching?.timeBlocks || [])) {
      verifyTotalBlocks++;
      const bId = block._id.toHexString();
      blockIds.add(bId);
      blockRangeMap.set(bId, {
        startMin: timeToMinutes(block.startTime),
        endMin: timeToMinutes(block.endTime),
        day: block.day,
      });
      const lessonCount = (block.assignedLessons || []).length;
      verifyLessonRefs += lessonCount;
      if (lessonCount > 0) blocksWithLessons++;
    }
    teacherBlockMap.set(tId, blockIds);
  }

  // Validate student assignments
  let validAssignments = 0;
  let invalidBlockRef = 0;
  let missingScheduleInfo = 0;
  let timeMismatch = 0;

  for (const s of students) {
    for (const a of (s.teacherAssignments || [])) {
      if (!a.timeBlockId) { invalidBlockRef++; continue; }
      const teacherBlocks = teacherBlockMap.get(a.teacherId);
      if (!teacherBlocks || !teacherBlocks.has(a.timeBlockId)) {
        invalidBlockRef++;
        continue;
      }
      if (!a.scheduleInfo) { missingScheduleInfo++; }

      // Check lesson time falls within block range (15-min tolerance)
      const blockRange = blockRangeMap.get(a.timeBlockId);
      if (blockRange && a.time) {
        const lessonStart = timeToMinutes(a.time);
        const lessonEnd = lessonStart + (a.duration || 0);
        if (lessonStart < blockRange.startMin || lessonEnd > blockRange.endMin + 15) {
          timeMismatch++;
        }
      }
      validAssignments++;
    }
  }

  // Cross-reference sampling: verify 10 random teacher-student pairs
  let crossRefValid = 0;
  const crossRefTotal = 10;
  const sampleStudents = pickN(students.filter(s => s.teacherAssignments?.length > 0), crossRefTotal);

  for (const student of sampleStudents) {
    const assignment = student.teacherAssignments[0];
    const teacher = teachers.find(t => t._id.toHexString() === assignment.teacherId);
    if (!teacher) continue;

    const block = teacher.teaching.timeBlocks.find(b => b._id.toHexString() === assignment.timeBlockId);
    if (!block) continue;

    const matchingLesson = (block.assignedLessons || []).find(
      l => l._id.toHexString() === assignment.lessonId
    );
    if (!matchingLesson) continue;

    // Verify bidirectional consistency
    const dayMatch = assignment.day === block.day;
    const timeMatch = assignment.time === matchingLesson.lessonStartTime;
    const locationMatch = assignment.location === block.location;
    const studentIdMatch = matchingLesson.studentId === student._id.toHexString();

    if (dayMatch && timeMatch && locationMatch && studentIdMatch) {
      crossRefValid++;
    }
  }

  const verifyMs = Math.round(performance.now() - tv);
  console.log(`    Total blocks: ${verifyTotalBlocks}, with lessons: ${blocksWithLessons}`);
  console.log(`    Total lesson refs in teacher blocks: ${verifyLessonRefs}`);
  console.log(`    Valid student assignments: ${validAssignments}`);
  console.log(`    Invalid block refs: ${invalidBlockRef}`);
  console.log(`    Missing scheduleInfo: ${missingScheduleInfo}`);
  console.log(`    Time outside block range: ${timeMismatch}`);
  console.log(`    Cross-references valid: ${crossRefValid}/${crossRefTotal}`);
  console.log(`    Verification time: ${verifyMs}ms`);

  // Room conflict audit: check for LESSON-level overlaps in same room+day
  // (This mirrors what the room-schedule API detects — individual lessons, not blocks)
  const roomDayBlocks = new Map(); // key: room::day -> [{start, end, teacher}]
  for (const t of teachers) {
    const tName = `${t.personalInfo.firstName} ${t.personalInfo.lastName}`;
    for (const block of (t.teaching?.timeBlocks || [])) {
      const key = `${block.location}::${block.day}`;
      if (!roomDayBlocks.has(key)) roomDayBlocks.set(key, []);
      const activeLessons = (block.assignedLessons || []).filter(l => l.isActive !== false);
      if (activeLessons.length > 0) {
        // Emit each lesson as a separate activity (same as room-schedule API)
        for (const lesson of activeLessons) {
          roomDayBlocks.get(key).push({
            start: timeToMinutes(lesson.lessonStartTime),
            end: timeToMinutes(lesson.lessonEndTime),
            teacher: tName,
          });
        }
      } else {
        roomDayBlocks.get(key).push({
          start: timeToMinutes(block.startTime),
          end: timeToMinutes(block.endTime),
          teacher: tName,
        });
      }
    }
  }
  // Also check rehearsals and theory lessons
  for (const r of rehearsals) {
    const dayName = VALID_DAYS[r.dayOfWeek] || `day${r.dayOfWeek}`;
    const key = `${r.location}::${dayName}`;
    if (!roomDayBlocks.has(key)) roomDayBlocks.set(key, []);
    roomDayBlocks.get(key).push({
      start: timeToMinutes(r.startTime),
      end: timeToMinutes(r.endTime),
      teacher: 'rehearsal',
    });
  }
  for (const tl of theoryLessons) {
    const dayName = VALID_DAYS[tl.dayOfWeek] || `day${tl.dayOfWeek}`;
    const key = `${tl.location}::${dayName}`;
    if (!roomDayBlocks.has(key)) roomDayBlocks.set(key, []);
    roomDayBlocks.get(key).push({
      start: timeToMinutes(tl.startTime),
      end: timeToMinutes(tl.endTime),
      teacher: 'theory',
    });
  }
  let roomConflicts = 0;
  const conflictExamples = [];
  for (const [key, slots] of roomDayBlocks) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        if (a.start < b.end && a.end > b.start) {
          roomConflicts++;
          if (conflictExamples.length < 3) {
            conflictExamples.push(`${key}: ${a.teacher} ${minutesToTime(a.start)}-${minutesToTime(a.end)} vs ${b.teacher} ${minutesToTime(b.start)}-${minutesToTime(b.end)}`);
          }
        }
      }
    }
  }
  console.log(`    Room-time conflicts: ${roomConflicts}`);
  if (conflictExamples.length > 0) {
    for (const ex of conflictExamples) console.log(`      ↳ ${ex}`);
  }

  if (invalidBlockRef === 0 && missingScheduleInfo === 0 && timeMismatch === 0 && crossRefValid === crossRefTotal && roomConflicts === 0) {
    console.log('    All checks passed');
  } else {
    console.log('    Issues detected -- see counts above');
  }

  return {
    teachers,
    students,
    orchestras,
    rehearsals: rehearsals.length,
    theoryLessons: theoryLessons.length,
    rooms: rooms.length,
    adminTeacher,
    totalTimeBlocks,
    totalLessons,
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
    console.log(`      Lessons:        ${result.totalLessons}`);
    console.log(`      Students:       ${result.students.length}`);
    console.log(`      Orchestras:     ${result.orchestras.length}`);
    console.log(`      Rehearsals:     ${result.rehearsals}`);
    console.log(`      Theory lessons: ${result.theoryLessons}`);
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
