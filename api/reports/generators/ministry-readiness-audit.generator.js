/**
 * Ministry Readiness Audit Generator (INST-02)
 *
 * Shows completion percentage, lists missing required fields, and surfaces
 * cross-validation errors for the Ministry (Mimshak) report.
 *
 * Data source: exportService.getCompletionStatus + crossValidate.
 */

import { exportService } from '../../export/export.service.js';

const TYPE_HEBREW = {
  teacher: 'מורה',
  student: 'תלמיד',
  orchestra: 'הרכב',
  tenant: 'קונסרבטוריון',
};

const CROSS_TYPE_HEBREW = {
  hours_mismatch: 'שעות',
  missing_conductor: 'הרכב',
  conductor_no_orchestras: 'מורה',
  hours_sum_mismatch: 'שעות',
  row_limit_students: 'תלמידים',
  row_limit_teachers: 'מורים',
  unmapped_instrument: 'כלי נגינה',
  unmapped_ensemble: 'הרכב',
};

export default {
  id: 'ministry-readiness-audit',
  name: 'ביקורת מוכנות למשרד',
  description: 'אחוז השלמה, שדות חסרים ושגיאות הצלבה לדוח המשרד',
  category: 'institutional',
  icon: 'ClipboardCheck',
  roles: ['מנהל', 'סגן מנהל'],
  params: {},
  columns: [
    { key: 'entityType', label: 'סוג ישות', type: 'string', sortable: true },
    { key: 'entityName', label: 'שם', type: 'string', sortable: true },
    { key: 'missingField', label: 'שדה חסר / שגיאה', type: 'string', sortable: true },
    { key: 'severity', label: 'חומרה', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // Institutional report — 'own' scope is not meaningful
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    const context = { tenantId: scope.tenantId };
    const rows = [];

    // 1. Get completion status (missing fields + pre-export warnings/errors)
    const status = await exportService.getCompletionStatus(params.schoolYearId || null, { context });

    // 2. Build rows from missing fields
    for (const entry of status.missing) {
      rows.push({
        entityType: TYPE_HEBREW[entry.type] || entry.type,
        entityName: entry.name || '',
        missingField: entry.field,
        severity: 'חובה',
      });
    }

    // 3. Add pre-export errors
    for (const err of (status.preExportErrors || [])) {
      rows.push({
        entityType: CROSS_TYPE_HEBREW[err.type] || err.type,
        entityName: err.type,
        missingField: err.message,
        severity: 'חובה',
      });
    }

    // 4. Add pre-export warnings
    for (const warn of (status.preExportWarnings || [])) {
      rows.push({
        entityType: CROSS_TYPE_HEBREW[warn.type] || warn.type,
        entityName: warn.type,
        missingField: warn.message,
        severity: 'אזהרה',
      });
    }

    // 5. Cross-validation
    const crossResult = await exportService.crossValidate(params.schoolYearId || null, { context });

    for (const err of (crossResult.errors || [])) {
      rows.push({
        entityType: CROSS_TYPE_HEBREW[err.type] || err.type,
        entityName: err.type,
        missingField: err.message,
        severity: 'חובה',
      });
    }

    for (const warn of (crossResult.warnings || [])) {
      rows.push({
        entityType: CROSS_TYPE_HEBREW[warn.type] || warn.type,
        entityName: warn.type,
        missingField: warn.message,
        severity: 'אזהרה',
      });
    }

    // 6. Summary
    const crossWarnings = (crossResult.warnings || []).length;
    const crossErrors = (crossResult.errors || []).length;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'אחוז השלמה', value: status.completionPercentage, type: 'percentage' },
          { label: 'שדות חסרים', value: status.missing.length, type: 'number' },
          { label: 'אזהרות הצלבה', value: crossWarnings, type: 'number' },
          { label: 'שגיאות הצלבה', value: crossErrors, type: 'number' },
          { label: 'מורים', value: status.counts.teachers, type: 'number' },
          { label: 'תלמידים', value: status.counts.students, type: 'number' },
          { label: 'הרכבים', value: status.counts.orchestras, type: 'number' },
        ],
      },
    };
  },
};

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'אחוז השלמה', value: 0, type: 'percentage' },
        { label: 'שדות חסרים', value: 0, type: 'number' },
        { label: 'אזהרות הצלבה', value: 0, type: 'number' },
        { label: 'שגיאות הצלבה', value: 0, type: 'number' },
      ],
    },
  };
}
