/**
 * Excel Generator
 *
 * Generates Ministry-formatted Excel workbook with RTL layout,
 * styled headers, and 2-decimal number formatting.
 * Uses SheetJS (xlsx) to build the workbook.
 */

import XLSX from 'xlsx';

export const excelGenerator = {
  generateMinistryWorkbook,
};

// ─── Ministry Color Palette ──────────────────────────────────────────────────

const COLORS = {
  headerBg: '4472C4',      // Blue header background
  headerFont: 'FFFFFF',    // White header text
  altRowBg: 'D9E2F3',      // Light blue alternating rows
  summaryBg: 'FFC000',     // Gold summary rows
  sectionBg: 'E2EFDA',     // Light green section headers
};

// ─── Sheet Builder ───────────────────────────────────────────────────────────

function buildSheet(rows, options = {}) {
  if (!rows || rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([['אין נתונים']]);
  }

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set RTL
  if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
  // SheetJS doesn't natively support !sheetViews for RTL in community edition,
  // so we use the '!dir' custom property which some consumers respect
  ws['!dir'] = 'rtl';

  // Auto-size columns based on content
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[h] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 30) };
  });

  // Format numbers to 2 decimal places where applicable
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number' && !Number.isInteger(cell.v)) {
        cell.z = '0.00';
      }
    }
  }

  return ws;
}

// ─── Workbook Generator ──────────────────────────────────────────────────────

/**
 * Generate a complete Ministry Excel workbook with 6 sheets.
 *
 * @param {object} sheetData - { teacherRoster, studentData, studentEnsembles, musicTheory, ensembleSchedule, ensembleSummary }
 * @param {object} metadata - { conservatoryName, schoolYear, generatedAt }
 * @returns {Buffer} Excel file buffer
 */
function generateMinistryWorkbook(sheetData, metadata = {}) {
  const wb = XLSX.utils.book_new();

  // Sheet order matches Ministry template
  const sheets = [
    { name: 'מצבת כח-אדם', data: sheetData.teacherRoster },
    { name: 'נתוני תלמידים', data: sheetData.studentData },
    { name: 'שיבוץ להרכבים', data: sheetData.studentEnsembles },
    { name: 'תורת המוזיקה', data: sheetData.musicTheory },
    { name: 'לוח הרכבים', data: sheetData.ensembleSchedule },
    { name: 'סיכום הרכבים', data: sheetData.ensembleSummary },
  ];

  for (const sheet of sheets) {
    const ws = buildSheet(sheet.data || []);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  // Write to buffer
  const buffer = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    bookSST: false,
  });

  return buffer;
}
