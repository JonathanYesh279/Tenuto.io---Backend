import express from 'express';
import { reportController } from './report.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Get available reports catalog filtered by user role
router.get('/registry', requirePermission('reports', 'view'), reportController.getRegistry);

// Generate a specific report with params
router.get('/:reportId', requirePermission('reports', 'view'), reportController.getReport);

export default router;
