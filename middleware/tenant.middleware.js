import { createLogger } from '../services/logger.service.js';
import { getCollection } from '../services/mongoDB.service.js';

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

    req.context = {
      tenantId: teacher.tenantId || null,
      userId: teacherId,
      userRoles: teacher.roles || [],
      isAdmin: teacher.roles?.includes('מנהל') || false,
      schoolYearId: req.schoolYear?._id?.toString() || req.query.schoolYearId || null,
      // Access scopes for query filtering
      scopes: {
        studentIds: teacher._studentAccessIds,
        orchestraIds: teacher.conducting?.orchestraIds || [],
      },
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
