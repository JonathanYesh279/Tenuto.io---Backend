/**
 * Cleanup Script: Remove ghost rehearsals and conflicts
 *
 * Run from Windows: cd C:\Users\yona2\Documents\Tenuto.io\Tenuto.io-Backend && node .tmp/cleanup-conflicts.js
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const TENANT_ID = '69a98b3646ddf4782f87035c';
const SCHOOL_YEAR_ID = '69a9a3c3c94832b50efada98';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('Tenuto-DB');

  console.log('=== PHASE 1: Investigate rehearsals ===\n');

  // 1. Count rehearsals by day
  const byDay = await db.collection('rehearsal').aggregate([
    { $match: { tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID } },
    { $group: { _id: '$dayOfWeek', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('Rehearsals by day:');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  byDay.forEach(d => console.log(`  ${dayNames[d._id] || d._id}: ${d.count}`));

  // 2. Group by orchestra + day
  const byGroup = await db.collection('rehearsal').aggregate([
    { $match: { tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID } },
    { $group: {
      _id: { groupId: '$groupId', day: '$dayOfWeek' },
      count: { $sum: 1 },
      location: { $first: '$location' },
      startTime: { $first: '$startTime' },
      endTime: { $first: '$endTime' }
    }},
    { $sort: { '_id.day': 1 } }
  ]).toArray();

  // 3. Lookup orchestra names
  const groupIds = [...new Set(byGroup.map(g => g._id.groupId).filter(Boolean))];
  const orchestras = await db.collection('orchestra').find(
    { _id: { $in: groupIds.filter(id => ObjectId.isValid(id)).map(id => ObjectId.createFromHexString(id)) } },
    { projection: { name: 1 } }
  ).toArray();
  const nameMap = new Map(orchestras.map(o => [o._id.toString(), o.name]));

  console.log('\nRehearsals by orchestra + day:');
  byGroup.forEach(g => {
    const name = nameMap.get(g._id.groupId) || 'UNKNOWN';
    console.log(`  ${name} | ${dayNames[g._id.day]} | ${g.startTime}-${g.endTime} | ${g.location} | ${g.count} records`);
  });

  // 4. Distinct locations
  const locations = await db.collection('rehearsal').distinct('location', { tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID });
  console.log('\nDistinct locations:', locations);

  // 5. Check tenant rooms
  const tenant = await db.collection('tenant').findOne(
    { _id: ObjectId.createFromHexString(TENANT_ID) },
    { projection: { 'settings.rooms': 1 } }
  );
  const tenantRooms = tenant?.settings?.rooms || [];
  console.log('\nTenant rooms:', tenantRooms.length === 0 ? '(none configured)' : '');
  tenantRooms.forEach(r => console.log(`  ${r.name} | active: ${r.isActive}`));

  // 6. Find conflicts - rehearsals in the same room + time as timeBlocks
  console.log('\n=== PHASE 2: Find all conflicts ===\n');

  // Get all time blocks with locations
  const teachersWithBlocks = await db.collection('teacher').find(
    { tenantId: TENANT_ID, isActive: true, 'teaching.timeBlocks': { $exists: true, $ne: [] } },
    { projection: { 'personalInfo.firstName': 1, 'personalInfo.lastName': 1, 'teaching.timeBlocks': 1 } }
  ).toArray();

  const allRehearsals = await db.collection('rehearsal').find(
    { tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID }
  ).toArray();

  // Check for timeBlocks in אולם ראשי
  let blocksInMainHall = 0;
  for (const teacher of teachersWithBlocks) {
    for (const block of (teacher.teaching?.timeBlocks || [])) {
      if (block.location === 'אולם ראשי' && block.isActive !== false) {
        const name = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim();
        console.log(`  TimeBlock in אולם ראשי: ${name} | ${block.day} ${block.startTime}-${block.endTime} | block: ${block._id}`);
        blocksInMainHall++;
      }
    }
  }
  if (blocksInMainHall === 0) console.log('  No timeBlocks in אולם ראשי');

  // Check for rehearsals in אולם ראשי
  const rehearsalsInMainHall = allRehearsals.filter(r => r.location === 'אולם ראשי');
  console.log(`\n  Rehearsals in אולם ראשי: ${rehearsalsInMainHall.length}`);

  console.log('\n=== PHASE 3: Cleanup ===\n');

  // Delete ALL rehearsals in אולם ראשי (room doesn't exist)
  if (rehearsalsInMainHall.length > 0) {
    const delResult = await db.collection('rehearsal').deleteMany({
      tenantId: TENANT_ID,
      schoolYearId: SCHOOL_YEAR_ID,
      location: 'אולם ראשי'
    });
    console.log(`Deleted ${delResult.deletedCount} rehearsals from אולם ראשי`);
  }

  // Clear location on any timeBlocks in אולם ראשי
  for (const teacher of teachersWithBlocks) {
    for (const block of (teacher.teaching?.timeBlocks || [])) {
      if (block.location === 'אולם ראשי' && block.isActive !== false) {
        await db.collection('teacher').updateOne(
          { _id: teacher._id, 'teaching.timeBlocks._id': block._id },
          { $set: { 'teaching.timeBlocks.$.location': '' } }
        );
        console.log(`Cleared location for timeBlock ${block._id}`);
      }
    }
  }

  // Now find ALL remaining conflicts across all rooms and days
  console.log('\n--- Checking remaining conflicts ---');

  // Refresh rehearsals after cleanup
  const remainingRehearsals = await db.collection('rehearsal').find(
    { tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID }
  ).toArray();

  // Build a map: room+day -> [rehearsals]
  const rehearsalMap = new Map();
  for (const r of remainingRehearsals) {
    const key = `${r.location}|${r.dayOfWeek}`;
    if (!rehearsalMap.has(key)) rehearsalMap.set(key, []);
    rehearsalMap.get(key).push(r);
  }

  // Check each timeBlock against rehearsals in the same room+day
  let conflictCount = 0;
  for (const teacher of teachersWithBlocks) {
    for (const block of (teacher.teaching?.timeBlocks || [])) {
      if (block.isActive === false || !block.location) continue;

      const dayIndex = dayNames.indexOf(block.day === 'ראשון' ? 'Sunday' : block.day === 'שני' ? 'Monday' : block.day === 'שלישי' ? 'Tuesday' : block.day === 'רביעי' ? 'Wednesday' : block.day === 'חמישי' ? 'Thursday' : 'Friday');
      if (dayIndex === -1) continue;

      const key = `${block.location}|${dayIndex}`;
      const roomRehearsals = rehearsalMap.get(key) || [];

      for (const reh of roomRehearsals) {
        // Check time overlap
        const blockStart = timeToMin(block.startTime);
        const blockEnd = timeToMin(block.endTime);
        const rehStart = timeToMin(reh.startTime);
        const rehEnd = timeToMin(reh.endTime);

        if (blockStart < rehEnd && blockEnd > rehStart) {
          const name = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim();
          const orchName = nameMap.get(reh.groupId) || 'UNKNOWN';
          console.log(`  CONFLICT: ${name} block (${block.startTime}-${block.endTime}) vs ${orchName} rehearsal (${reh.startTime}-${reh.endTime}) in ${block.location} on ${block.day}`);
          conflictCount++;

          // Clear the block location to resolve the conflict
          await db.collection('teacher').updateOne(
            { _id: teacher._id, 'teaching.timeBlocks._id': block._id },
            { $set: { 'teaching.timeBlocks.$.location': '' } }
          );
          console.log(`    -> Cleared timeBlock location to resolve`);
          break; // Block already cleared, move to next
        }
      }
    }
  }

  if (conflictCount === 0) {
    console.log('  No remaining conflicts found!');
  } else {
    console.log(`\n  Resolved ${conflictCount} conflicts by clearing timeBlock locations`);
  }

  // Final summary
  const finalCount = await db.collection('rehearsal').countDocuments({ tenantId: TENANT_ID, schoolYearId: SCHOOL_YEAR_ID });
  console.log(`\n=== DONE ===`);
  console.log(`Remaining rehearsals: ${finalCount}`);

  await client.close();
}

function timeToMin(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

main().catch(console.error);
