/**
 * Step 01: Collect all firstNames and lastNames from teachers + students,
 * shuffle them independently, and create a name-map.json assigning
 * new names to each entity.
 *
 * Output: scripts/anonymize/name-map.json
 */

import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CONFIG } from './config.js';
import { shuffle } from './generators.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, 'name-map.json');

async function main() {
  if (!CONFIG.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in .env');
    process.exit(1);
  }

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    // Collect all names from teachers
    const teachers = await db.collection('teacher')
      .find({}, { projection: { _id: 1, 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } })
      .toArray();

    // Collect all names from students
    const students = await db.collection('student')
      .find({}, { projection: { _id: 1, 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 } })
      .toArray();

    console.log(`Found ${teachers.length} teachers and ${students.length} students`);

    // Build name pools from both entities
    const allFirstNames = [];
    const allLastNames = [];

    for (const t of teachers) {
      if (t.personalInfo?.firstName) allFirstNames.push(t.personalInfo.firstName);
      if (t.personalInfo?.lastName) allLastNames.push(t.personalInfo.lastName);
    }
    for (const s of students) {
      if (s.personalInfo?.firstName) allFirstNames.push(s.personalInfo.firstName);
      if (s.personalInfo?.lastName) allLastNames.push(s.personalInfo.lastName);
    }

    console.log(`Name pool: ${allFirstNames.length} first names, ${allLastNames.length} last names`);

    // Shuffle both pools independently
    shuffle(allFirstNames);
    shuffle(allLastNames);

    // Assign shuffled names to each entity
    const nameMap = { teachers: {}, students: {} };

    let firstIdx = 0;
    let lastIdx = 0;

    for (const t of teachers) {
      nameMap.teachers[t._id.toString()] = {
        firstName: allFirstNames[firstIdx % allFirstNames.length],
        lastName: allLastNames[lastIdx % allLastNames.length],
      };
      firstIdx++;
      lastIdx++;
    }

    for (const s of students) {
      nameMap.students[s._id.toString()] = {
        firstName: allFirstNames[firstIdx % allFirstNames.length],
        lastName: allLastNames[lastIdx % allLastNames.length],
      };
      firstIdx++;
      lastIdx++;
    }

    // Write the name map
    writeFileSync(OUTPUT_PATH, JSON.stringify(nameMap, null, 2), 'utf-8');
    console.log(`\nName map written to: ${OUTPUT_PATH}`);
    console.log(`  Teachers mapped: ${Object.keys(nameMap.teachers).length}`);
    console.log(`  Students mapped: ${Object.keys(nameMap.students).length}`);

    // Preview first 3 teacher mappings
    const teacherIds = Object.keys(nameMap.teachers).slice(0, 3);
    console.log('\nPreview (first 3 teachers):');
    for (const id of teacherIds) {
      const orig = teachers.find(t => t._id.toString() === id);
      const mapped = nameMap.teachers[id];
      console.log(`  ${orig?.personalInfo?.firstName} ${orig?.personalInfo?.lastName} → ${mapped.firstName} ${mapped.lastName}`);
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
