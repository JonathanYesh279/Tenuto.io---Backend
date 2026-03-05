/**
 * Date Monitoring Routes
 * Admin endpoints for monitoring date operations and system health
 */

import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { dateMonitoringController } from './date-monitoring.controller.js';

const router = express.Router();

// GET routes — admin-only view operations
router.get('/metrics', requirePermission('settings', 'view'), dateMonitoringController.getMetrics);
router.get('/report', requirePermission('settings', 'view'), dateMonitoringController.getMonitoringReport);
router.get('/database-health', requirePermission('settings', 'view'), dateMonitoringController.getDatabaseHealth);
router.get('/status', requirePermission('settings', 'view'), dateMonitoringController.getSystemStatus);
router.get('/health-check', requirePermission('settings', 'view'), dateMonitoringController.runHealthCheck);
router.get('/alerts', requirePermission('settings', 'view'), dateMonitoringController.getAlerts);
router.get('/export', requirePermission('settings', 'view'), dateMonitoringController.exportData);

// PUT routes — admin-only update operations
router.put('/alerts/:alertId/acknowledge', requirePermission('settings', 'update'), dateMonitoringController.acknowledgeAlert);

// DELETE routes — uses 'settings.update' (NOT 'settings.delete' which is an invalid action)
router.delete('/cleanup', requirePermission('settings', 'update'), dateMonitoringController.clearOldData);

export default router;
