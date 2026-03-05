/**
 * Roles controller — request handling for role permission CRUD.
 * Delegates to rolesService for business logic.
 */

import { rolesService } from './roles.service.js';

export const rolesController = {
  /**
   * GET / — Returns the tenant's role permissions and teacher list.
   */
  async getRoles(req, res, next) {
    try {
      const result = await rolesService.getRolePermissions(req.context.tenantId);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /:roleName — Updates a single role's permissions.
   */
  async updateRole(req, res, next) {
    try {
      const { roleName } = req.params;
      const result = await rolesService.updateRolePermissions(
        req.context.tenantId,
        roleName,
        req.body
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errors: result.errors || undefined,
        });
      }

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /:roleName/reset — Resets a role to default permissions.
   */
  async resetRole(req, res, next) {
    try {
      const { roleName } = req.params;
      const result = await rolesService.resetRolePermissions(
        req.context.tenantId,
        roleName
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
