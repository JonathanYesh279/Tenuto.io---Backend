/**
 * Sheet 3: Teachers (מצבת כח-אדם בהוראה)
 *
 * Up to 6784 teacher data rows. Data starts at row 12.
 * Multi-row headers span rows 7-11.
 * 81 columns: personal (B-M), hours (N-V), name+index (W-X),
 * instrument booleans (Y-AM), teaching subjects (AN-AS+).
 */

import {
  SHEET_NAMES,
  STYLES,
  COLORS,
  createRTLSheet,
  setMergedValue,
  applyStyle,
  applyLayout,
} from './_shared.js';

// Instrument columns in Ministry order (Y through AM = cols 25-39)
const INSTRUMENT_COLS = [
  { col: 25, abbrev: 'Vi', label: 'כינור' },
  { col: 26, abbrev: 'VL', label: 'ויולה' },
  { col: 27, abbrev: 'CH', label: "צ'לו" },
  { col: 28, abbrev: 'CB', label: 'קונטרבס' },
  { col: 29, abbrev: 'FL', label: 'חליל צד' },
  { col: 30, abbrev: 'OB', label: 'אבוב' },
  { col: 31, abbrev: 'CL', label: 'קלרינט' },
  { col: 32, abbrev: 'BS', label: 'בסון' },
  { col: 33, abbrev: 'SX', label: 'סקסופון' },
  { col: 34, abbrev: 'HR', label: 'קרן' },
  { col: 35, abbrev: 'TR', label: 'חצוצרה' },
  { col: 36, abbrev: 'TB', label: 'טרומבון' },
  { col: 37, abbrev: 'BR', label: 'בריטון' },
  { col: 38, abbrev: 'TU', label: 'טובה' },
  { col: 39, abbrev: 'PI', label: 'פסנתר' },
];

export function buildTeachersSheet({ workbook, mappedData, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.TEACHERS);
  const rows = mappedData.teacherRoster;
  const tenant = data.tenant || {};

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 8, 'C': 14, 'D': 12, 'E': 12, 'F': 10,
    'G': 10, 'H': 12, 'I': 10, 'J': 8, 'K': 10,
    'L': 14, 'M': 18,
    'N': 10, 'O': 10, 'P': 10, 'Q': 10, 'R': 10,
    'S': 14, 'T': 10, 'U': 10, 'V': 10,
    'W': 18, 'X': 8,
  });

  // Set instrument column widths
  for (const ic of INSTRUMENT_COLS) {
    sheet.getColumn(ic.col).width = 6;
  }

  // ─── Meta Rows 1-3 ──────────────────────────────────────────────────────
  const consName = metadata.conservatoryName || tenant.name || '';
  const consCode = tenant.conservatoryProfile?.code || tenant.ministryInfo?.institutionCode || '';

  sheet.getCell('B1').value = `מצבת כח-אדם להוראה בקונסרבטוריון : ${consName}`;
  applyStyle(sheet.getCell('B1'), { font: { bold: true, size: 14, color: { argb: COLORS.BLACK } } });

  sheet.getCell('A2').value = consCode;
  sheet.getCell('A3').value = rows.length;
  sheet.getCell('B3').value = 'סה"כ מורים';

  // ─── Multi-row Headers (rows 7-11) ──────────────────────────────────────

  // Row 7-8: Section group headers
  setMergedValue(sheet, 'B7:M8', 'פרטים אישיים', {
    font: { bold: true, size: 12, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'N7:V8', 'שעות שבועיות', {
    font: { bold: true, size: 12, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'Y7:AM8', 'כלי נגינה', {
    font: { bold: true, size: 12, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // Row 9-10: Sub-group headers
  setMergedValue(sheet, 'N9:O10', 'הוראה', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'P9:Q10', 'הרכבים', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'R9:T10', 'ריכוז ותאוריה', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // Row 11: Individual column headers
  const headerRow = 11;
  const headers = [
    [2, 'מס\' רץ'],        // B
    [3, 'משפחה'],           // C
    [4, 'פרטי'],             // D
    [5, 'מספר ת.ז.'],       // E
    [6, 'שנת לידה'],         // F
    [7, 'סיווג'],            // G
    [8, 'תואר'],             // H
    [9, 'תעודת הוראה'],      // I
    [10, 'וותק'],            // J
    [11, 'חבר ארגון'],       // K
    [12, 'טלפון נייד'],      // L
    [13, 'דוא"ל'],           // M
    [14, 'שעות מקצועות הוראה'], // N — DIRECT VALUE
    [15, 'ש"ש ליווי פסנתר'],  // O
    [16, 'ש"ש בפועל להרכב'],  // P
    [17, 'ש"ש ריכוז להרכב'],  // Q
    [18, 'שעות תאוריה'],       // R
    [19, 'תיאור תפקיד'],       // S
    [20, 'שעות ריכוז'],        // T
    [21, 'ש"ש ביטול זמן'],     // U
    [22, 'סה"כ שעות'],         // V
    [23, 'שם ומשפחה'],         // W
    [24, 'מס"ד'],              // X
  ];

  for (const [colNum, label] of headers) {
    const cell = sheet.getCell(headerRow, colNum);
    cell.value = label;
    applyStyle(cell, { font: { bold: true, size: 10, color: { argb: COLORS.BLACK } }, alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true } });
  }

  // Instrument column headers (Y-AM, row 11)
  for (const ic of INSTRUMENT_COLS) {
    const cell = sheet.getCell(headerRow, ic.col);
    cell.value = ic.abbrev;
    applyStyle(cell, { font: { bold: true, size: 9, color: { argb: COLORS.BLACK } }, alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 } });
  }

  // ─── Data Rows (starting at row 12) ─────────────────────────────────────
  const dataStart = 12;

  for (let i = 0; i < rows.length; i++) {
    const r = dataStart + i;
    const row = rows[i];

    // B: Running number (formula + result)
    sheet.getCell(r, 2).value = { formula: `IF(TRIM(C${r})<>"",ROW()-11,"")`, result: row.index };

    // C-M: Personal info (direct values)
    sheet.getCell(r, 3).value = row.lastName;
    sheet.getCell(r, 4).value = row.firstName;
    const idCell = sheet.getCell(r, 5);
    idCell.value = row.idNumber;
    idCell.numFmt = '@'; // Force text format for ID numbers
    sheet.getCell(r, 6).value = row.birthYear;
    sheet.getCell(r, 7).value = row.classification;
    sheet.getCell(r, 8).value = row.degree;
    sheet.getCell(r, 9).value = row.hasTeachingCertificate;
    sheet.getCell(r, 10).value = row.seniorityYears;
    sheet.getCell(r, 11).value = row.unionMember;
    sheet.getCell(r, 12).value = row.phone;
    sheet.getCell(r, 13).value = row.email;

    // N: Teaching hours — DIRECT VALUE from DB (NOT a formula)
    sheet.getCell(r, 14).value = row.teachingHours ?? '';

    // O: Accompaniment hours
    sheet.getCell(r, 15).value = row.accompHours ?? '';

    // P: Ensemble actual hours
    sheet.getCell(r, 16).value = row.ensembleActualHours ?? '';

    // Q: Ensemble coordination hours
    sheet.getCell(r, 17).value = row.ensembleCoordHours ?? '';

    // R: Theory hours
    sheet.getCell(r, 18).value = row.theoryHours ?? '';

    // S: Management role description
    sheet.getCell(r, 19).value = row.managementRole;

    // T: Management hours
    sheet.getCell(r, 20).value = row.managementHours ?? '';

    // U: Travel time hours
    sheet.getCell(r, 21).value = row.travelTimeHours ?? '';

    // V: Total (formula + result)
    sheet.getCell(r, 22).value = {
      formula: `SUM(N${r}:U${r})`,
      result: row.totalWeeklyHours ?? 0,
    };

    // W: Full name (formula + result)
    sheet.getCell(r, 23).value = {
      formula: `D${r}&" "&C${r}`,
      result: row.fullName,
    };

    // X: Index reference (formula + result)
    sheet.getCell(r, 24).value = {
      formula: `B${r}`,
      result: row.index,
    };

    // Y-AM: Instrument booleans
    for (const ic of INSTRUMENT_COLS) {
      const val = row.instrumentBooleans[ic.abbrev] || false;
      sheet.getCell(r, ic.col).value = val;
    }

    // Apply RTL alignment to personal/hours columns
    for (let c = 2; c <= 24; c++) {
      const cell = sheet.getCell(r, c);
      if (!cell.alignment) {
        applyStyle(cell, STYLES.defaultRTL);
      }
    }
  }

  return sheet;
}
