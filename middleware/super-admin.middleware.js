import jwt from 'jsonwebtoken';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../services/logger.service.js';
import { COLLECTIONS } from '../config/constants.js';

const log = createLogger('super-admin.middleware');

export async function authenticateSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      log.debug({ path: req.path }, 'No auth token found');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    if (!token || token === 'undefined' || token === 'null') {
      log.debug({ path: req.path }, 'Invalid token format');
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.type !== 'super_admin') {
      log.debug({ type: decoded.type }, 'Token is not a super admin token');
      return res.status(403).json({
        success: false,
        error: 'Super admin access required',
        code: 'NOT_SUPER_ADMIN'
      });
    }

    const collection = await getCollection(COLLECTIONS.SUPER_ADMIN);
    const admin = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      isActive: true,
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Super admin not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.superAdmin = admin;
    next();
  } catch (err) {
    log.debug({ errName: err.name, errMessage: err.message }, 'Super admin authentication error');

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

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.superAdmin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.superAdmin.permissions || !req.superAdmin.permissions.includes(permission)) {
      log.debug({ required: permission, current: req.superAdmin.permissions }, 'Insufficient permissions');
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
    }

    next();
  };
}
