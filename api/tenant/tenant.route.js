import { Router } from 'express';
import multer from 'multer';
import { tenantController } from './tenant.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// Multer config for room Excel import (memory-only, 5MB max)
const roomUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('\u05E8\u05E7 \u05E7\u05D1\u05E6\u05D9 Excel (.xlsx, .xls) \u05DE\u05D5\u05EA\u05E8\u05D9\u05DD'));
    }
  },
});

router.get('/', requireAuth(['מנהל']), tenantController.getTenants);
router.get('/:id', requireAuth(['מנהל']), tenantController.getTenantById);
router.post('/', requireAuth(['מנהל']), tenantController.createTenant);
router.put('/:id', requireAuth(['מנהל']), tenantController.updateTenant);

// Room management routes
// IMPORTANT: /import must be BEFORE /:roomId to prevent Express treating "import" as a roomId
router.get('/:id/rooms', requireAuth(['מנהל']), tenantController.getRooms);
router.post('/:id/rooms/import', requireAuth(['מנהל']), roomUpload.single('file'), tenantController.importRooms);
router.post('/:id/rooms', requireAuth(['מנהל']), tenantController.addRoom);
router.put('/:id/rooms/:roomId', requireAuth(['מנהל']), tenantController.updateRoom);
router.put('/:id/rooms/:roomId/deactivate', requireAuth(['מנהל']), tenantController.deactivateRoom);

export default router;
