// Run from Windows: cd Tenuto.io-Backend && node .tmp/investigate-rehearsals.js
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const tenantId = "69a98b3646ddf4782f87035c";
const schoolYearId = "69a9a3c3c94832b50efada98";
const dayNames = ['Sunday(0)', 'Monday(1)', 'Tuesday(2)', 'Wednesday(3)', 'Thursday(4)', 'Friday(5)', 'Saturday(6)'];

async function investigate() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected to MongoDB!\n");
  const db = client.db('Tenuto-DB');

  // === 1. Rehearsals grouped by dayOfWeek and groupId ===
  console.log("=== 1. REHEARSALS GROUPED BY dayOfWeek AND groupId ===");
  const grouped = await db.collection('rehearsal').aggregate([
    { $match: { tenantId, schoolYearId } },
    { $group: { _id: { dayOfWeek: "$dayOfWeek", groupId: "$groupId" }, count: { $sum: 1 } } },
    { $sort: { "_id.dayOfWeek": 1, "_id.groupId": 1 } }
  ]).toArray();

  // === 2. Orchestra names for each groupId ===
  console.log("\n=== 2. ORCHESTRA NAMES FOR EACH groupId ===");
  const groupIds = [...new Set(grouped.map(g => g._id.groupId))];
  const orchMap = {};
  for (const gid of groupIds) {
    let orch = null;
    try { orch = await db.collection('orchestra').findOne({ _id: new ObjectId(gid) }); } catch(e) {}
    if (!orch) try { orch = await db.collection('orchestra').findOne({ _id: gid }); } catch(e) {}
    orchMap[gid] = orch ? orch.name : 'NOT FOUND (orphan!)';
    console.log("  groupId: " + gid + " => " + orchMap[gid]);
  }

  // Re-print grouped with orchestra names
  console.log("\n=== 1b. REHEARSAL SUMMARY (day + orchestra + count) ===");
  for (const g of grouped) {
    console.log("  " + (dayNames[g._id.dayOfWeek] || 'day?:' + g._id.dayOfWeek) + " | " + (orchMap[g._id.groupId] || '?') + " | " + g.count + " rehearsals");
  }

  // === 3. Orchestra schedule/rehearsal config ===
  console.log("\n=== 3. ORCHESTRAS - ALL FIELDS (checking for schedule config) ===");
  const orchestras = await db.collection('orchestra').find({ tenantId }).toArray();
  for (const o of orchestras) {
    console.log("\n  " + o.name + " (" + o._id + ")");
    const allKeys = Object.keys(o);
    // Show schedule-related keys
    const schedKeys = allKeys.filter(k => /sched|rehears|day|time|slot/i.test(k));
    if (schedKeys.length) {
      for (const k of schedKeys) console.log("    [SCHED] " + k + ": " + JSON.stringify(o[k]));
    }
    // Show rehearsalIds count
    if (o.rehearsalIds) {
      console.log("    rehearsalIds count: " + o.rehearsalIds.length);
    }
    // Show all remaining interesting keys
    const skipKeys = ['_id','name','tenantId','schoolYearId','createdAt','updatedAt','__v','type','conductorId','isActive','students','description','conductorIds','studentIds','enrollments','memberIds','maxCapacity','minAge','maxAge','department','level','instruments','rehearsalIds'];
    const otherKeys = allKeys.filter(k => !skipKeys.includes(k) && !schedKeys.includes(k));
    if (otherKeys.length) console.log("    other keys: " + otherKeys.join(', '));
  }

  // === 4. Specific orchestra checks ===
  console.log("\n\n=== 4. SPECIFIC ORCHESTRA CHECKS ===");

  // Check for simfonit
  const simfonit = orchestras.find(o => o.name && o.name.includes('סימפונית'));
  if (simfonit) {
    console.log("\n--- תזמורת סימפונית ייצוגית ---");
    const simfByDay = await db.collection('rehearsal').aggregate([
      { $match: { tenantId, schoolYearId, groupId: simfonit._id.toString() } },
      { $group: { _id: "$dayOfWeek", count: { $sum: 1 }, locations: { $addToSet: "$location" }, times: { $addToSet: { s: "$startTime", e: "$endTime" } } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    for (const d of simfByDay) {
      console.log("  " + dayNames[d._id] + ": " + d.count + " rehearsals | locations: " + d.locations.join(', ') + " | times: " + d.times.map(t => t.s + '-' + t.e).join(', '));
    }

    // Sunday specifically
    const sunReh = await db.collection('rehearsal').find({ tenantId, schoolYearId, groupId: simfonit._id.toString(), dayOfWeek: 0 }).sort({ date: 1 }).limit(5).toArray();
    if (sunReh.length > 0) {
      console.log("  *** SUNDAY REHEARSALS (first 5): ***");
      sunReh.forEach(r => console.log("    " + r._id + " | date:" + (r.date instanceof Date ? r.date.toISOString() : r.date) + " | " + r.startTime + "-" + r.endTime + " | loc:" + r.location));
    } else {
      console.log("  No Sunday rehearsals found.");
    }
  } else {
    console.log("  'סימפונית' NOT FOUND in orchestras");
  }

  // Check for makhela
  const makhela = orchestras.find(o => o.name && o.name.includes('מקהלה'));
  if (makhela) {
    console.log("\n--- מקהלה ---");
    const makByDay = await db.collection('rehearsal').aggregate([
      { $match: { tenantId, schoolYearId, groupId: makhela._id.toString() } },
      { $group: { _id: "$dayOfWeek", count: { $sum: 1 }, locations: { $addToSet: "$location" }, times: { $addToSet: { s: "$startTime", e: "$endTime" } } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    if (makByDay.length > 0) {
      for (const d of makByDay) {
        console.log("  " + dayNames[d._id] + ": " + d.count + " rehearsals | locations: " + d.locations.join(', ') + " | times: " + d.times.map(t => t.s + '-' + t.e).join(', '));
      }
    } else {
      console.log("  No rehearsals found at all.");
    }
  } else {
    console.log("  'מקהלה' NOT FOUND in orchestras");
  }

  // === 5. Distinct locations & room check ===
  console.log("\n\n=== 5. LOCATIONS & ROOMS ===");
  const locations = await db.collection('rehearsal').distinct('location', { tenantId, schoolYearId });
  console.log("Distinct rehearsal locations:");
  locations.forEach(l => console.log("  - " + (l || '(empty)')));

  const rooms = await db.collection('room').find({ tenantId }).toArray();
  console.log("\nRooms configured for tenant:");
  rooms.forEach(r => console.log("  - " + r.name + " (" + r._id + ")"));

  const hasOlamRashi = locations.some(l => l && l.includes('אולם ראשי'));
  console.log("\n'אולם ראשי' appears in rehearsal locations: " + hasOlamRashi);
  const roomHasOlamRashi = rooms.some(r => r.name && r.name.includes('אולם ראשי'));
  console.log("'אולם ראשי' exists as a room: " + roomHasOlamRashi);

  // === 6. All Sunday rehearsals with full details ===
  console.log("\n\n=== 6. ALL SUNDAY (dayOfWeek: 0) REHEARSALS ===");
  const sunAll = await db.collection('rehearsal').find({ tenantId, schoolYearId, dayOfWeek: 0 }).sort({ date: 1 }).toArray();
  console.log("Total Sunday rehearsals: " + sunAll.length);
  for (const r of sunAll) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
    console.log("  " + r._id + " | " + (orchMap[r.groupId] || 'UNKNOWN') + " | loc:" + (r.location || '(none)') + " | " + r.startTime + "-" + r.endTime + " | date:" + dateStr);
  }

  // === 7. Counts per day ===
  console.log("\n\n=== 7. REHEARSAL COUNTS PER DAY ===");
  const perDay = await db.collection('rehearsal').aggregate([
    { $match: { tenantId, schoolYearId } },
    { $group: { _id: "$dayOfWeek", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  let total = 0;
  perDay.forEach(d => { console.log("  " + (dayNames[d._id] || 'day?:' + d._id) + ": " + d.count); total += d.count; });
  console.log("  TOTAL: " + total);

  // === BONUS: Check for orphaned rehearsals (groupId pointing to non-existent orchestra) ===
  console.log("\n\n=== BONUS: ORPHAN CHECK ===");
  const orchIds = new Set(orchestras.map(o => o._id.toString()));
  const orphanGroups = groupIds.filter(gid => !orchIds.has(gid));
  if (orphanGroups.length > 0) {
    console.log("ORPHANED groupIds (no matching orchestra):");
    for (const gid of orphanGroups) {
      const count = grouped.filter(g => g._id.groupId === gid).reduce((s, g) => s + g.count, 0);
      console.log("  " + gid + " => " + count + " rehearsals with no orchestra!");
    }
  } else {
    console.log("No orphaned rehearsals found - all groupIds match existing orchestras.");
  }

  // === BONUS 2: Sample rehearsal document ===
  console.log("\n\n=== BONUS: SAMPLE REHEARSAL DOCUMENT ===");
  const sample = await db.collection('rehearsal').findOne({ tenantId, schoolYearId });
  if (sample) console.log(JSON.stringify(sample, null, 2));

  // === BONUS 3: Check for duplicate rehearsals (same orchestra, same date, same time) ===
  console.log("\n\n=== BONUS: DUPLICATE CHECK (same orchestra + date + time) ===");
  const dupes = await db.collection('rehearsal').aggregate([
    { $match: { tenantId, schoolYearId } },
    { $group: {
      _id: { groupId: "$groupId", date: "$date", startTime: "$startTime", endTime: "$endTime" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }},
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  if (dupes.length > 0) {
    console.log("DUPLICATES FOUND:");
    for (const d of dupes) {
      const dateStr = d._id.date instanceof Date ? d._id.date.toISOString().split('T')[0] : String(d._id.date);
      console.log("  " + (orchMap[d._id.groupId] || '?') + " | " + dateStr + " " + d._id.startTime + "-" + d._id.endTime + " | " + d.count + "x | ids: " + d.ids.join(', '));
    }
  } else {
    console.log("No exact duplicates found.");
  }

  await client.close();
  console.log("\n\nDone.");
}

investigate().catch(e => { console.error(e); process.exit(1); });
