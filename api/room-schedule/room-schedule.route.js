import express from 'express';
import { roomScheduleController } from './room-schedule.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

// GET / — admin-only room schedule aggregation view
router.get('/', requireAuth(['מנהל']), roomScheduleController.getRoomSchedule);

// PUT /move — admin-only move activity to different room/time slot
router.put('/move', requireAuth(['מנהל']), roomScheduleController.moveActivity);

export default router;
