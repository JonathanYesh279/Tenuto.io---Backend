import express from 'express';
import multer from 'multer';
import { importController } from './import.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

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
  requireAuth(['מנהל']),
  importUpload.single('file'),
  importController.previewTeacherImport
);

router.post(
  '/students/preview',
  requireAuth(['מנהל']),
  importUpload.single('file'),
  importController.previewStudentImport
);

// Execute — apply the previewed import by importLogId
router.post(
  '/execute/:importLogId',
  requireAuth(['מנהל']),
  importController.executeImport
);

export default router;
