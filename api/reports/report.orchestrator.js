/**
 * Report Orchestrator
 *
 * Central coordination layer: param validation, scope building,
 * generator execution, output validation, sorting, pagination,
 * and response shaping.
 */

import { getRegistry, getGenerator } from './report.registry.js';
import { validateGeneratorOutput, shapeResponse } from './report.contract.js';
import { buildReportScope } from './report.scope.js';
import { getCollection } from '../../services/mongoDB.service.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('report.orchestrator');

/**
 * Creates a typed error with HTTP status and optional details.
 */
function createError(message, code, status, errors) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (errors) err.errors = errors;
  return err;
}

/**
 * Parses an integer query param with a default, min, and optional max.
 */
function parseIntParam(value, defaultVal, min, max) {
  if (value === undefined || value === null || value === '') return defaultVal;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  let result = Math.max(parsed, min);
  if (max !== undefined) result = Math.min(result, max);
  return result;
}

/**
 * Validates report-specific params declared by the generator.
 *
 * @param {object} generatorParams - Param declarations from generator.params
 * @param {object} queryParams - Raw query params from the request
 * @returns {{ parsed: object, errors: string[] }}
 */
function validateReportParams(generatorParams, queryParams) {
  const parsed = {};
  const errors = [];

  if (!generatorParams) return { parsed, errors };

  for (const [key, spec] of Object.entries(generatorParams)) {
    let value = queryParams[key];

    if (value === undefined || value === '') {
      if (spec.required) {
        errors.push(`Missing required parameter: ${key}`);
        continue;
      }
      parsed[key] = spec.default !== undefined ? spec.default : undefined;
      continue;
    }

    // Type coercion
    if (spec.type === 'number') {
      value = Number(value);
      if (isNaN(value)) {
        errors.push(`Parameter "${key}" must be a number`);
        continue;
      }
    } else if (spec.type === 'boolean') {
      value = value === 'true' || value === true;
    }

    // Allowed values check
    if (spec.allowed && !spec.allowed.includes(value)) {
      errors.push(`Parameter "${key}" must be one of: ${spec.allowed.join(', ')}`);
      continue;
    }

    parsed[key] = value;
  }

  return { parsed, errors };
}

/**
 * Sorts rows in-memory by the given column key.
 * Uses locale-aware comparison for strings, numeric for numbers/percentage/currency.
 *
 * @param {object[]} rows - Array of row objects
 * @param {string} sortBy - Column key to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @param {object[]} columns - Column definitions (to look up type)
 * @returns {object[]} Sorted rows (same array, mutated)
 */
function sortRows(rows, sortBy, sortOrder, columns) {
  const colDef = columns.find(c => c.key === sortBy);
  if (!colDef || !colDef.sortable) return rows;

  const direction = sortOrder === 'desc' ? -1 : 1;
  const isNumeric = ['number', 'percentage', 'currency'].includes(colDef.type);

  rows.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    // Handle nulls/undefined — push to end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (isNumeric) {
      return (Number(aVal) - Number(bVal)) * direction;
    }

    // String comparison with Hebrew locale
    return String(aVal).localeCompare(String(bVal), 'he') * direction;
  });

  return rows;
}

export const reportOrchestrator = {
  /**
   * Returns available reports filtered by the requesting user's roles.
   *
   * @param {object} context - req.context from buildContext middleware
   * @returns {object[]} Array of report metadata objects
   */
  getAvailableReports(context) {
    return getRegistry(context.userRoles);
  },

  /**
   * Generates a report: validates params, builds scope, calls generator,
   * validates output, sorts, paginates, and shapes the response.
   *
   * @param {string} reportId - Generator id
   * @param {object} queryParams - Raw query params from the request
   * @param {object} context - req.context from buildContext middleware
   * @returns {object} Shaped response envelope
   */
  async generateReport(reportId, queryParams, context) {
    // --- Resolve generator ---
    const generator = getGenerator(reportId);
    if (!generator) {
      throw createError(`Report "${reportId}" not found`, 'REPORT_NOT_FOUND', 404);
    }

    // --- Role check ---
    const hasAccess = generator.roles.some(role => context.userRoles.includes(role));
    if (!hasAccess) {
      throw createError('Access denied for this report', 'REPORT_ACCESS_DENIED', 403);
    }

    // --- Parse shared params ---
    const page = parseIntParam(queryParams.page, 1, 1);
    const limit = parseIntParam(queryParams.limit, 50, 1, 500);
    const sortBy = queryParams.sortBy || null;
    const sortOrder = queryParams.sortOrder === 'desc' ? 'desc' : 'asc';
    const schoolYearId = queryParams.schoolYearId || context.schoolYearId || null;
    const comparisonYearId = queryParams.comparisonYearId || null;
    const department = queryParams.department || null;

    // --- Validate report-specific params ---
    const { parsed: reportSpecificParams, errors: paramErrors } =
      validateReportParams(generator.params, queryParams);

    if (paramErrors.length > 0) {
      throw createError('Invalid report parameters', 'INVALID_PARAMS', 400, paramErrors);
    }

    // --- Build scope ---
    const scope = buildReportScope(context);

    // --- Build params object ---
    const params = {
      page,
      limit,
      sortBy,
      sortOrder,
      schoolYearId,
      comparisonYearId,
      department,
      ...reportSpecificParams,
    };

    // --- Build services object ---
    const services = { getCollection };

    // --- Call generator ---
    const startTime = Date.now();
    let rawOutput;
    try {
      rawOutput = await generator.generate(params, scope, { services });
    } catch (err) {
      log.error({ reportId, err: err.message, stack: err.stack }, 'Generator execution failed');
      throw createError(
        `Generator error: ${err.message}`,
        'GENERATOR_ERROR',
        500
      );
    }
    const duration = Date.now() - startTime;
    log.info({ reportId, duration, rowCount: rawOutput?.rows?.length }, 'Generator executed');

    // --- Validate output ---
    const validation = validateGeneratorOutput(rawOutput);
    if (!validation.valid) {
      log.error({ reportId, errors: validation.errors }, 'Invalid generator output');
      throw createError(
        'Generator produced invalid output',
        'INVALID_GENERATOR_OUTPUT',
        500,
        validation.errors
      );
    }

    // --- Apply sorting ---
    let rows = [...rawOutput.rows];
    if (sortBy) {
      sortRows(rows, sortBy, sortOrder, rawOutput.columns);
    }

    // --- Apply pagination ---
    const totalCount = rows.length;
    const paginatedRows = rows.slice((page - 1) * limit, page * limit);

    // --- Shape response ---
    const outputWithPaginatedRows = {
      ...rawOutput,
      rows: paginatedRows,
    };

    const appliedFilters = {
      schoolYearId,
      ...(comparisonYearId ? { comparisonYearId } : {}),
      ...(department ? { department } : {}),
      ...reportSpecificParams,
    };

    return shapeResponse(
      { id: generator.id, name: generator.name, exports: generator.exports },
      outputWithPaginatedRows,
      { page, limit, totalCount },
      appliedFilters
    );
  },
};
