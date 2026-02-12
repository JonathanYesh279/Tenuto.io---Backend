/**
 * Sheet 2: Profile (פרטי_קונסרבטוריון)
 *
 * Form-style layout, 44 rows x 38 columns.
 * All VLOOKUP formulas replaced with direct DB values from tenant.conservatoryProfile.
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

export function buildProfileSheet({ workbook, data, metadata }) {
  const sheet = createRTLSheet(workbook, SHEET_NAMES.PROFILE);
  const tenant = data.tenant || {};
  const cp = tenant.conservatoryProfile || {};
  const director = tenant.director || {};

  // ─── Layout ──────────────────────────────────────────────────────────────
  applyLayout(sheet, {
    'B': 5, 'C': 18, 'D': 5, 'E': 20, 'F': 5,
    'G': 5, 'H': 5, 'I': 5, 'J': 20,
    'K': 5, 'L': 5, 'M': 15, 'N': 15,
  });

  // ─── Row 2: Title ────────────────────────────────────────────────────────
  setMergedValue(sheet, 'C2:J2', 'פרטי קונסרבטוריון', {
    font: { bold: true, size: 16, color: { argb: COLORS.BLACK } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 2 },
  });

  // ─── Row 5: Conservatory name + code + submission date ───────────────────
  sheet.getCell('C5').value = 'קונסרבטוריון';
  applyStyle(sheet.getCell('C5'), { font: { bold: true } });
  sheet.getCell('E5').value = tenant.name || '';

  sheet.getCell('J5').value = 'קוד קונסרבטוריון';
  applyStyle(sheet.getCell('J5'), { font: { bold: true } });
  sheet.getCell('L5').value = cp.code || '';

  sheet.getCell('M5').value = 'תאריך הגשה';
  applyStyle(sheet.getCell('M5'), { font: { bold: true } });
  const dateCell = sheet.getCell('N5');
  dateCell.value = new Date().toLocaleDateString('he-IL');
  applyStyle(dateCell, STYLES.yellowRequired);

  // ─── Row 7: Ownership name ──────────────────────────────────────────────
  sheet.getCell('C7').value = 'שם בעלות';
  applyStyle(sheet.getCell('C7'), { font: { bold: true } });
  sheet.getCell('E7').value = cp.ownershipName || '';

  // ─── Row 9: Status + Social cluster ─────────────────────────────────────
  sheet.getCell('C9').value = 'סטטוס';
  applyStyle(sheet.getCell('C9'), { font: { bold: true } });
  sheet.getCell('E9').value = cp.status || '';

  sheet.getCell('J9').value = 'אשכול חברתי';
  applyStyle(sheet.getCell('J9'), { font: { bold: true } });
  sheet.getCell('L9').value = cp.socialCluster || '';

  // ─── Row 11: Business number ────────────────────────────────────────────
  sheet.getCell('C11').value = 'מספר עוסק';
  applyStyle(sheet.getCell('C11'), { font: { bold: true } });
  sheet.getCell('E11').value = cp.businessNumber || '';

  // ─── Row 12: Mixed city factor (red font note) ─────────────────────────
  sheet.getCell('C12').value = 'מקדם עיר מעורבת';
  applyStyle(sheet.getCell('C12'), { font: { bold: true } });
  sheet.getCell('E12').value = cp.mixedCityFactor || '';
  applyStyle(sheet.getCell('J12'), STYLES.redFormula);
  sheet.getCell('J12').value = 'ערך זה מחושב אוטומטית';

  // ─── Row 14: Manager + Stage ────────────────────────────────────────────
  sheet.getCell('C14').value = 'מנהל/ת';
  applyStyle(sheet.getCell('C14'), { font: { bold: true } });
  sheet.getCell('E14').value = cp.managerName || director.name || '';

  sheet.getCell('J14').value = 'שלב';
  applyStyle(sheet.getCell('J14'), { font: { bold: true } });
  sheet.getCell('L14').value = cp.stage || '';
  if (cp.stageDescription) {
    sheet.getCell('M14').value = cp.stageDescription;
  }

  // ─── Row 16: Support unit + Size category ──────────────────────────────
  sheet.getCell('C16').value = 'יחידת תמיכה';
  applyStyle(sheet.getCell('C16'), { font: { bold: true } });
  sheet.getCell('E16').value = cp.supportUnit || '';

  sheet.getCell('J16').value = 'קטגוריית גודל';
  applyStyle(sheet.getCell('J16'), { font: { bold: true } });
  sheet.getCell('L16').value = cp.sizeCategory || '';

  // ─── Row 18: Main department + Supervision status ──────────────────────
  sheet.getCell('C18').value = 'מחלקה ראשית';
  applyStyle(sheet.getCell('C18'), { font: { bold: true } });
  sheet.getCell('E18').value = cp.mainDepartment || '';

  sheet.getCell('J18').value = 'סטטוס פיקוח';
  applyStyle(sheet.getCell('J18'), { font: { bold: true } });
  sheet.getCell('L18').value = cp.supervisionStatus || '';

  // ─── Row 20: Contact info ──────────────────────────────────────────────
  sheet.getCell('C20').value = 'טלפון משרד';
  applyStyle(sheet.getCell('C20'), { font: { bold: true } });
  sheet.getCell('E20').value = cp.officePhone || '';

  sheet.getCell('J20').value = 'טלפון נייד';
  applyStyle(sheet.getCell('J20'), { font: { bold: true } });
  sheet.getCell('L20').value = cp.mobilePhone || '';

  // ─── Row 22: Email ─────────────────────────────────────────────────────
  sheet.getCell('C22').value = 'דוא"ל';
  applyStyle(sheet.getCell('C22'), { font: { bold: true } });
  sheet.getCell('E22').value = cp.email || '';

  sheet.getCell('J22').value = 'קוד עיר';
  applyStyle(sheet.getCell('J22'), { font: { bold: true } });
  sheet.getCell('L22').value = cp.cityCode || '';

  // ─── Row 24: Address + District ────────────────────────────────────────
  sheet.getCell('C24').value = 'כתובת';
  applyStyle(sheet.getCell('C24'), { font: { bold: true } });
  sheet.getCell('E24').value = cp.address || '';

  sheet.getCell('J24').value = 'מחוז';
  applyStyle(sheet.getCell('J24'), { font: { bold: true } });
  sheet.getCell('L24').value = cp.district || tenant.ministryInfo?.districtName || '';

  // ─── Row 27+: Manager notes (merged cells) ────────────────────────────
  sheet.getCell('C27').value = 'הערות מנהל/ת';
  applyStyle(sheet.getCell('C27'), { font: { bold: true } });

  setMergedValue(sheet, 'C28:J31', cp.managerNotes || '', STYLES.defaultRTL);

  // ─── Summary stats ─────────────────────────────────────────────────────
  sheet.getCell('C34').value = 'סה"כ מורים';
  applyStyle(sheet.getCell('C34'), { font: { bold: true } });
  sheet.getCell('E34').value = data.teachers.length;

  sheet.getCell('C35').value = 'סה"כ תלמידים';
  applyStyle(sheet.getCell('C35'), { font: { bold: true } });
  sheet.getCell('E35').value = data.students.length;

  sheet.getCell('C36').value = 'סה"כ הרכבים';
  applyStyle(sheet.getCell('C36'), { font: { bold: true } });
  sheet.getCell('E36').value = data.orchestras.length;

  return sheet;
}
