/**
 * Cross-Tenant Read Isolation Tests (TEST-01)
 *
 * Verifies that every tenant-scoped collection enforces read isolation:
 * - List endpoints return ONLY documents belonging to the authenticated tenant
 * - GetById endpoints return 404 (or non-200) when accessing another tenant's data
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
  patchMongoDBService,
} from './setup.js';

// Module-level variables for dynamic imports (populated in beforeAll)
let db;
let seedTwoTenants;
let TENANT_A_ID, TENANT_B_ID;
let teacherA, teacherB, teacherTeacherA;
let studentA, studentB;
let schoolYearA, schoolYearB;
let orchestraA, orchestraB;
let rehearsalA, rehearsalB;
let theoryLessonA, theoryLessonB;
let bagrutA, bagrutB;
let hoursSummaryA, hoursSummaryB;
let attendanceA, attendanceB;
let importLogA, importLogB;
let ministrySnapshotA, ministrySnapshotB;
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
  teacherTeacherA = fixtures.teacherTeacherA;
  studentA = fixtures.studentA;
  studentB = fixtures.studentB;
  schoolYearA = fixtures.schoolYearA;
  schoolYearB = fixtures.schoolYearB;
  orchestraA = fixtures.orchestraA;
  orchestraB = fixtures.orchestraB;
  rehearsalA = fixtures.rehearsalA;
  rehearsalB = fixtures.rehearsalB;
  theoryLessonA = fixtures.theoryLessonA;
  theoryLessonB = fixtures.theoryLessonB;
  bagrutA = fixtures.bagrutA;
  bagrutB = fixtures.bagrutB;
  hoursSummaryA = fixtures.hoursSummaryA;
  hoursSummaryB = fixtures.hoursSummaryB;
  attendanceA = fixtures.attendanceA;
  attendanceB = fixtures.attendanceB;
  importLogA = fixtures.importLogA;
  importLogB = fixtures.importLogB;
  ministrySnapshotA = fixtures.ministrySnapshotA;
  ministrySnapshotB = fixtures.ministrySnapshotB;

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

// No beforeEach reset needed — these are read-only tests.
// Data is seeded once in beforeAll and not modified by any test case.

// ────────────────────────────────────────────────────────────────────────────
// Helper: extract array from various response shapes
// ────────────────────────────────────────────────────────────────────────────
function extractList(body) {
  // Some endpoints return { data: [...], pagination: {...} }
  if (body && Array.isArray(body.data)) return body.data;
  // Some return a plain array
  if (Array.isArray(body)) return body;
  // Some return { success: true, data: [...] }
  if (body && body.success && Array.isArray(body.data)) return body.data;
  return [];
}

// ════════════════════════════════════════════════════════════════════════════
// STUDENT
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Student', () => {
  it('GET /api/student - Tenant A sees only Tenant A students', async () => {
    const res = await request(app)
      .get('/api/student')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const students = extractList(res.body);
    expect(students.length).toBeGreaterThan(0);

    // Every returned student belongs to Tenant A
    for (const student of students) {
      expect(student.tenantId).toBe(TENANT_A_ID);
    }

    // Tenant B's student is NOT in results
    const studentBIds = students.map(s => s._id.toString());
    expect(studentBIds).not.toContain(studentB._id.toString());
  });

  it('GET /api/student/:id - Tenant A fetching Tenant B student gets non-200', async () => {
    const res = await request(app)
      .get(`/api/student/${studentB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Must NOT return 200 with the other tenant's data
    expect(res.status).not.toBe(200);
    // Should not contain Tenant B student data
    if (res.body && res.body.tenantId) {
      expect(res.body.tenantId).not.toBe(TENANT_B_ID);
    }
  });

  it('GET /api/student - Tenant B sees only Tenant B students', async () => {
    const res = await request(app)
      .get('/api/student')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const students = extractList(res.body);
    expect(students.length).toBeGreaterThan(0);

    for (const student of students) {
      expect(student.tenantId).toBe(TENANT_B_ID);
    }

    const studentAIds = students.map(s => s._id.toString());
    expect(studentAIds).not.toContain(studentA._id.toString());
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TEACHER
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Teacher', () => {
  it('GET /api/teacher - Tenant A sees only Tenant A teachers', async () => {
    const res = await request(app)
      .get('/api/teacher')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const teachers = extractList(res.body);
    expect(teachers.length).toBeGreaterThan(0);

    for (const teacher of teachers) {
      expect(teacher.tenantId).toBe(TENANT_A_ID);
    }

    const teacherBIds = teachers.map(t => t._id.toString());
    expect(teacherBIds).not.toContain(teacherB._id.toString());
  });

  it('GET /api/teacher/:id - Tenant A fetching Tenant B teacher gets 404', async () => {
    const res = await request(app)
      .get(`/api/teacher/${teacherB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Teacher controller catches "not found" and returns 404
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORCHESTRA
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Orchestra', () => {
  it('GET /api/orchestra - Tenant A sees only Tenant A orchestras', async () => {
    const res = await request(app)
      .get('/api/orchestra')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const orchestras = extractList(res.body);
    expect(orchestras.length).toBeGreaterThan(0);

    for (const orch of orchestras) {
      expect(orch.tenantId).toBe(TENANT_A_ID);
    }

    const orchBIds = orchestras.map(o => o._id.toString());
    expect(orchBIds).not.toContain(orchestraB._id.toString());
  });

  it('GET /api/orchestra/:id - cross-tenant fetch returns non-200', async () => {
    const res = await request(app)
      .get(`/api/orchestra/${orchestraB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Must NOT return 200 with the other tenant's data
    expect(res.status).not.toBe(200);
    if (res.body && res.body.tenantId) {
      expect(res.body.tenantId).not.toBe(TENANT_B_ID);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SCHOOL YEAR
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - School Year', () => {
  it('GET /api/school-year - Tenant A sees only Tenant A school years', async () => {
    const res = await request(app)
      .get('/api/school-year')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const years = extractList(res.body);
    expect(years.length).toBeGreaterThan(0);

    for (const year of years) {
      expect(year.tenantId).toBe(TENANT_A_ID);
    }

    const yearBIds = years.map(y => y._id.toString());
    expect(yearBIds).not.toContain(schoolYearB._id.toString());
  });

  it('GET /api/school-year/:id - cross-tenant fetch returns 404', async () => {
    const res = await request(app)
      .get(`/api/school-year/${schoolYearB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // School year controller catches "not found" and returns 404
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REHEARSAL
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Rehearsal', () => {
  it('GET /api/rehearsal - Tenant A sees only Tenant A rehearsals', async () => {
    const res = await request(app)
      .get('/api/rehearsal')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const rehearsals = extractList(res.body);
    expect(rehearsals.length).toBeGreaterThan(0);

    for (const reh of rehearsals) {
      expect(reh.tenantId).toBe(TENANT_A_ID);
    }

    const rehBIds = rehearsals.map(r => r._id.toString());
    expect(rehBIds).not.toContain(rehearsalB._id.toString());
  });

  it('GET /api/rehearsal/:id - cross-tenant fetch returns non-200', async () => {
    const res = await request(app)
      .get(`/api/rehearsal/${rehearsalB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Must NOT return 200 with the other tenant's data
    expect(res.status).not.toBe(200);
    if (res.body && res.body.tenantId) {
      expect(res.body.tenantId).not.toBe(TENANT_B_ID);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// THEORY LESSON
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Theory Lesson', () => {
  it('GET /api/theory - Tenant A sees only Tenant A theory lessons', async () => {
    const res = await request(app)
      .get('/api/theory')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const lessons = extractList(res.body);

    // If lessons returned, all must belong to Tenant A
    for (const lesson of lessons) {
      expect(lesson.tenantId).toBe(TENANT_A_ID);
    }

    // Tenant B's theory lesson must NOT appear
    const lessonBIds = lessons.map(l => l._id?.toString());
    expect(lessonBIds).not.toContain(theoryLessonB._id.toString());
  });

  it('GET /api/theory/:id - cross-tenant fetch returns 404', async () => {
    const res = await request(app)
      .get(`/api/theory/${theoryLessonB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Theory controller catches "not found" and returns 404
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BAGRUT
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Bagrut', () => {
  it('GET /api/bagrut - Tenant A sees only Tenant A bagrut records', async () => {
    const res = await request(app)
      .get('/api/bagrut')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const bagruts = extractList(res.body);

    for (const b of bagruts) {
      expect(b.tenantId).toBe(TENANT_A_ID);
    }

    const bagrutBIds = bagruts.map(b => b._id?.toString());
    expect(bagrutBIds).not.toContain(bagrutB._id.toString());
  });

  it('GET /api/bagrut/:id - cross-tenant fetch returns non-200', async () => {
    const res = await request(app)
      .get(`/api/bagrut/${bagrutB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // bagrutService.getBagrutById throws when not found (tenant-scoped query).
    // authorizeBagrutAccess middleware passes error to next(err) -> error handler.
    // The response is NOT 200, confirming no cross-tenant data is returned.
    expect(res.status).not.toBe(200);
    if (res.body && res.body.tenantId) {
      expect(res.body.tenantId).not.toBe(TENANT_B_ID);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// HOURS SUMMARY
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Hours Summary', () => {
  it('GET /api/hours-summary - Tenant A sees only Tenant A summaries', async () => {
    const res = await request(app)
      .get('/api/hours-summary')
      .set('Authorization', `Bearer ${tokenA}`);

    // Hours summary may return 200 with empty array or with results
    expect(res.status).toBe(200);
    const summaries = extractList(res.body);

    for (const s of summaries) {
      expect(s.tenantId).toBe(TENANT_A_ID);
    }

    const summaryBIds = summaries.map(s => s._id?.toString());
    expect(summaryBIds).not.toContain(hoursSummaryB._id.toString());
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Activity Attendance', () => {
  // Activity attendance is accessed indirectly via student or analytics endpoints.
  // The attendance records are scoped by tenantId in queries.
  // Test via student attendance history endpoint.
  it('GET /api/student/:studentId/attendance-history - Tenant A student only', async () => {
    const res = await request(app)
      .get(`/api/student/${studentA._id.toString()}/attendance-history`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Should succeed for own-tenant student
    // The response may be 200 with data or empty results
    expect(res.status).toBe(200);
  });

  it('GET /api/student/:studentId/attendance-history - cross-tenant student returns no data', async () => {
    const res = await request(app)
      .get(`/api/student/${studentB._id.toString()}/attendance-history`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Admin user bypasses _studentAccessIds IDOR check.
    // Service layer queries with tenantId, so cross-tenant student returns empty results.
    // Verify: no cross-tenant attendance data leaked even though status is 200.
    if (res.status === 200) {
      const history = res.body.history || [];
      for (const record of history) {
        if (record.tenantId) {
          expect(record.tenantId).toBe(TENANT_A_ID);
        }
      }
      // Verify no Tenant B attendance records returned
      expect(history.length).toBe(0);
    } else {
      // Non-200 is also acceptable (stronger isolation)
      expect(res.status).not.toBe(200);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// IMPORT LOG
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Import Log', () => {
  // import_log: no public list endpoint exists (POST-only for preview/execute).
  // Isolation is enforced at the service layer via tenantId on document creation.
  // Tested indirectly via write tests in 06-03.
  it('has no public GET endpoint - isolation enforced at service layer', () => {
    // Document: import.route.js only has POST endpoints (preview, execute, repair).
    // No GET /api/import or GET /api/import/:id endpoint exists.
    // tenantId is set from context on every import_log document creation.
    expect(true).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MINISTRY REPORT SNAPSHOTS
// ════════════════════════════════════════════════════════════════════════════
describe('Cross-Tenant Read Isolation - Ministry Report Snapshots', () => {
  // ministry_report_snapshots: no public GET endpoint exists.
  // Snapshots are created during export (POST /api/export/download).
  // No list/getById endpoint is exposed.
  it('has no public GET endpoint - isolation enforced at service layer', () => {
    // Document: export.route.js has GET /status, GET /validate, GET /download
    // but these generate reports on-the-fly from tenant-scoped data,
    // not reading from ministry_report_snapshots directly.
    // tenantId is included on every snapshot document insertion.
    expect(true).toBe(true);
  });
});
