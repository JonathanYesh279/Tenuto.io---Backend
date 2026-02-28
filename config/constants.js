/**
 * Shared constants for the Conservatory SaaS Platform.
 * Single source of truth for all enum values, instrument mappings,
 * and Ministry of Education configuration.
 */

// ─── Instruments ───────────────────────────────────────────────────────────────

export const INSTRUMENT_MAP = [
  // Strings (כלי קשת)
  { name: 'כינור', abbreviation: 'Vi', department: 'כלי קשת' },
  { name: 'ויולה', abbreviation: 'VL', department: 'כלי קשת' },
  { name: "צ'לו", abbreviation: 'CH', department: 'כלי קשת' },
  { name: 'קונטרבס', abbreviation: 'CB', department: 'כלי קשת' },

  // Woodwinds (כלי נשיפה-עץ)
  { name: 'חלילית', abbreviation: 'RE', department: 'כלי נשיפה-עץ' },
  { name: 'רקורדר', abbreviation: 'RE', department: 'כלי נשיפה-עץ' },
  { name: 'חליל צד', abbreviation: 'FL', department: 'כלי נשיפה-עץ' },
  { name: 'אבוב', abbreviation: 'OB', department: 'כלי נשיפה-עץ' },
  { name: 'בסון', abbreviation: 'BS', department: 'כלי נשיפה-עץ' },
  { name: 'סקסופון', abbreviation: 'SX', department: 'כלי נשיפה-עץ' },
  { name: 'קלרינט', abbreviation: 'CL', department: 'כלי נשיפה-עץ' },

  // Brass (כלי נשיפה-פליז)
  { name: 'חצוצרה', abbreviation: 'TR', department: 'כלי נשיפה-פליז' },
  { name: 'קרן יער', abbreviation: 'HR', department: 'כלי נשיפה-פליז' },
  { name: 'טרומבון', abbreviation: 'TB', department: 'כלי נשיפה-פליז' },
  { name: 'טובה/בריטון', abbreviation: 'TU', department: 'כלי נשיפה-פליז' },
  { name: 'בריטון', abbreviation: 'BR', department: 'כלי נשיפה-פליז' },

  // Keyboard (מקלדת)
  { name: 'פסנתר', abbreviation: 'PI', department: 'מקלדת' },
  { name: "צ'מבלו", abbreviation: 'CM', department: 'מקלדת' },

  // Plucked (כלי פריטה)
  { name: 'גיטרה', abbreviation: 'GI', department: 'כלי פריטה' },
  { name: 'גיטרה בס', abbreviation: 'BG', department: 'כלי פריטה' },
  { name: 'גיטרה פופ', abbreviation: 'GP', department: 'כלי פריטה' },
  { name: 'נבל', abbreviation: 'HP', department: 'כלי פריטה' },

  // Percussion (כלי הקשה)
  { name: 'תופים', abbreviation: 'PP', department: 'כלי הקשה' },
  { name: 'כלי הקשה', abbreviation: 'PC', department: 'כלי הקשה' },

  // Vocal (קולי)
  { name: 'שירה', abbreviation: 'VO', department: 'קולי' },

  // Ethnic (כלים אתניים)
  { name: 'עוד', abbreviation: 'UD', department: 'כלים אתניים' },
  { name: 'כלים אתניים', abbreviation: 'KA', department: 'כלים אתניים' },
  { name: 'VM', abbreviation: 'VM', department: 'כלים אתניים' },
  { name: 'NA', abbreviation: 'NA', department: 'כלים אתניים' },
  { name: 'SI', abbreviation: 'SI', department: 'כלים אתניים' },

  // Folk (כלים עממיים)
  { name: 'מנדולינה', abbreviation: 'MN', department: 'כלים עממיים' },
  { name: 'אקורדיון', abbreviation: 'AK', department: 'כלים עממיים' },
];

/** All valid instrument names (27 items) */
export const VALID_INSTRUMENTS = INSTRUMENT_MAP.map((i) => i.name);

/** All unique departments */
export const INSTRUMENT_DEPARTMENTS = [
  'כלי קשת',
  'כלי נשיפה-עץ',
  'כלי נשיפה-פליז',
  'מקלדת',
  'כלי פריטה',
  'כלי הקשה',
  'קולי',
  'כלים אתניים',
  'כלים עממיים',
];

/** Lookup helpers */
export function getInstrumentDepartment(instrumentName) {
  return INSTRUMENT_MAP.find((i) => i.name === instrumentName)?.department || null;
}

export function getInstrumentAbbreviation(instrumentName) {
  return INSTRUMENT_MAP.find((i) => i.name === instrumentName)?.abbreviation || null;
}

export function getInstrumentsByDepartment(department) {
  return INSTRUMENT_MAP.filter((i) => i.department === department).map((i) => i.name);
}

// ─── Teacher Enums ─────────────────────────────────────────────────────────────

export const TEACHER_CLASSIFICATIONS = ['ממשיך', 'חדש'];

export const TEACHER_DEGREES = ['תואר שלישי', 'תואר שני', 'תואר ראשון', 'מוסמך בכיר', 'מוסמך', 'בלתי מוסמך'];

export const MANAGEMENT_ROLES = ['ריכוז פדגוגי', 'ריכוז מחלקה', 'סגן מנהל', 'ריכוז אחר', 'ריכוז אחר (פרט)', 'תיאור תפקיד'];

export const TEACHING_SUBJECTS = [
  'ליווי פסנתר',
  'ניצוח',
  'תאוריה',
  'הלחנה',
  'ספרנות תזמורות',
  'אחר',
];

export const TEACHER_ROLES = ['מורה', 'ניצוח', 'מדריך הרכב', 'מנהל', 'תאוריה', 'מגמה', 'ליווי פסנתר', 'הלחנה'];

/** Mapping of old role names to new ones (for migration and backward compatibility) */
export const ROLE_RENAME_MAP = {
  'מנצח': 'ניצוח',
  'מורה תאוריה': 'תאוריה',
};

/** Mapping of Ministry hour column names to internal field names */
export const TEACHER_HOURS_COLUMNS = {
  'שעות הוראה': 'teachingHours',
  'ליווי פסנתר': 'accompHours',
  'הרכב ביצוע': 'ensembleHours',
  'ריכוז הרכב': 'ensembleCoordHours',
  'תאוריה': 'theoryHours',
  'ניהול': 'managementHours',
  'ריכוז': 'coordinationHours',
  'ביטול זמן': 'breakTimeHours',
  'סה"כ ש"ש': 'totalWeeklyHours',
  "סה''כ ש''ש": 'totalWeeklyHours',
};

// ─── Orchestra / Ensemble Enums ────────────────────────────────────────────────

export const ORCHESTRA_TYPES = ['הרכב', 'תזמורת'];

export const ORCHESTRA_SUB_TYPES = [
  'כלי נשיפה',
  'סימפונית',
  'כלי קשת',
  'קאמרי קלאסי',
  'קולי',
  'מקהלה',
  'ביג-בנד',
  "ג'אז-פופ-רוק",
  'עממית',
];

export const PERFORMANCE_LEVELS = ['התחלתי', 'ביניים', 'ייצוגי'];

// ─── Student Enums ─────────────────────────────────────────────────────────────

export const VALID_CLASSES = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו',
  'ז', 'ח', 'ט', 'י', 'יא', 'יב',
  'אחר',
];

export const VALID_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export const MINISTRY_STAGE_LEVELS = ['א', 'ב', 'ג'];

/**
 * Convert instrument progress stage (1-8) to Ministry level (א/ב/ג).
 * Stages 1-3 → א, 4-5 → ב, 6-8 → ג
 */
export function stageToMinistryLevel(stage) {
  if (stage >= 1 && stage <= 3) return 'א';
  if (stage >= 4 && stage <= 5) return 'ב';
  if (stage >= 6 && stage <= 8) return 'ג';
  return null;
}

/**
 * Convert Ministry level letter (א/ב/ג) to the lowest numeric stage in that range.
 * Inverse of stageToMinistryLevel: א → 1 (range 1-3), ב → 4 (range 4-5), ג → 6 (range 6-8).
 * Returns 1 as safe default for unknown/falsy values (stage progression is upward).
 */
export function ministryLevelToStage(level) {
  if (level === 'א') return 1;
  if (level === 'ב') return 4;
  if (level === 'ג') return 6;
  return 1;
}

// ─── Schedule / Time ───────────────────────────────────────────────────────────

export const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

export const VALID_DURATIONS = [30, 45, 60, 90, 120];

export const TEST_STATUSES = [
  'לא נבחן',
  'עבר/ה',
  'לא עבר/ה',
  'עבר/ה בהצטיינות',
  'עבר/ה בהצטיינות יתרה',
];

// ─── Multi-Tenant ──────────────────────────────────────────────────────────────

export const SUBSCRIPTION_PLANS = ['basic', 'standard', 'premium'];

export const SUPER_ADMIN_PERMISSIONS = ['manage_tenants', 'view_analytics', 'billing'];

export const IMPORT_STATUSES = ['processing', 'completed', 'failed', 'partial'];

export const IMPORT_TYPES = ['teachers', 'students', 'ensembles'];

// ─── Weekly Hours (ש"ש) Conversion ────────────────────────────────────────────

/**
 * Convert minutes to weekly hours (ש"ש).
 * 30 min = 0.50, 45 min = 0.75, 60 min = 1.00
 */
export function minutesToWeeklyHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Round to quarter-hour increments (Ministry format).
 * 0.25, 0.50, 0.75, 1.00, etc.
 */
export function roundToQuarterHour(hours) {
  return Math.round(hours * 4) / 4;
}

// ─── Collection Names ──────────────────────────────────────────────────────────

export const COLLECTIONS = {
  TENANT: 'tenant',
  TEACHER: 'teacher',
  STUDENT: 'student',
  ORCHESTRA: 'orchestra',
  REHEARSAL: 'rehearsal',
  THEORY_LESSON: 'theory_lesson',
  BAGRUT: 'bagrut',
  SCHOOL_YEAR: 'school_year',
  ACTIVITY_ATTENDANCE: 'activity_attendance',
  HOURS_SUMMARY: 'hours_summary',
  IMPORT_LOG: 'import_log',
  MINISTRY_REPORT_SNAPSHOTS: 'ministry_report_snapshots',
  SUPER_ADMIN: 'super_admin',
  DELETION_AUDIT: 'deletion_audit',
  DELETION_SNAPSHOTS: 'deletion_snapshots',
  SECURITY_LOG: 'security_log',
  MIGRATION_BACKUPS: 'migration_backups',
  INTEGRITY_AUDIT_LOG: 'integrityAuditLog',
  INTEGRITY_STATUS: 'integrityStatus',
  PLATFORM_AUDIT_LOG: 'platform_audit_log',
  TENANT_DELETION_SNAPSHOTS: 'tenant_deletion_snapshots',
};

// ─── Audit Actions ────────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  TENANT_CREATED: 'TENANT_CREATED',
  TENANT_UPDATED: 'TENANT_UPDATED',
  TENANT_ACTIVATED: 'TENANT_ACTIVATED',
  TENANT_DEACTIVATED: 'TENANT_DEACTIVATED',
  TENANT_SOFT_DELETED: 'TENANT_SOFT_DELETED',
  TENANT_DELETION_CANCELLED: 'TENANT_DELETION_CANCELLED',
  TENANT_PURGED: 'TENANT_PURGED',
  SUBSCRIPTION_UPDATED: 'SUBSCRIPTION_UPDATED',
  SUPER_ADMIN_CREATED: 'SUPER_ADMIN_CREATED',
  SUPER_ADMIN_UPDATED: 'SUPER_ADMIN_UPDATED',
  IMPERSONATION_STARTED: 'IMPERSONATION_STARTED',
  IMPERSONATION_ENDED: 'IMPERSONATION_ENDED',
  IMPERSONATION_ACTION: 'IMPERSONATION_ACTION',
};

// ─── Tenant-Scoped Collections ────────────────────────────────────────────────
// Collections that store tenant data (have tenantId on documents).
// Used during tenant purge to delete all tenant-specific data.
// Excludes: tenant (deleted separately), super_admin (platform-level),
// platform_audit_log (must survive deletion), migration_backups (one-time scripts),
// integrityAuditLog/integrityStatus (may not have consistent tenantId).

export const TENANT_SCOPED_COLLECTIONS = [
  'teacher', 'student', 'orchestra', 'rehearsal', 'theory_lesson',
  'bagrut', 'school_year', 'activity_attendance', 'hours_summary',
  'import_log', 'ministry_report_snapshots', 'deletion_audit',
  'deletion_snapshots', 'security_log',
];
