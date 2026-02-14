# Architecture Research: Multi-Tenant Enforcement

**Researched:** 2026-02-14
**Confidence:** High (patterns), Medium (MongoDB-specific tooling)

## Executive Summary

Multi-tenant enforcement in Node.js/Express/MongoDB requires **defense-in-depth** across multiple layers since MongoDB lacks native row-level security. The most secure architecture combines:
1. **Middleware layer** - tenant context extraction and validation
2. **Service layer** - query filter injection via builder utilities
3. **Database wrapper** - automatic tenant scoping on MongoDB operations
4. **Explicit allowlist** - decorator/flag for cross-tenant operations

**Critical insight:** Application-level filtering is inherently fragile. Every layer must enforce isolation independently - a single forgotten WHERE clause can leak data across tenants.

## Components

A complete multi-tenant enforcement system consists of:

| Component | Responsibility | Confidence |
|-----------|---------------|------------|
| **Tenant Resolution Middleware** | Extract tenantId from JWT/header, validate, attach to req.context | HIGH |
| **Context Propagation** | Ensure req.context flows through middleware chain to services | HIGH |
| **Query Scoping Utility** | Inject `{ tenantId: ... }` into MongoDB filter objects | HIGH |
| **Collection Wrapper** | Intercept MongoDB driver methods to enforce tenant filters | MEDIUM |
| **Allowlist Mechanism** | Explicit opt-out for cross-tenant queries (admin operations) | HIGH |
| **Audit Logger** | Record all cross-tenant queries for compliance | HIGH |
| **Test Harness** | Automated tests for tenant isolation violations | HIGH |

## Layer Architecture

### Defense-in-Depth Model

Multi-tenant systems must implement **multiple independent layers** of isolation. Each layer should assume upstream layers may fail.

```
┌─────────────────────────────────────────┐
│  1. HTTP Request                        │
│     → Extract tenantId from JWT         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. Middleware Chain                    │
│     → authenticateToken                 │
│     → buildContext (set req.context)    │
│     → requireTenantId                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. Route Handler                       │
│     → Pass context to service           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. Service Layer                       │
│     → buildScopedFilter(type, filter,   │
│        context)                          │
│     → Inject tenantId into query        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  5. Database Wrapper (optional)         │
│     → Intercept find/update/delete      │
│     → Auto-inject tenant filter         │
│     → Block if no tenantId unless       │
│        allowCrossTenant flag set        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  6. MongoDB                             │
│     → Execute scoped query              │
└─────────────────────────────────────────┘
```

**Key principle:** Layers 2, 4, and 5 should **independently** enforce tenant isolation. If middleware fails to set context, service layer should reject. If service forgets to scope query, wrapper should block.

### Layer 1: Middleware - Tenant Context Injection

**Pattern:** `req.context` object populated by middleware chain

```javascript
// middleware/buildContext.js
function buildContext(req, res, next) {
  const { userId, tenantId, roles, isAdmin } = req.user; // from JWT

  if (!tenantId && !isAdmin) {
    return res.status(400).json({ error: 'Missing tenant context' });
  }

  req.context = {
    userId,
    tenantId,
    userRoles: roles,
    isAdmin,
    scopes: {} // populated by downstream middleware
  };

  next();
}
```

**Sources:**
- [Request Context with TypeScript and Express](https://thebigredgeek.medium.com/request-context-with-typescript-and-express-4b5d6d903caa)
- [express-http-context npm package](https://www.npmjs.com/package/express-http-context)

**Best practices:**
- Use WeakMap for request-scoped context to avoid memory leaks
- Prefer `req.context` over decorating req with multiple properties
- Consider AsyncLocalStorage for accessing context without passing req through call stack

**Confidence:** HIGH - standard Express pattern

### Layer 2: Service Layer - Query Filter Injection

**Pattern:** Utility function to merge tenant filter with query criteria

```javascript
// utils/queryScoping.js
function buildScopedFilter(collectionType, baseFilter, context, options = {}) {
  const { allowCrossTenant = false } = options;

  if (allowCrossTenant && context.isAdmin) {
    // Audit log: admin is performing cross-tenant query
    auditLog.warn('Cross-tenant query', {
      userId: context.userId,
      collection: collectionType
    });
    return baseFilter;
  }

  if (!context.tenantId) {
    throw new Error('SECURITY: tenantId required for scoped query');
  }

  return {
    tenantId: context.tenantId,
    ...baseFilter
  };
}

// Usage in service
async function getStudents(filter, context, options = {}) {
  const scopedFilter = buildScopedFilter('student', filter, context, options);
  return db.collection('students').find(scopedFilter).toArray();
}
```

**Key design decisions:**
1. **Default-deny:** `allowCrossTenant` must be explicitly set to true
2. **Context required:** Services should receive context, not individual fields (tenantId, userId)
3. **Fail-safe:** Throw error if tenantId missing (don't silently return empty results)
4. **Audit trail:** Log all cross-tenant operations for compliance

**Sources:**
- [Tenant Data Isolation Patterns](https://propelius.ai/blogs/tenant-data-isolation-patterns-and-anti-patterns)
- [Multi-Tenant RBAC in MongoDB](https://www.permit.io/blog/implement-multi-tenancy-rbac-in-mongodb)

**Confidence:** HIGH - industry standard pattern

### Layer 3: Database Wrapper - Automatic Tenant Scoping

**Pattern:** Proxy/wrapper around MongoDB collection methods

MongoDB native driver does not support interceptors like Mongoose plugins, so enforcement requires:
1. **Wrapper library** (e.g., tenant-mongo npm package)
2. **Custom collection proxy** wrapping db.collection() calls

```javascript
// db/tenantAwareCollection.js
function createTenantAwareCollection(collection, tenantId) {
  return new Proxy(collection, {
    get(target, prop) {
      const original = target[prop];

      // Intercept query methods
      if (['find', 'findOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'].includes(prop)) {
        return function(filter, ...args) {
          // Check if cross-tenant flag is set
          const allowCrossTenant = args[args.length - 1]?._allowCrossTenant;

          if (!allowCrossTenant && !filter.tenantId) {
            throw new Error(`SECURITY VIOLATION: ${prop} called without tenantId`);
          }

          // If filter already has tenantId, trust it (service layer added it)
          // Otherwise inject it
          const scopedFilter = filter.tenantId
            ? filter
            : { tenantId, ...filter };

          return original.call(target, scopedFilter, ...args);
        };
      }

      return original;
    }
  });
}

// Usage
const studentsCollection = createTenantAwareCollection(
  db.collection('students'),
  req.context.tenantId
);
```

**Alternative approach:** Use existing library `tenant-mongo` which provides:
- Automatic tenant scoping for all queries
- `setTenant({ tenant: 'id', collections: [...] })` API
- Built on top of MongoDB native driver

**Sources:**
- [tenant-mongo npm package](https://www.npmjs.com/package/tenant-mongo)
- [GitHub: maliarov/tenant-mongo](https://github.com/maliarov/tenant-mongo)

**Tradeoffs:**
| Approach | Pros | Cons |
|----------|------|------|
| Custom Proxy | Full control, no dependencies, works with native driver | More code to maintain, need thorough testing |
| tenant-mongo library | Battle-tested, maintained, declarative API | External dependency, less flexibility |

**Recommendation for Tenuto.io:** Start with **custom utility** (buildScopedFilter) at service layer. Add database wrapper as Layer 5 defense once service layer is proven, to catch developer errors.

**Confidence:** MEDIUM - pattern is sound but MongoDB native driver lacks first-class support, requires custom implementation

### Layer 4: MongoDB Schema - Tenant Field + Indexes

While MongoDB doesn't enforce row-level security, proper indexing improves both performance and safety:

```javascript
// migrations/add-tenant-indexes.js
db.collection('students').createIndex(
  { tenantId: 1, _id: 1 },
  { name: 'tenant_id_index' }
);

db.collection('students').createIndex(
  { tenantId: 1, email: 1 },
  { unique: true, name: 'tenant_email_unique' }
);
```

**Key points:**
- **Compound indexes** with tenantId as first field optimize scoped queries
- **Unique constraints** should be tenant-scoped (tenantId + email, not global email)
- **Partial indexes** can exclude cross-tenant documents from certain indexes

**Sources:**
- [Build a Multi-Tenant Architecture in MongoDB - GeeksforGeeks](https://www.geeksforgeeks.org/dbms/build-a-multi-tenant-architecture-in-mongodb/)
- [MongoDB Multi-Tenancy Official Docs](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/)

**Confidence:** HIGH - MongoDB best practice

## Data Flow

### Request to Query Flow

```
1. HTTP Request
   Headers: { Authorization: "Bearer <JWT>" }
   JWT payload: { userId, tenantId, roles }

2. authenticateToken middleware
   → Verify JWT
   → Decode payload → req.user = { userId, tenantId, roles, isAdmin }

3. buildContext middleware
   → req.context = {
       userId: req.user.userId,
       tenantId: req.user.tenantId,
       userRoles: req.user.roles,
       isAdmin: req.user.isAdmin,
       scopes: { studentIds: [...], orchestraIds: [...] }
     }

4. Route handler
   → Extract business logic filter from req.query/req.body
   → Call service with (filter, req.context)

5. Service layer
   const scopedFilter = buildScopedFilter('student', filter, context);
   → scopedFilter = { tenantId: '123', ...filter }
   → db.collection('students').find(scopedFilter)

6. Database wrapper (optional defense layer)
   → Intercept find() call
   → Validate scopedFilter.tenantId exists OR allowCrossTenant flag
   → Execute query

7. MongoDB
   → Execute query with tenantId filter
   → Return only tenant's documents
```

### Cross-Tenant Query Flow (Admin Operations)

```
1-4. [Same as above, but context.isAdmin = true]

5. Service layer
   const scopedFilter = buildScopedFilter(
     'student',
     filter,
     context,
     { allowCrossTenant: true } // EXPLICIT flag
   );

   → Checks: context.isAdmin = true + allowCrossTenant = true
   → Audit log: "Admin user X performed cross-tenant query on students"
   → scopedFilter = { ...filter } // No tenantId injected

6. Database wrapper
   → Detects allowCrossTenant flag
   → Allows query without tenantId
   → Audit log

7. MongoDB
   → Execute query across all tenants
```

**Critical safeguards:**
- Cross-tenant queries require **both** `context.isAdmin === true` AND `allowCrossTenant: true` flag
- Never allow implicit cross-tenant queries
- All cross-tenant operations logged to audit trail

## Enforcement Patterns

### Pattern 1: Service Layer Filter Injection (RECOMMENDED)

**When:** Standard approach for most applications

**Implementation:**
```javascript
// api/student/student.service.js
async function getStudents(filter = {}, context, options = {}) {
  if (!context) {
    throw new Error('Context required for tenant-scoped query');
  }

  const scopedFilter = buildScopedFilter('student', filter, context, options);
  const db = await getDb();
  return db.collection('students').find(scopedFilter).toArray();
}
```

**Pros:**
- Explicit, easy to understand
- Works with MongoDB native driver
- No magic, easy to debug

**Cons:**
- Developers can forget to call buildScopedFilter
- Requires discipline across team

**Confidence:** HIGH

### Pattern 2: Database Wrapper/Proxy (DEFENSE IN DEPTH)

**When:** Add as Layer 5 defense after Pattern 1 is implemented

**Implementation:**
```javascript
// db/connection.js
function getCollection(name, context) {
  const collection = db.collection(name);
  return createTenantAwareProxy(collection, context.tenantId);
}

// Service layer
const students = await getCollection('students', context).find(filter).toArray();
```

**Pros:**
- Catches developer errors (forgot to scope query)
- Fail-safe - throws error instead of leaking data
- Centralized enforcement

**Cons:**
- More complex setup
- Proxy overhead (minimal)
- Harder to debug if proxy logic has bugs

**Confidence:** MEDIUM - pattern is sound, implementation requires care

### Pattern 3: Mongoose-Style Plugin (NOT APPLICABLE)

**Status:** Not applicable for MongoDB native driver

MongoDB native driver does not support pre/post hooks like Mongoose. If using Mongoose, you could implement:

```javascript
// Mongoose example (NOT for native driver)
schema.pre('find', function() {
  if (!this.getFilter().tenantId) {
    throw new Error('Missing tenantId');
  }
});
```

**Confidence:** HIGH (for Mongoose), N/A (for native driver)

### Pattern 4: Request-Scoped Connection Pool

**When:** Database-per-tenant architecture (NOT recommended for Tenuto.io)

**Implementation:**
```javascript
function getDbForTenant(tenantId) {
  // Return cached connection or create new
  return connectionPool.getConnection(`tenant_${tenantId}`);
}
```

**Pros:**
- Strongest isolation (separate databases)
- Impossible to leak data across tenants

**Cons:**
- Higher infrastructure cost
- Complex connection management
- Harder to run cross-tenant analytics

**Not recommended for Tenuto.io** - shared database with tenantId field is more cost-effective.

**Sources:**
- [Multi-Tenancy and MongoDB - Medium](https://medium.com/mongodb/multi-tenancy-and-mongodb-5658512ed398)
- [Build Multi-Tenant Architecture - MongoDB Docs](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/)

**Confidence:** HIGH

## Allowlist Mechanism

### Design Principles

1. **Explicit over implicit:** Cross-tenant access requires explicit flag
2. **Role-based:** Only admin roles can perform cross-tenant queries
3. **Auditable:** All cross-tenant operations logged
4. **Granular:** Per-query allowlist, not per-service

### Implementation Pattern

```javascript
// utils/queryScoping.js
function buildScopedFilter(collectionType, baseFilter, context, options = {}) {
  const { allowCrossTenant = false } = options;

  // Cross-tenant queries require BOTH conditions
  if (allowCrossTenant) {
    if (!context.isAdmin) {
      throw new Error('SECURITY: Cross-tenant queries require admin role');
    }

    // Audit log
    auditLogger.logCrossTenantQuery({
      userId: context.userId,
      collection: collectionType,
      filter: baseFilter,
      timestamp: new Date()
    });

    return baseFilter; // No tenantId injected
  }

  // Standard tenant-scoped query
  if (!context.tenantId) {
    throw new Error('SECURITY: tenantId required for scoped query');
  }

  return {
    tenantId: context.tenantId,
    ...baseFilter
  };
}
```

### Allowlist Use Cases

| Use Case | Allow Cross-Tenant? | Rationale |
|----------|---------------------|-----------|
| Student CRUD operations | NO | Always tenant-scoped |
| Teacher dashboard | NO | Teacher sees only their tenant |
| Admin dashboard - tenant list | YES | Admin needs to see all tenants |
| Admin dashboard - user count | YES | Aggregate across tenants |
| Super admin - data migration | YES | One-time operation, heavily audited |
| System metrics collection | YES | Background job, read-only |

### Audit Schema

```javascript
// collections/audit_log
{
  _id: ObjectId,
  eventType: 'CROSS_TENANT_QUERY',
  userId: ObjectId,
  userEmail: 'admin@example.com',
  collection: 'students',
  filter: { status: 'active' },
  resultCount: 1234,
  timestamp: ISODate,
  requestId: 'uuid'
}
```

**Sources:**
- [Best Practices for Multi-Tenant Authorization](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization)
- [Cross-Tenant Access Overview - Microsoft Entra](https://learn.microsoft.com/en-us/entra/external-id/cross-tenant-access-overview)

**Confidence:** HIGH

## Build Order

### Phase 1: Foundation (1-2 days)

**Goal:** Establish single source of truth for tenant context

1. **Standardize req.context structure** across all middleware
   - Ensure buildContext sets: `{ userId, tenantId, userRoles, isAdmin, scopes }`
   - Add validation: throw if tenantId missing for non-admin requests

2. **Create buildScopedFilter utility**
   - File: `utils/queryScoping.js`
   - Functions: `buildScopedFilter(type, filter, context, options)`
   - Tests: Verify default-deny, admin allowlist, audit logging

3. **Create audit logging service**
   - File: `services/auditLog.service.js`
   - Log cross-tenant queries to MongoDB collection

**Dependencies:** None - pure utility functions

**Validation:** Unit tests, integration test with sample service

### Phase 2: Service Layer Adoption (3-5 days)

**Goal:** Refactor existing services to use buildScopedFilter

1. **Identify all MongoDB query locations**
   - Grep for `db.collection(` and `.find(`, `.findOne(`, etc.
   - Audit: Which services already inject tenantId? Which don't?

2. **Refactor services module by module**
   - Priority order: student → teacher → schedule → analytics
   - Pattern: Add `context` parameter, call `buildScopedFilter` before every query
   - For each service:
     ```javascript
     // Before
     async function getStudents(filter, teacherId) {
       return db.collection('students').find({ ...filter, teacherId }).toArray();
     }

     // After
     async function getStudents(filter, context) {
       const scopedFilter = buildScopedFilter('student', filter, context);
       return db.collection('students').find(scopedFilter).toArray();
     }
     ```

3. **Update service tests**
   - All service tests must pass mock context: `{ tenantId: 'test-tenant', ... }`
   - Add negative tests: verify services throw without context

**Dependencies:** Phase 1 complete

**Validation:** Run full test suite, manual QA on dev environment

### Phase 3: Admin Allowlist (2-3 days)

**Goal:** Safely enable cross-tenant operations for admin features

1. **Identify legitimate cross-tenant operations**
   - Super admin dashboard: tenant list, aggregate stats
   - System background jobs: metrics, cleanup scripts
   - Data import/export: may need cross-tenant validation

2. **Add allowCrossTenant flag to services**
   ```javascript
   // Admin service
   async function getAllTenantStats(context) {
     const filter = buildScopedFilter('tenant', {}, context, {
       allowCrossTenant: true
     });
     return db.collection('tenants').find(filter).toArray();
   }
   ```

3. **Implement audit dashboard**
   - UI for viewing audit_log collection
   - Filter by userId, collection, date range
   - Alert on suspicious patterns (same user making many cross-tenant queries)

**Dependencies:** Phase 2 complete

**Validation:** Verify admin features work, check audit logs populated

### Phase 4: Database Wrapper (Optional, 2-3 days)

**Goal:** Add Layer 5 defense to catch developer errors

1. **Implement collection proxy**
   - File: `db/tenantAwareCollection.js`
   - Wrap MongoDB collection methods to enforce tenantId presence
   - Allow opt-out via `_allowCrossTenant` symbol

2. **Update getDb() helper**
   ```javascript
   // db/connection.js
   function getCollection(name, context) {
     const collection = db.collection(name);
     return createTenantAwareProxy(collection, context);
   }
   ```

3. **Roll out gradually**
   - Start with one module (e.g., student service)
   - Monitor for false positives (legitimate queries blocked)
   - Expand to all services once stable

**Dependencies:** Phase 2 complete (Phase 3 optional)

**Validation:** Run test suite, should pass with no changes (wrapper is transparent)

### Phase 5: Testing & Validation (Ongoing)

**Goal:** Prove tenant isolation is enforced

1. **Automated tenant isolation tests**
   ```javascript
   // tests/security/tenantIsolation.test.js
   describe('Tenant Isolation', () => {
     it('should not return tenant A data when context has tenant B', async () => {
       // Seed: tenant A has 10 students, tenant B has 5 students
       const contextB = { tenantId: 'tenant-b', isAdmin: false };
       const students = await studentService.getStudents({}, contextB);
       expect(students).toHaveLength(5);
       students.forEach(s => expect(s.tenantId).toBe('tenant-b'));
     });
   });
   ```

2. **Penetration testing**
   - Attempt to access other tenant's data by manipulating JWT
   - Verify middleware rejects invalid tenantId
   - Test IDOR vulnerabilities

3. **Audit log monitoring**
   - Set up alerts for suspicious patterns
   - Weekly review of cross-tenant queries

**Dependencies:** All phases

**Validation:** Zero tenant isolation violations in production

## Integration Points

### Existing Middleware Chain

```
Current: authenticateToken → buildContext → addSchoolYearToRequest → routes

No changes needed ✓
```

**buildContext already provides:**
- `req.context.tenantId`
- `req.context.isAdmin`
- `req.context.userRoles`

**Integration:** Services already receive context from route handlers. No middleware changes required.

### Service Layer

**Current pattern:**
```javascript
// Many services already do this
async function getStudents(filter, context) {
  const scopedFilter = buildScopedFilter('student', filter, context);
  return db.collection('students').find(scopedFilter).toArray();
}
```

**Gap:** Some services still use legacy `(filter, teacherId, isAdmin)` signature.

**Migration path:**
1. Add context parameter alongside legacy parameters (backward compat)
2. Update callers to pass context
3. Deprecate old parameters
4. Remove old parameters

### Controller Layer

**Current pattern:**
```javascript
// student.controller.js
async function getStudents(req, res) {
  const students = await studentService.getStudents(
    req.query,
    req.context // Already passing context ✓
  );
  res.json(students);
}
```

**No changes needed** - controllers already pass req.context to services.

### Background Jobs

**Gap:** Background jobs don't have req.context from HTTP request.

**Solution:** Create system context for background jobs:
```javascript
// utils/systemContext.js
function createSystemContext(options = {}) {
  return {
    userId: null,
    tenantId: options.tenantId || null, // null = cross-tenant admin job
    userRoles: ['system'],
    isAdmin: true,
    scopes: {}
  };
}

// Usage in background job
const context = createSystemContext({ allowCrossTenant: true });
const stats = await analyticsService.calculateGlobalStats({}, context, {
  allowCrossTenant: true
});
```

### Testing

**Integration with test suite:**
```javascript
// tests/helpers/testContext.js
function createTestContext(overrides = {}) {
  return {
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    userRoles: ['מורה'],
    isAdmin: false,
    scopes: {},
    ...overrides
  };
}

// Usage in tests
const context = createTestContext({ isAdmin: true });
const students = await studentService.getStudents({}, context);
```

## MongoDB Native Driver Considerations

### Limitations vs Mongoose

| Feature | Mongoose | MongoDB Native Driver |
|---------|----------|----------------------|
| Pre/post hooks | ✓ | ✗ |
| Schema validation | ✓ | ✓ (via JSON schema) |
| Plugins | ✓ | ✗ |
| Query builder | Limited | Full MongoDB query syntax |
| Middleware | ✓ | ✗ |

**Implication:** Cannot use Mongoose plugin pattern. Must implement tenant scoping via:
1. Service-layer utilities (buildScopedFilter)
2. Database wrapper/proxy (optional Layer 5)

### Native Driver Interception Options

**Option 1: Monkey-patch Collection methods** (NOT RECOMMENDED)
```javascript
const originalFind = Collection.prototype.find;
Collection.prototype.find = function(filter, ...args) {
  if (!filter.tenantId) throw new Error('Missing tenantId');
  return originalFind.call(this, filter, ...args);
};
```
**Risk:** Global mutation, hard to control, breaks if driver updates

**Option 2: Proxy wrapper** (RECOMMENDED)
```javascript
const proxiedCollection = new Proxy(collection, {
  get(target, prop) {
    if (prop === 'find') {
      return (filter, ...args) => {
        // Validate/inject tenantId
        return target.find(filter, ...args);
      };
    }
    return target[prop];
  }
});
```
**Benefit:** Scoped to specific collection instances, no global side effects

**Option 3: Service-layer only** (SIMPLEST)
```javascript
// Just use buildScopedFilter everywhere, no driver interception
```
**Benefit:** Simple, explicit, easy to understand
**Risk:** Developers can forget to call it

**Recommendation for Tenuto.io:**
- Start with **Option 3** (service layer only)
- Add **Option 2** (proxy wrapper) as Layer 5 defense once service layer is proven
- Never use **Option 1** (monkey-patching)

**Confidence:** HIGH

## Risk Assessment

### High-Risk Scenarios

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Developer forgets to call buildScopedFilter | Medium | Critical | Add database wrapper (Layer 5), code review checklist |
| Cross-tenant query without audit log | Low | High | Unit tests for audit logging, monitor audit collection |
| Admin account compromise | Low | Critical | MFA required, rate limiting, anomaly detection |
| Background job uses wrong context | Medium | High | Explicit system context creation, test cross-tenant jobs |
| Migration script deletes wrong tenant | Low | Critical | Dry-run flag, backup before migration, tenant allowlist |

### Medium-Risk Scenarios

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance degradation from wrapper | Medium | Medium | Benchmark, cache proxied collections |
| False positive blocking legitimate query | Low | Medium | Careful testing, monitor error logs |
| Audit log grows too large | High | Low | TTL index on audit collection, archive old logs |

## Performance Considerations

### Query Performance

**Compound indexes with tenantId:**
```javascript
db.collection('students').createIndex({ tenantId: 1, lastName: 1 });
// Query: { tenantId: 'X', lastName: 'Smith' }
// Uses index efficiently ✓
```

**Anti-pattern:**
```javascript
db.collection('students').createIndex({ lastName: 1 });
// Query: { tenantId: 'X', lastName: 'Smith' }
// Index not optimal for multi-tenant queries ✗
```

**Recommendation:** All indexes should have tenantId as first field for optimal performance.

**Sources:**
- [MongoDB Multi-Tenant Architecture](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/)

### Wrapper Overhead

**Proxy performance:**
- Negligible overhead (< 1% in benchmarks)
- Only intercepts method access, not query execution
- Recommendation: Don't optimize prematurely, measure first

### Audit Log Volume

**Estimate for Tenuto.io:**
- 10 tenants × 50 users/tenant × 10 queries/day = 5,000 audit events/day
- Average audit doc size: 500 bytes
- Daily volume: ~2.5 MB
- Yearly volume: ~900 MB

**Mitigation:**
- TTL index: auto-delete audit logs older than 1 year
- Compress old logs to archival storage
- Only log cross-tenant queries, not all queries

## Sources

### High Confidence (Official Docs, Established Patterns)

- [Build a Multi-Tenant Architecture - MongoDB Official Docs](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/)
- [Implement Multi-Tenancy RBAC in MongoDB](https://www.permit.io/blog/implement-multi-tenancy-rbac-in-mongodb)
- [Request Context with TypeScript and Express](https://thebigredgeek.medium.com/request-context-with-typescript-and-express-4b5d6d903caa)
- [Architecting Secure Multi-Tenant Data Isolation](https://medium.com/@justhamade/architecting-secure-multi-tenant-data-isolation-d8f36cb0d25e)
- [Tenant Data Isolation: Patterns and Anti-Patterns](https://propelius.ai/blogs/tenant-data-isolation-patterns-and-anti-patterns)
- [Best Practices for Multi-Tenant Authorization](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization)

### Medium Confidence (Community Patterns, Libraries)

- [Building a Multi-Tenant App With NodeJS + MongoDB](https://medium.com/geekculture/building-a-multi-tenant-app-with-nodejs-mongodb-ec9b5be6e737)
- [tenant-mongo npm package](https://www.npmjs.com/package/tenant-mongo)
- [express-http-context npm package](https://www.npmjs.com/package/express-http-context)
- [Multi-Tenant Node.js Application with Mongoose](https://medium.com/brightlab-techblog/multitenant-node-js-application-with-mongoose-mongodb-f8841a285b4f)
- [Multi-Tenancy in Node.js: Implementation Guide](https://www.theblueflamelabs.com/insights/multi-tenant-application-on-node-js/)

### Defense-in-Depth Research

- [Data Isolation in Multi-Tenant SaaS - Redis](https://redis.io/blog/data-isolation-multi-tenant-saas/)
- [Tenant Isolation in Multi-Tenant Systems - WorkOS](https://workos.com/blog/tenant-isolation-in-multi-tenant-systems)
- [Kubernetes Multi-Tenancy Implementation Guide](https://atmosly.com/blog/kubernetes-multi-tenancy-complete-implementation-guide-2025)
- [Cross-Tenant Access Overview - Microsoft Entra](https://learn.microsoft.com/en-us/entra/external-id/cross-tenant-access-overview)

## Recommendations for Tenuto.io

### Immediate (Week 1)

1. **Standardize buildScopedFilter usage**
   - Already exists in `utils/queryScoping.js`
   - Audit all services for consistent usage
   - Add context parameter to services that don't have it yet

2. **Add audit logging for cross-tenant queries**
   - Create auditLog.service.js
   - Log all queries with `allowCrossTenant: true`

3. **Write tenant isolation tests**
   - Test that tenant A cannot access tenant B data
   - Test that admin with allowCrossTenant flag can access cross-tenant

### Short-term (Month 1)

4. **Database wrapper (Layer 5 defense)**
   - Implement Proxy-based collection wrapper
   - Roll out to one module first (student service)
   - Monitor for false positives
   - Expand to all modules

5. **Background job context**
   - Create createSystemContext() utility
   - Update all background jobs to use explicit context

6. **Compound index audit**
   - Verify all indexes have tenantId as first field
   - Add missing indexes for performance

### Long-term (Quarter 1)

7. **Penetration testing**
   - Hire security firm or use internal red team
   - Attempt tenant isolation breaches
   - Fix any vulnerabilities found

8. **Monitoring & alerting**
   - Dashboard for audit log review
   - Alerts for suspicious patterns (e.g., many cross-tenant queries from one user)
   - Quarterly security reviews
