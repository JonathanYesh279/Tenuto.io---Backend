const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);

const blockIds = [
  { teacherId: '69a76ab241d020935e54c8fd', blockId: '69a76ab241d020935e54c8fa' },
  { teacherId: '69a76ab241d020935e54c850', blockId: '69a76ab241d020935e54c84d' },
  { teacherId: '69a76ab241d020935e54c89d', blockId: '69a76ab241d020935e54c89a' },
];

async function run() {
  await client.connect();
  const db = client.db('Tenuto-DB');
  const teacherCol = db.collection('teacher');

  for (const { teacherId, blockId } of blockIds) {
    const teacher = await teacherCol.findOne(
      { _id: new ObjectId(teacherId), 'teaching.timeBlocks._id': new ObjectId(blockId) },
      { projection: { firstName: 1, lastName: 1, 'teaching.timeBlocks.$': 1 } }
    );
    if (teacher) {
      const block = teacher.teaching.timeBlocks[0];
      console.log(`${teacher.firstName} ${teacher.lastName} | Block ${blockId} | Day: ${block.day} | Location: "${block.location}" | Lessons: ${(block.assignedLessons || []).filter(l => l.isActive !== false).length}`);
    }
  }
  await client.close();
}
run().catch(console.error);
