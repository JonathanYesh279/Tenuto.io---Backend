/**
 * Normalize Locations Migration
 *
 * For each tenant:
 *   1. If settings.rooms is empty, seeds it from VALID_THEORY_LOCATIONS
 *   2. Normalizes free-text location values in:
 *      - teacher.teaching.timeBlocks[].location (also renames `room` -> `location`)
 *      - rehearsal.location
 *      - theory_lesson.location
 *
 * Idempotent: safe to run multiple times. Already-matching values are skipped.
 *
 * Usage:
 *   node scripts/migrations/normalize-locations.js            # Full run
 *   node scripts/migrations/normalize-locations.js --dry-run  # Preview only
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';

// Hardcoded canonical room names — same list as VALID_THEORY_LOCATIONS in theory.validation.js
const CANONICAL_ROOMS = [
  '\u05D0\u05D5\u05DC\u05DD \u05E2\u05E8\u05DF',          // אולם ערן
  '\u05E1\u05D8\u05D5\u05D3\u05D9\u05D5 \u05E7\u05D0\u05DE\u05E8\u05D9 1', // סטודיו קאמרי 1
  '\u05E1\u05D8\u05D5\u05D3\u05D9\u05D5 \u05E7\u05D0\u05DE\u05E8\u05D9 2', // סטודיו קאמרי 2
  '\u05D0\u05D5\u05DC\u05E4\u05DF \u05D4\u05E7\u05DC\u05D8\u05D5\u05EA',    // אולפן הקלטות
  '\u05D7\u05D3\u05E8 \u05D7\u05D6\u05E8\u05D5\u05EA 1',  // חדר חזרות 1
  '\u05D7\u05D3\u05E8 \u05D7\u05D6\u05E8\u05D5\u05EA 2',  // חדר חזרות 2
  '\u05D7\u05D3\u05E8 \u05DE\u05D7\u05E9\u05D1\u05D9\u05DD', // חדר מחשבים
  '\u05D7\u05D3\u05E8 1',  // חדר 1
  '\u05D7\u05D3\u05E8 2',  // חדר 2
  '\u05D7\u05D3\u05E8 \u05D7\u05D6\u05E8\u05D5\u05EA', // חדר חזרות
  '\u05D7\u05D3\u05E8 5',  // חדר 5
  '\u05D7\u05D3\u05E8 6',  // חדר 6
  '\u05D7\u05D3\u05E8 7',  // חדר 7
  '\u05D7\u05D3\u05E8 8',  // חדר 8
  '\u05D7\u05D3\u05E8 9',  // חדר 9
  '\u05D7\u05D3\u05E8 10', // חדר 10
  '\u05D7\u05D3\u05E8 11', // חדר 11
  '\u05D7\u05D3\u05E8 12', // חדר 12
  '\u05D7\u05D3\u05E8 13', // חדר 13
  '\u05D7\u05D3\u05E8 14', // חדר 14
  '\u05D7\u05D3\u05E8 15', // חדר 15
  '\u05D7\u05D3\u05E8 16', // חדר 16
  '\u05D7\u05D3\u05E8 17', // חדר 17
  '\u05D7\u05D3\u05E8 18', // חדר 18
  '\u05D7\u05D3\u05E8 19', // חדר 19
  '\u05D7\u05D3\u05E8 20', // חדר 20
  '\u05D7\u05D3\u05E8 21', // חדר 21
  '\u05D7\u05D3\u05E8 22', // חדר 22
  '\u05D7\u05D3\u05E8 23', // חדר 23
  '\u05D7\u05D3\u05E8 24', // חדר 24
  '\u05D7\u05D3\u05E8 25', // חדר 25
  '\u05D7\u05D3\u05E8 26', // חדר 26
  '\u05D7\u05D3\u05E8 \u05EA\u05D0\u05D5\u05E8\u05D9\u05D4 \u05D0', // חדר תאוריה א
  '\u05D7\u05D3\u05E8 \u05EA\u05D0\u05D5\u05E8\u05D9\u05D4 \u05D1', // חדר תאוריה ב
];

function normalize(str) {
  return String(str || '').trim().replace(/\s+/g, ' ');
}

async function main() {
  console.log(`\n=== Normalize Locations Migration ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Database: ${DB_NAME}\n`);

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const tenants = await db.collection('tenant').find({}).toArray();
    if (tenants.length === 0) {
      console.log('No tenants found. Exiting cleanly.');
      return;
    }
    console.log(`Found ${tenants.length} tenant(s).\n`);

    for (const tenant of tenants) {
      const tenantId = tenant._id;
      const tenantName = tenant.name || tenant.slug || tenantId.toString();
      console.log(`--- Tenant: ${tenantName} (${tenantId}) ---`);

      // Step 1: Seed rooms if empty
      const existingRooms = tenant.settings?.rooms || [];
      if (existingRooms.length === 0) {
        const roomDocs = CANONICAL_ROOMS.map(name => ({
          _id: new ObjectId(),
          name,
          isActive: true,
          createdAt: new Date(),
        }));
        console.log(`  Seeding ${roomDocs.length} rooms...`);
        if (!DRY_RUN) {
          await db.collection('tenant').updateOne(
            { _id: tenantId },
            { $set: { 'settings.rooms': roomDocs } }
          );
        }
      } else {
        console.log(`  Already has ${existingRooms.length} rooms. Skipping seed.`);
      }

      // Build normalization map: normalizedName -> canonicalName
      const currentRooms = existingRooms.length > 0
        ? existingRooms
        : CANONICAL_ROOMS.map(name => ({ name }));
      const normMap = new Map();
      for (const r of currentRooms) {
        normMap.set(normalize(r.name), r.name);
      }

      const unmatched = new Set();
      const tenantIdStr = tenantId.toString();

      // Step 2: Normalize teacher.teaching.timeBlocks[].location
      const teachers = await db.collection('teacher')
        .find({ tenantId: tenantIdStr, 'teaching.timeBlocks': { $exists: true, $ne: [] } })
        .toArray();

      let tbUpdated = 0;
      const tbBulkOps = [];
      for (const teacher of teachers) {
        const timeBlocks = teacher.teaching?.timeBlocks || [];
        let changed = false;
        const newBlocks = timeBlocks.map(tb => {
          const copy = { ...tb };
          // Handle `room` field: rename to `location`
          if (copy.room && !copy.location) {
            copy.location = copy.room;
            delete copy.room;
            changed = true;
          }
          if (copy.location) {
            const norm = normalize(copy.location);
            const canonical = normMap.get(norm);
            if (canonical && canonical !== copy.location) {
              copy.location = canonical;
              changed = true;
            } else if (!canonical) {
              unmatched.add(copy.location);
            }
          }
          return copy;
        });
        if (changed) {
          tbUpdated++;
          tbBulkOps.push({
            updateOne: {
              filter: { _id: teacher._id },
              update: { $set: { 'teaching.timeBlocks': newBlocks } },
            },
          });
        }
      }
      if (tbBulkOps.length > 0 && !DRY_RUN) {
        await db.collection('teacher').bulkWrite(tbBulkOps);
      }
      console.log(`  TimeBlocks: ${tbUpdated} teacher(s) updated (${teachers.length} checked)`);

      // Step 3: Normalize rehearsal.location
      const rehearsals = await db.collection('rehearsal')
        .find({ tenantId: tenantIdStr, location: { $exists: true } })
        .toArray();

      let rehUpdated = 0;
      const rehBulkOps = [];
      for (const reh of rehearsals) {
        if (!reh.location) continue;
        const norm = normalize(reh.location);
        const canonical = normMap.get(norm);
        if (canonical && canonical !== reh.location) {
          rehUpdated++;
          rehBulkOps.push({
            updateOne: {
              filter: { _id: reh._id },
              update: { $set: { location: canonical } },
            },
          });
        } else if (!canonical) {
          unmatched.add(reh.location);
        }
      }
      if (rehBulkOps.length > 0 && !DRY_RUN) {
        await db.collection('rehearsal').bulkWrite(rehBulkOps);
      }
      console.log(`  Rehearsals: ${rehUpdated} updated (${rehearsals.length} checked)`);

      // Step 4: Normalize theory_lesson.location
      const theoryLessons = await db.collection('theory_lesson')
        .find({ tenantId: tenantIdStr, location: { $exists: true } })
        .toArray();

      let tlUpdated = 0;
      const tlBulkOps = [];
      for (const tl of theoryLessons) {
        if (!tl.location) continue;
        const norm = normalize(tl.location);
        const canonical = normMap.get(norm);
        if (canonical && canonical !== tl.location) {
          tlUpdated++;
          tlBulkOps.push({
            updateOne: {
              filter: { _id: tl._id },
              update: { $set: { location: canonical } },
            },
          });
        } else if (!canonical) {
          unmatched.add(tl.location);
        }
      }
      if (tlBulkOps.length > 0 && !DRY_RUN) {
        await db.collection('theory_lesson').bulkWrite(tlBulkOps);
      }
      console.log(`  Theory lessons: ${tlUpdated} updated (${theoryLessons.length} checked)`);

      // Report unmatched
      if (unmatched.size > 0) {
        console.log(`  UNMATCHED locations (manual review needed):`);
        for (const loc of unmatched) {
          console.log(`    - "${loc}"`);
        }
      } else {
        console.log(`  All locations matched.`);
      }
      console.log('');
    }

    console.log('=== Migration complete ===');
    if (DRY_RUN) {
      console.log('(Dry run -- no changes were made)');
    }
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
