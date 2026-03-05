import express from 'express'
import { orchestraController } from './orchestra.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js';
import { validateRoomExists } from '../../middleware/roomValidation.js';

const router = express.Router()

router.get('/', requirePermission('orchestras', 'view'), orchestraController.getOrchestras)
router.get('/:id', requirePermission('orchestras', 'view'), orchestraController.getOrchestraById)

router.post('/', requirePermission('orchestras', 'create'), validateRoomExists, orchestraController.addOrchestra)
router.put('/:id', requirePermission('orchestras', 'update'), validateRoomExists, orchestraController.updateOrchestra)
router.delete('/:id', requirePermission('orchestras', 'delete'), orchestraController.removeOrchestra)

router.post('/:id/members', requirePermission('orchestras', 'update'), orchestraController.addMember)
router.delete('/:id/members/:studentId', requirePermission('orchestras', 'update'), orchestraController.removeMember)

router.get('/:id/rehearsals/:rehearsalId/attendance', requirePermission('rehearsals', 'view'), orchestraController.getRehearsalAttendance)
router.put('/:id/rehearsals/:rehearsalId/attendance', requirePermission('rehearsals', 'update'), orchestraController.updateRehearsalAttendance)

router.get('/:orchestraId/student/:studentId/attendance', requirePermission('orchestras', 'view'), orchestraController.getStudentAttendanceStats)

export default router