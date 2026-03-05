import express from 'express';
import { hoursSummaryController } from './hours-summary.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Get all cached hours summaries for current tenant/school-year (admin only)
router.get('/', requirePermission('reports', 'view'), hoursSummaryController.getHoursSummary);

// Get cached hours summary for a specific teacher (teacher self-view uses 'schedules' domain)
router.get('/teacher/:teacherId', requirePermission('schedules', 'view'), hoursSummaryController.getTeacherHours);

// (Re)calculate hours for a specific teacher (admin only)
router.post('/calculate/:teacherId', requirePermission('reports', 'view'), hoursSummaryController.calculateTeacherHours);

// (Re)calculate hours for all teachers in tenant (admin only)
router.post('/calculate', requirePermission('reports', 'view'), hoursSummaryController.calculateAllHours);

export default router;
