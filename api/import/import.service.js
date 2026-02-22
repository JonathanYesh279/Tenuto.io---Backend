/**
 * Import Service
 *
 * Parses Ministry of Education Excel files and imports teacher/student data.
 * Flow: Upload → Parse → Match → Preview → Confirm → Write → Log
 *
 * Teacher matching: email (priority 1) → idNumber (priority 2) → firstName+lastName (priority 3)
 * Student matching: firstName+lastName (only — students rarely have email)
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import XLSX from 'xlsx';
import {
  INSTRUMENT_MAP,
  TEACHER_CLASSIFICATIONS,
  TEACHER_DEGREES,
  VALID_INSTRUMENTS,
} from '../../config/constants.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';

export const importService = {
  previewTeacherImport,
  previewStudentImport,
  executeImport,
};

// ─── Column Mappings (Hebrew headers → internal keys) ────────────────────────

const TEACHER_COLUMN_MAP = {
  'שם משפחה': 'lastName',
  'שם פרטי': 'firstName',
  'מספר זהות': 'idNumber',
  'ת.ז.': 'idNumber',
  'ת.ז': 'idNumber',
  'תעודת זהות': 'idNumber',
  'שנת לידה': 'birthYear',
  'סיווג': 'classification',
  'סווג': 'classification',
  'תואר': 'degree',
  'ותק': 'experience',
  'שנות ותק': 'experience',
  'ותק בהוראה': 'experience',
  'תעודת הוראה': 'teachingCertificate',
  'חבר ארגון': 'isUnionMember',
  'ארגון עובדים': 'isUnionMember',
  'טלפון': 'phone',
  'נייד': 'phone',
  'דוא"ל': 'email',
  'דואל': 'email',
  'אימייל': 'email',
  'מייל': 'email',
  'email': 'email',
};

const STUDENT_COLUMN_MAP = {
  'שם משפחה': 'lastName',
  'שם פרטי': 'firstName',
  'שם מלא': 'fullName',
  'כיתה': 'class',
  'שנות לימוד': 'studyYears',
  'שנת לימוד': 'studyYears',
  'שעה נוספת': 'extraHour',
  'כלי': 'instrument',
  'כלי נגינה': 'instrument',
  'גיל': 'age',
  // Ministry variants
  'שם ומשפחה': 'fullName',
  'שעה נוספת ל..': 'extraHour',
  'שעה נוספת לבחירת התלמיד': 'extraHour',
  'המורה': 'teacherName',
  'זמן שעור': 'lessonDuration',
  'שלב': 'ministryStageLevel',
};

// Build reverse lookup: abbreviation/name → canonical instrument name
const ABBREVIATION_TO_INSTRUMENT = {};
for (const inst of INSTRUMENT_MAP) {
  ABBREVIATION_TO_INSTRUMENT[inst.abbreviation] = inst.name;
  ABBREVIATION_TO_INSTRUMENT[inst.name] = inst.name;
}

// Build department → instruments lookup from INSTRUMENT_MAP
const DEPARTMENT_TO_INSTRUMENTS = {};
for (const inst of INSTRUMENT_MAP) {
  if (!DEPARTMENT_TO_INSTRUMENTS[inst.department]) {
    DEPARTMENT_TO_INSTRUMENTS[inst.department] = [];
  }
  DEPARTMENT_TO_INSTRUMENTS[inst.department].push(inst.name);
}
// Combined "כלי נשיפה" (all winds — Ministry sometimes uses this instead of specific sub-department)
DEPARTMENT_TO_INSTRUMENTS['כלי נשיפה'] = [
  ...(DEPARTMENT_TO_INSTRUMENTS['כלי נשיפה-עץ'] || []),
  ...(DEPARTMENT_TO_INSTRUMENTS['כלי נשיפה-פליז'] || []),
];

const TRUTHY_VALUES = ['✓', 'V', 'v', 'x', 'X', '1', 'כן', true, 1];

// ─── Israeli ID Validation (check digit) ─────────────────────────────────────

function validateIsraeliId(id) {
  const str = String(id).padStart(9, '0');
  if (!/^\d{9}$/.test(str)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(str[i]) * ((i % 2) + 1);
    if (val > 9) val -= 9;
    sum += val;
  }
  return sum % 10 === 0;
}

// ─── Excel Parsing ───────────────────────────────────────────────────────────

function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = {};
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
  }
  return { sheetNames: workbook.SheetNames, sheets };
}

function detectHeaderRow(rows, columnMap) {
  const maxRowsToScan = Math.min(10, rows.length);
  let bestScore = 0;
  let bestRowIndex = 0;

  for (let i = 0; i < maxRowsToScan; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;

    const headers = Object.keys(row);
    let score = 0;

    for (const header of headers) {
      const trimmed = header.trim();
      if (columnMap[trimmed]) score++;
      // Also check department names for instrument detection
      if (DEPARTMENT_TO_INSTRUMENTS[trimmed]) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  return { headerRowIndex: bestRowIndex, matchedColumns: bestScore };
}

function parseExcelBufferWithHeaderDetection(buffer, columnMap) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // First pass: read as raw arrays to scan for header row
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Convert raw arrays to objects using each row as potential headers
  // for the scoring algorithm
  const potentialHeaderRows = rawRows.slice(0, Math.min(10, rawRows.length)).map(row => {
    const obj = {};
    if (Array.isArray(row)) {
      row.forEach((cell, idx) => {
        if (cell !== '' && cell !== null && cell !== undefined) {
          obj[String(cell).trim()] = true;
        }
      });
    }
    return obj;
  });

  const { headerRowIndex, matchedColumns } = detectHeaderRow(potentialHeaderRows, columnMap);

  // Second pass: re-parse with correct header row
  const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });

  return { rows, headerRowIndex, matchedColumns, sheetNames: workbook.SheetNames };
}

function mapColumns(row, columnMap) {
  const mapped = {};
  for (const [header, value] of Object.entries(row)) {
    const trimmedHeader = header.trim();
    const mappedKey = columnMap[trimmedHeader];
    if (mappedKey) {
      mapped[mappedKey] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return mapped;
}

function detectInstrumentColumns(headers) {
  const instrumentColumns = [];
  for (const header of headers) {
    const trimmed = header.trim();
    if (ABBREVIATION_TO_INSTRUMENT[trimmed]) {
      instrumentColumns.push({
        header: trimmed,
        instrument: ABBREVIATION_TO_INSTRUMENT[trimmed],
        type: 'specific',
      });
    } else if (DEPARTMENT_TO_INSTRUMENTS[trimmed]) {
      instrumentColumns.push({
        header: trimmed,
        instruments: DEPARTMENT_TO_INSTRUMENTS[trimmed],
        type: 'department',
      });
    }
  }
  return instrumentColumns;
}

function readInstrumentMatrix(row, instrumentColumns) {
  const instruments = [];
  let departmentHint = null;

  for (const col of instrumentColumns) {
    const value = row[col.header];
    if (value && TRUTHY_VALUES.includes(value)) {
      if (col.type === 'specific') {
        instruments.push(col.instrument);
      } else if (col.type === 'department') {
        // Department column — record as hint, don't assign specific instrument
        departmentHint = col.header;
      }
    }
  }

  return { instruments, departmentHint };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateTeacherRow(mapped, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!mapped.firstName && !mapped.lastName) {
    errors.push({ row: rowIndex, field: 'name', message: 'חסר שם פרטי ושם משפחה' });
  }

  if (mapped.idNumber) {
    const idStr = String(mapped.idNumber).replace(/\D/g, '');
    if (!validateIsraeliId(idStr)) {
      warnings.push({ row: rowIndex, field: 'idNumber', message: `ת.ז. לא תקינה: ${mapped.idNumber}` });
    }
    mapped.idNumber = idStr.padStart(9, '0');
  }

  if (mapped.birthYear) {
    const year = parseInt(mapped.birthYear);
    if (isNaN(year) || year < 1940 || year > 2005) {
      warnings.push({ row: rowIndex, field: 'birthYear', message: `שנת לידה לא סבירה: ${mapped.birthYear}` });
    }
    mapped.birthYear = year || null;
  }

  if (mapped.classification && !TEACHER_CLASSIFICATIONS.includes(mapped.classification)) {
    warnings.push({ row: rowIndex, field: 'classification', message: `סיווג לא מוכר: ${mapped.classification}` });
  }

  if (mapped.degree && !TEACHER_DEGREES.includes(mapped.degree)) {
    warnings.push({ row: rowIndex, field: 'degree', message: `תואר לא מוכר: ${mapped.degree}` });
  }

  if (mapped.experience) {
    mapped.experience = parseInt(mapped.experience) || 0;
  }

  if (mapped.teachingCertificate !== undefined && mapped.teachingCertificate !== '') {
    mapped.teachingCertificate = TRUTHY_VALUES.includes(mapped.teachingCertificate);
  }

  if (mapped.isUnionMember !== undefined && mapped.isUnionMember !== '') {
    mapped.isUnionMember = TRUTHY_VALUES.includes(mapped.isUnionMember);
  }

  return { errors, warnings };
}

function validateStudentRow(mapped, rowIndex) {
  const errors = [];
  const warnings = [];

  // Handle fullName split if firstName/lastName not provided
  if (!mapped.firstName && !mapped.lastName && mapped.fullName) {
    const parts = mapped.fullName.trim().split(/\s+/);
    mapped.firstName = parts[0] || '';
    mapped.lastName = parts.slice(1).join(' ') || '';
  }

  if (!mapped.firstName && !mapped.lastName) {
    errors.push({ row: rowIndex, field: 'name', message: 'חסר שם תלמיד' });
  }

  if (mapped.studyYears) {
    mapped.studyYears = parseInt(mapped.studyYears) || null;
  }

  if (mapped.extraHour !== undefined && mapped.extraHour !== '') {
    mapped.extraHour = TRUTHY_VALUES.includes(mapped.extraHour);
  }

  if (mapped.instrument && !VALID_INSTRUMENTS.includes(mapped.instrument)) {
    warnings.push({ row: rowIndex, field: 'instrument', message: `כלי לא מוכר: ${mapped.instrument}` });
  }

  // Convert lessonDuration: handle both weekly hours (Ministry: 0.75) and direct minutes (45)
  if (mapped.lessonDuration !== undefined && mapped.lessonDuration !== '') {
    const rawValue = parseFloat(mapped.lessonDuration);
    if (!isNaN(rawValue)) {
      let minutes;
      if (rawValue >= 10) {
        // Direct minutes input (e.g., 30, 45, 60) — no conversion needed
        minutes = Math.round(rawValue);
      } else {
        // Weekly hours input (Ministry format: 0.5, 0.75, 1.0, 1.5, 2.0, 2.5) — convert to minutes
        minutes = Math.round(rawValue * 60);
      }

      if ([30, 45, 60].includes(minutes)) {
        mapped.lessonDuration = minutes;
      } else if (minutes > 60 && minutes <= 300) {
        // Multiple lessons per week — derive per-lesson duration
        if (minutes % 45 === 0) {
          mapped.lessonDuration = 45;       // 90=2×45, 135=3×45
        } else if (minutes % 60 === 0) {
          mapped.lessonDuration = 60;       // 120=2×60, 180=3×60, 300=5×60
        } else {
          mapped.lessonDuration = 45;       // Safe default for odd values (150)
        }
        mapped.extraHour = true;
      } else {
        warnings.push({ row: rowIndex, field: 'lessonDuration', message: `זמן שיעור לא תקין: ${mapped.lessonDuration} (צפי: 0.5/0.75/1.0 שעות או 30/45/60 דקות)` });
        mapped.lessonDuration = null;
      }
    }
  }

  // Validate Ministry stage level
  if (mapped.ministryStageLevel !== undefined && mapped.ministryStageLevel !== '') {
    const validStages = ['א', 'ב', 'ג'];
    if (!validStages.includes(mapped.ministryStageLevel)) {
      warnings.push({ row: rowIndex, field: 'ministryStageLevel', message: `שלב לא מוכר: ${mapped.ministryStageLevel}` });
    }
  }

  // Validate age if present
  if (mapped.age !== undefined && mapped.age !== '') {
    const age = parseInt(mapped.age);
    if (isNaN(age) || age < 3 || age > 99) {
      warnings.push({ row: rowIndex, field: 'age', message: `גיל לא סביר: ${mapped.age}` });
      mapped.age = null;
    } else {
      mapped.age = age;
    }
  }

  return { errors, warnings };
}

// ─── Matching Logic ──────────────────────────────────────────────────────────

function matchTeacher(mapped, teachers) {
  // Priority 1: email
  if (mapped.email) {
    const emailLower = mapped.email.toLowerCase();
    const match = teachers.find(
      (t) =>
        t.personalInfo?.email?.toLowerCase() === emailLower ||
        t.credentials?.email?.toLowerCase() === emailLower
    );
    if (match) return { teacher: match, matchType: 'email' };
  }

  // Priority 2: idNumber
  if (mapped.idNumber) {
    const match = teachers.find((t) => t.personalInfo?.idNumber === mapped.idNumber);
    if (match) return { teacher: match, matchType: 'idNumber' };
  }

  // Priority 3: firstName + lastName
  if (mapped.firstName && mapped.lastName) {
    const fn = mapped.firstName.trim().toLowerCase();
    const ln = mapped.lastName.trim().toLowerCase();
    const match = teachers.find(
      (t) =>
        (t.personalInfo?.firstName || '').trim().toLowerCase() === fn &&
        (t.personalInfo?.lastName || '').trim().toLowerCase() === ln
    );
    if (match) return { teacher: match, matchType: 'name' };
  }

  return null;
}

function matchStudent(mapped, students) {
  if (mapped.firstName && mapped.lastName) {
    const fn = mapped.firstName.trim().toLowerCase();
    const ln = mapped.lastName.trim().toLowerCase();
    const matches = students.filter(
      (s) =>
        (s.personalInfo?.firstName || '').trim().toLowerCase() === fn &&
        (s.personalInfo?.lastName || '').trim().toLowerCase() === ln
    );
    if (matches.length === 1) {
      return { student: matches[0], matchType: 'name' };
    }
    if (matches.length > 1) {
      return { student: matches[0], matchType: 'name_duplicate', duplicateCount: matches.length };
    }
  }
  return null;
}

// ─── Diff Calculation ────────────────────────────────────────────────────────

const TEACHER_FIELD_PATHS = {
  firstName: 'personalInfo.firstName',
  lastName: 'personalInfo.lastName',
  idNumber: 'personalInfo.idNumber',
  birthYear: 'personalInfo.birthYear',
  phone: 'personalInfo.phone',
  email: 'personalInfo.email',
  classification: 'professionalInfo.classification',
  degree: 'professionalInfo.degree',
  experience: 'professionalInfo.teachingExperienceYears',
  teachingCertificate: 'professionalInfo.hasTeachingCertificate',
  isUnionMember: 'professionalInfo.isUnionMember',
};

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function calculateTeacherChanges(teacher, mapped, instruments) {
  const changes = [];

  for (const [key, path] of Object.entries(TEACHER_FIELD_PATHS)) {
    if (mapped[key] === '' || mapped[key] === null || mapped[key] === undefined) continue;
    const current = getNestedValue(teacher, path);
    if (String(current ?? '') !== String(mapped[key])) {
      changes.push({ field: path, oldValue: current ?? null, newValue: mapped[key] });
    }
  }

  // Instrument changes
  if (instruments.length > 0) {
    const currentInstruments = teacher.professionalInfo?.instruments || [];
    const sorted1 = [...currentInstruments].sort();
    const sorted2 = [...instruments].sort();
    if (JSON.stringify(sorted1) !== JSON.stringify(sorted2)) {
      changes.push({
        field: 'professionalInfo.instruments',
        oldValue: currentInstruments,
        newValue: instruments,
      });
    }
  }

  return changes;
}

function calculateStudentChanges(student, mapped) {
  const changes = [];

  const fields = [
    { key: 'studyYears', path: 'academicInfo.studyYears' },
    { key: 'extraHour', path: 'academicInfo.extraHour' },
    { key: 'class', path: 'academicInfo.class' },
  ];

  for (const { key, path } of fields) {
    if (mapped[key] === '' || mapped[key] === null || mapped[key] === undefined) continue;
    const current = getNestedValue(student, path);
    if (String(current ?? '') !== String(mapped[key])) {
      changes.push({ field: path, oldValue: current ?? null, newValue: mapped[key] });
    }
  }

  return changes;
}

// ─── Preview (Dry Run) ──────────────────────────────────────────────────────

async function previewTeacherImport(buffer, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  const { rows, headerRowIndex, matchedColumns } = parseExcelBufferWithHeaderDetection(buffer, TEACHER_COLUMN_MAP);
  if (rows.length === 0) throw new Error('הקובץ ריק או לא מכיל נתונים');

  const headers = Object.keys(rows[0]);
  const instrumentColumns = detectInstrumentColumns(headers);

  // Load all teachers in tenant
  const teacherCollection = await getCollection('teacher');
  const filter = { isActive: true, tenantId };
  const teachers = await teacherCollection.find(filter).toArray();

  const preview = {
    totalRows: rows.length,
    matched: [],
    notFound: [],
    errors: [],
    warnings: [],
    instrumentColumnsDetected: instrumentColumns.map((c) => c.type === 'specific' ? c.instrument : c.header),
    headerRowIndex,
    matchedColumns,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapColumns(row, TEACHER_COLUMN_MAP);
    const { instruments, departmentHint } = readInstrumentMatrix(row, instrumentColumns);
    const { errors, warnings } = validateTeacherRow(mapped, i + 2); // +2 for 1-indexed + header row

    if (errors.length > 0) {
      preview.errors.push(...errors);
      continue;
    }
    preview.warnings.push(...warnings);

    const match = matchTeacher(mapped, teachers);
    if (match) {
      const changes = calculateTeacherChanges(match.teacher, mapped, instruments);
      preview.matched.push({
        row: i + 2,
        matchType: match.matchType,
        teacherId: match.teacher._id.toString(),
        teacherName: `${match.teacher.personalInfo?.firstName || ''} ${match.teacher.personalInfo?.lastName || ''}`.trim(),
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        changes,
        instruments,
        mapped,
      });
    } else {
      preview.notFound.push({
        row: i + 2,
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        mapped,
        instruments,
      });
    }
  }

  // Save preview to import_log with status 'pending'
  const importLogCollection = await getCollection('import_log');
  const logEntry = {
    importType: 'teachers',
    tenantId,
    status: 'pending',
    createdAt: new Date(),
    preview,
  };
  const result = await importLogCollection.insertOne(logEntry);

  return { importLogId: result.insertedId.toString(), preview };
}

async function previewStudentImport(buffer, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  const { rows, headerRowIndex, matchedColumns } = parseExcelBufferWithHeaderDetection(buffer, STUDENT_COLUMN_MAP);
  if (rows.length === 0) throw new Error('הקובץ ריק או לא מכיל נתונים');

  const headers = Object.keys(rows[0]);
  const instrumentColumns = detectInstrumentColumns(headers);

  const studentCollection = await getCollection('student');
  const filter = { isActive: true, tenantId };
  const students = await studentCollection.find(filter).toArray();

  const preview = {
    totalRows: rows.length,
    matched: [],
    notFound: [],
    errors: [],
    warnings: [],
    headerRowIndex,
    matchedColumns,
  };

  let skippedEmpty = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapColumns(row, STUDENT_COLUMN_MAP);

    // Skip footer/summary rows that have no student name data at all
    if (!mapped.fullName && !mapped.firstName && !mapped.lastName) {
      skippedEmpty++;
      continue;
    }

    const { instruments, departmentHint } = readInstrumentMatrix(row, instrumentColumns);
    const { errors, warnings } = validateStudentRow(mapped, i + 2);

    if (errors.length > 0) {
      preview.errors.push(...errors);
      continue;
    }
    preview.warnings.push(...warnings);

    // If department column was detected but no specific instrument, try auto-assign
    if (instruments.length === 0 && departmentHint) {
      const deptInstruments = DEPARTMENT_TO_INSTRUMENTS[departmentHint];
      if (deptInstruments && deptInstruments.length === 1) {
        // Department has exactly 1 instrument — auto-assign it
        mapped.instrument = deptInstruments[0];
        warnings.push({
          row: i + 2,
          field: 'instrument',
          message: `כלי נגינה הוקצה אוטומטית מעמודת מחלקה '${departmentHint}': ${deptInstruments[0]}`
        });
      } else {
        // Department has multiple instruments — can't auto-assign, warn user
        mapped.instrument = null;
        warnings.push({
          row: i + 2,
          field: 'instrument',
          message: `עמודת מחלקה '${departmentHint}' מזוהה (${(deptInstruments || []).length} כלים), כלי ספציפי לא ידוע`
        });
      }
    } else if (instruments.length > 0) {
      mapped.instrument = instruments[0]; // Take first matched specific instrument
    }

    // Store departmentHint in mapped data for frontend display
    if (departmentHint) {
      mapped.departmentHint = departmentHint;
    }

    const match = matchStudent(mapped, students);
    if (match) {
      const changes = calculateStudentChanges(match.student, mapped);
      const entry = {
        row: i + 2,
        matchType: match.matchType,
        studentId: match.student._id.toString(),
        studentName: `${match.student.personalInfo?.firstName || ''} ${match.student.personalInfo?.lastName || ''}`.trim(),
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        changes,
        mapped,
      };
      if (match.matchType === 'name_duplicate') {
        entry.duplicateCount = match.duplicateCount;
        preview.warnings.push({
          row: i + 2,
          field: 'name',
          message: `נמצאו ${match.duplicateCount} תלמידים עם שם זהה`,
        });
      }
      preview.matched.push(entry);
    } else {
      preview.notFound.push({
        row: i + 2,
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        mapped,
      });
    }
  }

  // Adjust totalRows to exclude skipped empty/footer rows
  preview.totalRows = rows.length - skippedEmpty;

  const importLogCollection = await getCollection('import_log');
  const logEntry = {
    importType: 'students',
    tenantId,
    status: 'pending',
    createdAt: new Date(),
    preview,
  };
  const result = await importLogCollection.insertOne(logEntry);

  return { importLogId: result.insertedId.toString(), preview };
}

// ─── Execute Import ──────────────────────────────────────────────────────────

async function executeImport(importLogId, userId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);

  const importLogCollection = await getCollection('import_log');
  const filter = { _id: ObjectId.createFromHexString(importLogId), tenantId };
  const log = await importLogCollection.findOne(filter);

  if (!log) throw new Error('ייבוא לא נמצא');
  if (log.status !== 'pending') throw new Error('הייבוא כבר בוצע או נכשל');

  await importLogCollection.updateOne(
    { _id: log._id, tenantId },
    { $set: { status: 'processing', startedAt: new Date(), uploadedBy: userId || null } }
  );

  try {
    if (log.importType === 'teachers') {
      return await executeTeacherImport(log, importLogCollection, tenantId);
    } else if (log.importType === 'students') {
      return await executeStudentImport(log, importLogCollection, tenantId);
    } else {
      throw new Error(`סוג ייבוא לא מוכר: ${log.importType}`);
    }
  } catch (err) {
    await importLogCollection.updateOne(
      { _id: log._id, tenantId },
      { $set: { status: 'failed', error: err.message, completedAt: new Date() } }
    );
    throw err;
  }
}

async function executeTeacherImport(log, importLogCollection, tenantId) {
  const teacherCollection = await getCollection('teacher');
  const matched = log.preview.matched || [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const affectedDocIds = [];

  for (const entry of matched) {
    if (entry.changes.length === 0) continue;

    try {
      const updateDoc = {};
      for (const change of entry.changes) {
        updateDoc[change.field] = change.newValue;
      }
      updateDoc.updatedAt = new Date();

      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(entry.teacherId), tenantId },
        { $set: updateDoc }
      );
      successCount++;
      affectedDocIds.push(entry.teacherId);
    } catch (err) {
      errorCount++;
      errors.push({ teacherId: entry.teacherId, error: err.message });
    }
  }

  const results = {
    totalRows: log.preview.totalRows,
    matchedCount: matched.length,
    successCount,
    createdCount: 0,       // Teachers not auto-created from import
    errorCount,
    skippedCount: matched.filter((e) => e.changes.length === 0).length,
    notFoundCount: (log.preview.notFound || []).length,
    errors,
    affectedDocIds,
  };

  const status = errorCount > 0 && successCount > 0 ? 'partial' : errorCount > 0 ? 'failed' : 'completed';
  await importLogCollection.updateOne(
    { _id: log._id, tenantId },
    { $set: { status, results, affectedDocIds, completedAt: new Date() } }
  );

  return results;
}

async function executeStudentImport(log, importLogCollection, tenantId) {
  const studentCollection = await getCollection('student');
  const matched = log.preview.matched || [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const affectedDocIds = [];

  for (const entry of matched) {
    if (entry.changes.length === 0) continue;

    try {
      const updateDoc = {};
      for (const change of entry.changes) {
        updateDoc[change.field] = change.newValue;
      }
      updateDoc.updatedAt = new Date();

      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(entry.studentId), tenantId },
        { $set: updateDoc }
      );
      successCount++;
      affectedDocIds.push(entry.studentId);
    } catch (err) {
      errorCount++;
      errors.push({ studentId: entry.studentId, error: err.message });
    }
  }

  // --- Create new students from unmatched rows ---
  // IMPORTANT: notFound entries already have their mapped data fully processed by
  // previewStudentImport (Plan 01). This means:
  //   - fullName has been split into firstName/lastName by validateStudentRow
  //   - instrument has been detected (specific or via departmentHint auto-assign)
  //   - lessonDuration has been converted from weekly hours to minutes
  //   - ministryStageLevel has been validated
  // The validation gate below simply checks if the name split succeeded.
  const notFound = log.preview.notFound || [];
  let createdCount = 0;

  for (const entry of notFound) {
    const { mapped } = entry;

    // Validation gate: must have at least a name (already split by validateStudentRow in preview)
    if (!mapped?.firstName && !mapped?.lastName) {
      errorCount++;
      errors.push({ row: entry.row, studentName: entry.importedName || '(ללא שם)', error: 'חסר שם תלמיד - לא ניתן ליצור רשומה' });
      continue;
    }

    try {
      const newStudent = {
        tenantId,
        personalInfo: {
          firstName: mapped.firstName || '',
          lastName: mapped.lastName || '',
        },
        academicInfo: {
          class: mapped.class || null,
          studyYears: mapped.studyYears ? parseInt(mapped.studyYears) || 1 : 1,
          extraHour: typeof mapped.extraHour === 'boolean' ? mapped.extraHour : false,
          instrument: mapped.instrument || null,
          age: mapped.age ? parseInt(mapped.age) || null : null,
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add lessonDuration if converted from Ministry weekly hours (Plan 01 converts to minutes)
      if (mapped.lessonDuration && typeof mapped.lessonDuration === 'number') {
        newStudent.academicInfo.lessonDuration = mapped.lessonDuration;
      }

      // Add Ministry stage level if present
      if (mapped.ministryStageLevel) {
        newStudent.academicInfo.ministryStageLevel = mapped.ministryStageLevel;
      }

      const result = await studentCollection.insertOne(newStudent);
      createdCount++;
      affectedDocIds.push(result.insertedId.toString());
    } catch (err) {
      errorCount++;
      errors.push({ row: entry.row, studentName: entry.importedName, error: err.message });
    }
  }

  const results = {
    totalRows: log.preview.totalRows,
    matchedCount: matched.length,
    successCount,          // existing: count of successful updates
    createdCount,          // NEW: count of created students
    errorCount,
    skippedCount: matched.filter((e) => e.changes.length === 0).length,
    notFoundCount: notFound.length,   // total unmatched rows (includes created + creation errors)
    errors,
    affectedDocIds,
  };

  const totalSuccess = successCount + createdCount;
  const status = errorCount > 0 && totalSuccess > 0 ? 'partial' : errorCount > 0 ? 'failed' : 'completed';
  await importLogCollection.updateOne(
    { _id: log._id, tenantId },
    { $set: { status, results, affectedDocIds, completedAt: new Date() } }
  );

  return results;
}
