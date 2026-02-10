/**
 * Tenuto.io Dev Data Seed Script
 *
 * Populates the main Tenuto-DB with realistic test data:
 *   - 1 tenant (school)
 *   - 1 school year (current)
 *   - ~130 teachers (1 admin with real login credentials)
 *   - ~1,200 students with teacher assignments
 *   - ~50 orchestras/ensembles with members
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
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }
function generatePhone() { return `05${randInt(0, 9)}-${randInt(1000000, 9999999)}`; }
function generateTime() {
  const hour = randInt(8, 18);
  const minute = pick([0, 15, 30, 45]);
  return `${pad(hour)}:${pad(minute)}`;
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
          room: pick(LOCATIONS),
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
            location: teacherTimeBlock.room,
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
  if (names.includes('tenant')) ops.push(db.collection('tenant').deleteMany({ slug: TENANT_SLUG }));

  const results = await Promise.all(ops);
  const total = results.reduce((sum, r) => sum + r.deletedCount, 0);
  console.log(`  Deleted ${total} documents`);
}

async function createIndexes(db) {
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');
  const orchestraCol = db.collection('orchestra');

  await Promise.all([
    studentCol.createIndex({ tenantId: 1, isActive: 1 }),
    studentCol.createIndex({ 'teacherAssignments.teacherId': 1, 'teacherAssignments.isActive': 1 }),
    studentCol.createIndex({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 }),
    studentCol.createIndex({ 'academicInfo.instrumentProgress.instrumentName': 1 }),
    teacherCol.createIndex({ tenantId: 1, isActive: 1 }),
    teacherCol.createIndex({ 'credentials.email': 1, tenantId: 1 }, { unique: true }),
    teacherCol.createIndex({ roles: 1 }),
    orchestraCol.createIndex({ tenantId: 1, isActive: 1 }),
    orchestraCol.createIndex({ conductorId: 1 }),
  ]);
}

async function seedData(db) {
  // 1. Create tenant
  const tenant = generateTenant();
  await db.collection('tenant').insertOne(tenant);
  console.log(`  ✓ Tenant: "${tenant.name}" (slug: ${tenant.slug})`);

  // 2. Create school year
  const schoolYear = generateSchoolYear();
  await db.collection('school_year').insertOne(schoolYear);
  console.log(`  ✓ School year: ${schoolYear.name}`);

  // 3. Create teachers
  const t1 = performance.now();
  const teachers = await generateTeachers();
  await db.collection('teacher').insertMany(teachers);
  const teacherMs = Math.round(performance.now() - t1);
  console.log(`  ✓ Teachers: ${teachers.length} (${teacherMs}ms)`);

  // Update tenant director to be the admin teacher
  const adminTeacher = teachers[0];
  await db.collection('tenant').updateOne(
    { _id: tenant._id },
    { $set: { 'director.name': `${adminTeacher.personalInfo.firstName} ${adminTeacher.personalInfo.lastName}`, 'director.teacherId': adminTeacher._id.toHexString() } }
  );

  // 4. Create students
  const t2 = performance.now();
  const students = generateStudents(teachers);
  // Insert in batches of 500
  for (let i = 0; i < students.length; i += 500) {
    await db.collection('student').insertMany(students.slice(i, i + 500));
  }
  const studentMs = Math.round(performance.now() - t2);
  console.log(`  ✓ Students: ${students.length} (${studentMs}ms)`);

  // 5. Create orchestras
  const t3 = performance.now();
  const orchestras = generateOrchestras(teachers, students, schoolYear._id);
  await db.collection('orchestra').insertMany(orchestras);
  const orchestraMs = Math.round(performance.now() - t3);
  console.log(`  ✓ Orchestras: ${orchestras.length} (${orchestraMs}ms)`);

  // 6. Create indexes
  const t4 = performance.now();
  await createIndexes(db);
  const indexMs = Math.round(performance.now() - t4);
  console.log(`  ✓ Indexes created (${indexMs}ms)`);

  return { teachers, students, orchestras, adminTeacher };
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

    const line = '═'.repeat(58);
    console.log('');
    console.log(`  ${line}`);
    console.log('    TENUTO.IO — DEV DATA SEEDER');
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
    const { adminTeacher } = await seedData(db);
    const totalMs = Math.round(performance.now() - t0);

    console.log('');
    console.log(`  ${line}`);
    console.log('    SEEDING COMPLETE');
    console.log(`    Total time: ${totalMs}ms`);
    console.log('');
    console.log('    Login credentials:');
    console.log(`      Email:    ${ADMIN_EMAIL}`);
    console.log(`      Password: ${ADMIN_PASSWORD}`);
    console.log(`      Name:     ${adminTeacher.personalInfo.firstName} ${adminTeacher.personalInfo.lastName}`);
    console.log(`      Role:     מנהל (admin)`);
    console.log(`      TenantId: ${TENANT_ID_STR}`);
    console.log('');
    console.log('    Data summary:');
    console.log(`      Teachers:   ~${TEACHER_COUNT}`);
    console.log(`      Students:   ~${STUDENT_TARGET}`);
    console.log(`      Orchestras: ~${ORCHESTRA_COUNT}`);
    console.log(`  ${line}`);
    console.log('');
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.code === 11000) {
      console.error('\n  Duplicate key error — run with --clean to drop existing data first.');
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
