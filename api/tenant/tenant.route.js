import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth(['מנהל']), tenantController.getTenants);
router.get('/:id', requireAuth(['מנהל']), tenantController.getTenantById);
router.post('/', requireAuth(['מנהל']), tenantController.createTenant);
router.put('/:id', requireAuth(['מנהל']), tenantController.updateTenant);

export default router;
