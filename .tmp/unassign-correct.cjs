const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);

// Blocks from tenant 69a98b3646ddf4782f87035c on ראשון with lessons
const blocksToUnassign = [
  // ראשון 09:00-12:00 | Room: חדר 8 | 4 lessons
  { teacherId: '69a9a4f1c94832b50efadab9', blockId: '69a9a90146cd5696f4c4533e' },
  // ראשון 10:30-14:30 | Room: חדר תאוריה ב | 6 lessons
  { teacherId: '69a9a4f1c94832b50efadaba', blockId: '69a9a90146cd5696f4c45340' },
];

// Also revert the wrong-tenant blocks back
const blocksToRevert = [
  { teacherId: '69a76ab241d020935e54c8fd', blockId: '69a76ab241d020935e54c8fa', room: 'חדר 15' },
  { teacherId: '69a76ab241d020935e54c850', blockId: '69a76ab241d020935e54c84d', room: 'חדר 9' },
  { teacherId: '69a76ab241d020935e54c89d', blockId: '69a76ab241d020935e54c89a', room: 'חדר 4' },
];

async function run() {
  await client.connect();
  const db = client.db('Tenuto-DB');
  const col = db.collection('teacher');

  // Unassign correct tenant blocks
  for (const { teacherId, blockId } of blocksToUnassign) {
    const result = await col.updateOne(
      { _id: new ObjectId(teacherId), 'teaching.timeBlocks._id': new ObjectId(blockId) },
      { $set: { 'teaching.timeBlocks.$.location': '' } }
    );
    console.log('Unassigned block ' + blockId + ': modified=' + result.modifiedCount);
  }

  // Revert wrong-tenant blocks
  for (const { teacherId, blockId, room } of blocksToRevert) {
    const result = await col.updateOne(
      { _id: new ObjectId(teacherId), 'teaching.timeBlocks._id': new ObjectId(blockId) },
      { $set: { 'teaching.timeBlocks.$.location': room } }
    );
    console.log('Reverted block ' + blockId + ' back to ' + room + ': modified=' + result.modifiedCount);
  }

  await client.close();
  console.log('\nDone. 2 blocks unassigned on ראשון for correct tenant. Wrong-tenant blocks restored.');
}
run().catch(console.error);
