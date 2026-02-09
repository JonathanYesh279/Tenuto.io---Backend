import { getCollection } from '../../services/mongoDB.service.js';
import { validateTenant } from './tenant.validation.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { COLLECTIONS } from '../../config/constants.js';

const log = createLogger('tenant.service');

export const tenantService = {
  getTenants,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
};

async function getTenants() {
  const collection = await getCollection(COLLECTIONS.TENANT);
  return collection.find({ isActive: true }).sort({ name: 1 }).toArray();
}

async function getTenantById(tenantId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  return tenant;
}

async function getTenantBySlug(slug) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({ slug, isActive: true });

  if (!tenant) {
    throw new Error(`Tenant with slug "${slug}" not found`);
  }

  return tenant;
}

async function createTenant(tenantData) {
  const { error, value } = validateTenant(tenantData);
  if (error) throw error;

  const collection = await getCollection(COLLECTIONS.TENANT);

  // Check slug uniqueness
  const existing = await collection.findOne({ slug: value.slug });
  if (existing) {
    throw new Error(`Tenant with slug "${value.slug}" already exists`);
  }

  value.createdAt = new Date();
  value.updatedAt = new Date();

  const result = await collection.insertOne(value);
  log.info({ tenantId: result.insertedId.toString(), slug: value.slug }, 'Tenant created');

  return { _id: result.insertedId, ...value };
}

async function updateTenant(tenantId, tenantData) {
  const { error, value } = validateTenant(tenantData, true);
  if (error) throw error;

  value.updatedAt = new Date();

  const collection = await getCollection(COLLECTIONS.TENANT);

  // If slug is being changed, check uniqueness
  if (value.slug) {
    const existing = await collection.findOne({
      slug: value.slug,
      _id: { $ne: ObjectId.createFromHexString(tenantId) },
    });
    if (existing) {
      throw new Error(`Tenant with slug "${value.slug}" already exists`);
    }
  }

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    { $set: value },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  log.info({ tenantId }, 'Tenant updated');
  return result;
}
