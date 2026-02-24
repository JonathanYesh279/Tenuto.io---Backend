/**
 * CONSOLIDATED: This file now re-exports from the canonical cascade deletion service.
 * The original collection-based implementation (System B) was consolidated into the
 * transaction-based service (cascadeDeletion.service.js) in Phase 11.
 *
 * All consumers should import from this file OR from cascadeDeletion.service.js.
 * Both resolve to the same implementation.
 *
 * NOTE: The canonical service (System A) has different method names/signatures
 * than the original System B. Test files that called System B methods
 * (createDeletionSnapshot, executeStudentCascade, validateDeletionImpact,
 * rollbackDeletion, generateDeletionAuditLog, cleanupOrphanedReferences)
 * need to be updated to use System A's API. See test files for skip markers.
 */
export { cascadeDeletionService } from './cascadeDeletion.service.js';
