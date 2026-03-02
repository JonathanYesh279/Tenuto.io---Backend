/**
 * Step 03: Anonymize student collection.
 * Reads name-map.json and applies shuffled names + fake PII to all students.
 *
 * Transforms: firstName, lastName, phone, address, parentName, parentPhone,
 *             parentEmail, studentEmail, age (±2 jitter)
 */

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CONFIG } from './config.js';
import { generateMobilePhone, generateAddress, randInt, pick } from './generators.js';

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

  // Build a pool of first names for parent name generation
  const allFirstNames = [
    ...Object.values(nameMap.teachers).map(m => m.firstName),
    ...Object.values(nameMap.students).map(m => m.firstName),
  ];

  console.log(`Loaded name map with ${Object.keys(nameMap.students).length} student mappings`);

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);
    const collection = db.collection('student');

    const students = await collection.find({}).toArray();
    console.log(`\nAbout to anonymize ${students.length} students`);

    const bulkOps = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const idStr = student._id.toString();
      const mapped = nameMap.students[idStr];

      if (!mapped) {
        console.warn(`  WARNING: No name mapping for student ${idStr}, skipping`);
        continue;
      }

      // Parent gets a random first name + the student's new last name
      const parentFirstName = pick(allFirstNames);
      const parentName = `${parentFirstName} ${mapped.lastName}`;

      const update = {
        $set: {
          'personalInfo.firstName': mapped.firstName,
          'personalInfo.lastName': mapped.lastName,
          'personalInfo.phone': generateMobilePhone(),
          'personalInfo.address': generateAddress(),
          'personalInfo.parentName': parentName,
          'personalInfo.parentPhone': generateMobilePhone(),
          'personalInfo.parentEmail': `parent${i + 1}@tenuto-dev.com`,
          'personalInfo.studentEmail': `student${i + 1}@tenuto-dev.com`,
        },
      };

      // Jitter age ±2 if it exists
      if (student.personalInfo?.age != null) {
        const newAge = Math.max(6, Math.min(18, student.personalInfo.age + randInt(-2, 2)));
        update.$set['personalInfo.age'] = newAge;
      }

      // Clear notes in teacherAssignments
      if (student.teacherAssignments?.length) {
        const cleanedAssignments = student.teacherAssignments.map(assignment => ({
          ...assignment,
          notes: '',
        }));
        update.$set['teacherAssignments'] = cleanedAssignments;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: student._id },
          update,
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps);
      console.log(`\nStudents anonymized:`);
      console.log(`  Matched: ${result.matchedCount}`);
      console.log(`  Modified: ${result.modifiedCount}`);
    }

    // Preview
    const sample = await collection.findOne({});
    if (sample) {
      console.log(`\nSample result:`);
      console.log(`  Name: ${sample.personalInfo?.firstName} ${sample.personalInfo?.lastName}`);
      console.log(`  Parent: ${sample.personalInfo?.parentName}`);
      console.log(`  Email: ${sample.personalInfo?.studentEmail}`);
      console.log(`  Parent Email: ${sample.personalInfo?.parentEmail}`);
      console.log(`  Phone: ${sample.personalInfo?.phone}`);
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
