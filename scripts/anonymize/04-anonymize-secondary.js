/**
 * Step 04: Anonymize secondary entities.
 * - tenant: director.name, conservatoryProfile fields
 * - bagrut: directorName, accompanist names/phones, notes
 * - super_admin: email, name, password
 */

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { CONFIG } from './config.js';
import { generateMobilePhone, generateLandlinePhone, generateAddress, pick } from './generators.js';

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

  // Build full name pool for random picking
  const allNames = [
    ...Object.values(nameMap.teachers).map(m => `${m.firstName} ${m.lastName}`),
    ...Object.values(nameMap.students).map(m => `${m.firstName} ${m.lastName}`),
  ];
  const allFirstNames = [
    ...Object.values(nameMap.teachers).map(m => m.firstName),
    ...Object.values(nameMap.students).map(m => m.firstName),
  ];
  const allLastNames = [
    ...Object.values(nameMap.teachers).map(m => m.lastName),
    ...Object.values(nameMap.students).map(m => m.lastName),
  ];

  const passwordHash = await bcrypt.hash(CONFIG.SHARED_PASSWORD, CONFIG.SALT_ROUNDS);

  const client = new MongoClient(CONFIG.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);

    // --- TENANT ---
    const tenants = await db.collection('tenant').find({}).toArray();
    console.log(`\nAnonymizing ${tenants.length} tenant(s)...`);

    for (const tenant of tenants) {
      const update = { $set: {} };

      if (tenant.director?.name) {
        update.$set['director.name'] = pick(allNames);
      }
      if (tenant.conservatoryProfile) {
        update.$set['conservatoryProfile.email'] = 'office@tenuto-dev.com';
        update.$set['conservatoryProfile.address'] = generateAddress();
        update.$set['conservatoryProfile.managerName'] = pick(allNames);
        update.$set['conservatoryProfile.managerNotes'] = '';
        if (tenant.conservatoryProfile.officePhone) {
          update.$set['conservatoryProfile.officePhone'] = generateLandlinePhone();
        }
        if (tenant.conservatoryProfile.mobilePhone) {
          update.$set['conservatoryProfile.mobilePhone'] = generateMobilePhone();
        }
      }

      if (Object.keys(update.$set).length > 0) {
        await db.collection('tenant').updateOne({ _id: tenant._id }, update);
      }
    }
    console.log(`  Tenants done.`);

    // --- BAGRUT ---
    const bagruts = await db.collection('bagrut').find({}).toArray();
    console.log(`\nAnonymizing ${bagruts.length} bagrut record(s)...`);

    const bagrutBulkOps = [];
    for (const bagrut of bagruts) {
      const update = { $set: {} };

      if (bagrut.directorName) {
        update.$set['directorName'] = pick(allNames);
      }

      if (bagrut.notes) {
        update.$set['notes'] = '';
      }

      // Anonymize accompanists
      if (bagrut.accompaniment?.accompanists?.length) {
        const anonAccompanists = bagrut.accompaniment.accompanists.map(acc => ({
          ...acc,
          name: `${pick(allFirstNames)} ${pick(allLastNames)}`,
          phone: acc.phone ? generateMobilePhone() : acc.phone,
        }));
        update.$set['accompaniment.accompanists'] = anonAccompanists;
      }

      if (Object.keys(update.$set).length > 0) {
        bagrutBulkOps.push({
          updateOne: {
            filter: { _id: bagrut._id },
            update,
          },
        });
      }
    }

    if (bagrutBulkOps.length > 0) {
      const result = await db.collection('bagrut').bulkWrite(bagrutBulkOps);
      console.log(`  Bagrut: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    } else {
      console.log(`  Bagrut: nothing to update.`);
    }

    // --- SUPER ADMIN ---
    const admins = await db.collection('super_admin').find({}).toArray();
    console.log(`\nAnonymizing ${admins.length} super admin(s)...`);

    for (let i = 0; i < admins.length; i++) {
      await db.collection('super_admin').updateOne(
        { _id: admins[i]._id },
        {
          $set: {
            email: `admin${i + 1}@tenuto-dev.com`,
            name: pick(allNames),
            password: passwordHash,
          },
        }
      );
    }
    console.log(`  Super admins done.`);

    console.log('\nStep 04 complete.');

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
