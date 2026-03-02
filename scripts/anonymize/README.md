# Database Anonymization Scripts

Transforms real PII in the development database into realistic fake data.

## Prerequisites

- MongoDB URI configured in `.env` (`MONGODB_URI`)
- Node.js 18+

## Usage

Run all steps:

```bash
node scripts/anonymize/run-all.js
```

Or run individually:

```bash
node scripts/anonymize/01-collect-name-pool.js   # Build shuffled name map
node scripts/anonymize/02-anonymize-teachers.js   # Anonymize teachers
node scripts/anonymize/03-anonymize-students.js   # Anonymize students
node scripts/anonymize/04-anonymize-secondary.js  # Anonymize tenant, bagrut, super_admin
node scripts/anonymize/05-drop-snapshots.js       # Drop snapshot/log collections
node scripts/anonymize/06-clear-notes.js          # Clear freetext notes
```

## After running

- **Teacher logins:** `teacher{N}@tenuto-dev.com` / `Test1234!`
- **Admin logins:** `admin{N}@tenuto-dev.com` / `Test1234!`
- **Name map:** Review `name-map.json` for the full shuffle mapping

## What changes

| Entity | Fields anonymized |
|--------|-------------------|
| Teacher | firstName, lastName, phone, email, address, idNumber, birthYear, credentials |
| Student | firstName, lastName, phone, address, parentName, parentPhone, parentEmail, studentEmail, age |
| Tenant | director.name, conservatoryProfile (email, address, manager, phones) |
| Bagrut | directorName, accompanist names/phones, notes |
| Super Admin | email, name, password |

## What stays the same

Rooms, instruments, enums, roles, schedule data, ObjectId references, orchestra names, school years, hours/grades.

## Collections dropped

import_log, ministry_report_snapshots, deletion_audit, deletion_snapshots, migration_backups, security_log, platform_audit_log.
