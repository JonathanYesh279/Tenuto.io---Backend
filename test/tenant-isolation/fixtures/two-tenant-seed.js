/**
 * Canonical two-tenant seed data for tenant isolation tests.
 *
 * Provides Tenant A (Ra'anana) and Tenant B (Rishon) with documents
 * across all 11 tenant-scoped collections. All ObjectId values are
 * created at module level for stable references across imports.
 *
 * Usage:
 *   import { TENANT_A_ID, TENANT_B_ID, seedTwoTenants, teacherA, studentA } from '../fixtures/two-tenant-seed.js';
 *   await seedTwoTenants(db);
 */

import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// ── Tenant IDs (string slugs used as tenantId throughout the system) ──────
export const TENANT_A_ID = 'tenant-a-raanana';
export const TENANT_B_ID = 'tenant-b-rishon';

// ── Stable ObjectIds (created once at module level) ──────────────────────

// Tenants
const tenantAId = new ObjectId();
const tenantBId = new ObjectId();

// Teachers
const teacherAId = new ObjectId();
const teacherBId = new ObjectId();
const teacherTeacherAId = new ObjectId();

// Students
const studentAId = new ObjectId();
const studentBId = new ObjectId();

// School years
const schoolYearAId = new ObjectId();
const schoolYearBId = new ObjectId();

// Orchestras
const orchestraAId = new ObjectId();
const orchestraBId = new ObjectId();

// Rehearsals
const rehearsalAId = new ObjectId();
const rehearsalBId = new ObjectId();

// Theory lessons
const theoryLessonAId = new ObjectId();
const theoryLessonBId = new ObjectId();

// Bagrut
const bagrutAId = new ObjectId();
const bagrutBId = new ObjectId();

// Hours summary
const hoursSummaryAId = new ObjectId();
const hoursSummaryBId = new ObjectId();

// Activity attendance
const attendanceAId = new ObjectId();
const attendanceBId = new ObjectId();

// ── Password hash (shared, pre-computed for speed) ───────────────────────
const hashedPassword = bcrypt.hashSync('testpass123', 10);

// ── Tenant documents ─────────────────────────────────────────────────────
export const tenantA = {
  _id: tenantAId,
  slug: 'raanana',
  name: "קונסרבטוריון רעננה",
  tenantId: TENANT_A_ID,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const tenantB = {
  _id: tenantBId,
  slug: 'rishon',
  name: "קונסרבטוריון ראשון לציון",
  tenantId: TENANT_B_ID,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ── Teachers ─────────────────────────────────────────────────────────────
export const teacherA = {
  _id: teacherAId,
  tenantId: TENANT_A_ID,
  personalInfo: {
    firstName: 'David',
    lastName: 'Cohen',
    email: 'david@raanana.edu',
    phone: '050-1234567',
  },
  credentials: {
    email: 'david@raanana.edu',
    password: hashedPassword,
    tokenVersion: 0,
    isInvitationAccepted: true,
  },
  roles: ['מנהל'],
  isActive: true,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

export const teacherB = {
  _id: teacherBId,
  tenantId: TENANT_B_ID,
  personalInfo: {
    firstName: 'Sarah',
    lastName: 'Levi',
    email: 'sarah@rishon.edu',
    phone: '050-7654321',
  },
  credentials: {
    email: 'sarah@rishon.edu',
    password: hashedPassword,
    tokenVersion: 0,
    isInvitationAccepted: true,
  },
  roles: ['מנהל'],
  isActive: true,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

export const teacherTeacherA = {
  _id: teacherTeacherAId,
  tenantId: TENANT_A_ID,
  personalInfo: {
    firstName: 'Noa',
    lastName: 'Mizrahi',
    email: 'noa@raanana.edu',
    phone: '050-9876543',
  },
  credentials: {
    email: 'noa@raanana.edu',
    password: hashedPassword,
    tokenVersion: 0,
    isInvitationAccepted: true,
  },
  roles: ['מורה'],
  isActive: true,
  createdAt: new Date('2025-02-01'),
  updatedAt: new Date('2025-02-01'),
};

// ── Students ─────────────────────────────────────────────────────────────
export const studentA = {
  _id: studentAId,
  tenantId: TENANT_A_ID,
  personalInfo: {
    firstName: 'Yoav',
    lastName: 'Shapira',
  },
  academicInfo: {
    instrumentProgress: [
      { instrument: 'פסנתר', currentStage: 1, isPrimary: true },
    ],
  },
  teacherAssignments: [
    { teacherId: teacherAId.toString(), isActive: true },
  ],
  isActive: true,
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

export const studentB = {
  _id: studentBId,
  tenantId: TENANT_B_ID,
  personalInfo: {
    firstName: 'Maya',
    lastName: 'Peretz',
  },
  academicInfo: {
    instrumentProgress: [
      { instrument: 'כינור', currentStage: 2, isPrimary: true },
    ],
  },
  teacherAssignments: [
    { teacherId: teacherBId.toString(), isActive: true },
  ],
  isActive: true,
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

// ── School Years ─────────────────────────────────────────────────────────
export const schoolYearA = {
  _id: schoolYearAId,
  tenantId: TENANT_A_ID,
  year: '2025-2026',
  name: 'תשפ"ו',
  isCurrent: true,
  startDate: new Date('2025-09-01'),
  endDate: new Date('2026-06-30'),
  isActive: true,
  createdAt: new Date('2025-08-01'),
  updatedAt: new Date('2025-08-01'),
};

export const schoolYearB = {
  _id: schoolYearBId,
  tenantId: TENANT_B_ID,
  year: '2025-2026',
  name: 'תשפ"ו',
  isCurrent: true,
  startDate: new Date('2025-09-01'),
  endDate: new Date('2026-06-30'),
  isActive: true,
  createdAt: new Date('2025-08-01'),
  updatedAt: new Date('2025-08-01'),
};

// ── Orchestras ───────────────────────────────────────────────────────────
export const orchestraA = {
  _id: orchestraAId,
  tenantId: TENANT_A_ID,
  name: 'תזמורת נוער רעננה',
  type: 'תזמורת',
  conductorId: teacherAId.toString(),
  memberIds: [studentAId.toString()],
  isActive: true,
  schoolYearId: schoolYearAId.toString(),
  createdAt: new Date('2025-09-15'),
  updatedAt: new Date('2025-09-15'),
};

export const orchestraB = {
  _id: orchestraBId,
  tenantId: TENANT_B_ID,
  name: 'תזמורת נוער ראשון',
  type: 'תזמורת',
  conductorId: teacherBId.toString(),
  memberIds: [studentBId.toString()],
  isActive: true,
  schoolYearId: schoolYearBId.toString(),
  createdAt: new Date('2025-09-15'),
  updatedAt: new Date('2025-09-15'),
};

// ── Rehearsals ───────────────────────────────────────────────────────────
export const rehearsalA = {
  _id: rehearsalAId,
  tenantId: TENANT_A_ID,
  orchestraId: orchestraAId.toString(),
  date: new Date('2025-10-15'),
  startTime: '16:00',
  endTime: '17:30',
  location: 'אולם ראשי',
  isActive: true,
  createdAt: new Date('2025-10-01'),
  updatedAt: new Date('2025-10-01'),
};

export const rehearsalB = {
  _id: rehearsalBId,
  tenantId: TENANT_B_ID,
  orchestraId: orchestraBId.toString(),
  date: new Date('2025-10-15'),
  startTime: '16:00',
  endTime: '17:30',
  location: 'אולם מרכזי',
  isActive: true,
  createdAt: new Date('2025-10-01'),
  updatedAt: new Date('2025-10-01'),
};

// ── Theory Lessons ───────────────────────────────────────────────────────
export const theoryLessonA = {
  _id: theoryLessonAId,
  tenantId: TENANT_A_ID,
  name: 'תיאוריה מתקדמת א',
  teacherId: teacherAId.toString(),
  studentIds: [studentAId.toString()],
  isActive: true,
  createdAt: new Date('2025-09-20'),
  updatedAt: new Date('2025-09-20'),
};

export const theoryLessonB = {
  _id: theoryLessonBId,
  tenantId: TENANT_B_ID,
  name: 'תיאוריה בסיסית ב',
  teacherId: teacherBId.toString(),
  studentIds: [studentBId.toString()],
  isActive: true,
  createdAt: new Date('2025-09-20'),
  updatedAt: new Date('2025-09-20'),
};

// ── Bagrut ───────────────────────────────────────────────────────────────
export const bagrutA = {
  _id: bagrutAId,
  tenantId: TENANT_A_ID,
  studentId: studentAId.toString(),
  year: '2026',
  program: [],
  createdAt: new Date('2025-10-01'),
  updatedAt: new Date('2025-10-01'),
};

export const bagrutB = {
  _id: bagrutBId,
  tenantId: TENANT_B_ID,
  studentId: studentBId.toString(),
  year: '2026',
  program: [],
  createdAt: new Date('2025-10-01'),
  updatedAt: new Date('2025-10-01'),
};

// ── Hours Summary ────────────────────────────────────────────────────────
export const hoursSummaryA = {
  _id: hoursSummaryAId,
  tenantId: TENANT_A_ID,
  teacherId: teacherAId.toString(),
  schoolYearId: schoolYearAId.toString(),
  totalHours: 10,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),
};

export const hoursSummaryB = {
  _id: hoursSummaryBId,
  tenantId: TENANT_B_ID,
  teacherId: teacherBId.toString(),
  schoolYearId: schoolYearBId.toString(),
  totalHours: 8,
  createdAt: new Date('2025-11-01'),
  updatedAt: new Date('2025-11-01'),
};

// ── Activity Attendance ──────────────────────────────────────────────────
export const attendanceA = {
  _id: attendanceAId,
  tenantId: TENANT_A_ID,
  studentId: studentAId.toString(),
  type: 'rehearsal',
  date: new Date('2025-10-15'),
  status: 'present',
  createdAt: new Date('2025-10-15'),
  updatedAt: new Date('2025-10-15'),
};

export const attendanceB = {
  _id: attendanceBId,
  tenantId: TENANT_B_ID,
  studentId: studentBId.toString(),
  type: 'rehearsal',
  date: new Date('2025-10-15'),
  status: 'present',
  createdAt: new Date('2025-10-15'),
  updatedAt: new Date('2025-10-15'),
};

// ── Seed Function ────────────────────────────────────────────────────────

/**
 * Insert all two-tenant seed data into the given database.
 * Returns all document references for test assertions.
 *
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @returns {Promise<object>} All seed document references
 */
export async function seedTwoTenants(db) {
  // Tenants (if tenant collection exists in scope)
  await db.collection('tenant').insertMany([tenantA, tenantB]);

  // Teachers
  await db.collection('teacher').insertMany([teacherA, teacherB, teacherTeacherA]);

  // Students
  await db.collection('student').insertMany([studentA, studentB]);

  // School years
  await db.collection('school_year').insertMany([schoolYearA, schoolYearB]);

  // Orchestras
  await db.collection('orchestra').insertMany([orchestraA, orchestraB]);

  // Rehearsals
  await db.collection('rehearsal').insertMany([rehearsalA, rehearsalB]);

  // Theory lessons
  await db.collection('theory_lesson').insertMany([theoryLessonA, theoryLessonB]);

  // Bagrut
  await db.collection('bagrut').insertMany([bagrutA, bagrutB]);

  // Hours summary
  await db.collection('hours_summary').insertMany([hoursSummaryA, hoursSummaryB]);

  // Activity attendance
  await db.collection('activity_attendance').insertMany([attendanceA, attendanceB]);

  return {
    tenantA, tenantB,
    teacherA, teacherB, teacherTeacherA,
    studentA, studentB,
    schoolYearA, schoolYearB,
    orchestraA, orchestraB,
    rehearsalA, rehearsalB,
    theoryLessonA, theoryLessonB,
    bagrutA, bagrutB,
    hoursSummaryA, hoursSummaryB,
    attendanceA, attendanceB,
  };
}
