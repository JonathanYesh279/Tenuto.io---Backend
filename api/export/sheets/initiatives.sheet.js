/**
 * Sheet 7: Initiatives (יוזמות מיוחדות)
 *
 * Empty template — headers only at row 10.
 */

import {
  SHEET_NAMES,
  COLORS,
  createRTLSheet,
  applyStyle,
  applyLayout,
} from './_shared.js';

export function buildInitiativesSheet({ workbook, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.INITIATIVES);
  const tenant = data.tenant || {};
  const consName = metadata.conservatoryName || tenant.name || '';

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 8, 'C': 20, 'D': 14, 'E': 12, 'F': 18, 'G': 14,
  });

  // ─── Title ───────────────────────────────────────────────────────────────
  sheet.getCell('C2').value = `יוזמות מיוחדות - ${consName}`;
  applyStyle(sheet.getCell('C2'), { font: { bold: true, size: 14, color: { argb: COLORS.BLACK } } });

  // ─── Headers (row 10) ────────────────────────────────────────────────────
  const headerDefs = [
    [2, 'סידורי'],
    [3, 'סוג יוזמה'],
    [4, 'בתאריך'],
    [5, 'כנס גדול?'],
    [6, 'כנס/מחזור'],
    [7, 'גובה תמיכה'],
  ];

  for (const [colNum, label] of headerDefs) {
    const cell = sheet.getCell(10, colNum);
    cell.value = label;
    applyStyle(cell, {
      font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true },
    });
  }

  return sheet;
}
