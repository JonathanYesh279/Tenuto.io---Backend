/**
 * Sheet 6: Theory (שעורי ימש)
 *
 * Fixed 7 category rows for music theory subjects.
 * Headers + summary rows.
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
import { roundToQuarterHour } from '../../../config/constants.js';

export function buildTheorySheet({ workbook, mappedData, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.THEORY);
  const rows = mappedData.musicTheory;
  const tenant = data.tenant || {};
  const totalStudents = data.students.length;

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 6, 'C': 30, 'D': 12, 'E': 12, 'F': 12, 'G': 5, 'H': 12,
  });

  // ─── Title ───────────────────────────────────────────────────────────────
  const consName = metadata.conservatoryName || tenant.name || '';
  sheet.getCell('C1').value = `שיעורי תורת המוסיקה וימ"ש - ${consName}`;
  applyStyle(sheet.getCell('C1'), { font: { bold: true, size: 14, color: { argb: COLORS.BLACK } } });

  // ─── Headers (row 5) ─────────────────────────────────────────────────────
  const hRow = 5;
  const headerDefs = [
    [2, 'מס"ד'],
    [3, 'מקצוע'],
    [4, 'מספר קבוצות'],
    [5, 'מספר תלמידים'],
    [6, 'שעות בשבוע'],
    [8, 'שעות מאושרות'],
  ];

  for (const [colNum, label] of headerDefs) {
    const cell = sheet.getCell(hRow, colNum);
    cell.value = label;
    applyStyle(cell, {
      font: { bold: true, size: 11, color: { argb: COLORS.BLACK } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2, wrapText: true },
    });
  }

  // ─── Data Rows (starting at row 6) ──────────────────────────────────────
  const dataStart = 6;
  let totalGroups = 0;
  let totalStudentCount = 0;
  let totalHours = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = dataStart + i;
    const row = rows[i];

    sheet.getCell(r, 2).value = i + 1;                    // B: Index
    sheet.getCell(r, 3).value = row.category;              // C: Subject name
    sheet.getCell(r, 4).value = row.groupCount || '';      // D: Group count
    sheet.getCell(r, 5).value = row.studentCount || '';    // E: Student count
    sheet.getCell(r, 6).value = row.weeklyHours || '';     // F: Weekly hours
    sheet.getCell(r, 8).value = '';                        // H: Ministry fills

    totalGroups += row.groupCount;
    totalStudentCount += row.studentCount;
    totalHours += row.weeklyHours;

    for (let c = 2; c <= 8; c++) {
      applyStyle(sheet.getCell(r, c), STYLES.defaultRTL);
    }
  }

  // ─── Summary Rows ───────────────────────────────────────────────────────
  const sumRow = dataStart + rows.length + 1;

  sheet.getCell(sumRow, 3).value = 'סה"כ';
  applyStyle(sheet.getCell(sumRow, 3), { font: { bold: true, size: 11, color: { argb: COLORS.BLACK } } });
  sheet.getCell(sumRow, 4).value = totalGroups;
  sheet.getCell(sumRow, 5).value = totalStudentCount;
  sheet.getCell(sumRow, 6).value = roundToQuarterHour(totalHours);
  sheet.getCell(sumRow, 8).value = '';

  // Participation percentage
  const pctRow = sumRow + 1;
  const participationPct = totalStudents > 0
    ? Math.round((totalStudentCount / totalStudents) * 100)
    : 0;
  sheet.getCell(pctRow, 3).value = 'אחוז השתתפות';
  applyStyle(sheet.getCell(pctRow, 3), { font: { bold: true, size: 11, color: { argb: COLORS.BLACK } } });
  sheet.getCell(pctRow, 5).value = `${participationPct}%`;

  // Director name
  const dirRow = pctRow + 1;
  sheet.getCell(dirRow, 3).value = 'מנהל/ת הקונסרבטוריון';
  applyStyle(sheet.getCell(dirRow, 3), { font: { bold: true, size: 11, color: { argb: COLORS.BLACK } } });
  sheet.getCell(dirRow, 5).value = tenant.director?.name || tenant.conservatoryProfile?.managerName || '';

  return sheet;
}
