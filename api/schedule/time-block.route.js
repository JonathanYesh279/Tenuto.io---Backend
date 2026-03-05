import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { timeBlockController } from './time-block.controller.js';

const router = express.Router();

// Time Block Management Routes

// POST create new time block for teacher
router.post(
  '/teacher/:teacherId/time-block',
  requirePermission('schedules', 'create'),
  timeBlockController.createTimeBlock
);

// PUT update existing time block
router.put(
  '/teacher/:teacherId/time-block/:blockId',
  requirePermission('schedules', 'update'),
  timeBlockController.updateTimeBlock
);

// DELETE time block
router.delete(
  '/teacher/:teacherId/time-block/:blockId',
  requirePermission('schedules', 'delete'),
  timeBlockController.deleteTimeBlock
);

// GET all time blocks for teacher
router.get(
  '/teacher/:teacherId/time-blocks',
  requirePermission('schedules', 'view'),
  timeBlockController.getTeacherTimeBlocks
);

// GET teacher's complete schedule with time blocks
router.get(
  '/teacher/:teacherId/schedule-with-blocks',
  requirePermission('schedules', 'view'),
  timeBlockController.getTeacherScheduleWithBlocks
);

// Lesson Slot Management Routes

// GET available lesson slots for specific duration
router.get(
  '/teacher/:teacherId/available-slots',
  requirePermission('schedules', 'view'),
  timeBlockController.getAvailableSlots
);

// POST find optimal lesson slot for student preferences
router.post(
  '/teacher/:teacherId/find-optimal-slot',
  requirePermission('schedules', 'view'),
  timeBlockController.findOptimalSlot
);

// POST assign lesson to time block
router.post(
  '/assign-lesson',
  requirePermission('schedules', 'create'),
  timeBlockController.assignLessonToBlock
);

// DELETE remove lesson from time block
router.delete(
  '/lesson/:teacherId/:timeBlockId/:lessonId',
  requirePermission('schedules', 'delete'),
  timeBlockController.removeLessonFromBlock
);

// Advanced Scheduling Routes

// POST get lesson options across multiple teachers
router.post(
  '/lesson-options',
  requirePermission('schedules', 'view'),
  timeBlockController.getLessonScheduleOptions
);

// Analytics and Statistics Routes

// GET block utilization statistics for teacher
router.get(
  '/teacher/:teacherId/utilization-stats',
  requirePermission('schedules', 'view'),
  timeBlockController.getBlockUtilizationStats
);

export default router;
