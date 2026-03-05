import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { scheduleController } from './schedule.controller.js';
import timeBlockRoutes from './time-block.route.js';

const router = express.Router();

// POST repair all relationships (admin only)
router.post(
  '/repair',
  requirePermission('schedules', 'update'),
  scheduleController.repairRelationships
);

// GET validate schedule integrity (admin only)
router.get(
  '/validate',
  requirePermission('schedules', 'view'),
  scheduleController.validateIntegrity
);

// POST assign student to teacher (without schedule)
router.post(
  '/teacher/:teacherId/assign-student',
  requirePermission('schedules', 'create'),
  scheduleController.assignStudentToTeacher
);

// DELETE remove student from teacher
router.delete(
  '/teacher/:teacherId/students/:studentId',
  requirePermission('schedules', 'delete'),
  scheduleController.removeStudentFromTeacher
);

// Migration routes (admin only)
router.post(
  '/migrate-to-time-blocks',
  requirePermission('settings', 'update'),
  scheduleController.migrateToTimeBlocks
);

router.post(
  '/migration-backup',
  requirePermission('settings', 'update'),
  scheduleController.createMigrationBackup
);

router.post(
  '/rollback-migration',
  requirePermission('settings', 'update'),
  scheduleController.rollbackTimeBlockMigration
);

router.get(
  '/migration-report',
  requirePermission('settings', 'view'),
  scheduleController.getMigrationReport
);

// Mount time block routes
router.use('/time-blocks', timeBlockRoutes);

export default router;
