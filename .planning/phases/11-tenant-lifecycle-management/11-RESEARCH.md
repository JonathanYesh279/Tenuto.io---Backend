# Phase 11: Tenant Lifecycle Management - Research

**Researched:** 2026-02-24
**Domain:** Multi-tenant SaaS lifecycle -- deactivation gating, cascade deletion, soft-delete with grace period, audit trail
**Confidence:** HIGH

## Summary

Phase 11 implements tenant lifecycle management for the Tenuto.io SaaS platform. The phase has five requirements: FIX-03 (tenant deactivation blocks login), TLCM-01 (deletion impact preview), TLCM-02 (soft-delete with grace period), TLCM-03 (permanent purge with atomic transaction and pre-deletion snapshot), and TLCM-04 (audit trail for all super admin mutations). A prerequisite is consolidating the two existing cascade deletion systems into one transaction-based system.

The codebase already has substantial infrastructure to build on: a `tenant` collection with `isActive` field, a `super_admin` module with authentication middleware, JWT-based auth with `tenantId` in tokens, MongoDB 6.x driver with `withTransaction()` support, an existing transaction-based cascade deletion service (`cascadeDeletion.service.js`), and 19 collection names defined in `COLLECTIONS` constants. The key gap is that the auth middleware (`auth.middleware.js`) does NOT check `tenant.isActive` during authentication -- it only checks `teacher.isActive`. The login service (`auth.service.js`) also lacks this check. This is the FIX-03 bug.

**Primary recommendation:** Build in this order: (1) consolidate cascade deletion systems, (2) add tenant.isActive gating to auth, (3) build super admin audit trail, (4) add soft-delete + grace period to tenant, (5) build deletion impact preview, (6) build permanent purge with snapshot. Each builds on the prior.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongodb | ^6.13.0 | Native MongoDB driver with transaction support | Already in use; `withTransaction()` helper exists in `mongoDB.service.js` |
| express | existing | HTTP routing and middleware chain | Already in use |
| jsonwebtoken | existing | JWT creation and verification | Already in use for both teacher and super admin tokens |
| joi | existing | Request validation schemas | Already in use throughout (`super-admin.validation.js`, `tenant.validation.js`) |
| bcryptjs | existing | Password hashing | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dayjs | existing | Date/time manipulation for grace periods | Already imported in `cascadeDeletionService.js` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom audit logging | MongoDB Change Streams | Change Streams add complexity (need oplog access, separate process) -- overkill for 3-10 tenants with explicit mutation points |
| In-memory job queue | Bull/BullMQ + Redis | Adds Redis dependency -- unnecessary at current scale where purge is manual and infrequent |
| node-cron for scheduled purge | Manual trigger only | Scheduled purge at 3-10 tenants is premature -- super admin manually triggers permanent deletion after grace period |

**Installation:**
```bash
# No new dependencies needed -- all libraries are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
api/
  super-admin/
    super-admin.route.js          # ADD: delete/preview/soft-delete tenant routes
    super-admin.controller.js     # ADD: new controller methods
    super-admin.service.js        # ADD: tenant lifecycle service methods
    super-admin.validation.js     # ADD: validation for new endpoints
services/
    cascadeDeletion.service.js    # KEEP: the consolidated, transaction-based system
    cascadeDeletionService.js     # REMOVE: the duplicate collection-based system
    tenantPurge.service.js        # NEW: tenant-wide purge across all collections
    auditTrail.service.js         # NEW: platform-level audit trail
middleware/
    auth.middleware.js            # MODIFY: add tenant.isActive check
    tenant.middleware.js          # No changes needed
    super-admin.middleware.js     # No changes needed
config/
    constants.js                  # ADD: TENANT_SCOPED_COLLECTIONS constant, AUDIT_ACTIONS enum
```

### Pattern 1: Tenant isActive Gating in Auth Middleware
**What:** After finding the teacher during authentication, look up their tenant and check `isActive`. Reject with 403 if tenant is deactivated.
**When to use:** Every authenticated request from a tenant user (not super admin).
**Example:**
```javascript
// In auth.middleware.js - authenticateToken()
// After finding the teacher and before setting req.teacher:
if (teacher.tenantId) {
  const tenantCollection = await getCollection('tenant');
  // Use ObjectId lookup - tenantId is stored as string of ObjectId
  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(teacher.tenantId)
  });
  if (!tenant || !tenant.isActive) {
    return res.status(403).json({
      success: false,
      error: 'Tenant account is deactivated',
      code: 'TENANT_DEACTIVATED'
    });
  }
}
```

**CRITICAL NOTE on tenantId:** The codebase has an inconsistency in how tenantId is stored vs. how tenants are looked up. In `super-admin.service.js`, the code uses `t.tenantId || t._id.toString()` -- suggesting some tenant documents may have a `tenantId` field AND an `_id`. Teachers store `tenantId` as a string (the tenant's `_id.toString()`). The auth middleware must use `ObjectId.createFromHexString(teacher.tenantId)` to look up the tenant by `_id`. This pattern is already used in `getTenantWithStats()`.

### Pattern 2: Platform Audit Trail (Non-Tenant-Scoped)
**What:** A dedicated collection (`platform_audit_log`) for all super admin actions. NOT tenant-scoped (persists after tenant deletion).
**When to use:** Every super admin mutation -- create tenant, update tenant, toggle active, soft-delete, hard-delete, etc.
**Example:**
```javascript
// auditTrail.service.js
async function logAction(action, actorId, details) {
  const collection = await getCollection('platform_audit_log');
  await collection.insertOne({
    action,          // 'TENANT_CREATED', 'TENANT_DEACTIVATED', 'TENANT_SOFT_DELETED', etc.
    actorId,         // super admin _id
    actorType: 'super_admin',
    targetType: details.targetType || 'tenant',
    targetId: details.targetId,
    details,         // { tenantName, previousState, newState, ... }
    timestamp: new Date(),
    ip: details.ip || null,
  });
}
```

### Pattern 3: Soft-Delete with Grace Period
**What:** Mark tenant for deletion with a scheduled purge date. Tenant is deactivated (isActive: false) and marked with deletion metadata. During grace period, super admin can cancel.
**When to use:** First step of tenant deletion flow.
**Example:**
```javascript
// Soft-delete adds these fields to tenant document:
{
  isActive: false,
  deletionStatus: 'scheduled',    // 'scheduled' | 'cancelled' | 'purging' | 'purged'
  deletionScheduledAt: new Date(),
  deletionPurgeAt: new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000),
  deletionRequestedBy: superAdminId,
  deletionReason: 'Conservatory closed'
}
```

### Pattern 4: Tenant Purge with Transaction
**What:** Delete ALL documents with matching tenantId across ALL tenant-scoped collections, within a single MongoDB transaction. Create pre-deletion snapshot BEFORE the transaction.
**When to use:** After grace period expires, or when super admin manually triggers permanent purge.
**Example:**
```javascript
// tenantPurge.service.js
async function purgeTenant(tenantId, superAdminId) {
  const db = getDB();

  // Step 1: Create snapshot OUTSIDE transaction (large data)
  const snapshot = await createTenantSnapshot(tenantId);

  // Step 2: Purge within transaction
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const collectionName of TENANT_SCOPED_COLLECTIONS) {
        await db.collection(collectionName).deleteMany(
          { tenantId },
          { session }
        );
      }
      // Delete the tenant document itself
      await db.collection('tenant').deleteOne(
        { _id: ObjectId.createFromHexString(tenantId) },
        { session }
      );
    });
    return { success: true, snapshotId: snapshot._id };
  } finally {
    await session.endSession();
  }
}
```

### Pattern 5: Deletion Impact Preview
**What:** Count documents per collection for a tenant without modifying data.
**When to use:** Before any deletion confirmation.
**Example:**
```javascript
// Returns: { teacher: 14, student: 364, orchestra: 33, rehearsal: 120, ... }
async function previewTenantDeletion(tenantId) {
  const db = getDB();
  const counts = {};
  for (const collectionName of TENANT_SCOPED_COLLECTIONS) {
    counts[collectionName] = await db.collection(collectionName)
      .countDocuments({ tenantId });
  }
  counts.total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  return counts;
}
```

### Anti-Patterns to Avoid
- **Deleting without snapshot:** NEVER purge tenant data without saving a pre-deletion snapshot. This is the only recovery path if something goes wrong.
- **Parallel deletes in transaction:** MongoDB Node.js driver does NOT support parallel operations within a single transaction. Delete collections sequentially.
- **Using `getCollection()` in transaction loops:** Each `getCollection()` call is async and creates overhead. Get the db reference once with `getDB()` and use `db.collection(name)` for each collection.
- **Storing audit logs in tenant-scoped collection:** Audit logs for tenant deletion must survive the deletion itself. Use a separate non-tenant-scoped collection.
- **Checking tenant.isActive on every single DB query:** Only gate at the auth middleware level. Once authenticated, the tenant is confirmed active -- no need to re-check in every service call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction management | Custom retry logic around `startSession()` | Existing `withTransaction()` in `mongoDB.service.js` | Handles session lifecycle, retries on transient errors |
| Audit trail | Custom event emitter + async queue | Simple `insertOne()` to `platform_audit_log` collection | At 3-10 tenants with infrequent mutations, a direct write is simpler and more reliable than an event queue |
| Scheduled purge job | node-cron or custom scheduler | Manual trigger by super admin | No automated purge needed at this scale; super admin reviews and confirms |
| Tenant lookup caching | In-memory tenant cache | Direct DB lookup in auth middleware | At 3-10 tenants, a single indexed `findOne` by `_id` is sub-millisecond |

**Key insight:** This phase is about correctness and safety, not performance. The tenant count is 3-10. Every operation can be direct and synchronous. Avoid adding infrastructure (Redis, cron, event queues) that complicates the codebase for negligible benefit.

## Common Pitfalls

### Pitfall 1: Two Cascade Deletion Systems Export the Same Name
**What goes wrong:** Both `cascadeDeletion.service.js` and `cascadeDeletionService.js` export `cascadeDeletionService`. Consumers import from different files and get different implementations.
**Why it happens:** The two systems were built at different times for different purposes but never consolidated.
**How to avoid:** Phase 11 must consolidate FIRST. Keep `cascadeDeletion.service.js` (transaction-based, more robust). Remove or redirect `cascadeDeletionService.js`. Update all imports.
**Warning signs:** `import { cascadeDeletionService } from '../services/cascadeDeletionService.js'` (collection-based) vs `from '../services/cascadeDeletion.service.js'` (transaction-based). The file name difference is subtle.
**Current consumers to update:**
- `services/cascadeJobProcessor.js` -- imports from `cascadeDeletion.service.js` (GOOD)
- `test/unit/cascadeDeletionService.test.js` -- imports from `cascadeDeletionService.js` (needs update)
- `test/integration/data-integrity.test.js` -- imports from `cascadeDeletionService.js` (needs update)
- `test/performance/cascade-operations.test.js` -- imports from `cascadeDeletionService.js` (needs update)
- `controllers/cascadeManagementController.js` -- imports from `cascadeDeletion.service.js` (GOOD)
- `api/admin/cascade-deletion.controller.js` -- imports from `./cascade-deletion.service.js` (different file, needs investigation)

### Pitfall 2: Auth Middleware Tenant Lookup Must Handle Missing tenantId
**What goes wrong:** Not all teachers may have a `tenantId` (legacy data or migration edge cases). If the middleware tries to look up `ObjectId.createFromHexString(null)`, it crashes.
**Why it happens:** The existing `authenticateToken` already sets `tenantId: teacher.tenantId || null`. The new tenant check must be conditional.
**How to avoid:** Only perform the tenant.isActive check when `teacher.tenantId` is truthy. If tenantId is null/undefined, skip the check (let other middleware like `enforceTenant` handle it).
**Warning signs:** `ObjectId.createFromHexString` throws on null/empty input.

### Pitfall 3: Tenant Purge Transaction Size Limits
**What goes wrong:** MongoDB transactions have a 16MB oplog entry limit. For a large tenant (1200 students, 130 teachers, thousands of attendance records), a single transaction deleting everything may exceed this.
**Why it happens:** Each `deleteMany` in a transaction adds to the oplog. Many documents = large oplog entry.
**How to avoid:** The snapshot is already created OUTSIDE the transaction. For the purge itself, if the transaction fails due to size, fall back to sequential collection-by-collection deletion within the transaction but batched (e.g., delete 1000 docs at a time per collection within the transaction). At current scale (1200 students, 130 teachers), this is unlikely to be an issue -- the 16MB limit accommodates roughly 10,000-50,000 document deletions depending on document size.
**Warning signs:** `TransactionTooLarge` error from MongoDB.

### Pitfall 4: Race Condition Between Deactivation and Active Sessions
**What goes wrong:** When a tenant is deactivated, users who already have valid JWTs can continue making requests until their token expires (1 hour).
**Why it happens:** JWT tokens are stateless. The `isActive` check happens during authentication but existing tokens were issued before deactivation.
**How to avoid:** The auth middleware tenant check handles this -- it checks tenant.isActive on EVERY request, not just at login. Even if a token is valid, the middleware will reject the request if the tenant is now inactive. This is the correct approach.
**Warning signs:** If someone only adds the check to the login flow but not the auth middleware, existing sessions would persist.

### Pitfall 5: Token Refresh After Tenant Deactivation
**What goes wrong:** A user with a valid refresh token could obtain a new access token after their tenant is deactivated, if the refresh endpoint doesn't check tenant.isActive.
**Why it happens:** The `refreshAccessToken()` function in `auth.service.js` checks `teacher.isActive` but NOT `tenant.isActive`.
**How to avoid:** Add tenant.isActive check to BOTH `authenticateToken()` AND `refreshAccessToken()` in `auth.service.js`.
**Warning signs:** Users can still refresh tokens after tenant deactivation.

### Pitfall 6: Snapshot Storage for Large Tenants
**What goes wrong:** A pre-deletion snapshot of a tenant with 1200 students and full attendance history could be very large (tens of MB). Storing it in MongoDB as a single document hits the 16MB BSON document size limit.
**Why it happens:** The existing student snapshot pattern stores everything in one document.
**How to avoid:** Store the tenant snapshot as multiple documents -- one per collection -- in a `tenant_deletion_snapshots` collection. Each document contains the collection name, tenantId, and an array of documents from that collection. For very large collections (attendance), further chunk the data.
**Warning signs:** `BSONObjectTooLarge` error when inserting snapshot.

## Code Examples

Verified patterns from the existing codebase:

### Existing Transaction Pattern (from cascadeDeletion.service.js)
```javascript
// Source: services/cascadeDeletion.service.js lines 34-162
const db = getDB();
const session = db.startSession();  // NOTE: getDB() returns db, not client
try {
  let result;
  await session.withTransaction(async () => {
    // Sequential operations within transaction
    const teacherCleanup = await this.removeStudentFromTeachers(studentObjectId, session, tenantId);
    const orchestraCleanup = await this.removeStudentFromOrchestras(studentObjectId, session, tenantId);
    // ... more sequential operations
    await db.collection('deletion_audit').insertOne(auditRecord, { session });
    result = { /* ... */ };
  });
  return result;
} finally {
  await session.endSession();
}
```

**IMPORTANT:** The existing code uses `db.startSession()` which works because `getDB()` returns the db object from the MongoDB native driver. The `withTransaction()` helper in `mongoDB.service.js` uses `client.startSession()`. Both are valid approaches.

### Existing Tenant Toggle Pattern (from super-admin.service.js)
```javascript
// Source: api/super-admin/super-admin.service.js lines 336-355
async function toggleTenantActive(tenantId) {
  const collection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await collection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });
  if (!tenant) throw new Error(`Tenant with id ${tenantId} not found`);

  const result = await collection.findOneAndUpdate(
    { _id: ObjectId.createFromHexString(tenantId) },
    { $set: { isActive: !tenant.isActive, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}
```

### Existing countDocuments Pattern for Impact Preview
```javascript
// Source: services/cascadeDeletion.service.js lines 172-205 (previewCascadeDeletion)
const [teacherCount, orchestraCount, rehearsalCount, theoryCount, bagrutCount, attendanceCount] =
  await Promise.all([
    db.collection('teacher').countDocuments({ 'teaching.timeBlocks.assignedLessons.studentId': studentId, tenantId }),
    db.collection('orchestra').countDocuments({ memberIds: studentObjectId, tenantId }),
    db.collection('rehearsal').countDocuments({ 'attendance.studentId': studentObjectId, tenantId }),
    // ... etc
  ]);
```

### Auth Token Generation with tenantId (from auth.service.js)
```javascript
// Source: api/auth/auth.service.js lines 259-275
function generateAccessToken(teacher) {
  const tokenData = {
    _id: teacher._id.toString(),
    tenantId: teacher.tenantId || null,
    firstName: teacher.personalInfo?.firstName || '',
    lastName: teacher.personalInfo?.lastName || '',
    email: teacher.credentials.email,
    roles: teacher.roles,
    version: teacher.credentials?.tokenVersion || 0
  };
  return jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
}
```

### Validation Pattern with Joi (from super-admin.validation.js)
```javascript
// Source: api/super-admin/super-admin.validation.js
export const updateSubscriptionSchema = Joi.object({
  plan: Joi.string().valid(...SUBSCRIPTION_PLANS),
  startDate: Joi.date(),
  endDate: Joi.date().allow(null),
  isActive: Joi.boolean(),
  maxTeachers: Joi.number().positive().integer(),
  maxStudents: Joi.number().positive().integer(),
}).min(1);
```

## Cascade Deletion Consolidation Analysis

### System A: `services/cascadeDeletion.service.js` (Transaction-Based) -- KEEP
- **Pattern:** Uses `db.startSession()` + `session.withTransaction()`
- **Features:** Full snapshot creation, cascade operations, soft-delete, restore, audit logging
- **Tenant-aware:** Yes -- uses `requireTenantId()` guard on all entry points
- **DB access:** Uses `getDB()` directly
- **Consumers:** `cascadeJobProcessor.js`, `cascadeManagementController.js`

### System B: `services/cascadeDeletionService.js` (Collection-Based) -- REMOVE/REDIRECT
- **Pattern:** Uses `getCollection()` + separate `session` management via `client.startSession()`
- **Features:** Similar functionality but with different API (options-based vs parameter-based)
- **Tenant-aware:** Yes -- uses `requireTenantId()`
- **DB access:** Uses `getCollection()` for each operation
- **Consumers:** Test files only (`test/unit/`, `test/integration/`, `test/performance/`)
- **Export name conflict:** Both export `cascadeDeletionService`

### Supporting Files (Keep As-Is)
- `cascadeDeletionAggregation.service.js` -- Aggregation pipelines for integrity validation. Independent service, no overlap.
- `cascadeJobProcessor.js` -- Background job processor. Already imports from System A.
- `cascadeWebSocketService.js` -- WebSocket notifications for deletion progress.
- `cascadeManagement.routes.js` -- API routes. Already imports from System A indirectly.

### Third Entry Point: `api/admin/cascade-deletion.controller.js`
- Imports from `./cascade-deletion.service.js` (a THIRD file in `api/admin/`)
- Has its own routes in `api/admin/cascade-deletion.routes.js`
- Mounted at `/api/admin` prefix in `server.js`
- This is a separate admin-level cascade deletion interface that also needs consolidation

### Consolidation Strategy
1. Keep System A (`services/cascadeDeletion.service.js`) as the canonical implementation
2. Add any unique functionality from System B to System A (e.g., `cleanupOrphanedReferences`, `hardDelete` option)
3. Remove System B (`services/cascadeDeletionService.js`)
4. Update test imports to point to System A
5. Verify `api/admin/cascade-deletion.service.js` -- if it's a thin wrapper around System A, keep it; if it's a third implementation, redirect to System A
6. Add new tenant-level purge methods to a NEW `tenantPurge.service.js` that internally uses the consolidated system's transaction patterns

## Tenant-Scoped Collections (for Purge)

Based on `config/constants.js` COLLECTIONS and the `AGENT_IMPLEMENTATION_GUIDE.md`:

**Collections requiring `tenantId`-based deletion (17):**
| Collection | Constant Name | Notes |
|------------|---------------|-------|
| teacher | TEACHER | Has tenantId |
| student | STUDENT | Has tenantId |
| orchestra | ORCHESTRA | Has tenantId |
| rehearsal | REHEARSAL | Has tenantId |
| theory_lesson | THEORY_LESSON | Has tenantId |
| bagrut | BAGRUT | Has tenantId |
| school_year | SCHOOL_YEAR | Has tenantId |
| activity_attendance | ACTIVITY_ATTENDANCE | Has tenantId |
| hours_summary | HOURS_SUMMARY | Has tenantId |
| import_log | IMPORT_LOG | Has tenantId |
| ministry_report_snapshots | MINISTRY_REPORT_SNAPSHOTS | Has tenantId |
| deletion_audit | DELETION_AUDIT | Has tenantId |
| deletion_snapshots | DELETION_SNAPSHOTS | Has tenantId |
| security_log | SECURITY_LOG | May have tenantId -- verify |
| migration_backups | MIGRATION_BACKUPS | May have tenantId -- verify |
| integrityAuditLog | INTEGRITY_AUDIT_LOG | May have tenantId -- verify |
| integrityStatus | INTEGRITY_STATUS | May have tenantId -- verify |

**Collections NOT deleted (2):**
| Collection | Why |
|------------|-----|
| super_admin | Platform-level, never tenant-scoped |
| tenant | Deleted separately (the target document itself) |

**NEW collection for this phase:**
| Collection | Purpose |
|------------|---------|
| platform_audit_log | Non-tenant-scoped audit trail for all super admin mutations |
| tenant_deletion_snapshots | Pre-deletion snapshots stored per-collection (avoids 16MB BSON limit) |

## New API Endpoints

### Super Admin Tenant Lifecycle Routes
```
# Existing (modify toggleTenantActive to add audit logging)
PUT  /api/super-admin/tenants/:id/toggle-active

# New endpoints
GET  /api/super-admin/tenants/:id/deletion-preview    # TLCM-01: Impact preview
POST /api/super-admin/tenants/:id/soft-delete          # TLCM-02: Soft-delete with grace period
POST /api/super-admin/tenants/:id/cancel-deletion      # TLCM-02: Cancel soft-delete during grace period
POST /api/super-admin/tenants/:id/purge                # TLCM-03: Permanent deletion
GET  /api/super-admin/audit-log                        # TLCM-04: Platform audit trail
GET  /api/super-admin/audit-log/:tenantId              # TLCM-04: Audit trail for specific tenant
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two separate cascade deletion systems | Single consolidated transaction-based system | Phase 11 (this phase) | Eliminates confusion, reduces maintenance burden |
| No tenant.isActive check in auth | Auth middleware validates tenant.isActive on every request | Phase 11 (FIX-03) | Immediate login blocking when tenant deactivated |
| No audit trail for super admin actions | Platform-level audit log collection | Phase 11 (TLCM-04) | Full accountability for all platform mutations |
| Immediate permanent deletion | Soft-delete -> grace period -> permanent purge | Phase 11 (TLCM-02/03) | Safety net against accidental deletion |

**Deprecated/outdated:**
- `services/cascadeDeletionService.js`: Will be removed in this phase, replaced by consolidated `cascadeDeletion.service.js`

## Open Questions

1. **Which collections have tenantId on their documents?**
   - What we know: Core 12 collections definitely have tenantId (teacher, student, orchestra, rehearsal, theory_lesson, bagrut, school_year, activity_attendance, hours_summary, import_log, ministry_report_snapshots, deletion_audit)
   - What's unclear: Whether `security_log`, `migration_backups`, `integrityAuditLog`, `integrityStatus`, `deletion_snapshots` consistently have tenantId on all documents
   - Recommendation: Before building the purge service, grep for `tenantId` writes in each of these collections to confirm. If some don't have it, they need to be handled differently (e.g., skip or delete by entity relationship).

2. **Tenant document tenantId field vs _id**
   - What we know: `super-admin.service.js` uses `t.tenantId || t._id.toString()` suggesting some tenant documents may have both
   - What's unclear: Whether the `tenantId` field on a tenant document is its own `_id` as string, or something else
   - Recommendation: The purge service should use `tenantId` value (which matches what's stored on all other collections) not the tenant `_id` directly. Verify the actual stored value in the database.

3. **Grace period duration**
   - What we know: The requirements say "configurable grace period"
   - What's unclear: Default value, whether it's per-tenant or system-wide
   - Recommendation: Default 30 days, stored on the soft-deleted tenant document. Super admin can override during soft-delete. Simple approach: store `deletionPurgeAt` timestamp, not a duration.

4. **Snapshot storage strategy for large tenants**
   - What we know: Current student snapshot pattern stores everything in one document
   - What's unclear: Whether a full tenant snapshot (potentially 1200 students + all related data) fits in one MongoDB document (16MB BSON limit)
   - Recommendation: Store snapshot as multiple documents (one per collection) in a dedicated `tenant_deletion_snapshots` collection. Each document: `{ tenantId, snapshotId, collection, documents: [...], createdAt }`.

5. **Should `api/admin/cascade-deletion.*` files be consolidated too?**
   - What we know: There's a third cascade deletion entry point at `api/admin/cascade-deletion.controller.js` with its own service
   - What's unclear: Whether this controller is used by the frontend, and whether its service is yet another implementation
   - Recommendation: Investigate during implementation. If it's a thin wrapper, keep the routes but redirect to the consolidated service. If it duplicates logic, refactor.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all relevant source files:
  - `services/cascadeDeletion.service.js` (897 lines) -- transaction-based cascade deletion
  - `services/cascadeDeletionService.js` (782 lines) -- collection-based cascade deletion
  - `services/cascadeDeletionAggregation.service.js` -- aggregation pipelines
  - `services/cascadeJobProcessor.js` -- background job processing
  - `middleware/auth.middleware.js` -- current authentication flow (NO tenant.isActive check)
  - `middleware/tenant.middleware.js` -- tenant guard, buildContext, stripTenantId, enforceTenant
  - `middleware/super-admin.middleware.js` -- super admin authentication
  - `api/super-admin/*` -- super admin routes, controller, service, validation
  - `api/auth/auth.service.js` -- login flow, token generation (NO tenant.isActive check)
  - `api/tenant/*` -- tenant service and validation
  - `config/constants.js` -- COLLECTIONS, enums
  - `services/mongoDB.service.js` -- withTransaction() helper

### Secondary (MEDIUM confidence)
- [MongoDB Transactions Documentation](https://www.mongodb.com/docs/manual/core/transactions/) -- Confirms multi-document transactions support deleteMany across collections
- [MongoDB Node.js Driver v6.15 deleteMany](https://www.mongodb.com/docs/drivers/node/v6.15/usage-examples/deletemany/) -- Confirms deleteMany with session parameter
- [MongoDB Node.js Driver Transactions](https://www.mongodb.com/docs/drivers/node/v5.6/fundamentals/transactions/) -- withTransaction pattern (verified against existing codebase usage)

### Tertiary (LOW confidence)
- [Multi-Tenant SaaS Architecture Best Practices](https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/) -- General patterns for tenant lifecycle
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) -- Audit trail requirements (referenced in v1.1 research)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns directly observed in existing codebase, extensions are straightforward
- Pitfalls: HIGH -- identified from direct code reading (naming conflict, missing tenant check, transaction limits)
- Cascade consolidation: HIGH -- both systems read in full, consumers identified, strategy is clear
- Open questions: MEDIUM -- tenantId consistency across all 19 collections needs runtime verification

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain, no external dependency changes expected)
