/**
 * Sheet 5: Ensembles (הרכבי ביצוע)
 *
 * Ensemble schedule with rehearsal slots, time formulas, and performance levels.
 * Data from row 13. Headers rows 9-12.
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

export function buildEnsemblesSheet({ workbook, mappedData, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.ENSEMBLES);
  const rows = mappedData.ensembleSchedule;
  const tenant = data.tenant || {};

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'A': 6, 'B': 18, 'C': 20, 'D': 10,
    'E': 10, 'F': 10, 'G': 10, 'H': 10,
    'I': 10, 'J': 10, 'K': 10, 'L': 10,
    'M': 10, 'N': 10, 'O': 10,
    'P': 10, 'Q': 10, 'R': 10,
    'T': 20,
  });

  // ─── Title Rows ──────────────────────────────────────────────────────────
  const consName = metadata.conservatoryName || tenant.name || '';
  sheet.getCell('B1').value = `לוח הרכבי ביצוע - ${consName}`;
  applyStyle(sheet.getCell('B1'), { font: { bold: true, size: 14, color: { argb: COLORS.BLACK } } });

  // ─── Headers (rows 9-12) ─────────────────────────────────────────────────

  // Row 9-10: Group headers
  setMergedValue(sheet, 'E9:H10', 'פעילות I', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'I9:L10', 'פעילות II', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });
  setMergedValue(sheet, 'P9:R10', 'רמת ביצוע', {
    font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // Row 11-12: Sub-headers
  const hRow = 12;
  const headerDefs = [
    [1, 'X'],
    [2, 'שם המנצח'],
    [3, 'תזמורת/הרכב'],
    [4, 'מספר משתתפים'],
    [5, 'ביום'],
    [6, 'משעה'],
    [7, 'עד שעה'],
    [8, 'שעות בפועל'],
    [9, 'ביום'],
    [10, 'משעה'],
    [11, 'עד שעה'],
    [12, 'שעות בפועל'],
    [13, 'סך ש"ש'],
    [14, 'שעות ריכוז'],
    [15, 'סה"כ לדיווח'],
    [16, 'התחלתי'],
    [17, 'ביניים'],
    [18, 'ייצוגי'],
    [20, 'בדיקה'],
  ];

  for (const [colNum, label] of headerDefs) {
    const cell = sheet.getCell(hRow, colNum);
    cell.value = label;
    applyStyle(cell, {
      font: { bold: true, size: 10, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true },
    });
  }

  // ─── Data Rows (starting at row 13) ─────────────────────────────────────
  const dataStart = 13;

  for (let i = 0; i < rows.length; i++) {
    const r = dataStart + i;
    const row = rows[i];

    // A: Active marker
    sheet.getCell(r, 1).value = row.isActive ? 'X' : '';

    // B: Conductor name
    sheet.getCell(r, 2).value = row.conductorName;

    // C: Ensemble name
    sheet.getCell(r, 3).value = row.name;

    // D: Participant count (direct value from DB)
    sheet.getCell(r, 4).value = row.memberCount;

    // E-H: Activity I
    sheet.getCell(r, 5).value = row.act1Day;

    // F-G: Time values (as time format for formulas)
    if (row.act1Start) {
      sheet.getCell(r, 6).value = row.act1Start;
    }
    if (row.act1End) {
      sheet.getCell(r, 7).value = row.act1End;
    }

    // H: Activity I hours (formula + result)
    if (row.act1Hours != null) {
      sheet.getCell(r, 8).value = {
        formula: `HOUR(G${r}-F${r})+MINUTE(G${r}-F${r})/60`,
        result: row.act1Hours,
      };
    }

    // I-L: Activity II
    sheet.getCell(r, 9).value = row.act2Day;
    if (row.act2Start) {
      sheet.getCell(r, 10).value = row.act2Start;
    }
    if (row.act2End) {
      sheet.getCell(r, 11).value = row.act2End;
    }
    if (row.act2Hours != null) {
      sheet.getCell(r, 12).value = {
        formula: `HOUR(K${r}-J${r})+MINUTE(K${r}-J${r})/60`,
        result: row.act2Hours,
      };
    }

    // M: Total actual hours (formula + result)
    sheet.getCell(r, 13).value = {
      formula: `H${r}+L${r}`,
      result: row.totalActualHours,
    };

    // N: Coordination hours (direct value)
    sheet.getCell(r, 14).value = row.coordHours ?? '';

    // O: Total reporting hours (formula + result)
    sheet.getCell(r, 15).value = {
      formula: `M${r}+N${r}`,
      result: row.totalReportingHours,
    };

    // P-R: Performance level (X in the correct column)
    if (row.performanceLevel === 'התחלתי') {
      sheet.getCell(r, 16).value = 'X';
    } else if (row.performanceLevel === 'ביניים') {
      sheet.getCell(r, 17).value = 'X';
    } else if (row.performanceLevel === 'ייצוגי') {
      sheet.getCell(r, 18).value = 'X';
    }

    // T: Validation error formula (formula only)
    sheet.getCell(r, 20).value = {
      formula: `IF(D${r}<3,"סך נגנים נמוך מהנדרש","")`,
    };

    // Apply RTL to data cells
    for (let c = 1; c <= 20; c++) {
      applyStyle(sheet.getCell(r, c), STYLES.defaultRTL);
    }
  }

  return sheet;
}
