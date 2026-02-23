/**
 * Cross-Tenant Write Isolation Tests (TEST-02)
 *
 * Verifies that cross-tenant WRITE operations (PUT, DELETE) are rejected
 * and have no effect on the target tenant's data. Also tests stripTenantId
 * enforcement for POST with mismatched tenantId.
 *
 * These tests use real MongoDB Memory Server, real middleware chain
 * (authenticateToken -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest),
 * and real service queries. NO mocks on tenant middleware or queryScoping.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupTenantIsolationDB,
  teardownTenantIsolationDB,
  resetCollections,
  patchMongoDBService,
} from './setup.js';

// Module-level variables for dynamic imports (populated in beforeAll)
let db;
let seedTwoTenants;
let TENANT_A_ID, TENANT_B_ID;
let teacherA, teacherB;
let studentA, studentB;
let schoolYearA, schoolYearB;
let orchestraA, orchestraB;
let theoryLessonA, theoryLessonB;
let createTestApp;
let makeToken;
let app;
let tokenA, tokenB;

beforeAll(async () => {
  // 1. Start MMS and get db reference
  const result = await setupTenantIsolationDB();
  db = result.db;

  // 2. Patch mongoDB.service.js BEFORE any app module imports
  patchMongoDBService(db);

  // 3. Dynamic imports (after patch)
  const fixtures = await import('./fixtures/two-tenant-seed.js');
  seedTwoTenants = fixtures.seedTwoTenants;
  TENANT_A_ID = fixtures.TENANT_A_ID;
  TENANT_B_ID = fixtures.TENANT_B_ID;
  teacherA = fixtures.teacherA;
  teacherB = fixtures.teacherB;
  studentA = fixtures.studentA;
  studentB = fixtures.studentB;
  schoolYearA = fixtures.schoolYearA;
  schoolYearB = fixtures.schoolYearB;
  orchestraA = fixtures.orchestraA;
  orchestraB = fixtures.orchestraB;
  theoryLessonA = fixtures.theoryLessonA;
  theoryLessonB = fixtures.theoryLessonB;

  const testAppModule = await import('./helpers/test-app.js');
  createTestApp = testAppModule.createTestApp;

  const tokenModule = await import('./helpers/token.js');
  makeToken = tokenModule.makeToken;

  // 4. Seed data
  await seedTwoTenants(db);

  // 5. Create app and tokens
  app = createTestApp();
  tokenA = makeToken(teacherA);
  tokenB = makeToken(teacherB);
}, 60000);

afterAll(async () => {
  await teardownTenantIsolationDB();
}, 30000);

// Re-seed before each test since write tests modify data
beforeEach(async () => {
  await resetCollections();
  // Also clear the tenant collection (not in TENANT_COLLECTIONS)
  await db.collection('tenant').deleteMany({});
  await seedTwoTenants(db);
}, 30000);

// ════════════════════════════════════════════════════════════════════════════
// STUDENT — Cross-Tenant Write Isolation
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - Student', () => {
  it('PUT /api/student/:id - Tenant A cannot update Tenant B student', async () => {
    const res = await request(app)
      .put(`/api/student/${studentB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ personalInfo: { firstName: 'Hacked' } });

    // Should NOT succeed — cross-tenant update must be rejected
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify DB is unchanged
    const dbStudent = await db.collection('student').findOne({ _id: studentB._id });
    expect(dbStudent).not.toBeNull();
    expect(dbStudent.personalInfo.firstName).toBe('Maya');
    expect(dbStudent.tenantId).toBe(TENANT_B_ID);
  });

  it('DELETE /api/student/:id - Tenant A cannot delete Tenant B student', async () => {
    const res = await request(app)
      .delete(`/api/student/${studentB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Should NOT succeed — cross-tenant delete must be rejected
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify student still exists in DB
    const dbStudent = await db.collection('student').findOne({ _id: studentB._id });
    expect(dbStudent).not.toBeNull();
    expect(dbStudent.tenantId).toBe(TENANT_B_ID);
    expect(dbStudent.personalInfo.firstName).toBe('Maya');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TEACHER — Cross-Tenant Write Isolation
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - Teacher', () => {
  it('PUT /api/teacher/:id - Tenant A cannot update Tenant B teacher', async () => {
    const res = await request(app)
      .put(`/api/teacher/${teacherB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ personalInfo: { firstName: 'Hacked', lastName: 'Teacher' } });

    // Cross-tenant update rejected (404 from teacher service tenant-scoped query)
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify DB unchanged
    const dbTeacher = await db.collection('teacher').findOne({ _id: teacherB._id });
    expect(dbTeacher).not.toBeNull();
    expect(dbTeacher.personalInfo.firstName).toBe('Sarah');
    expect(dbTeacher.tenantId).toBe(TENANT_B_ID);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORCHESTRA — Cross-Tenant Write Isolation
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - Orchestra', () => {
  it('PUT /api/orchestra/:id - Tenant A cannot modify Tenant B orchestra', async () => {
    const res = await request(app)
      .put(`/api/orchestra/${orchestraB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked Orchestra' });

    // Cross-tenant update rejected
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify DB unchanged
    const dbOrchestra = await db.collection('orchestra').findOne({ _id: orchestraB._id });
    expect(dbOrchestra).not.toBeNull();
    expect(dbOrchestra.name).toBe(orchestraB.name);
    expect(dbOrchestra.tenantId).toBe(TENANT_B_ID);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SCHOOL YEAR — Cross-Tenant Write Isolation
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - School Year', () => {
  it('PUT /api/school-year/:id/set-current - Tenant A cannot set Tenant B school year as current', async () => {
    const res = await request(app)
      .put(`/api/school-year/${schoolYearB._id.toString()}/set-current`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Cross-tenant set-current rejected (404 from service tenant-scoped query)
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify DB unchanged — Tenant B school year still has its original state
    const dbSchoolYear = await db.collection('school_year').findOne({ _id: schoolYearB._id });
    expect(dbSchoolYear).not.toBeNull();
    expect(dbSchoolYear.tenantId).toBe(TENANT_B_ID);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// THEORY — Cross-Tenant Write Isolation
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - Theory', () => {
  it('PUT /api/theory/:id - Tenant A cannot update Tenant B theory lesson', async () => {
    const res = await request(app)
      .put(`/api/theory/${theoryLessonB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked Theory Lesson' });

    // Cross-tenant update rejected (404 from theory service tenant-scoped query)
    expect(res.status).not.toBe(200);

    // Belt-and-suspenders: verify DB unchanged
    const dbTheory = await db.collection('theory_lesson').findOne({ _id: theoryLessonB._id });
    expect(dbTheory).not.toBeNull();
    expect(dbTheory.name).toBe(theoryLessonB.name);
    expect(dbTheory.tenantId).toBe(TENANT_B_ID);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// stripTenantId Enforcement
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Write Isolation - stripTenantId Enforcement', () => {
  it('POST with mismatched tenantId in body returns 400 TENANT_MISMATCH', async () => {
    const res = await request(app)
      .post('/api/student')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        tenantId: TENANT_B_ID,
        personalInfo: {
          firstName: 'Injected',
          lastName: 'Student',
        },
        teacherAssignments: [
          { teacherId: teacherA._id.toString(), isActive: true },
        ],
      });

    // stripTenantId middleware returns 400 TENANT_MISMATCH
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TENANT_MISMATCH');
  });
});
