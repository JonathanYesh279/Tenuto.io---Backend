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
import ExcelJS from 'exceljs';
import {
  INSTRUMENT_MAP,
  TEACHER_CLASSIFICATIONS,
  TEACHER_DEGREES,
  VALID_INSTRUMENTS,
  TEACHER_HOURS_COLUMNS,
  TEACHER_ROLES,
  MANAGEMENT_ROLES,
} from '../../config/constants.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import { authService } from '../auth/auth.service.js';
import { invitationConfig, DEFAULT_PASSWORD } from '../../services/invitationConfig.js';
import { validateTeacherImport } from '../teacher/teacher.validation.js';

export const importService = {
  previewTeacherImport,
  previewStudentImport,
  executeImport,
  repairImportedTeachers,
};

// ─── Column Mappings (Hebrew headers → internal keys) ────────────────────────

const TEACHER_COLUMN_MAP = {
  'שם משפחה': 'lastName',
  'משפחה': 'lastName',
  'שם פרטי': 'firstName',
  'פרטי': 'firstName',
  'מספר זהות': 'idNumber',
  'ת.ז.': 'idNumber',
  'ת.ז': 'idNumber',
  'תעודת זהות': 'idNumber',
  'זהות': 'idNumber',                       // Short form in multi-row merged headers
  'כולל ס.ב. ללא מקף (-)': 'idNumber',  // Ministry file variant
  'שנת לידה': 'birthYear',
  'לידה': 'birthYear',                      // Ministry file — merged header fragment
  'סיווג': 'classification',
  'סווג': 'classification',
  'תואר': 'degree',
  'ותק': 'experience',
  'שנות ותק': 'experience',
  'ותק בהוראה': 'experience',
  'מס\' שנים': 'experience',               // Ministry file variant
  'תעודת הוראה': 'teachingCertificate',
  'חבר ארגון': 'isUnionMember',
  'ארגון עובדים': 'isUnionMember',
  'חבר/ה': 'isUnionMember',                 // Ministry file — merged header fragment
  'חבר\\ה': 'isUnionMember',                // Ministry file — backslash variant
  'כן-לא': 'teachingCertificate',          // Ministry file — col 9 is teaching certificate, NOT union member
  'טלפון': 'phone',
  'נייד': 'phone',
  'מספר טלפון נייד': 'phone',             // Ministry file variant
  'דוא"ל': 'email',
  'דואל': 'email',
  'אימייל': 'email',
  'מייל': 'email',
  'email': 'email',
  'כתובת דוא"ל': 'email',                 // Ministry file variant
  // Teaching hours columns (Ministry file)
  'הוראה': 'teachingHours',               // Ministry file uses short name (SUMIF formula)
  'שעות הוראה': 'teachingHours',
  'ליווי פסנתר': 'accompHours',
  'הרכב ביצוע': 'ensembleHours',
  'להרכב ביצוע': 'ensembleHours',         // Multi-row header composite with "ל" prefix
  'ריכוז הרכב': 'ensembleCoordHours',
  'תאוריה': 'theoryHours',
  'תיאוריה': 'theoryHours',   // Ministry spelling variant (with yod)
  'ניהול': 'managementHours',
  'ריכוז': 'coordinationHours',
  'ביטול זמן': 'breakTimeHours',
  'סה"כ ש"ש': 'totalWeeklyHours',
  "סה''כ ש''ש": 'totalWeeklyHours',
  // Short header fragments from Ministry multi-row merged headers (row 11 bottom fragments)
  'שבועיות': 'totalWeeklyHours',         // Fragment of "סה"כ שעות שבועיות" — total weekly hours
  'זמן': 'breakTimeHours',              // Fragment of "ביטול זמן"
  'שעות': 'totalWeeklyHours',           // Fragment of "סה"כ ש"ש" — but note: "שעות" is generic, only use when no better match
  // Management role (multiple header variants across Ministry file layouts)
  'תיאור תפקיד': 'managementRole',
  'תפקיד': 'managementRole',
  'תפקיד ניהולי': 'managementRole',
  'תפקיד ניהול': 'managementRole',
  // Additional teaching certificate header variant
  'תעודה': 'teachingCertificate',
  // Additional hours column variants (Ministry composite headers)
  'ש"ש הוראה': 'teachingHours',
  "ש''ש הוראה": 'teachingHours',
  'שעות ניהול': 'managementHours',
  'שעות ריכוז': 'coordinationHours',
  'שעות תאוריה': 'theoryHours',
  'שעות ליווי': 'accompHours',
  // Full name for teachers (Ministry uses combined name column sometimes)
  'שם ומשפחה': 'fullName',
  'שם המורה': 'fullName',
  'המורה': 'fullName',
  'שם הורה': 'fullName',
  'שם מלא': 'fullName',
  'שם': 'fullName',
};

const STUDENT_COLUMN_MAP = {
  'שם משפחה': 'lastName',
  'משפחה': 'lastName',
  'שם פרטי': 'firstName',
  'פרטי': 'firstName',
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

const TRUTHY_VALUES = ['✓', 'V', 'v', 'x', 'X', '1', 'כן', true, 1, 'true', 'TRUE', 'True'];

/**
 * Check if a cell has a non-white/non-transparent fill color.
 * Ministry Excel files mark selected instruments/roles with colored cell backgrounds.
 * @param {object} fill - exceljs cell.fill object
 * @returns {boolean} true if cell has a visible color fill
 */
function isColoredCell(fill) {
  if (!fill) return false;
  if (fill.type === 'gradient') return true;
  if (fill.type !== 'pattern') return false;
  if (fill.pattern === 'none') return false;
  const fg = fill.fgColor;
  if (!fg) return false;
  // Theme-based color (common in some Ministry files)
  if (fg.theme !== undefined && fg.theme !== null) {
    if (fg.theme === 0 && !fg.tint) return false; // theme 0 without tint = white
    return true;
  }
  // Indexed color (legacy Excel format)
  if (fg.indexed !== undefined && fg.indexed !== null) {
    // indexed 9 = white, 64 = automatic — not real colors
    if (fg.indexed === 9 || fg.indexed === 64) return false;
    return true;
  }
  // Explicit ARGB
  const argb = fg.argb?.toUpperCase();
  if (!argb) return false;
  const NO_COLOR = ['FFFFFFFF', '00FFFFFF', 'FFFFFF', '00000000'];
  return !NO_COLOR.includes(argb);
}

// Role column names (Ministry boolean column names → TEACHER_ROLES)
// Note: 'הוראה' is NOT a role column — it's a numeric teaching-hours SUMIF column in Ministry files
const ROLE_COLUMN_NAMES = {
  'ניצוח': 'ניצוח',
  'הרכב': 'מדריך הרכב',
  'תאוריה': 'תאוריה',
  'תיאוריה': 'תאוריה',   // Ministry spelling variant (with yod)
  'מגמה': 'מגמה',
  'ליווי פסנתר': 'ליווי פסנתר',
  'הלחנה': 'הלחנה',
  'ניהול': 'מנהל',
};

// Hours field names that share header text with role boolean columns.
// When mapColumns encounters these fields at a high column index (role section),
// the value is a boolean, not a number — skip it to prevent overwriting the real hours value.
const HOURS_FIELDS_WITH_ROLE_COLLISION = new Set([
  'accompHours',     // "ליווי פסנתר" appears at both C15 (hours) and C57 (role)
  'theoryHours',     // "תאוריה"/"תיאוריה" appears at both C18 (hours) and C59 (role)
]);

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
      const trimmed = header.trim().replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
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

async function parseExcelBufferWithHeaderDetection(buffer, columnMap) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetNames = workbook.worksheets.map(ws => ws.name);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('הקובץ לא מכיל גליונות');

  // Read all rows as arrays of cell objects (preserving styles)
  const allCellRows = [];   // Array of arrays of exceljs Cell objects
  const allTextRows = [];   // Array of arrays of text values (for header detection)

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cellRow = [];
    const textRow = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Pad to correct column position (cells may be sparse)
      while (cellRow.length < colNumber - 1) {
        cellRow.push(null);
        textRow.push('');
      }
      cellRow.push(cell);
      const val = cell.value;
      // Resolve exceljs cell values to plain text:
      // - Formula objects: { result: <value>, formula/sharedFormula: "..." }
      // - Rich text: { richText: [{ text: "..." }, ...] }
      // - Date objects: extract ISO string
      // - Booleans/numbers/strings: direct conversion
      let textVal;
      if (val == null) {
        textVal = '';
      } else if (typeof val === 'object' && val.richText) {
        textVal = val.richText.map(r => (r?.text ?? '')).join('');
      } else if (typeof val === 'object' && ('formula' in val || 'sharedFormula' in val)) {
        // Formula cell — use the computed result
        const result = val.result;
        if (result == null) textVal = '';
        else if (typeof result === 'object' && result.richText) textVal = result.richText.map(r => (r?.text ?? '')).join('');
        else textVal = String(result);
      } else if (val instanceof Date) {
        textVal = val.toISOString().slice(0, 10);
      } else {
        textVal = String(val);
      }
      textRow.push(textVal.trim());
    });
    allCellRows.push(cellRow);
    allTextRows.push(textRow);
  });

  // Build potential header rows for scoring (same approach as before)
  const maxScan = Math.min(10, allTextRows.length);
  const potentialHeaderRows = allTextRows.slice(0, maxScan).map(textRow => {
    const obj = {};
    for (const cellText of textRow) {
      if (cellText !== '') {
        const cleaned = cellText.replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
        if (cleaned) obj[cleaned] = true;
      }
    }
    return obj;
  });

  const { headerRowIndex, matchedColumns } = detectHeaderRow(potentialHeaderRows, columnMap);

  // Build header names from the detected header row
  const headerTextRow = allTextRows[headerRowIndex] || [];
  const headers = headerTextRow.map(h => h.replace(/[\u200F\u200E\uFEFF\u200B]/g, ''));

  // Backfill empty headers from parent rows above (Ministry files have multi-row merged headers
  // where some columns only have labels in parent category rows, e.g. "סיווג", "תואר", "חבר/ה")
  // Strategy: prefer a parent value that matches the columnMap (known mapping), otherwise skip.
  // This avoids picking up random category labels or sub-headings.
  const usedHeaders = new Set(headers.filter(h => h));
  for (let c = 0; c < headers.length; c++) {
    if (headers[c]) continue; // already has a header
    // Collect all candidate values from parent rows
    const candidates = [];
    for (let r = headerRowIndex - 1; r >= 0; r--) {
      const parentRow = allTextRows[r];
      if (parentRow && parentRow[c]) {
        const parentText = parentRow[c].replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
        if (parentText && !usedHeaders.has(parentText)) {
          candidates.push(parentText);
        }
      }
    }
    // Prefer a candidate that maps to a known column; fall back to first candidate
    const known = candidates.find(t => columnMap[t]);
    const pick = known || candidates[0] || null;
    if (pick) {
      headers[c] = pick;
      usedHeaders.add(pick);
    }
  }

  // Second pass (instrument-specific): Scan parent rows for instrument abbreviations.
  // Ministry files often have instrument abbreviations (Vi, FL, PI, etc.) in a parent row
  // while the bottom header row has a different value. If the header at column c does NOT
  // already map to a known column in TEACHER_COLUMN_MAP, replace it with the parent-row
  // instrument abbreviation. This ensures instruments are detected even with multi-row headers.
  for (let c = 0; c < headers.length; c++) {
    // Skip if this header already maps to a known field (e.g., hours, name, etc.)
    if (headers[c] && columnMap[headers[c]]) continue;
    // Scan parent rows for instrument abbreviations/department names
    for (let r = headerRowIndex - 1; r >= 0; r--) {
      const parentRow = allTextRows[r];
      if (parentRow && parentRow[c]) {
        const parentText = parentRow[c].replace(/[\u200F\u200E\uFEFF\u200B]/g, '').trim();
        if (parentText && (ABBREVIATION_TO_INSTRUMENT[parentText] || DEPARTMENT_TO_INSTRUMENTS[parentText])) {
          headers[c] = parentText;
          break;
        }
      }
    }
  }

  // Third pass: Composite header construction and disambiguation for duplicates
  // (a) Resolving duplicate headers using parent row disambiguation
  // (b) Constructing known composite headers for short fragments

  // Disambiguation map: when bottom-row header is ambiguous, use parent row keywords to pick the correct full header
  const DISAMBIGUATION_MAP = {
    'ביצוע': [
      { keyword: 'בפועל', fullHeader: 'הרכב ביצוע' },      // C16: ensemble performance hours
      { keyword: 'ריכוז', fullHeader: 'ריכוז הרכב' },       // C17: ensemble coordination hours
    ],
  };

  // Detect duplicate headers
  const headerCounts = {};
  for (const h of headers) {
    if (h) headerCounts[h] = (headerCounts[h] || 0) + 1;
  }

  // Resolve duplicates using parent row context
  for (let c = 0; c < headers.length; c++) {
    const header = headers[c];
    if (!header || !headerCounts[header] || headerCounts[header] <= 1) continue;

    const rules = DISAMBIGUATION_MAP[header];
    if (!rules) continue;

    // Collect parent row text for this column
    const parentTexts = [];
    for (let r = headerRowIndex - 1; r >= Math.max(0, headerRowIndex - 5); r--) {
      const parentRow = allTextRows[r];
      if (parentRow && parentRow[c]) {
        const text = parentRow[c].replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
        if (text) parentTexts.push(text);
      }
    }

    // Find matching disambiguation rule
    for (const rule of rules) {
      if (parentTexts.some(t => t.includes(rule.keyword))) {
        headers[c] = rule.fullHeader;
        break;
      }
    }
  }

  // Also construct composite headers for known short fragments that need parent context
  // "פסנתר" at C15 should become "ליווי פסנתר" (accomp hours) — check parent row for "ליווי"
  for (let c = 0; c < headers.length; c++) {
    const header = headers[c];
    if (header === 'פסנתר') {
      // Check if parent row has "ליווי" — if so, this is the accomp hours column, not piano instrument
      for (let r = headerRowIndex - 1; r >= Math.max(0, headerRowIndex - 3); r--) {
        const parentRow = allTextRows[r];
        if (parentRow && parentRow[c]) {
          const text = parentRow[c].replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
          if (text === 'ליווי') {
            headers[c] = 'ליווי פסנתר';
            break;
          }
        }
      }
    }
  }

  // --- Sub-header detection and refinement ---
  // Ministry files often have multi-row headers with 2+ rows of sub-headers:
  //   Row N:   parent categories (e.g., "פרטי משפחה", "הוראה", ...)
  //   Row N+1: sub-categories (e.g., "פרטי", "משפחה", "כן-לא", ...)
  //   Row N+2: more sub-labels (e.g., "מס' שנים", ...)
  // Loop through consecutive rows after the header, refining column names each time.
  let dataStartRow = headerRowIndex + 1;

  // Known sub-header keywords that are NOT real teacher data
  const SUB_HEADER_KEYWORDS = new Set([
    'כן-לא', 'כן / לא', 'מס\' שנים', 'שנים', 'פרטי', 'משפחה',
    'פרטי משפחה', 'נייד', 'דוא"ל', 'כתובת', 'הוראה', 'ביצוע',
    'תיאוריה', 'ריכוז', 'ביטול זמן', 'שבועיות', 'סה"כ',
  ]);

  for (let subRowIdx = headerRowIndex + 1; subRowIdx < allTextRows.length; subRowIdx++) {
    const nextRow = allTextRows[subRowIdx];
    if (!nextRow) break;

    let subMatches = 0;
    let subKeywordMatches = 0;
    let subNonEmpty = 0;
    for (const text of nextRow) {
      if (text && text.trim()) {
        subNonEmpty++;
        const cleaned = text.trim().replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
        if (columnMap[cleaned]) subMatches++;
        if (SUB_HEADER_KEYWORDS.has(cleaned)) subKeywordMatches++;
      }
    }

    // Row is a sub-header if it has known column map matches OR known sub-header keywords
    const totalHeaderLike = subMatches + subKeywordMatches;
    const isSubHeader = subNonEmpty > 3 && (totalHeaderLike / subNonEmpty > 0.25);
    if (!isSubHeader) break; // First non-sub-header row = data starts here

    // Refine headers using sub-header values (more specific than parent category)
    for (let c = 0; c < headers.length; c++) {
      const subText = (nextRow[c] || '').trim().replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
      if (!subText) continue;

      // Disambiguate generic "כן-לא" / "כן / לא" boolean labels using parent-row context.
      // Ministry files use this label for BOTH teaching certificate and union membership columns.
      // Check parent rows to determine which boolean field this column represents.
      if (subText === 'כן-לא' || subText === 'כן / לא') {
        for (let r = headerRowIndex - 1; r >= Math.max(0, headerRowIndex - 3); r--) {
          const parentRow = allTextRows[r];
          if (parentRow?.[c]) {
            const parentText = parentRow[c].replace(/[\u200F\u200E\uFEFF\u200B]/g, '').trim();
            if (parentText.includes('תעודת הוראה') || parentText.includes('תעודה')) {
              headers[c] = 'תעודת הוראה';
              break;
            } else if (parentText.includes('ארגון') || parentText.includes('חבר')) {
              headers[c] = 'חבר ארגון';
              break;
            }
          }
        }
        continue; // Skip the generic columnMap lookup for "כן-לא"
      }

      // Direct match: sub-header value is a known column name
      // Guard: only replace if current header does NOT already map to a valid field.
      // This prevents overwriting correct headers like "סיווג" or "תואר" with
      // generic sub-header fragments.
      if (columnMap[subText]) {
        if (!columnMap[headers[c]]) {
          headers[c] = subText;
        }
        continue;
      }

      // Composite: parent + " " + sub (e.g., "ליווי" + "פסנתר" = "ליווי פסנתר")
      if (headers[c]) {
        const composite = `${headers[c]} ${subText}`;
        if (columnMap[composite]) {
          headers[c] = composite;
          continue;
        }
        // Reversed composite
        const reversed = `${subText} ${headers[c]}`;
        if (columnMap[reversed]) {
          headers[c] = reversed;
          continue;
        }
        // Try stripping Hebrew "ל" prefix from parent (e.g., "להרכב" → "הרכב")
        if (headers[c].startsWith('ל') && headers[c].length > 2) {
          const stripped = headers[c].slice(1);
          const strippedComposite = `${stripped} ${subText}`;
          if (columnMap[strippedComposite]) {
            headers[c] = strippedComposite;
            continue;
          }
        }
      }
    }

    dataStartRow = subRowIdx + 1; // skip this sub-header row
  }

  // Build data rows as objects (keyed by header name) starting after header + sub-header rows
  // ALSO build parallel array of cell-row arrays for style access
  const rows = [];
  const cellRows = [];   // parallel array — cellRows[i] corresponds to rows[i]

  for (let i = dataStartRow; i < allTextRows.length; i++) {
    const textRow = allTextRows[i];
    const cellRow = allCellRows[i];
    const obj = {};
    let hasData = false;

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      const val = textRow[c] ?? '';
      obj[header] = val;
      if (val !== '') hasData = true;
    }

    if (hasData) {
      rows.push(obj);
      cellRows.push(cellRow);
    }
  }

  // Store headers-to-column-index mapping for cell style access
  const headerColMap = {};
  for (let c = 0; c < headers.length; c++) {
    if (headers[c]) headerColMap[headers[c]] = c;
  }

  return { rows, cellRows, headerColMap, headerRowIndex: dataStartRow - 1, matchedColumns, sheetNames, headers };
}

function mapColumns(row, columnMap, headerColMap) {
  const mapped = {};
  for (const [header, value] of Object.entries(row)) {
    const trimmedHeader = header.trim().replace(/[\u200F\u200E\uFEFF\u200B]/g, '');
    const mappedKey = columnMap[trimmedHeader];
    if (mappedKey) {
      // Prevent role boolean columns (high index) from overwriting hours fields
      if (HOURS_FIELDS_WITH_ROLE_COLLISION.has(mappedKey) && headerColMap) {
        const colIndex = headerColMap[trimmedHeader];
        if (colIndex !== undefined && colIndex > 24) {
          continue; // This is a role column, not an hours column — skip
        }
      }
      mapped[mappedKey] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return mapped;
}

// Headers that map to hours/data fields but share names with instruments or departments.
// These must NOT be treated as instrument columns when they appear before the instrument section.
const KNOWN_NON_INSTRUMENT_HEADERS = new Set([
  'הוראה', 'ליווי פסנתר', 'הרכב ביצוע', 'להרכב ביצוע', 'ריכוז הרכב',
  'תאוריה', 'תיאוריה', 'ניהול', 'ריכוז', 'ביטול זמן',
  'סה"כ ש"ש', "סה''כ ש''ש", 'שבועיות', 'זמן', 'שעות',
]);

function detectInstrumentColumns(headers, headerColMap) {
  const instrumentColumns = [];

  // First pass: find the EARLIEST column index where a header matches an instrument
  // abbreviation or department name. This replaces the hardcoded colIndex < 24 threshold.
  let instrumentSectionStart = Infinity;
  for (const header of headers) {
    const trimmed = header.trim();
    if (KNOWN_NON_INSTRUMENT_HEADERS.has(trimmed)) continue; // Skip hours headers
    if (ABBREVIATION_TO_INSTRUMENT[trimmed] || DEPARTMENT_TO_INSTRUMENTS[trimmed]) {
      const colIndex = headerColMap?.[trimmed];
      if (colIndex !== undefined && colIndex < instrumentSectionStart) {
        instrumentSectionStart = colIndex;
      }
    }
  }

  // If no instruments found at all, return empty
  if (instrumentSectionStart === Infinity) return instrumentColumns;

  // Second pass: collect all instrument columns at or after instrumentSectionStart.
  // Skip known hours/data headers that appear BEFORE the instrument section.
  for (const header of headers) {
    const trimmed = header.trim();
    const colIndex = headerColMap?.[trimmed];

    // If a header is in KNOWN_NON_INSTRUMENT_HEADERS and appears BEFORE the instrument
    // section, it's a hours/data column, not an instrument. If it appears AT or AFTER
    // the section start, it could be a role column — still skip for instrument detection.
    if (KNOWN_NON_INSTRUMENT_HEADERS.has(trimmed)) continue;

    // Only consider columns at or after the instrument section start
    if (colIndex !== undefined && colIndex < instrumentSectionStart) continue;

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

function readInstrumentMatrix(row, instrumentColumns, cellRow, headerColMap) {
  const instruments = [];
  let departmentHint = null;

  for (const col of instrumentColumns) {
    const colIndex = headerColMap[col.header];
    const cell = colIndex !== undefined ? cellRow?.[colIndex] : null;
    const textValue = row[col.header];

    // Detection: cell fill color first, text fallback second
    const isSelected = (cell && isColoredCell(cell.fill)) ||
                       (textValue && TRUTHY_VALUES.includes(textValue));

    if (isSelected) {
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

// Detect role boolean columns in headers
function detectRoleColumns(headers) {
  const roleColumns = [];
  for (const header of headers) {
    const trimmed = header.trim();
    if (ROLE_COLUMN_NAMES[trimmed]) {
      roleColumns.push({ header: trimmed, role: ROLE_COLUMN_NAMES[trimmed] });
    }
  }
  return roleColumns;
}

// Read role matrix from a row
function readRoleMatrix(row, roleColumns, cellRow, headerColMap) {
  const roles = [];
  for (const col of roleColumns) {
    const colIndex = headerColMap[col.header];
    const cell = colIndex !== undefined ? cellRow?.[colIndex] : null;
    const textValue = row[col.header];

    const isSelected = (cell && isColoredCell(cell.fill)) ||
                       (textValue && TRUTHY_VALUES.includes(textValue));

    if (isSelected) {
      roles.push(col.role);
    }
  }
  return roles;
}

// Parse teaching hours from mapped data
function parseTeachingHours(mapped) {
  const hours = {};
  const hourFields = [
    'teachingHours', 'accompHours', 'ensembleHours', 'ensembleCoordHours',
    'theoryHours', 'managementHours', 'coordinationHours', 'breakTimeHours', 'totalWeeklyHours',
  ];
  for (const field of hourFields) {
    if (mapped[field] !== undefined && mapped[field] !== '' && mapped[field] !== null) {
      const val = parseFloat(mapped[field]);
      if (!isNaN(val)) {
        hours[field] = val;
      }
    }
  }
  return hours;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateTeacherRow(mapped, rowIndex) {
  const errors = [];
  const warnings = [];

  // Handle fullName split if firstName/lastName not provided
  if (!mapped.firstName && !mapped.lastName && mapped.fullName) {
    const parts = mapped.fullName.trim().split(/\s+/);
    mapped.firstName = parts[0] || '';
    mapped.lastName = parts.slice(1).join(' ') || '';
  }

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

  if (mapped.managementRole && !MANAGEMENT_ROLES.includes(mapped.managementRole)) {
    warnings.push({ row: rowIndex, field: 'managementRole', message: `תפקיד ניהולי לא מוכר: ${mapped.managementRole}` });
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

function calculateTeacherChanges(teacher, mapped, instruments, roles = [], teachingHours = {}) {
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

  // Teaching hours changes
  if (Object.keys(teachingHours || {}).length > 0) {
    for (const [field, value] of Object.entries(teachingHours)) {
      const path = `managementInfo.${field}`;
      const current = getNestedValue(teacher, path);
      if (current !== value) {
        changes.push({ field: path, oldValue: current ?? null, newValue: value });
      }
    }
  }

  // Role changes (if Ministry file has role columns)
  if (roles && roles.length > 0) {
    const currentRoles = teacher.roles || [];
    const sortedCurrent = [...currentRoles].sort();
    const sortedNew = [...roles].sort();
    if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedNew)) {
      changes.push({ field: 'roles', oldValue: currentRoles, newValue: roles });
    }
  }

  // Management role
  if (mapped.managementRole) {
    const current = getNestedValue(teacher, 'managementInfo.role');
    if (current !== mapped.managementRole) {
      changes.push({ field: 'managementInfo.role', oldValue: current ?? null, newValue: mapped.managementRole });
    }
  }

  return changes;
}

// ─── Import Normalization & Document Building ────────────────────────────────

/**
 * Normalize mapped teacher data to ensure ALL expected fields are explicitly present.
 * Prevents MongoDB from stripping undefined keys when storing in import_log.
 */
function normalizeTeacherMapped(mapped, instruments, roles, teachingHours) {
  return {
    firstName: mapped.firstName || '',
    lastName: mapped.lastName || '',
    email: mapped.email || null,
    phone: mapped.phone || null,
    address: null, // Ministry Excel never has address
    idNumber: mapped.idNumber || null,
    birthYear: typeof mapped.birthYear === 'number' ? mapped.birthYear : null,
    classification: mapped.classification || null,
    degree: mapped.degree || null,
    experience: typeof mapped.experience === 'number' ? mapped.experience : null,
    teachingCertificate: typeof mapped.teachingCertificate === 'boolean' ? mapped.teachingCertificate : null,
    isUnionMember: typeof mapped.isUnionMember === 'boolean' ? mapped.isUnionMember : null,
    managementRole: mapped.managementRole || null,
    instruments: Array.isArray(instruments) ? instruments : [],
    roles: Array.isArray(roles) && roles.length > 0 ? roles : ['מורה'],
    teachingHours: teachingHours || {},
  };
}

/**
 * Build a teacher document that exactly matches the canonical shape produced by addTeacher + Joi defaults.
 * This ensures import-created teachers are indistinguishable from UI-created teachers.
 */
function buildImportTeacherDocument(data, tenantId, hashedPassword, adminId) {
  return {
    tenantId,
    personalInfo: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      idNumber: data.idNumber,
      birthYear: data.birthYear,
    },
    roles: data.roles,
    professionalInfo: {
      instrument: data.instruments[0] || null,
      instruments: data.instruments,
      isActive: true,
      classification: data.classification,
      degree: data.degree,
      hasTeachingCertificate: data.teachingCertificate,
      teachingExperienceYears: data.experience,
      isUnionMember: data.isUnionMember,
      teachingSubjects: [],
    },
    managementInfo: {
      role: data.managementRole,
      managementHours: data.teachingHours?.managementHours ?? null,
      accompHours: data.teachingHours?.accompHours ?? null,
      ensembleCoordHours: data.teachingHours?.ensembleCoordHours ?? null,
      travelTimeHours: null,
      teachingHours: data.teachingHours?.teachingHours ?? null,
      ensembleHours: data.teachingHours?.ensembleHours ?? null,
      theoryHours: data.teachingHours?.theoryHours ?? null,
      coordinationHours: data.teachingHours?.coordinationHours ?? null,
      breakTimeHours: data.teachingHours?.breakTimeHours ?? null,
      totalWeeklyHours: data.teachingHours?.totalWeeklyHours ?? null,
    },
    teaching: { timeBlocks: [] },
    conducting: { orchestraIds: [] },
    ensemblesIds: [],
    schoolYears: [],
    credentials: {
      email: data.email || `import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@temp.local`,
      password: hashedPassword,
      isInvitationAccepted: true,
      requiresPasswordChange: true,
      passwordSetAt: new Date(),
      invitedAt: new Date(),
      invitedBy: adminId?.toString() || null,
      invitationMode: 'IMPORT',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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

  const { rows, cellRows, headerColMap, headerRowIndex, matchedColumns, headers: parsedHeaders } = await parseExcelBufferWithHeaderDetection(buffer, TEACHER_COLUMN_MAP);
  if (rows.length === 0) throw new Error('הקובץ ריק או לא מכיל נתונים');

  const instrumentColumns = detectInstrumentColumns(parsedHeaders, headerColMap);
  const roleColumns = detectRoleColumns(parsedHeaders);

  // Build diagnostic headerMappingReport for debugging unmapped columns
  const headerMappingReport = {
    detectedHeaders: parsedHeaders,
    mappedFields: {},
    unmappedHeaders: [],
    instrumentColumnsDetected: instrumentColumns.map(c => c.type === 'specific' ? c.instrument : c.header),
    roleColumnsDetected: roleColumns.map(c => c.role),
  };
  for (const header of parsedHeaders) {
    if (!header) continue;
    if (TEACHER_COLUMN_MAP[header]) {
      headerMappingReport.mappedFields[header] = TEACHER_COLUMN_MAP[header];
    } else if (!ABBREVIATION_TO_INSTRUMENT[header] && !DEPARTMENT_TO_INSTRUMENTS[header] && !ROLE_COLUMN_NAMES[header]) {
      headerMappingReport.unmappedHeaders.push(header);
    }
  }

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
    roleColumnsDetected: roleColumns.map(c => c.role),
    headerMappingReport,
    headerRowIndex,
    matchedColumns,
  };

  // Known header keywords that should never appear as teacher names
  const HEADER_NAME_KEYWORDS = new Set([
    'פרטי', 'משפחה', 'פרטי משפחה', 'שם', 'שם פרטי', 'שם משפחה',
    'הוראה', 'ביצוע', 'תיאוריה', 'ריכוז', 'מורה', 'מנהל',
    'סה"כ', 'שבועיות', 'ביטול זמן', 'כן-לא', 'כן / לא',
  ]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapColumns(row, TEACHER_COLUMN_MAP, headerColMap);

    // Safety: skip rows where firstName/lastName match known header keywords (leaked sub-headers)
    const fn = (mapped.firstName || '').trim();
    const ln = (mapped.lastName || '').trim();
    if (HEADER_NAME_KEYWORDS.has(fn) || HEADER_NAME_KEYWORDS.has(ln) ||
        HEADER_NAME_KEYWORDS.has(`${fn} ${ln}`)) {
      continue;
    }

    const { instruments, departmentHint } = readInstrumentMatrix(row, instrumentColumns, cellRows[i], headerColMap);
    const roles = readRoleMatrix(row, roleColumns, cellRows[i], headerColMap);
    const teachingHours = parseTeachingHours(mapped);
    const excelRow = headerRowIndex + 2 + i; // +2: 1-indexed + data starts after header
    const { errors, warnings } = validateTeacherRow(mapped, excelRow);

    if (errors.length > 0) {
      preview.errors.push(...errors);
      continue;
    }
    preview.warnings.push(...warnings);

    const match = matchTeacher(mapped, teachers);
    if (match) {
      const changes = calculateTeacherChanges(match.teacher, mapped, instruments, roles, teachingHours);
      preview.matched.push({
        row: excelRow,
        matchType: match.matchType,
        teacherId: match.teacher._id.toString(),
        teacherName: `${match.teacher.personalInfo?.firstName || ''} ${match.teacher.personalInfo?.lastName || ''}`.trim(),
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        changes,
        instruments,
        roles,
        teachingHours,
        mapped,
      });
    } else {
      preview.notFound.push({
        row: excelRow,
        importedName: `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim(),
        mapped,
        instruments,
        roles,
        teachingHours,
        normalized: normalizeTeacherMapped(mapped, instruments, roles, teachingHours),
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

  const { rows, cellRows, headerColMap, headerRowIndex, matchedColumns } = await parseExcelBufferWithHeaderDetection(buffer, STUDENT_COLUMN_MAP);
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

    const { instruments, departmentHint } = readInstrumentMatrix(row, instrumentColumns, cellRows[i], headerColMap);
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
      return await executeTeacherImport(log, importLogCollection, tenantId, userId);
    } else if (log.importType === 'students') {
      return await executeStudentImport(log, importLogCollection, tenantId, userId);
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

async function executeTeacherImport(log, importLogCollection, tenantId, adminId) {
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

  // --- Create new teachers from unmatched rows ---
  const notFound = log.preview.notFound || [];
  let createdCount = 0;

  for (const entry of notFound) {
    const { mapped, instruments = [], roles = [], teachingHours = {} } = entry;

    // Validation gate: teachers require BOTH firstName AND lastName (stricter than students)
    if (!mapped?.firstName || !mapped?.lastName) {
      errorCount++;
      errors.push({
        row: entry.row,
        teacherName: entry.importedName || '(ללא שם)',
        error: 'חסר שם פרטי ושם משפחה - לא ניתן ליצור מורה',
      });
      continue;
    }

    try {
      // Hash default password
      const hashedPassword = await authService.encryptPassword(DEFAULT_PASSWORD);

      // Normalize and build teacher document using shared functions
      const normalized = entry.normalized || normalizeTeacherMapped(mapped, instruments, roles, teachingHours);
      const rawDoc = buildImportTeacherDocument(normalized, tenantId, hashedPassword, adminId);

      // Validate through import schema to get Joi defaults and catch malformed data
      const { error: validationError, value: newTeacher } = validateTeacherImport(rawDoc);
      if (validationError) {
        errorCount++;
        errors.push({ row: entry.row, teacherName: entry.importedName, error: `Validation: ${validationError.message}` });
        continue;
      }

      const result = await teacherCollection.insertOne(newTeacher);
      createdCount++;
      affectedDocIds.push(result.insertedId.toString());
    } catch (err) {
      errorCount++;
      errors.push({ row: entry.row, teacherName: entry.importedName, error: err.message });
    }
  }

  const results = {
    totalRows: log.preview.totalRows,
    matchedCount: matched.length,
    successCount,
    createdCount,            // NOW: actual count of created teachers
    errorCount,
    skippedCount: matched.filter((e) => e.changes.length === 0).length,
    notFoundCount: notFound.length,
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

async function executeStudentImport(log, importLogCollection, tenantId, adminId) {
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

// ─── Repair Utility ──────────────────────────────────────────────────────────

/**
 * Repair already-imported teachers that have missing/null properties due to the
 * pre-fix import code path. Ensures all expected nested objects and fields exist
 * with proper defaults matching the canonical teacher schema.
 */
async function repairImportedTeachers(options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const adminId = options.adminId || null;
  const collection = await getCollection('teacher');

  // Find teachers created via import
  const importedTeachers = await collection.find({
    tenantId,
    'credentials.invitationMode': 'IMPORT',
  }).toArray();

  let repairedCount = 0;
  const repairDetails = [];

  for (const teacher of importedTeachers) {
    const updates = {};

    // Fix missing credentials.invitedBy
    if (!teacher.credentials?.invitedBy && adminId) {
      updates['credentials.invitedBy'] = adminId;
    }

    // Ensure all expected nested objects exist with proper defaults
    if (!teacher.managementInfo) {
      updates.managementInfo = {
        role: null, managementHours: null, accompHours: null,
        ensembleCoordHours: null, travelTimeHours: null,
        teachingHours: null, ensembleHours: null, theoryHours: null,
        coordinationHours: null, breakTimeHours: null, totalWeeklyHours: null,
      };
    } else {
      // Ensure all managementInfo sub-fields exist
      const mgmt = teacher.managementInfo;
      const mgmtFields = ['role', 'managementHours', 'accompHours', 'ensembleCoordHours',
        'travelTimeHours', 'teachingHours', 'ensembleHours', 'theoryHours',
        'coordinationHours', 'breakTimeHours', 'totalWeeklyHours'];
      for (const field of mgmtFields) {
        if (!(field in mgmt)) {
          updates[`managementInfo.${field}`] = null;
        }
      }
    }

    if (!teacher.conducting) {
      updates.conducting = { orchestraIds: [] };
    } else if (!teacher.conducting.orchestraIds) {
      updates['conducting.orchestraIds'] = [];
    }

    if (!teacher.ensemblesIds) {
      updates.ensemblesIds = [];
    }

    if (!teacher.schoolYears) {
      updates.schoolYears = [];
    }

    // Ensure professionalInfo has all expected fields
    if (teacher.professionalInfo) {
      const prof = teacher.professionalInfo;
      if (!Array.isArray(prof.instruments)) {
        updates['professionalInfo.instruments'] = prof.instrument ? [prof.instrument] : [];
      }
      if (!Array.isArray(prof.teachingSubjects)) {
        updates['professionalInfo.teachingSubjects'] = [];
      }
      if (!('isActive' in prof)) {
        updates['professionalInfo.isActive'] = true;
      }
    }

    // Ensure personalInfo has all expected fields
    if (teacher.personalInfo) {
      const pi = teacher.personalInfo;
      if (!('address' in pi)) updates['personalInfo.address'] = null;
      if (!('idNumber' in pi)) updates['personalInfo.idNumber'] = null;
      if (!('birthYear' in pi)) updates['personalInfo.birthYear'] = null;
      if (!('phone' in pi)) updates['personalInfo.phone'] = null;
      if (!('email' in pi)) updates['personalInfo.email'] = null;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await collection.updateOne(
        { _id: teacher._id, tenantId },
        { $set: updates }
      );
      repairedCount++;
      repairDetails.push({
        teacherId: teacher._id.toString(),
        teacherName: `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim(),
        fieldsRepaired: Object.keys(updates).filter(k => k !== 'updatedAt'),
      });
    }
  }

  return {
    totalImported: importedTeachers.length,
    repairedCount,
    repairDetails,
  };
}
