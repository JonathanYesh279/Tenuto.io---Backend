/**
 * Tenuto.io — Schedule Seed Script
 *
 * Rebuilds teacher time blocks with realistic windows and packs student
 * lessons back-to-back within those blocks. Creates proper bidirectional
 * references between teacher.assignedLessons and student.teacherAssignments.
 *
 * Three sequential phases:
 *   A) Rebuild teacher time blocks (2-4 blocks on unique days, morning/afternoon)
 *   B) Reassign student lessons within teacher blocks (back-to-back packing)
 *   C) Populate teacher assignedLessons[] from Phase B data
 *   + Automatic verification step
 *
 * Usage:
 *   node scripts/seed-schedules.js              # Run all phases + verify
 *   node scripts/seed-schedules.js --verify-only # Only run verification
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';

// Accept --tenant <id> from CLI, default to dev-conservatory-001
const tenantArgIdx = process.argv.indexOf('--tenant');
const TENANT_ID_STR = tenantArgIdx !== -1 && process.argv[tenantArgIdx + 1]
  ? process.argv[tenantArgIdx + 1]
  : 'dev-conservatory-001';

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

const LOCATIONS = [
  'אולם ערן', 'סטודיו קאמרי 1', 'סטודיו קאמרי 2',
  'חדר חזרות 1', 'חדר חזרות 2', 'חדר מחשבים',
  ...Array.from({ length: 20 }, (_, i) => `חדר ${i + 1}`),
  'חדר תאוריה א', 'חדר תאוריה ב',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }

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

// ─── Room Scheduler (prevents room conflicts across teachers) ────────────────

class RoomScheduler {
  constructor() {
    // day -> location -> sorted array of { startMin, endMin }
    this.bookings = new Map();
  }

  /**
   * Check if a room is free on a given day for the time range.
   */
  isFree(day, location, startMin, endMin) {
    const key = `${day}::${location}`;
    const slots = this.bookings.get(key);
    if (!slots || slots.length === 0) return true;
    for (const s of slots) {
      if (startMin < s.endMin && endMin > s.startMin) return false;
    }
    return true;
  }

  /**
   * Book a room. Returns true if successful, false if conflict.
   */
  book(day, location, startMin, endMin) {
    if (!this.isFree(day, location, startMin, endMin)) return false;
    const key = `${day}::${location}`;
    if (!this.bookings.has(key)) this.bookings.set(key, []);
    this.bookings.get(key).push({ startMin, endMin });
    return true;
  }

  /**
   * Find a free room for a given day and time range.
   * Shuffles locations to spread usage.
   */
  findFreeRoom(day, startMin, endMin) {
    const shuffled = [...LOCATIONS].sort(() => Math.random() - 0.5);
    for (const loc of shuffled) {
      if (this.isFree(day, loc, startMin, endMin)) return loc;
    }
    return null;
  }
}

// ─── Phase A: Rebuild Teacher Time Blocks ────────────────────────────────────

function generateTimeBlocks(roomScheduler) {
  const blockCount = randInt(2, 4);
  const blocks = [];
  const usedDays = new Set();

  for (let i = 0; i < blockCount; i++) {
    // Pick unique day for this teacher
    let day = pick(VALID_DAYS);
    let attempts = 0;
    while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS); attempts++; }
    usedDays.add(day);

    // Morning (08:00-13:00 range) or afternoon (13:00-18:00 range)
    const isMorning = Math.random() < 0.5;
    let startHour, spanHours;

    if (isMorning) {
      startHour = randInt(8, 10);  // 08:00 - 10:00
      spanHours = randInt(3, 5);   // 3-5 hours
    } else {
      startHour = randInt(13, 15); // 13:00 - 15:00
      spanHours = randInt(3, 5);
    }

    const startMin = pick([0, 30]);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = startTotalMin + spanHours * 60;

    // Find a room that is free for this entire block on this day
    const location = roomScheduler.findFreeRoom(day, startTotalMin, endTotalMin);
    if (!location) {
      // Skip this block if no room available (very unlikely with 26 locations)
      continue;
    }
    roomScheduler.book(day, location, startTotalMin, endTotalMin);

    blocks.push({
      _id: new ObjectId(),
      day,
      startTime: minutesToTime(startTotalMin),
      endTime: minutesToTime(endTotalMin),
      totalDuration: spanHours * 60,
      location,
      notes: null,
      isActive: true,
      assignedLessons: [], // Populated in Phase C
      recurring: { isRecurring: true, excludeDates: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return blocks;
}

async function phaseA(db) {
  console.log('  ── Phase A: Rebuild teacher time blocks ──');
  const t0 = performance.now();

  const teachers = await db.collection('teacher')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .project({ _id: 1 })
    .toArray();

  // Shared room scheduler to prevent room conflicts across all teachers
  const roomScheduler = new RoomScheduler();

  // Generate new blocks for each teacher
  const ops = teachers.map(t => ({
    updateOne: {
      filter: { _id: t._id },
      update: {
        $set: {
          'teaching.timeBlocks': generateTimeBlocks(roomScheduler),
          updatedAt: new Date(),
        },
      },
    },
  }));

  // bulkWrite in batches of 50
  const BATCH = 50;
  for (let i = 0; i < ops.length; i += BATCH) {
    await db.collection('teacher').bulkWrite(ops.slice(i, i + BATCH));
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log(`    ${teachers.length} teachers updated (${elapsed}ms)`);

  return teachers.length;
}

// ─── Phase B: Reassign Student Lessons ───────────────────────────────────────

async function phaseB(db) {
  console.log('  ── Phase B: Reassign student lessons within teacher blocks ──');
  const t0 = performance.now();

  // Load all teachers with their new blocks
  const teachers = await db.collection('teacher')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .project({ _id: 1, 'teaching.timeBlocks': 1, 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 })
    .toArray();

  const teacherMap = new Map();
  for (const t of teachers) {
    teacherMap.set(t._id.toHexString(), t);
  }

  // Load all students
  const students = await db.collection('student')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .toArray();

  // Group students by their primary teacherId
  const teacherStudents = new Map(); // teacherId -> student[]
  for (const s of students) {
    if (!s.teacherAssignments || s.teacherAssignments.length === 0) continue;
    const tId = s.teacherAssignments[0].teacherId;
    if (!teacherStudents.has(tId)) teacherStudents.set(tId, []);
    teacherStudents.get(tId).push(s);
  }

  // For each teacher, pack students into blocks
  const studentBulkOps = [];
  // Store lesson refs for Phase C: teacherId -> block._id -> lessonRefs[]
  const lessonRefs = new Map();

  let assignedCount = 0;
  let overflowCount = 0;
  let skippedCount = 0;

  for (const [teacherId, studs] of teacherStudents) {
    const teacher = teacherMap.get(teacherId);
    if (!teacher || !teacher.teaching?.timeBlocks?.length) continue;

    const blocks = teacher.teaching.timeBlocks;
    const teacherName = `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}`;

    // Calculate capacity of each block in minutes
    const blockSlots = blocks.map(b => ({
      block: b,
      capacity: timeToMinutes(b.endTime) - timeToMinutes(b.startTime),
      cursor: timeToMinutes(b.startTime), // current fill position in minutes
      lessons: [],
    }));

    // Distribute students proportionally across blocks
    let studentIdx = 0;
    const totalCapacity = blockSlots.reduce((sum, bs) => sum + bs.capacity, 0);

    for (const bs of blockSlots) {
      // Proportional share of students for this block
      const share = Math.round((bs.capacity / totalCapacity) * studs.length);
      const blockEndMin = timeToMinutes(bs.block.endTime);

      for (let j = 0; j < share && studentIdx < studs.length; j++) {
        const student = studs[studentIdx];
        const duration = pickDuration();

        // Check if lesson fits in block (no overflow allowed)
        if (bs.cursor + duration > blockEndMin) {
          break;
        }

        const lessonStartMin = bs.cursor;
        const lessonEndMin = bs.cursor + duration;
        const lessonId = new ObjectId();
        const scheduleSlotId = new ObjectId();

        bs.lessons.push({
          student,
          lessonId,
          scheduleSlotId,
          lessonStartMin,
          lessonEndMin,
          duration,
        });

        bs.cursor = lessonEndMin;
        studentIdx++;
        assignedCount++;
      }
    }

    // Handle remaining students: only assign if there's actual remaining capacity
    while (studentIdx < studs.length) {
      // Find block with most remaining capacity
      let bestSlot = null;
      let bestRemaining = 0;
      for (const bs of blockSlots) {
        const remaining = timeToMinutes(bs.block.endTime) - bs.cursor;
        if (remaining > bestRemaining) { bestSlot = bs; bestRemaining = remaining; }
      }

      // If no block has room for even a 30-min lesson, stop assigning
      if (!bestSlot || bestRemaining < 30) {
        skippedCount += studs.length - studentIdx;
        break;
      }

      const student = studs[studentIdx];
      const duration = 30; // Force minimum
      const lessonId = new ObjectId();
      const scheduleSlotId = new ObjectId();

      bestSlot.lessons.push({
        student,
        lessonId,
        scheduleSlotId,
        lessonStartMin: bestSlot.cursor,
        lessonEndMin: bestSlot.cursor + duration,
        duration,
      });

      bestSlot.cursor += duration;
      studentIdx++;
      assignedCount++;
      overflowCount++;
    }

    // Build student update ops and collect lesson refs for Phase C
    if (!lessonRefs.has(teacherId)) lessonRefs.set(teacherId, new Map());
    const teacherLessonRefs = lessonRefs.get(teacherId);

    for (const bs of blockSlots) {
      const blockId = bs.block._id.toHexString();
      if (!teacherLessonRefs.has(blockId)) teacherLessonRefs.set(blockId, []);

      for (const lesson of bs.lessons) {
        const day = bs.block.day;
        const startTime = minutesToTime(lesson.lessonStartMin);
        const endTime = minutesToTime(lesson.lessonEndMin);
        const location = bs.block.location;
        const studentName = `${lesson.student.personalInfo.firstName} ${lesson.student.personalInfo.lastName}`;

        // Student update: replace entire teacherAssignments[0]
        studentBulkOps.push({
          updateOne: {
            filter: { _id: lesson.student._id },
            update: {
              $set: {
                'teacherAssignments.0': {
                  _id: new ObjectId(),
                  teacherId,
                  isActive: true,
                  day,
                  time: startTime,
                  duration: lesson.duration,
                  location,
                  timeBlockId: blockId,
                  lessonId: lesson.lessonId.toHexString(),
                  scheduleSlotId: lesson.scheduleSlotId.toHexString(),
                  scheduleInfo: {
                    day,
                    startTime,
                    endTime,
                    duration: lesson.duration,
                    location,
                    notes: null,
                  },
                  startDate: new Date('2024-09-01'),
                  endDate: null,
                  isRecurring: true,
                  notes: '',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                updatedAt: new Date(),
              },
            },
          },
        });

        // Collect lesson ref for Phase C
        teacherLessonRefs.get(blockId).push({
          _id: lesson.lessonId,
          studentId: lesson.student._id.toHexString(),
          studentName,
          lessonStartTime: startTime,
          lessonEndTime: endTime,
          duration: lesson.duration,
          notes: null,
          isActive: true,
          isRecurring: true,
          startDate: new Date('2024-09-01'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // Execute student bulkWrite in batches
  const BATCH = 200;
  for (let i = 0; i < studentBulkOps.length; i += BATCH) {
    await db.collection('student').bulkWrite(studentBulkOps.slice(i, i + BATCH));
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log(`    ${assignedCount} students assigned (${overflowCount} overflow, ${skippedCount} skipped — no capacity) (${elapsed}ms)`);

  return lessonRefs;
}

// ─── Phase C: Populate Teacher assignedLessons ───────────────────────────────

async function phaseC(db, lessonRefs) {
  console.log('  ── Phase C: Populate teacher assignedLessons ──');
  const t0 = performance.now();

  const teachers = await db.collection('teacher')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .project({ _id: 1, 'teaching.timeBlocks': 1 })
    .toArray();

  const ops = [];
  let totalLessons = 0;

  for (const teacher of teachers) {
    const teacherId = teacher._id.toHexString();
    const blockRefs = lessonRefs.get(teacherId);
    if (!blockRefs) continue;

    const blocks = teacher.teaching.timeBlocks;
    const updatedBlocks = blocks.map(block => {
      const lessons = blockRefs.get(block._id.toHexString()) || [];
      totalLessons += lessons.length;
      return { ...block, assignedLessons: lessons };
    });

    ops.push({
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
  const BATCH = 50;
  for (let i = 0; i < ops.length; i += BATCH) {
    await db.collection('teacher').bulkWrite(ops.slice(i, i + BATCH));
  }

  const elapsed = Math.round(performance.now() - t0);
  console.log(`    ${totalLessons} lesson refs across ${ops.length} teachers (${elapsed}ms)`);
}

// ─── Verification ────────────────────────────────────────────────────────────

async function verify(db) {
  console.log('  ── Verification ──');
  const t0 = performance.now();

  const teachers = await db.collection('teacher')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .toArray();

  const students = await db.collection('student')
    .find({ tenantId: TENANT_ID_STR, isActive: true })
    .toArray();

  // Build teacher block lookup: teacherId -> Set of blockId strings
  const teacherBlockMap = new Map();
  // Block time ranges: blockId -> { startMin, endMin }
  const blockRangeMap = new Map();
  let totalLessonRefs = 0;
  let blocksWithLessons = 0;
  let totalBlocks = 0;

  for (const t of teachers) {
    const tId = t._id.toHexString();
    const blockIds = new Set();

    for (const block of (t.teaching?.timeBlocks || [])) {
      totalBlocks++;
      const bId = block._id.toHexString();
      blockIds.add(bId);
      blockRangeMap.set(bId, {
        startMin: timeToMinutes(block.startTime),
        endMin: timeToMinutes(block.endTime),
        day: block.day,
      });
      const lessonCount = (block.assignedLessons || []).length;
      totalLessonRefs += lessonCount;
      if (lessonCount > 0) blocksWithLessons++;
    }

    teacherBlockMap.set(tId, blockIds);
  }

  // Validate students
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

      if (!a.scheduleInfo) {
        missingScheduleInfo++;
      }

      // Check lesson time falls within block range
      const blockRange = blockRangeMap.get(a.timeBlockId);
      if (blockRange && a.time) {
        const lessonStart = timeToMinutes(a.time);
        const lessonEnd = lessonStart + (a.duration || 0);
        if (lessonStart < blockRange.startMin || lessonEnd > blockRange.endMin) {
          timeMismatch++;
        }
      }

      validAssignments++;
    }
  }

  const elapsed = Math.round(performance.now() - t0);

  console.log(`    Teachers: ${teachers.length}`);
  console.log(`    Students: ${students.length}`);
  console.log(`    Total blocks: ${totalBlocks}, with lessons: ${blocksWithLessons}`);
  console.log(`    Total lesson refs in teacher blocks: ${totalLessonRefs}`);
  console.log(`    Valid student assignments: ${validAssignments}`);
  console.log(`    Invalid block refs: ${invalidBlockRef}`);
  console.log(`    Missing scheduleInfo: ${missingScheduleInfo}`);
  console.log(`    Time outside block range: ${timeMismatch}`);
  console.log(`    Verification time: ${elapsed}ms`);

  if (invalidBlockRef === 0 && missingScheduleInfo === 0 && timeMismatch === 0) {
    console.log('    ✓ All checks passed');
  } else {
    console.log('    ⚠ Issues detected — see counts above');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');

  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('ERROR: MONGODB_URI not found in .env'); process.exit(1); }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const t0 = performance.now();

    const line = '═'.repeat(58);
    console.log(`\n  ${line}`);
    console.log('    TENUTO.IO — SCHEDULE SEEDER');
    console.log(`    Database: ${DB_NAME}`);
    console.log(`    Tenant: ${TENANT_ID_STR}`);
    if (verifyOnly) console.log('    Mode: VERIFY ONLY');
    console.log(`  ${line}\n`);

    if (!verifyOnly) {
      await phaseA(db);
      const lessonRefs = await phaseB(db);
      await phaseC(db, lessonRefs);
    }

    await verify(db);

    const elapsed = Math.round(performance.now() - t0);
    console.log(`\n  ${line}`);
    console.log('    SCHEDULE SEEDING COMPLETE');
    console.log(`    Total time: ${elapsed}ms`);
    console.log(`  ${line}\n`);

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
