/**
 * Report Excel Shaper
 *
 * Transforms raw generator output (columns, rows, summary) into a formatted
 * ExcelJS workbook buffer. Intentionally separate from the screen display
 * shaping in report.contract.js (EXPO-03).
 */

import ExcelJS from 'exceljs';

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2563EB' },
};

const HEADER_FONT = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const SUMMARY_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' },
};

const SUMMARY_FONT = {
  bold: true,
};

/**
 * Returns the ExcelJS numFmt string for a column type.
 */
function getNumFmt(type) {
  switch (type) {
    case 'number':     return '#,##0';
    case 'percentage': return '0.0%';
    case 'currency':   return '#,##0 ₪';
    case 'date':       return 'DD/MM/YYYY';
    default:           return undefined;
  }
}

/**
 * Formats a cell value for Excel based on column type.
 * Percentages are converted from 0-100 scale to 0-1 scale for Excel.
 */
function formatCellValue(value, type) {
  if (value === null || value === undefined) return '';

  if (type === 'percentage') {
    const num = Number(value);
    if (isNaN(num)) return value;
    // Generators store as 0-100, Excel percentage format expects 0-1
    return num > 1 ? num / 100 : num;
  }

  return value;
}

/**
 * Calculates display width of a value (for auto-width).
 */
function displayWidth(value) {
  if (value === null || value === undefined) return 0;
  return String(value).length;
}

/**
 * Transforms report generator output into a formatted Excel workbook buffer.
 *
 * @param {{ id: string, name: string }} reportMeta - Report metadata
 * @param {{ columns: object[], rows: object[], summary: object, columnGroups?: object[] }} generatorOutput
 * @returns {Promise<Buffer>} .xlsx file as a Buffer
 */
export async function shapeExcel(reportMeta, generatorOutput) {
  const { columns, rows, summary } = generatorOutput;

  // --- Create workbook ---
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tenuto.io';
  workbook.created = new Date();

  // --- Add worksheet (name truncated to 31 chars for Excel limit) ---
  const sheetName = (reportMeta.name || 'Report').substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    rightToLeft: true,
    views: [{ rightToLeft: true }],
  });

  // Track max widths for auto-sizing
  const maxWidths = new Array(columns.length).fill(0);

  // --- Header row ---
  const headerRow = worksheet.addRow(columns.map(col => col.label));
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = { bottom: { style: 'thin' } };
    maxWidths[colNumber - 1] = Math.max(maxWidths[colNumber - 1], displayWidth(cell.value));
  });

  // --- Data rows ---
  for (const row of rows) {
    const rowValues = columns.map(col => formatCellValue(row[col.key], col.type));
    const excelRow = worksheet.addRow(rowValues);

    excelRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      const numFmt = getNumFmt(col.type);
      if (numFmt) {
        cell.numFmt = numFmt;
      }
      maxWidths[colNumber - 1] = Math.max(maxWidths[colNumber - 1], displayWidth(cell.value));
    });
  }

  // --- Summary row ---
  if (summary && Array.isArray(summary.items) && summary.items.length > 0) {
    // Blank separator row
    worksheet.addRow([]);

    // Build summary row values — try to match summary items to columns by label
    const summaryValues = new Array(columns.length).fill('');

    for (const item of summary.items) {
      // Try to find matching column by label
      const matchIndex = columns.findIndex(col =>
        col.label === item.label ||
        col.label.includes(item.label) ||
        item.label.includes(col.label)
      );

      if (matchIndex >= 0) {
        summaryValues[matchIndex] = formatCellValue(item.value, item.type);
      }
    }

    // If no columns matched, place items sequentially
    const hasMatches = summaryValues.some(v => v !== '');
    if (!hasMatches) {
      summary.items.forEach((item, i) => {
        if (i < columns.length) {
          summaryValues[i] = `${item.label}: ${item.value}`;
        }
      });
    }

    const summaryRow = worksheet.addRow(summaryValues);
    summaryRow.eachCell((cell, colNumber) => {
      cell.fill = SUMMARY_FILL;
      cell.font = SUMMARY_FONT;
      cell.border = { top: { style: 'thin' } };
      const col = columns[colNumber - 1];
      if (col) {
        const numFmt = getNumFmt(col.type);
        if (numFmt && typeof cell.value === 'number') {
          cell.numFmt = numFmt;
        }
      }
    });
  }

  // --- Auto-width columns ---
  worksheet.columns.forEach((col, i) => {
    if (i < maxWidths.length) {
      col.width = Math.min(maxWidths[i] + 2, 40);
      // Minimum width of 8
      if (col.width < 8) col.width = 8;
    }
  });

  // --- Return buffer ---
  return workbook.xlsx.writeBuffer();
}

/*
 * Expected input/output shape (for reference):
 *
 * Input reportMeta:
 *   { id: 'teacher-hours-summary', name: 'סיכום שעות מורים' }
 *
 * Input generatorOutput:
 *   {
 *     columns: [
 *       { key: 'teacherName', label: 'שם המורה', type: 'string', sortable: true },
 *       { key: 'totalHours', label: 'סה"כ שעות', type: 'number', sortable: true },
 *       { key: 'utilization', label: 'ניצולת', type: 'percentage', sortable: true },
 *     ],
 *     rows: [
 *       { teacherName: 'ישראל ישראלי', totalHours: 24, utilization: 85.5 },
 *     ],
 *     summary: {
 *       items: [
 *         { label: 'סה"כ שעות', value: 240, type: 'number' },
 *         { label: 'ניצולת ממוצעת', value: 78.3, type: 'percentage' },
 *       ]
 *     }
 *   }
 *
 * Output: Buffer containing valid .xlsx data
 */
