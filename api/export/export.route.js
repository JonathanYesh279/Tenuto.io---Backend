import express from 'express';
import { exportController } from './export.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Completion status — how much data is filled for Ministry reporting
router.get('/status', requirePermission('reports', 'view'), exportController.getCompletionStatus);

// Cross-validation — check hours consistency across sheets
router.get('/validate', requirePermission('reports', 'view'), exportController.crossValidate);

// Download full Ministry report package (6-sheet Excel)
router.get('/download', requirePermission('reports', 'export'), exportController.downloadFullReport);

export default router;
