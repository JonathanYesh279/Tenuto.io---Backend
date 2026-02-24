import jwt from 'jsonwebtoken';
import { createLogger } from '../services/logger.service.js';
import { auditTrailService } from '../services/auditTrail.service.js';

const log = createLogger('impersonation-audit');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Middleware that enriches the request with impersonation context when the
 * current token is an impersonation token. For mutating requests (POST, PUT,
 * PATCH, DELETE), it fires-and-forgets an audit log entry.
 *
 * Must be placed AFTER authenticateToken (needs req.teacher to be set).
 * Must never break requests -- all errors are caught and logged.
 */
export function enrichImpersonationContext(req, res, next) {
  try {
    // Not an authenticated request -- skip
    if (!req.teacher) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return next();
    }

    // Decode only -- already verified by authenticateToken
    const decoded = jwt.decode(token);

    if (decoded?.isImpersonation) {
      req.impersonation = {
        isImpersonation: true,
        superAdminId: decoded.impersonatedBy,
        sessionId: decoded.impersonationSessionId,
        impersonatedUserId: decoded._id,
        tenantId: decoded.tenantId,
      };

      // Fire-and-forget audit for mutating requests (do NOT await)
      if (MUTATING_METHODS.has(req.method)) {
        auditTrailService.logImpersonatedAction(req.impersonation, req);
      }

      log.debug(
        { sessionId: decoded.impersonationSessionId, method: req.method, path: req.originalUrl },
        'Impersonation context enriched'
      );
    }

    next();
  } catch (err) {
    // Audit enrichment must never break requests
    log.warn({ err: err.message }, 'Error in impersonation audit enrichment (ignored)');
    next();
  }
}
