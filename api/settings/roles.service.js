/**
 * Roles service — business logic for role permission customization.
 * Implements CONF-03 (customization), CONF-04 (reset), SAFE-02 (admin lockout prevention).
 *
 * Tenant admins can customize non-admin role permissions and reset them to defaults.
 * Admin-tier role permissions are frozen and cannot be modified.
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { TEACHER_ROLES, ADMIN_TIER_ROLES } from '../../config/constants.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  validateRolePermissions,
  LOCKED_DOMAINS,
} from '../../config/permissions.js';

const log = createLogger('roles.service');

/**
 * Deep clone an object (handles frozen objects from DEFAULT_ROLE_PERMISSIONS).
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const rolesService = {
  /**
   * Get the tenant's current role permissions merged with defaults,
   * plus a list of all teachers with their roles.
   *
   * @param {string} tenantId
   * @returns {{ rolePermissions: object, teachers: object[] }}
   */
  async getRolePermissions(tenantId) {
    const tenantCollection = await getCollection('tenant');
    const tenant = await tenantCollection.findOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { projection: { rolePermissions: 1 } }
    );

    // Merge: tenant overrides on top of defaults
    const rolePermissions = {
      ...deepClone(DEFAULT_ROLE_PERMISSIONS),
      ...(tenant?.rolePermissions ? deepClone(tenant.rolePermissions) : {}),
    };

    // Always enforce admin-tier permissions from defaults (immutable)
    for (const role of ADMIN_TIER_ROLES) {
      rolePermissions[role] = deepClone(DEFAULT_ROLE_PERMISSIONS[role]);
    }

    // Fetch teachers with role info
    const teacherCollection = await getCollection('teacher');
    const teachers = await teacherCollection
      .find(
        { tenantId },
        {
          projection: {
            _id: 1,
            'personalInfo.firstName': 1,
            'personalInfo.lastName': 1,
            roles: 1,
            coordinatorDepartments: 1,
            isActive: 1,
          },
        }
      )
      .toArray();

    log.info({ tenantId, teacherCount: teachers.length }, 'Retrieved role permissions');

    return { rolePermissions, teachers };
  },

  /**
   * Update a single role's permissions for a tenant.
   * SAFE-02: Admin-tier roles cannot be modified.
   * LOCKED_DOMAINS: Non-admin roles cannot receive settings/roles domains.
   *
   * @param {string} tenantId
   * @param {string} roleName
   * @param {object} permissions - { domain: { action: scope } }
   * @returns {{ success: boolean, roleName?: string, permissions?: object, error?: string, errors?: string[] }}
   */
  async updateRolePermissions(tenantId, roleName, permissions) {
    // Validate role name
    if (!TEACHER_ROLES.includes(roleName)) {
      return { success: false, error: `Unknown role: "${roleName}"` };
    }

    // SAFE-02: Admin-tier roles are immutable
    if (ADMIN_TIER_ROLES.includes(roleName)) {
      return { success: false, error: 'Cannot modify admin-tier role permissions' };
    }

    // LOCKED_DOMAINS double-check: non-admin roles must not have settings or roles domains
    for (const lockedDomain of LOCKED_DOMAINS) {
      if (permissions[lockedDomain]) {
        return {
          success: false,
          error: `Role "${roleName}" cannot have "${lockedDomain}" domain (admin-only)`,
        };
      }
    }

    // Validate permission structure
    const validation = validateRolePermissions({ [roleName]: permissions });
    if (!validation.valid) {
      return { success: false, error: 'Invalid permissions', errors: validation.errors };
    }

    // Load current tenant rolePermissions (or deep-clone defaults if null)
    const tenantCollection = await getCollection('tenant');
    const tenant = await tenantCollection.findOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { projection: { rolePermissions: 1 } }
    );

    const rolePermissions = tenant?.rolePermissions
      ? deepClone(tenant.rolePermissions)
      : deepClone(DEFAULT_ROLE_PERMISSIONS);

    // Update the specific role
    rolePermissions[roleName] = permissions;

    // Save
    await tenantCollection.updateOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { $set: { rolePermissions, updatedAt: new Date() } }
    );

    log.info({ tenantId, roleName }, 'Updated role permissions');

    return { success: true, roleName, permissions };
  },

  /**
   * Reset a single role back to DEFAULT_ROLE_PERMISSIONS.
   *
   * @param {string} tenantId
   * @param {string} roleName
   * @returns {{ success: boolean, roleName?: string, permissions?: object, error?: string }}
   */
  async resetRolePermissions(tenantId, roleName) {
    // Validate role name
    if (!TEACHER_ROLES.includes(roleName)) {
      return { success: false, error: `Unknown role: "${roleName}"` };
    }

    // Admin-tier roles are always defaults — return success immediately
    if (ADMIN_TIER_ROLES.includes(roleName)) {
      return {
        success: true,
        roleName,
        permissions: deepClone(DEFAULT_ROLE_PERMISSIONS[roleName]),
      };
    }

    // Load current tenant rolePermissions
    const tenantCollection = await getCollection('tenant');
    const tenant = await tenantCollection.findOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { projection: { rolePermissions: 1 } }
    );

    const rolePermissions = tenant?.rolePermissions
      ? deepClone(tenant.rolePermissions)
      : deepClone(DEFAULT_ROLE_PERMISSIONS);

    // Reset the specific role to defaults
    rolePermissions[roleName] = deepClone(DEFAULT_ROLE_PERMISSIONS[roleName]);

    // Save
    await tenantCollection.updateOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { $set: { rolePermissions, updatedAt: new Date() } }
    );

    log.info({ tenantId, roleName }, 'Reset role permissions to defaults');

    return {
      success: true,
      roleName,
      permissions: deepClone(DEFAULT_ROLE_PERMISSIONS[roleName]),
    };
  },
};
