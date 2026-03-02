/**
 * Step 06: Clear freetext notes fields across collections.
 * These may contain personal information in unstructured text.
 */

import { MongoClient } from 'mongodb';
import { CONFIG } from './config.js';

const NOTES_FIELDS = [
  { collection: 'rehearsal', fields: ['notes'] },
  { collection: 'theory_lesson', fields: ['notes', 'syllabus', 'homework'] },
  { collection: 'activity_attendance', fields: ['notes'] },
  { collection: 'orchestra', fields: ['notes'] },
];

async function main() {
  if (!CONFIG.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    console.log('\nClearing freetext notes fields...\n');

    for (const { collection, fields } of NOTES_FIELDS) {
      const setObj = {};
      for (const field of fields) {
        setObj[field] = '';
      }

      try {
        const result = await db.collection(collection).updateMany(
          {},
          { $set: setObj }
        );
        console.log(`  ${collection} (${fields.join(', ')}): updated ${result.modifiedCount} docs`);
      } catch (err) {
        console.log(`  ${collection}: skipped (${err.message})`);
      }
    }

    console.log('\nStep 06 complete.');

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
