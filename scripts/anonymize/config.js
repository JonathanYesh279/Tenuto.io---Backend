import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI,
  DB_NAME: process.env.MONGODB_NAME || 'Tenuto-DB',
  SHARED_PASSWORD: 'Test1234!',
  SALT_ROUNDS: 10,
};

// Collections to drop entirely (contain embedded PII snapshots)
export const COLLECTIONS_TO_DROP = [
  'import_log',
  'ministry_report_snapshots',
  'deletion_audit',
  'deletion_snapshots',
  'migration_backups',
  'security_log',
  'platform_audit_log',
];

// Fake Israeli street addresses for variety
export const FAKE_ADDRESSES = [
  'רחוב הרצל 12, תל אביב',
  'רחוב ויצמן 45, רחובות',
  "רחוב ז'בוטינסקי 78, רמת גן",
  'רחוב סוקולוב 3, הרצליה',
  'רחוב רוטשילד 56, תל אביב',
  'רחוב אחד העם 22, פתח תקווה',
  'רחוב בן גוריון 91, חיפה',
  'רחוב ביאליק 17, רעננה',
  'רחוב הנשיא 34, כפר סבא',
  'רחוב העצמאות 8, נתניה',
  "רחוב המלך ג'ורג' 63, ירושלים",
  'רחוב דיזנגוף 101, תל אביב',
  'רחוב אלנבי 44, תל אביב',
  'שדרות בן ציון 15, ראשון לציון',
  'רחוב הגפן 7, הוד השרון',
  'רחוב התמר 29, אשדוד',
  'רחוב הדקל 52, באר שבע',
  'רחוב האורנים 11, גבעתיים',
  'רחוב הברוש 38, רמלה',
  'רחוב השקמה 66, לוד',
];
