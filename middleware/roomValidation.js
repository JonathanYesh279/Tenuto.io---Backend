import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '../config/constants.js';

/**
 * Dynamic room validation middleware.
 * Validates that `req.body.location` matches an active room in the tenant's settings.
 *
 * Backward compatibility: If the tenant has no rooms configured yet (rooms array
 * is empty), validation is skipped and any location is allowed. This supports
 * tenants that haven't migrated to the room management feature.
 *
 * Skips validation when no `location` field is present in the body (allows
 * partial updates that don't change location).
 */
export async function validateRoomExists(req, res, next) {
  const { location } = req.body;
  if (!location) return next(); // No location in payload — skip (partial update)

  const tenantId = req.context?.tenantId;
  if (!tenantId) return next(); // enforceTenant middleware already handles missing tenantId

  try {
    const collection = await getCollection(COLLECTIONS.TENANT);
    const tenant = await collection.findOne(
      { _id: ObjectId.createFromHexString(tenantId) },
      { projection: { 'settings.rooms': 1 } }
    );

    const rooms = tenant?.settings?.rooms || [];
    // If tenant has no rooms configured yet, allow any location (backward compat)
    if (rooms.length === 0) return next();

    const activeRoomNames = rooms.filter(r => r.isActive).map(r => r.name);
    if (!activeRoomNames.includes(location)) {
      return res.status(400).json({
        success: false,
        error: `\u05D7\u05D3\u05E8 "${location}" \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05D7\u05D3\u05E8\u05D9\u05DD \u05D4\u05E4\u05E2\u05D9\u05DC\u05D9\u05DD`,
        code: 'INVALID_ROOM',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}
