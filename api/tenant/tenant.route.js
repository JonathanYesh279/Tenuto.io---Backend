import { Router } from 'express';
import multer from 'multer';
import { tenantController } from './tenant.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

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

// Multer config for logo upload (memory-only, 2MB max, PNG/JPG only)
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
      cb(null, true);
    } else {
      cb(new Error('\u05E8\u05E7 \u05E7\u05D1\u05E6\u05D9 PNG/JPG \u05DE\u05D5\u05EA\u05E8\u05D9\u05DD'));
    }
  },
});

router.get('/', requirePermission('settings', 'view'), tenantController.getTenants);
router.get('/:id', requirePermission('settings', 'view'), tenantController.getTenantById);
router.post('/', requirePermission('settings', 'update'), tenantController.createTenant);
router.put('/:id', requirePermission('settings', 'update'), tenantController.updateTenant);

// Logo upload
router.post('/:id/logo', requirePermission('settings', 'update'), logoUpload.single('logo'), tenantController.uploadLogo);
router.delete('/:id/logo', requirePermission('settings', 'update'), tenantController.deleteLogo);

// Room management routes
// IMPORTANT: /import must be BEFORE /:roomId to prevent Express treating "import" as a roomId
router.get('/:id/rooms', requirePermission('settings', 'view'), tenantController.getRooms);
router.post('/:id/rooms/import', requirePermission('settings', 'update'), roomUpload.single('file'), tenantController.importRooms);
router.post('/:id/rooms', requirePermission('settings', 'update'), tenantController.addRoom);
router.put('/:id/rooms/:roomId', requirePermission('settings', 'update'), tenantController.updateRoom);
router.put('/:id/rooms/:roomId/deactivate', requirePermission('settings', 'update'), tenantController.deactivateRoom);
router.delete('/:id/rooms/:roomId', requirePermission('settings', 'update'), tenantController.deleteRoom);

export default router;
