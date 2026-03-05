import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCollection, getDB, withTransaction } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { COLLECTIONS, AUDIT_ACTIONS, ADMIN_TIER_ROLES } from '../../config/constants.js';
import {
  superAdminLoginSchema,
  createSuperAdminSchema,
  updateSuperAdminSchema,
  updateSubscriptionSchema,
  impersonationStartSchema,
  createTenantWithAdminSchema,
  updateTenantAdminSchema,
} from './super-admin.validation.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../../config/permissions.js';
import { DEFAULT_PASSWORD } from '../../services/invitationConfig.js';
import { auditTrailService } from '../../services/auditTrail.service.js';
import { tenantPurgeService } from '../../services/tenantPurge.service.js';

const log = createLogger('super-admin.service');

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

const ADMIN_PROJECTION = { password: 0, refreshToken: 0 };

export const superAdminService = {
  login,
  logout,
  refreshAccessToken,
  seedSuperAdmin,
  getSuperAdmins,
  createSuperAdmin,
  updateSuperAdmin,
  getTenantsWithStats,
  getTenantWithStats,
  updateSubscription,
  toggleTenantActive,
  getPlatformAnalytics,
  deletionPreview,
  softDeleteTenant,
  cancelDeletion,
  purgeTenant,
  getPlatformAuditLog,
  getTenantAuditLog,
  getReportingDashboard,
  getReportingTenantList,
  getReportingTenantDetail,
  getReportingMinistryStatus,
  startImpersonation,
  stopImpersonation,
  createTenantWithAdmin,
  getTenantAdmins,
  getAllTenantAdmins,
  updateTenantAdmin,
  resetTenantAdminPassword,
};

async function login(email, password) {
  const { error } = superAdminLoginSchema.validate({ email, password });
  if (error) throw new Error(error.details[0].message);

  const normalizedEmail = email.toLowerCase();
  log.info({ email: normalizedEmail }, 'Super admin login attempt');

  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
  const admin = await collection.findOne({ email: normalizedEmail, isActive: true });

  if (!admin) {
    throw new Error('Invalid email or password');
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    throw new Error('Invalid email or password');
  }

  const accessToken = jwt.sign(
    { _id: admin._id.toString(), type: 'super_admin', email: admin.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { _id: admin._id.toString(), type: 'super_admin' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  await collection.updateOne(
    { _id: admin._id },
    { $set: { refreshToken, lastLogin: new Date(), updatedAt: new Date() } }
  );

  log.info({ adminId: admin._id.toString() }, 'Super admin login successful');

  return {
    accessToken,
    refreshToken,
    admin: {
      _id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      permissions: admin.permissions,
    },
  };
}

async function logout(adminId) {
  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
  await collection.updateOne(
    { _id: ObjectId.createFromHexString(adminId) },
    { $set: { refreshToken: null, updatedAt: new Date() } }
  );
  log.info({ adminId }, 'Super admin logged out');
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.type !== 'super_admin') {
      throw new Error('Invalid token type');
    }

    const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
    const admin = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      refreshToken: refreshToken,
      isActive: true,
    });

    if (!admin) {
      throw new Error('Invalid refresh token - admin not found or inactive');
    }

    const accessToken = jwt.sign(
      { _id: admin._id.toString(), type: 'super_admin', email: admin.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return { accessToken };
  } catch (err) {
    log.error({ err: err.message }, 'Error in super admin refreshAccessToken');

    if (err.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Malformed refresh token');
    }

    throw new Error('Invalid refresh token');
  }
}

async function seedSuperAdmin(data) {
  const { error, value } = createSuperAdminSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
  const count = await collection.countDocuments();

  if (count > 0) {
    const err = new Error('Seed is only allowed when no super admins exist');
    err.status = 403;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(value.password, SALT_ROUNDS);

  const doc = {
    email: value.email,
    password: hashedPassword,
    name: value.name,
    permissions: value.permissions,
    isActive: true,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(doc);
  log.info({ adminId: result.insertedId.toString() }, 'Super admin seeded');

  return {
    _id: result.insertedId.toString(),
    email: doc.email,
    name: doc.name,
    permissions: doc.permissions,
  };
}

async function getSuperAdmins() {
  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
  return collection.find({}, { projection: ADMIN_PROJECTION }).toArray();
}

async function createSuperAdmin(data, actorId) {
  const { error, value } = createSuperAdminSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);

  const existing = await collection.findOne({ email: value.email });
  if (existing) {
    throw new Error(`Super admin with email "${value.email}" already exists`);
  }

  const hashedPassword = await bcrypt.hash(value.password, SALT_ROUNDS);

  const doc = {
    email: value.email,
    password: hashedPassword,
    name: value.name,
    permissions: value.permissions,
    isActive: true,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(doc);
  log.info({ adminId: result.insertedId.toString() }, 'Super admin created');

  const created = {
    _id: result.insertedId.toString(),
    email: doc.email,
    name: doc.name,
    permissions: doc.permissions,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };

  if (actorId) {
    await auditTrailService.logAction(AUDIT_ACTIONS.SUPER_ADMIN_CREATED, actorId, {
      targetType: 'super_admin',
      targetId: created._id,
      adminEmail: created.email,
    });
  }

  return created;
}

async function updateSuperAdmin(id, data, actorId) {
  const { error, value } = updateSuperAdminSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);

  if (value.email) {
    const existing = await collection.findOne({
      email: value.email,
      _id: { $ne: ObjectId.createFromHexString(id) },
    });
    if (existing) {
      throw new Error(`Super admin with email "${value.email}" already exists`);
    }
  }

  const updateFields = { ...value, updatedAt: new Date() };

  if (value.password) {
    updateFields.password = await bcrypt.hash(value.password, SALT_ROUNDS);
  }

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(id) },
    { $set: updateFields },
    { returnDocument: 'after', projection: ADMIN_PROJECTION }
  );

  if (!result) {
    throw new Error(`Super admin with id ${id} not found`);
  }

  log.info({ adminId: id }, 'Super admin updated');

  if (actorId) {
    await auditTrailService.logAction(AUDIT_ACTIONS.SUPER_ADMIN_UPDATED, actorId, {
      targetType: 'super_admin',
      targetId: id,
      changes: Object.keys(data),
    });
  }

  return result;
}

async function getTenantsWithStats() {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);

  const tenants = await tenantCollection.find().sort({ name: 1 }).toArray();

  const tenantIds = tenants.map((t) => t._id.toString());

  const [teacherCounts, studentCounts] = await Promise.all([
    teacherCollection.aggregate([
      { $match: { tenantId: { $in: tenantIds }, isActive: true } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]).toArray(),
    studentCollection.aggregate([
      { $match: { tenantId: { $in: tenantIds }, isActive: true } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const teacherMap = new Map(teacherCounts.map((r) => [r._id, r.count]));
  const studentMap = new Map(studentCounts.map((r) => [r._id, r.count]));

  return tenants.map((t) => {
    const tid = t._id.toString();
    return {
      ...t,
      stats: {
        teacherCount: teacherMap.get(tid) || 0,
        studentCount: studentMap.get(tid) || 0,
      },
    };
  });
}

async function getTenantWithStats(tenantId) {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);

  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  const tid = tenant._id.toString();

  const [teacherCount, studentCount] = await Promise.all([
    teacherCollection.countDocuments({ tenantId: tid, isActive: true }),
    studentCollection.countDocuments({ tenantId: tid, isActive: true }),
  ]);

  return {
    ...tenant,
    stats: { teacherCount, studentCount },
  };
}

async function updateSubscription(tenantId, data, actorId) {
  const { error, value } = updateSubscriptionSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const collection = await getCollection(COLLECTIONS.TENANT);

  const setFields = {};
  for (const [key, val] of Object.entries(value)) {
    setFields[`subscription.${key}`] = val;
  }
  setFields.updatedAt = new Date();

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    { $set: setFields },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  log.info({ tenantId }, 'Subscription updated');

  if (actorId) {
    await auditTrailService.logAction(AUDIT_ACTIONS.SUBSCRIPTION_UPDATED, actorId, {
      targetId: tenantId,
      tenantName: result.name,
      changes: Object.keys(data),
    });
  }

  return result;
}

async function toggleTenantActive(tenantId, actorId) {
  const collection = await getCollection(COLLECTIONS.TENANT);

  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    { $set: { isActive: !tenant.isActive, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  log.info({ tenantId, isActive: result.isActive }, 'Tenant active status toggled');

  if (actorId) {
    const action = result.isActive ? AUDIT_ACTIONS.TENANT_ACTIVATED : AUDIT_ACTIONS.TENANT_DEACTIVATED;
    await auditTrailService.logAction(action, actorId, {
      targetId: tenantId,
      tenantName: result.name,
    });
  }

  return result;
}

async function getPlatformAnalytics() {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);

  const [
    totalTenants,
    activeTenants,
    totalTeachers,
    totalStudents,
    subscriptionsByPlan,
  ] = await Promise.all([
    tenantCollection.countDocuments(),
    tenantCollection.countDocuments({ isActive: true }),
    teacherCollection.countDocuments({ isActive: true }),
    studentCollection.countDocuments({ isActive: true }),
    tenantCollection.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const planCounts = {};
  for (const row of subscriptionsByPlan) {
    planCounts[row._id || 'basic'] = row.count;
  }

  return {
    totalTenants,
    activeTenants,
    totalTeachers,
    totalStudents,
    subscriptionsByPlan: planCounts,
  };
}

// ─── Tenant Lifecycle Methods ────────────────────────────────────────────────

async function deletionPreview(tenantId) {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  const tenantIdString = tenant._id.toString();
  const preview = await tenantPurgeService.previewDeletion(tenantIdString);

  return {
    tenantId,
    tenantName: tenant.name,
    ...preview,
  };
}

async function softDeleteTenant(tenantId, { gracePeriodDays = 30, reason = '' } = {}, actorId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  if (tenant.deletionStatus === 'scheduled' || tenant.deletionStatus === 'purging') {
    throw new Error(`Tenant is already in deletion status: ${tenant.deletionStatus}`);
  }

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $set: {
        isActive: false,
        deletionStatus: 'scheduled',
        deletionScheduledAt: new Date(),
        deletionPurgeAt: new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000),
        deletionRequestedBy: actorId,
        deletionReason: reason,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  await auditTrailService.logAction(AUDIT_ACTIONS.TENANT_SOFT_DELETED, actorId, {
    targetId: tenantId,
    tenantName: tenant.name,
    gracePeriodDays,
    reason,
  });

  log.info({ tenantId, gracePeriodDays }, 'Tenant soft-deleted');
  return result;
}

async function cancelDeletion(tenantId, actorId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  if (tenant.deletionStatus !== 'scheduled') {
    throw new Error(`Cannot cancel deletion: tenant deletion status is '${tenant.deletionStatus || 'none'}', expected 'scheduled'`);
  }

  // Note: Keep isActive: false -- cancelling deletion does NOT reactivate.
  // Super admin must explicitly toggle-active to reactivate.
  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $set: { deletionStatus: 'cancelled', updatedAt: new Date() },
      $unset: { deletionPurgeAt: '', deletionRequestedBy: '', deletionReason: '' },
    },
    { returnDocument: 'after' }
  );

  await auditTrailService.logAction(AUDIT_ACTIONS.TENANT_DELETION_CANCELLED, actorId, {
    targetId: tenantId,
    tenantName: tenant.name,
  });

  log.info({ tenantId }, 'Tenant deletion cancelled');
  return result;
}

async function purgeTenant(tenantId, actorId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  if (tenant.deletionStatus !== 'scheduled') {
    throw new Error(`Cannot purge: tenant must be soft-deleted first (current status: '${tenant.deletionStatus || 'none'}')`);
  }

  const tenantIdString = tenant._id.toString();

  // Mark as purging
  await collection.updateOne(
    { _id: ObjectId.createFromHexString(tenantId) },
    { $set: { deletionStatus: 'purging', updatedAt: new Date() } }
  );

  try {
    // Step 1: Create snapshot
    const snapshotResult = await tenantPurgeService.createTenantSnapshot(tenantIdString);

    // Step 2: Purge all tenant data
    const purgeResult = await tenantPurgeService.purgeTenant(tenantIdString, snapshotResult.snapshotId);

    // Step 3: Log audit
    await auditTrailService.logAction(AUDIT_ACTIONS.TENANT_PURGED, actorId, {
      targetId: tenantId,
      tenantName: tenant.name,
      snapshotId: snapshotResult.snapshotId.toString(),
    });

    log.info({ tenantId, snapshotId: snapshotResult.snapshotId.toString() }, 'Tenant purged');
    return purgeResult;
  } catch (err) {
    // Rollback status to scheduled so purge can be retried
    await collection.updateOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { $set: { deletionStatus: 'scheduled', updatedAt: new Date() } }
    );
    throw err;
  }
}

async function getPlatformAuditLog(filters) {
  return auditTrailService.getAuditLog(filters);
}

async function getTenantAuditLog(tenantId) {
  return auditTrailService.getAuditLogForTenant(tenantId);
}

// --- Platform Reporting Methods ---

/**
 * Compute utilization percentage. Returns null if max is falsy/0.
 */
function computeUtilization(count, max) {
  if (!max) return null;
  return Math.round((count / max) * 100);
}

/**
 * Derive health alert objects for a tenant based on subscription and stats.
 */
function deriveHealthAlerts(tenant, stats) {
  const alerts = [];
  const sub = tenant.subscription;

  // Expiring soon
  if (sub?.endDate) {
    const endDate = new Date(sub.endDate);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() <= now + thirtyDaysMs) {
      const daysRemaining = Math.ceil((endDate.getTime() - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        type: 'expiring_soon',
        daysRemaining,
        severity: daysRemaining <= 7 ? 'critical' : 'warning',
      });
    }
  }

  // Over limit teachers
  const maxTeachers = sub?.maxTeachers || 0;
  if (maxTeachers > 0 && stats.teacherCount >= maxTeachers) {
    alerts.push({
      type: 'over_limit_teachers',
      current: stats.teacherCount,
      max: maxTeachers,
      severity: 'warning',
    });
  }

  // Over limit students
  const maxStudents = sub?.maxStudents || 0;
  if (maxStudents > 0 && stats.studentCount >= maxStudents) {
    alerts.push({
      type: 'over_limit_students',
      current: stats.studentCount,
      max: maxStudents,
      severity: 'warning',
    });
  }

  // Inactive tenant (only flag when explicitly deactivated, not when subscription field is missing)
  if (tenant.isActive === false) {
    alerts.push({ type: 'inactive_tenant', severity: 'info' });
  } else if (sub && sub.isActive === false) {
    alerts.push({ type: 'inactive_subscription', severity: 'warning' });
  }

  return alerts;
}

/**
 * REPT-01 + REPT-02 + REPT-03: Enriched tenant list with usage stats,
 * ministry report status, and health alerts.
 */
async function getReportingTenantList() {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);
  const orchestraCollection = await getCollection(COLLECTIONS.ORCHESTRA);
  const snapshotCollection = await getCollection(COLLECTIONS.MINISTRY_REPORT_SNAPSHOTS);

  const tenants = await tenantCollection.find().sort({ name: 1 }).toArray();
  const tenantIds = tenants.map((t) => t._id.toString());

  const [teacherCounts, studentCounts, orchestraCounts, adminLogins, snapshotStats] =
    await Promise.all([
      // Teacher counts per tenant
      teacherCollection
        .aggregate([
          { $match: { tenantId: { $in: tenantIds }, isActive: true } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ])
        .toArray(),
      // Student counts per tenant
      studentCollection
        .aggregate([
          { $match: { tenantId: { $in: tenantIds }, isActive: true } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ])
        .toArray(),
      // Orchestra counts per tenant
      orchestraCollection
        .aggregate([
          { $match: { tenantId: { $in: tenantIds }, isActive: true } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ])
        .toArray(),
      // Last admin login per tenant
      teacherCollection
        .aggregate([
          { $match: { tenantId: { $in: tenantIds }, isActive: true, roles: 'מנהל' } },
          { $sort: { 'credentials.lastLogin': -1 } },
          {
            $group: {
              _id: '$tenantId',
              lastAdminLogin: { $first: '$credentials.lastLogin' },
            },
          },
        ])
        .toArray(),
      // Ministry report snapshot stats per tenant
      snapshotCollection
        .aggregate([
          { $match: { tenantId: { $in: tenantIds } } },
          { $sort: { generatedAt: -1 } },
          {
            $group: {
              _id: '$tenantId',
              latestDate: { $first: '$generatedAt' },
              completionPercentage: { $first: '$completionPercentage' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

  const teacherMap = new Map(teacherCounts.map((r) => [r._id, r.count]));
  const studentMap = new Map(studentCounts.map((r) => [r._id, r.count]));
  const orchestraMap = new Map(orchestraCounts.map((r) => [r._id, r.count]));
  const adminLoginMap = new Map(adminLogins.map((r) => [r._id, r]));
  const snapshotMap = new Map(snapshotStats.map((r) => [r._id, r]));

  return tenants.map((t) => {
    const tid = t._id.toString();
    const teacherCount = teacherMap.get(tid) || 0;
    const studentCount = studentMap.get(tid) || 0;
    const orchestraCount = orchestraMap.get(tid) || 0;

    return {
      ...t,
      stats: {
        teacherCount,
        studentCount,
        orchestraCount,
        lastAdminLogin: adminLoginMap.get(tid)?.lastAdminLogin || null,
        teacherUtilization: computeUtilization(teacherCount, t.subscription?.maxTeachers),
        studentUtilization: computeUtilization(studentCount, t.subscription?.maxStudents),
      },
      ministryStatus: {
        latestSnapshotDate: snapshotMap.get(tid)?.latestDate || null,
        completionPercentage: snapshotMap.get(tid)?.completionPercentage ?? null,
        snapshotCount: snapshotMap.get(tid)?.count || 0,
      },
      alerts: deriveHealthAlerts(t, { teacherCount, studentCount }),
    };
  });
}

/**
 * Single-tenant reporting detail.
 */
async function getReportingTenantDetail(tenantId) {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);
  const orchestraCollection = await getCollection(COLLECTIONS.ORCHESTRA);
  const snapshotCollection = await getCollection(COLLECTIONS.MINISTRY_REPORT_SNAPSHOTS);

  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  const tid = tenant._id.toString();

  const [teacherCount, studentCount, orchestraCount, adminLogins, snapshotStats] =
    await Promise.all([
      teacherCollection.countDocuments({ tenantId: tid, isActive: true }),
      studentCollection.countDocuments({ tenantId: tid, isActive: true }),
      orchestraCollection.countDocuments({ tenantId: tid, isActive: true }),
      teacherCollection
        .aggregate([
          { $match: { tenantId: tid, isActive: true, roles: 'מנהל' } },
          { $sort: { 'credentials.lastLogin': -1 } },
          {
            $group: {
              _id: '$tenantId',
              lastAdminLogin: { $first: '$credentials.lastLogin' },
            },
          },
        ])
        .toArray(),
      snapshotCollection
        .aggregate([
          { $match: { tenantId: tid } },
          { $sort: { generatedAt: -1 } },
          {
            $group: {
              _id: '$tenantId',
              latestDate: { $first: '$generatedAt' },
              completionPercentage: { $first: '$completionPercentage' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

  const adminLogin = adminLogins[0] || null;
  const snapshot = snapshotStats[0] || null;

  return {
    ...tenant,
    stats: {
      teacherCount,
      studentCount,
      orchestraCount,
      lastAdminLogin: adminLogin?.lastAdminLogin || null,
      teacherUtilization: computeUtilization(teacherCount, tenant.subscription?.maxTeachers),
      studentUtilization: computeUtilization(studentCount, tenant.subscription?.maxStudents),
    },
    ministryStatus: {
      latestSnapshotDate: snapshot?.latestDate || null,
      completionPercentage: snapshot?.completionPercentage ?? null,
      snapshotCount: snapshot?.count || 0,
    },
    alerts: deriveHealthAlerts(tenant, { teacherCount, studentCount }),
  };
}

/**
 * REPT-02 standalone: Ministry report status across all tenants.
 */
async function getReportingMinistryStatus() {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const snapshotCollection = await getCollection(COLLECTIONS.MINISTRY_REPORT_SNAPSHOTS);

  const tenants = await tenantCollection
    .find({}, { projection: { _id: 1, name: 1, slug: 1, tenantId: 1 } })
    .toArray();

  const tenantIds = tenants.map((t) => t._id.toString());

  const snapshotStats = await snapshotCollection
    .aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $sort: { generatedAt: -1 } },
      {
        $group: {
          _id: '$tenantId',
          latestDate: { $first: '$generatedAt' },
          completionPercentage: { $first: '$completionPercentage' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const snapshotMap = new Map(snapshotStats.map((r) => [r._id, r]));

  return tenants.map((t) => {
    const tid = t._id.toString();
    const snap = snapshotMap.get(tid);
    return {
      tenantId: tid,
      tenantName: t.name,
      slug: t.slug,
      latestSnapshotDate: snap?.latestDate || null,
      completionPercentage: snap?.completionPercentage ?? null,
      snapshotCount: snap?.count || 0,
    };
  });
}

/**
 * REPT-04: Combined dashboard with overview cards, tenant health, and alerts.
 */
async function getReportingDashboard() {
  const tenantHealth = await getReportingTenantList();

  // Compute overview from the tenant list
  const totalTenants = tenantHealth.length;
  const activeTenants = tenantHealth.filter((t) => t.isActive).length;
  const totalTeachers = tenantHealth.reduce((sum, t) => sum + t.stats.teacherCount, 0);
  const totalStudents = tenantHealth.reduce((sum, t) => sum + t.stats.studentCount, 0);
  const totalOrchestras = tenantHealth.reduce((sum, t) => sum + t.stats.orchestraCount, 0);

  // Subscriptions by plan
  const planCounts = {};
  for (const t of tenantHealth) {
    const plan = t.subscription?.plan || 'basic';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  }

  // Flatten alerts across all tenants
  const alerts = tenantHealth
    .filter((t) => t.alerts.length > 0)
    .flatMap((t) =>
      t.alerts.map((a) => ({
        ...a,
        tenantId: t._id?.toString() || t.tenantId,
        tenantName: t.name,
      }))
    );

  const overview = {
    totalTenants,
    activeTenants,
    totalTeachers,
    totalStudents,
    totalOrchestras,
    alertCount: alerts.length,
    subscriptionsByPlan: planCounts,
  };

  return { overview, tenantHealth, alerts };
}

// ─── Impersonation Methods ───────────────────────────────────────────────────

/**
 * Start an impersonation session. Generates a JWT that authenticateToken
 * will accept as a valid teacher token, with additional impersonation claims.
 *
 * @param {string} tenantId - Tenant _id (hex string)
 * @param {string} superAdminId - Super admin _id (string)
 * @returns {{ accessToken, sessionId, tenant, impersonatedAdmin }}
 */
async function startImpersonation(tenantId, superAdminId) {
  // Validate tenantId format
  const { error } = impersonationStartSchema.validate({ tenantId });
  if (error) throw new Error(error.details[0].message);

  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  if (!tenant.isActive) {
    throw new Error('Cannot impersonate a deactivated tenant');
  }

  // Find an active admin-tier teacher for this tenant
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const tid = tenant._id.toString();
  const adminTeacher = await teacherCollection.findOne({
    tenantId: tid,
    roles: { $in: ADMIN_TIER_ROLES },
    isActive: true,
  });

  if (!adminTeacher) {
    throw new Error('No active admin found for this tenant. Create an admin teacher first via tenant management.');
  }

  const sessionId = new ObjectId().toString();

  // Build token payload matching generateAccessToken output (auth.service.js)
  // plus impersonation claims
  const tokenData = {
    _id: adminTeacher._id.toString(),
    tenantId: adminTeacher.tenantId || null,
    firstName: adminTeacher.personalInfo?.firstName || '',
    lastName: adminTeacher.personalInfo?.lastName || '',
    email: adminTeacher.credentials.email,
    roles: adminTeacher.roles,
    version: adminTeacher.credentials?.tokenVersion || 0,
    isImpersonation: true,
    impersonatedBy: superAdminId,
    impersonationSessionId: sessionId,
  };

  const accessToken = jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1h',
  });

  const impersonatedAdminId = adminTeacher._id.toString();
  const impersonatedAdminEmail = adminTeacher.credentials.email;
  const impersonatedAdminName = `${adminTeacher.personalInfo?.firstName || ''} ${adminTeacher.personalInfo?.lastName || ''}`.trim() || 'Unknown';

  // Log audit
  await auditTrailService.logAction(AUDIT_ACTIONS.IMPERSONATION_STARTED, superAdminId, {
    targetId: tenantId,
    targetType: 'tenant',
    tenantName: tenant.name,
    impersonatedAdminId,
    impersonatedAdminEmail,
    sessionId,
  });

  log.info({ superAdminId, tenantId, impersonatedAdminId, sessionId }, 'Impersonation session started');

  return {
    accessToken,
    sessionId,
    tenant: {
      _id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
    },
    impersonatedAdmin: {
      _id: impersonatedAdminId,
      name: impersonatedAdminName,
      email: impersonatedAdminEmail,
    },
  };
}

/**
 * Stop an impersonation session. Logs the session end in platform_audit_log.
 *
 * @param {string} sessionId - Impersonation session ID
 * @param {string} superAdminId - Super admin _id (string)
 * @returns {{ success: true, message: string }}
 */
async function stopImpersonation(sessionId, superAdminId) {
  await auditTrailService.logAction(AUDIT_ACTIONS.IMPERSONATION_ENDED, superAdminId, {
    targetType: 'impersonation_session',
    targetId: sessionId,
    sessionId,
  });

  log.info({ superAdminId, sessionId }, 'Impersonation session ended');

  return { success: true, message: 'Impersonation session ended' };
}

// ─── Tenant + Admin Provisioning ─────────────────────────────────────────────

async function createTenantWithAdmin(data) {
  const { error, value } = createTenantWithAdminSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const result = await withTransaction(async (session) => {
    const db = getDB();

    // Check slug uniqueness
    const existingTenant = await db.collection(COLLECTIONS.TENANT).findOne(
      { slug: value.slug },
      { session }
    );
    if (existingTenant) {
      throw new Error(`Tenant with slug "${value.slug}" already exists`);
    }

    // Deep clone frozen DEFAULT_ROLE_PERMISSIONS
    const rolePermissions = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));

    const tenantDoc = {
      name: value.name,
      slug: value.slug,
      city: value.city,
      director: { name: null, teacherId: null },
      ministryInfo: { institutionCode: null, districtName: null },
      settings: { lessonDurations: [30, 45, 60], schoolStartMonth: 9, rooms: [] },
      rolePermissions,
      subscription: {
        plan: 'basic',
        startDate: new Date(),
        endDate: null,
        isActive: true,
        maxTeachers: 50,
        maxStudents: 500,
      },
      conservatoryProfile: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tenantResult = await db.collection(COLLECTIONS.TENANT).insertOne(tenantDoc, { session });
    const tenantId = tenantResult.insertedId.toString();

    // Hash default password
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const adminEmail = value.adminEmail.toLowerCase();

    const adminTeacherDoc = {
      tenantId,
      personalInfo: {
        firstName: value.adminFirstName,
        lastName: value.adminLastName,
        email: adminEmail,
        phone: '',
        address: '',
        instrument: '',
        idNumber: '',
      },
      credentials: {
        email: adminEmail,
        password: hashedPassword,
        requiresPasswordChange: true,
        tokenVersion: 0,
        refreshToken: null,
        invitationMode: 'DEFAULT_PASSWORD',
        passwordSetAt: new Date(),
      },
      roles: ['מנהל'],
      teaching: { timeBlocks: [] },
      conducting: { orchestraIds: [] },
      ensemblesIds: [],
      schoolYears: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection(COLLECTIONS.TEACHER).insertOne(adminTeacherDoc, { session });

    return {
      tenant: { _id: tenantResult.insertedId, ...tenantDoc },
      adminTeacher: {
        _id: adminTeacherDoc._id,
        email: value.adminEmail,
        firstName: value.adminFirstName,
        lastName: value.adminLastName,
      },
    };
  });

  log.info(
    { tenantId: result.tenant._id.toString(), adminEmail: result.adminTeacher.email },
    'Tenant created with admin'
  );

  return result;
}

// ─── Tenant Admin Management ─────────────────────────────────────────────────

const TENANT_ADMIN_PROJECTION = {
  'credentials.password': 0,
  'credentials.refreshToken': 0,
  'credentials.tokenVersion': 0,
};

async function getTenantAdmins(tenantId) {
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);

  const admins = await teacherCollection
    .find(
      { tenantId, roles: { $in: ADMIN_TIER_ROLES }, isActive: true },
      { projection: TENANT_ADMIN_PROJECTION }
    )
    .sort({ 'personalInfo.firstName': 1 })
    .toArray();

  return admins;
}

async function getAllTenantAdmins() {
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);

  const admins = await teacherCollection
    .find(
      { roles: { $in: ADMIN_TIER_ROLES }, isActive: true },
      { projection: TENANT_ADMIN_PROJECTION }
    )
    .toArray();

  // Batch-lookup tenants by unique tenantIds
  const uniqueTenantIds = [...new Set(admins.map((a) => a.tenantId))];
  const tenants = await tenantCollection
    .find(
      { _id: { $in: uniqueTenantIds.map((id) => ObjectId.createFromHexString(id)) } },
      { projection: { name: 1, slug: 1 } }
    )
    .toArray();

  const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t]));

  // Merge tenant info and sort
  const result = admins.map((admin) => {
    const tenant = tenantMap.get(admin.tenantId);
    return {
      ...admin,
      tenantName: tenant?.name || 'Unknown',
      tenantSlug: tenant?.slug || '',
    };
  });

  result.sort((a, b) => {
    const nameCompare = (a.tenantName || '').localeCompare(b.tenantName || '');
    if (nameCompare !== 0) return nameCompare;
    return (a.personalInfo?.firstName || '').localeCompare(b.personalInfo?.firstName || '');
  });

  return result;
}

async function updateTenantAdmin(tenantId, adminId, data) {
  const { error, value } = updateTenantAdminSchema.validate(data, { abortEarly: false });
  if (error) throw error;

  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);

  // Find the admin teacher
  const existing = await teacherCollection.findOne({
    _id: ObjectId.createFromHexString(adminId),
    tenantId,
    roles: { $in: ADMIN_TIER_ROLES },
  });

  if (!existing) {
    const err = new Error('Admin teacher not found');
    err.status = 404;
    throw err;
  }

  const setFields = { updatedAt: new Date() };

  if (value.firstName !== undefined) {
    setFields['personalInfo.firstName'] = value.firstName;
  }
  if (value.lastName !== undefined) {
    setFields['personalInfo.lastName'] = value.lastName;
  }
  if (value.email !== undefined) {
    const newEmail = value.email.toLowerCase();

    // Check email uniqueness within tenant
    const emailConflict = await teacherCollection.findOne({
      tenantId,
      'credentials.email': newEmail,
      _id: { $ne: ObjectId.createFromHexString(adminId) },
    });

    if (emailConflict) {
      const err = new Error('Email already exists for another teacher in this tenant');
      err.status = 409;
      throw err;
    }

    setFields['personalInfo.email'] = newEmail;
    setFields['credentials.email'] = newEmail;
  }

  const updated = await teacherCollection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(adminId) },
    { $set: setFields },
    { returnDocument: 'after', projection: TENANT_ADMIN_PROJECTION }
  );

  log.info({ tenantId, adminId, changes: Object.keys(value) }, 'Tenant admin updated');

  return updated;
}

async function resetTenantAdminPassword(tenantId, adminId) {
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);

  const existing = await teacherCollection.findOne({
    _id: ObjectId.createFromHexString(adminId),
    tenantId,
    roles: { $in: ADMIN_TIER_ROLES },
  });

  if (!existing) {
    const err = new Error('Admin teacher not found');
    err.status = 404;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  await teacherCollection.updateOne(
    { _id: ObjectId.createFromHexString(adminId) },
    {
      $set: {
        'credentials.password': hashedPassword,
        'credentials.requiresPasswordChange': true,
        'credentials.passwordSetAt': new Date(),
        updatedAt: new Date(),
      },
    }
  );

  log.info({ tenantId, adminId }, 'Tenant admin password reset to default');

  return { success: true, message: 'Password reset to default' };
}

// --- Reporting Index Initialization (internal, not exported) ---

async function ensureReportingIndexes() {
  try {
    const snapshotCollection = await getCollection(COLLECTIONS.MINISTRY_REPORT_SNAPSHOTS);
    const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
    const orchestraCollection = await getCollection(COLLECTIONS.ORCHESTRA);

    await Promise.all([
      snapshotCollection.createIndex(
        { tenantId: 1, generatedAt: -1 },
        { name: 'idx_reporting_tenant_snapshot', background: true }
      ),
      teacherCollection.createIndex(
        { tenantId: 1, roles: 1, 'credentials.lastLogin': -1 },
        { name: 'idx_reporting_admin_login', background: true }
      ),
      orchestraCollection.createIndex(
        { tenantId: 1, isActive: 1 },
        { name: 'idx_reporting_orchestra_tenant', background: true }
      ),
    ]);

    log.info('Reporting indexes ensured');
  } catch (err) {
    // Index creation is best-effort -- queries work without them, just slower
    log.warn({ err: err.message }, 'Failed to ensure reporting indexes');
  }
}

// Trigger index creation on first module import (idempotent)
ensureReportingIndexes();
