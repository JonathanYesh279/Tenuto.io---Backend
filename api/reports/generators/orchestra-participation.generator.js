/**
 * Orchestra Participation Generator (STUD-04)
 *
 * Shows student enrollment across orchestras and identifies membership
 * overlap (students in multiple orchestras). Supports filtering by
 * specific orchestra, overlap-only mode, department, and scope-based
 * access control (all/department/own).
 *
 * Data source: student collection + orchestra collection.
 */

import { getInstrumentsByDepartment } from '../../../config/constants.js';

export default {
  id: 'orchestra-participation',
  name: 'השתתפות בתזמורות',
  description: 'רישום תלמידים בתזמורות וזיהוי חפיפה בין הרכבים',
  category: 'student',
  icon: 'MusicNotes',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    orchestraId: { type: 'string', required: false },
    overlapOnly: { type: 'string', required: false, default: 'false', allowed: ['true', 'false'] },
  },
  columns: [
    { key: 'studentName', label: 'שם תלמיד/ה', type: 'string', sortable: true },
    { key: 'class', label: 'כיתה', type: 'string', sortable: true },
    { key: 'primaryInstrument', label: 'כלי נגינה', type: 'string', sortable: true },
    { key: 'orchestraNames', label: 'תזמורות', type: 'string' },
    { key: 'orchestraCount', label: 'מספר תזמורות', type: 'number', sortable: true },
    { key: 'hasOverlap', label: 'חפיפה', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    // 1. Query orchestras
    const orchestraFilter = { tenantId: scope.tenantId };
    if (params.orchestraId) {
      orchestraFilter._id = params.orchestraId;
    }

    const orchestraCollection = await services.getCollection('orchestra');
    const orchestras = await orchestraCollection.find(orchestraFilter).toArray();

    // Also fetch ALL orchestras for full membership map when filtering by orchestraId
    let allOrchestras = orchestras;
    if (params.orchestraId) {
      allOrchestras = await orchestraCollection.find({ tenantId: scope.tenantId }).toArray();
    }

    // 2. Build studentId -> [orchestraName, ...] map from ALL orchestras
    const studentOrchestraMap = new Map();
    for (const orchestra of allOrchestras) {
      const memberIds = orchestra.memberIds || [];
      for (const memberId of memberIds) {
        if (!studentOrchestraMap.has(memberId)) {
          studentOrchestraMap.set(memberId, []);
        }
        studentOrchestraMap.get(memberId).push(orchestra.name);
      }
    }

    // 3. Build student filter
    const studentFilter = { tenantId: scope.tenantId, isActive: true };

    // Department param filtering
    let deptInstruments = null;
    if (params.department) {
      deptInstruments = getInstrumentsByDepartment(params.department);
      if (deptInstruments.length === 0) {
        return emptyResult(this.columns, orchestras.length);
      }
      studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: deptInstruments };
    }

    // Scope filtering
    if (scope.type === 'department') {
      const allInstruments = scope.departmentIds.flatMap((dept) => getInstrumentsByDepartment(dept));
      if (allInstruments.length === 0) {
        return emptyResult(this.columns, orchestras.length);
      }
      if (deptInstruments) {
        const paramSet = new Set(deptInstruments);
        const intersection = allInstruments.filter((i) => paramSet.has(i));
        if (intersection.length === 0) {
          return emptyResult(this.columns, orchestras.length);
        }
        studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: intersection };
      } else {
        studentFilter['academicInfo.instrumentProgress.instrumentName'] = { $in: allInstruments };
      }
    } else if (scope.type === 'own') {
      studentFilter['teacherAssignments.teacherId'] = scope.teacherId;
    }

    const studentCollection = await services.getCollection('student');
    const students = await studentCollection
      .find(studentFilter, { projection: { _id: 1, personalInfo: 1, academicInfo: 1 } })
      .sort({ 'personalInfo.lastName': 1 })
      .toArray();

    // 4. Filter students by orchestraId membership if specified
    let filteredStudents = students;
    if (params.orchestraId) {
      const targetOrchestra = orchestras[0];
      if (!targetOrchestra) {
        return emptyResult(this.columns, 0);
      }
      const memberSet = new Set(targetOrchestra.memberIds || []);
      filteredStudents = students.filter((s) => memberSet.has(s._id.toString()));
    }

    // 5. Map students to rows
    let rows = filteredStudents.map((student) => {
      const sid = student._id.toString();
      const orchestraList = studentOrchestraMap.get(sid) || [];
      const primaryProgress = getPrimaryInstrument(student);

      return {
        studentName: `${student.personalInfo?.lastName || ''} ${student.personalInfo?.firstName || ''}`.trim(),
        class: student.academicInfo?.class || '',
        primaryInstrument: primaryProgress?.instrumentName || '',
        orchestraNames: orchestraList.length > 0 ? orchestraList.join(', ') : '-',
        orchestraCount: orchestraList.length,
        hasOverlap: orchestraList.length > 1 ? 'כן' : 'לא',
      };
    });

    // 6. overlapOnly filter
    if (params.overlapOnly === 'true') {
      rows = rows.filter((r) => r.orchestraCount > 1);
    }

    // 7. Summary
    const studentsInOrchestras = rows.filter((r) => r.orchestraCount > 0).length;
    const studentsWithOverlap = rows.filter((r) => r.orchestraCount > 1).length;
    const studentsNoOrchestra = rows.filter((r) => r.orchestraCount === 0).length;
    const totalOrchestraCount = allOrchestras.length;
    const avgOrchestras = rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.orchestraCount, 0) / rows.length * 100) / 100
      : 0;

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'תלמידים בתזמורות', value: studentsInOrchestras, type: 'number' },
          { label: 'סה"כ תזמורות', value: totalOrchestraCount, type: 'number' },
          { label: 'תלמידים עם חפיפה', value: studentsWithOverlap, type: 'number' },
          { label: 'ממוצע תזמורות לתלמיד', value: avgOrchestras, type: 'number' },
          { label: 'תלמידים ללא תזמורת', value: studentsNoOrchestra, type: 'number' },
        ],
      },
    };
  },
};

// --- Helpers ---

function getPrimaryInstrument(student) {
  const progress = student.academicInfo?.instrumentProgress || [];
  const primary = progress.find((p) => p.isPrimary === true);
  return primary || progress[0] || null;
}

function emptyResult(columns, orchestraCount = 0) {
  return {
    columns,
    rows: [],
    summary: {
      items: [
        { label: 'תלמידים בתזמורות', value: 0, type: 'number' },
        { label: 'סה"כ תזמורות', value: orchestraCount, type: 'number' },
        { label: 'תלמידים עם חפיפה', value: 0, type: 'number' },
        { label: 'ממוצע תזמורות לתלמיד', value: 0, type: 'number' },
        { label: 'תלמידים ללא תזמורת', value: 0, type: 'number' },
      ],
    },
  };
}
