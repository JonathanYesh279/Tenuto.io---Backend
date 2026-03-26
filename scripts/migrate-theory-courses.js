/**
 * Tenuto.io — Theory Course Migration Script
 *
 * Prepares the database for the theory_course parent entity:
 *   1. Adds courseId: null to all theory_lesson documents missing the field
 *   2. Creates compound indexes on theory_course collection
 *   3. Creates an index on theory_lesson for courseId queries
 *   4. Verifies / creates index on activity_attendance for cross-session analytics
 *
 * Behavior:
 *   - Idempotent: safe to run multiple times
 *   - Does NOT auto-group existing lessons (user decides grouping)
 *   - Logs every operation result for audit trail
 *
 * Usage:
 *   node scripts/migrate-theory-courses.js
 *
 * Prerequisites:
 *   - MONGODB_URI environment variable must be set (via .env or export)
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  const client = await MongoClient.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 15000,
  });

  const db = client.db(DB_NAME);
  console.log(`Connected to database: ${DB_NAME}`);

  let totalIndexesCreated = 0;
  let lessonsUpdated = 0;

  try {
    // ── Step 1: Add courseId: null to existing theory_lesson documents ────────
    console.log('\n── Step 1: Backfilling courseId on theory_lesson documents ──');
    const lessonCollection = db.collection('theory_lesson');

    const lessonResult = await lessonCollection.updateMany(
      { courseId: { $exists: false } },
      { $set: { courseId: null } }
    );

    lessonsUpdated = lessonResult.modifiedCount;
    console.log(`  Lessons updated (courseId added): ${lessonsUpdated}`);
    console.log(`  Lessons already had courseId: ${lessonResult.matchedCount === 0 ? 'none matched — already migrated' : lessonResult.matchedCount - lessonsUpdated}`);

    // ── Step 2: Create indexes on theory_course collection ───────────────────
    console.log('\n── Step 2: Creating theory_course indexes ──');
    const courseCollection = db.collection('theory_course');

    const courseIndexes = [
      {
        key: { tenantId: 1, category: 1, schoolYearId: 1 },
        name: 'idx_theory_course_tenant_category_year',
      },
      {
        key: { tenantId: 1, teacherId: 1 },
        name: 'idx_theory_course_tenant_teacher',
      },
      {
        key: { tenantId: 1, isActive: 1 },
        name: 'idx_theory_course_tenant_active',
      },
    ];

    for (const indexDef of courseIndexes) {
      try {
        const result = await courseCollection.createIndex(indexDef.key, {
          name: indexDef.name,
          background: true,
        });
        console.log(`  Created index: ${result}`);
        totalIndexesCreated++;
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  Index already exists (skipped): ${indexDef.name}`);
        } else {
          console.warn(`  WARNING: Could not create index ${indexDef.name}: ${err.message}`);
        }
      }
    }

    // ── Step 3: Create index on theory_lesson for courseId queries ───────────
    console.log('\n── Step 3: Creating theory_lesson courseId index ──');

    try {
      const lessonCourseIndex = await lessonCollection.createIndex(
        { tenantId: 1, courseId: 1 },
        { name: 'idx_theory_lesson_tenant_course', background: true }
      );
      console.log(`  Created index: ${lessonCourseIndex}`);
      totalIndexesCreated++;
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('  Index already exists (skipped): idx_theory_lesson_tenant_course');
      } else {
        console.warn(`  WARNING: Could not create theory_lesson courseId index: ${err.message}`);
      }
    }

    // ── Step 4: Verify / create activity_attendance analytics index ──────────
    console.log('\n── Step 4: Verifying activity_attendance analytics index ──');
    const activityCollection = db.collection('activity_attendance');

    const analyticsIndexName = 'idx_activity_attendance_tenant_session_type';
    const analyticsIndexKey = { tenantId: 1, sessionId: 1, activityType: 1 };

    try {
      // Check existing indexes to avoid duplicate key errors
      const existingIndexes = await activityCollection.indexes();
      const analyticsIndexExists = existingIndexes.some(
        idx => idx.name === analyticsIndexName
      );

      if (analyticsIndexExists) {
        console.log(`  Index already exists (skipped): ${analyticsIndexName}`);
      } else {
        const result = await activityCollection.createIndex(analyticsIndexKey, {
          name: analyticsIndexName,
          background: true,
        });
        console.log(`  Created index: ${result}`);
        totalIndexesCreated++;
      }
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`  Index already exists (skipped): ${analyticsIndexName}`);
      } else {
        console.warn(`  WARNING: Could not create activity_attendance analytics index: ${err.message}`);
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('Migration complete — Theory Course Data Layer');
    console.log(`  Lessons backfilled with courseId: ${lessonsUpdated}`);
    console.log(`  Indexes created this run:         ${totalIndexesCreated}`);
    console.log('══════════════════════════════════════════════════════════');
    console.log('\nNext steps:');
    console.log('  - Use theoryCourseService.createCourse() to create course records');
    console.log('  - Use theoryCourseService.linkLessonsToCourse() to associate existing lessons');
    console.log('  - Existing lessons remain ungrouped (courseId: null) until manually assigned');
  } finally {
    await client.close();
    console.log('\nConnection closed.');
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
