import express from 'express'
import { rehearsalController } from './rehearsal.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import {
  formatRehearsalResponse,
  formatAttendanceResponse
} from '../../middleware/responseFormatterMiddleware.js'
import { validateRoomExists } from '../../middleware/roomValidation.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), formatRehearsalResponse(), rehearsalController.getRehearsals)
router.get('/orchestra/:orchestraId', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), formatRehearsalResponse(), rehearsalController.getOrchestraRehearsals)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), formatRehearsalResponse(), rehearsalController.getRehearsalById)

router.post('/', requireAuth(['מנצח', 'מנהל']), validateRoomExists, rehearsalController.addRehearsal)
router.put('/:id', requireAuth(['מנצח', 'מנהל']), validateRoomExists, rehearsalController.updateRehearsal)
router.delete('/:id', requireAuth(['מנצח', 'מנהל']), rehearsalController.removeRehearsal)

router.put('/:rehearsalId/attendance', requireAuth(['מנצח', 'מנהל']), formatAttendanceResponse(), rehearsalController.updateAttendance)

router.post('/bulk', requireAuth(['מנהל', 'מנצח']), rehearsalController.bulkCreateRehearsals)
router.delete('/orchestra/:orchestraId', requireAuth(['מנהל', 'מנצח']), rehearsalController.bulkDeleteRehearsalsByOrchestra)
router.delete('/orchestra/:orchestraId/date-range', requireAuth(['מנהל', 'מנצח']), rehearsalController.bulkDeleteRehearsalsByDateRange)
router.put('/orchestra/:orchestraId', requireAuth(['מנהל', 'מנצח']), rehearsalController.bulkUpdateRehearsalsByOrchestra)

export default router