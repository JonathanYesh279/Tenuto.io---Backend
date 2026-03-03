import { tenantService } from './tenant.service.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('tenant.controller');

export const tenantController = {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getRooms,
  addRoom,
  updateRoom,
  deactivateRoom,
};

async function getTenants(req, res) {
  try {
    const tenants = await tenantService.getTenants();
    res.json({ success: true, data: tenants });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting tenants');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getTenantById(req, res) {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting tenant');
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function createTenant(req, res) {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error creating tenant');
    const status = err.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function updateTenant(req, res) {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body);
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating tenant');
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function getRooms(req, res) {
  try {
    const rooms = await tenantService.getRooms(req.params.id);
    res.json({ success: true, data: rooms });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting rooms');
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function addRoom(req, res) {
  try {
    const room = await tenantService.addRoom(req.params.id, req.body);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    log.error({ err: err.message }, 'Error adding room');
    const status = err.message.includes('already exists')
      ? 409
      : err.message.includes('not found')
        ? 404
        : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const rooms = await tenantService.updateRoom(req.params.id, req.params.roomId, req.body);
    res.json({ success: true, data: rooms });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating room');
    const status = err.message.includes('already exists')
      ? 409
      : err.message.includes('not found')
        ? 404
        : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function deactivateRoom(req, res) {
  try {
    const rooms = await tenantService.deactivateRoom(req.params.id, req.params.roomId);
    res.json({ success: true, data: rooms });
  } catch (err) {
    log.error({ err: err.message }, 'Error deactivating room');
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}
