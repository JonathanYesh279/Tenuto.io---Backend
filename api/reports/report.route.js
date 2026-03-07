import express from 'express';
import { reportController } from './report.controller.js';
import { reportExportController } from './report.export.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Dashboard KPI overview
router.get('/dashboard', requirePermission('reports', 'view'), reportController.getDashboard);

// Get available reports catalog filtered by user role
router.get('/registry', requirePermission('reports', 'view'), reportController.getRegistry);

// Export routes — must come BEFORE /:reportId catch-all
router.get('/:reportId/export/excel', requirePermission('reports', 'view'), reportExportController.exportExcel);
router.get('/:reportId/export/pdf', requirePermission('reports', 'view'), reportExportController.exportPdf);

// Generate a specific report with params
router.get('/:reportId', requirePermission('reports', 'view'), reportController.getReport);

export default router;
