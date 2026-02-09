import { superAdminService } from './super-admin.service.js';
import { tenantService } from '../tenant/tenant.service.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('super-admin.controller');

export const superAdminController = {
  login,
  logout,
  seed,
  getAdmins,
  createAdmin,
  updateAdmin,
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  updateSubscription,
  toggleTenantActive,
  getAnalytics,
};

async function login(req, res) {
  try {
    const result = await superAdminService.login(req.body.email, req.body.password);
    res.json({ success: true, data: result });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin login error');
    res.status(401).json({ success: false, error: err.message });
  }
}

async function logout(req, res) {
  try {
    await superAdminService.logout(req.superAdmin._id.toString());
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin logout error');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function seed(req, res) {
  try {
    const result = await superAdminService.seedSuperAdmin(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin seed error');
    const status = err.status || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function getAdmins(req, res) {
  try {
    const admins = await superAdminService.getSuperAdmins();
    res.json({ success: true, data: admins });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting super admins');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createAdmin(req, res) {
  try {
    const admin = await superAdminService.createSuperAdmin(req.body);
    res.status(201).json({ success: true, data: admin });
  } catch (err) {
    log.error({ err: err.message }, 'Error creating super admin');
    const status = err.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function updateAdmin(req, res) {
  try {
    const admin = await superAdminService.updateSuperAdmin(req.params.id, req.body);
    res.json({ success: true, data: admin });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating super admin');
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function getTenants(req, res) {
  try {
    const tenants = await superAdminService.getTenantsWithStats();
    res.json({ success: true, data: tenants });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting tenants with stats');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getTenantById(req, res) {
  try {
    const tenant = await superAdminService.getTenantWithStats(req.params.id);
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

async function updateSubscription(req, res) {
  try {
    const tenant = await superAdminService.updateSubscription(req.params.id, req.body);
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating subscription');
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function toggleTenantActive(req, res) {
  try {
    const tenant = await superAdminService.toggleTenantActive(req.params.id);
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error toggling tenant active');
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function getAnalytics(req, res) {
  try {
    const analytics = await superAdminService.getPlatformAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting platform analytics');
    res.status(500).json({ success: false, error: err.message });
  }
}
