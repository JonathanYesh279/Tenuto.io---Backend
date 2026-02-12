/**
 * Sheet 4: Students (נתונים כללי)
 *
 * THE MAIN SHEET — up to 1172 student data rows.
 * Data starts at row 6. Headers in rows 4-5.
 * ~44 columns: student details (A-I), departments (J-P), ensembles (Q-Y), additional (Z-AB),
 * validation formulas (AC-AR).
 */

import {
  SHEET_NAMES,
  COLORS,
  STYLES,
  createRTLSheet,
  setMergedValue,
  applyStyle,
  applyStyleToRange,
  applyLayout,
  ROW_LIMITS,
} from './_shared.js';

export function buildStudentsSheet({ workbook, mappedData, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.STUDENTS);
  const rows = mappedData.studentFull;
  const totalStudents = data.students.length;

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'A': 6, 'B': 20, 'C': 8, 'D': 8, 'E': 8, 'F': 8,
    'G': 18, 'H': 10, 'I': 15,
    'J': 15, 'K': 15, 'L': 15, 'M': 15, 'N': 15, 'O': 15, 'P': 15,
    'Q': 18, 'R': 18, 'S': 18, 'T': 18, 'U': 18, 'V': 18, 'W': 18, 'X': 18, 'Y': 18,
    'Z': 15, 'AA': 15, 'AB': 15,
  });

  // ─── Row 4: Section group headers (merged) ──────────────────────────────
  setMergedValue(sheet, 'C4:I4', 'פרטי התלמיד/ה', STYLES.defaultRTL);
  setMergedValue(sheet, 'J4:P4', 'מחלקות נגינה / שירה', STYLES.sectionHeaderBlue);
  setMergedValue(sheet, 'Q4:Y4', 'הרכבי ביצוע', STYLES.sectionHeaderOrange);
  setMergedValue(sheet, 'Z4:AB4', 'שיבוץ נוסף', STYLES.defaultRTL);

  // ─── Row 5: Individual column headers ────────────────────────────────────

  // Section A: Student details (A-I) — no background except B=YELLOW
  const colAHeaders = [
    ['A5', 'סידורי'],
    ['B5', 'שם ומשפחה'],
    ['C5', 'גיל'],
    ['D5', 'כיתה'],
    ['E5', 'שנות לימוד'],
    ['F5', 'שלב'],
    ['G5', 'המורה'],
    ['H5', 'זמן שעור'],
    ['I5', 'שעה נוספת ל..'],
  ];
  for (const [cell, label] of colAHeaders) {
    const c = sheet.getCell(cell);
    c.value = label;
    applyStyle(c, STYLES.defaultRTL, { font: { bold: true, size: 11, color: { argb: COLORS.BLACK } } });
  }
  // B5 gets yellow background
  applyStyle(sheet.getCell('B5'), STYLES.yellowRequired);
  sheet.getCell('B5').value = 'שם ומשפחה';

  // Section B: Departments (J-P) — LIGHT_BLUE background
  const deptHeaders = [
    ['J5', 'כלי קשת'],
    ['K5', 'כלי נשיפה'],
    ['L5', 'מחלקות כלים'],
    ['M5', 'כלי הקשה'],
    ['N5', 'כלי פריטה'],
    ['O5', "מח' כלים אתניים"],
    ['P5', "מח' כלים עממיים"],
  ];
  for (const [cell, label] of deptHeaders) {
    const c = sheet.getCell(cell);
    c.value = label;
    applyStyle(c, STYLES.sectionHeaderBlue);
  }

  // Section C: Ensembles (Q-Y) — LIGHT_ORANGE, except Y=GREEN
  const ensHeaders = [
    ['Q5', 'תזמורת כלי נשיפה'],
    ['R5', 'סימפונית ומעורבת'],
    ['S5', 'תזמורת כלי קשת'],
    ['T5', 'תזמורת עממית'],
    ['U5', 'ביג-בנד BigBand'],
    ['V5', 'מקהלות'],
    ['W5', 'הרכב קולי'],
    ['X5', 'הרכבים קאמריים קלאסיים'],
  ];
  for (const [cell, label] of ensHeaders) {
    const c = sheet.getCell(cell);
    c.value = label;
    applyStyle(c, STYLES.sectionHeaderOrange);
  }
  // Y5: green background
  const yCell = sheet.getCell('Y5');
  yCell.value = "הרכבי ג'אז-פופ-רוק";
  applyStyle(yCell, STYLES.sectionHeaderGreen);

  // Section D: Additional (Z-AB) — each has its own color
  const zCell = sheet.getCell('Z5');
  zCell.value = 'מקצועות תאוריה';
  applyStyle(zCell, STYLES.sectionHeaderPink);

  const aaCell = sheet.getCell('AA5');
  aaCell.value = 'מגמת מוסיקה';
  applyStyle(aaCell, STYLES.sectionHeaderBlueWhiteFont);

  const abCell = sheet.getCell('AB5');
  abCell.value = 'לאומית/פלה"צ';
  applyStyle(abCell, STYLES.sectionHeaderOrangeWhiteFont);

  // ─── Data Rows (starting at row 6) ──────────────────────────────────────
  const startRow = ROW_LIMITS.STUDENT_DATA_START;

  for (let i = 0; i < rows.length; i++) {
    const r = startRow + i;
    const row = rows[i];

    // Col A: Running number (formula + result)
    const cellA = sheet.getCell(r, 1);
    cellA.value = { formula: `IF(TRIM(B${r})<>"",ROW()-5,"")`, result: i + 1 };

    // Col B: Full name
    sheet.getCell(r, 2).value = row.fullName;

    // Col C: Age
    sheet.getCell(r, 3).value = row.age || '';

    // Col D: Grade
    sheet.getCell(r, 4).value = row.grade || '';

    // Col E: Years of study
    sheet.getCell(r, 5).value = row.yearsOfStudy !== '' ? row.yearsOfStudy : '';

    // Col F: Stage
    sheet.getCell(r, 6).value = row.stage || '';

    // Col G: Teacher name
    sheet.getCell(r, 7).value = row.teacherName || '';

    // Col H: Lesson duration (ש"ש)
    sheet.getCell(r, 8).value = row.lessonDuration || '';

    // Col I: Extra lesson type
    sheet.getCell(r, 9).value = row.extraLessonType !== '' ? row.extraLessonType : '';

    // Cols J-P: Department (ONE cell gets the instrument value)
    if (row.instrMapping) {
      const colNum = columnLetterToNumber(row.instrMapping.col);
      sheet.getCell(r, colNum).value = row.instrMapping.value;
    }

    // Cols Q-Y: Ensemble columns
    for (const [colLetter, value] of Object.entries(row.ensembleColumns)) {
      const colNum = columnLetterToNumber(colLetter);
      sheet.getCell(r, colNum).value = value;
    }

    // Apply RTL alignment to all data cells
    for (let c = 1; c <= 28; c++) {
      applyStyle(sheet.getCell(r, c), STYLES.defaultRTL);
    }
  }

  // ─── Validation Columns (AC-AR) — formula only ──────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const r = startRow + i;

    // AC: Lookup self
    sheet.getCell(r, 29).value = { formula: `LOOKUP(B${r},B${r})` };

    // AD: Ensemble count if has lessons
    sheet.getCell(r, 30).value = {
      formula: `IF(AND(H${r}>0,SUBTOTAL(3,Q${r}:Y${r})>0),SUBTOTAL(3,Q${r}:Y${r}),"")`,
    };

    // AE: Department count
    sheet.getCell(r, 31).value = { formula: `COUNTA(J${r}:P${r})` };

    // AF: Department validation
    sheet.getCell(r, 32).value = {
      formula: `IF(AND(AE${r}>1,H${r}>0),"NO",(IF(AND(H${r}>0,AE${r}=0),"NO","Ok")))`,
    };

    // AG: Duplicate name check
    sheet.getCell(r, 33).value = { formula: `COUNTIF(Talmidim,B${r})` };

    // AR: Extra hour calculation
    sheet.getCell(r, 44).value = {
      formula: `IF(OR(I${r}="אלתור (יחידני)",I${r}="הלחנה"),1,IF(I${r}="פסנתר 4 ידיים",0.5,""))`,
    };
  }

  // ─── Summary Area (rows 1180+) ──────────────────────────────────────────
  buildStudentSummary(sheet, rows, totalStudents, data, metadata);

  return sheet;
}

// ─── Summary Area Builder ────────────────────────────────────────────────────

function buildStudentSummary(sheet, rows, totalStudents, data, metadata) {
  // Dynamic: summary starts 2 rows after the last data row
  const lastDataRow = ROW_LIMITS.STUDENT_DATA_START + rows.length;
  const summaryStart = lastDataRow + 2;

  // Total students (formula + pre-computed)
  sheet.getCell(summaryStart, 2).value = 'סה"כ תלמידים';
  sheet.getCell(summaryStart, 2).font = { bold: true };
  const endRow = lastDataRow - 1;
  sheet.getCell(summaryStart, 3).value = {
    formula: `COUNTA(B6:B${endRow})`,
    result: totalStudents,
  };

  // Stage distribution
  const stageRow = summaryStart + 2;
  sheet.getCell(stageRow, 2).value = 'פילוח שלבים';
  sheet.getCell(stageRow, 2).font = { bold: true };

  const stages = ['א', 'ב', 'ג'];
  for (let i = 0; i < stages.length; i++) {
    sheet.getCell(stageRow + i, 3).value = `שלב ${stages[i]}`;
    const count = rows.filter((r) => r.stage === stages[i]).length;
    sheet.getCell(stageRow + i, 4).value = {
      formula: `COUNTIF(F6:F${endRow},"${stages[i]}")`,
      result: count,
    };
  }

  // Department breakdown
  const deptRow = stageRow + 4;
  sheet.getCell(deptRow, 2).value = 'פילוח מחלקות';
  sheet.getCell(deptRow, 2).font = { bold: true };

  const deptCols = [
    { col: 'J', name: 'כלי קשת' },
    { col: 'K', name: 'כלי נשיפה' },
    { col: 'L', name: 'מחלקות כלים' },
    { col: 'M', name: 'כלי הקשה' },
    { col: 'N', name: 'כלי פריטה' },
    { col: 'O', name: 'כלים אתניים' },
    { col: 'P', name: 'כלים עממיים' },
  ];

  for (let i = 0; i < deptCols.length; i++) {
    const r = deptRow + 1 + i;
    sheet.getCell(r, 3).value = deptCols[i].name;
    const countVal = rows.filter((row) => row.instrMapping?.col === deptCols[i].col).length;
    sheet.getCell(r, 4).value = {
      formula: `COUNTA(${deptCols[i].col}6:${deptCols[i].col}${endRow})`,
      result: countVal,
    };
  }

  // Ensemble breakdown
  const ensRow = deptRow + 10;
  sheet.getCell(ensRow, 2).value = 'פילוח הרכבים';
  sheet.getCell(ensRow, 2).font = { bold: true };

  const ensCols = [
    { col: 'Q', name: 'כלי נשיפה' },
    { col: 'R', name: 'סימפונית ומעורבת' },
    { col: 'S', name: 'כלי קשת' },
    { col: 'T', name: 'עממית' },
    { col: 'U', name: 'ביג-בנד' },
    { col: 'V', name: 'מקהלות' },
    { col: 'W', name: 'הרכב קולי' },
    { col: 'X', name: 'קאמרי קלאסי' },
    { col: 'Y', name: "ג'אז-פופ-רוק" },
  ];

  for (let i = 0; i < ensCols.length; i++) {
    const r = ensRow + 1 + i;
    sheet.getCell(r, 3).value = ensCols[i].name;
    const countVal = rows.filter((row) => row.ensembleColumns[ensCols[i].col]).length;
    sheet.getCell(r, 4).value = {
      formula: `COUNTA(${ensCols[i].col}6:${ensCols[i].col}${endRow})`,
      result: countVal || 0,
    };
  }

  // Director signature
  const sigRow = ensRow + 12;
  sheet.getCell(sigRow, 2).value = 'מנהל/ת הקונסרבטוריון';
  sheet.getCell(sigRow, 2).font = { bold: true };
  sheet.getCell(sigRow, 3).value = data.tenant?.director?.name || data.tenant?.conservatoryProfile?.managerName || '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function columnLetterToNumber(letter) {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num;
}
