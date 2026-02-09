import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
  superAdminLoginSchema,
  createSuperAdminSchema,
  updateSuperAdminSchema,
  updateSubscriptionSchema,
} from './super-admin.validation.js';

const log = createLogger('super-admin.service');

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

const ADMIN_PROJECTION = { password: 0, refreshToken: 0 };

export const superAdminService = {
  login,
  logout,
  seedSuperAdmin,
  getSuperAdmins,
  createSuperAdmin,
  updateSuperAdmin,
  getTenantsWithStats,
  getTenantWithStats,
  updateSubscription,
  toggleTenantActive,
  getPlatformAnalytics,
};

async function login(email, password) {
  const { error } = superAdminLoginSchema.validate({ email, password });
  if (error) throw new Error(error.details[0].message);

  log.info({ email }, 'Super admin login attempt');

  const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
  const admin = await collection.findOne({ email, isActive: true });

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

async function createSuperAdmin(data) {
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

  return {
    _id: result.insertedId.toString(),
    email: doc.email,
    name: doc.name,
    permissions: doc.permissions,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

async function updateSuperAdmin(id, data) {
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
  return result;
}

async function getTenantsWithStats() {
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const studentCollection = await getCollection(COLLECTIONS.STUDENT);

  const tenants = await tenantCollection.find().sort({ name: 1 }).toArray();

  const tenantIds = tenants.map((t) => t.tenantId || t._id.toString());

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
    const tid = t.tenantId || t._id.toString();
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

  const tid = tenant.tenantId || tenant._id.toString();

  const [teacherCount, studentCount] = await Promise.all([
    teacherCollection.countDocuments({ tenantId: tid, isActive: true }),
    studentCollection.countDocuments({ tenantId: tid, isActive: true }),
  ]);

  return {
    ...tenant,
    stats: { teacherCount, studentCount },
  };
}

async function updateSubscription(tenantId, data) {
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
  return result;
}

async function toggleTenantActive(tenantId) {
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
