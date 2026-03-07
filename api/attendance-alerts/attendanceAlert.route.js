import express from 'express';
import { attendanceAlertController } from './attendanceAlert.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Tenant alert settings
router.get('/settings', requirePermission('settings', 'view'), attendanceAlertController.getAlertSettings);

// Flagged students for a specific orchestra
router.get('/orchestra/:orchestraId/flagged', requirePermission('orchestras', 'view'), attendanceAlertController.getFlaggedStudents);

// Admin attendance dashboard
router.get('/dashboard', requirePermission('reports', 'view'), attendanceAlertController.getDashboard);

// Student attendance summary
router.get('/student/:studentId/summary', requirePermission('students', 'view'), attendanceAlertController.getStudentSummary);

export default router;
