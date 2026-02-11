/**
 * Shared constants, mappings, styles, and helpers for Mimshak2025 export.
 * Single source of truth -- all sheet builders import from here.
 *
 * ABSOLUTE RULE: No hardcoded Hebrew sheet names anywhere in the codebase.
 * Always use SHEET_NAMES constants and rangeRef() for cross-sheet references.
 */

// ─── Sheet Names ─────────────────────────────────────────────────────────────

export const SHEET_NAMES = {
  COVER: 'כותרת',
  PROFILE: 'פרטי_קונסרבטוריון',
  TEACHERS: 'מצבת כח-אדם בהוראה',
  STUDENTS: 'נתונים כללי',
  ENSEMBLES: 'הרכבי ביצוע',
  THEORY: 'שעורי ימש',
  INITIATIVES: 'יוזמות מיוחדות',
  BUDGET: 'טופס עדכון בקשה',
  ATTACHMENTS: 'קבצים מצורפים',
  DATA: 'DATA',
  DATA2: 'DATA2',
  DATA3: 'DATA3',
};

// ─── Color Palette (exact ARGB from Ministry template) ───────────────────────

export const COLORS = {
  YELLOW: 'FFFFFF00',
  LIGHT_BLUE: 'FFB7DEE8',
  LIGHT_ORANGE: 'FFFABF8F',
  GREEN: 'FF00FF00',
  PINK: 'FFFF99CC',
  BLUE: 'FF0000FF',
  DARK_ORANGE: 'FFE26B0A',
  RED_FONT: 'FFFF0000',
  BLACK: 'FF000000',
  WHITE: 'FFFFFFFF',
};

// ─── Style Helpers (private) ─────────────────────────────────────────────────

function headerFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function headerFont(colorArgb, bold = true, size = 11) {
  return { bold, size, color: { argb: colorArgb } };
}

function rtlAlignment(extra = {}) {
  return { horizontal: 'right', vertical: 'middle', readingOrder: 2, wrapText: true, ...extra };
}

// ─── Pre-frozen STYLES Object ────────────────────────────────────────────────
// CRITICAL: ExcelJS can corrupt shared style objects. Always use applyStyle()
// helper which clones before applying.

export const STYLES = Object.freeze({
  sectionHeaderBlue: { fill: headerFill(COLORS.LIGHT_BLUE), font: headerFont(COLORS.BLACK), alignment: rtlAlignment() },
  sectionHeaderOrange: { fill: headerFill(COLORS.LIGHT_ORANGE), font: headerFont(COLORS.BLACK), alignment: rtlAlignment() },
  sectionHeaderGreen: { fill: headerFill(COLORS.GREEN), font: headerFont(COLORS.BLACK), alignment: rtlAlignment() },
  sectionHeaderPink: { fill: headerFill(COLORS.PINK), font: headerFont(COLORS.BLACK), alignment: rtlAlignment() },
  sectionHeaderBlueWhiteFont: { fill: headerFill(COLORS.BLUE), font: headerFont(COLORS.WHITE), alignment: rtlAlignment() },
  sectionHeaderOrangeWhiteFont: { fill: headerFill(COLORS.DARK_ORANGE), font: headerFont(COLORS.WHITE), alignment: rtlAlignment() },
  yellowRequired: { fill: headerFill(COLORS.YELLOW), font: headerFont(COLORS.BLACK), alignment: rtlAlignment() },
  redFormula: { font: { color: { argb: COLORS.RED_FONT } } },
  defaultRTL: { alignment: rtlAlignment() },
});

// ─── Instrument → Ministry Department Column Mapping ─────────────────────────
// Maps system instrument names to Ministry department columns (J-P).
// If a student's instrument is NOT in this map, log warning and skip.

export const INSTRUMENT_TO_MINISTRY = {
  // Column J — כלי קשת
  'כינור': { col: 'J', value: 'כינור' },
  'ויולה': { col: 'J', value: 'ויולה' },
  "צ'לו": { col: 'J', value: "צ'לו" },
  'קונטרבס': { col: 'J', value: 'קונטרבס' },

  // Column K — כלי נשיפה
  'חליל צד': { col: 'K', value: 'חליל צד' },
  'חליל': { col: 'K', value: 'חליל צד' },
  'אבוב': { col: 'K', value: 'אבוב' },
  'קלרינט': { col: 'K', value: 'קלרינט' },
  'בסון': { col: 'K', value: 'בסון' },
  'סקסופון': { col: 'K', value: 'סקסופון' },
  'קרן': { col: 'K', value: 'קרן' },
  'קרן יער': { col: 'K', value: 'קרן' },
  'חצוצרה': { col: 'K', value: 'חצוצרה' },
  'טרומבון': { col: 'K', value: 'טרומבון' },
  'בריטון': { col: 'K', value: 'בריטון' },
  'טובה': { col: 'K', value: 'טובה' },
  'טובה/בריטון': { col: 'K', value: 'בריטון' },
  'חלילית': { col: 'K', value: 'חלילית' },
  'רקורדר': { col: 'K', value: 'חלילית' },

  // Column L — מחלקות כלים
  'פסנתר': { col: 'L', value: 'מחלקת פסנתר' },
  'שירה': { col: 'L', value: 'מחלקה ווקאלית' },
  "צ'מבלו": { col: 'L', value: "צ'מבלו" },

  // Column M — כלי הקשה
  'כלי הקשה': { col: 'M', value: 'כלי הקשה : קלאסי' },
  'תופים': { col: 'M', value: "מערכת תופים : ג'אז-פופ-רוק" },

  // Column N — כלי פריטה
  'גיטרה': { col: 'N', value: 'גיטרה - מסלול קלאסי' },
  'גיטרה קלאסית': { col: 'N', value: 'גיטרה - מסלול קלאסי' },
  'גיטרה בס': { col: 'N', value: 'גיטרה בס' },
  'גיטרה פופ': { col: 'N', value: "גיטרה ג'אז-פופ-רוק" },
  'נבל': { col: 'N', value: 'נבל' },

  // Column O — כלים אתניים
  'עוד': { col: 'O', value: 'עוד' },
  'כינור מזרחי': { col: 'O', value: 'כינור מזרחי' },
  'נאי': { col: 'O', value: 'נאי' },
  'סיטר': { col: 'O', value: 'סיטר' },
  'קאנון': { col: 'O', value: 'קאנון' },
  'כלים אתניים': { col: 'O', value: 'אחר-1' },

  // Column P — כלים עממיים
  'אקורדיון': { col: 'P', value: 'אקורדיון לסוגיו' },
  'מנדולינה': { col: 'P', value: 'מנדולינה לסוגיה' },
};

// ─── Ensemble subType → Column Mapping ───────────────────────────────────────

export const ENSEMBLE_TO_COLUMN = {
  'כלי נשיפה': 'Q',
  'סימפונית': 'R',
  'מעורבת': 'R',
  'כלי קשת': 'S',
  'עממית': 'T',
  'ביג-בנד': 'U',
  'מקהלה': 'V',
  'קולי': 'W',
  'קאמרי קלאסי': 'X',
  "ג'אז-פופ-רוק": 'Y',
};

// ─── Row Limits ──────────────────────────────────────────────────────────────

export const ROW_LIMITS = {
  STUDENT_DATA_START: 6,
  STUDENT_DATA_END: 1177,
  STUDENT_MAX: 1172,        // 1177 - 6 + 1
  STUDENT_SUMMARY_ROW: 1178,
  TEACHER_DATA_START: 12,
  TEACHER_MAX: 6784,        // 6795 - 12 + 1
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Create an RTL worksheet.
 */
export function createRTLSheet(workbook, name, options = {}) {
  return workbook.addWorksheet(name, {
    views: [{ rightToLeft: true }],
    ...options,
  });
}

/**
 * Named range reference with proper quoting for Hebrew sheet names.
 * CRITICAL: Always use this helper -- never manual quoting.
 * @example rangeRef(SHEET_NAMES.STUDENTS, '$B$6:$B$1177') -> "'נתונים כללי'!$B$6:$B$1177"
 */
export function rangeRef(sheetName, a1Range) {
  return `'${sheetName}'!${a1Range}`;
}

/**
 * Set value on a merged region (only top-left gets the value).
 */
export function setMergedValue(sheet, mergeRange, value, style) {
  sheet.mergeCells(mergeRange);
  const topLeft = sheet.getCell(mergeRange.split(':')[0]);
  topLeft.value = value;
  if (style) applyStyle(topLeft, style);
}

/**
 * Apply style with shallow clone to prevent shared object corruption.
 */
export function applyStyle(cell, baseStyle, overrides = {}) {
  const style = { ...baseStyle, ...overrides };
  if (style.fill) cell.fill = { ...style.fill };
  if (style.font) cell.font = { ...style.font };
  if (style.alignment) cell.alignment = { ...style.alignment };
  if (style.border) cell.border = { ...style.border };
  if (style.numFmt) cell.numFmt = style.numFmt;
}

/**
 * Apply style to a rectangular range efficiently.
 */
export function applyStyleToRange(sheet, startRow, endRow, startCol, endCol, style) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      applyStyle(sheet.getCell(r, c), style);
    }
  }
}

/**
 * Set column widths and row heights.
 */
export function applyLayout(sheet, columnWidths, rowHeights = {}) {
  for (const [col, width] of Object.entries(columnWidths)) {
    sheet.getColumn(col).width = width;
  }
  for (const [row, height] of Object.entries(rowHeights)) {
    sheet.getRow(Number(row)).height = height;
  }
}

/**
 * Compose full name from personalInfo.
 */
export function composeName(personalInfo) {
  const fn = personalInfo?.firstName || '';
  const ln = personalInfo?.lastName || '';
  return `${fn} ${ln}`.trim() || personalInfo?.fullName || '';
}

/**
 * Convert time string "HH:MM" to total minutes.
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Difference in minutes between two time strings.
 */
export function timeDiffMinutes(start, end) {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 0;
}
