import express from 'express'
import { cleanupController } from './cleanup.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'

const router = express.Router()

// All cleanup operations require admin privileges
router.get('/detect-inconsistencies', requirePermission('settings', 'view'), cleanupController.detectInconsistencies)
router.get('/report', requirePermission('settings', 'view'), cleanupController.generateReport)
router.post('/fix-all', requirePermission('settings', 'update'), cleanupController.fixAllInconsistencies)
router.post('/fix-relationship/:teacherId/:studentId', requirePermission('settings', 'update'), cleanupController.fixRelationship)
router.post('/fix-assignments/:studentId', requirePermission('settings', 'update'), cleanupController.fixOrphanedAssignments)
router.post('/fix-schedule/:studentId', requirePermission('settings', 'update'), cleanupController.fixOrphanedSchedule)

// Student deletion preview endpoint
router.post('/student/:studentId/deletion-preview', requirePermission('settings', 'view'), cleanupController.getStudentDeletionPreview)

export default router
