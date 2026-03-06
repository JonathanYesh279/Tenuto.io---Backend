/**
 * Teacher Roster Generator (TCHR-04)
 *
 * Lists all teachers with active/inactive status, qualifications,
 * instruments, roles, and contact info. Supports filtering by
 * status (all/active/inactive) and department.
 *
 * Data source: teacher collection.
 */

import { ObjectId } from 'mongodb';
import { getInstrumentDepartment, getInstrumentsByDepartment } from '../../../config/constants.js';

export default {
  id: 'teacher-roster',
  name: 'רשימת מורים',
  description: 'רשימת כל המורים עם פרטי קשר, כלי נגינה, תפקידים וסטטוס',
  category: 'teacher',
  icon: 'Users',
  roles: ['מנהל', 'סגן מנהל', 'מזכירות'],
  params: {
    status: { type: 'string', required: false, default: 'all', allowed: ['all', 'active', 'inactive'] },
    department: { type: 'string', required: false },
  },
  columns: [
    { key: 'teacherName', label: 'שם מורה', type: 'string', sortable: true },
    { key: 'idNumber', label: 'ת.ז.', type: 'string' },
    { key: 'email', label: 'אימייל', type: 'string' },
    { key: 'phone', label: 'טלפון', type: 'string' },
    { key: 'classification', label: 'סיווג', type: 'string', sortable: true },
    { key: 'degree', label: 'דרגה', type: 'string', sortable: true },
    { key: 'instruments', label: 'כלי נגינה', type: 'string' },
    { key: 'roles', label: 'תפקידים', type: 'string' },
    { key: 'seniority', label: 'ותק', type: 'number', sortable: true },
    { key: 'isActive', label: 'סטטוס', type: 'string', sortable: true },
  ],
  exports: ['excel', 'pdf'],

  async generate(params, scope, { services }) {
    const filter = { tenantId: scope.tenantId };

    // Status filter
    if (params.status === 'active') {
      filter.isActive = true;
    } else if (params.status === 'inactive') {
      filter.isActive = false;
    }
    // 'all' or undefined: no isActive filter

    // Department param filtering: find instruments in the requested department
    if (params.department) {
      const instrumentsInDept = getInstrumentsByDepartment(params.department);
      if (instrumentsInDept.length > 0) {
        filter['professionalInfo.instruments'] = { $in: instrumentsInDept };
      } else {
        return emptyResult(this.columns);
      }
    }

    // Scope-based filtering
    if (scope.type === 'department') {
      const allInstruments = scope.departmentIds.flatMap((dept) => getInstrumentsByDepartment(dept));
      if (allInstruments.length === 0) {
        return emptyResult(this.columns);
      }
      // If department param also set, intersect
      if (filter['professionalInfo.instruments']) {
        const paramSet = new Set(filter['professionalInfo.instruments'].$in);
        const intersection = allInstruments.filter((i) => paramSet.has(i));
        if (intersection.length === 0) {
          return emptyResult(this.columns);
        }
        filter['professionalInfo.instruments'] = { $in: intersection };
      } else {
        filter['professionalInfo.instruments'] = { $in: allInstruments };
      }
    } else if (scope.type === 'own') {
      filter._id = new ObjectId(scope.teacherId);
    }

    const teacherCollection = await services.getCollection('teacher');
    const teachers = await teacherCollection
      .find(filter)
      .sort({ 'personalInfo.lastName': 1 })
      .toArray();

    const rows = teachers.map((teacher) => ({
      teacherName: `${teacher.personalInfo?.lastName || ''} ${teacher.personalInfo?.firstName || ''}`.trim(),
      idNumber: teacher.personalInfo?.idNumber || '',
      email: teacher.personalInfo?.email || teacher.credentials?.email || '',
      phone: teacher.personalInfo?.phone || '',
      classification: teacher.professionalInfo?.classification || '',
      degree: teacher.professionalInfo?.degree || '',
      instruments: (teacher.professionalInfo?.instruments || []).join(', '),
      roles: (teacher.roles || []).join(', '),
      seniority: teacher.professionalInfo?.seniority || 0,
      isActive: teacher.isActive ? 'פעיל' : 'לא פעיל',
    }));

    const activeCount = rows.filter((r) => r.isActive === 'פעיל').length;
    const inactiveCount = rows.length - activeCount;

    // Count distinct instruments across all returned teachers
    const instrumentSet = new Set();
    for (const teacher of teachers) {
      for (const instr of teacher.professionalInfo?.instruments || []) {
        instrumentSet.add(instr);
      }
    }

    return {
      columns: this.columns,
      rows,
      summary: {
        items: [
          { label: 'סה"כ מורים', value: rows.length, type: 'number' },
          { label: 'פעילים', value: activeCount, type: 'number' },
          { label: 'לא פעילים', value: inactiveCount, type: 'number' },
          { label: 'כלי נגינה שונים', value: instrumentSet.size, type: 'number' },
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
        { label: 'סה"כ מורים', value: 0, type: 'number' },
        { label: 'פעילים', value: 0, type: 'number' },
        { label: 'לא פעילים', value: 0, type: 'number' },
        { label: 'כלי נגינה שונים', value: 0, type: 'number' },
      ],
    },
  };
}
