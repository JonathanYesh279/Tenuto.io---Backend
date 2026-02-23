/**
 * Cross-Tenant Allowlist
 *
 * This file documents every route intentionally exempt from enforceTenant middleware.
 * It serves as the canonical security reference for tenant isolation decisions.
 *
 * Rules:
 * 1. If a route is NOT in this allowlist and does NOT have enforceTenant, it is a security gap.
 * 2. The allowCrossTenant flag means the route intentionally operates without tenant scoping.
 * 3. The requiredRole documents what authorization is required (null = public/pre-auth).
 * 4. Admin routes (/api/admin/*) are NOT in this allowlist because they use enforceTenant
 *    (tenant-scoped to admin's own tenant via JWT tenantId).
 *
 * Maintenance:
 * - When adding new routes to server.js, either add enforceTenant or add an entry here.
 * - When removing routes, remove the corresponding entry from this file.
 * - Review this file during security audits to ensure no gaps exist.
 */

export const CROSS_TENANT_ALLOWLIST = Object.freeze([
  // ── AUTH ───────────────────────────────────────────────────────────────
  {
    route: '/api/auth/*',
    method: '*',
    reason:
      'Auth operates before tenant context is established; login, password reset, token refresh, tenant selection all pre-tenant',
    requiredRole: null,
    allowCrossTenant: true,
    category: 'AUTH',
  },

  // ── SUPER_ADMIN ────────────────────────────────────────────────────────
  {
    route: '/api/super-admin/*',
    method: '*',
    reason:
      'Super admin manages all tenants by design; uses separate authenticateSuperAdmin middleware with super_admin JWT type',
    requiredRole: 'super_admin',
    allowCrossTenant: true,
    category: 'SUPER_ADMIN',
  },

  // ── TENANT_MGMT ────────────────────────────────────────────────────────
  {
    route: '/api/tenant/*',
    method: '*',
    reason:
      'Tenant CRUD manages tenant records themselves; tenant collection is inherently cross-tenant',
    requiredRole: 'מנהל',
    allowCrossTenant: true,
    category: 'TENANT_MGMT',
  },

  // ── SYSTEM ─────────────────────────────────────────────────────────────
  {
    route: '/api/health/*',
    method: 'GET',
    reason:
      'Health checks are system-level liveness/readiness probes, not tenant-scoped',
    requiredRole: null,
    allowCrossTenant: true,
    category: 'SYSTEM',
  },
  {
    route: '/api/files/*',
    method: 'GET',
    reason: 'Static file serving, no tenant-scoped data',
    requiredRole: null,
    allowCrossTenant: true,
    category: 'SYSTEM',
  },
  {
    route: '/api/config',
    method: 'GET',
    reason: 'Public frontend configuration endpoint',
    requiredRole: null,
    allowCrossTenant: true,
    category: 'SYSTEM',
  },
]);

export const ALLOWLIST_CATEGORIES = Object.freeze({
  AUTH: 'Public authentication endpoints operating before tenant context is established',
  SUPER_ADMIN:
    'Platform-level super admin endpoints with separate auth path',
  TENANT_MGMT:
    'Tenant CRUD operations managing tenant records themselves',
  SYSTEM: 'System-level endpoints (health, config, static files)',
});
