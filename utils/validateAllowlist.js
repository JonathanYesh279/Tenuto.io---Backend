/**
 * Route Accountability Validation Utility
 *
 * Verifies that every route registered in server.js is accounted for —
 * either enforced via enforceTenant middleware or documented in CROSS_TENANT_ALLOWLIST.
 *
 * This is a static-analysis safety net. It does NOT introspect Express at runtime.
 * Instead, it maintains two arrays of known route prefixes and checks them against
 * the allowlist constant.
 *
 * MAINTENANCE:
 * When a developer adds a new route to server.js, they MUST do one of:
 *
 *   1. Add enforceTenant + stripTenantId to the middleware chain
 *      AND add the prefix to ENFORCED_ROUTE_PREFIXES below.
 *
 *   2. Add an entry to CROSS_TENANT_ALLOWLIST in config/crossTenantAllowlist.js
 *      AND add the prefix to ALL_REGISTERED_PREFIXES below.
 *
 * Then run: node utils/validateAllowlist.js
 * If validation fails, a route is unaccounted for — fix it before merging.
 *
 * @module utils/validateAllowlist
 */

import { CROSS_TENANT_ALLOWLIST } from '../config/crossTenantAllowlist.js';

/**
 * Route prefixes that have enforceTenant + stripTenantId in their middleware chain.
 * Ordered to match server.js registration order.
 */
const ENFORCED_ROUTE_PREFIXES = [
  '/api/student',
  '/api/teachers',                       // plural alias for teacher routes
  '/api/teacher',
  '/api/orchestra',
  '/api/rehearsal',
  '/api/theory',
  '/api/bagrut',
  '/api/school-year',
  '/api/schedule',
  '/api/attendance',
  '/api/analytics',
  '/api/hours-summary',
  '/api/import',
  '/api/export',
  '/api/admin/consistency-validation',
  '/api/admin/date-monitoring',
  '/api/admin/past-activities',
  '/api/admin',                          // cascade deletion (broad /api/admin prefix)
  '/api/admin/cleanup',
  // time-block uses broad /api prefix with enforceTenant
  '/api',                                // time-block routes (mounted at /api, AFTER all specific routes)
];

/**
 * Every app.use('/api/...') prefix registered in server.js.
 * This is the union of ENFORCED_ROUTE_PREFIXES and exempt routes.
 */
const ALL_REGISTERED_PREFIXES = [
  // Enforced routes (data access + admin)
  ...ENFORCED_ROUTE_PREFIXES,
  // Exempt routes (documented in CROSS_TENANT_ALLOWLIST)
  '/api/auth',
  '/api/tenant',
  '/api/super-admin',
  '/api/health',
  '/api/files',
  '/api/config',
];

/**
 * Checks whether a route prefix is covered by the CROSS_TENANT_ALLOWLIST.
 *
 * Handles wildcard matching: an allowlist entry with route '/api/auth/*'
 * covers the prefix '/api/auth'.
 *
 * @param {string} prefix - Route prefix to check (e.g., '/api/auth')
 * @returns {boolean} True if the prefix is allowlisted
 */
function isAllowlisted(prefix) {
  return CROSS_TENANT_ALLOWLIST.some((entry) => {
    const route = entry.route;
    // Exact match
    if (route === prefix) return true;
    // Wildcard match: '/api/auth/*' covers '/api/auth'
    if (route.endsWith('/*')) {
      const base = route.slice(0, -2); // Remove '/*'
      return prefix === base || prefix.startsWith(base + '/');
    }
    // Prefix starts with route (e.g., prefix '/api/config' starts with route '/api/config')
    if (prefix.startsWith(route)) return true;
    return false;
  });
}

/**
 * Validates that every registered route prefix is accounted for —
 * either via enforceTenant middleware or via the CROSS_TENANT_ALLOWLIST.
 *
 * @returns {{
 *   valid: boolean,
 *   unaccountedRoutes: string[],
 *   enforcedCount: number,
 *   allowlistedCount: number,
 *   totalRoutes: number
 * }}
 */
export function validateRouteAccountability() {
  const unaccountedRoutes = [];
  let enforcedCount = 0;
  let allowlistedCount = 0;

  for (const prefix of ALL_REGISTERED_PREFIXES) {
    const isEnforced = ENFORCED_ROUTE_PREFIXES.includes(prefix);
    const isAllowlistedRoute = isAllowlisted(prefix);

    if (isEnforced) {
      enforcedCount++;
    } else if (isAllowlistedRoute) {
      allowlistedCount++;
    } else {
      unaccountedRoutes.push(prefix);
    }
  }

  return {
    valid: unaccountedRoutes.length === 0,
    unaccountedRoutes,
    enforcedCount,
    allowlistedCount,
    totalRoutes: ALL_REGISTERED_PREFIXES.length,
  };
}

/**
 * Runs the validation and logs results. Exits with code 1 on failure.
 * Suitable for CI pipelines or server startup assertions.
 */
export function runValidation() {
  const result = validateRouteAccountability();

  console.log('=== Route Accountability Validation ===');
  console.log(`Total registered routes: ${result.totalRoutes}`);
  console.log(`  Enforced (enforceTenant): ${result.enforcedCount}`);
  console.log(`  Allowlisted (CROSS_TENANT_ALLOWLIST): ${result.allowlistedCount}`);
  console.log(`  Unaccounted: ${result.unaccountedRoutes.length}`);

  if (result.valid) {
    console.log('\nAll routes accounted for. No security gaps detected.');
  } else {
    console.error('\nSECURITY GAP: The following routes are neither enforced nor allowlisted:');
    for (const route of result.unaccountedRoutes) {
      console.error(`  - ${route}`);
    }
    console.error(
      '\nFix: Add enforceTenant to the middleware chain OR add an entry to CROSS_TENANT_ALLOWLIST.'
    );
    process.exit(1);
  }
}

// Run directly: node utils/validateAllowlist.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation();
}
