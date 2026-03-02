/**
 * Run all anonymization steps in sequence.
 *
 * Usage: node scripts/anonymize/run-all.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  { file: '01-collect-name-pool.js', desc: 'Collect & shuffle name pool' },
  { file: '02-anonymize-teachers.js', desc: 'Anonymize teachers' },
  { file: '03-anonymize-students.js', desc: 'Anonymize students' },
  { file: '04-anonymize-secondary.js', desc: 'Anonymize tenant, bagrut, super_admin' },
  { file: '05-drop-snapshots.js', desc: 'Drop snapshot/log collections' },
  { file: '06-clear-notes.js', desc: 'Clear freetext notes' },
];

console.log('=== Tenuto.io Database Anonymization ===\n');
console.log(`Running ${STEPS.length} steps...\n`);

for (let i = 0; i < STEPS.length; i++) {
  const step = STEPS[i];
  const scriptPath = join(__dirname, step.file);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step ${i + 1}/${STEPS.length}: ${step.desc}`);
  console.log('='.repeat(50));

  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    console.error(`\nERROR in step ${i + 1} (${step.file}): ${err.message}`);
    console.error('Stopping. Fix the issue and re-run from this step individually.');
    process.exit(1);
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log('All steps complete!');
console.log('='.repeat(50));
console.log('\nAll teacher logins: teacher{N}@tenuto-dev.com / Test1234!');
console.log('All admin logins:   admin{N}@tenuto-dev.com / Test1234!');
console.log('\nReview name-map.json for the full name shuffle mapping.');
