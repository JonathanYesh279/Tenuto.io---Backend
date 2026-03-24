const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  await client.connect();
  const db = client.db('Tenuto-DB');
  const teachers = await db.collection('teacher').find(
    { 'teaching.timeBlocks': { $exists: true, $ne: [] } },
    { projection: { firstName: 1, lastName: 1, 'teaching.timeBlocks': 1 } }
  ).limit(10).toArray();

  for (const t of teachers) {
    const blocks = t.teaching?.timeBlocks || [];
    const withRoom = blocks.filter(b => b.location);
    if (withRoom.length > 0) {
      console.log(`\n${t.firstName} ${t.lastName} (ID: ${t._id})`);
      withRoom.forEach(b => {
        const lessons = (b.assignedLessons || []).filter(l => l.isActive !== false);
        console.log(`  Block ${b._id} | ${b.day} ${b.startTime}-${b.endTime} | Room: ${b.location} | Lessons: ${lessons.length}`);
      });
    }
  }
  await client.close();
}
run().catch(console.error);
