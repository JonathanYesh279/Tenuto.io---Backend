/**
 * CROSS_TENANT_ALLOWLIST Verification Tests (TEST-04)
 *
 * Verifies that the cross-tenant allowlist is:
 * - Complete (correct number of entries)
 * - Consistent (all required fields, valid categories)
 * - Frozen (immutable at runtime)
 * - Behaviorally correct (auth=null, super_admin=super_admin, etc.)
 *
 * Also includes a live HTTP test proving the health endpoint
 * works without authentication (allowlisted SYSTEM route).
 *
 * These tests are pure logic except for the health endpoint test,
 * which uses supertest with the real test app and MMS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  CROSS_TENANT_ALLOWLIST,
  ALLOWLIST_CATEGORIES,
} from '../../config/crossTenantAllowlist.js';
import {
  setupTenantIsolationDB,
  teardownTenantIsolationDB,
  patchMongoDBService,
} from './setup.js';

// ── Pure structure tests (no DB needed) ─────────────────────────────────────

describe('CROSS_TENANT_ALLOWLIST Structure', () => {
  it('has exactly 6 entries', () => {
    expect(CROSS_TENANT_ALLOWLIST.length).toBe(6);
  });

  it('every entry has required fields (route, method, reason, category, requiredRole, allowCrossTenant)', () => {
    const requiredFields = ['route', 'method', 'reason', 'category', 'requiredRole', 'allowCrossTenant'];
    for (const entry of CROSS_TENANT_ALLOWLIST) {
      for (const field of requiredFields) {
        expect(entry).toHaveProperty(field);
      }
    }
  });

  it('every entry category is a valid ALLOWLIST_CATEGORIES key', () => {
    const validCategories = Object.keys(ALLOWLIST_CATEGORIES);
    for (const entry of CROSS_TENANT_ALLOWLIST) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it('all entries are frozen (immutable)', () => {
    expect(Object.isFrozen(CROSS_TENANT_ALLOWLIST)).toBe(true);
  });
});

describe('CROSS_TENANT_ALLOWLIST Behavioral Contracts', () => {
  it('AUTH routes have requiredRole: null (pre-authentication)', () => {
    const authEntries = CROSS_TENANT_ALLOWLIST.filter(e => e.category === 'AUTH');
    expect(authEntries.length).toBeGreaterThan(0);
    for (const entry of authEntries) {
      expect(entry.requiredRole).toBeNull();
    }
  });

  it('SUPER_ADMIN routes require super_admin role', () => {
    const superAdminEntries = CROSS_TENANT_ALLOWLIST.filter(e => e.category === 'SUPER_ADMIN');
    expect(superAdminEntries.length).toBeGreaterThan(0);
    for (const entry of superAdminEntries) {
      expect(entry.requiredRole).toBe('super_admin');
    }
  });

  it('TENANT_MGMT routes require admin role', () => {
    const tenantEntries = CROSS_TENANT_ALLOWLIST.filter(e => e.category === 'TENANT_MGMT');
    expect(tenantEntries.length).toBeGreaterThan(0);
    for (const entry of tenantEntries) {
      expect(entry.requiredRole).toBe('\u05DE\u05E0\u05D4\u05DC');
    }
  });

  it('SYSTEM routes have requiredRole: null (public)', () => {
    const systemEntries = CROSS_TENANT_ALLOWLIST.filter(e => e.category === 'SYSTEM');
    expect(systemEntries.length).toBeGreaterThan(0);
    for (const entry of systemEntries) {
      expect(entry.requiredRole).toBeNull();
    }
  });

  it('every entry has allowCrossTenant: true', () => {
    for (const entry of CROSS_TENANT_ALLOWLIST) {
      expect(entry.allowCrossTenant).toBe(true);
    }
  });
});

// ── Live HTTP test (needs MMS + test app) ───────────────────────────────────

describe('Allowlisted Route Behavior - Health', () => {
  let app;

  beforeAll(async () => {
    const result = await setupTenantIsolationDB();
    patchMongoDBService(result.db);

    const { createTestApp } = await import('./helpers/test-app.js');
    app = createTestApp();
  }, 60000);

  afterAll(async () => {
    await teardownTenantIsolationDB();
  });

  it('GET /api/health/live returns 200 without authentication', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
  });
});
