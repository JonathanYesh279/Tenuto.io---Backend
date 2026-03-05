/**
 * Cascade Deletion Routes
 * Admin endpoints for managing cascade deletions with data integrity
 * Includes preview, execution, cleanup, rollback, and audit capabilities
 */

import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { cascadeDeletionController } from './cascade-deletion.controller.js';
import {
  cascadeDeletionPreviewSchema,
  cascadeDeletionExecuteSchema,
  orphanedCleanupSchema,
  rollbackDeletionSchema,
  auditLogQuerySchema,
  validateCascadeDeletion,
  validateQueryParams,
  validatePathParams
} from './cascade-deletion.validation.js';

const router = express.Router();

/**
 * POST /api/admin/student/:studentId/deletion-preview
 * Preview the impact of cascading deletion before execution
 */
router.post(
  '/student/:studentId/deletion-preview',
  requirePermission('settings', 'view'),
  validatePathParams,
  validateCascadeDeletion(cascadeDeletionPreviewSchema),
  cascadeDeletionController.previewCascadeDeletion
);

/**
 * DELETE /api/admin/student/:studentId/cascade
 * Execute cascade deletion of student and all related records
 * Uses 'settings.update' (NOT 'settings.delete' which is an invalid action)
 */
router.delete(
  '/student/:studentId/cascade',
  requirePermission('settings', 'update'),
  validatePathParams,
  validateCascadeDeletion(cascadeDeletionExecuteSchema),
  cascadeDeletionController.executeCascadeDeletion
);

/**
 * POST /api/admin/cleanup/orphaned-references
 * Clean up orphaned references across collections
 */
router.post(
  '/cleanup/orphaned-references',
  requirePermission('settings', 'update'),
  validateCascadeDeletion(orphanedCleanupSchema),
  cascadeDeletionController.cleanupOrphanedReferences
);

/**
 * POST /api/admin/deletion/rollback/:snapshotId
 * Rollback a previous cascade deletion using snapshot
 */
router.post(
  '/deletion/rollback/:snapshotId',
  requirePermission('settings', 'update'),
  validatePathParams,
  validateCascadeDeletion(rollbackDeletionSchema),
  cascadeDeletionController.rollbackDeletion
);

/**
 * GET /api/admin/deletion/audit-log
 * Get deletion history and audit log
 */
router.get(
  '/deletion/audit-log',
  requirePermission('settings', 'view'),
  validateQueryParams(auditLogQuerySchema),
  cascadeDeletionController.getAuditLog
);

/**
 * GET /api/admin/deletion/snapshots
 * Get available snapshots for rollback
 */
router.get(
  '/deletion/snapshots',
  requirePermission('settings', 'view'),
  cascadeDeletionController.getAvailableSnapshots
);

/**
 * GET /api/admin/deletion/operations
 * Get currently running deletion operations
 */
router.get(
  '/deletion/operations',
  requirePermission('settings', 'view'),
  cascadeDeletionController.getRunningOperations
);

/**
 * POST /api/admin/deletion/operations/:operationId/cancel
 * Cancel a running deletion operation
 */
router.post(
  '/deletion/operations/:operationId/cancel',
  requirePermission('settings', 'update'),
  cascadeDeletionController.cancelOperation
);

export default router;
