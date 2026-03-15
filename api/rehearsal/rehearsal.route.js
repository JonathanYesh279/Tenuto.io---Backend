import express from 'express'
import { rehearsalController } from './rehearsal.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'
import {
  formatRehearsalResponse,
  formatAttendanceResponse
} from '../../middleware/responseFormatterMiddleware.js'
import { validateRoomExists } from '../../middleware/roomValidation.js'

const router = express.Router()

router.get('/', requirePermission('rehearsals', 'view'), formatRehearsalResponse(), rehearsalController.getRehearsals)
router.get('/orchestra/:orchestraId', requirePermission('rehearsals', 'view'), formatRehearsalResponse(), rehearsalController.getOrchestraRehearsals)
router.get('/:id', requirePermission('rehearsals', 'view'), formatRehearsalResponse(), rehearsalController.getRehearsalById)

router.post('/', requirePermission('rehearsals', 'create'), validateRoomExists, rehearsalController.addRehearsal)
router.put('/:id', requirePermission('rehearsals', 'update'), validateRoomExists, rehearsalController.updateRehearsal)
router.delete('/:id/pattern', requirePermission('rehearsals', 'delete'), rehearsalController.removeRehearsalPattern)
router.delete('/:id', requirePermission('rehearsals', 'delete'), rehearsalController.removeRehearsal)

router.put('/:rehearsalId/attendance', requirePermission('rehearsals', 'update'), formatAttendanceResponse(), rehearsalController.updateAttendance)

router.post('/bulk', requirePermission('rehearsals', 'create'), rehearsalController.bulkCreateRehearsals)
router.delete('/orchestra/:orchestraId', requirePermission('rehearsals', 'delete'), rehearsalController.bulkDeleteRehearsalsByOrchestra)
router.delete('/orchestra/:orchestraId/date-range', requirePermission('rehearsals', 'delete'), rehearsalController.bulkDeleteRehearsalsByDateRange)
router.put('/orchestra/:orchestraId', requirePermission('rehearsals', 'update'), rehearsalController.bulkUpdateRehearsalsByOrchestra)

export default router