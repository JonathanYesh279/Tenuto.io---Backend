import express from 'express';
import { exportController } from './export.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Completion status — how much data is filled for Ministry reporting
router.get('/status', requireAuth(['מנהל']), exportController.getCompletionStatus);

// Cross-validation — check hours consistency across sheets
router.get('/validate', requireAuth(['מנהל']), exportController.crossValidate);

// Download full Ministry report package (6-sheet Excel)
router.get('/download', requireAuth(['מנהל']), exportController.downloadFullReport);

export default router;
