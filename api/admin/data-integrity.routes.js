/**
 * Data Integrity Routes
 * Admin endpoints for validating, repairing, and monitoring data integrity
 * Comprehensive data health management for the conservatory system
 */

import express from 'express';
import { requirePermission } from '../../middleware/auth.middleware.js';
import { dataIntegrityController } from './data-integrity.controller.js';
import {
  integrityValidationSchema,
  integrityRepairSchema,
  integrityReportSchema,
  orphanedStudentsQuerySchema,
  validateDataIntegrity,
  validateIntegrityQueryParams,
  validateRepairContext
} from './data-integrity.validation.js';

const router = express.Router();

/**
 * GET /api/admin/integrity/validate
 * Run comprehensive data integrity validation across collections
 */
router.get(
  '/validate',
  requirePermission('settings', 'view'),
  validateIntegrityQueryParams(integrityValidationSchema),
  dataIntegrityController.validateIntegrity
);

/**
 * POST /api/admin/integrity/repair
 * Repair data integrity issues with configurable strategies
 */
router.post(
  '/repair',
  requirePermission('settings', 'update'),
  validateDataIntegrity(integrityRepairSchema),
  validateRepairContext,
  dataIntegrityController.repairIntegrity
);

/**
 * GET /api/admin/integrity/report
 * Generate comprehensive integrity report with trends and insights
 */
router.get(
  '/report',
  requirePermission('settings', 'view'),
  validateIntegrityQueryParams(integrityReportSchema),
  dataIntegrityController.generateIntegrityReport
);

/**
 * GET /api/admin/integrity/orphaned-students
 * List students with orphaned references or missing relationships
 */
router.get(
  '/orphaned-students',
  requirePermission('settings', 'view'),
  validateIntegrityQueryParams(orphanedStudentsQuerySchema),
  dataIntegrityController.getOrphanedStudents
);

/**
 * GET /api/admin/integrity/health-check
 * Quick health check of critical system components
 */
router.get(
  '/health-check',
  requirePermission('settings', 'view'),
  dataIntegrityController.performHealthCheck
);

/**
 * GET /api/admin/integrity/collections/stats
 * Get detailed statistics for each collection
 */
router.get(
  '/collections/stats',
  requirePermission('settings', 'view'),
  dataIntegrityController.getCollectionStats
);

/**
 * POST /api/admin/integrity/constraints/validate
 * Validate business rule constraints across the system
 */
router.post(
  '/constraints/validate',
  requirePermission('settings', 'view'),
  dataIntegrityController.validateBusinessConstraints
);

export default router;
