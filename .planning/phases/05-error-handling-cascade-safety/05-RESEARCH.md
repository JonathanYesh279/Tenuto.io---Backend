# Phase 5: Error Handling & Cascade Safety - Research

**Researched:** 2026-02-24
**Domain:** Multi-tenant error response safety + cascade deletion tenant isolation
**Confidence:** HIGH

## Summary

This phase addresses two interrelated multi-tenant security concerns: (1) error responses that could leak information about resources in other tenants, and (2) cascade deletion systems that completely lack tenant scoping.

The error response problem is pervasive but mechanically straightforward. Currently, services throw errors like `Student with id ${studentId} not found` which flow unmodified to clients through the error handler. When a tenant-scoped query returns null (because the resource belongs to a different tenant), the error message is identical to when the resource truly does not exist. This is actually the CORRECT behavior for the response code, but the error messages in some controllers include entity-specific details, and some patterns (like the `canAccessStudent` IDOR check returning a 403 "Access denied") would confirm to an attacker that a resource exists in another tenant.

The cascade deletion problem is severe. There are THREE separate cascade deletion systems, and ALL of them have ZERO tenantId references in any query. Every `findOne`, `find`, `updateMany`, and `deleteMany` call uses only `_id` or entity-relationship fields without tenant scoping. This means a cascade deletion initiated by Tenant A could reach into Tenant B's data through shared student/teacher IDs. The systems also lack dry-run preview capability (the `dryRun` flag exists in `cleanupOrphanedReferences` only, not in the main deletion flow).

**Primary recommendation:** Unify the three cascade systems into one, add `tenantId` to every query, and standardize all error responses to use a consistent "Resource not found" message that never differs based on whether the resource exists in another tenant.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | current | HTTP framework, error middleware | Already the app framework |
| mongodb | native driver | All DB queries need tenant scoping | Already the DB driver |
| joi | current | Validation (tenantId stripped via Joi.any().strip()) | Already used for all validation |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino (logger.service) | current | Structured logging for security events | Log tenant isolation violations |

### No New Dependencies Needed
This phase is purely internal refactoring and hardening. No new libraries are required.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current Error Response Architecture
```
Service Layer:
  throw new Error(`Student with id ${studentId} not found`)
       |
  Controller Layer:
    catch (err) { next(err) }  OR  catch (err) { res.status(404).json({ error: err.message }) }
       |
  Error Handler Middleware (middleware/error.handler.js):
    Matches patterns like "Invalid teacher data:"
    Falls through to default: res.status(500).json({ error: 'Internal Server Error', message: err.message })
```

**Problem:** `err.message` is passed directly to client in many places, potentially leaking:
- Entity IDs: `Student with id 67a3... not found`
- Entity type confirmation: confirms the ID format is valid
- Existence in other tenants: 403 vs 404 distinction

### Pattern 1: Tenant-Safe Error Response Pattern
**What:** All "not found" errors from tenant-scoped queries MUST use identical responses regardless of whether the resource exists in another tenant.
**When to use:** Every service method that queries by ID + tenantId.
**Example:**
```javascript
// BEFORE (leaks information):
// In student.controller.js:
if (!canAccessStudent(id, req.context)) {
  return res.status(403).json({ error: 'Access denied: student not assigned to you' });
  // ^ This 403 tells attacker the student EXISTS but in another tenant
}
const student = await studentService.getStudentById(id, { context: req.context });
// ^ Service throws "Student with id X not found" — different from 403 above

// AFTER (tenant-safe):
const student = await studentService.getStudentById(id, { context: req.context });
if (!student) {
  return res.status(404).json({ error: 'Resource not found' });
  // ^ Same response whether student doesn't exist OR exists in another tenant
}
```

### Pattern 2: Cascade Deletion with Tenant Scoping
**What:** Every DB query in cascade deletion MUST include tenantId.
**When to use:** All cascade deletion operations.
**Example:**
```javascript
// BEFORE (no tenant scoping):
const student = await db.collection('student').findOne({ _id: studentObjectId });
await db.collection('orchestra').updateMany(
  { memberIds: studentId },  // No tenantId! Could match orchestras in ANY tenant
  { $pull: { memberIds: studentId } }
);

// AFTER (tenant-scoped):
const student = await db.collection('student').findOne({
  _id: studentObjectId,
  tenantId: context.tenantId  // Only this tenant's student
});
await db.collection('orchestra').updateMany(
  { memberIds: studentId, tenantId: context.tenantId },  // Only this tenant's orchestras
  { $pull: { memberIds: studentId } }
);
```

### Pattern 3: Dry-Run Preview for Cascade Deletions
**What:** Cascade operations support a preview mode that returns what WOULD be affected without making changes.
**When to use:** Before any destructive cascade operation.
**Example:**
```javascript
async function cascadeDeleteStudent(studentId, context, { dryRun = false } = {}) {
  const tenantId = requireTenantId(context.tenantId);

  // Collect impact analysis (same queries, no writes)
  const impact = {
    teachers: await db.collection('teacher').countDocuments({
      'teaching.timeBlocks.assignedLessons.studentId': studentId,
      tenantId,
      isActive: true
    }),
    orchestras: await db.collection('orchestra').countDocuments({
      memberIds: studentObjectId,
      tenantId,
      isActive: true
    }),
    // ... more collections
  };

  if (dryRun) {
    return { dryRun: true, impact, wouldAffect: Object.values(impact).reduce((s, v) => s + v, 0) };
  }

  // Proceed with actual deletion using session/transaction
  // ...
}
```

### Recommended File Structure Changes
```
services/
  cascadeDeletion.service.js          # KEEP — unified, tenant-scoped cascade service
  cascadeDeletionService.js           # REMOVE — merge into above
  cascadeDeletionAggregation.service.js  # AUDIT — add tenantId to all aggregations
  cascadeJobProcessor.js              # AUDIT — pass context/tenantId to job execution
  cascadeWebSocketService.js          # AUDIT — add tenant rooms for isolation
  cascadeSystemInitializer.js         # MINOR — no changes needed
api/admin/
  cascade-deletion.service.js         # REMOVE or MERGE — deduplicate with services/
  cascade-deletion.controller.js      # AUDIT — ensure context propagation
controllers/
  cascadeManagementController.js      # AUDIT — add tenantId from req.context
routes/
  cascadeManagement.routes.js         # AUDIT — ensure enforceTenant in middleware chain
middleware/
  error.handler.js                    # UPDATE — sanitize error messages
utils/
  queryScoping.js                     # EXTEND — add notFoundError() helper
```

### Anti-Patterns to Avoid
- **Different responses for "not found" vs "not yours":** A 403 "Access denied" vs 404 "Not found" reveals the resource exists. Always return 404 for both.
- **Entity IDs in error messages to client:** Never include MongoDB ObjectIds in client-facing error messages. Log them server-side, return generic message to client.
- **Cascade queries without tenantId:** The current state of ALL cascade files. Every query must be audited.
- **Passing raw service errors to client:** `err.message` often contains implementation details. The error handler should sanitize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant-scoped queries | Manual tenantId injection per query | `buildScopedFilter()` from `utils/queryScoping.js` | Already proven, has tenant guard built in |
| Tenant presence enforcement | Per-route tenantId checks | `enforceTenant` middleware (already exists) | Centralized, fail-safe |
| Client tenantId stripping | Manual body/query cleanup | `stripTenantId` middleware (already exists) | Defense-in-depth, already deployed |
| Route accountability | Manual route auditing | `utils/validateAllowlist.js` (already exists) | Automated verification of all routes |

**Key insight:** The infrastructure for tenant isolation at the middleware/query level is already solid (Phases 1-4 built this). The gap is specifically in the cascade deletion subsystem (predates multi-tenant work) and error message sanitization (never addressed).

## Common Pitfalls

### Pitfall 1: Oracle Attacks via Error Response Timing
**What goes wrong:** Even with identical error messages, different code paths (tenant-scoped query returning null vs IDOR check) may take different amounts of time, creating a timing oracle.
**Why it happens:** A tenant-scoped `findOne` that hits an index differently when the document exists (but in another tenant) vs doesn't exist at all.
**How to avoid:** Ensure the same code path is followed regardless. Query with `{ _id, tenantId }` — both cases hit the same index and return null.
**Warning signs:** 403 responses anywhere in the codebase for "resource not in your scope" — these should all be 404.

### Pitfall 2: Cascade Deletion Crossing Tenant Boundaries
**What goes wrong:** A cascade deletion for Student X in Tenant A also modifies Teacher Y's timeBlocks in Tenant B because the query `{ 'teaching.timeBlocks.assignedLessons.studentId': studentId }` has no tenantId filter.
**Why it happens:** The cascade deletion systems were built before multi-tenant was added. They use direct ID references without tenant scoping.
**How to avoid:** Add `tenantId` to every single query in all cascade services. Use `buildScopedFilter` where possible.
**Warning signs:** Any `find`, `findOne`, `updateMany`, `deleteMany` in cascade files without `tenantId` in the filter.

### Pitfall 3: Partial Cascade Failure Leaving Cross-Tenant Artifacts
**What goes wrong:** A cascade deletion partially completes, then fails. Some cross-collection updates were made without tenantId, affecting wrong tenant's data. Transaction rollback only helps if ALL operations were within the transaction.
**How to avoid:** Wrap all cascade operations in a MongoDB transaction. Verify every operation in the transaction uses tenant-scoped queries.
**Warning signs:** `cascadeDeletionService.js` (collection-based) does not consistently use sessions for all operations.

### Pitfall 4: Error Handler Leaking Internal Details
**What goes wrong:** The global error handler passes `err.message` to the client response for default/500 errors. Service errors that include internal details (stack traces, collection names, query details) leak through.
**Why it happens:** `middleware/error.handler.js` does `res.status(500).json({ error: 'Internal Server Error', message: err.message })`.
**How to avoid:** For production, never include `err.message` in 500 responses. Log it server-side, return generic message.
**Warning signs:** Any `res.json({ error: err.message })` or `message: err.message` in controller catch blocks.

### Pitfall 5: Three Cascade Systems with Divergent Behavior
**What goes wrong:** Developer fixes a security issue in one cascade system but not the other two. Or different systems handle the same entity differently (one soft-deletes, another hard-deletes).
**Why it happens:** Three systems exist with overlapping responsibilities:
  1. `services/cascadeDeletion.service.js` — transaction-based, snapshot-driven
  2. `services/cascadeDeletionService.js` — collection-based, different snapshot approach
  3. `api/admin/cascade-deletion.service.js` — admin API with preview/rollback
**How to avoid:** Unify into a single service with a clear API. All entry points (admin controller, management controller, job processor) call the same unified service.
**Warning signs:** Bug fixed in one file but not in the duplicates.

### Pitfall 6: WebSocket Tenant Isolation
**What goes wrong:** `cascadeWebSocketService.js` broadcasts deletion events to all admins across all tenants. Admin in Tenant A sees a cascade deletion event for a student in Tenant B.
**Why it happens:** WebSocket rooms are not tenant-scoped. The `admins` room contains all admins regardless of tenant.
**How to avoid:** Use tenant-scoped rooms like `admins_${tenantId}`. Only broadcast events to the tenant where the deletion is occurring.
**Warning signs:** `this.io.to('admins').emit(...)` without tenant filtering.

## Code Examples

### Current Error Response Pattern (problematic)
```javascript
// Source: api/student/student.service.js:96-97
const filter = { _id: ObjectId.createFromHexString(studentId), tenantId };
const student = await collection.findOne(filter);
if (!student) {
  throw new Error(`Student with id ${studentId} not found`);
  // This message reaches the client via error handler
}
```

### Current Cascade Query Pattern (no tenant isolation)
```javascript
// Source: services/cascadeDeletion.service.js:197-206
// NONE of these queries include tenantId:
const [student, relatedTeachers, relatedOrchestras, ...] = await Promise.all([
  db.collection('student').findOne({ _id: studentId }, { session }),
  db.collection('teacher').find({
    'teaching.timeBlocks.assignedLessons.studentId': studentId,
    isActive: true
  }, { session }).toArray(),
  db.collection('orchestra').find({
    memberIds: studentId,
    isActive: true
  }, { session }).toArray(),
  // ... more queries without tenantId
]);
```

### Current IDOR Check (leaks existence)
```javascript
// Source: api/student/student.controller.js:42-44
if (!canAccessStudent(id, req.context)) {
  return res.status(403).json({ error: 'Access denied: student not assigned to you' });
  // 403 = "this student exists, you just can't see it" — information leak
}
```

### Recommended: Unified Tenant-Safe Not-Found Response
```javascript
// Utility: utils/queryScoping.js (addition)
export class NotFoundError extends Error {
  constructor(resourceType = 'Resource') {
    super(`${resourceType} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// Usage in service:
const student = await collection.findOne({ _id: ObjectId.createFromHexString(studentId), tenantId });
if (!student) {
  throw new NotFoundError('Resource');  // Generic — never says "Student" or includes ID
}

// Usage in controller (replaces IDOR 403 pattern):
async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    // canAccessStudent check is now redundant — buildScopedFilter already limits visibility
    const student = await studentService.getStudentById(id, { context: req.context });
    res.json(student);
  } catch (err) {
    next(err);  // Error handler returns 404 with generic message
  }
}
```

### Recommended: Error Handler Sanitization
```javascript
// middleware/error.handler.js — enhanced
case 'NotFoundError':
  return res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
    // Never includes entity type, ID, or whether it exists in another tenant
  });

// Default 500 handler:
default:
  // Log full details server-side
  logger.error({ err: err.message, stack: err.stack, path: req.path }, 'Unhandled error');
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
    // NEVER: message: err.message (leaks internals)
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-tenant cascade deletion | Still single-tenant (needs update) | N/A | CRITICAL: cross-tenant data corruption risk |
| Three separate cascade systems | Still three systems (needs unification) | N/A | Maintenance burden, inconsistent behavior |
| 403 for IDOR prevention | Correct pattern exists in student controller but leaks info | Phase 5C | Needs standardization to 404 |
| Raw `err.message` to client | Still happening in error handler | N/A | Information disclosure risk |

**Deprecated/outdated:**
- `services/cascadeDeletionService.js` (collection-based): Should be merged into `services/cascadeDeletion.service.js` (transaction-based)
- `api/admin/cascade-deletion.service.js`: Should call unified service, not duplicate logic
- `controllers/cascadeManagementController.js` + `routes/cascadeManagement.routes.js`: Parallel route system — should be consolidated with `api/admin/cascade-deletion.*`

## Inventory: Files Requiring Audit

### Cascade Deletion Files (ZERO tenantId references)
All of these files need tenant scoping added to every DB query:

| File | Lines | Issue |
|------|-------|-------|
| `services/cascadeDeletion.service.js` | 782 | Transaction-based cascade, 0 tenantId refs |
| `services/cascadeDeletionService.js` | 763 | Collection-based cascade, 0 tenantId refs |
| `services/cascadeDeletionAggregation.service.js` | 795 | Aggregation pipelines, 0 tenantId refs |
| `services/cascadeJobProcessor.js` | 993 | Job processor, 0 tenantId refs |
| `services/cascadeWebSocketService.js` | 665 | WebSocket notifications, 0 tenantId refs |
| `api/admin/cascade-deletion.service.js` | ~400 | Admin cascade API, 0 tenantId refs |
| `api/admin/cascade-deletion.controller.js` | ~300 | Admin controller, 0 context refs |
| `controllers/cascadeManagementController.js` | ~300 | Management controller, 0 tenantId refs |
| `api/admin/student-deletion-preview.service.js` | ~200 | Preview service, 0 tenantId refs |

### Error Response Files (need message sanitization)
| File | Issue |
|------|-------|
| `middleware/error.handler.js` | Passes `err.message` to client in all cases |
| `api/student/student.controller.js` | 403 for IDOR check reveals resource existence |
| `api/theory/theory.controller.js` | 18 `err.message.includes('not found')` patterns with raw messages |
| `api/analytics/attendance.controller.js` | 3 `err.message.includes('not found')` patterns |
| `api/rehearsal/rehearsal.controller.js` | Raw error messages in 404 responses |
| `api/schedule/time-block.controller.js` | `res.status(404).json({ error: err.message })` |
| `api/admin/cleanup.controller.js` | 3 `err.message.includes('not found')` patterns |

### Service Files (throw messages with entity IDs)
| File | Approximate Count |
|------|-------------------|
| `api/teacher/teacher.service.js` | ~15 `throw new Error('Teacher with id X not found')` |
| `api/student/student.service.js` | ~5 similar patterns |
| `api/theory/theory.service.js` | ~6 similar patterns |
| `api/rehearsal/rehearsal.service.js` | ~8 similar patterns |
| `api/schedule/time-block.service.js` | ~6 similar patterns |
| `api/bagrut/bagrut.service.js` | ~7 similar patterns |
| `api/hours-summary/hours-summary.service.js` | ~1 similar pattern |
| `api/analytics/attendance.service.js` | ~2 similar patterns |

## Open Questions

1. **Should the three cascade systems be unified into one, or should one be designated primary and others deprecated?**
   - What we know: `services/cascadeDeletion.service.js` (transaction-based) is the most complete. `cascadeDeletionService.js` (collection-based) duplicates most logic. `api/admin/cascade-deletion.service.js` adds admin-specific features.
   - What's unclear: Whether there are functional differences that require keeping separate implementations.
   - Recommendation: Merge into one unified service in `services/cascadeDeletion.service.js`. The admin controller should call this service, not have its own. Mark `cascadeDeletionService.js` for removal.

2. **Should `canAccessStudent` IDOR checks be replaced entirely by `buildScopedFilter`, or kept as a secondary defense?**
   - What we know: `buildScopedFilter` already scopes student queries by `teacherAssignments.teacherId`. The IDOR check using `canAccessStudent` is redundant but provides defense-in-depth.
   - What's unclear: Whether removing the IDOR check might create edge cases where `buildScopedFilter` isn't applied.
   - Recommendation: Keep `canAccessStudent` but change response from 403 to 404. It's a cheap pre-check that avoids a DB query.

3. **How should cascade deletion handle the snapshot/audit collections (`deletion_audit`, `deletion_snapshots`) in a multi-tenant context?**
   - What we know: These collections store snapshots of deleted data. They don't currently have tenantId.
   - What's unclear: Whether snapshots should be tenant-scoped (so admins can only see their tenant's deletion history) or kept global (for super-admin visibility).
   - Recommendation: Add tenantId to both collections. Admin sees only their tenant's history. Super-admin sees all.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct reading of all cascade deletion files, error handlers, middleware, controllers, and services
- `utils/queryScoping.js` — buildScopedFilter implementation with tenant guard
- `middleware/tenant.middleware.js` — enforceTenant, buildContext, stripTenantId
- `config/crossTenantAllowlist.js` — CROSS_TENANT_ALLOWLIST constant
- `utils/validateAllowlist.js` — Route accountability validation
- `middleware/error.handler.js` — Global error handling

### Secondary (MEDIUM confidence)
- OWASP guidance on information disclosure through error messages
- MongoDB multi-tenant security patterns (server-derived tenant scoping)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all existing tools verified in codebase
- Architecture: HIGH - Patterns directly observed in codebase with clear gaps identified
- Pitfalls: HIGH - Every pitfall verified by reading actual source code
- Cascade deletion gaps: HIGH - Confirmed ZERO tenantId references across 9 files with grep

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain, no fast-moving dependencies)
