// utils/queryScoping.js
// Centralised query-scoping helpers for role-based data access.

import { ADMIN_TIER_ROLES, getInstrumentsByDepartment } from '../config/constants.js';

/**
 * NOTE: context.isAdmin is set by buildContext using ADMIN_TIER_ROLES
 * (includes מנהל, סגן מנהל, מזכירות). All admin checks in this module
 * rely on this being set correctly upstream.
 */

/**
 * Build a MongoDB filter scoped by tenant and user role/permission scope.
 *
 * @param {'student'|'teacher'|'orchestra'|string} collection - target collection name
 * @param {object} baseFilter - caller-supplied filter criteria
 * @param {object} context   - req.context built by buildContext middleware
 * @param {'all'|'department'|'own'|null} [scope=null] - permission scope from requirePermission middleware (req.permissionScope).
 *   When provided, overrides the default isAdmin-based logic:
 *   - 'all': no additional restrictions (same as admin behavior)
 *   - 'department': filters students by instruments matching coordinator's departments
 *   - 'own': filters by teacher's own assigned students
 *   - null: falls back to legacy behavior (admin bypass or own-scope)
 * @returns {object} filter with tenantId + role/scope-based restrictions applied
 */
export function buildScopedFilter(collection, baseFilter, context, scope = null) {
  if (!context?.tenantId) {
    throw new Error('TENANT_GUARD: buildScopedFilter requires context.tenantId. Pass { context: req.context } from controller.');
  }
  const filter = { ...baseFilter, tenantId: context.tenantId };

  // 'all' scope or admin: no additional restrictions within tenant
  if (scope === 'all' || context.isAdmin) {
    return filter;
  }

  // 'department' scope: filter by coordinator's department instruments
  if (scope === 'department') {
    const departments = context.coordinatorDepartments;
    if (Array.isArray(departments) && departments.length > 0) {
      if (collection === 'student') {
        const instruments = departments.flatMap(dept => getInstrumentsByDepartment(dept));
        if (instruments.length > 0) {
          filter['personalInfo.instrument'] = { $in: instruments };
        }
      }
      // orchestra / rehearsal: coordinators see all within tenant (no single-instrument field)
      // teacher: all visible within tenant (needed for scheduling)
      return filter;
    }
    // No departments configured: fall through to own-scope behavior
  }

  // 'own' scope, null scope (legacy), or department fallback:
  // Per-collection scoping rules for non-admin users
  if (collection === 'student') {
    filter['teacherAssignments.teacherId'] = context.userId;
  }
  // teacher / orchestra -- all records visible (needed for scheduling & membership lookups)

  return filter;
}

/**
 * Check whether the current user can access a specific student.
 * Uses the pre-loaded scopes.studentIds array (no DB round-trip).
 *
 * @param {string} studentId - the student _id to check
 * @param {object} context   - req.context
 * @param {'all'|'department'|'own'|null} [scope=null] - permission scope from requirePermission middleware.
 *   - 'all': always allowed
 *   - 'department': allowed (department-level filtering is handled by buildScopedFilter on list queries;
 *     for individual access checks, callers should verify instrument membership separately if needed)
 *   - 'own'/null: uses pre-loaded studentIds array
 * @returns {boolean}
 */
export function canAccessStudent(studentId, context, scope = null) {
  if (context.isAdmin || scope === 'all') return true;
  if (scope === 'department') return true;
  return context.scopes.studentIds.includes(studentId);
}

/**
 * Check whether the resource belongs to the current user.
 *
 * @param {string} ownerId - the _id of the resource owner
 * @param {object} context - req.context
 * @returns {boolean}
 */
export function canAccessOwnResource(ownerId, context) {
  if (context.isAdmin) return true;
  return context.userId === ownerId;
}

/**
 * Custom error class for not-found resources.
 * The resourceType parameter is for SERVER-SIDE logging only.
 * The error handler must always return a generic message to clients.
 */
export class NotFoundError extends Error {
  constructor(resourceType = 'Resource') {
    super(`${resourceType} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}
