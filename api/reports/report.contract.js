/**
 * Report Generator Contract
 *
 * Defines the output shape that every report generator must produce,
 * validates generator output, and shapes the final API response envelope.
 */

export const COLUMN_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  PERCENTAGE: 'percentage',
  CURRENCY: 'currency',
};

const VALID_COLUMN_TYPES = new Set(Object.values(COLUMN_TYPES));

/**
 * Validates a generator's raw return value has the required shape.
 *
 * @param {object} output - The generator's return value
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
export function validateGeneratorOutput(output) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output must be a non-null object'] };
  }

  // --- columns ---
  if (!Array.isArray(output.columns)) {
    errors.push('columns must be an array');
  } else if (output.columns.length === 0) {
    errors.push('columns must contain at least one column definition');
  } else {
    output.columns.forEach((col, i) => {
      if (!col.key) errors.push(`columns[${i}] missing required field "key"`);
      if (!col.label) errors.push(`columns[${i}] missing required field "label"`);
      if (!col.type) {
        errors.push(`columns[${i}] missing required field "type"`);
      } else if (!VALID_COLUMN_TYPES.has(col.type)) {
        errors.push(`columns[${i}].type "${col.type}" is not a valid COLUMN_TYPE`);
      }
    });
  }

  // --- rows ---
  if (!Array.isArray(output.rows)) {
    errors.push('rows must be an array');
  }

  // --- summary ---
  if (!output.summary || typeof output.summary !== 'object') {
    errors.push('summary must be an object');
  } else if (!Array.isArray(output.summary.items)) {
    errors.push('summary.items must be an array');
  } else {
    output.summary.items.forEach((item, i) => {
      if (!item.label) errors.push(`summary.items[${i}] missing required field "label"`);
      if (item.value === undefined || item.value === null) errors.push(`summary.items[${i}] missing required field "value"`);
      if (!item.type) errors.push(`summary.items[${i}] missing required field "type"`);
    });
  }

  // --- columnGroups (optional) ---
  if (output.columnGroups !== undefined) {
    if (!Array.isArray(output.columnGroups)) {
      errors.push('columnGroups must be an array when provided');
    } else {
      output.columnGroups.forEach((group, i) => {
        if (!group.label) errors.push(`columnGroups[${i}] missing required field "label"`);
        if (!Array.isArray(group.columns)) errors.push(`columnGroups[${i}].columns must be an array`);
      });
    }
  }

  // --- comparisonRows (optional) ---
  if (output.comparisonRows !== undefined) {
    if (!Array.isArray(output.comparisonRows)) {
      errors.push('comparisonRows must be an array when provided');
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Shapes validated generator output into the final API response envelope.
 *
 * @param {object} reportMeta - Generator metadata (id, name/title, exports)
 * @param {object} generatorOutput - Validated generator output
 * @param {object} paginationParams - { page, limit, totalCount }
 * @param {object} [appliedFilters={}] - Filters applied to this request
 * @returns {object} Final API response shape
 */
export function shapeResponse(reportMeta, generatorOutput, paginationParams, appliedFilters = {}) {
  const { page, limit, totalCount } = paginationParams;

  return {
    metadata: {
      reportId: reportMeta.id,
      title: reportMeta.name || reportMeta.title,
      generatedAt: new Date().toISOString(),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: { ...appliedFilters },
      exports: reportMeta.exports || [],
    },
    columns: generatorOutput.columns,
    columnGroups: generatorOutput.columnGroups || undefined,
    rows: generatorOutput.rows,
    summary: generatorOutput.summary,
    comparisonRows: generatorOutput.comparisonRows || undefined,
  };
}
