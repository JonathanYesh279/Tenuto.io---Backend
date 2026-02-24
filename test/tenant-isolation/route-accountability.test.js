/**
 * Route Accountability Tests (TEST-03 regression safety net)
 *
 * Wraps validateRouteAccountability() from utils/validateAllowlist.js
 * as a vitest test. When a developer adds a new route to server.js
 * without adding enforceTenant or an allowlist entry, this test fails.
 *
 * These are pure logic tests -- no MMS or HTTP needed.
 */

import { describe, it, expect } from 'vitest';
import { validateRouteAccountability } from '../../utils/validateAllowlist.js';

describe('Route Accountability', () => {
  it('every registered route is either enforced or allowlisted', () => {
    const result = validateRouteAccountability();
    expect(result.valid).toBe(true);
    expect(result.unaccountedRoutes).toEqual([]);
  });

  it('reports correct counts', () => {
    const result = validateRouteAccountability();
    expect(result.totalRoutes).toBeGreaterThan(0);
    expect(result.enforcedCount).toBeGreaterThan(0);
    expect(result.allowlistedCount).toBeGreaterThan(0);
  });
});
