/**
 * Past Activities Routes
 * Admin endpoints for viewing past rehearsals, theory lessons, and private lessons
 */

import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { pastActivitiesController } from './past-activities.controller.js';
import {
  validatePastActivitiesQuery,
  validatePastActivitiesByType
} from '../../middleware/pastActivitiesValidation.js';
import {
  formatLessonResponse,
  formatAttendanceResponse
} from '../../middleware/responseFormatterMiddleware.js';

const router = express.Router();

/**
 * GET /api/admin/past-activities - Get all past activities with filtering
 */
router.get('/', requirePermission('reports', 'view'), validatePastActivitiesQuery, pastActivitiesController.getPastActivities);

/**
 * GET /api/admin/past-activities/:type - Get past activities by specific type
 */
router.get('/:type', requirePermission('reports', 'view'), validatePastActivitiesByType, pastActivitiesController.getPastActivitiesByType);

export default router;
