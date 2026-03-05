import express from 'express'
import { studentController } from './student.controller.js'
import { attendanceController } from '../schedule/attendance.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'
import { validateTeacherAssignmentsMiddleware } from './student-assignments.validation.js'

const router = express.Router()

router.get('/', requirePermission('students', 'view'), studentController.getStudents)
router.get('/:id', requirePermission('students', 'view'), studentController.getStudentById)
router.get('/:studentId/private-lesson-attendance', requirePermission('students', 'view'), attendanceController.getStudentPrivateLessonStats)
router.get('/:studentId/attendance-history', requirePermission('students', 'view'), attendanceController.getStudentAttendanceHistory)

router.post('/', requirePermission('students', 'create'), validateTeacherAssignmentsMiddleware, studentController.addStudent);
router.put('/:id', requirePermission('students', 'update'), validateTeacherAssignmentsMiddleware, studentController.updateStudent)
router.put('/:id/test', requirePermission('students', 'update'), studentController.updateStudentTest)
router.patch('/:id/stage-level', requirePermission('students', 'update'), studentController.updateStudentStageLevel)
router.delete('/:id', requirePermission('students', 'delete'), studentController.removeStudent)

export default router