import express from 'express';
import { theoryController } from './theory.controller.js';
import { requirePermission } from '../../middleware/auth.middleware.js';
import {
  validateBulkCreate,
  validateSingleCreate,
  validateUpdate,
  validateObjectId
} from '../../middleware/theoryValidation.js';
import {
  validateLessonDate,
  validateBulkLessonDates,
  validateAttendanceDate
} from '../../middleware/dateValidation.js';
import {
  formatLessonResponse,
  formatAttendanceResponse
} from '../../middleware/responseFormatterMiddleware.js';
import {
  monitorLessonOperations,
  monitorBulkOperations,
  monitorAttendanceOperations,
  monitorValidationErrors
} from '../../middleware/dateMonitoringMiddleware.js';
import {
  addToastHelpers,
  errorWithToast,
  theoryLessonErrorHandler
} from '../../middleware/toastNotificationMiddleware.js';

const router = express.Router();

// Add toast helpers to all routes
router.use(addToastHelpers);

// GET routes - All authenticated users with theory view permission
router.get('/', requirePermission('theory', 'view'), formatLessonResponse(), theoryController.getTheoryLessons);
router.get('/category/:category', requirePermission('theory', 'view'), formatLessonResponse(), theoryController.getTheoryLessonsByCategory);
router.get('/teacher/:teacherId', requirePermission('theory', 'view'), formatLessonResponse(), theoryController.getTheoryLessonsByTeacher);
router.get('/student/:studentId/stats', requirePermission('theory', 'view'), formatAttendanceResponse(), theoryController.getStudentTheoryAttendanceStats);
router.get('/:id', requirePermission('theory', 'view'), formatLessonResponse(), theoryController.getTheoryLessonById);
router.get('/:id/attendance', requirePermission('theory', 'view'), formatAttendanceResponse(), theoryController.getTheoryAttendance);

// POST routes - Only users with theory create permission
router.post('/', requirePermission('theory', 'create'), monitorValidationErrors, validateLessonDate, ...validateSingleCreate, monitorLessonOperations, theoryController.addTheoryLesson);
router.post('/bulk-create', requirePermission('theory', 'create'), monitorValidationErrors, validateBulkLessonDates, ...validateBulkCreate, monitorBulkOperations, theoryController.bulkCreateTheoryLessons);
router.post('/:id/student', requirePermission('theory', 'create'), validateObjectId('id'), theoryController.addStudentToTheory);

// PUT routes - Only users with theory update permission
router.put('/:id', requirePermission('theory', 'update'), monitorValidationErrors, ...validateUpdate, monitorLessonOperations, theoryController.updateTheoryLesson);
router.put('/:id/attendance', requirePermission('theory', 'update'), monitorValidationErrors, validateObjectId('id'), validateAttendanceDate, monitorAttendanceOperations, theoryController.updateTheoryAttendance);

// DELETE routes - Only users with theory delete permission
router.delete('/bulk-delete-by-date', requirePermission('theory', 'delete'), theoryController.bulkDeleteTheoryLessonsByDate);
router.delete('/bulk-delete-by-category/:category', requirePermission('theory', 'delete'), theoryController.bulkDeleteTheoryLessonsByCategory);
router.delete('/bulk-delete-by-teacher/:teacherId', requirePermission('theory', 'delete'), validateObjectId('teacherId'), theoryController.bulkDeleteTheoryLessonsByTeacher);
router.delete('/:id', requirePermission('theory', 'delete'), validateObjectId('id'), theoryController.removeTheoryLesson);
router.delete('/:id/student/:studentId', requirePermission('theory', 'delete'), validateObjectId('id'), validateObjectId('studentId'), theoryController.removeStudentFromTheory);

// Error handling middleware - must be last
router.use(theoryLessonErrorHandler);
router.use(errorWithToast);

export default router;