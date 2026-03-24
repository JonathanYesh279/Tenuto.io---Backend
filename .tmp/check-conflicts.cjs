const { MongoClient } = require('mongodb');
require('dotenv').config();

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('Tenuto-DB');
  
  const raanana = await db.collection('tenant').findOne({ name: /רעננה/ });
  const tenantId = raanana._id.toString();
  
  const lessons = await db.collection('theory_lesson').find({
    tenantId, dayOfWeek: 0, location: 'חדר תאוריה א'
  }).toArray();
  
  console.log('Total theory lessons Day 0 חדר תאוריה א:', lessons.length);
  
  const byTime = {};
  for (const l of lessons) {
    const key = l.startTime + '-' + l.endTime;
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(l);
  }
  
  for (const [time, group] of Object.entries(byTime)) {
    console.log('\nTime:', time, '- Count:', group.length);
    for (const l of group.slice(0, 3)) {
      console.log('  ID:', l._id.toString(), 'name:', l.name, 'groupId:', l.groupId, 'students:', (l.studentIds || []).length, 'teacher:', l.teacherId);
    }
  }
  
  const sample = lessons[0];
  if (sample) console.log('\nSample fields:', Object.keys(sample).join(', '));
  
  // Count unique conflicts (room double-booking) per day, all sources
  console.log('\n--- CONFLICT SUMMARY ---');
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי'];
  
  for (let day = 0; day <= 5; day++) {
    const hebrewDay = dayNames[day];
    
    const timeBlocks = await db.collection('time_block').find({ tenantId, dayOfWeek: hebrewDay }).toArray();
    const rehearsals = await db.collection('rehearsal').find({ tenantId, dayOfWeek: day, isActive: { $ne: false } }).toArray();
    const theoryLessons = await db.collection('theory_lesson').find({ tenantId, dayOfWeek: day, isActive: { $ne: false } }).toArray();
    
    // Count cross-source conflicts only (theory vs timeBlock, theory vs rehearsal, timeBlock vs rehearsal)
    const activities = [];
    for (const tb of timeBlocks) {
      if (tb.room) activities.push({ type: 'timeBlock', id: tb._id.toString(), room: tb.room, startTime: tb.startTime, endTime: tb.endTime });
    }
    for (const r of rehearsals) {
      if (r.location) activities.push({ type: 'rehearsal', id: r._id.toString(), room: r.location, startTime: r.startTime, endTime: r.endTime });
    }
    for (const tl of theoryLessons) {
      if (tl.location) activities.push({ type: 'theory', id: tl._id.toString(), room: tl.location, startTime: tl.startTime, endTime: tl.endTime });
    }
    
    let crossSource = 0;
    let sameSource = 0;
    const byRoom = {};
    for (const a of activities) {
      if (!byRoom[a.room]) byRoom[a.room] = [];
      byRoom[a.room].push(a);
    }
    
    for (const [room, roomActs] of Object.entries(byRoom)) {
      for (let i = 0; i < roomActs.length; i++) {
        for (let j = i + 1; j < roomActs.length; j++) {
          const a = roomActs[i], b = roomActs[j];
          if (a.startTime < b.endTime && b.startTime < a.endTime) {
            if (a.type !== b.type) crossSource++;
            else sameSource++;
          }
        }
      }
    }
    
    if (crossSource > 0 || sameSource > 0) {
      console.log('Day', day, '(' + hebrewDay + '): cross-source:', crossSource, 'same-source:', sameSource);
    }
  }
  
  await client.close();
}

check().catch(console.error);
