// utils/queryScoping.js
// Centralised query-scoping helpers for role-based data access.

/**
 * Build a MongoDB filter scoped by tenant and user role.
 *
 * @param {'student'|'teacher'|'orchestra'|string} collection - target collection name
 * @param {object} baseFilter - caller-supplied filter criteria
 * @param {object} context   - req.context built by buildContext middleware
 * @returns {object} filter with tenantId + role-based restrictions applied
 */
export function buildScopedFilter(collection, baseFilter, context) {
  if (!context?.tenantId) {
    throw new Error('TENANT_GUARD: buildScopedFilter requires context.tenantId. Pass { context: req.context } from controller.');
  }
  const filter = { ...baseFilter, tenantId: context.tenantId };

  // Admins see everything within their tenant
  if (context.isAdmin) {
    return filter;
  }

  // Per-collection scoping rules for non-admin users
  if (collection === 'student') {
    filter['teacherAssignments.teacherId'] = context.userId;
  }
  // teacher / orchestra — all records visible (needed for scheduling & membership lookups)

  return filter;
}

/**
 * Check whether the current user can access a specific student.
 * Uses the pre-loaded scopes.studentIds array (no DB round-trip).
 *
 * @param {string} studentId - the student _id to check
 * @param {object} context   - req.context
 * @returns {boolean}
 */
export function canAccessStudent(studentId, context) {
  if (context.isAdmin) return true;
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
