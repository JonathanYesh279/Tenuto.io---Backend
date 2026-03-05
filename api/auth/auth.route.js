import express from 'express'
import rateLimit from 'express-rate-limit'
import { authController } from './auth.controller.js'
import { authenticateToken, requirePermission } from '../../middleware/auth.middleware.js'
import { buildContext } from '../../middleware/tenant.middleware.js'

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 20, // More attempts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 5 minutes' }
})

// Init-admin — ONLY available in non-production environments
// Self-protecting (rejects if admin exists), but creates predictable credentials — must not be reachable in production.
if (process.env.NODE_ENV !== 'production') {
  router.post('/init-admin', authController.initAdmin);
}

// Admin-only routes — chain authenticateToken + buildContext + requirePermission
// (buildContext needed because /api/auth is mounted without it in server.js)
router.post('/migrate-users', authenticateToken, buildContext, requirePermission('settings', 'update'), authController.migrateExistingUsers);
router.post('/migrate-invitations', authenticateToken, buildContext, requirePermission('settings', 'update'), authController.migratePendingInvitations);
router.get('/invitation-stats', authenticateToken, buildContext, requirePermission('settings', 'view'), authController.getInvitationModeStats);
router.get('/check-teacher/:email', authenticateToken, buildContext, requirePermission('teachers', 'view'), authController.checkTeacherByEmail);
router.delete('/remove-teacher/:email', authenticateToken, buildContext, requirePermission('teachers', 'delete'), authController.removeTeacherByEmail);

// Public routes
router.post('/login', loginLimiter, authController.login)
router.get('/tenants', authController.getTenantsForEmail)
router.post('/refresh', authController.refresh)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)
router.post('/accept-invitation', authController.acceptInvitation)

// Protected routes
router.get('/validate', authenticateToken, authController.validateToken)
router.post('/logout', authenticateToken, authController.logout)
router.post('/change-password', authenticateToken, authController.changePassword)
router.post('/force-password-change', authenticateToken, authController.forcePasswordChange)

export default router
