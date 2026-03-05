import express from 'express';
import { roomScheduleController } from './room-schedule.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

// GET / — admin-only room schedule aggregation view
router.get('/', requirePermission('settings', 'view'), roomScheduleController.getRoomSchedule);

// PUT /move — admin-only move activity to different room/time slot
router.put('/move', requirePermission('settings', 'update'), roomScheduleController.moveActivity);

// PUT /reschedule-lesson — admin-only reschedule single lesson to different block/room/time
router.put('/reschedule-lesson', requirePermission('settings', 'update'), roomScheduleController.rescheduleLesson);

export default router;
