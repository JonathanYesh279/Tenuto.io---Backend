import { createLogger } from '../services/logger.service.js';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { ADMIN_TIER_ROLES, COORDINATOR_ROLES, ROLE_RENAME_MAP } from '../config/constants.js';
import { DEFAULT_ROLE_PERMISSIONS, resolveEffectivePermissions } from '../config/permissions.js';

const log = createLogger('tenant.middleware');

/**
 * Tenant guard — fail-safe by design.
 * Throws if tenantId is missing from a query context.
 * Prevents accidental cross-tenant data leaks.
 */
export function requireTenantId(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_GUARD: tenantId is required but was not provided. This is a security violation.');
  }
  return tenantId;
}

/**
 * Middleware that builds a standardized `req.context` object from JWT + request data.
 * Must run AFTER authenticateToken middleware.
 *
 * Provides: { tenantId, userId, userRoles, isAdmin, schoolYearId }
 */
export async function buildContext(req, res, next) {
  try {
    const teacher = req.teacher;
    if (!teacher) {
      return next();
    }

    const teacherId = teacher._id.toString();

    // Lazy-load student access list from teacherAssignments (single source of truth)
    // Replaces deprecated teacher.teaching.studentIds
    if (!teacher._studentAccessIds) {
      try {
        const studentCollection = await getCollection('student');
        const studentFilter = { 'teacherAssignments.teacherId': teacherId, 'teacherAssignments.isActive': true };
        if (teacher.tenantId) {
          studentFilter.tenantId = teacher.tenantId;
        }
        const students = await studentCollection
          .find(
            studentFilter,
            { projection: { _id: 1 } }
          )
          .toArray();
        teacher._studentAccessIds = students.map(s => s._id.toString());
      } catch (err) {
        log.warn({ err: err.message }, 'Failed to load student access list');
        teacher._studentAccessIds = [];
      }
    }

    // Resolve effective permissions from tenant's rolePermissions (or hardcoded defaults)
    let rolePermissions = DEFAULT_ROLE_PERMISSIONS;
    if (teacher.tenantId) {
      try {
        const tenantCollection = await getCollection('tenant');
        const tenantDoc = await tenantCollection.findOne(
          { _id: ObjectId.createFromHexString(teacher.tenantId) },
          { projection: { rolePermissions: 1 } }
        );
        if (tenantDoc?.rolePermissions) {
          rolePermissions = tenantDoc.rolePermissions;
        }
      } catch (err) {
        log.warn({ err: err.message }, 'Failed to load tenant rolePermissions, using defaults');
      }
    }

    // Normalize legacy role names (e.g. 'מורה תאוריה' -> 'תאוריה') for permission resolution.
    // Does NOT mutate the teacher document -- only normalizes for this request's context.
    const rawRoles = teacher.roles || [];
    const teacherRoles = rawRoles.map(r => ROLE_RENAME_MAP[r] || r);
    const effectivePermissions = resolveEffectivePermissions(teacherRoles, rolePermissions);

    // Coordinator detection
    const isCoordinator = teacherRoles.some(r => COORDINATOR_ROLES.includes(r));
    const coordinatorDepartments = isCoordinator ? (teacher.coordinatorDepartments || []) : [];

    const isAdmin = teacherRoles.some(r => ADMIN_TIER_ROLES.includes(r));

    req.context = {
      tenantId: teacher.tenantId || null,
      userId: teacherId,
      userRoles: teacherRoles,
      isAdmin,
      schoolYearId: req.schoolYear?._id?.toString() || req.query.schoolYearId || null,
      // Access scopes for query filtering
      scopes: {
        studentIds: teacher._studentAccessIds,
        orchestraIds: teacher.conducting?.orchestraIds || [],
      },
      // RBAC fields
      effectivePermissions,
      coordinatorDepartments,
      isCoordinator,
    };

    next();
  } catch (err) {
    log.error({ err: err.message }, 'Error building request context');
    res.status(500).json({
      success: false,
      error: 'Failed to build request context',
      code: 'CONTEXT_BUILD_ERROR',
    });
  }
}

/**
 * Middleware that strips client-supplied tenantId from req.body and req.query.
 * Returns 400 TENANT_MISMATCH if client tenantId differs from server context.
 * Silently strips matching tenantId (defense-in-depth against spoofing).
 * Must run AFTER enforceTenant (so req.context.tenantId is guaranteed present).
 */
export function stripTenantId(req, res, next) {
  // Check req.body for client-supplied tenantId
  if (req.body && typeof req.body === 'object' && 'tenantId' in req.body) {
    if (req.context?.tenantId && req.body.tenantId !== req.context.tenantId) {
      log.warn({
        userId: req.context?.userId,
        path: req.path,
        method: req.method,
        clientTenantId: req.body.tenantId,
        serverTenantId: req.context.tenantId,
      }, 'TENANT_MISMATCH: Client-supplied tenantId differs from server context — rejected');
      return res.status(400).json({
        error: 'TENANT_MISMATCH',
        message: 'Client-supplied tenantId differs from server context',
      });
    }
    delete req.body.tenantId;
  }

  // Also strip tenantId from query params (defense-in-depth)
  if (req.query && 'tenantId' in req.query) {
    delete req.query.tenantId;
  }

  next();
}

/**
 * Middleware that enforces tenantId presence.
 * Use on routes that MUST be tenant-scoped.
 * Must run AFTER buildContext.
 */
export function enforceTenant(req, res, next) {
  try {
    if (!req.context?.tenantId) {
      log.warn({ userId: req.context?.userId, path: req.path }, 'Missing tenantId in request context');
      return res.status(403).json({
        success: false,
        error: 'Tenant context is required',
        code: 'MISSING_TENANT',
      });
    }
    next();
  } catch (err) {
    log.error({ err: err.message }, 'Error enforcing tenant');
    res.status(500).json({ success: false, error: 'Tenant check failed' });
  }
}
