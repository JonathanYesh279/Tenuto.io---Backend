import express from 'express'
import { schoolYearController } from './school-year-controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Get routes — use 'schedules' domain (NOT 'settings') to allow teacher/conductor access
router.get('/', requirePermission('schedules', 'view'), schoolYearController.getSchoolYears)
router.get('/current', requirePermission('schedules', 'view'), schoolYearController.getCurrentSchoolYear)
router.get('/:id', requirePermission('schedules', 'view'), schoolYearController.getSchoolYearById)

// Write routes — admin only via locked 'settings' domain
router.post('/', requirePermission('settings', 'update'), schoolYearController.createSchoolYear)
router.put('/:id', requirePermission('settings', 'update'), schoolYearController.updateSchoolYear)
router.put('/:id/set-current', requirePermission('settings', 'update'), schoolYearController.setCurrentSchoolYear)
router.put('/:id/rollover', requirePermission('settings', 'update'), schoolYearController.rolloverToNewYear)

export default router
