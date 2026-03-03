import { getCollection } from '../../services/mongoDB.service.js';
import { validateTenant, validateRoom } from './tenant.validation.js';
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
  getRooms,
  addRoom,
  updateRoom,
  deactivateRoom,
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

async function getRooms(tenantId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne(
    { _id: ObjectId.createFromHexString(tenantId) },
    { projection: { 'settings.rooms': 1 } }
  );

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  return tenant.settings?.rooms || [];
}

async function addRoom(tenantId, roomData) {
  const { error, value } = validateRoom(roomData);
  if (error) throw error;

  const normalizedName = value.name.trim().replace(/\s+/g, ' ');

  // Check for duplicate name
  const existingRooms = await getRooms(tenantId);
  const duplicate = existingRooms.find(
    r => r.name === normalizedName && r.isActive !== false
  );
  if (duplicate) {
    throw new Error(`Room with name "${normalizedName}" already exists`);
  }

  const newRoom = {
    _id: new ObjectId(),
    name: normalizedName,
    isActive: true,
    createdAt: new Date(),
  };

  const collection = await getCollection(COLLECTIONS.TENANT);
  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $push: { 'settings.rooms': newRoom },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  log.info({ tenantId, roomId: newRoom._id.toString(), roomName: normalizedName }, 'Room added');
  return newRoom;
}

async function updateRoom(tenantId, roomId, roomData) {
  const { error, value } = validateRoom(roomData);
  if (error) throw error;

  const normalizedName = value.name.trim().replace(/\s+/g, ' ');

  // Check for duplicate name excluding current room
  const existingRooms = await getRooms(tenantId);
  const duplicate = existingRooms.find(
    r => r.name === normalizedName && r._id.toString() !== roomId && r.isActive !== false
  );
  if (duplicate) {
    throw new Error(`Room with name "${normalizedName}" already exists`);
  }

  const collection = await getCollection(COLLECTIONS.TENANT);
  const result = await collection.findOneAndUpdate(
    {
      _id: ObjectId.createFromHexString(tenantId),
      'settings.rooms._id': ObjectId.createFromHexString(roomId),
    },
    {
      $set: {
        'settings.rooms.$.name': normalizedName,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Room not found');
  }

  log.info({ tenantId, roomId, roomName: normalizedName }, 'Room updated');
  return result.settings?.rooms || [];
}

async function deactivateRoom(tenantId, roomId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const result = await collection.findOneAndUpdate(
    {
      _id: ObjectId.createFromHexString(tenantId),
      'settings.rooms._id': ObjectId.createFromHexString(roomId),
    },
    {
      $set: {
        'settings.rooms.$.isActive': false,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Room not found');
  }

  log.info({ tenantId, roomId }, 'Room deactivated');
  return result.settings?.rooms || [];
}
