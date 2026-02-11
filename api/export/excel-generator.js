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

  // Define named ranges AFTER all sheets exist
  defineNamedRanges(workbook);

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Define all named ranges used by formulas across sheets.
 * Must be called after all sheets are built.
 */
function defineNamedRanges(workbook) {
  const names = workbook.definedNames;

  // Student sheet ranges
  names.add(rangeRef(SHEET_NAMES.STUDENTS, '$B$6:$B$1177'), 'Talmidim');
  names.add(rangeRef(SHEET_NAMES.STUDENTS, '$A$6:$A$1177'), 'Siduri_Talmidim');

  // Teacher sheet ranges
  names.add(rangeRef(SHEET_NAMES.TEACHERS, '$C$12:$C$6795'), 'List');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, '$B$12:$B$6795'), 'Siduri_Morim');

  // Cross-sheet teacher reference ranges (student -> teacher lookups)
  names.add(rangeRef(SHEET_NAMES.TEACHERS, '$W$12:$W$6795'), 'MORIMNAME');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, '$X$12:$X$6795'), 'MORE');
  names.add(rangeRef(SHEET_NAMES.TEACHERS, '$N$12:$N$6795'), 'ZMAN');
}
