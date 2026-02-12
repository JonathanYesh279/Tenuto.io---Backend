/**
 * Sheet 8: Budget (טופס עדכון בקשה)
 *
 * Form-style layout with Ministry address header.
 * Conservatory name + business number from DB. Budget lines as empty template.
 */

import {
  SHEET_NAMES,
  COLORS,
  createRTLSheet,
  setMergedValue,
  applyStyle,
  applyLayout,
} from './_shared.js';

export function buildBudgetSheet({ workbook, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.BUDGET);
  const tenant = data.tenant || {};
  const cp = tenant.conservatoryProfile || {};
  const consName = metadata.conservatoryName || tenant.name || '';

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 5, 'C': 20, 'D': 15, 'E': 20, 'F': 15, 'G': 15,
  });

  // ─── Ministry Address Header ─────────────────────────────────────────────
  setMergedValue(sheet, 'C2:G2', 'משרד החינוך - אגף הקונסרבטוריונים', {
    font: { bold: true, size: 14, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  setMergedValue(sheet, 'C3:G3', 'טופס עדכון בקשה תקציבית', {
    font: { bold: true, size: 13, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── Conservatory Info ───────────────────────────────────────────────────
  sheet.getCell('C6').value = 'שם קונסרבטוריון';
  applyStyle(sheet.getCell('C6'), { font: { bold: true } });
  sheet.getCell('E6').value = consName;

  sheet.getCell('C7').value = 'מספר עוסק';
  applyStyle(sheet.getCell('C7'), { font: { bold: true } });
  sheet.getCell('E7').value = cp.businessNumber || '';

  sheet.getCell('C8').value = 'תאריך';
  applyStyle(sheet.getCell('C8'), { font: { bold: true } });
  const dateCell = sheet.getCell('E8');
  dateCell.value = new Date().toLocaleDateString('he-IL');

  // ─── Budget Template Headers (row 12) ────────────────────────────────────
  const headerDefs = [
    [2, 'מס"ד'],
    [3, 'סעיף תקציבי'],
    [4, 'סכום מבוקש'],
    [5, 'סכום מאושר'],
    [6, 'הערות'],
  ];

  for (const [colNum, label] of headerDefs) {
    const cell = sheet.getCell(12, colNum);
    cell.value = label;
    applyStyle(cell, {
      font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true },
    });
  }

  return sheet;
}
