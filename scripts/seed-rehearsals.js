/**
 * Tenuto.io — Rehearsal Seed Script
 *
 * Enriches existing orchestras with realistic weekly rehearsal data.
 * Reads orchestras + school year from DB, generates weekly instances
 * per rehearsal slot (2 months ago → 3 months ahead), and updates orchestra.rehearsalIds.
 *
 * Usage:
 *   node scripts/seed-rehearsals.js           # Add rehearsals to existing orchestras
 *   node scripts/seed-rehearsals.js --clean   # Delete existing rehearsals first
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

const DB_NAME = process.env.MONGODB_NAME || 'Tenuto-DB';
const TENANT_ID_STR = 'dev-conservatory-001';

const VALID_DAYS_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
// JS getDay(): 0=Sunday, 1=Monday ... Maps Hebrew day index → JS day number
const DAY_TO_JS = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4 };

const REHEARSAL_LOCATIONS = [
  'אולם ערן', 'אולם ראשי', 'סטודיו קאמרי 1', 'סטודיו קאמרי 2',
  'חדר חזרות 1', 'חדר חזרות 2', 'חדר חזרות 3',
];

// Date range for generating weekly instances — relative to current date
// Generates rehearsals from 2 months ago to 3 months ahead
const now = new Date();
const RANGE_START = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const RANGE_END = new Date(now.getFullYear(), now.getMonth() + 3, 0);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Returns all dates between start and end (inclusive) that fall on the given JS day number.
 */
function getWeeklyDates(jsDayNum, start, end) {
  const dates = [];
  const cur = new Date(start);
  // Advance to the first occurrence of jsDayNum
  while (cur.getDay() !== jsDayNum) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');

  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('ERROR: MONGODB_URI not found in .env'); process.exit(1); }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const t0 = performance.now();

    const line = '═'.repeat(58);
    console.log(`\n  ${line}`);
    console.log('    TENUTO.IO — REHEARSAL SEEDER');
    console.log(`    Database: ${DB_NAME}`);
    console.log(`  ${line}\n`);

    // ── Clean ──────────────────────────────────────────────────────────────
    if (clean) {
      const delResult = await db.collection('rehearsal').deleteMany({ tenantId: TENANT_ID_STR });
      await db.collection('orchestra').updateMany(
        { tenantId: TENANT_ID_STR },
        { $set: { rehearsalIds: [] } }
      );
      console.log(`  Cleaned ${delResult.deletedCount} existing rehearsals\n`);
    }

    // ── Read existing data ─────────────────────────────────────────────────
    const orchestras = await db.collection('orchestra')
      .find({ tenantId: TENANT_ID_STR, isActive: true })
      .toArray();

    if (orchestras.length === 0) {
      console.error('  ERROR: No orchestras found. Run seed-dev-data.js first.');
      process.exit(1);
    }

    const schoolYear = await db.collection('school_year')
      .findOne({ tenantId: TENANT_ID_STR, isCurrent: true });

    if (!schoolYear) {
      console.error('  ERROR: No current school year found. Run seed-dev-data.js first.');
      process.exit(1);
    }

    console.log(`  Found ${orchestras.length} orchestras, school year: ${schoolYear.name}`);

    // ── Generate rehearsals ────────────────────────────────────────────────
    const allRehearsals = [];
    const orchestraUpdates = []; // { orchestraId, rehearsalIds[] }

    for (const orch of orchestras) {
      const slotCount = Math.random() < 0.5 ? 1 : 2; // 1-2 weekly slots
      const usedDays = new Set();
      const orchRehearsalIds = [];

      for (let s = 0; s < slotCount; s++) {
        // Pick a unique day for this slot
        let day = pick(VALID_DAYS_HEB);
        let attempts = 0;
        while (usedDays.has(day) && attempts < 10) { day = pick(VALID_DAYS_HEB); attempts++; }
        usedDays.add(day);

        // Afternoon rehearsal times
        const startHour = randInt(14, 16);
        const startMin = pick([0, 30]);
        const durationMin = pick([60, 90, 120]);
        const endTotalMin = startHour * 60 + startMin + durationMin;
        const endHour = Math.floor(endTotalMin / 60);
        const endMin = endTotalMin % 60;

        const startTime = `${pad(startHour)}:${pad(startMin)}`;
        const endTime = `${pad(endHour)}:${pad(endMin)}`;
        const location = pick(REHEARSAL_LOCATIONS);
        const jsDayNum = DAY_TO_JS[day];

        // Generate weekly date instances
        const dates = getWeeklyDates(jsDayNum, RANGE_START, RANGE_END);

        for (const date of dates) {
          const rehearsal = {
            _id: new ObjectId(),
            tenantId: TENANT_ID_STR,
            groupId: orch._id.toHexString(),
            type: orch.type, // 'תזמורת' or 'הרכב'
            date,
            dayOfWeek: jsDayNum,
            startTime,
            endTime,
            location,
            attendance: { present: [], absent: [] },
            notes: '',
            schoolYearId: schoolYear._id.toHexString(),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          allRehearsals.push(rehearsal);
          orchRehearsalIds.push(rehearsal._id.toHexString());
        }
      }

      orchestraUpdates.push({ orchestraId: orch._id, rehearsalIds: orchRehearsalIds });
    }

    console.log(`  Generated ${allRehearsals.length} rehearsal documents`);

    // ── Insert rehearsals in batches ───────────────────────────────────────
    const BATCH = 500;
    for (let i = 0; i < allRehearsals.length; i += BATCH) {
      await db.collection('rehearsal').insertMany(allRehearsals.slice(i, i + BATCH));
    }
    console.log('  Inserted all rehearsals');

    // ── Update orchestra.rehearsalIds ──────────────────────────────────────
    const orchBulk = orchestraUpdates.map(u => ({
      updateOne: {
        filter: { _id: u.orchestraId },
        update: { $set: { rehearsalIds: u.rehearsalIds, updatedAt: new Date() } },
      },
    }));
    await db.collection('orchestra').bulkWrite(orchBulk);
    console.log('  Updated orchestra rehearsalIds');

    // ── Create indexes ─────────────────────────────────────────────────────
    await db.collection('rehearsal').createIndex({ tenantId: 1, groupId: 1 });
    await db.collection('rehearsal').createIndex({ tenantId: 1, date: 1 });
    await db.collection('rehearsal').createIndex({ schoolYearId: 1 });
    console.log('  Created rehearsal indexes');

    // ── Summary ────────────────────────────────────────────────────────────
    const elapsed = Math.round(performance.now() - t0);
    console.log(`\n  ${line}`);
    console.log('    REHEARSAL SEEDING COMPLETE');
    console.log(`    Total time: ${elapsed}ms`);
    console.log(`    Rehearsals: ${allRehearsals.length}`);
    console.log(`    Orchestras updated: ${orchestraUpdates.length}`);
    console.log(`    Avg per orchestra: ${(allRehearsals.length / orchestras.length).toFixed(1)}`);
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
