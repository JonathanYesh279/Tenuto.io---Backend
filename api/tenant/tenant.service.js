import { getCollection } from '../../services/mongoDB.service.js';
import { validateTenant, validateRoom } from './tenant.validation.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { processUploadedFile, deleteFile, STORAGE_MODE } from '../../services/fileStorage.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
import XLSX from 'xlsx';

const log = createLogger('tenant.service');

export const tenantService = {
  getTenants,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
  uploadLogo,
  deleteLogo,
  getRooms,
  addRoom,
  updateRoom,
  deactivateRoom,
  deleteRoom,
  importRooms,
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

async function uploadLogo(tenantId, file) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  // Delete old logo if exists
  const oldLogoUrl = tenant.branding?.logoUrl;
  if (oldLogoUrl) {
    try {
      await deleteFile(oldLogoUrl);
    } catch (err) {
      log.warn({ err: err.message, tenantId }, 'Failed to delete old logo, continuing');
    }
  }

  // Process and store new logo
  // memoryStorage doesn't set file.filename — write to disk for local mode
  if (STORAGE_MODE === 'local' && file.buffer && !file.filename) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `logo-${tenantId}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(filePath, file.buffer);
    file.filename = filename;
  }
  const { url, key } = await processUploadedFile(file);

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $set: {
        'branding.logoUrl': url,
        'branding.logoKey': key || null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  log.info({ tenantId, logoUrl: url }, 'Tenant logo uploaded');
  return result;
}

async function deleteLogo(tenantId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }

  const logoUrl = tenant.branding?.logoUrl;
  if (logoUrl) {
    try {
      await deleteFile(logoUrl);
    } catch (err) {
      log.warn({ err: err.message, tenantId }, 'Failed to delete logo file, continuing');
    }
  }

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $set: {
        'branding.logoUrl': null,
        'branding.logoKey': null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  log.info({ tenantId }, 'Tenant logo deleted');
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

  // Only auto-discover when settings.rooms has never been initialized
  if (!tenant.settings?.rooms) {
    const discoveredNames = await discoverRoomNames(tenantId);
    if (discoveredNames.length > 0) {
      const newRooms = discoveredNames.map(name => ({
        _id: new ObjectId(),
        name,
        isActive: true,
        createdAt: new Date(),
      }));

      await collection.updateOne(
        { _id: ObjectId.createFromHexString(tenantId) },
        {
          $set: { 'settings.rooms': newRooms, updatedAt: new Date() },
        }
      );

      log.info({ tenantId, synced: newRooms.length }, 'Initial room sync from activities');
      return newRooms;
    }
    return [];
  }

  return tenant.settings.rooms;
}

/**
 * Discover unique room names from timeBlocks, rehearsals, and theory lessons.
 */
async function discoverRoomNames(tenantId) {
  // tenantId is stored as string in activity collections
  const tenantFilter = { $in: [tenantId, ObjectId.createFromHexString(tenantId)] };
  const locations = new Set();

  // TimeBlock locations from teachers
  const teacherCol = await getCollection(COLLECTIONS.TEACHER);
  const teachers = await teacherCol.find(
    { tenantId: tenantFilter, 'teaching.timeBlocks.location': { $exists: true, $ne: '' } },
    { projection: { 'teaching.timeBlocks.location': 1 } }
  ).toArray();
  for (const t of teachers) {
    for (const tb of t.teaching?.timeBlocks || []) {
      if (tb.location) locations.add(tb.location.trim().replace(/\s+/g, ' '));
    }
  }

  // Rehearsal locations
  const rehearsalCol = await getCollection(COLLECTIONS.REHEARSAL);
  const rehearsals = await rehearsalCol.find(
    { tenantId: tenantFilter, location: { $exists: true, $ne: '' } },
    { projection: { location: 1 } }
  ).toArray();
  for (const r of rehearsals) {
    if (r.location) locations.add(r.location.trim().replace(/\s+/g, ' '));
  }

  // Theory lesson locations
  const theoryCol = await getCollection(COLLECTIONS.THEORY_LESSON);
  const theoryLessons = await theoryCol.find(
    { tenantId: tenantFilter, location: { $exists: true, $ne: '' } },
    { projection: { location: 1 } }
  ).toArray();
  for (const tl of theoryLessons) {
    if (tl.location) locations.add(tl.location.trim().replace(/\s+/g, ' '));
  }

  return [...locations].sort();
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

async function deleteRoom(tenantId, roomId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    {
      $pull: { 'settings.rooms': { _id: ObjectId.createFromHexString(roomId) } },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Room not found');
  }

  log.info({ tenantId, roomId }, 'Room deleted');
  return result.settings?.rooms || [];
}

/**
 * Import rooms from an Excel file buffer.
 * Reads room names from column A of the first sheet, normalizes them,
 * skips duplicates (both within the file and against existing rooms),
 * and adds new rooms to the tenant's settings.rooms[].
 */
async function importRooms(tenantId, buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length === 0) {
    throw new Error('Excel file is empty');
  }

  // Detect header row — skip if first cell matches common header labels
  const HEADER_PATTERNS = ['name', 'room', 'rooms', '\u05D7\u05D3\u05E8', '\u05E9\u05DD', '\u05E9\u05DD \u05D7\u05D3\u05E8'];
  let startIndex = 0;
  const firstCell = String(rows[0]?.[0] || '').trim().toLowerCase();
  if (HEADER_PATTERNS.includes(firstCell)) {
    startIndex = 1;
  }

  // Extract and normalize names from column A
  const seen = new Set();
  const names = [];
  for (let i = startIndex; i < rows.length; i++) {
    const raw = rows[i]?.[0];
    if (raw === undefined || raw === null) continue;
    const name = String(raw).trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  if (names.length === 0) {
    throw new Error('No room names found in Excel file');
  }

  // Get existing rooms
  const existingRooms = await getRooms(tenantId);
  const existingNames = new Set(existingRooms.map(r => r.name));

  // Determine new rooms
  const newRooms = [];
  let skipped = 0;
  for (const name of names) {
    if (existingNames.has(name)) {
      skipped++;
      continue;
    }
    newRooms.push({
      _id: new ObjectId(),
      name,
      isActive: true,
      createdAt: new Date(),
    });
  }

  if (newRooms.length > 0) {
    const collection = await getCollection(COLLECTIONS.TENANT);
    await collection.updateOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      {
        $push: { 'settings.rooms': { $each: newRooms } },
        $set: { updatedAt: new Date() },
      }
    );
  }

  const allRooms = await getRooms(tenantId);
  log.info(
    { tenantId, added: newRooms.length, skipped },
    'Rooms imported from Excel'
  );

  return { added: newRooms.length, skipped, rooms: allRooms };
}
