const { MongoClient } = require('mongodb');
require('dotenv').config();

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('Tenuto-DB');
  
  const raanana = await db.collection('tenant').findOne({ name: /רעננה/ });
  const tenantId = raanana._id.toString();
  
  // Get all teachers with timeBlocks
  const teachers = await db.collection('teacher').find({
    tenantId,
    'teaching.timeBlocks': { $exists: true, $ne: [] }
  }).toArray();
  
  // Flatten all timeBlocks across teachers
  const allBlocks = [];
  for (const t of teachers) {
    const name = `${t.personalInfo?.firstName || ''} ${t.personalInfo?.lastName || ''}`.trim();
    for (const block of (t.teaching?.timeBlocks || [])) {
      if (block.isActive && block.location) {
        allBlocks.push({
          teacherName: name,
          teacherId: t._id.toString(),
          blockId: block._id?.toString(),
          day: block.day,
          room: block.location,
          startTime: block.startTime,
          endTime: block.endTime,
        });
      }
    }
  }
  
  console.log('Total active timeBlocks with rooms:', allBlocks.length);
  
  // Check for room conflicts between different teachers
  const byDayRoom = {};
  for (const b of allBlocks) {
    const key = b.day + '|' + b.room;
    if (!byDayRoom[key]) byDayRoom[key] = [];
    byDayRoom[key].push(b);
  }
  
  for (const [key, blocks] of Object.entries(byDayRoom)) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j];
        if (a.teacherId === b.teacherId) continue; // same teacher, handled by existing check
        if (a.startTime < b.endTime && b.startTime < a.endTime) {
          console.log('ROOM CONFLICT:', key);
          console.log('  Teacher A:', a.teacherName, a.startTime, '-', a.endTime);
          console.log('  Teacher B:', b.teacherName, b.startTime, '-', b.endTime);
        }
      }
    }
  }
  
  await client.close();
}

check().catch(console.error);
