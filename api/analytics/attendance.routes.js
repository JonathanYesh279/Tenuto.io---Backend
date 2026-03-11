import express from 'express';
import { attendanceAnalyticsController } from './attendance.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Student attendance analytics
 * GET /api/analytics/students/:studentId/attendance
 * Query params: includePrivateLessons, includeTheory, includeRehearsal, includeOrchestra, startDate, endDate, compareWithPrevious
 */
router.get('/students/:studentId/attendance', requirePermission('students', 'view'), attendanceAnalyticsController.getStudentAttendanceStats);

/**
 * Teacher attendance analytics
 * GET /api/analytics/teachers/:teacherId/attendance
 * Query params: startDate, endDate, includeStudentBreakdown, includeTimeAnalysis
 */
router.get('/teachers/:teacherId/attendance', requirePermission('reports', 'view'), attendanceAnalyticsController.getTeacherAttendanceAnalytics);

/**
 * Overall system attendance report
 * GET /api/analytics/attendance/overall
 * Query params: startDate, endDate, includeComparisons, groupBy
 */
router.get('/attendance/overall', requirePermission('reports', 'view'), attendanceAnalyticsController.getOverallAttendanceReport);

/**
 * Bulk absence counts for all students (current school year)
 * GET /api/analytics/attendance/bulk-absence-counts
 */
router.get('/attendance/bulk-absence-counts', requirePermission('students', 'view'), attendanceAnalyticsController.getBulkAbsenceCounts);

/**
 * Attendance trends analysis
 * GET /api/analytics/attendance/trends
 * Query params: period, activityType, teacherId, studentId
 */
router.get('/attendance/trends', requirePermission('reports', 'view'), attendanceAnalyticsController.getAttendanceTrends);

/**
 * Attendance comparison
 * POST /api/analytics/attendance/compare
 * Body: { type, baseline, comparison, metric }
 */
router.post('/attendance/compare', requirePermission('reports', 'view'), attendanceAnalyticsController.getAttendanceComparison);

/**
 * Generate insights for student or teacher
 * GET /api/analytics/:entityType/:entityId/insights
 * Path params: entityType (student|teacher), entityId
 * Query params: various options
 */
router.get('/:entityType/:entityId/insights', requirePermission('reports', 'view'), attendanceAnalyticsController.generateAttendanceInsights);

/**
 * Export attendance report
 * POST /api/analytics/attendance/export
 * Body: { format, scope, entityId, startDate, endDate, includeDetails }
 */
router.post('/attendance/export', requirePermission('reports', 'export'), attendanceAnalyticsController.exportAttendanceReport);

export default router;