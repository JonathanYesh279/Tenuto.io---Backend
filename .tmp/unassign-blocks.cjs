const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);

// Clear the room (location) on a few blocks so they show as unassigned
const blocksToUnassign = [
  // Teacher 69a76ab241d020935e54c8fd, Block on ראשון with 3 lessons
  { teacherId: '69a76ab241d020935e54c8fd', blockId: '69a76ab241d020935e54c8fa' },
  // Teacher 69a76ab241d020935e54c850, Block on חמישי with 3 lessons
  { teacherId: '69a76ab241d020935e54c850', blockId: '69a76ab241d020935e54c84d' },
  // Teacher 69a76ab241d020935e54c89d, Block on רביעי with 4 lessons
  { teacherId: '69a76ab241d020935e54c89d', blockId: '69a76ab241d020935e54c89a' },
];

async function run() {
  await client.connect();
  const db = client.db('Tenuto-DB');
  const teacherCol = db.collection('teacher');

  for (const { teacherId, blockId } of blocksToUnassign) {
    const result = await teacherCol.updateOne(
      {
        _id: new ObjectId(teacherId),
        'teaching.timeBlocks._id': new ObjectId(blockId),
      },
      {
        $set: { 'teaching.timeBlocks.$.location': '' },
      }
    );
    console.log(`Teacher ${teacherId} Block ${blockId}: modified=${result.modifiedCount}`);
  }

  await client.close();
  console.log('\nDone. 3 blocks now have no room assigned.');
}
run().catch(console.error);
