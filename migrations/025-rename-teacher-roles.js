/**
 * Migration 025: Rename teacher roles to match Ministry of Education naming
 *
 * Changes:
 * 1. Rename roles: 'מנצח' → 'ניצוח', 'מורה תאוריה' → 'תאוריה'
 * 2. Migrate professionalInfo.instrument (string) → professionalInfo.instruments (array)
 *
 * Run: node migrations/025-rename-teacher-roles.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const ROLE_RENAME_MAP = {
  'מנצח': 'ניצוח',
  'מורה תאוריה': 'תאוריה',
};

async function up() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const teacherCollection = db.collection('teacher');

  console.log('Starting migration 025...');

  // Part 1: Rename roles
  for (const [oldRole, newRole] of Object.entries(ROLE_RENAME_MAP)) {
    const result = await teacherCollection.updateMany(
      { roles: oldRole },
      { $set: { 'roles.$[elem]': newRole } },
      { arrayFilters: [{ elem: oldRole }] }
    );
    console.log(`  Renamed role '${oldRole}' → '${newRole}': ${result.modifiedCount} teachers updated`);
  }

  // Part 2: Migrate instrument string → instruments array
  // Find teachers with professionalInfo.instrument (string) but no instruments array
  const teachersWithSingleInstrument = await teacherCollection.find({
    'professionalInfo.instrument': { $ne: null, $ne: '' },
    $or: [
      { 'professionalInfo.instruments': { $exists: false } },
      { 'professionalInfo.instruments': { $size: 0 } },
    ],
  }).toArray();

  let instrumentMigrated = 0;
  for (const teacher of teachersWithSingleInstrument) {
    const instrument = teacher.professionalInfo?.instrument;
    if (instrument) {
      await teacherCollection.updateOne(
        { _id: teacher._id },
        { $set: { 'professionalInfo.instruments': [instrument] } }
      );
      instrumentMigrated++;
    }
  }
  console.log(`  Migrated instrument → instruments array: ${instrumentMigrated} teachers`);

  // Verify
  const distinctRoles = await teacherCollection.distinct('roles');
  console.log(`  Current distinct roles: ${distinctRoles.join(', ')}`);

  await client.close();
  console.log('Migration 025 complete.');
}

up().catch(err => {
  console.error('Migration 025 failed:', err);
  process.exit(1);
});
