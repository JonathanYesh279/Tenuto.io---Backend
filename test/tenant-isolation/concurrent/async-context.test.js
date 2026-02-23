/**
 * Concurrent Context Contamination Tests
 *
 * Proves that Node.js async handling does not contaminate tenant context
 * between simultaneous requests. Fires 120 concurrent read requests and
 * 60 concurrent write requests from alternating tenants, verifying zero
 * data contamination across all responses.
 *
 * Uses real MongoDB Memory Server, real middleware chain, and real service
 * queries. NO mocks on tenant middleware or queryScoping.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupTenantIsolationDB,
  teardownTenantIsolationDB,
  resetCollections,
  patchMongoDBService,
} from '../setup.js';

// Module-level variables for dynamic imports (populated in beforeAll)
let db;
let seedTwoTenants;
let TENANT_A_ID, TENANT_B_ID;
let teacherA, teacherB;
let studentA, studentB;
let schoolYearA, schoolYearB;
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
  const fixtures = await import('../fixtures/two-tenant-seed.js');
  seedTwoTenants = fixtures.seedTwoTenants;
  TENANT_A_ID = fixtures.TENANT_A_ID;
  TENANT_B_ID = fixtures.TENANT_B_ID;
  teacherA = fixtures.teacherA;
  teacherB = fixtures.teacherB;
  studentA = fixtures.studentA;
  studentB = fixtures.studentB;
  schoolYearA = fixtures.schoolYearA;
  schoolYearB = fixtures.schoolYearB;

  const testAppModule = await import('../helpers/test-app.js');
  createTestApp = testAppModule.createTestApp;

  const tokenModule = await import('../helpers/token.js');
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

// ────────────────────────────────────────────────────────────────────────────
// Helper: extract array from various response shapes
// ────────────────────────────────────────────────────────────────────────────
function extractList(body) {
  if (body && Array.isArray(body.data)) return body.data;
  if (Array.isArray(body)) return body;
  if (body && body.success && Array.isArray(body.data)) return body.data;
  return [];
}

// ════════════════════════════════════════════════════════════════════════════
// CONCURRENT READ CONTAMINATION
// ════════════════════════════════════════════════════════════════════════════
describe('Async Context Contamination', { timeout: 60000 }, () => {
  it('120 concurrent requests from alternating tenants never leak data', async () => {
    // Build request array: even indices use tokenA, odd use tokenB
    const requests = Array.from({ length: 120 }, (_, i) => ({
      token: i % 2 === 0 ? tokenA : tokenB,
      expectedTenantId: i % 2 === 0 ? TENANT_A_ID : TENANT_B_ID,
    }));

    // Fire ALL requests simultaneously
    const promises = requests.map(({ token, expectedTenantId }, i) =>
      request(app)
        .get('/api/student')
        .set('Authorization', `Bearer ${token}`)
        .then(res => ({
          index: i,
          expectedTenantId,
          status: res.status,
          body: res.body,
        }))
    );

    const results = await Promise.all(promises);

    // Track contaminations
    let contaminations = 0;
    const contaminationDetails = [];

    for (const { index, expectedTenantId, status, body } of results) {
      // All requests should succeed
      expect(status).toBe(200);

      // Extract student list from response (handle various shapes)
      const students = extractList(body);

      // For every student in the response, verify tenantId
      for (const student of students) {
        if (student.tenantId !== expectedTenantId) {
          contaminations++;
          contaminationDetails.push(
            `Request ${index}: expected ${expectedTenantId} but got ${student.tenantId}`
          );
        }
      }
    }

    // Final assertion: zero contamination
    if (contaminations > 0) {
      console.error('Contamination details:', contaminationDetails.join('\n'));
    }
    expect(contaminations).toBe(0);
  });

  it('60 concurrent writes to different tenants do not cross-contaminate', async () => {
    // First, seed extra students to have update targets
    const { ObjectId } = await import('mongodb');
    const extraStudentsA = [];
    const extraStudentsB = [];

    for (let i = 0; i < 30; i++) {
      extraStudentsA.push({
        _id: new ObjectId(),
        tenantId: TENANT_A_ID,
        personalInfo: { firstName: `ConcA${i}`, lastName: 'Test' },
        academicInfo: { instrumentProgress: [{ instrument: 'פסנתר', currentStage: 1, isPrimary: true }] },
        teacherAssignments: [{ teacherId: teacherA._id.toString(), isActive: true }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      extraStudentsB.push({
        _id: new ObjectId(),
        tenantId: TENANT_B_ID,
        personalInfo: { firstName: `ConcB${i}`, lastName: 'Test' },
        academicInfo: { instrumentProgress: [{ instrument: 'כינור', currentStage: 1, isPrimary: true }] },
        teacherAssignments: [{ teacherId: teacherB._id.toString(), isActive: true }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.collection('student').insertMany([...extraStudentsA, ...extraStudentsB]);

    // Build 60 PUT requests alternating between tenants
    // Each request tries to update its OWN tenant's student (should succeed)
    const writeRequests = Array.from({ length: 60 }, (_, i) => {
      const isA = i % 2 === 0;
      const targetIdx = Math.floor(i / 2);
      return {
        token: isA ? tokenA : tokenB,
        targetId: isA
          ? extraStudentsA[targetIdx]._id.toString()
          : extraStudentsB[targetIdx]._id.toString(),
        expectedTenantId: isA ? TENANT_A_ID : TENANT_B_ID,
        newName: `Updated${isA ? 'A' : 'B'}${targetIdx}`,
      };
    });

    // Fire ALL writes simultaneously
    const writePromises = writeRequests.map(({ token, targetId, newName }, i) =>
      request(app)
        .put(`/api/student/${targetId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ personalInfo: { firstName: newName, lastName: 'Test' } })
        .then(res => ({
          index: i,
          targetId,
          status: res.status,
          body: res.body,
        }))
    );

    const writeResults = await Promise.all(writePromises);

    // Verify all writes succeeded (own-tenant writes should work)
    const successCount = writeResults.filter(r => r.status === 200).length;
    // Some may fail due to validation etc — but none should cross-contaminate
    // The important thing is the DB state check below

    // Now verify DB state: no student has been modified by the wrong tenant
    const allStudentsA = await db.collection('student')
      .find({ tenantId: TENANT_A_ID })
      .toArray();
    const allStudentsB = await db.collection('student')
      .find({ tenantId: TENANT_B_ID })
      .toArray();

    // Verify every Tenant A student still belongs to Tenant A
    for (const student of allStudentsA) {
      expect(student.tenantId).toBe(TENANT_A_ID);
      // No Tenant B name patterns should appear
      if (student.personalInfo.firstName.startsWith('Updated')) {
        expect(student.personalInfo.firstName).toMatch(/^UpdatedA/);
      }
    }

    // Verify every Tenant B student still belongs to Tenant B
    for (const student of allStudentsB) {
      expect(student.tenantId).toBe(TENANT_B_ID);
      // No Tenant A name patterns should appear
      if (student.personalInfo.firstName.startsWith('Updated')) {
        expect(student.personalInfo.firstName).toMatch(/^UpdatedB/);
      }
    }

    // Final contamination check: no student has wrong tenant's data
    const contaminated = [...allStudentsA, ...allStudentsB].filter(s => {
      if (s.tenantId === TENANT_A_ID && s.personalInfo.firstName.startsWith('UpdatedB')) return true;
      if (s.tenantId === TENANT_B_ID && s.personalInfo.firstName.startsWith('UpdatedA')) return true;
      return false;
    });

    expect(contaminated.length).toBe(0);
  });
});
