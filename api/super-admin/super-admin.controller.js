import { superAdminService } from './super-admin.service.js';
import { tenantService } from '../tenant/tenant.service.js';
import { softDeleteTenantSchema, purgeTenantSchema } from './super-admin.validation.js';
import { auditTrailService } from '../../services/auditTrail.service.js';
import { AUDIT_ACTIONS } from '../../config/constants.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('super-admin.controller');

export const superAdminController = {
  login,
  logout,
  refresh,
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
  deletionPreview,
  softDelete,
  cancelDeletion,
  purge,
  getAuditLog,
  getTenantAuditLog,
};

async function login(req, res) {
  try {
    const result = await superAdminService.login(req.body.email, req.body.password);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({ success: true, data: result });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin login error');
    res.status(401).json({ success: false, error: err.message });
  }
}

async function logout(req, res) {
  try {
    await superAdminService.logout(req.superAdmin._id.toString());

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin logout error');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    const { accessToken } = await superAdminService.refreshAccessToken(refreshToken);
    res.json({
      success: true,
      data: { accessToken },
      message: 'Token refreshed successfully',
    });
  } catch (err) {
    log.error({ err: err.message }, 'Super admin refresh token error');
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
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
    const admin = await superAdminService.createSuperAdmin(req.body, req.superAdmin._id.toString());
    res.status(201).json({ success: true, data: admin });
  } catch (err) {
    log.error({ err: err.message }, 'Error creating super admin');
    const status = err.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function updateAdmin(req, res) {
  try {
    const admin = await superAdminService.updateSuperAdmin(req.params.id, req.body, req.superAdmin._id.toString());
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

    await auditTrailService.logAction(AUDIT_ACTIONS.TENANT_CREATED, req.superAdmin._id.toString(), {
      targetId: tenant._id?.toString() || tenant.tenantId,
      tenantName: tenant.name,
    });

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

    await auditTrailService.logAction(AUDIT_ACTIONS.TENANT_UPDATED, req.superAdmin._id.toString(), {
      targetId: req.params.id,
      changes: Object.keys(req.body),
    });

    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating tenant');
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function updateSubscription(req, res) {
  try {
    const tenant = await superAdminService.updateSubscription(req.params.id, req.body, req.superAdmin._id.toString());
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error updating subscription');
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function toggleTenantActive(req, res) {
  try {
    const tenant = await superAdminService.toggleTenantActive(req.params.id, req.superAdmin._id.toString());
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

// ─── Tenant Lifecycle Endpoints ──────────────────────────────────────────────

async function deletionPreview(req, res) {
  try {
    const preview = await superAdminService.deletionPreview(req.params.id);
    res.json({ success: true, data: preview });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting deletion preview');
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function softDelete(req, res) {
  try {
    const { error, value } = softDeleteTenantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const tenant = await superAdminService.softDeleteTenant(
      req.params.id,
      value,
      req.superAdmin._id.toString()
    );
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error soft-deleting tenant');
    const status = err.message.includes('not found') ? 404 : err.message.includes('already in deletion') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function cancelDeletion(req, res) {
  try {
    const tenant = await superAdminService.cancelDeletion(
      req.params.id,
      req.superAdmin._id.toString()
    );
    res.json({ success: true, data: tenant });
  } catch (err) {
    log.error({ err: err.message }, 'Error cancelling tenant deletion');
    const status = err.message.includes('not found') ? 404 : err.message.includes('Cannot cancel') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function purge(req, res) {
  try {
    const { error, value } = purgeTenantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    // Safety check: confirm tenant name matches
    const tenantData = await superAdminService.getTenantWithStats(req.params.id);
    if (tenantData.name !== value.confirmTenantName) {
      return res.status(400).json({
        success: false,
        error: 'Tenant name confirmation does not match',
      });
    }

    const result = await superAdminService.purgeTenant(
      req.params.id,
      req.superAdmin._id.toString()
    );
    res.json({ success: true, data: result });
  } catch (err) {
    log.error({ err: err.message }, 'Error purging tenant');
    const status = err.message.includes('not found') ? 404 : err.message.includes('must be soft-deleted') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
}

async function getAuditLog(req, res) {
  try {
    const entries = await superAdminService.getPlatformAuditLog(req.query);
    res.json({ success: true, data: entries });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting platform audit log');
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getTenantAuditLog(req, res) {
  try {
    const entries = await superAdminService.getTenantAuditLog(req.params.tenantId);
    res.json({ success: true, data: entries });
  } catch (err) {
    log.error({ err: err.message }, 'Error getting tenant audit log');
    res.status(500).json({ success: false, error: err.message });
  }
}
