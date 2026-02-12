/**
 * Excel Generator — Mimshak2025 Format
 *
 * Generates Ministry-formatted Excel workbook with 12 sheets using ExcelJS.
 * RTL layout, exact Ministry colors, multi-row headers, formulas, named ranges.
 */

import ExcelJS from 'exceljs';
import { SHEET_NAMES, rangeRef } from './sheets/_shared.js';
import { buildCoverSheet } from './sheets/cover.sheet.js';
import { buildProfileSheet } from './sheets/profile.sheet.js';
import { buildTeachersSheet } from './sheets/teachers.sheet.js';
import { buildStudentsSheet } from './sheets/students.sheet.js';
import { buildEnsemblesSheet } from './sheets/ensembles.sheet.js';
import { buildTheorySheet } from './sheets/theory.sheet.js';
import { buildInitiativesSheet } from './sheets/initiatives.sheet.js';
import { buildBudgetSheet } from './sheets/budget.sheet.js';
import { buildAttachmentsSheet } from './sheets/attachments.sheet.js';
import { buildDataTemplateSheets } from './sheets/data-templates.sheet.js';

export const excelGenerator = {
  generateMinistryWorkbook,
};

/**
 * Generate the complete Mimshak2025 Ministry Excel workbook with 12 sheets.
 *
 * @param {object} params
 * @param {object} params.data - Pre-loaded export data from loadExportData()
 * @param {object} params.mappedData - Pre-mapped data from ministry mappers
 * @param {object} params.metadata - { conservatoryName, schoolYear, generatedAt }
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateMinistryWorkbook({ data, mappedData, metadata = {} }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tenuto.io';
  workbook.created = metadata.generatedAt || new Date();

  const context = { data, mappedData, metadata, workbook };

  // Build sheets in Ministry order (1-12)
  buildCoverSheet(context);
  buildProfileSheet(context);
  buildTeachersSheet(context);
  buildStudentsSheet(context);
  buildEnsemblesSheet(context);
  buildTheorySheet(context);
  buildInitiativesSheet(context);
  buildBudgetSheet(context);
  buildAttachmentsSheet(context);
  buildDataTemplateSheets(context);

  // Define named ranges AFTER all sheets exist (dynamic based on actual data)
  defineNamedRanges(workbook, mappedData);

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Define all named ranges used by formulas across sheets.
 * Ranges are dynamic — sized to actual data, not fixed template positions.
 */
function defineNamedRanges(workbook, mappedData) {
  const names = workbook.definedNames;

  // Student range: row 6 to 6 + studentCount (minimum 1177 for formula compat)
  const studentEnd = Math.max(6 + (mappedData.studentFull?.length || 0), 1177);
  names.add(rangeRef(SHEET_NAMES.STUDENTS, `$B$6:$B$${studentEnd}`), 'Talmidim');
  names.add(rangeRef(SHEET_NAMES.STUDENTS, `$A$6:$A$${studentEnd}`), 'Siduri_Talmidim');

  // Teacher range: row 12 to 12 + teacherCount (minimum 6795 for formula compat)
  const teacherEnd = Math.max(12 + (mappedData.teacherRoster?.length || 0), 6795);
  names.add(rangeRef(SHEET_NAMES.TEACHERS, `$C$12:$C$${teacherEnd}`), 'List');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, `$B$12:$B$${teacherEnd}`), 'Siduri_Morim');

  // Cross-sheet teacher reference ranges (student -> teacher lookups)
  names.add(rangeRef(SHEET_NAMES.TEACHERS, `$W$12:$W$${teacherEnd}`), 'MORIMNAME');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, `$X$12:$X$${teacherEnd}`), 'MORE');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, `$N$12:$N$${teacherEnd}`), 'ZMAN');
}
