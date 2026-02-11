/**
 * Sheet 1: Cover (כותרת)
 *
 * Title page with Ministry branding, school year, conservatory name.
 * Merged cells for visual layout.
 */

import {
  SHEET_NAMES,
  COLORS,
  createRTLSheet,
  setMergedValue,
  applyStyle,
  applyLayout,
} from './_shared.js';

export function buildCoverSheet({ workbook, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.COVER);
  const tenant = data.tenant || {};
  const consName = metadata.conservatoryName || tenant.name || '';

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 5, 'C': 15, 'D': 15, 'E': 15, 'F': 15, 'G': 15, 'H': 15,
  }, {
    6: 40, 8: 30, 10: 25, 14: 25,
  });

  // ─── Ministry Headers ────────────────────────────────────────────────────
  setMergedValue(sheet, 'C3:H3', 'משרד החינוך', {
    font: { bold: true, size: 16, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  setMergedValue(sheet, 'C4:H4', 'המזכירות הפדגוגית', {
    font: { bold: true, size: 14, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── Main Title ──────────────────────────────────────────────────────────
  setMergedValue(sheet, 'B6:H8', 'ממשק נתוני קונסרבטוריון', {
    font: { bold: true, size: 22, color: { argb: COLORS.BLUE } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── School Year ─────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const schoolYear = `${currentYear - 1}-${currentYear}`;
  setMergedValue(sheet, 'C10:H10', `שנת הלימודים: ${schoolYear}`, {
    font: { bold: true, size: 16, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── Conservatory Name ───────────────────────────────────────────────────
  setMergedValue(sheet, 'C14:H14', consName, {
    font: { bold: true, size: 18, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── Generation Date ─────────────────────────────────────────────────────
  const genDate = metadata.generatedAt || new Date();
  const dateStr = genDate.toLocaleDateString('he-IL');
  setMergedValue(sheet, 'N24:V25', `הופק בתאריך: ${dateStr}`, {
    font: { size: 11, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  return sheet;
}
