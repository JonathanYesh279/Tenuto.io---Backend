/**
 * Roles routes — permission configuration API.
 * All routes gated by requirePermission on the 'roles' domain (admin-only locked domain).
 */

import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { rolesController } from './roles.controller.js';

const router = Router();

// GET /api/settings/roles — view permission matrix + teacher list
router.get('/', requirePermission('roles', 'view'), rolesController.getRoles);

// PUT /api/settings/roles/:roleName — update a role's permissions
router.put('/:roleName', requirePermission('roles', 'assign'), rolesController.updateRole);

// POST /api/settings/roles/:roleName/reset — reset a role to defaults
router.post('/:roleName/reset', requirePermission('roles', 'assign'), rolesController.resetRole);

export default router;
