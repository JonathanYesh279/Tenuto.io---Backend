/**
 * Step 02: Anonymize teacher collection.
 * Reads name-map.json and applies shuffled names + fake PII to all teachers.
 *
 * Transforms: firstName, lastName, phone, email, address, idNumber, birthYear,
 *             credentials.email, credentials.password
 */

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { CONFIG } from './config.js';
import { generateIsraeliId, generateMobilePhone, generateAddress, randInt } from './generators.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAME_MAP_PATH = join(__dirname, 'name-map.json');

async function main() {
  if (!existsSync(NAME_MAP_PATH)) {
    console.error('ERROR: name-map.json not found. Run 01-collect-name-pool.js first.');
    process.exit(1);
  }

  if (!CONFIG.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const nameMap = JSON.parse(readFileSync(NAME_MAP_PATH, 'utf-8'));
  console.log(`Loaded name map with ${Object.keys(nameMap.teachers).length} teacher mappings`);

  // Pre-hash the shared password
  const passwordHash = await bcrypt.hash(CONFIG.SHARED_PASSWORD, CONFIG.SALT_ROUNDS);
  console.log(`Shared password hash generated for "${CONFIG.SHARED_PASSWORD}"`);

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);
    const collection = db.collection('teacher');

    const teachers = await collection.find({}).toArray();
    console.log(`\nAbout to anonymize ${teachers.length} teachers`);

    const bulkOps = [];

    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i];
      const idStr = teacher._id.toString();
      const mapped = nameMap.teachers[idStr];

      if (!mapped) {
        console.warn(`  WARNING: No name mapping for teacher ${idStr}, skipping`);
        continue;
      }

      const email = `teacher${i + 1}@tenuto-dev.com`;

      const update = {
        $set: {
          'personalInfo.firstName': mapped.firstName,
          'personalInfo.lastName': mapped.lastName,
          'personalInfo.phone': generateMobilePhone(),
          'personalInfo.email': email,
          'personalInfo.address': generateAddress(),
          'personalInfo.idNumber': generateIsraeliId(),
          'personalInfo.birthYear': randInt(1960, 2000),
          'credentials.email': email,
          'credentials.password': passwordHash,
        },
      };

      // Clear invitation-related fields that might contain names
      if (teacher.credentials?.invitedBy) {
        update.$set['credentials.invitedBy'] = 'admin';
      }

      // Clear notes in timeBlocks
      if (teacher.teaching?.timeBlocks?.length) {
        const cleanedBlocks = teacher.teaching.timeBlocks.map(block => ({
          ...block,
          notes: '',
        }));
        update.$set['teaching.timeBlocks'] = cleanedBlocks;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: teacher._id },
          update,
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps);
      console.log(`\nTeachers anonymized:`);
      console.log(`  Matched: ${result.matchedCount}`);
      console.log(`  Modified: ${result.modifiedCount}`);
    }

    // Preview
    const sample = await collection.findOne({});
    if (sample) {
      console.log(`\nSample result:`);
      console.log(`  Name: ${sample.personalInfo?.firstName} ${sample.personalInfo?.lastName}`);
      console.log(`  Email: ${sample.personalInfo?.email}`);
      console.log(`  Credentials: ${sample.credentials?.email}`);
      console.log(`  Phone: ${sample.personalInfo?.phone}`);
      console.log(`  ID: ${sample.personalInfo?.idNumber}`);
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
