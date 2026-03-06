import express from 'express';
import { attendanceController } from './attendance.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Get student's private lesson attendance stats
 * GET /api/attendance/students/:studentId/private-lesson-attendance
 */
router.get('/students/:studentId/private-lesson-attendance', requirePermission('students', 'view'), attendanceController.getStudentPrivateLessonStats);

/**
 * Get student's attendance history
 * GET /api/attendance/students/:studentId/attendance-history
 */
router.get('/students/:studentId/attendance-history', requirePermission('students', 'view'), attendanceController.getStudentAttendanceHistory);

/**
 * Get teacher's attendance overview
 * GET /api/attendance/teachers/:teacherId/lesson-attendance-summary
 */
router.get('/teachers/:teacherId/lesson-attendance-summary', requirePermission('schedules', 'view'), attendanceController.getTeacherAttendanceOverview);

export default router;
