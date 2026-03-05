import express from 'express';
import multer from 'multer';
import { importController } from './import.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Dedicated multer for import: memory-only (file parsed then discarded)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('רק קבצי Excel (.xlsx, .xls) מותרים'));
    }
  },
});

// Preview (dry run) — upload, parse, match, show changes
router.post(
  '/teachers/preview',
  requirePermission('settings', 'update'),
  importUpload.single('file'),
  importController.previewTeacherImport
);

router.post(
  '/students/preview',
  requirePermission('settings', 'update'),
  importUpload.single('file'),
  importController.previewStudentImport
);

// Conservatory profile preview (form-style Excel, not tabular)
router.post(
  '/conservatory/preview',
  requirePermission('settings', 'update'),
  importUpload.single('file'),
  importController.previewConservatoryImport
);

// Ensemble preview (tabular sheet with cell color detection)
router.post(
  '/ensembles/preview',
  requirePermission('settings', 'update'),
  importUpload.single('file'),
  importController.previewEnsembleImport
);

// Execute — apply the previewed import by importLogId
router.post(
  '/execute/:importLogId',
  requirePermission('settings', 'update'),
  importController.executeImport
);

// Repair already-imported teachers with missing/null properties
router.post(
  '/repair-imported-teachers',
  requirePermission('settings', 'update'),
  importController.repairImportedTeachers
);

export default router;
