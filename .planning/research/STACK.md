# Technology Stack: Multi-Tenant Isolation Hardening

**Project:** Tenuto.io Backend — Multi-Tenant Architecture Hardening
**Researched:** 2026-02-14
**Context:** Subsequent milestone — adding tenant isolation enforcement to existing Node.js + Express + MongoDB backend

## Executive Summary

This stack focuses on **tenant isolation tooling and verification** for an existing shared-database multi-tenant system. The core stack (Express, MongoDB native driver, JWT) is already in place. This research identifies libraries and patterns specifically for hardening tenant isolation through middleware enforcement, query auditing, and automated testing.

**Key Principle:** Default-deny model with explicit allowlist for cross-tenant operations. Every query path must enforce tenantId filtering, with automated verification to catch regressions.

---

## Core Tenant Isolation Stack

### Tenant Context Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **AsyncLocalStorage** (native) | Node.js 16.4.0+ stable | Maintain tenant context throughout async request lifecycle | Built-in, performant, memory-safe. Supersedes cls-hooked. Allows tenant context to propagate through async operations without explicit passing. | **HIGH** — Official Node.js API, stable since 16.4.0 |
| MongoDB Native Driver | 7.1.0+ | Database operations with connection pooling | Already in use. v7.0+ requires Node.js 20.19.0+. v6.18.0+ properly closes idle connections. Supports bulk operations across collections. | **MEDIUM** — Version from npm search (10 days old as of 2026-02-14) |

**Rationale:** AsyncLocalStorage is the 2025 standard for tenant context management in Node.js. It replaced cls-hooked (which was based on deprecated async_hooks patterns) and provides automatic context propagation across async boundaries. This eliminates the need to pass `tenantId` through every function parameter.

**Implementation Pattern:**
```javascript
import { AsyncLocalStorage } from 'node:async_hooks';
const tenantContext = new AsyncLocalStorage();

// Middleware
app.use((req, res, next) => {
  const tenantId = extractTenantId(req); // from JWT, header, subdomain
  tenantContext.run({ tenantId, userId: req.user.id }, next);
});

// Anywhere in the async chain
function getCollection() {
  const { tenantId } = tenantContext.getStore();
  if (!tenantId) throw new Error('No tenant context');
  return db.collection('students').find({ tenantId });
}
```

---

### Security Middleware

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **helmet** | Latest (8.x+) | Set security HTTP headers | Standard Express security middleware. Sets 15 security headers including CSP, X-Frame-Options, etc. Essential for production SaaS. | **HIGH** — Industry standard, official Express recommendation |
| **express-rate-limit** | Latest (7.x+) | Prevent abuse via request throttling | Defend against brute-force attacks, request flooding, tenant enumeration. Per-IP and per-tenant rate limiting. | **HIGH** — Recommended in Express security best practices |
| **express-validator** | Latest (7.x+) | Input sanitization and validation | Prevent NoSQL injection, XSS. Chain validation + sanitization. Supports custom validators for tenant-specific rules. | **MEDIUM** — Well-established, but no specific tenant isolation features found |

**Anti-Pattern to Avoid:** DO NOT use enhancedAuth middleware patterns that bypass the standard authentication chain. According to project context, `enhancedAuth.middleware.js` is marked deprecated and unused.

---

### MongoDB Query Auditing & Profiling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **MongoDB Database Profiler** | Native | Capture all database operations for audit | Built-in profiler collects detailed command information (CRUD + admin). Query `system.profile` collection to verify tenantId in every query filter. | **HIGH** — Official MongoDB feature |
| **MongoDB Auditing** (Enterprise) | Native | Track system activity for compliance | Atlas supports database auditing for multi-user deployments. Can filter by user, role, action. Logs to console/syslog/JSON/BSON. | **MEDIUM** — Requires MongoDB Enterprise or Atlas |
| **MongoDB Change Streams** | Native (4.0+) | Real-time audit trail | Provides real-time notification of data changes. Can build audit log decoupled from business logic. Metadata (userId, appName, IP) must be added by application. | **HIGH** — Standard MongoDB feature since 4.0 |

**Usage Pattern:**
```javascript
// Enable profiling (level 2 = all operations)
db.setProfilingLevel(2);

// Audit queries missing tenantId
db.system.profile.find({
  ns: /^tenuto\.(students|teachers|orchestras)/,
  'command.filter.tenantId': { $exists: false }
});
```

**Warning:** Database profiler has performance overhead. Use level 1 (slow queries only) in production, level 2 (all queries) for short audits.

---

## Testing & Verification Stack

### Tenant Isolation Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Jest** | Latest (29.x+) | Test framework | Already in use. Industry standard for Node.js testing. | **HIGH** — Established in project |
| **Supertest** | Latest (7.x+) | HTTP integration testing | Test API endpoints with different tenant contexts. Verify tenant A cannot access tenant B data. | **HIGH** — Standard for Express API testing |
| **MongoDB explain()** | Native | Verify query plan uses tenantId index | Automated check that queries use compound indexes starting with tenantId. Detect missing filters in test suite. | **HIGH** — Built-in MongoDB feature |

**Testing Pattern:**
```javascript
describe('Tenant Isolation', () => {
  it('prevents cross-tenant data access', async () => {
    const tenantA = await createTenant('A');
    const tenantB = await createTenant('B');

    const response = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .expect(200);

    // Verify no tenant B data leaked
    const leaked = response.body.students.filter(s => s.tenantId === tenantB.id);
    expect(leaked).toHaveLength(0);
  });

  it('uses tenantId index for all queries', async () => {
    const explained = await db.collection('students')
      .find({ tenantId: 'test' })
      .explain('executionStats');

    // Verify index used
    expect(explained.executionStats.executionStages.indexName)
      .toMatch(/tenantId/);
  });
});
```

---

### Security Testing Tools

| Tool | Purpose | When to Use | Confidence |
|------|---------|-------------|------------|
| **OWASP ZAP** | Automated security scanning | Pre-release security audit. Detect IDOR, injection, XSS. | **MEDIUM** — Industry standard, but web search only |
| **Burp Suite** | Manual penetration testing | Professional security assessment before launch. | **MEDIUM** — Industry standard penetration testing tool |
| **Snyk** | Dependency vulnerability scanning | Automated CI/CD pipeline check. Monitor npm dependencies for known CVEs. | **MEDIUM** — Widely used in Node.js ecosystem |
| **node-chaos-monkey** | Chaos engineering for Node.js | Inject failures to test tenant isolation under adverse conditions. | **LOW** — Found via GitHub, limited production usage data |

**Note:** For comprehensive security testing, consider PTaaS (Penetration Testing as a Service) providers like Cobalt, Intruder, or Astra Security that specialize in multi-tenant SaaS testing.

---

## Anti-Patterns & What NOT to Use

| Technology/Pattern | Why Avoid | Use Instead |
|-------------------|-----------|-------------|
| **cls-hooked** | Deprecated. Based on older async_hooks patterns. Less performant than AsyncLocalStorage. | **AsyncLocalStorage** (native Node.js) |
| **Mongoose** | Already using MongoDB native driver. Adding Mongoose introduces ORM complexity and migration risk. | **MongoDB native driver** with manual middleware layer |
| **Global tenantId variable** | Not async-safe. Will leak across requests in high-concurrency scenarios. | **AsyncLocalStorage** for request-scoped context |
| **Separate DB per tenant** | Extremely costly, doesn't scale. Project uses shared-database model. | **Shared DB with tenantId field** (current approach) |
| **Client-side tenant filtering** | NEVER trust client to filter by tenantId. Always enforce server-side. | **Server-side query scoping** with middleware enforcement |
| **Hardcoded cross-tenant queries** | Scattered allowlist = audit nightmare. | **Centralized cross-tenant permission service** |

---

## Installation Commands

```bash
# Core tenant isolation (AsyncLocalStorage is built-in to Node.js 16.4.0+)
# Ensure Node.js 20.19.0+ for MongoDB driver v7.x

# Security middleware
npm install helmet express-rate-limit express-validator

# Testing tools
npm install -D jest supertest

# Optional: Chaos engineering
npm install -D node-chaos-monkey

# MongoDB driver (if upgrading from v6.x to v7.x)
npm install mongodb@^7.1.0
```

---

## MongoDB Indexing Strategy

**Critical for Performance & Security:**

All multi-tenant collections MUST have compound indexes starting with `tenantId`:

```javascript
// Students collection
db.students.createIndex({ tenantId: 1, _id: 1 });
db.students.createIndex({ tenantId: 1, 'personalInfo.lastName': 1 });
db.students.createIndex({ tenantId: 1, status: 1 });

// Teachers collection
db.teachers.createIndex({ tenantId: 1, _id: 1 });
db.teachers.createIndex({ tenantId: 1, 'credentials.email': 1 }, { unique: true });

// TeacherAssignments collection
db.teacherAssignments.createIndex({ tenantId: 1, studentId: 1, teacherId: 1 });
db.teacherAssignments.createIndex({ tenantId: 1, teacherId: 1 });
```

**Rationale:** MongoDB query planner will use these indexes to efficiently filter by tenant. Without `tenantId` as the first field, queries will scan across tenants even with proper filters.

**Verification:**
```javascript
// Automated test
const plan = await collection.find({ tenantId: 'X', status: 'active' }).explain();
expect(plan.queryPlanner.winningPlan.inputStage.indexName).toMatch(/^tenantId/);
```

---

## Middleware Enforcement Pattern

**Recommended Architecture:**

```
Request → authenticateToken → tenantContextMiddleware → buildScopedFilter → routes
```

**Implementation:**

```javascript
// 1. Tenant Context Middleware (using AsyncLocalStorage)
import { AsyncLocalStorage } from 'node:async_hooks';
const tenantContext = new AsyncLocalStorage();

function tenantContextMiddleware(req, res, next) {
  const tenantId = req.user?.tenantId; // From JWT
  const userId = req.user?.id;

  if (!tenantId) {
    return res.status(401).json({ error: 'Missing tenant context' });
  }

  tenantContext.run({ tenantId, userId }, next);
}

// 2. Query Scoping Utility (already exists: utils/queryScoping.js)
function buildScopedFilter(collectionName, baseFilter, context) {
  const { tenantId } = context || tenantContext.getStore();

  if (!tenantId) {
    throw new Error('SECURITY: No tenant context for query');
  }

  // Merge tenantId into filter
  return { ...baseFilter, tenantId };
}

// 3. Service Layer Usage
async function findStudents(filter, options) {
  const context = tenantContext.getStore();
  const scopedFilter = buildScopedFilter('students', filter, context);

  return db.collection('students').find(scopedFilter).toArray();
}
```

**Cross-Tenant Allowlist Pattern:**

```javascript
// Centralized service for explicit cross-tenant operations
class CrossTenantPermissionService {
  static ALLOWED_OPERATIONS = {
    SUPER_ADMIN_ANALYTICS: ['superAdmin'],
    TENANT_MIGRATION: ['superAdmin', 'migrationService']
  };

  static async verifyPermission(operation, context) {
    const { userId, role } = context;
    const allowedRoles = this.ALLOWED_OPERATIONS[operation];

    if (!allowedRoles || !allowedRoles.includes(role)) {
      throw new UnauthorizedError(`Cross-tenant ${operation} not allowed`);
    }

    // Log for audit trail
    await auditLog.create({
      operation,
      userId,
      timestamp: new Date(),
      type: 'CROSS_TENANT_ACCESS'
    });
  }

  static async queryCrossTenant(operation, filter) {
    const context = tenantContext.getStore();
    await this.verifyPermission(operation, context);

    // Intentionally omit tenantId — this is the allowlist
    return db.collection('students').find(filter).toArray();
  }
}
```

---

## Aggregation Pipeline Hardening

**Problem:** MongoDB aggregation pipelines are vulnerable to NoSQL injection via operators like `$unionWith`, `$lookup`, `$graphLookup` that can access other collections.

**Prevention:**

1. **Input Validation:** Never pass user input directly into aggregation stages.
2. **Parameterized Pipelines:** Build pipeline stages programmatically, not via string concatenation.
3. **Tenant Filter Injection:** Inject `$match: { tenantId }` as first stage of every pipeline.

```javascript
function buildAggregationPipeline(userStages, context) {
  const { tenantId } = context || tenantContext.getStore();

  if (!tenantId) {
    throw new Error('SECURITY: No tenant context for aggregation');
  }

  // ALWAYS inject tenant filter as first stage
  const tenantFilter = { $match: { tenantId } };

  // Validate user stages don't contain dangerous operators
  const dangerousOps = ['$unionWith', '$lookup', '$graphLookup', '$merge', '$out'];
  const hasDangerousOp = userStages.some(stage =>
    dangerousOps.some(op => Object.keys(stage).includes(op))
  );

  if (hasDangerousOp) {
    throw new Error('SECURITY: Dangerous aggregation operator detected');
  }

  return [tenantFilter, ...userStages];
}
```

**Alternative:** Use an allowlist approach where only pre-defined, validated aggregation pipelines are allowed.

---

## Change Streams for Audit Trail

**Use Case:** Real-time audit log for tenant data modifications.

```javascript
const changeStream = db.collection('students').watch([
  { $match: { operationType: { $in: ['insert', 'update', 'delete'] } } }
]);

changeStream.on('change', async (change) => {
  const tenantId = change.fullDocument?.tenantId ||
                   change.documentKey?.tenantId;

  await auditLog.create({
    tenantId,
    collection: 'students',
    operationType: change.operationType,
    documentId: change.documentKey._id,
    timestamp: new Date(),
    userId: tenantContext.getStore()?.userId, // From AsyncLocalStorage
    changes: change.updateDescription
  });
});
```

**Limitation:** Change streams do NOT automatically include user context (who made the change). You must inject this via AsyncLocalStorage or another mechanism.

---

## Performance Considerations

| Concern | At Current Scale | At 10K Users | At 100K Users | Mitigation |
|---------|------------------|--------------|---------------|------------|
| **AsyncLocalStorage overhead** | Negligible (<1ms per request) | Negligible | Negligible | Built-in performance is optimized |
| **Database profiler** | 5-10% overhead (level 2) | Unacceptable | Unacceptable | Use level 1 (slow queries) or disable in production |
| **Compound index size** | Minimal (tenantId is string) | Moderate | Large | Monitor index sizes, consider partitioning |
| **Change streams** | Low overhead | Moderate | High | Use filtered change streams, batch audit writes |
| **Rate limiting memory** | Low | Moderate | High | Use Redis store for express-rate-limit instead of in-memory |

**Recommended Production Config:**

```javascript
// Rate limiter with Redis (for multi-instance deployments)
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const limiter = rateLimit({
  store: new RedisStore({
    client: new Redis(process.env.REDIS_URL),
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-tenant rate limiter
const tenantLimiter = rateLimit({
  store: new RedisStore({
    client: new Redis(process.env.REDIS_URL),
    prefix: 'tl:',
  }),
  windowMs: 60 * 1000,
  max: async (req) => {
    const tier = await getTenantTier(req.user.tenantId);
    return tier === 'premium' ? 1000 : 100;
  },
  keyGenerator: (req) => req.user.tenantId,
});
```

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **AsyncLocalStorage** | HIGH | Official stable Node.js API since 16.4.0. Multiple current sources (2025-2026) confirm it's the standard. |
| **Security Middleware** | HIGH | helmet, express-rate-limit, express-validator are official Express recommendations. |
| **MongoDB Profiling** | MEDIUM | Official MongoDB feature, but WebFetch failed to retrieve detailed docs. Relied on official MongoDB manual links from WebSearch. |
| **Testing Tools** | HIGH | Jest + Supertest is industry standard for Node.js API testing. |
| **PTaaS Providers** | MEDIUM | WebSearch results from 2025 articles, but no hands-on verification of specific tools. |
| **Chaos Engineering** | LOW | node-chaos-monkey found via GitHub search, limited production usage data. |
| **MongoDB Driver Version** | MEDIUM | v7.1.0 confirmed via npm search as latest (10 days old), but official docs not directly accessed. |

---

## Gaps & Open Questions

1. **MongoDB Enterprise Auditing:** Detailed configuration for Atlas database auditing requires hands-on testing with Atlas environment.
2. **AsyncLocalStorage Performance at Scale:** While Node.js documentation confirms it's optimized, need load testing to confirm <1ms overhead claim at 100K+ requests/sec.
3. **Rate Limiter Redis Store:** express-rate-limit documentation lists Redis stores, but specific package versions and compatibility not verified.
4. **Change Streams Performance:** Need empirical data on change stream overhead with 100K+ documents/hour write load.
5. **Aggregation Pipeline Validation:** No existing library found for validating "safe" aggregation operators. May need custom implementation.

---

## Recommended Next Steps

1. **Prototype AsyncLocalStorage integration** — Add tenant context middleware to existing auth chain.
2. **Create tenant isolation test suite** — Use Jest + Supertest to verify no cross-tenant data leakage.
3. **Enable MongoDB profiler in dev** — Audit 100% of queries to find missing tenantId filters.
4. **Add compound indexes** — Ensure all collections have `{ tenantId: 1, ... }` indexes.
5. **Implement query explain() tests** — Automated verification that indexes are used.
6. **Add security middleware** — Install helmet + express-rate-limit in production.
7. **Build cross-tenant allowlist service** — Centralized permission checks for legitimate cross-tenant operations.
8. **Load test with tenant context** — Verify AsyncLocalStorage doesn't degrade performance.

---

## Sources

### High Confidence (Official Documentation)
- [Node.js AsyncLocalStorage API](https://nodejs.org/api/async_context.html)
- [MongoDB Database Profiler](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/)
- [MongoDB Change Streams](https://www.mongodb.com/docs/manual/changestreams/)
- [MongoDB Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)

### Medium Confidence (npm Packages & Community Articles)
- [mongodb npm package](https://www.npmjs.com/package/mongodb)
- [helmet npm package](https://www.npmjs.com/package/helmet)
- [express-rate-limit npm package](https://www.npmjs.com/package/express-rate-limit)
- [express-validator npm package](https://www.npmjs.com/package/express-validator)
- [How to Build Multi-Tenant APIs in Node.js (2026)](https://oneuptime.com/blog/post/2026-01-25-multi-tenant-apis-nodejs/view)
- [Multi-Tenancy with Node.js AsyncLocalStorage](https://medium.com/@jfelipevalr/multi-tenancy-with-node-js-asynclocalstorage-4c771a3d06ed)
- [Building an Audit Log with Change Streams](https://medium.com/@shailajat2281/building-an-audit-log-for-mongodb-collections-using-change-streams-d5fbe1184932)

### Low Confidence (WebSearch Only, Not Verified)
- [The Multi-Tenant Performance Crisis: Advanced Isolation Strategies for 2026](https://www.addwebsolution.com/blog/multi-tenant-performance-crisis-advanced-isolation-2026)
- [SaaS Penetration Testing Guide 2025](https://www.wati.com/the-ultimate-guide-to-saas-penetration-testing-in-2025/)
- [node-chaos-monkey GitHub](https://github.com/goldbergyoni/node-chaos-monkey)

---

## Version Summary

**Required Versions:**

- **Node.js:** 20.19.0+ (for MongoDB driver v7.x)
- **MongoDB Driver:** 7.1.0+ (latest stable as of 2026-02-14)
- **helmet:** Latest 8.x+
- **express-rate-limit:** Latest 7.x+
- **express-validator:** Latest 7.x+
- **Jest:** 29.x+ (already in project)
- **Supertest:** 7.x+

**Note:** Specific minor versions not critical — use `^` semver for patch updates. Pin major versions to avoid breaking changes.
