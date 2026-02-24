import { getDB } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from './logger.service.js';
import { TENANT_SCOPED_COLLECTIONS, COLLECTIONS } from '../config/constants.js';

const log = createLogger('tenant-purge');

export const tenantPurgeService = {
  previewDeletion,
  createTenantSnapshot,
  purgeTenant,
};

/**
 * Preview the impact of deleting a tenant by counting documents per collection.
 *
 * @param {string} tenantId - The tenant ID string
 * @returns {Promise<{ counts: Object, total: number }>}
 */
async function previewDeletion(tenantId) {
  const db = getDB();

  const countPromises = TENANT_SCOPED_COLLECTIONS.map(async (name) => {
    const count = await db.collection(name).countDocuments({ tenantId });
    return { collection: name, count };
  });

  const results = await Promise.all(countPromises);

  const counts = {};
  let total = 0;
  for (const { collection, count } of results) {
    counts[collection] = count;
    total += count;
  }

  return { counts, total };
}

/**
 * Create a pre-deletion snapshot of all tenant data, split per collection
 * to avoid the 16MB BSON limit.
 *
 * @param {string} tenantId - The tenant ID string
 * @returns {Promise<{ snapshotId: ObjectId, collectionCount: number, totalDocuments: number }>}
 */
async function createTenantSnapshot(tenantId) {
  const db = getDB();
  const snapshotId = new ObjectId();
  let collectionCount = 0;
  let totalDocuments = 0;

  for (const name of TENANT_SCOPED_COLLECTIONS) {
    const docs = await db.collection(name).find({ tenantId }).toArray();
    if (docs.length > 0) {
      await db.collection(COLLECTIONS.TENANT_DELETION_SNAPSHOTS).insertOne({
        snapshotId,
        tenantId,
        collection: name,
        documents: docs,
        documentCount: docs.length,
        createdAt: new Date(),
      });
      collectionCount++;
      totalDocuments += docs.length;
    }
  }

  // Also snapshot the tenant document itself
  const tenantDoc = await db
    .collection(COLLECTIONS.TENANT)
    .findOne({ _id: ObjectId.createFromHexString(tenantId) });

  if (tenantDoc) {
    await db.collection(COLLECTIONS.TENANT_DELETION_SNAPSHOTS).insertOne({
      snapshotId,
      tenantId,
      collection: 'tenant',
      documents: [tenantDoc],
      documentCount: 1,
      createdAt: new Date(),
    });
    collectionCount++;
    totalDocuments += 1;
  }

  log.info(
    { snapshotId: snapshotId.toString(), tenantId, collectionCount, totalDocuments },
    'Tenant snapshot created'
  );

  return { snapshotId, collectionCount, totalDocuments };
}

/**
 * Permanently purge all tenant data within a MongoDB transaction.
 * The caller must create a snapshot BEFORE calling this method.
 *
 * @param {string} tenantId - The tenant ID string
 * @param {ObjectId} snapshotId - The snapshot ID for audit reference
 * @returns {Promise<{ success: boolean, snapshotId: ObjectId, tenantId: string }>}
 */
async function purgeTenant(tenantId, snapshotId) {
  const db = getDB();
  const session = db.startSession();

  try {
    await session.withTransaction(async () => {
      // Delete tenant-scoped data sequentially (MongoDB transactions don't support parallel ops)
      for (const name of TENANT_SCOPED_COLLECTIONS) {
        await db.collection(name).deleteMany({ tenantId }, { session });
      }

      // Delete the tenant document itself
      await db
        .collection(COLLECTIONS.TENANT)
        .deleteOne({ _id: ObjectId.createFromHexString(tenantId) }, { session });
    });

    log.info(
      { tenantId, snapshotId: snapshotId?.toString() },
      'Tenant purged successfully'
    );

    return { success: true, snapshotId, tenantId };
  } catch (err) {
    log.error(
      { err: err.message, tenantId, snapshotId: snapshotId?.toString() },
      'Tenant purge failed'
    );
    throw new Error(`Tenant purge failed: ${err.message}`);
  } finally {
    await session.endSession();
  }
}
