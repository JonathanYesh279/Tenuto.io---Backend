/**
 * Example Report Generator (stub)
 *
 * Reference implementation for the report generator plugin convention.
 * Used for pipeline testing in development/test environments.
 * Skipped in production (files starting with _ are excluded).
 */
export default {
  id: '_example',
  name: 'Example Report',
  description: 'Reference stub for pipeline testing',
  category: 'institutional',
  icon: 'FileText',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    groupBy: { type: 'string', required: false, default: 'none', allowed: ['none', 'department'] },
  },
  columns: [
    { key: 'name', label: 'שם', type: 'string', sortable: true },
    { key: 'count', label: 'כמות', type: 'number', sortable: true },
    { key: 'percentage', label: 'אחוז', type: 'percentage', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // Stub: returns static data for pipeline verification
    const rows = [
      { name: 'Example A', count: 10, percentage: 50 },
      { name: 'Example B', count: 8, percentage: 40 },
      { name: 'Example C', count: 2, percentage: 10 },
    ];

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ', value: 20, type: 'number' },
          { label: 'ממוצע', value: 6.67, type: 'number' },
        ],
      },
    };
  },
};
