import express from 'express'
import { bagrutController } from './bagrut.controller.js'
import { requirePermission } from '../../middleware/auth.middleware.js'
import { authorizeBagrutAccess } from '../../middleware/bagrut.middleware.js'
import { uploadSingleFile } from '../../middleware/file.middleware.js'

const router = express.Router()

// Bagrut routes
router.get('/', requirePermission('students', 'view'), bagrutController.getBagruts)
router.get('/:id', requirePermission('students', 'view'), authorizeBagrutAccess, bagrutController.getBagrutById)
router.get('/student/:studentId', requirePermission('students', 'view'), bagrutController.getBagrutByStudentId)

// Add new bagrut
router.post('/', requirePermission('students', 'create'), bagrutController.addBagrut)
// Update bagrut
router.put('/:id', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updateBagrut)
// Delete bagrut
router.delete('/:id', requirePermission('students', 'delete'), authorizeBagrutAccess, bagrutController.removeBagrut)

// Update speficic presentation
router.put('/:id/presentation/:presentationIndex', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updatePresentation)

// Magen Bagrut routes
router.put('/:id/magenBagrut', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updateMagenBagrut)

// New grading system routes
router.put('/:id/gradingDetails', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updateGradingDetails)
router.put('/:id/calculateFinalGrade', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.calculateFinalGrade)
router.put('/:id/complete', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.completeBagrut)

// Director evaluation and recital configuration routes
router.put('/:id/directorEvaluation', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updateDirectorEvaluation)
router.put('/:id/recitalConfiguration', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.setRecitalConfiguration)

// Document routes
router.post('/:id/document', requirePermission('students', 'update'), authorizeBagrutAccess, uploadSingleFile('document'), bagrutController.addDocument)
router.delete('/:id/document/:documentId', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.removeDocument)

// Program routes
router.post('/:id/program', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.addProgramPiece)
router.put('/:id/program', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.updateProgram)
router.delete('/:id/program/:pieceId', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.removeProgramPiece)

// Accompanist routes
router.post('/:id/accompanist', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.addAccompanist)
router.delete('/:id/accompanist/:accompanistId', requirePermission('students', 'update'), authorizeBagrutAccess, bagrutController.removeAccompanist)

export default router