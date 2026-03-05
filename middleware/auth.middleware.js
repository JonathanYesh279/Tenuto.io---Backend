import jwt from 'jsonwebtoken';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../services/logger.service.js';
import { ADMIN_TIER_ROLES } from '../config/constants.js';
import { LOCKED_DOMAINS, DOMAIN_ACTIONS } from '../config/permissions.js';

const log = createLogger('auth.middleware');

/**
 * Check if a teacher's roles include any admin-tier role (מנהל, סגן מנהל, מזכירות).
 * @param {string[]} roles
 * @returns {boolean}
 */
function isAdminTier(roles) {
  return Array.isArray(roles) && roles.some(r => ADMIN_TIER_ROLES.includes(r));
}

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      log.debug({ path: req.path }, 'No auth token found')
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    // Validate token format
    if (!token || token === 'undefined' || token === 'null') {
      log.debug({ path: req.path }, 'Invalid token format')
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    log.debug({ userId: decoded._id }, 'Token decoded')

    const collection = await getCollection('teacher');

    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      isActive: true,
    });

    if (!teacher) {
      return res.status(401).json({
        success: false,
        error: 'Teacher was not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check token version for revocation support
    const tokenVersion = teacher.credentials?.tokenVersion || 0;
    if (decoded.version !== undefined && decoded.version < tokenVersion) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Check tenant.isActive — block deactivated tenant users
    let tenant = null;
    if (teacher.tenantId) {
      const tenantCollection = await getCollection('tenant');
      tenant = await tenantCollection.findOne({
        _id: ObjectId.createFromHexString(teacher.tenantId),
      });

      if (!tenant || !tenant.isActive) {
        log.debug({ teacherId: teacher._id.toString(), tenantId: teacher.tenantId }, 'Tenant deactivated — rejecting request');
        return res.status(403).json({
          success: false,
          error: 'Tenant account is deactivated',
          code: 'TENANT_DEACTIVATED'
        });
      }
    }

    const displayName = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim() || 'Unknown';

    req.teacher = teacher;
    req.loggedinUser = {
      _id: teacher._id.toString(),
      tenantId: teacher.tenantId || null,
      tenantName: tenant?.name || null,
      roles: teacher.roles,
      firstName: teacher.personalInfo?.firstName || '',
      lastName: teacher.personalInfo?.lastName || '',
      displayName,
      email: teacher.credentials?.email,
      requiresPasswordChange: teacher.credentials?.requiresPasswordChange || false,
    };

    // Add user object for cascade management compatibility
    req.user = {
      id: teacher._id.toString(),
      tenantId: teacher.tenantId || null,
      role: isAdminTier(teacher.roles) ? 'admin' : 'teacher',
      isAdmin: isAdminTier(teacher.roles),
      email: teacher.credentials?.email,
      displayName,
    };

    next();
  } catch (err) {
    log.debug({ errName: err.name, errMessage: err.message }, 'Authentication error')

    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid token';

    if (err.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
    } else if (err.name === 'JsonWebTokenError') {
      errorCode = 'MALFORMED_TOKEN';
      errorMessage = 'Malformed token';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
}

// Default auth middleware export for cascade management
export const authMiddleware = authenticateToken;

export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher;

      if (!teacher) {
        log.debug({ path: req.path }, 'No teacher in request')
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (teacher.roles && isAdminTier(teacher.roles)) {
        req.isAdmin = true;
        return next();
      }

      const hasRequiredRole = teacher.roles && teacher.roles.some((role) =>
        roles.includes(role)
      );

      if (!hasRequiredRole) {
        log.debug({ required: roles, current: teacher.roles }, 'Insufficient permissions')
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: teacher.roles
        });
      }

      next();
    } catch (err) {
      log.error({ err: err.message }, 'Role authorization error')
      res.status(500).json({
        success: false,
        error: 'Authorization failed',
        code: 'AUTH_FAILED'
      });
    }
  };
}

/**
 * Permission-based middleware factory (RBAC Phase 40).
 * Gates a route by checking effectivePermissions[domain][action] on req.context.
 * Sets req.permissionScope to 'all', 'department', or 'own' on success.
 *
 * Must run AFTER authenticateToken + buildContext (which populates req.context.effectivePermissions).
 * Does NOT replace requireAuth -- both coexist during Phase 41 migration.
 *
 * @param {string} domain - permission domain (e.g. 'students', 'schedules', 'settings')
 * @param {string} action - permission action (e.g. 'view', 'create', 'update', 'delete')
 * @returns {Function} Express middleware
 */
export function requirePermission(domain, action) {
  return async (req, res, next) => {
    try {
      // 1. Check authentication
      if (!req.teacher) {
        log.debug({ path: req.path }, 'requirePermission: no teacher in request');
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // 2. Check permission context exists (buildContext must have run)
      if (!req.context?.effectivePermissions) {
        log.error({ path: req.path, userId: req.teacher._id?.toString() }, 'requirePermission: effectivePermissions missing from context');
        return res.status(500).json({
          success: false,
          error: 'Permission context not available',
          code: 'PERMISSION_CONTEXT_MISSING',
        });
      }

      // 3. Locked domain enforcement -- non-admins can NEVER access locked domains
      //    regardless of tenant rolePermissions customization
      if (LOCKED_DOMAINS.includes(domain) && !req.context.isAdmin) {
        log.debug({ domain, userId: req.context.userId, roles: req.context.userRoles }, 'requirePermission: locked domain access denied');
        return res.status(403).json({
          success: false,
          error: `Access to '${domain}' is restricted to admin roles`,
          code: 'LOCKED_DOMAIN',
          domain,
        });
      }

      // 4. Read scope from effectivePermissions
      const scope = req.context.effectivePermissions[domain]?.[action];
      if (!scope) {
        log.debug({ domain, action, userId: req.context.userId, roles: req.context.userRoles }, 'requirePermission: insufficient permissions');
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          domain,
          action,
          required: `${domain}.${action}`,
        });
      }

      // 5. Authorized -- set scope and continue
      req.permissionScope = scope;
      next();
    } catch (err) {
      log.error({ err: err.message, domain, action, path: req.path }, 'requirePermission: unexpected error');
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_FAILED',
      });
    }
  };
}

export function checkPasswordChangeRequired(req, res, next) {
  try {
    const teacher = req.teacher;

    // Allow these specific routes even if password change is required
    const allowedPaths = [
      '/api/auth/force-password-change',
      '/api/auth/logout',
      '/api/auth/validate',
      '/force-password-change'  // Allow access to the password change page
    ];

    if (allowedPaths.includes(req.path)) {
      return next();
    }

    // For API routes, return JSON error
    if (req.path.startsWith('/api/')) {
      if (teacher && teacher.credentials && teacher.credentials.requiresPasswordChange) {
        return res.status(403).json({
          success: false,
          error: 'Password change required',
          code: 'PASSWORD_CHANGE_REQUIRED',
          requiresPasswordChange: true,
          redirectUrl: '/force-password-change'
        });
      }
    } else {
      // For non-API routes (web pages), redirect to password change page
      if (teacher && teacher.credentials && teacher.credentials.requiresPasswordChange) {
        return res.redirect('/force-password-change');
      }
    }

    next();
  } catch (err) {
    log.error({ err: err.message }, 'Password change check error')

    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    } else {
      res.status(500).send('Authorization check failed');
    }
  }
}
