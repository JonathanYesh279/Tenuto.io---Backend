import express from 'express'
import { teacherController } from './teacher.controller.js'
import { invitationController } from './invitation.controller.js'
import { attendanceController } from '../schedule/attendance.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requirePermission('teachers', 'view'), teacherController.getTeachers)
router.get('/profile/me', requirePermission('teachers', 'view'), teacherController.getMyProfile)
router.put('/profile/me', requirePermission('teachers', 'update'), teacherController.updateMyProfile)
router.get('/debug/ids', requirePermission('teachers', 'view'), teacherController.getTeacherIds)

// New lesson endpoints (single source of truth approach)
router.get('/:teacherId/lessons', requirePermission('schedules', 'view'), teacherController.getTeacherLessons)
router.get('/:teacherId/weekly-schedule', requirePermission('schedules', 'view'), teacherController.getTeacherWeeklySchedule)
router.get('/:teacherId/day-schedule/:day', requirePermission('schedules', 'view'), teacherController.getTeacherDaySchedule)
router.get('/:teacherId/lesson-stats', requirePermission('schedules', 'view'), teacherController.getTeacherLessonStats)
router.get('/:teacherId/students-with-lessons', requirePermission('schedules', 'view'), teacherController.getTeacherStudentsWithLessons)
router.get('/:teacherId/validate-lessons', requirePermission('schedules', 'view'), teacherController.validateTeacherLessonData)
router.get('/:teacherId/lesson-attendance-summary', requirePermission('schedules', 'view'), attendanceController.getTeacherAttendanceOverview)

router.get('/:id', requirePermission('teachers', 'view'), teacherController.getTeacherById)
router.get('/role/:role', requirePermission('teachers', 'view'), teacherController.getTeacherByRole)

router.post('/', requirePermission('teachers', 'create'), teacherController.addTeacher)
router.post('/:id/schedule', requirePermission('schedules', 'update'), teacherController.updateTeacherSchedule)
router.put('/:id/roles', requirePermission('roles', 'assign'), teacherController.updateTeacherRoles)
router.put('/:id', requirePermission('teachers', 'update'), teacherController.updateTeacher)
router.delete('/:id', requirePermission('teachers', 'delete'), teacherController.removeTeacher)

// Student management routes
router.post('/:teacherId/student/:studentId', requirePermission('teachers', 'update'), teacherController.addStudentToTeacher)
router.delete('/:teacherId/student/:studentId', requirePermission('teachers', 'update'), teacherController.removeStudentFromTeacher)

// Time block management routes
router.get('/:teacherId/time-blocks', requirePermission('schedules', 'view'), teacherController.getTimeBlocks)
router.post('/:teacherId/time-block', requirePermission('schedules', 'create'), teacherController.createTimeBlock)
router.put('/:teacherId/time-block/:timeBlockId', requirePermission('schedules', 'update'), teacherController.updateTimeBlock)
router.delete('/:teacherId/time-block/:timeBlockId', requirePermission('schedules', 'delete'), teacherController.deleteTimeBlock)

// Invitation routes
router.get('/invitation/validate/:token', invitationController.validateInvitation)
router.post('/invitation/accept/:token', invitationController.acceptInvitation)
router.post('/invitation/resend/:teacherId', requirePermission('teachers', 'create'), invitationController.resendInvitation)

export default router
