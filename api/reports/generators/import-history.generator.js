/**
 * Import History Generator (INST-04)
 *
 * Shows import log entries with status, success/failure rates,
 * and summary statistics. Data source: import_log collection.
 */

const TYPE_LABELS = {
  teachers: 'מורים',
  students: 'תלמידים',
  conservatory: 'קונסרבטוריון',
  ensembles: 'הרכבים',
};

const STATUS_LABELS = {
  pending: 'ממתין',
  processing: 'בעיבוד',
  completed: 'הושלם',
  partial: 'חלקי',
  failed: 'נכשל',
};

export default {
  id: 'import-history',
  name: 'היסטוריית ייבוא',
  description: 'סיכום פעולות ייבוא נתונים עם סטטוסים ותוצאות',
  category: 'institutional',
  icon: 'Upload',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    importType: {
      type: 'string',
      required: false,
      default: 'all',
      allowed: ['all', 'teachers', 'students', 'conservatory', 'ensembles'],
    },
  },
  columns: [
    { key: 'importType', label: 'סוג ייבוא', type: 'string', sortable: true },
    { key: 'status', label: 'סטטוס', type: 'string', sortable: true },
    { key: 'createdAt', label: 'תאריך', type: 'date', sortable: true },
    { key: 'uploadedBy', label: 'מעלה', type: 'string', sortable: true },
    { key: 'matchedCount', label: 'הצליחו', type: 'number', sortable: true },
    { key: 'notFoundCount', label: 'לא נמצאו', type: 'number', sortable: true },
    { key: 'errorCount', label: 'שגיאות', type: 'number', sortable: true },
    { key: 'totalRecords', label: 'סה"כ רשומות', type: 'number', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    const importLogCollection = await services.getCollection('import_log');

    const filter = { tenantId: scope.tenantId };
    if (params.importType && params.importType !== 'all') {
      filter.importType = params.importType;
    }

    const docs = await importLogCollection.find(filter).sort({ createdAt: -1 }).toArray();

    const rows = docs.map((doc) => {
      const matched = doc.preview?.matched?.length ?? doc.results?.matched ?? 0;
      const notFound = doc.preview?.notFound?.length ?? doc.results?.notFound ?? 0;
      const errors = doc.preview?.errors?.length ?? doc.results?.errors ?? 0;
      const total = doc.preview?.totalRows ?? matched + notFound + errors;

      return {
        importType: TYPE_LABELS[doc.importType] || doc.importType || '-',
        status: STATUS_LABELS[doc.status] || doc.status || '-',
        createdAt: doc.createdAt,
        uploadedBy: doc.uploadedBy || '-',
        matchedCount: matched,
        notFoundCount: notFound,
        errorCount: errors,
        totalRecords: total,
      };
    });

    const completedCount = docs.filter((d) => d.status === 'completed').length;
    const failedCount = docs.filter((d) => d.status === 'failed').length;
    const lastImport = docs.length > 0 ? docs[0].createdAt : null;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ ייבואים', value: docs.length, type: 'number' },
          { label: 'הושלמו', value: completedCount, type: 'number' },
          { label: 'נכשלו', value: failedCount, type: 'number' },
          { label: 'ייבוא אחרון', value: lastImport || '-', type: lastImport ? 'date' : 'string' },
        ],
      },
    };
  },
};

// --- Helpers ---

function emptyResult(columns) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'סה"כ ייבואים', value: 0, type: 'number' },
        { label: 'הושלמו', value: 0, type: 'number' },
        { label: 'נכשלו', value: 0, type: 'number' },
        { label: 'ייבוא אחרון', value: '-', type: 'string' },
      ],
    },
  };
}
