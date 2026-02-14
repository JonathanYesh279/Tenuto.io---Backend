/**
 * Tenuto.io — Compound Tenant Index Creation Script
 *
 * Creates compound indexes with tenantId as the leading key on all
 * tenant-scoped collections. This is a prerequisite for Phase 2 query
 * hardening, which adds tenantId filters to every query.
 *
 * Behavior:
 *   - Idempotent: safe to run multiple times
 *   - Uses background:true for all index creation
 *   - Lists existing indexes before creating new ones (audit trail)
 *   - Reports per-index results and a summary
 *   - Errors per-index do NOT abort the entire run
 *
 * Usage:
 *   node scripts/create-tenant-indexes.js
 *
 * Prerequisites:
 *   - MONGODB_URI environment variable must be set (via .env or export)
 *
 * NOTE: The unique index on { tenantId: 1, 'credentials.email': 1 } is
 * intended to replace the current email-only unique index. The old index
 * should be manually verified and dropped if it exists, since dropping
 * indexes can affect query performance and should be done deliberately.
 * Check with: db.teacher.getIndexes() in the MongoDB shell.
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

// ─── Configuration ──────────────────────────────────────────────────────────

const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';

// ─── Index Definitions ──────────────────────────────────────────────────────
// Every compound index has tenantId as the FIRST field (leftmost prefix)
// for MongoDB leftmost prefix matching.
//
// NOTE: time_block is NOT a separate collection — time blocks are embedded
// in teacher documents (teaching.timeBlocks). No separate index needed.

const TENANT_INDEXES = [
  // teacher collection
  {
    collection: 'teacher',
    index: { tenantId: 1, isActive: 1 },
    name: 'idx_tenant_teacher_active',
  },
  {
    collection: 'teacher',
    index: { tenantId: 1, 'credentials.email': 1 },
    name: 'idx_tenant_teacher_email',
    options: { unique: true },
    // NOTE: This replaces the existing email-only unique index.
    // Verify if the old index { 'credentials.email': 1, tenantId: 1 }
    // (from seed-dev-data.js) needs to be dropped manually.
  },
  {
    collection: 'teacher',
    index: { tenantId: 1, roles: 1 },
    name: 'idx_tenant_teacher_roles',
  },

  // student collection
  {
    collection: 'student',
    index: { tenantId: 1, isActive: 1 },
    name: 'idx_tenant_student_active',
  },
  {
    collection: 'student',
    index: { tenantId: 1, 'teacherAssignments.teacherId': 1 },
    name: 'idx_tenant_student_teacher',
  },

  // orchestra collection
  {
    collection: 'orchestra',
    index: { tenantId: 1, isActive: 1 },
    name: 'idx_tenant_orchestra_active',
  },
  {
    collection: 'orchestra',
    index: { tenantId: 1, conductorId: 1 },
    name: 'idx_tenant_orchestra_conductor',
  },

  // rehearsal collection
  {
    collection: 'rehearsal',
    index: { tenantId: 1, groupId: 1, date: 1 },
    name: 'idx_tenant_rehearsal_group_date',
  },

  // theory_lesson collection
  {
    collection: 'theory_lesson',
    index: { tenantId: 1, teacherId: 1, date: 1 },
    name: 'idx_tenant_theory_teacher_date',
  },
  {
    collection: 'theory_lesson',
    index: { tenantId: 1, category: 1, date: 1 },
    name: 'idx_tenant_theory_category_date',
  },

  // school_year collection
  {
    collection: 'school_year',
    index: { tenantId: 1, isCurrent: 1 },
    name: 'idx_tenant_schoolyear_current',
  },

  // bagrut collection
  {
    collection: 'bagrut',
    index: { tenantId: 1, studentId: 1 },
    name: 'idx_tenant_bagrut_student',
  },

  // activity_attendance collection
  {
    collection: 'activity_attendance',
    index: { tenantId: 1, studentId: 1, activityType: 1 },
    name: 'idx_tenant_attendance_student_type',
  },

  // hours_summary collection
  {
    collection: 'hours_summary',
    index: { tenantId: 1, entityId: 1, schoolYearId: 1 },
    name: 'idx_tenant_hours_entity_year',
  },

  // import_log collection
  {
    collection: 'import_log',
    index: { tenantId: 1, uploadedAt: -1 },
    name: 'idx_tenant_import_date',
  },

  // ministry_report_snapshots collection
  {
    collection: 'ministry_report_snapshots',
    index: { tenantId: 1, schoolYearId: 1 },
    name: 'idx_tenant_ministry_year',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * List existing indexes on a collection and log them.
 */
async function listExistingIndexes(db, collectionName) {
  try {
    const indexes = await db.collection(collectionName).indexes();
    if (indexes.length > 0) {
      console.log(`\n  Existing indexes on '${collectionName}':`);
      for (const idx of indexes) {
        const keys = JSON.stringify(idx.key);
        const unique = idx.unique ? ' (unique)' : '';
        console.log(`    - ${idx.name}: ${keys}${unique}`);
      }
    } else {
      console.log(`\n  No existing indexes on '${collectionName}'`);
    }
  } catch (err) {
    console.log(`\n  Could not list indexes on '${collectionName}': ${err.message}`);
  }
}

/**
 * Create a single index, handling duplicates gracefully.
 * Returns 'created', 'skipped', or 'error'.
 */
async function createSingleIndex(db, def) {
  const { collection, index, name, options = {} } = def;
  const col = db.collection(collection);

  try {
    await col.createIndex(index, {
      name,
      background: true,
      ...options,
    });
    console.log(`  CREATED: ${name} on ${collection}`);
    return 'created';
  } catch (err) {
    // MongoDB error code 85 = IndexOptionsConflict (same index, different name)
    // MongoDB error code 86 = IndexKeySpecsConflict (same name, different index)
    // Both mean the index (or an equivalent) already exists
    if (
      err.code === 85 ||
      err.code === 86 ||
      err.message.includes('already exists') ||
      err.message.includes('An equivalent index already exists')
    ) {
      console.log(`  SKIP: ${name} already exists on ${collection}`);
      return 'skipped';
    }

    console.log(`  ERROR: ${name} on ${collection} -- ${err.message}`);
    return 'error';
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('');
    console.error('  ERROR: MONGODB_URI environment variable is not set.');
    console.error('');
    console.error('  Set it in your .env file or export it:');
    console.error('    export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net"');
    console.error('');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const line = '='.repeat(60);
    console.log('');
    console.log(`  ${line}`);
    console.log('  TENUTO.IO -- TENANT COMPOUND INDEX CREATION');
    console.log(`  Database: ${DB_NAME}`);
    console.log(`  Indexes to process: ${TENANT_INDEXES.length}`);
    console.log(`  ${line}`);

    // Phase 1: List existing indexes on all affected collections
    const collections = [...new Set(TENANT_INDEXES.map((d) => d.collection))];
    console.log('\n  --- Existing Indexes (Audit) ---');
    for (const col of collections) {
      await listExistingIndexes(db, col);
    }

    // Phase 2: Create tenant compound indexes
    console.log('\n  --- Creating Tenant Indexes ---\n');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const def of TENANT_INDEXES) {
      const result = await createSingleIndex(db, def);
      if (result === 'created') created++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }

    // Summary
    console.log('');
    console.log(`  ${line}`);
    console.log(`  SUMMARY: ${created} created, ${skipped} skipped, ${errors} errors`);
    console.log(`  Total processed: ${TENANT_INDEXES.length}`);
    console.log(`  ${line}`);
    console.log('');

    if (errors > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n  FATAL: ${err.message}\n`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
