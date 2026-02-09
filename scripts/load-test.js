/**
 * Tenuto.io Load Test Script
 *
 * Seeds a separate Tenuto-DB-LoadTest database with 130 teachers + 1,200 students,
 * then benchmarks the exact MongoDB queries used in production.
 *
 * Usage:
 *   node scripts/load-test.js              # Seed + benchmark + keep data
 *   node scripts/load-test.js --cleanup    # Seed + benchmark + drop test DB
 *   node scripts/load-test.js --seed-only  # Just seed, skip benchmarks
 *   node scripts/load-test.js --query-only # Skip seeding, run benchmarks on existing data
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

const DB_NAME = 'Tenuto-DB-LoadTest';
const TENANT_ID = 'loadtest-tenant-001';
const TEACHER_COUNT = 130;
const STUDENT_TARGET = 1200;
const BENCHMARK_ITERATIONS = 5;
const PASS_THRESHOLD_MS = 500;

// ─── Inlined Constants (no app imports to avoid side effects) ────────────────

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const VALID_DURATIONS = [30, 45, 60];

const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

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

const FIRST_NAMES = [
  'יוסי', 'דוד', 'משה', 'אברהם', 'יעקב', 'שרה', 'רחל', 'לאה', 'רבקה', 'מרים',
  'אורי', 'נועם', 'עידן', 'יובל', 'תומר', 'שירה', 'מיכל', 'נועה', 'יעל', 'דנה',
  'איתן', 'אלון', 'גיל', 'רון', 'עומר', 'ליאור', 'אביב', 'טל', 'שחר', 'עדי',
  'אריאל', 'נתן', 'אסף', 'בן', 'דניאל', 'עמית', 'ניר', 'אייל', 'מתן', 'רועי',
  'הדר', 'אורן', 'יונתן', 'אלי', 'שמואל', 'נדב', 'גל', 'ליאם', 'איתמר', 'עמרי',
];

const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שלום', 'חדד',
  'אזולאי', 'בן דוד', 'מלכה', 'נחמיאס', 'גבאי', 'עמר', 'שמעון', 'ישראלי', 'יוסף', 'חיים',
  'ברק', 'זוהר', 'שפירא', 'גולן', 'אדרי', 'סויסה', 'בנימין', 'עטיה', 'אלבז', 'טל',
  'רוזנברג', 'שטרן', 'קפלן', 'אוחנה', 'מור', 'ברזילי', 'אלוני', 'רגב', 'שרעבי', 'סבג',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function generatePhone() {
  return `05${randInt(0, 9)}${randInt(1000000, 9999999)}`;
}

function generateTime() {
  const hour = randInt(8, 16);
  const minute = pick([0, 15, 30, 45]);
  return `${pad(hour)}:${pad(minute)}`;
}

function formatMs(ms) {
  return `${Math.round(ms)}ms`;
}

function formatCount(n) {
  return n.toLocaleString('en-US');
}

// ─── Data Generation ─────────────────────────────────────────────────────────

function generateTeachers() {
  const teachers = [];
  let nameIdx = 0;

  for (const dept of DEPARTMENT_CONFIG) {
    for (let i = 0; i < dept.teachers; i++) {
      const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(nameIdx / FIRST_NAMES.length) % LAST_NAMES.length];
      nameIdx++;

      const instrument = pick(dept.instruments);
      const email = `teacher${nameIdx}@tenuto-test.com`;
      const _id = new ObjectId();

      // Assign roles: all are 'מורה', some get additional roles
      const roles = ['מורה'];
      if (teachers.length < 5) roles.push('מנהל');
      else if (teachers.length < 13) roles.push('מנצח');

      // Generate 2-3 time blocks
      const timeBlockCount = randInt(2, 3);
      const timeBlocks = [];
      for (let tb = 0; tb < timeBlockCount; tb++) {
        timeBlocks.push({
          _id: new ObjectId(),
          day: pick(VALID_DAYS),
          startTime: generateTime(),
          endTime: generateTime(),
          room: `חדר ${randInt(1, 20)}`,
          assignedLessons: [],
        });
      }

      teachers.push({
        _id,
        tenantId: TENANT_ID,
        isActive: true,
        personalInfo: {
          firstName,
          lastName,
          phone: generatePhone(),
          email,
          address: { city: 'תל אביב', street: `רחוב ${randInt(1, 200)}` },
        },
        roles,
        professionalInfo: {
          instruments: [instrument],
          department: dept.department,
        },
        credentials: {
          email,
          passwordHash: '$2b$10$fakehashforloadtesting000000000000000000000000',
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

  // Distribute students across teachers as evenly as possible
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
        tenantId: TENANT_ID,
        isActive: true,
        personalInfo: {
          firstName,
          lastName,
          phone: generatePhone(),
          email: `student${nameIdx}@tenuto-test.com`,
          parentPhone: generatePhone(),
          parentName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        },
        academicInfo: {
          class: pick(VALID_CLASSES),
          instrumentProgress: [
            {
              instrumentName: instrument,
              currentStage: randInt(1, 8),
              isPrimary: true,
              tests: {
                technicalTest: { status: pick(['עבר', 'לא נבחן']) },
                stageTest: { status: pick(['עבר', 'לא נבחן']) },
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

// ─── Index Definitions ───────────────────────────────────────────────────────

async function createIndexes(db) {
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');

  await Promise.all([
    // Student indexes
    studentCol.createIndex({ tenantId: 1, isActive: 1 }),
    studentCol.createIndex({ 'teacherAssignments.teacherId': 1, 'teacherAssignments.isActive': 1 }),
    studentCol.createIndex({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 }),
    studentCol.createIndex({ 'academicInfo.instrumentProgress.instrumentName': 1 }),

    // Teacher indexes
    teacherCol.createIndex({ tenantId: 1, isActive: 1 }),
    teacherCol.createIndex({ 'credentials.email': 1, tenantId: 1 }, { unique: true }),
    teacherCol.createIndex({ roles: 1 }),
  ]);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed(db) {
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');

  // Drop existing collections
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);
  if (names.includes('student')) await studentCol.drop();
  if (names.includes('teacher')) await teacherCol.drop();

  // Create indexes
  const t0 = performance.now();
  await createIndexes(db);
  const indexTime = performance.now() - t0;

  // Seed teachers
  const t1 = performance.now();
  const teachers = generateTeachers();
  await teacherCol.insertMany(teachers);
  const teacherTime = performance.now() - t1;

  // Seed students
  const t2 = performance.now();
  const students = generateStudents(teachers);
  // Insert in batches of 500 to avoid overly large single inserts
  for (let i = 0; i < students.length; i += 500) {
    await studentCol.insertMany(students.slice(i, i + 500));
  }
  const studentTime = performance.now() - t2;

  return { teachers, teacherTime, studentTime, indexTime };
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

function defineBenchmarks(db, sampleTeacherId, sampleStudentId) {
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');

  return [
    {
      name: 'All students (admin)',
      run: () => studentCol.find({ tenantId: TENANT_ID, isActive: true }).toArray(),
    },
    {
      name: 'Students by teacher (scoped)',
      run: () =>
        studentCol
          .find({
            tenantId: TENANT_ID,
            isActive: true,
            'teacherAssignments.teacherId': sampleTeacherId,
            'teacherAssignments.isActive': true,
          })
          .toArray(),
    },
    {
      name: 'Single student by ID',
      run: () => studentCol.findOne({ _id: ObjectId.createFromHexString(sampleStudentId) }),
    },
    {
      name: 'All teachers',
      run: () => teacherCol.find({ tenantId: TENANT_ID, isActive: true }).toArray(),
    },
    {
      name: 'Single teacher by ID',
      run: () => teacherCol.findOne({ _id: ObjectId.createFromHexString(sampleTeacherId) }),
    },
    {
      name: 'Teacher lessons (aggregation)',
      run: () =>
        studentCol
          .aggregate([
            {
              $match: {
                'teacherAssignments.teacherId': sampleTeacherId,
                'teacherAssignments.isActive': { $ne: false },
                isActive: { $ne: false },
              },
            },
            { $unwind: '$teacherAssignments' },
            {
              $match: {
                'teacherAssignments.teacherId': sampleTeacherId,
                'teacherAssignments.isActive': { $ne: false },
              },
            },
            {
              $project: {
                studentId: '$_id',
                studentName: {
                  $concat: [
                    { $ifNull: ['$personalInfo.firstName', ''] },
                    ' ',
                    { $ifNull: ['$personalInfo.lastName', ''] },
                  ],
                },
                instrument: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$academicInfo.instrumentProgress',
                        as: 'inst',
                        cond: { $eq: ['$$inst.isPrimary', true] },
                      },
                    },
                    0,
                  ],
                },
                day: '$teacherAssignments.day',
                time: '$teacherAssignments.time',
                duration: '$teacherAssignments.duration',
                location: '$teacherAssignments.location',
              },
            },
            { $sort: { day: 1, time: 1 } },
          ])
          .toArray(),
    },
    {
      name: 'Teacher weekly schedule',
      run: () =>
        studentCol
          .aggregate([
            {
              $match: {
                'teacherAssignments.teacherId': sampleTeacherId,
                'teacherAssignments.isActive': { $ne: false },
                isActive: { $ne: false },
              },
            },
            { $unwind: '$teacherAssignments' },
            {
              $match: {
                'teacherAssignments.teacherId': sampleTeacherId,
                'teacherAssignments.isActive': { $ne: false },
              },
            },
            {
              $group: {
                _id: '$teacherAssignments.day',
                lessons: {
                  $push: {
                    studentName: {
                      $concat: [
                        { $ifNull: ['$personalInfo.firstName', ''] },
                        ' ',
                        { $ifNull: ['$personalInfo.lastName', ''] },
                      ],
                    },
                    time: '$teacherAssignments.time',
                    duration: '$teacherAssignments.duration',
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray(),
    },
    {
      name: 'Student search by name ($regex)',
      run: () =>
        studentCol
          .find({
            tenantId: TENANT_ID,
            isActive: true,
            $or: [
              { 'personalInfo.firstName': { $regex: 'יוסי', $options: 'i' } },
              { 'personalInfo.lastName': { $regex: 'כהן', $options: 'i' } },
            ],
          })
          .toArray(),
    },
    {
      name: 'Students by instrument',
      run: () =>
        studentCol
          .find({
            tenantId: TENANT_ID,
            isActive: true,
            'academicInfo.instrumentProgress.instrumentName': 'כינור',
          })
          .toArray(),
    },
    {
      name: 'Pagination (page 1, limit 50)',
      run: async () => {
        const filter = { tenantId: TENANT_ID, isActive: true };
        const [data, totalCount] = await Promise.all([
          studentCol.find(filter).skip(0).limit(50).toArray(),
          studentCol.countDocuments(filter),
        ]);
        return { data, totalCount };
      },
    },
  ];
}

async function runBenchmarks(db) {
  // Grab sample IDs from existing data
  const studentCol = db.collection('student');
  const teacherCol = db.collection('teacher');

  const sampleTeacher = await teacherCol.findOne({ tenantId: TENANT_ID });
  const sampleStudent = await studentCol.findOne({ tenantId: TENANT_ID });

  if (!sampleTeacher || !sampleStudent) {
    console.error('  ERROR: No data found. Run without --query-only first.');
    process.exit(1);
  }

  const sampleTeacherId = sampleTeacher._id.toHexString();
  const sampleStudentId = sampleStudent._id.toHexString();

  const benchmarks = defineBenchmarks(db, sampleTeacherId, sampleStudentId);
  const results = [];

  // Warmup: run each query once to prime Atlas connection/cache
  for (const bench of benchmarks) {
    await bench.run();
  }

  for (const bench of benchmarks) {
    const times = [];
    let lastCount = 0;

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      const t0 = performance.now();
      const result = await bench.run();
      const elapsed = performance.now() - t0;
      times.push(elapsed);

      // Determine result count
      if (Array.isArray(result)) lastCount = result.length;
      else if (result && typeof result === 'object' && result.data) lastCount = result.data.length;
      else if (result) lastCount = 1;
      else lastCount = 0;
    }

    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    results.push({
      name: bench.name,
      count: lastCount,
      min,
      avg,
      max,
      pass: avg < PASS_THRESHOLD_MS,
    });
  }

  return results;
}

// ─── Output ──────────────────────────────────────────────────────────────────

function printResults(seedInfo, queryResults) {
  const line = '═'.repeat(58);
  const thin = '─'.repeat(58);

  console.log('');
  console.log(`  ${line}`);
  console.log('    TENUTO.IO LOAD TEST RESULTS');
  console.log(`    Database: ${DB_NAME}`);
  console.log(`    Teachers: ${formatCount(TEACHER_COUNT)} | Students: ${formatCount(STUDENT_TARGET)}`);
  console.log(`  ${line}`);
  console.log('');

  if (seedInfo) {
    console.log(`  SEED: ${formatCount(TEACHER_COUNT)} teachers (${formatMs(seedInfo.teacherTime)}) + ${formatCount(STUDENT_TARGET)} students (${formatMs(seedInfo.studentTime)}) + indexes (${formatMs(seedInfo.indexTime)})`);
    console.log('');
  }

  if (queryResults) {
    const passed = queryResults.filter((r) => r.pass).length;

    console.log(`  QUERIES (${BENCHMARK_ITERATIONS} iterations, showing min/avg/max)`);
    console.log(`  ${thin}`);

    // Header
    const nameW = 32;
    const colW = 8;
    console.log(
      `  ${'Test'.padEnd(nameW)}${'Count'.padStart(colW)}${'Min'.padStart(colW)}${'Avg'.padStart(colW)}${'Max'.padStart(colW)}`
    );
    console.log(`  ${thin}`);

    for (const r of queryResults) {
      const mark = r.pass ? ' ' : '!';
      console.log(
        `${mark} ${r.name.padEnd(nameW)}${formatCount(r.count).padStart(colW)}${formatMs(r.min).padStart(colW)}${formatMs(r.avg).padStart(colW)}${formatMs(r.max).padStart(colW)}`
      );
    }

    console.log('');
    if (passed === queryResults.length) {
      console.log(`  RESULT: PASS (${passed}/${queryResults.length} queries — avg under ${PASS_THRESHOLD_MS}ms)`);
    } else {
      console.log(`  RESULT: FAIL (${passed}/${queryResults.length} queries — avg under ${PASS_THRESHOLD_MS}ms)`);
      for (const r of queryResults.filter((r) => !r.pass)) {
        console.log(`    ! ${r.name}: avg ${formatMs(r.avg)}`);
      }
    }
    console.log(`  ${line}`);
    console.log('');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cleanup = args.includes('--cleanup');
  const seedOnly = args.includes('--seed-only');
  const queryOnly = args.includes('--query-only');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`\n  Connected to MongoDB — using database: ${DB_NAME}`);

    let seedInfo = null;
    let queryResults = null;

    // Seed phase
    if (!queryOnly) {
      console.log('  Seeding data...');
      seedInfo = await seed(db);
      console.log(`  Seeded ${formatCount(TEACHER_COUNT)} teachers + ${formatCount(STUDENT_TARGET)} students`);
    }

    // Benchmark phase
    if (!seedOnly) {
      console.log('  Running benchmarks...');
      queryResults = await runBenchmarks(db);
    }

    // Print results
    printResults(seedInfo, queryResults);

    // Cleanup
    if (cleanup) {
      await db.dropDatabase();
      console.log(`  Dropped database: ${DB_NAME}\n`);
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
