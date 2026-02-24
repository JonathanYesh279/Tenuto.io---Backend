# Architecture Patterns: Super Admin Platform Management

**Domain:** Multi-tenant SaaS platform administration for music school management
**Researched:** 2026-02-24
**Milestone:** v1.1 Super Admin Platform Management
**Confidence:** HIGH (based on existing codebase analysis + established multi-tenant patterns)

---

## Recommended Architecture

### System Overview

The v1.1 features integrate into the existing Express + MongoDB architecture as **extensions** of the super admin subsystem. No structural changes to the tenant-scoped middleware chain are needed. All new features live behind `authenticateSuperAdmin` middleware and operate cross-tenant by design.

```
                                  +---------------------------+
                                  |     Frontend (React)      |
                                  |                           |
                                  |  Regular App   | SA Panel |
                                  +-------+--------+-----+----+
                                          |              |
                                  /api/*  |    /api/super-admin/*
                                          |              |
                              +-----------v-+    +-------v--------+
                              | authenticateToken | authenticateSuperAdmin |
                              | buildContext      | requirePermission      |
                              | enforceTenant     |                        |
                              | stripTenantId     |                        |
                              +-----------+------+   +------+--------+
                                          |                  |
                              +-----------v------------------v--------+
                              |           Service Layer                |
                              |                                        |
                              |  Tenant-Scoped   |  Cross-Tenant       |
                              |  (22 services)   |  (super-admin svc)  |
                              +------------------+---------------------+
                                          |                  |
                              +-----------v------------------v--------+
                              |         MongoDB (Shared DB)            |
                              |  11 tenant-scoped + 4 platform colls   |
                              +----------------------------------------+
```

### Key Architectural Principle

The super admin subsystem operates as a **parallel auth path** -- it does NOT go through `authenticateToken` / `buildContext` / `enforceTenant`. This is correct and must be preserved. New features extend this parallel path, not the tenant-scoped path.

---

## Component Boundaries

### Existing Components (Modified)

| Component | File(s) | Current Responsibility | Modifications Needed |
|-----------|---------|----------------------|---------------------|
| `super-admin.route.js` | `api/super-admin/` | Tenant CRUD, analytics, admin mgmt | Add routes for: impersonation, tenant deletion, enhanced reports |
| `super-admin.service.js` | `api/super-admin/` | Login, tenant listing, basic analytics | Extend with: impersonation token generation, enhanced aggregation |
| `super-admin.controller.js` | `api/super-admin/` | Request handling for SA routes | Add controller methods for new endpoints |
| `super-admin.validation.js` | `api/super-admin/` | Joi schemas for SA inputs | Add schemas for impersonation, deletion, report params |
| `super-admin.middleware.js` | `middleware/` | `authenticateSuperAdmin`, `requirePermission` | Add `impersonation_access` permission, impersonation detection |
| `auth.middleware.js` | `middleware/` | `authenticateToken` for regular users | Detect impersonation tokens, inject `req.impersonatedBy` |
| `constants.js` | `config/` | `SUPER_ADMIN_PERMISSIONS`, `COLLECTIONS` | Add new permission + collection constants |
| `crossTenantAllowlist.js` | `config/` | Documents exempt routes | No changes (SA routes already allowlisted) |

### New Components

| Component | Location | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| `tenantDeletion.service.js` | `services/` | Orchestrate full tenant data wipe across all collections | `mongoDB.service.js`, `logger.service.js` |
| `impersonation.service.js` | `services/` | Generate/validate scoped impersonation tokens, audit trail | `auth.service.js`, `super-admin.service.js`, `mongoDB.service.js` |
| `platformReports.service.js` | `services/` | Cross-tenant aggregation pipelines for platform reporting | `mongoDB.service.js` |
| `impersonation.middleware.js` | `middleware/` | Detect + validate impersonation tokens, set `req.impersonatedBy` | `auth.middleware.js` |

---

## Feature 1: Tenant Cascade Deletion

### Architecture Decision

Use a **synchronous, transactional approach** with pre-deletion snapshot. Not a queue/worker pattern -- the system has at most a few dozen tenants with ~100-200 teachers and ~1,000-2,000 students each. A single MongoDB transaction can handle this within seconds.

**Rationale:** The existing `cascadeDeletion.service.js` (transaction-based, at `services/cascadeDeletion.service.js`) already proves this pattern works for student-level cascade. Tenant-level is the same pattern at a higher scope. Queue/worker adds operational complexity not justified at this scale.

### Collection Deletion Order

Deletion must follow dependency order to avoid orphaned references mid-transaction. Delete leaf collections first, then collections with cross-references, then the tenant record.

```
Phase 1 (No dependencies - parallel safe):
  activity_attendance   WHERE tenantId = X  -> DELETE
  hours_summary         WHERE tenantId = X  -> DELETE
  import_log            WHERE tenantId = X  -> DELETE
  ministry_report_snapshots WHERE tenantId = X -> DELETE
  deletion_audit        WHERE tenantId = X  -> DELETE
  deletion_snapshots    WHERE tenantId = X  -> DELETE

Phase 2 (Reference other collections):
  bagrut                WHERE tenantId = X  -> DELETE
  rehearsal             WHERE tenantId = X  -> DELETE
  theory_lesson         WHERE tenantId = X  -> DELETE

Phase 3 (Cross-referenced):
  orchestra             WHERE tenantId = X  -> DELETE
  student               WHERE tenantId = X  -> DELETE

Phase 4 (Core entity):
  teacher               WHERE tenantId = X  -> DELETE

Phase 5 (System records):
  school_year           WHERE tenantId = X  -> DELETE

Phase 6 (Tenant record itself):
  tenant                WHERE _id = X       -> DELETE
```

### Data Flow: Tenant Deletion

```
Super Admin UI
  |
  v
POST /api/super-admin/tenants/:id/delete
  |
  v
authenticateSuperAdmin -> requirePermission('manage_tenants')
  |
  v
super-admin.controller.deleteTenant()
  |
  +---> tenantDeletion.service.previewDeletion(tenantId)
  |       |
  |       +---> Count documents in each collection for tenantId
  |       +---> Return impact summary (teachers: N, students: N, etc.)
  |       +---> Return to controller (if ?preview=true, stop here)
  |
  +---> tenantDeletion.service.executeDeletion(tenantId, adminId, reason)
          |
          +---> 1. Verify tenant exists, is deactivated first (safety gate)
          +---> 2. Create full snapshot in tenant_deletion_snapshots
          +---> 3. Start MongoDB session
          +---> 4. session.withTransaction(() => {
          |         delete from all collections in dependency order
          |         create audit record
          |       })
          +---> 5. Return deletion report
```

### Safety Gates

1. **Tenant must be deactivated first** -- cannot delete an active tenant. This is a two-step process: deactivate, then delete. Prevents accidental deletion.
2. **Preview mode** -- `?preview=true` query param returns impact analysis without modifying data. Controller must verify admin has confirmed after seeing preview.
3. **Snapshot before delete** -- full data export stored in `tenant_deletion_snapshots` collection (not tenant-scoped, since the tenant is being deleted).
4. **Confirmation token** -- after preview, backend issues a short-lived confirmation token. Deletion request must include this token. Prevents CSRF and ensures admin saw the preview.

### New Service: `tenantDeletion.service.js`

```javascript
// services/tenantDeletion.service.js
export const tenantDeletionService = {
  previewDeletion(tenantId),           // -> { collections: { teacher: 130, student: 1200, ... }, total: N }
  createDeletionSnapshot(tenantId),    // -> snapshotId (stored in tenant_deletion_snapshots)
  executeDeletion(tenantId, adminId, reason, confirmationToken),  // -> { success, deletedCounts, auditId }
  getDeletionHistory(),                // -> list of past tenant deletions with snapshots
};
```

### Collections Affected

All 11 tenant-scoped collections from `COLLECTIONS` constant:
- `teacher`, `student`, `orchestra`, `rehearsal`, `theory_lesson`, `bagrut`
- `school_year`, `activity_attendance`, `hours_summary`, `import_log`, `ministry_report_snapshots`

Plus tenant-specific audit data:
- `deletion_audit`, `deletion_snapshots` (WHERE tenantId matches)

And the tenant record itself:
- `tenant` (WHERE `_id` matches)

### New Collection

| Collection | Purpose | Tenant-Scoped? |
|-----------|---------|---------------|
| `tenant_deletion_snapshots` | Full data backup before tenant wipe | NO (platform-level) |

---

## Feature 2: Super Admin Impersonation

### Architecture Decision

Use **scoped JWT tokens** with dual-identity claims. The impersonation token IS a valid regular access token (passes `authenticateToken`) but carries an additional `impersonatedBy` claim that identifies the super admin. This means the existing middleware chain works unchanged -- the impersonated admin "just works" through `buildContext` / `enforceTenant`.

**Why not a session-based approach:** The frontend already uses JWT tokens stored in localStorage. Adding a session system would require a parallel auth mechanism. A scoped JWT fits the existing architecture perfectly.

**Why not modify `authenticateSuperAdmin`:** The super admin middleware bypasses tenant-scoping entirely. To impersonate a tenant admin, the token must go through the regular `authenticateToken` -> `buildContext` -> `enforceTenant` chain. This is correct -- impersonation should see exactly what the admin sees, with no special privileges.

### Token Structure

```javascript
// Impersonation JWT payload (signed with ACCESS_TOKEN_SECRET)
{
  _id: "teacher_id_of_admin_being_impersonated",
  tenantId: "target_tenant_id",
  firstName: "...",
  lastName: "...",
  email: "admin@school.il",
  roles: ["admin"],            // The impersonated admin's roles
  version: 0,
  // Impersonation-specific claims:
  impersonatedBy: {
    _id: "super_admin_id",
    email: "super@tenuto.io",
    type: "super_admin"
  },
  impersonation: true,        // Boolean flag for quick detection
  impersonationSessionId: "uuid", // For audit trail correlation
  iat: 1740000000,
  exp: 1740001800             // Short expiry: 30 minutes, not 1 hour
}
```

### Data Flow: Impersonation

```
Super Admin UI
  |
  v
POST /api/super-admin/tenants/:tenantId/impersonate
  |
  v
authenticateSuperAdmin -> requirePermission('impersonation_access')
  |
  v
super-admin.controller.impersonate()
  |
  v
impersonation.service.createImpersonationSession(superAdminId, tenantId)
  |
  +---> 1. Find target tenant (verify exists, is active)
  +---> 2. Find tenant admin teacher (role includes admin, isActive: true)
  +---> 3. Generate impersonation JWT with dual-identity claims
  +---> 4. Create audit record in security_log collection
  +---> 5. Return { accessToken, impersonationSessionId, expiresIn, tenantName }
  |
  v
Frontend stores token, redirects to regular app with impersonation banner
  |
  v
Regular API calls use impersonation token
  |
  v
authenticateToken() -> finds teacher by _id -> passes (teacher is a real admin)
buildContext() -> sets req.context.tenantId from teacher.tenantId
enforceTenant() -> passes (tenantId present)
  |
  v
Impersonation-aware code detects `impersonatedBy` claim in token
  -> Sets req.impersonatedBy = { _id, email, type }
  -> Logger includes impersonatedBy in all log entries
```

### Middleware Changes

**`auth.middleware.js` -- minimal change (approximately 5 lines):**
```javascript
// After the existing line: req.teacher = teacher;
// Add impersonation detection:
if (decoded.impersonation && decoded.impersonatedBy) {
  req.impersonatedBy = decoded.impersonatedBy;
  req.impersonationSessionId = decoded.impersonationSessionId;
  log.info({
    superAdminId: decoded.impersonatedBy._id,
    impersonatedTeacherId: teacher._id.toString(),
    tenantId: teacher.tenantId,
    path: req.path,
  }, 'IMPERSONATION: Request from impersonated session');
}
```

This is the ONLY change to the regular auth path. Everything else works because the token contains a real teacher `_id`.

### Impersonation Constraints

| Constraint | Implementation |
|-----------|---------------|
| Read-only by default | Impersonation token has `readOnly: true` claim. Middleware rejects POST/PUT/DELETE for impersonation tokens unless explicitly allowed. |
| Short-lived | 30 min expiry (vs 1 hour for regular tokens). No refresh token issued. |
| No password changes | `forcePasswordChange` and `changePassword` endpoints reject impersonation tokens. |
| No cascade deletion | Cascade deletion endpoints reject impersonation tokens. |
| Single session | Only one active impersonation session per super admin. Starting a new one invalidates the old sessionId. |
| Audit everything | Every request with an impersonation token is logged with the super admin identity. |

### New Permission

Add `'impersonation_access'` to `SUPER_ADMIN_PERMISSIONS` in `config/constants.js`.

### New Service: `impersonation.service.js`

```javascript
// services/impersonation.service.js
export const impersonationService = {
  createImpersonationSession(superAdminId, tenantId),  // -> { accessToken, sessionId, expiresIn }
  endImpersonationSession(sessionId),                   // -> void
  getActiveSession(superAdminId),                       // -> session or null
  getImpersonationHistory(filters),                     // -> audit trail
  isImpersonationToken(decoded),                        // -> boolean
};
```

### New Middleware: `impersonation.middleware.js`

```javascript
// middleware/impersonation.middleware.js

// Rejects write operations for impersonation tokens (read-only guard)
export function impersonationReadOnly(req, res, next) {
  if (req.impersonatedBy && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Allow specific safe endpoints (e.g., logout)
    const safeEndpoints = ['/api/auth/logout'];
    if (!safeEndpoints.includes(req.path)) {
      return res.status(403).json({
        success: false,
        error: 'Impersonation sessions are read-only',
        code: 'IMPERSONATION_READ_ONLY'
      });
    }
  }
  next();
}

// Blocks impersonation tokens from sensitive operations entirely
export function blockImpersonation(req, res, next) {
  if (req.impersonatedBy) {
    return res.status(403).json({
      success: false,
      error: 'This operation is not available in impersonation mode',
      code: 'IMPERSONATION_BLOCKED'
    });
  }
  next();
}
```

### Where to Apply Read-Only Guard

The `impersonationReadOnly` middleware should be applied globally AFTER `authenticateToken` in `server.js`, on the tenant-scoped route groups. This means impersonation tokens can read everything the admin can read, but cannot modify data.

```javascript
// In server.js, add to the middleware chain:
app.use(
  '/api/student',
  authenticateToken,
  impersonationReadOnly,  // <-- NEW: blocks writes for impersonation tokens
  buildContext,
  enforceTenant,
  stripTenantId,
  addSchoolYearToRequest,
  studentRoutes
);
```

---

## Feature 3: Enhanced Platform Reports

### Architecture Decision

Use **MongoDB aggregation pipelines** that operate across all tenants (no tenantId filter). These run under `authenticateSuperAdmin` only, so they are already authorized for cross-tenant access. The aggregation results are computed on-demand, not cached, because tenant count is small (<50).

**Why not a separate reporting database:** Overkill. With <50 tenants and <10K total records per collection, aggregation pipelines over the shared database perform in <1 second.

### Report Types

| Report | Aggregation Pattern | Data Sources |
|--------|-------------------|-------------|
| **Usage Overview** | `$group` by tenantId across teacher, student, orchestra | `teacher`, `student`, `orchestra` |
| **Ministry Status** | `$lookup` tenant + latest ministry snapshot | `tenant`, `ministry_report_snapshots` |
| **Subscription Health** | `$group` on tenant.subscription.plan + endDate analysis | `tenant` |
| **Growth Trends** | `$group` by month on teacher/student createdAt | `teacher`, `student` |
| **Attendance Rates** | `$group` by tenantId on activity_attendance status | `activity_attendance` |
| **Active Usage** | Last login timestamps, recent schedule activity | `teacher`, `school_year` |

### Data Flow: Enhanced Reports

```
Super Admin Dashboard
  |
  v
GET /api/super-admin/reports/:reportType?startDate=X&endDate=Y
  |
  v
authenticateSuperAdmin -> requirePermission('view_analytics')
  |
  v
super-admin.controller.getReport()
  |
  v
platformReports.service.generateReport(reportType, params)
  |
  +---> Switch on reportType:
  |     'usage-overview'     -> aggregate teacher/student/orchestra counts by tenant
  |     'ministry-status'    -> join tenants with latest ministry snapshots
  |     'subscription-health'-> analyze subscription dates and plan distribution
  |     'growth-trends'      -> time-series of createdAt grouped by month
  |     'attendance-rates'   -> aggregate attendance by tenant
  |     'active-usage'       -> teacher login recency, schedule freshness
  |
  v
Return structured report data
```

### New Service: `platformReports.service.js`

```javascript
// services/platformReports.service.js
export const platformReportsService = {
  getUsageOverview(),               // -> per-tenant counts
  getMinistryStatus(),              // -> per-tenant completion %
  getSubscriptionHealth(),          // -> plan distribution, expiring soon
  getGrowthTrends(startDate, endDate), // -> time-series data
  getAttendanceRates(period),       // -> per-tenant rates
  getActiveUsage(),                 // -> last login, recent activity
  getPlatformSummary(),             // -> single dashboard payload combining above
};
```

### Extending Existing `getPlatformAnalytics()`

The existing `getPlatformAnalytics()` in `super-admin.service.js` returns basic counts. Rather than modifying it (breaking existing API), add new report endpoints alongside it. The existing endpoint stays for backward compatibility; new reports use the `/reports/:reportType` pattern.

---

## Feature 4: Super Admin Frontend Dashboard

### Architecture Decision (Backend Perspective)

The backend needs a **single combined payload endpoint** for the dashboard, plus individual report endpoints for drill-down. This minimizes frontend API calls on dashboard load.

### New Endpoints Summary

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| `GET` | `/api/super-admin/dashboard` | Combined dashboard payload (all widgets) | `view_analytics` |
| `GET` | `/api/super-admin/reports/:type` | Individual report by type | `view_analytics` |
| `POST` | `/api/super-admin/tenants/:id/impersonate` | Start impersonation | `impersonation_access` |
| `POST` | `/api/super-admin/impersonation/end` | End active session | `impersonation_access` |
| `GET` | `/api/super-admin/impersonation/history` | Audit trail | `manage_tenants` |
| `DELETE` | `/api/super-admin/tenants/:id` | Delete tenant (with confirmation) | `manage_tenants` |
| `GET` | `/api/super-admin/tenants/:id/deletion-preview` | Preview deletion impact | `manage_tenants` |
| `POST` | `/api/super-admin/tenants/:id/deletion-confirm` | Confirm deletion with token | `manage_tenants` |

### Dashboard Payload Structure

```javascript
// GET /api/super-admin/dashboard
{
  success: true,
  data: {
    overview: {
      totalTenants: 12,
      activeTenants: 10,
      totalTeachers: 380,
      totalStudents: 4200,
    },
    subscriptions: {
      byPlan: { basic: 4, standard: 5, premium: 1 },
      expiringSoon: [{ tenantId, name, expiresAt }],
    },
    recentActivity: {
      lastHour: { logins: 45, apiCalls: 2300 },
      newTenantsThisMonth: 2,
    },
    tenantHealth: [
      { tenantId, name, teachers: 30, students: 400, lastActive: '...' },
      // ... for each tenant
    ],
    alerts: [
      { type: 'subscription_expiring', tenantId, tenantName, expiresAt },
      { type: 'inactive_tenant', tenantId, tenantName, lastActive },
    ],
  }
}
```

---

## Patterns to Follow

### Pattern 1: Extend Existing Service Module

**What:** Add new methods to `super-admin.service.js` for features that are conceptually "super admin operations." Extract to dedicated services only when complexity demands it.

**When:** Simple CRUD extensions, basic report queries.

**Example:** Adding `getReport()` to `super-admin.service.js` that delegates to `platformReports.service.js` for complex aggregations but handles simple ones inline.

### Pattern 2: Transaction-Based Cascade with Snapshot

**What:** Wrap multi-collection operations in `session.withTransaction()`, preceded by a full snapshot to a separate collection.

**When:** Tenant deletion, any destructive cross-collection operation.

**Example:** Follow the exact pattern from `services/cascadeDeletion.service.js` (the transaction-based one), NOT `services/cascadeDeletionService.js` (the collection-based one).

```javascript
const db = getDB();
const session = db.startSession();
try {
  await session.withTransaction(async () => {
    // All deletes here with { session }
  });
} finally {
  await session.endSession();
}
```

### Pattern 3: Dual-Identity JWT for Impersonation

**What:** Issue a JWT that passes through the regular auth middleware but carries extra claims identifying the impersonator.

**When:** Super admin needs to see what a tenant admin sees.

**Constraints:** Short TTL (30 min), no refresh token, read-only by default, full audit trail.

### Pattern 4: Aggregation-Based Reporting (No Cache)

**What:** Use MongoDB `$group` / `$lookup` pipelines that run on-demand against the shared database without tenantId filters.

**When:** Platform-level reports that aggregate across all tenants.

**Why no cache:** Tenant count is small enough that aggregations complete in <1s. Caching adds stale-data complexity not justified at this scale.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying `enforceTenant` for Super Admin Access

**What:** Adding a "bypass" flag to `enforceTenant` so super admin tokens skip tenant checks.
**Why bad:** The entire v1.0 security model depends on `enforceTenant` being absolute. Adding bypasses creates a class of vulnerabilities.
**Instead:** Super admin routes have their own middleware chain that never includes `enforceTenant`. Impersonation tokens go through the regular chain as a real tenant admin, not as a super admin.

### Anti-Pattern 2: Using the Collection-Based Cascade Service

**What:** Using `services/cascadeDeletionService.js` (the collection-based one) for tenant deletion.
**Why bad:** It uses `getCollection()` per operation rather than `getDB()` with sessions. The transaction-based service (`services/cascadeDeletion.service.js`) is the correct pattern for atomic multi-collection operations.
**Instead:** Model `tenantDeletion.service.js` after `cascadeDeletion.service.js` (the transaction-based one).

### Anti-Pattern 3: Storing Impersonation State Server-Side Only

**What:** Tracking impersonation sessions in a database table and validating each request against it.
**Why bad:** Adds a database lookup to every request. The JWT already carries the impersonation state.
**Instead:** Put impersonation metadata in the JWT. Use `security_log` for audit trail (write-only, not read on every request). Only check database for session revocation if needed (use a sessionId blacklist with short TTL).

### Anti-Pattern 4: Cross-Tenant Queries in Tenant-Scoped Services

**What:** Adding optional "skip tenantId" parameters to existing tenant-scoped services (e.g., `student.service.js`) so the super admin can aggregate across tenants.
**Why bad:** Introduces security holes. Every optional bypass is a potential injection vector.
**Instead:** Create separate cross-tenant functions in `platformReports.service.js` that explicitly document their cross-tenant nature and are only callable from super admin routes.

### Anti-Pattern 5: Hard Delete Without Snapshot

**What:** Deleting tenant data without creating a recoverable snapshot first.
**Why bad:** No undo path. A single API call permanently destroys all data for a school.
**Instead:** Always create a full snapshot in `tenant_deletion_snapshots` before any deletion. Snapshots can be TTL-indexed (auto-expire after 90 days).

---

## New vs Modified Components Summary

### New Files (4)

| File | Type | Purpose |
|------|------|---------|
| `services/tenantDeletion.service.js` | Service | Tenant cascade deletion with snapshot + transaction |
| `services/impersonation.service.js` | Service | Impersonation token generation, session management, audit |
| `services/platformReports.service.js` | Service | Cross-tenant aggregation pipelines for platform reports |
| `middleware/impersonation.middleware.js` | Middleware | Read-only guard, impersonation blocking for sensitive ops |

### Modified Files (7)

| File | Change | Risk |
|------|--------|------|
| `api/super-admin/super-admin.route.js` | Add ~8 new route handlers | LOW -- additive only |
| `api/super-admin/super-admin.controller.js` | Add controller methods for new endpoints | LOW -- additive only |
| `api/super-admin/super-admin.service.js` | May delegate to new services; minor extensions | LOW -- mostly delegation |
| `api/super-admin/super-admin.validation.js` | Add Joi schemas for new endpoints | LOW -- additive only |
| `middleware/auth.middleware.js` | Add ~5 lines for impersonation detection | MEDIUM -- core auth path |
| `config/constants.js` | Add `impersonation_access` permission, new collection constant | LOW -- additive only |
| `server.js` | Add `impersonationReadOnly` to middleware chains | MEDIUM -- touches all routes |

### Files NOT Modified

| File | Why Not |
|------|---------|
| `middleware/tenant.middleware.js` | Tenant isolation unchanged. Impersonation works through regular auth. |
| `middleware/super-admin.middleware.js` | Existing `authenticateSuperAdmin` + `requirePermission` are sufficient. |
| `utils/queryScoping.js` | Scoping logic unchanged. Impersonation tokens have a real tenantId. |
| All 22 existing services | No changes. Services already accept context with tenantId. |
| `config/crossTenantAllowlist.js` | SA routes already allowlisted. No new exempt route groups. |

---

## Database Changes

### New Collections

| Collection | Purpose | Indexed Fields | TTL |
|-----------|---------|---------------|-----|
| `tenant_deletion_snapshots` | Full tenant data backup before deletion | `tenantId`, `createdAt` | 90 days (optional) |
| `impersonation_sessions` | Active impersonation session tracking (optional, for revocation) | `superAdminId`, `sessionId`, `expiresAt` | 1 hour |

### Modified Collections

| Collection | Change |
|-----------|--------|
| `security_log` | Add impersonation event entries: `{ type: 'impersonation_start', superAdminId, tenantId, sessionId, ... }` |
| `super_admin` | Add `impersonation_access` to possible permissions array values |

### New Indexes

```javascript
// tenant_deletion_snapshots
{ tenantId: 1, createdAt: -1 }

// impersonation_sessions (if used)
{ sessionId: 1 }         // unique
{ superAdminId: 1 }      // find active session
{ expiresAt: 1 }         // TTL index

// security_log (enhance existing)
{ type: 1, timestamp: -1 }
{ 'details.superAdminId': 1, timestamp: -1 }
```

---

## Scalability Considerations

| Concern | Current (<50 tenants) | At 200 tenants | At 1000 tenants |
|---------|----------------------|----------------|-----------------|
| Tenant deletion speed | <5s in single transaction | <15s (more docs per collection) | Consider batch deletion or queue |
| Cross-tenant reports | Aggregation <1s | Aggregation <3s, add indexes | Add materialized views or periodic caching |
| Impersonation token validation | JWT decode only (no DB) | Same | Same |
| Dashboard payload | Single aggregation pass | May need parallel queries | Cache dashboard with 5-min TTL |
| Tenant listing with stats | In-memory join | Add aggregation pipeline | Pre-compute stats on tenant update |

The current architecture handles 1000+ tenants for all features except tenant deletion (where transaction size could exceed MongoDB limits). At that scale, convert tenant deletion to a queue-based system. For now, the synchronous approach is correct.

---

## Build Order (Dependency-Driven)

```
Phase 1: Enhanced Reports + Dashboard Endpoint
  -- platformReports.service.js (no deps on other new features)
  -- New routes + controller methods
  -- Constants updates (COLLECTIONS)

Phase 2: Tenant Cascade Deletion
  -- tenantDeletion.service.js (depends on: COLLECTIONS constant)
  -- Preview + confirmation flow
  -- Snapshot collection + indexes
  -- Routes + controller + validation

Phase 3: Impersonation
  -- impersonation.service.js (most complex feature)
  -- impersonation.middleware.js
  -- auth.middleware.js modification (MEDIUM risk)
  -- server.js middleware chain update
  -- security_log integration
  -- Routes + controller + validation

Phase 4: Super Admin Frontend
  -- Dashboard page (uses reports API from Phase 1)
  -- Tenant management UI (uses deletion from Phase 2)
  -- Impersonation UI (uses impersonation from Phase 3)
  -- Separate layout/routing from regular app
```

**Ordering rationale:**
1. Reports first because they have zero risk (additive, read-only) and enable dashboard development.
2. Deletion second because it extends existing patterns (cascade service) and is self-contained.
3. Impersonation third because it touches the core auth middleware (highest risk) and benefits from having reports/deletion already tested.
4. Frontend last because it consumes all backend APIs.

---

## Sources

- Existing codebase analysis (HIGH confidence -- direct code review of all files listed above)
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) -- impersonation audit requirements
- [WorkOS Multi-Tenant Architecture Guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) -- JWT tenant context patterns
- [MongoDB Multi-Tenancy Documentation](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/) -- cross-tenant aggregation patterns
- [Cascading Deletes in MongoDB: 5 Proven Patterns](https://medium.com/@mail_99211/cascading-deletes-in-mongodb-5-proven-patterns-to-achieve-rdbms-style-integrity-c8c55ef7eea9) -- transaction vs queue patterns
- [Implementing Impersonation with SSO and JWT](https://medium.com/kameleoon/implementing-impersonation-with-sso-and-jwt-95ce2eb60419) -- dual-identity token structure
- [Authress: Risks of User Impersonation](https://authress.io/knowledge-base/academy/topics/user-impersonation-risks) -- security constraints
- [OneUptime: Impersonation Implementation](https://oneuptime.com/blog/post/2026-01-30-impersonation-implementation/view) -- audit trail patterns
