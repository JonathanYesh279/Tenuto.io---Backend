import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth(['מנהל']), tenantController.getTenants);
router.get('/:id', requireAuth(['מנהל']), tenantController.getTenantById);
router.post('/', requireAuth(['מנהל']), tenantController.createTenant);
router.put('/:id', requireAuth(['מנהל']), tenantController.updateTenant);

// Room management routes
router.get('/:id/rooms', requireAuth(['מנהל']), tenantController.getRooms);
router.post('/:id/rooms', requireAuth(['מנהל']), tenantController.addRoom);
router.put('/:id/rooms/:roomId', requireAuth(['מנהל']), tenantController.updateRoom);
router.put('/:id/rooms/:roomId/deactivate', requireAuth(['מנהל']), tenantController.deactivateRoom);

export default router;
