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

  // Keyboard (מקלדת)
  { name: 'פסנתר', abbreviation: 'PI', department: 'מקלדת' },

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

export const TEACHER_DEGREES = ['תואר שני', 'תואר ראשון', 'מוסמך', 'בלתי מוסמך'];

export const MANAGEMENT_ROLES = ['ריכוז פדגוגי', 'ריכוז מחלקה', 'סגן מנהל', 'ריכוז אחר'];

export const TEACHING_SUBJECTS = [
  'ליווי פסנתר',
  'ניצוח',
  'תאוריה',
  'הלחנה',
  'ספרנות תזמורות',
  'אחר',
];

export const TEACHER_ROLES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה', 'מגמה'];

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

export const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8];

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

// ─── Schedule / Time ───────────────────────────────────────────────────────────

export const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

export const VALID_DURATIONS = [30, 45, 60];

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

export const IMPORT_TYPES = ['teachers', 'students'];

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
};
