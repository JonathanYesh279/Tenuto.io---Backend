/**
 * Report Scope Builder
 *
 * Translates req.context (role, tenant, department assignments) into a
 * scope object that generators use for data filtering. Generators are
 * role-unaware -- they receive pre-scoped filters from this module.
 */

/**
 * Builds a report scope from the request context.
 *
 * @param {object} context - req.context from buildContext middleware
 * @param {string} context.tenantId
 * @param {boolean} context.isAdmin
 * @param {boolean} context.isCoordinator
 * @param {string[]} context.coordinatorDepartments
 * @param {string} context.userId
 * @returns {{ type: 'all'|'department'|'own', tenantId: string, departmentIds?: string[], teacherId?: string }}
 */
export function buildReportScope(context) {
  const base = { tenantId: context.tenantId };

  if (context.isAdmin) {
    return { ...base, type: 'all' };
  }

  if (context.isCoordinator) {
    return {
      ...base,
      type: 'department',
      departmentIds: context.coordinatorDepartments || [],
    };
  }

  // Teacher fallback -- should be blocked by requirePermission before reaching here,
  // but handled defensively.
  return {
    ...base,
    type: 'own',
    teacherId: context.userId,
  };
}
