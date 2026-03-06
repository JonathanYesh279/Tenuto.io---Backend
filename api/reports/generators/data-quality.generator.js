/**
 * Data Quality Report Generator (INST-03)
 *
 * Identifies data anomalies: students without teachers, teachers without
 * students, incomplete student records, and empty orchestras.
 *
 * Data source: student, teacher, orchestra collections.
 */

import { getInstrumentDepartment } from '../../../config/constants.js';

const ANOMALY_PARAM_MAP = {
  'unassigned-students': 'תלמידים ללא שיבוץ',
  'idle-teachers': 'מורים ללא תלמידים',
  'incomplete-records': 'רשומות חלקיות',
  'empty-orchestras': 'הרכבים ריקים',
};

export default {
  id: 'data-quality',
  name: 'איכות נתונים',
  description: 'זיהוי חריגות: תלמידים ללא מורים, מורים ללא תלמידים, רשומות חסרות',
  category: 'institutional',
  icon: 'ShieldCheck',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    anomalyType: {
      type: 'string',
      required: false,
      default: 'all',
      allowed: ['all', 'unassigned-students', 'idle-teachers', 'incomplete-records', 'empty-orchestras'],
    },
  },
  columns: [
    { key: 'anomalyType', label: 'סוג חריגה', type: 'string', sortable: true },
    { key: 'entityType', label: 'סוג ישות', type: 'string', sortable: true },
    { key: 'entityName', label: 'שם', type: 'string', sortable: true },
    { key: 'detail', label: 'פירוט', type: 'string', sortable: true },
    { key: 'severity', label: 'חומרה', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // Institutional report — 'own' scope is not meaningful
    if (scope.type === 'own') {
      return emptyResult(this.columns);
    }

    const tenantFilter = { tenantId: scope.tenantId, isActive: true };

    const studentCollection = await services.getCollection('student');
    const teacherCollection = await services.getCollection('teacher');
    const orchestraCollection = await services.getCollection('orchestra');

    const [students, teachers, orchestras] = await Promise.all([
      studentCollection.find(tenantFilter).toArray(),
      teacherCollection.find(tenantFilter).toArray(),
      orchestraCollection.find({ tenantId: scope.tenantId }).toArray(),
    ]);

    // Department scope filtering
    const deptFilter = scope.type === 'department' ? new Set(scope.departmentIds) : null;

    const filterByDepartment = (instruments) => {
      if (!deptFilter) return true;
      return (instruments || []).some((instr) => deptFilter.has(getInstrumentDepartment(instr)));
    };

    const anomalyFilter = params.anomalyType || 'all';
    const filterLabel = anomalyFilter !== 'all' ? ANOMALY_PARAM_MAP[anomalyFilter] : null;

    let rows = [];

    // --- Unassigned students ---
    if (anomalyFilter === 'all' || anomalyFilter === 'unassigned-students') {
      for (const student of students) {
        const assignments = student.teacherAssignments || [];
        if (assignments.length === 0) {
          // Department filter: check student instrument
          const instruments = (student.academicInfo?.instrumentProgress || []).map((p) => p.instrumentName);
          if (!filterByDepartment(instruments)) continue;

          const name = `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim();
          rows.push({
            anomalyType: 'תלמידים ללא שיבוץ',
            entityType: 'תלמיד',
            entityName: name,
            detail: 'תלמיד/ה ללא שיבוץ למורה',
            severity: 'גבוהה',
          });
        }
      }
    }

    // --- Idle teachers ---
    if (anomalyFilter === 'all' || anomalyFilter === 'idle-teachers') {
      // Collect all teacher IDs that have at least one assigned student
      const assignedTeacherIds = new Set();
      for (const student of students) {
        for (const assignment of (student.teacherAssignments || [])) {
          if (assignment.teacherId) {
            assignedTeacherIds.add(assignment.teacherId.toString());
          }
        }
      }

      for (const teacher of teachers) {
        const tid = teacher._id.toString();
        if (!assignedTeacherIds.has(tid)) {
          // Department filter
          const instruments = teacher.professionalInfo?.instruments || [];
          if (!filterByDepartment(instruments)) continue;

          const name = `${teacher.personalInfo?.lastName || ''} ${teacher.personalInfo?.firstName || ''}`.trim();
          rows.push({
            anomalyType: 'מורים ללא תלמידים',
            entityType: 'מורה',
            entityName: name,
            detail: 'מורה ללא תלמידים משובצים',
            severity: 'בינונית',
          });
        }
      }
    }

    // --- Incomplete student records ---
    if (anomalyFilter === 'all' || anomalyFilter === 'incomplete-records') {
      for (const student of students) {
        const instruments = (student.academicInfo?.instrumentProgress || []).map((p) => p.instrumentName);
        if (!filterByDepartment(instruments)) continue;

        const name = `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim();

        // Academic fields — medium severity
        if (!student.academicInfo?.class) {
          rows.push({
            anomalyType: 'רשומות חלקיות',
            entityType: 'תלמיד',
            entityName: name,
            detail: 'חסר: כיתה',
            severity: 'בינונית',
          });
        }
        if (student.academicInfo?.studyYears == null) {
          rows.push({
            anomalyType: 'רשומות חלקיות',
            entityType: 'תלמיד',
            entityName: name,
            detail: 'חסר: שנות לימוד',
            severity: 'בינונית',
          });
        }
        if (!(student.academicInfo?.instrumentProgress || []).length) {
          rows.push({
            anomalyType: 'רשומות חלקיות',
            entityType: 'תלמיד',
            entityName: name,
            detail: 'חסר: כלי נגינה',
            severity: 'בינונית',
          });
        }

        // Contact info — low severity
        if (!student.personalInfo?.phone && !student.personalInfo?.parentPhone) {
          rows.push({
            anomalyType: 'רשומות חלקיות',
            entityType: 'תלמיד',
            entityName: name,
            detail: 'חסר: פרטי קשר (טלפון)',
            severity: 'נמוכה',
          });
        }
      }
    }

    // --- Empty orchestras ---
    if (anomalyFilter === 'all' || anomalyFilter === 'empty-orchestras') {
      for (const orchestra of orchestras) {
        const members = orchestra.memberIds || [];
        if (members.length === 0) {
          rows.push({
            anomalyType: 'הרכבים ריקים',
            entityType: 'הרכב',
            entityName: orchestra.name || '',
            detail: 'הרכב ללא חברים',
            severity: 'בינונית',
          });
        }
        if (!orchestra.conductorId) {
          rows.push({
            anomalyType: 'הרכבים ריקים',
            entityType: 'הרכב',
            entityName: orchestra.name || '',
            detail: 'הרכב ללא מנצח/מדריך',
            severity: 'בינונית',
          });
        }
      }
    }

    // Filter by anomaly type label if needed
    if (filterLabel) {
      rows = rows.filter((r) => r.anomalyType === filterLabel);
    }

    // Summary counts
    const high = rows.filter((r) => r.severity === 'גבוהה').length;
    const medium = rows.filter((r) => r.severity === 'בינונית').length;
    const low = rows.filter((r) => r.severity === 'נמוכה').length;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ חריגות', value: rows.length, type: 'number' },
          { label: 'חומרה גבוהה', value: high, type: 'number' },
          { label: 'חומרה בינונית', value: medium, type: 'number' },
          { label: 'חומרה נמוכה', value: low, type: 'number' },
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
        { label: 'סה"כ חריגות', value: 0, type: 'number' },
        { label: 'חומרה גבוהה', value: 0, type: 'number' },
        { label: 'חומרה בינונית', value: 0, type: 'number' },
        { label: 'חומרה נמוכה', value: 0, type: 'number' },
      ],
    },
  };
}
