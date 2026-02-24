import { getCollection } from './mongoDB.service.js';
import { createLogger } from './logger.service.js';
import { COLLECTIONS, AUDIT_ACTIONS } from '../config/constants.js';

const log = createLogger('audit-trail');

export const auditTrailService = {
  logAction,
  getAuditLog,
  getAuditLogForTenant,
  logImpersonatedAction,
};

/**
 * Log a platform audit action. Defensive — catches errors internally
 * and logs them without throwing, so audit logging never breaks the main operation.
 *
 * @param {string} action - From AUDIT_ACTIONS enum
 * @param {string} actorId - Super admin _id (string)
 * @param {object} details - Additional details
 * @param {string} [details.targetType] - Target type (default: 'tenant')
 * @param {string} [details.targetId] - Target entity ID (e.g., tenantId)
 * @param {string} [details.ip] - Request IP address
 */
async function logAction(action, actorId, details = {}) {
  try {
    const collection = await getCollection(COLLECTIONS.PLATFORM_AUDIT_LOG);

    // Extract top-level fields and strip them from nested details
    const { targetType, targetId, ip, ...restDetails } = details;

    const entry = {
      action,
      actorId,
      actorType: 'super_admin',
      targetType: targetType || 'tenant',
      targetId: targetId || null,
      details: restDetails,
      timestamp: new Date(),
      ip: ip || null,
    };

    await collection.insertOne(entry);

    log.debug({ action, actorId, targetId: entry.targetId }, 'Audit entry logged');
  } catch (err) {
    // Audit logging failures must NOT throw — log the error and continue
    log.error({ err: err.message, action, actorId }, 'Failed to write audit log entry');
  }
}

/**
 * Query the platform audit log with optional filters.
 *
 * @param {object} [filters={}]
 * @param {string} [filters.targetId] - Filter by target entity (e.g., tenantId)
 * @param {string} [filters.action] - Filter by action type
 * @param {Date} [filters.startDate] - Start of date range
 * @param {Date} [filters.endDate] - End of date range
 * @param {number} [filters.limit=100] - Max results
 * @param {number} [filters.skip=0] - Offset for pagination
 * @returns {Promise<Array>} Audit log entries sorted by timestamp desc
 */
async function getAuditLog(filters = {}) {
  const collection = await getCollection(COLLECTIONS.PLATFORM_AUDIT_LOG);

  const query = {};

  if (filters.targetId) {
    query.targetId = filters.targetId;
  }

  if (filters.action) {
    query.action = filters.action;
  }

  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) {
      query.timestamp.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.timestamp.$lte = filters.endDate;
    }
  }

  const limit = filters.limit || 100;
  const skip = filters.skip || 0;

  return collection
    .find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/**
 * Convenience wrapper to get all audit log entries for a specific tenant.
 *
 * @param {string} tenantId
 * @param {object} [options={}] - Additional filter options (limit, skip, startDate, endDate)
 * @returns {Promise<Array>} Audit log entries for the tenant
 */
async function getAuditLogForTenant(tenantId, options = {}) {
  return getAuditLog({ ...options, targetId: tenantId });
}

/**
 * Log a mutating action performed during an impersonation session.
 * Defensive — catches errors internally; audit logging never breaks the main operation.
 *
 * @param {object} impersonationContext - req.impersonation (set by enrichImpersonationContext)
 * @param {object} req - Express request object
 */
async function logImpersonatedAction(impersonationContext, req) {
  try {
    const collection = await getCollection(COLLECTIONS.PLATFORM_AUDIT_LOG);
    const entry = {
      action: AUDIT_ACTIONS.IMPERSONATION_ACTION,
      actorId: impersonationContext.superAdminId,
      actorType: 'super_admin',
      targetType: 'impersonated_action',
      targetId: impersonationContext.impersonatedUserId,
      details: {
        sessionId: impersonationContext.sessionId,
        tenantId: impersonationContext.tenantId,
        method: req.method,
        path: req.originalUrl,
        // Do NOT log request body (may contain sensitive data)
      },
      timestamp: new Date(),
      ip: req.ip || null,
    };
    await collection.insertOne(entry);
  } catch (err) {
    log.error({ err: err.message }, 'Failed to log impersonated action');
  }
}
