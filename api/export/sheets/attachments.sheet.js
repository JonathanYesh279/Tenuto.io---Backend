/**
 * Sheet 9: Attachments (קבצים מצורפים)
 *
 * Static checklist of 5 required attachments. First marked חובה.
 */

import {
  SHEET_NAMES,
  COLORS,
  createRTLSheet,
  applyStyle,
  applyLayout,
} from './_shared.js';

export function buildAttachmentsSheet({ workbook }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.ATTACHMENTS);

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 8, 'C': 40, 'D': 12, 'E': 30,
  });

  // ─── Title ───────────────────────────────────────────────────────────────
  sheet.getCell('C2').value = 'קבצים מצורפים';
  applyStyle(sheet.getCell('C2'), { font: { bold: true, size: 14, color: { argb: COLORS.BLACK } } });

  // ─── Headers (row 5) ─────────────────────────────────────────────────────
  const headerDefs = [
    [2, 'מס"ד'],
    [3, 'תיאור המסמך'],
    [4, 'חובה/רשות'],
    [5, 'הערות'],
  ];

  for (const [colNum, label] of headerDefs) {
    const cell = sheet.getCell(5, colNum);
    cell.value = label;
    applyStyle(cell, {
      font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true },
    });
  }

  // ─── Attachment Items ────────────────────────────────────────────────────
  const items = [
    { desc: 'אישור ניהול תקין', required: 'חובה' },
    { desc: 'דוח כספי מבוקר', required: 'חובה' },
    { desc: 'אישור רואה חשבון', required: 'חובה' },
    { desc: 'תוכנית עבודה שנתית', required: 'חובה' },
    { desc: 'מסמכים נוספים', required: 'רשות' },
  ];

  for (let i = 0; i < items.length; i++) {
    const r = 6 + i;
    sheet.getCell(r, 2).value = i + 1;
    sheet.getCell(r, 3).value = items[i].desc;
    sheet.getCell(r, 4).value = items[i].required;

    for (let c = 2; c <= 5; c++) {
      applyStyle(sheet.getCell(r, c), {
        alignment: { horizontal: 'right', vertical: 'middle', readingOrder: 2 },
      });
    }
  }

  return sheet;
}
