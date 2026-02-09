import { Router } from 'express';
import { superAdminController } from './super-admin.controller.js';
import { authenticateSuperAdmin, requirePermission } from '../../middleware/super-admin.middleware.js';

const router = Router();

// Public routes
router.post('/auth/login', superAdminController.login);
router.post('/seed', superAdminController.seed);

// All routes below require super admin authentication
router.use(authenticateSuperAdmin);

router.post('/auth/logout', superAdminController.logout);

// Tenant management
router.get('/tenants', superAdminController.getTenants);
router.get('/tenants/:id', superAdminController.getTenantById);
router.post('/tenants', superAdminController.createTenant);
router.put('/tenants/:id', superAdminController.updateTenant);
router.put('/tenants/:id/subscription', superAdminController.updateSubscription);
router.put('/tenants/:id/toggle-active', superAdminController.toggleTenantActive);

// Analytics
router.get('/analytics', superAdminController.getAnalytics);

// Admin management (requires manage_tenants permission)
router.get('/admins', requirePermission('manage_tenants'), superAdminController.getAdmins);
router.post('/admins', requirePermission('manage_tenants'), superAdminController.createAdmin);
router.put('/admins/:id', requirePermission('manage_tenants'), superAdminController.updateAdmin);

export default router;
