/**
 * Step 05: Drop snapshot/log collections that contain embedded PII.
 * These are historical artifacts not needed for development.
 */

import { MongoClient } from 'mongodb';
import { CONFIG, COLLECTIONS_TO_DROP } from './config.js';

async function main() {
  if (!CONFIG.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    console.log(`\nDropping ${COLLECTIONS_TO_DROP.length} snapshot/log collections...\n`);

    for (const name of COLLECTIONS_TO_DROP) {
      try {
        const count = await db.collection(name).countDocuments();
        await db.collection(name).deleteMany({});
        console.log(`  ${name}: cleared ${count} documents`);
      } catch (err) {
        // Collection might not exist — that's fine
        console.log(`  ${name}: skipped (${err.message})`);
      }
    }

    console.log('\nStep 05 complete.');

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
