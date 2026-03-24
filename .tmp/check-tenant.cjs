const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  await client.connect();
  const db = client.db('Tenuto-DB');

  // The logged-in teacher from the logs
  const loggedIn = await db.collection('teacher').findOne(
    { _id: new ObjectId('69a98b3746ddf4782f87035d') },
    { projection: { firstName: 1, lastName: 1, tenantId: 1 } }
  );
  console.log('Logged in teacher:', loggedIn.firstName, loggedIn.lastName, '| tenantId:', loggedIn.tenantId);

  // Check tenantId of the blocks I modified
  const blockTeacherIds = ['69a76ab241d020935e54c8fd', '69a76ab241d020935e54c850', '69a76ab241d020935e54c89d'];
  for (const id of blockTeacherIds) {
    const t = await db.collection('teacher').findOne(
      { _id: new ObjectId(id) },
      { projection: { firstName: 1, lastName: 1, tenantId: 1 } }
    );
    console.log('Block teacher:', t.firstName, t.lastName, '| tenantId:', t.tenantId);
  }

  await client.close();
}
run().catch(console.error);
