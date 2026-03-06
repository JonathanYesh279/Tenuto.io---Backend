/**
 * Report PDF Shaper
 *
 * Transforms raw generator output (columns, rows, summary) into a formatted
 * PDF document buffer using PDFKit. Intentionally separate from the screen
 * display shaping in report.contract.js (EXPO-03).
 *
 * Features:
 * - Conservatory header with tenant name and report title
 * - RTL Hebrew text using Reisinger-Yonatan font
 * - Alternating row colors for readability
 * - Automatic page breaks that avoid splitting rows
 * - Page numbers in footer (עמוד X מתוך Y)
 * - Summary section after data rows
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve font path relative to project root
const HEBREW_FONT_PATH = path.resolve(
  __dirname,
  '../../public/fonts/Reisinger-Yonatan-web/Reisinger-Yonatan-Regular.ttf'
);

// Layout constants
const PAGE = {
  width: 841.89,   // A4 landscape width in points
  height: 595.28,  // A4 landscape height in points
  margins: { top: 60, bottom: 60, left: 40, right: 40 },
};

const USABLE_WIDTH = PAGE.width - PAGE.margins.left - PAGE.margins.right;
const HEADER_HEIGHT = 55;   // Space reserved for page header
const FOOTER_HEIGHT = 40;   // Space reserved for page footer

const COLORS = {
  headerBg: '#2563EB',
  headerText: '#FFFFFF',
  evenRow: '#FFFFFF',
  oddRow: '#F9FAFB',
  summaryBg: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  lineGray: '#D1D5DB',
};

const TABLE = {
  headerRowHeight: 25,
  dataRowHeight: 20,
  headerFontSize: 9,
  dataFontSize: 8,
  summaryFontSize: 8,
  minColWidth: 50,
  maxColWidth: 200,
};

/**
 * Format a cell value for PDF display.
 */
function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return '';

  switch (type) {
    case 'number':
      return Number(value).toLocaleString('he-IL');
    case 'percentage':
      return `${Number(value).toLocaleString('he-IL')}%`;
    case 'currency':
      return `₪${Number(value).toLocaleString('he-IL')}`;
    case 'date': {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    default:
      return String(value);
  }
}

/**
 * Calculate column widths based on type weighting.
 * String columns get 1.5x weight, numeric types get 1x.
 */
function calculateColumnWidths(columns) {
  const weights = columns.map(col => {
    switch (col.type) {
      case 'number':
      case 'percentage':
      case 'currency':
        return 1;
      default:
        return 1.5;
    }
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  return weights.map(w => {
    let width = (w / totalWeight) * USABLE_WIDTH;
    width = Math.max(TABLE.minColWidth, Math.min(TABLE.maxColWidth, width));
    return width;
  });
}

/**
 * Draw the page header (conservatory name, report title, date).
 */
function drawHeader(doc, conservatoryName, reportName, generatedAt) {
  const y = 20;
  const rightX = PAGE.width - PAGE.margins.right;

  // Conservatory name — right-aligned for RTL
  doc
    .font('Hebrew')
    .fontSize(14)
    .fillColor(COLORS.textPrimary)
    .text(conservatoryName, PAGE.margins.left, y, {
      width: USABLE_WIDTH,
      align: 'right',
    });

  // Report title
  doc
    .fontSize(12)
    .text(reportName, PAGE.margins.left, y + 18, {
      width: USABLE_WIDTH,
      align: 'right',
    });

  // Generation date
  const dateStr = generatedAt
    ? new Date(generatedAt).toLocaleDateString('he-IL')
    : new Date().toLocaleDateString('he-IL');

  doc
    .fontSize(9)
    .fillColor(COLORS.textSecondary)
    .text(dateStr, PAGE.margins.left, y + 18, {
      width: USABLE_WIDTH,
      align: 'left',
    });

  // Horizontal line
  doc
    .moveTo(PAGE.margins.left, HEADER_HEIGHT)
    .lineTo(PAGE.width - PAGE.margins.right, HEADER_HEIGHT)
    .strokeColor(COLORS.lineGray)
    .lineWidth(0.5)
    .stroke();
}

/**
 * Draw the page footer with page number.
 */
function drawFooter(doc, pageNum, totalPages) {
  const y = PAGE.height - PAGE.margins.bottom + 15;

  // Horizontal line
  doc
    .moveTo(PAGE.margins.left, y - 5)
    .lineTo(PAGE.width - PAGE.margins.right, y - 5)
    .strokeColor(COLORS.lineGray)
    .lineWidth(0.5)
    .stroke();

  // Page number centered
  doc
    .font('Hebrew')
    .fontSize(8)
    .fillColor(COLORS.textSecondary)
    .text(
      `עמוד ${pageNum} מתוך ${totalPages}`,
      PAGE.margins.left,
      y,
      {
        width: USABLE_WIDTH,
        align: 'center',
      }
    );
}

/**
 * Draw the table header row.
 */
function drawTableHeader(doc, columns, colWidths, y) {
  const x = PAGE.margins.left;
  let currentX = x;

  // Header background
  doc
    .rect(x, y, USABLE_WIDTH, TABLE.headerRowHeight)
    .fill(COLORS.headerBg);

  // Header text
  doc.font('Hebrew').fontSize(TABLE.headerFontSize).fillColor(COLORS.headerText);

  for (let i = 0; i < columns.length; i++) {
    doc.text(
      columns[i].label,
      currentX + 4,
      y + 7,
      {
        width: colWidths[i] - 8,
        align: 'right',
        lineBreak: false,
      }
    );
    currentX += colWidths[i];
  }

  return y + TABLE.headerRowHeight;
}

/**
 * Draw a data row.
 */
function drawDataRow(doc, row, columns, colWidths, y, isOdd) {
  const x = PAGE.margins.left;
  let currentX = x;

  // Row background
  doc
    .rect(x, y, USABLE_WIDTH, TABLE.dataRowHeight)
    .fill(isOdd ? COLORS.oddRow : COLORS.evenRow);

  // Row text
  doc.font('Hebrew').fontSize(TABLE.dataFontSize).fillColor(COLORS.textPrimary);

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const value = formatValue(row[col.key], col.type);

    doc.text(
      value,
      currentX + 4,
      y + 5,
      {
        width: colWidths[i] - 8,
        align: 'right',
        lineBreak: false,
      }
    );
    currentX += colWidths[i];
  }

  return y + TABLE.dataRowHeight;
}

/**
 * Draw the summary section.
 */
function drawSummary(doc, summary, y) {
  if (!summary || !Array.isArray(summary.items) || summary.items.length === 0) {
    return y;
  }

  y += 15; // Gap before summary

  const x = PAGE.margins.left;
  const rowHeight = TABLE.dataRowHeight;

  // Summary background
  doc
    .rect(x, y, USABLE_WIDTH, rowHeight)
    .fill(COLORS.summaryBg);

  // Build summary text
  const summaryText = summary.items
    .map(item => `${item.label}: ${formatValue(item.value, item.type)}`)
    .join('    ');

  doc
    .font('Hebrew')
    .fontSize(TABLE.summaryFontSize)
    .fillColor(COLORS.textPrimary)
    .text(summaryText, x + 4, y + 5, {
      width: USABLE_WIDTH - 8,
      align: 'right',
    });

  return y + rowHeight;
}

/**
 * Transforms report generator output into a formatted PDF buffer.
 *
 * @param {{ id: string, name: string }} reportMeta - Report metadata
 * @param {{ columns: object[], rows: object[], summary?: object }} generatorOutput
 * @param {{ conservatoryName: string, generatedAt: Date }} options
 * @returns {Promise<Buffer>} PDF file as a Buffer
 */
export async function shapePdf(reportMeta, generatorOutput, options) {
  const { columns, rows, summary } = generatorOutput;
  const { conservatoryName, generatedAt } = options;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: PAGE.margins,
        bufferPages: true,
      });

      // Collect output into buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register Hebrew font
      doc.registerFont('Hebrew', HEBREW_FONT_PATH);

      // Calculate column widths
      const colWidths = calculateColumnWidths(columns);

      // Content area boundaries
      const contentTop = HEADER_HEIGHT + 10;
      const contentBottom = PAGE.height - PAGE.margins.bottom - FOOTER_HEIGHT;

      // --- Draw first page header ---
      drawHeader(doc, conservatoryName, reportMeta.name, generatedAt);

      // --- Draw table ---
      let y = contentTop;
      y = drawTableHeader(doc, columns, colWidths, y);

      for (let i = 0; i < rows.length; i++) {
        // Check if we need a page break
        if (y + TABLE.dataRowHeight > contentBottom) {
          doc.addPage();
          drawHeader(doc, conservatoryName, reportMeta.name, generatedAt);
          y = contentTop;
          y = drawTableHeader(doc, columns, colWidths, y);
        }

        y = drawDataRow(doc, rows[i], columns, colWidths, y, i % 2 === 1);
      }

      // --- Draw summary ---
      if (y + 35 > contentBottom && rows.length > 0) {
        doc.addPage();
        drawHeader(doc, conservatoryName, reportMeta.name, generatedAt);
        y = contentTop;
      }
      drawSummary(doc, summary, y);

      // --- Draw footers on all pages ---
      const pageRange = doc.bufferedPageRange();
      const totalPages = pageRange.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i + 1, totalPages);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
