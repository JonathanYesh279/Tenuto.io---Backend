/**
 * Permission constants and default role-permission matrix for RBAC.
 * Defines the permission vocabulary (domains, actions, scopes) and the
 * DEFAULT_ROLE_PERMISSIONS matrix that serves as fallback when a tenant
 * has no custom rolePermissions configured.
 *
 * @see docs/plans/2026-03-05-rbac-admin-provisioning-design.md
 */

import { TEACHER_ROLES, ADMIN_TIER_ROLES } from './constants.js';

// ─── Permission Vocabulary ──────────────────────────────────────────────

/** All 9 permission domains */
export const PERMISSION_DOMAINS = {
  STUDENTS:   'students',
  SCHEDULES:  'schedules',
  ORCHESTRAS: 'orchestras',
  REHEARSALS: 'rehearsals',
  THEORY:     'theory',
  TEACHERS:   'teachers',
  REPORTS:    'reports',
  SETTINGS:   'settings',
  ROLES:      'roles',
};

/** Valid actions per domain type */
export const PERMISSION_ACTIONS = {
  CRUD: ['view', 'create', 'update', 'delete'],       // students, schedules, orchestras, rehearsals, theory, teachers
  REPORTS: ['view', 'export'],                          // reports
  SETTINGS: ['view', 'update'],                         // settings
  ROLES: ['view', 'assign'],                            // roles
};

/** Maps each domain to its valid actions */
export const DOMAIN_ACTIONS = {
  students:   ['view', 'create', 'update', 'delete'],
  schedules:  ['view', 'create', 'update', 'delete'],
  orchestras: ['view', 'create', 'update', 'delete'],
  rehearsals: ['view', 'create', 'update', 'delete'],
  theory:     ['view', 'create', 'update', 'delete'],
  teachers:   ['view', 'create', 'update', 'delete'],
  reports:    ['view', 'export'],
  settings:   ['view', 'update'],
  roles:      ['view', 'assign'],
};

/** Scope modifiers (precedence: all > department > own > none) */
export const PERMISSION_SCOPES = ['all', 'department', 'own'];

/** Domains that can ONLY be granted to admin-tier roles */
export const LOCKED_DOMAINS = ['settings', 'roles'];

// ─── Default Role-Permission Matrix ─────────────────────────────────────

/** Full CRUD with 'all' scope across all 9 domains (admin-tier template) */
const ADMIN_PERMISSIONS = Object.freeze({
  students:   Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  schedules:  Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  orchestras: Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  rehearsals: Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  theory:     Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  teachers:   Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
  reports:    Object.freeze({ view: 'all', export: 'all' }),
  settings:   Object.freeze({ view: 'all', update: 'all' }),
  roles:      Object.freeze({ view: 'all', assign: 'all' }),
});

/**
 * Default permission matrix for all 13 roles.
 * Admin-tier roles share the same frozen permissions object.
 * Frozen to prevent accidental mutation — tenant overrides are stored separately.
 */
export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  // ── Admin Tier ──────────────────────────────────────────────────────────
  'מנהל':       ADMIN_PERMISSIONS,
  'סגן מנהל':  ADMIN_PERMISSIONS,
  'מזכירות':   ADMIN_PERMISSIONS,

  // ── Coordinator Tier ────────────────────────────────────────────────────
  'רכז/ת כללי': Object.freeze({
    students:   Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
    orchestras: Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
    rehearsals: Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
    theory:     Object.freeze({ view: 'all', create: 'all', update: 'all', delete: 'all' }),
    reports:    Object.freeze({ view: 'all', export: 'all' }),
    teachers:   Object.freeze({ view: 'all' }),
  }),

  'רכז/ת מחלקתי': Object.freeze({
    students:   Object.freeze({ view: 'department', create: 'department', update: 'department', delete: 'department' }),
    orchestras: Object.freeze({ view: 'department', create: 'department', update: 'department', delete: 'department' }),
    rehearsals: Object.freeze({ view: 'department', create: 'department', update: 'department', delete: 'department' }),
    theory:     Object.freeze({ view: 'department', create: 'department', update: 'department', delete: 'department' }),
    reports:    Object.freeze({ view: 'department' }),
  }),

  // ── Teaching Tier ───────────────────────────────────────────────────────
  'מורה': Object.freeze({
    students:   Object.freeze({ view: 'own', update: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
  }),

  'ניצוח': Object.freeze({
    students:   Object.freeze({ view: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
    orchestras: Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
    rehearsals: Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
  }),

  'מדריך הרכב': Object.freeze({
    students:   Object.freeze({ view: 'own', update: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
    orchestras: Object.freeze({ view: 'own', update: 'own' }),
    rehearsals: Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
  }),

  'תאוריה': Object.freeze({
    students:   Object.freeze({ view: 'own', update: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
    theory:     Object.freeze({ view: 'own', create: 'own', update: 'own', delete: 'own' }),
  }),

  'ליווי פסנתר': Object.freeze({
    students:   Object.freeze({ view: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own' }),
  }),

  'הלחנה': Object.freeze({
    students:   Object.freeze({ view: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own' }),
  }),

  'מורה מגמה': Object.freeze({
    students:   Object.freeze({ view: 'own' }),
    schedules:  Object.freeze({ view: 'own', create: 'own', update: 'own' }),
  }),

  // ── View-Only ───────────────────────────────────────────────────────────
  'צפייה בלבד': Object.freeze({
    students:   Object.freeze({ view: 'all' }),
    schedules:  Object.freeze({ view: 'all' }),
    orchestras: Object.freeze({ view: 'all' }),
    rehearsals: Object.freeze({ view: 'all' }),
    theory:     Object.freeze({ view: 'all' }),
    teachers:   Object.freeze({ view: 'all' }),
    reports:    Object.freeze({ view: 'all' }),
  }),
});

// ─── Utility Functions ──────────────────────────────────────────────────

/**
 * Validate that a rolePermissions object has valid structure.
 * Used when saving tenant customizations.
 */
export function validateRolePermissions(rolePerms) {
  const errors = [];
  for (const [role, domains] of Object.entries(rolePerms)) {
    if (!TEACHER_ROLES.includes(role)) {
      errors.push(`Unknown role: ${role}`);
      continue;
    }
    for (const [domain, actions] of Object.entries(domains)) {
      if (!DOMAIN_ACTIONS[domain]) {
        errors.push(`${role}: unknown domain "${domain}"`);
        continue;
      }
      for (const [action, scope] of Object.entries(actions)) {
        if (!DOMAIN_ACTIONS[domain].includes(action)) {
          errors.push(`${role}.${domain}: unknown action "${action}"`);
        }
        if (!PERMISSION_SCOPES.includes(scope)) {
          errors.push(`${role}.${domain}.${action}: unknown scope "${scope}"`);
        }
      }
    }
    // Check locked domains for non-admin roles
    if (!ADMIN_TIER_ROLES.includes(role)) {
      for (const lockedDomain of LOCKED_DOMAINS) {
        if (domains[lockedDomain]) {
          errors.push(`${role}: cannot have "${lockedDomain}" domain (admin-only)`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Resolve effective permissions for a teacher with multiple roles.
 * Union of all role permissions, most permissive scope wins.
 * @param {string[]} roles - teacher's roles array
 * @param {object} rolePermissions - tenant's rolePermissions (or DEFAULT_ROLE_PERMISSIONS)
 * @returns {object} merged permission map { domain: { action: scope } }
 */
export function resolveEffectivePermissions(roles, rolePermissions) {
  const scopePrecedence = { all: 3, department: 2, own: 1 };
  const effective = {};

  for (const role of roles) {
    const perms = rolePermissions[role];
    if (!perms) continue;

    for (const [domain, actions] of Object.entries(perms)) {
      if (!effective[domain]) effective[domain] = {};
      for (const [action, scope] of Object.entries(actions)) {
        const currentPrecedence = scopePrecedence[effective[domain][action]] || 0;
        const newPrecedence = scopePrecedence[scope] || 0;
        if (newPrecedence > currentPrecedence) {
          effective[domain][action] = scope;
        }
      }
    }
  }

  return effective;
}
