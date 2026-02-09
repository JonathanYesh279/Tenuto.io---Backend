import express from 'express';
import { hoursSummaryController } from './hours-summary.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Get all cached hours summaries for current tenant/school-year
router.get('/', requireAuth(['מנהל']), hoursSummaryController.getHoursSummary);

// Get cached hours summary for a specific teacher
router.get('/teacher/:teacherId', requireAuth(['מנהל', 'מורה']), hoursSummaryController.getTeacherHours);

// (Re)calculate hours for a specific teacher
router.post('/calculate/:teacherId', requireAuth(['מנהל']), hoursSummaryController.calculateTeacherHours);

// (Re)calculate hours for all teachers in tenant
router.post('/calculate', requireAuth(['מנהל']), hoursSummaryController.calculateAllHours);

export default router;
