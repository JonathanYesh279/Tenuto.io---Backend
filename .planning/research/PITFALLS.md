# Domain Pitfalls: Super Admin Platform Management

**Domain:** Adding super admin tenant management, impersonation, cross-tenant reporting, and cascade deletion to existing multi-tenant Node.js + Express + MongoDB SaaS
**Researched:** 2026-02-24
**Confidence:** HIGH (based on direct codebase analysis of 11+ collections, existing cascade deletion systems, auth middleware, and real-world JWT vulnerabilities)

## Executive Summary

This analysis identifies pitfalls specific to **adding** super admin platform management capabilities to the existing Tenuto.io multi-tenant backend. The system has 5-layer tenant isolation (JWT tenantId, buildContext, enforceTenant, stripTenantId, requireTenantId guard), two parallel cascade deletion systems (transaction-based in `cascadeDeletion.service.js` and collection-based in `cascadeDeletionService.js`), and a super admin auth path (`authenticateSuperAdmin`) that is completely separate from the regular teacher auth path (`authenticateToken`).

The four most dangerous pitfalls are:

1. **Tenant cascade deletion will miss collections** -- the existing student cascade deletes touch 7 collections, but tenant deletion must handle 19 collections plus audit trails, and the two parallel cascade systems have incompatible interfaces.
2. **Super admin impersonation tokens will 401** -- the `authenticateToken` middleware looks up the user in the `teacher` collection, but super admin tokens reference the `super_admin` collection. Any impersonation feature must issue teacher-compatible tokens, not super admin tokens.
3. **Cross-tenant reports will bypass the tenant guard** -- `buildScopedFilter()` and `requireTenantId()` throw errors when tenantId is null, but cross-tenant aggregation queries intentionally omit tenantId. The guard must be relaxed for super admin analytics without creating a bypass for regular users.
4. **Frontend routing collision** -- the single-page app serves from `/public/index.html` for all non-API routes. A super admin dashboard needs separate layout/navigation but shares the same React app and auth storage.

---

## Critical Pitfalls

Mistakes that cause data loss, security breaches, or require architectural rework.

### Pitfall 1: Tenant Cascade Deletion Misses Collections

**What goes wrong:**
When implementing "delete entire tenant" functionality, developers model it after the existing student cascade deletion. But student deletion touches 7 collections; tenant deletion must handle all 19 collections in the `COLLECTIONS` constant, plus 3 system/audit collections that may not have tenantId fields. Collections get missed, leaving orphaned data that causes errors when the tenant is re-created with the same slug or when cross-tenant reports include ghost data.

**Why it happens:**
The existing codebase has **two separate cascade deletion systems** with different interfaces:

- `services/cascadeDeletion.service.js` -- Uses `db.startSession()` with `session.withTransaction()`, accepts `(studentId, userId, reason, context)`, uses `requireTenantId(context?.tenantId)`. Transaction-based, atomic.
- `services/cascadeDeletionService.js` -- Uses `studentCollection.client.startSession()`, accepts `(studentId, options)` where `options.context.tenantId`. Collection-based, sequential inside transaction.

Developers will pattern-match on one of these when building tenant deletion, but neither handles the full collection set. The complete list from `config/constants.js`:

```
Core (8): student, teacher, orchestra, rehearsal, theory_lesson, bagrut, school_year, activity_attendance
Computed (2): hours_summary, ministry_report_snapshots
Import (1): import_log
Audit (5): deletion_audit, deletion_snapshots, security_log, integrityAuditLog, integrityStatus
System (1): migration_backups
Tenant-specific: The tenant record itself
```

**Consequences:**
- Orphaned `hours_summary` records cause aggregation errors when tenant slug is reused
- Orphaned `deletion_audit` records with tenant data that should have been purged (compliance risk)
- `import_log` records with file references that point to deleted tenant data
- `school_year` records with `isCurrent: true` that interfere with new tenant creation on same DB
- Ghost data in cross-tenant analytics (`getPlatformAnalytics()` counts include deleted tenant)

**Detection:**
- After tenant deletion, run `db.collection.countDocuments({ tenantId: deletedTenantId })` on ALL collections
- Check `getPlatformAnalytics()` counts before and after deletion -- numbers should decrease
- Verify no `school_year` with deleted tenantId has `isCurrent: true`

**Prevention:**
1. Build a **tenant deletion manifest** that explicitly lists every collection and the deletion strategy for each (hard delete, soft delete, archive, skip)
2. Use the `COLLECTIONS` constant as the canonical list -- iterate it programmatically, do not hardcode collection names in the deletion function
3. **Two-phase deletion**: Phase 1 deactivates tenant (sets `isActive: false`), Phase 2 purges data after a grace period (7-30 days)
4. Add a post-deletion verification step that queries every collection for the deleted tenantId
5. Choose ONE cascade deletion pattern (recommend the transaction-based pattern from `cascadeDeletion.service.js` since it already uses `requireTenantId`)

**Which phase should address it:** Tenant lifecycle management phase. Must be one of the first things built because it establishes the deletion pattern all other deletions follow.

---

### Pitfall 2: Super Admin Token Incompatible with Tenant-Scoped Middleware

**What goes wrong:**
Super admin logs in, gets a JWT with `{ _id, type: 'super_admin', email }` (no tenantId). When the super admin navigates to a tenant detail page and tries to view tenant data (students, teachers, etc.), the frontend calls endpoints like `/api/student?tenantId=xxx`. These endpoints go through the middleware chain: `authenticateToken -> buildContext -> enforceTenant -> stripTenantId`. The `authenticateToken` middleware does `collection.findOne({ _id })` on the **teacher** collection -- the super admin is not a teacher, so it returns 401 `USER_NOT_FOUND`.

**Why it happens:**
The auth middleware (`middleware/auth.middleware.js` line 37) hardcodes teacher lookup:
```javascript
const collection = await getCollection('teacher');
const teacher = await collection.findOne({
  _id: ObjectId.createFromHexString(decoded._id),
  isActive: true,
});
```

The super admin middleware (`middleware/super-admin.middleware.js`) is completely separate -- it only protects `/api/super-admin/*` routes. There is no middleware that allows a super admin token to access tenant-scoped routes.

The `buildContext` middleware also depends on `req.teacher` existing (line 27: `if (!teacher) { return next(); }`) -- if teacher is null, `req.context` is never set, and `enforceTenant` blocks the request with `MISSING_TENANT`.

**Consequences:**
- Super admin cannot view any tenant's actual data through normal API endpoints
- Workaround of calling super admin-specific endpoints for every data type leads to massive API duplication
- If someone "fixes" it by skipping `enforceTenant` for super admin tokens, they create a tenant isolation bypass

**Detection:**
- Super admin login works, but clicking on any tenant detail shows 401 errors in browser console
- Frontend shows "Authentication required" on tenant detail pages
- Network tab shows responses with `code: 'USER_NOT_FOUND'` or `code: 'MISSING_TENANT'`

**Prevention:**
Two viable approaches (choose one):

**Approach A: Impersonation Token (Recommended)**
1. Add a super admin endpoint: `POST /api/super-admin/impersonate/:tenantId`
2. This endpoint creates a special JWT: `{ _id: superAdminId, type: 'impersonation', tenantId: targetTenantId, originalType: 'super_admin' }`
3. Modify `authenticateToken` to check `decoded.type`:
   - `undefined` or missing: existing teacher lookup (backward compatible)
   - `'impersonation'`: look up super admin in `super_admin` collection, set synthetic `req.teacher` with the impersonated tenantId and admin roles
   - `'super_admin'`: reject (super admin tokens should not reach tenant-scoped routes)
4. `buildContext` then works normally because `req.teacher.tenantId` is set
5. `enforceTenant` passes because `req.context.tenantId` is populated
6. All audit logs include `impersonatedBy: superAdminId` for traceability

**Approach B: Dual-Auth Middleware**
1. Create a unified auth middleware that tries super admin lookup first (by `type` claim), then teacher lookup
2. For super admin tokens, require explicit `tenantId` in request header/query
3. More complex, harder to audit, not recommended

**Critical guard rails for impersonation:**
- Impersonation tokens MUST have shorter expiry (15 minutes max)
- Every write operation MUST log `impersonatedBy` field
- Impersonation MUST be read-only unless explicitly enabled per-operation
- Token MUST include `iat` (issued at) and be single-use or very short-lived
- Frontend MUST show a visible "Impersonating [Tenant Name]" banner

**Which phase should address it:** First phase, because every subsequent super admin feature (viewing tenant data, cross-tenant reports, tenant management actions) depends on this auth bridge working.

---

### Pitfall 3: Cross-Tenant Reports Trigger Tenant Guard Exceptions

**What goes wrong:**
Super admin analytics need to query across all tenants (e.g., "total students per tenant", "subscription revenue"). But the tenant guard `requireTenantId()` throws `'TENANT_GUARD: tenantId is required but was not provided'` on any query without tenantId. The `buildScopedFilter()` utility also throws: `'buildScopedFilter requires context.tenantId'`. Developers either: (a) pass `null` and get exceptions, (b) bypass the guards entirely, or (c) duplicate query logic without guards.

**Why it happens:**
The tenant isolation was designed as fail-safe -- it crashes loudly when tenantId is missing. This is correct for tenant-scoped operations. But cross-tenant analytics are a legitimate use case that was not anticipated in the guard design. The guards are used in:

- `requireTenantId()` -- called at entry points of both cascade deletion services
- `buildScopedFilter()` -- called in student service and any service using query scoping
- `cascadeDeletionAggregationService` methods -- all take `tenantId` as required parameter
- `enforceTenant` middleware -- blocks requests without `req.context.tenantId`

**Consequences:**
- Runtime crashes in production when super admin triggers analytics
- If guards are bypassed: tenant isolation is weakened for ALL users, not just super admin
- If query logic is duplicated: two code paths to maintain, divergence risk
- `getTenantsWithStats()` in super admin service already works because it queries the tenant collection directly and does its own aggregation -- but this pattern does not generalize

**Detection:**
- Unhandled promise rejections in logs with `TENANT_GUARD` messages
- Analytics endpoint returns 500 errors
- `getPlatformAnalytics()` works (no guards) but detailed tenant breakdowns fail (guards)

**Prevention:**
1. Add a `crossTenantContext` factory function:
   ```javascript
   function buildCrossTenantContext(superAdminId) {
     return {
       tenantId: null,
       userId: superAdminId,
       isSuperAdmin: true,
       isAdmin: true,
       userRoles: ['super_admin'],
       scopes: { studentIds: [], orchestraIds: [] }
     };
   }
   ```
2. Modify `buildScopedFilter()` to accept `isSuperAdmin` context -- when true, omit tenantId from filter instead of throwing
3. **DO NOT modify `requireTenantId()`** -- it must stay strict. Instead, create `requireTenantIdOrSuperAdmin(tenantId, context)` that allows null tenantId only when `context.isSuperAdmin === true`
4. Cross-tenant aggregation queries should use direct `db.collection().aggregate()` calls (like `getPlatformAnalytics()` already does), not service methods that enforce tenant isolation
5. Document which service methods are safe for cross-tenant use and which are not

**Which phase should address it:** Cross-tenant reporting phase. But the `isSuperAdmin` context flag should be introduced in the first phase alongside impersonation.

---

### Pitfall 4: Two Cascade Deletion Systems with Incompatible Interfaces

**What goes wrong:**
The codebase has two cascade deletion services with the same export name but different implementations:

| Aspect | `cascadeDeletion.service.js` | `cascadeDeletionService.js` |
|--------|-------------------------------|------------------------------|
| Session creation | `getDB().startSession()` | `collection.client.startSession()` |
| Entry signature | `(studentId, userId, reason, context)` | `(studentId, options)` |
| Tenant ID access | `context?.tenantId` | `options?.context?.tenantId` |
| Soft delete fields | `deleted: true, deletedAt, deletionReason` | `isActive: false, deactivatedAt, deactivationReason` |
| Audit collection | `deletion_audit` | `audit_logs` |
| Rehearsal handling | Archives attendance (marks `archived: true`) | Removes attendance (`$pull`) |
| Activity attendance | Archives (marks `archived: true`) | Hard deletes (`deleteMany`) |

When building tenant cascade deletion, developers must choose a pattern. Using the wrong one creates inconsistencies in deletion behavior, audit trails, and restoration capability.

**Why it happens:**
These appear to have been written at different times by different implementations. Both export `cascadeDeletionService` as the named export. Import resolution depends on the exact import path, creating subtle bugs when refactoring.

**Consequences:**
- Restoration fails because deleted records use different field conventions (`deleted: true` vs `isActive: false`)
- Audit trail is split across two collections (`deletion_audit` vs `audit_logs`)
- Data loss risk: one system archives attendance, the other hard-deletes it
- Name collision means wrong service can be imported silently

**Prevention:**
1. Before building tenant deletion, **consolidate to one cascade deletion service**
2. Choose the transaction-based service (`cascadeDeletion.service.js`) because:
   - It uses `requireTenantId` guard consistently
   - It archives instead of hard-deleting (safer for compliance)
   - It has restoration support (`restoreStudent`)
   - Its audit trail is in `deletion_audit` (matches the `COLLECTIONS` constant)
3. Deprecate and eventually remove `cascadeDeletionService.js`
4. Standardize soft-delete fields across all services: use `isActive: false, deleted: true, deletedAt, deletionReason` (the first service's pattern)

**Which phase should address it:** Before tenant deletion is implemented. This is a prerequisite cleanup task.

---

### Pitfall 5: Frontend Auth Storage Collision Between Super Admin and Regular Admin

**What goes wrong:**
The frontend React app stores auth tokens in localStorage (based on `AuthContext with localStorage tokens` from project memory). When a super admin logs in, the token is stored in the same localStorage key as regular admin tokens. If the same browser has a regular admin session, the super admin login overwrites it. Worse, after super admin impersonates a tenant, the impersonation token replaces the super admin token -- when the impersonation expires, the super admin must log in again from scratch.

**Why it happens:**
The frontend was designed for a single auth flow (teacher login). Super admin is a second auth path that was not in the original design. Common localStorage keys like `accessToken`, `refreshToken`, `user` will collide.

**Consequences:**
- Super admin loses their session when impersonating a tenant
- Regular admin loses their session if super admin logs in on the same browser
- Token type confusion: frontend sends super admin token to tenant-scoped endpoint, gets 401
- "Return to super admin dashboard" action after impersonation fails because the super admin token is gone

**Detection:**
- Super admin clicks "return to dashboard" after viewing tenant and gets redirected to login
- Browser console shows 401 on the dashboard endpoint after impersonation
- `localStorage.getItem('accessToken')` shows an impersonation token instead of super admin token

**Prevention:**
1. Use **separate localStorage key namespaces**:
   - Regular auth: `tenuto_access_token`, `tenuto_refresh_token`, `tenuto_user`
   - Super admin: `tenuto_sa_access_token`, `tenuto_sa_refresh_token`, `tenuto_sa_user`
   - Impersonation: `tenuto_impersonation_token`, `tenuto_impersonation_tenant`
2. When impersonating, **preserve the super admin token** in its namespace
3. Add a `getActiveToken()` function that returns the impersonation token if active, otherwise the super admin token, otherwise the regular token
4. Frontend routing should check token type to determine which layout to render
5. "Exit impersonation" button clears `tenuto_impersonation_*` keys and reverts to super admin token

**Which phase should address it:** Frontend integration phase, but the localStorage key design must be decided before ANY super admin frontend code is written.

---

## Moderate Pitfalls

Mistakes that cause bugs, poor UX, or significant rework but are recoverable.

### Pitfall 6: Tenant Deletion Does Not Invalidate Active Sessions

**What goes wrong:**
Super admin deactivates or deletes a tenant. Teachers and admins of that tenant who are currently logged in continue to use the system because their JWT tokens are still valid (JWTs are stateless). They can continue creating data, viewing reports, and making changes until their token expires (current access token expiry appears to be configured per-route, refresh tokens last 30 days for super admin).

**Why it happens:**
JWT-based auth by design cannot be "revoked" server-side without additional infrastructure. The existing code has a `tokenVersion` check in `authenticateToken` (line 51-52), but this only works for individual teacher tokens, not for tenant-wide revocation.

**Prevention:**
1. Add `tenantVersion` field to tenant document (integer, incremented on deactivation)
2. Include `tenantVersion` in JWT payload alongside `tenantId`
3. In `authenticateToken`, after teacher lookup, check `tenant.isActive` and `tenantVersion`:
   ```javascript
   if (!teacher.tenantId) { /* handle */ }
   const tenant = await getCollection('tenant').findOne({ _id: teacher.tenantId });
   if (!tenant?.isActive) { return 401 TENANT_DEACTIVATED; }
   ```
4. This adds one DB lookup per request -- cache the tenant status in memory with 60s TTL to reduce overhead
5. Alternatively, maintain a `deactivatedTenants` Set in memory, refreshed every 60 seconds

**Which phase should address it:** Same phase as tenant deactivation/deletion.

---

### Pitfall 7: school_year Middleware Creates Records for Impersonation Context

**What goes wrong:**
The `addSchoolYearToRequest` middleware (line 38-56) creates a default school year record if none exists for the current tenant. When super admin impersonates a tenant that has no school year configured, the middleware silently creates one. This is problematic because:
- The auto-created school year may have wrong dates for that tenant
- The super admin's "view only" intent causes a write operation
- If the tenant was newly created, this creates data before the admin configures it

**Why it happens:**
The middleware was designed for the normal flow where a tenant always has a school year. The "create if missing" logic is a safety net, not an intentional feature for impersonation.

**Prevention:**
1. In `addSchoolYearToRequest`, check if context is impersonation:
   ```javascript
   if (!schoolYear && req.context?.isImpersonation) {
     return res.status(409).json({
       error: 'No school year configured for this tenant',
       code: 'NO_SCHOOL_YEAR'
     });
   }
   ```
2. Frontend should handle this gracefully by showing "No school year configured" message
3. Only auto-create school years for authenticated tenant users, not impersonation contexts

**Which phase should address it:** Impersonation feature phase, as part of middleware hardening.

---

### Pitfall 8: hours_summary Invalidation on Tenant Deletion Leaves Stale Cache

**What goes wrong:**
When a tenant is deleted, the `hours_summary` records for that tenant's teachers become orphaned. If a background recalculation job runs on stale `isStale: true` summaries, it will try to recalculate hours for non-existent teachers in a non-existent tenant, causing errors and unnecessary database load.

**Why it happens:**
The `hours_summary` recalculation is trigger-based (when source data changes, mark as stale, recalculate later). Tenant deletion marks nothing as stale -- it either deletes or misses the hours_summary records entirely. The background job does not check whether the referenced tenant still exists.

**Prevention:**
1. Include `hours_summary` in the tenant deletion manifest (Pitfall 1)
2. Before deleting hours_summary records, cancel any pending recalculation jobs for that tenant
3. Add `tenantId` filter to the background recalculation job: only recalculate summaries where the tenant is active
4. Consider adding a `tenantIsActive` check at the start of the recalculation function

**Which phase should address it:** Tenant deletion phase, as part of the deletion manifest.

---

### Pitfall 9: Cross-Tenant Report Aggregation Pipeline Performance

**What goes wrong:**
Cross-tenant reports (e.g., "hours per teacher across all tenants") run aggregation pipelines without the `tenantId` prefix in the filter. All existing compound indexes start with `tenantId` (by design). A query without `tenantId` cannot use these indexes efficiently, resulting in collection scans.

**Why it happens:**
Indexes were designed for tenant-scoped queries. Cross-tenant queries are the inverse of the isolation pattern. With 5-10 tenants and ~1,500 total records, this is not immediately noticeable. With 50+ tenants and 50,000+ records, query times degrade significantly.

**Detection:**
- MongoDB slow query logs showing collection scans on aggregation queries from `/api/super-admin/analytics`
- Analytics page takes 5+ seconds to load
- `explain()` on cross-tenant aggregation shows `COLLSCAN` instead of `IXSCAN`

**Prevention:**
1. Add a single-field index on `isActive` for collections frequently queried cross-tenant (student, teacher, tenant)
2. Pre-aggregate cross-tenant metrics on a schedule (every 15 minutes) and cache results in a `platform_analytics` collection
3. For the current scale (3-10 tenants), this is not urgent -- but design the analytics queries to be cacheable from the start
4. Use `$facet` to run multiple aggregation stages in a single pipeline pass instead of multiple separate queries

**Which phase should address it:** Cross-tenant reporting phase.

---

### Pitfall 10: Impersonation Audit Trail Gaps

**What goes wrong:**
Super admin impersonates a tenant, makes changes (creates a teacher, modifies a student). The audit trail shows `userId: superAdminId` but the existing audit mechanisms (`deletion_audit`, `security_log`) do not distinguish between "regular admin action" and "impersonated super admin action". When the tenant admin reviews audit logs, they see changes made by an unknown user ID that does not exist in their tenant's teacher collection.

**Why it happens:**
The existing audit system assumes all `userId` values are teacher ObjectIds within the same tenant. Super admin IDs are in a different collection (`super_admin`), and there is no `impersonatedBy` or `actionSource` field in audit records.

**Prevention:**
1. Add `actionSource` field to all audit records: `'user'` (normal), `'impersonation'` (super admin), `'system'` (background jobs)
2. Add `impersonatedBy` field (super admin ID) when `actionSource === 'impersonation'`
3. In the impersonation token, include `originalUserId` (super admin ID) alongside the synthetic teacher-like fields
4. Modify all audit-generating code to check for impersonation context and include the additional fields
5. Tenant admin audit view should show "Action performed by Platform Admin" instead of displaying an unknown user ID

**Which phase should address it:** Impersonation feature phase.

---

### Pitfall 11: toggleTenantActive Does Not Gate Data Access

**What goes wrong:**
The current `toggleTenantActive()` function (in `super-admin.service.js` line 296) sets `isActive: false` on the tenant document but does NOT prevent the tenant's users from logging in or accessing data. The `authenticateToken` middleware checks `teacher.isActive` but never checks `tenant.isActive`. A deactivated tenant's users continue working normally.

**Why it happens:**
The tenant `isActive` flag was added as a data field but not wired into the auth middleware. The current middleware chain is: `authenticateToken` (checks teacher) -> `buildContext` (reads teacher.tenantId) -> `enforceTenant` (checks tenantId exists, not that tenant is active).

**Detection:**
- Deactivate a tenant via super admin dashboard
- Login as a teacher in that tenant -- login succeeds
- All CRUD operations continue working

**Prevention:**
1. In `authenticateToken` or `enforceTenant`, add a tenant status check:
   ```javascript
   const tenant = await getCollection('tenant').findOne({
     _id: req.context.tenantId, // or however tenantId maps
     isActive: true
   });
   if (!tenant) {
     return res.status(403).json({ error: 'Tenant is deactivated', code: 'TENANT_INACTIVE' });
   }
   ```
2. Cache active tenant IDs in memory (Set, refreshed every 60 seconds) to avoid per-request DB lookup
3. This check should be in `enforceTenant` since that middleware's job is tenant validation

**Which phase should address it:** Tenant management phase, alongside `toggleTenantActive` enhancement.

---

## Minor Pitfalls

Issues that cause friction but are easy to fix once identified.

### Pitfall 12: Super Admin Token Refresh Not Implemented

**What goes wrong:**
The super admin login returns `accessToken` (1h expiry) and `refreshToken` (30d), but there is no `/api/super-admin/auth/refresh` endpoint. The regular `/api/auth/refresh` endpoint is for teacher tokens. When the super admin's access token expires, the frontend has no way to refresh it without re-authenticating.

**Prevention:**
Add `POST /api/super-admin/auth/refresh` endpoint that validates the refresh token from the `super_admin` collection and issues a new access token with `type: 'super_admin'`.

**Which phase should address it:** First phase, alongside other auth improvements.

---

### Pitfall 13: CORS Configuration Missing Super Admin Frontend Origin

**What goes wrong:**
If the super admin dashboard is hosted on a different subdomain (e.g., `admin.tenuto.io` vs `app.tenuto.io`), the CORS configuration in `server.js` will block requests. The current production CORS allows `rmc-music.org` and `www.rmc-music.org` only.

**Prevention:**
1. If super admin uses the same frontend: no change needed
2. If super admin gets its own subdomain: add it to `corsOptions.origin` array
3. Consider using a wildcard subdomain pattern for future flexibility: `*.tenuto.io`

**Which phase should address it:** Deployment/infrastructure phase.

---

### Pitfall 14: Tenant Deletion Leaves Orphaned File Storage References

**What goes wrong:**
If any tenant data includes file references (profile photos, uploaded documents), deleting the tenant's database records does not delete the files from storage. The `STORAGE_MODE` can be 'local' (files in `/uploads/`) or cloud-based.

**Prevention:**
1. Include file cleanup in the tenant deletion manifest
2. Enumerate all file references in tenant data before deletion
3. Delete files after successful database deletion (not before -- in case of rollback)
4. Log all file deletion actions for compliance

**Which phase should address it:** Tenant deletion phase.

---

### Pitfall 15: Super Admin Seed Endpoint Exposed in Production

**What goes wrong:**
The `POST /api/super-admin/seed` endpoint is public (no auth required). While it checks `count > 0` and rejects if admins exist, the endpoint itself reveals that a super admin system exists and could be a target for enumeration attacks.

**Prevention:**
1. Disable the seed endpoint in production: `if (process.env.NODE_ENV === 'production') return 404;`
2. Or gate it behind an environment variable: `ALLOW_SUPER_ADMIN_SEED=true`
3. Rate-limit the endpoint separately from login

**Which phase should address it:** Security hardening, before production deployment.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Tenant lifecycle (create/deactivate/delete) | Missing collections in cascade deletion (Pitfall 1) | CRITICAL | Build deletion manifest from COLLECTIONS constant; verify post-deletion |
| Tenant lifecycle (deactivate) | Active sessions survive deactivation (Pitfall 6, 11) | HIGH | Add tenant status check to enforceTenant middleware |
| Admin impersonation | Token incompatibility with teacher-scoped middleware (Pitfall 2) | CRITICAL | Issue impersonation tokens with synthetic teacher identity |
| Admin impersonation | Audit trail gaps for impersonated actions (Pitfall 10) | MODERATE | Add actionSource/impersonatedBy to all audit records |
| Admin impersonation | school_year auto-creation on view-only access (Pitfall 7) | MODERATE | Skip auto-creation for impersonation context |
| Cross-tenant reporting | Tenant guard exceptions on analytics queries (Pitfall 3) | HIGH | Create crossTenantContext with isSuperAdmin flag |
| Cross-tenant reporting | Index inefficiency on cross-tenant aggregation (Pitfall 9) | LOW (current scale) | Pre-aggregate and cache; add non-tenant indexes later |
| Frontend integration | Auth storage collision between user types (Pitfall 5) | HIGH | Separate localStorage namespaces from day one |
| Frontend integration | Layout/routing collision between admin types (Pitfall 5) | MODERATE | Token-type-based route guards and layout switching |
| Cascade deletion cleanup | Two incompatible deletion systems (Pitfall 4) | HIGH | Consolidate before building tenant deletion |
| Auth completeness | Missing super admin token refresh (Pitfall 12) | LOW | Add refresh endpoint early |
| Security | Seed endpoint exposed in production (Pitfall 15) | LOW | Environment gate or disable |

---

## Integration Risk Matrix

This matrix captures how the four major features interact with each other, creating compound risks.

| Feature A | Feature B | Compound Risk | Severity |
|-----------|-----------|---------------|----------|
| Tenant cascade deletion | Admin impersonation | Super admin impersonating a tenant then triggering deletion of that same tenant -- impersonation token references a tenant that no longer exists | HIGH |
| Admin impersonation | Cross-tenant reports | Impersonation token has a specific tenantId, but report queries need no tenantId -- which context does the query use? | MODERATE |
| Cross-tenant reports | Frontend integration | Report data aggregated across tenants must be displayed differently from single-tenant views -- same component rendering different scopes | LOW |
| Tenant cascade deletion | Cross-tenant reports | Deleted tenant's data appears in cached reports until cache refreshes | LOW |
| Admin impersonation | Frontend integration | "Exit impersonation" must restore super admin context without full page reload, while clearing all tenant-specific cached data (React Query cache, Zustand stores) | HIGH |
| Tenant cascade deletion | Two cascade systems | Which system handles tenant deletion? Must be consistent with entity deletion approach | HIGH |

---

## Decision Log: Recommended Resolution Order

Based on dependency analysis of the pitfalls above:

1. **Consolidate cascade deletion systems** (Pitfall 4) -- prerequisite for everything
2. **Implement impersonation auth bridge** (Pitfall 2) -- prerequisite for viewing tenant data
3. **Add super admin context flag** (Pitfall 3) -- prerequisite for cross-tenant queries
4. **Design frontend auth namespacing** (Pitfall 5) -- prerequisite for any frontend work
5. **Wire tenant isActive into enforceTenant** (Pitfall 11) -- prerequisite for tenant deactivation
6. **Build tenant deletion manifest** (Pitfall 1) -- the actual deletion feature
7. **Add impersonation audit fields** (Pitfall 10) -- alongside impersonation feature
8. **Handle school_year edge case** (Pitfall 7) -- alongside impersonation feature
9. **Invalidate sessions on deactivation** (Pitfall 6) -- alongside deactivation feature
10. **Build cross-tenant analytics** (Pitfall 9) -- after context flag exists
11. **Add token refresh** (Pitfall 12) -- early but non-blocking
12. **Secure seed endpoint** (Pitfall 15) -- before production

---

## Sources

- Direct codebase analysis of Tenuto.io backend (19 collections, 2 cascade systems, 5-layer tenant isolation)
- [Cascading Deletes in MongoDB: 5 Proven Patterns](https://medium.com/@mail_99211/cascading-deletes-in-mongodb-5-proven-patterns-to-achieve-rdbms-style-integrity-c8c55ef7eea9) -- MEDIUM confidence (community source, verified against codebase patterns)
- [MongoDB Multi-Tenancy Architecture Docs](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/) -- HIGH confidence (official docs)
- [CVE-2025-55241: Actor Token Impersonation Vulnerability](https://dirkjanm.io/obtaining-global-admin-in-every-entra-id-tenant-with-actor-tokens/) -- HIGH confidence (CVE, demonstrates real-world impersonation token risks)
- [JWT Multi-Tenant Authentication Best Practices](https://frontegg.com/guides/how-to-persist-jwt-tokens-for-your-saas-application) -- MEDIUM confidence (vendor guide)
- [MongoDB Multi-Tenancy RBAC Implementation](https://www.permit.io/blog/implement-multi-tenancy-rbac-in-mongodb) -- MEDIUM confidence (vendor guide, verified patterns against codebase)
- [Cross-Subdomain JWT Account Takeover](https://deepstrike.io/blog/cross-subdomain-jwt-account-take-over) -- HIGH confidence (real penetration test writeup, relevant to impersonation token design)
