/**
 * Tenant Isolation Test Setup — MongoDB Memory Server lifecycle manager.
 *
 * This is NOT a vitest setupFile. Each test file imports it directly:
 *
 *   import { setupTenantIsolationDB, teardownTenantIsolationDB, resetCollections, getTestDb, patchMongoDBService } from '../setup.js'
 *
 * Usage pattern in test files:
 *
 *   let db;
 *   beforeAll(async () => {
 *     const result = await setupTenantIsolationDB();
 *     db = result.db;
 *     patchMongoDBService(db);
 *     // NOW import app modules (after patching)
 *     const { createTestApp } = await import('./helpers/test-app.js');
 *     ...
 *   });
 *
 * IMPORTANT: patchMongoDBService(db) MUST be called BEFORE importing any
 * application modules (controllers, services, routes). ESM static imports
 * resolve at load time, so vi.doMock must be registered first.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { vi } from 'vitest';

let mongoServer = null;
let mongoClient = null;
let db = null;

/**
 * All 11 tenant-scoped collections that need compound indexes.
 * time_block is excluded (embedded in teacher documents).
 */
const TENANT_COLLECTIONS = [
  'student',
  'teacher',
  'orchestra',
  'rehearsal',
  'theory_lesson',
  'bagrut',
  'school_year',
  'activity_attendance',
  'hours_summary',
  'import_log',
  'ministry_report_snapshots',
];

/**
 * Start a MongoDB Memory Server, connect a MongoClient, create tenant isolation
 * indexes, and return the db reference.
 *
 * @returns {{ db: import('mongodb').Db, client: MongoClient, uri: string }}
 */
export async function setupTenantIsolationDB() {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'test-tenant-isolation',
      storageEngine: 'wiredTiger',
      port: 0,
    },
    binary: {
      version: '6.0.0',
      downloadDir: './node_modules/.cache/mongodb-memory-server/mongodb-binaries',
      skipMD5: true,
    },
    autoStart: true,
  });

  const uri = mongoServer.getUri();

  mongoClient = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await mongoClient.connect();
  db = mongoClient.db('test-tenant-isolation');

  // Create tenantId compound indexes on all 11 tenant-scoped collections
  for (const collName of TENANT_COLLECTIONS) {
    await db.collection(collName).createIndex(
      { tenantId: 1, _id: 1 },
      { name: `idx_${collName}_tenantId`, background: true }
    );
  }

  // Additional indexes matching production compound indexes
  await db.collection('teacher').createIndex(
    { tenantId: 1, 'credentials.email': 1 },
    { name: 'idx_teacher_tenantId_email', unique: true, sparse: true }
  );
  await db.collection('student').createIndex(
    { tenantId: 1, 'teacherAssignments.teacherId': 1 },
    { name: 'idx_student_tenantId_teacherAssignment' }
  );
  await db.collection('school_year').createIndex(
    { tenantId: 1, isCurrent: 1 },
    { name: 'idx_school_year_tenantId_current' }
  );

  return { db, client: mongoClient, uri };
}

/**
 * Close the MongoClient and stop the Memory Server.
 */
export async function teardownTenantIsolationDB() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    db = null;
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Delete all documents from all tenant-scoped collections.
 * Call between test cases for a clean slate.
 */
export async function resetCollections() {
  if (!db) {
    throw new Error('Test database not initialized. Call setupTenantIsolationDB() first.');
  }

  await Promise.all(
    TENANT_COLLECTIONS.map(name => db.collection(name).deleteMany({}))
  );
}

/**
 * Return the current db reference.
 */
export function getTestDb() {
  if (!db) {
    throw new Error('Test database not initialized. Call setupTenantIsolationDB() first.');
  }
  return db;
}

/**
 * Patch the mongoDB.service.js module so that all application code
 * uses the in-memory test database instead of a real connection.
 *
 * IMPORTANT: Call this BEFORE importing any application modules.
 * ESM static imports resolve at load time, so vi.doMock must be
 * registered before the first import of any service/controller/route.
 *
 * @param {import('mongodb').Db} testDb - The MMS database instance
 */
export function patchMongoDBService(testDb) {
  vi.doMock('../../services/mongoDB.service.js', () => ({
    initializeMongoDB: vi.fn(() => Promise.resolve()),
    getDB: vi.fn(() => testDb),
    getCollection: vi.fn((name) => testDb.collection(name)),
  }));
}
