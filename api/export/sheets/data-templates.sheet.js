/**
 * Sheets 10-12: DATA, DATA2, DATA3
 *
 * Empty template sheets with headers only — no data rows.
 * These contain reference data used by formulas in the original Ministry template.
 * In our export, all ex-VLOOKUP values are direct from DB, so these are just stubs.
 */

import {
  SHEET_NAMES,
  COLORS,
  createRTLSheet,
  applyStyle,
} from './_shared.js';

export function buildDataTemplateSheets({ workbook }) {
  buildDataSheet(workbook);
  buildData2Sheet(workbook);
  buildData3Sheet(workbook);
}

function buildDataSheet(workbook) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.DATA);

  // 21 header columns
  const headers = [
    'קוד', 'שם קונסרבטוריון', 'עיר', 'מחוז', 'בעלות',
    'סטטוס', 'אשכול', 'מספר עוסק', 'מקדם עיר', 'שלב',
    'תיאור שלב', 'גודל', 'מחלקה', 'פיקוח', 'טלפון',
    'נייד', 'דוא"ל', 'כתובת', 'מנהל/ת', 'הערות',
    'מחוז פיקוח',
  ];

  for (let i = 0; i < headers.length; i++) {
    const cell = sheet.getCell(1, i + 1);
    cell.value = headers[i];
    applyStyle(cell, {
      font: { bold: true, size: 10, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
    });
  }
}

function buildData2Sheet(workbook) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.DATA2);

  // 8 header columns
  const headers = [
    'קוד כלי', 'שם כלי', 'מחלקה', 'קיצור',
    'סוג', 'רמה', 'הערות', 'פעיל',
  ];

  for (let i = 0; i < headers.length; i++) {
    const cell = sheet.getCell(1, i + 1);
    cell.value = headers[i];
    applyStyle(cell, {
      font: { bold: true, size: 10, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
    });
  }
}

function buildData3Sheet(workbook) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.DATA3);

  // 8 header columns
  const headers = [
    'קוד הרכב', 'שם הרכב', 'סוג', 'רמה',
    'מנצח', 'תלמידים', 'הערות', 'פעיל',
  ];

  for (let i = 0; i < headers.length; i++) {
    const cell = sheet.getCell(1, i + 1);
    cell.value = headers[i];
    applyStyle(cell, {
      font: { bold: true, size: 10, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
    });
  }
}
