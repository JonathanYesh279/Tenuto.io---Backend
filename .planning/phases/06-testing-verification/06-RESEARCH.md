# Phase 6: Testing & Verification - Research

**Researched:** 2026-02-24
**Domain:** Multi-tenant isolation testing, integration test infrastructure, CI pipeline
**Confidence:** HIGH

## Summary

Phase 6 must prove that cross-tenant isolation works correctly across the entire application surface. The codebase has 288 query locations across 14 collections, 105 route endpoints, and 7 allowlisted cross-tenant route categories. The project already has a working test infrastructure: Vitest 3.2.4, mongodb-memory-server 10.4.3, supertest 7.2.2, with four Vitest config files (unit, integration, performance, phase2). The existing tests use two patterns: (1) mock-based integration tests using `vi.mock` on `mongoDB.service.js` with Express + supertest (auth, IDOR, student-lifecycle), and (2) real MongoDB Memory Server tests (cascade-deletion, which are currently skipped due to ESM import issues).

The critical testing gap is that **zero tenant isolation tests exist**. The existing IDOR test (`idor-prevention.integration.test.js`) tests role-based access (teacher A cannot see teacher B's students) but does NOT test cross-tenant isolation. The `test/setup.js` global setup actually MOCKS OUT tenant enforcement (`requireTenantId` always returns `'test-tenant-id'`, `buildScopedFilter` passes through without tenant filtering). This means no existing test exercises the actual tenant guard. The tenant isolation tests need their own Vitest config (like `vitest.config.phase2.js`) that does NOT use the global `test/setup.js` file, so real tenant middleware runs.

The project has no CI/CD pipeline -- no `.github/workflows/` directory, no Dockerfile, no CI config of any kind. Deployment is on Render. Setting up GitHub Actions with mongodb-memory-server is well-documented and straightforward. The load testing requirement (100+ concurrent requests) is addressable via supertest parallel requests or a dedicated concurrent test harness within Vitest -- the existing `scripts/load-test.js` benchmarks queries against a real MongoDB but does not test async context contamination, which is the actual risk at the concurrent request level.

**Primary recommendation:** Create a dedicated `vitest.config.tenant-isolation.js` (no global mocks), write two-tenant fixture scaffolding with supertest, and structure tests around the four requirements (TEST-01 through TEST-04) plus concurrency and verification checklist.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 | Test runner, assertions, mocking | Already project standard, ES module native |
| supertest | 7.2.2 | HTTP-level integration tests | Already installed, drives Express app without server.listen() |
| mongodb-memory-server | 10.4.3 | In-memory MongoDB for realistic DB tests | Already installed, provides real MongoDB queries |
| mongodb | 6.13.0 | Native driver (same as production) | Production driver, no ORM abstraction mismatch |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | 9.0.2 | Generate test JWTs with tenantId | Mint tokens for Tenant A vs Tenant B |
| bcryptjs | 3.0.0 | Hash test passwords | Create realistic teacher docs for auth flow |
| @vitest/coverage-v8 | 3.0.8 | Code coverage reporting | CI coverage thresholds |

### No New Dependencies Needed
All tools are already in the project. No new libraries are required.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Test Structure
```
test/
  tenant-isolation/
    setup.js                           # MMS setup WITHOUT global mocks
    fixtures/
      two-tenant-seed.js               # Canonical seed: 2 tenants, teachers, students, etc.
    read-isolation.test.js             # TEST-01: cross-tenant reads return empty/404
    write-isolation.test.js            # TEST-02: cross-tenant writes rejected
    allowlist-verification.test.js     # TEST-04: allowlisted routes work for authorized roles
    middleware/
      enforce-tenant.test.js           # enforceTenant, stripTenantId, buildContext
      strip-tenant-id.test.js          # Client tenantId mismatch returns 400
    services/
      scoped-filter.test.js            # buildScopedFilter adds tenantId to all queries
      query-scoping.test.js            # canAccessStudent, canAccessOwnResource
    concurrent/
      async-context.test.js            # 100+ concurrent requests, no contamination
  verification/
    route-accountability.test.js       # validateAllowlist passes, no unaccounted routes
    checklist.md                       # Human-walkable verification checklist

.github/
  workflows/
    tenant-isolation.yml               # CI workflow: run on every PR
```

### Pattern 1: Two-Tenant Test Fixture
**What:** Every tenant isolation test starts with two fully-populated tenants seeded into MongoDB Memory Server. Tenant A and Tenant B each have their own teachers, students, orchestras, school years, etc. Tests authenticate as Tenant A and attempt to access Tenant B's data.
**When to use:** Every test in the `tenant-isolation/` directory.
**Example:**
```javascript
// test/tenant-isolation/fixtures/two-tenant-seed.js
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export const TENANT_A_ID = 'tenant-a-raanana';
export const TENANT_B_ID = 'tenant-b-rishon';

export const tenantA = {
  _id: new ObjectId(),
  slug: 'raanana',
  name: 'Raanana Conservatory',
  tenantId: TENANT_A_ID,
  isActive: true,
};

export const tenantB = {
  _id: new ObjectId(),
  slug: 'rishon',
  name: 'Rishon Conservatory',
  tenantId: TENANT_B_ID,
  isActive: true,
};

// Teacher in Tenant A
export const teacherA = {
  _id: new ObjectId(),
  tenantId: TENANT_A_ID,
  personalInfo: { firstName: 'David', lastName: 'Cohen', email: 'david@raanana.edu' },
  credentials: {
    email: 'david@raanana.edu',
    password: bcrypt.hashSync('testpass', 10),
    tokenVersion: 0,
    isInvitationAccepted: true,
  },
  roles: ['מנהל'],
  isActive: true,
};

// Teacher in Tenant B
export const teacherB = {
  _id: new ObjectId(),
  tenantId: TENANT_B_ID,
  personalInfo: { firstName: 'Sarah', lastName: 'Levi', email: 'sarah@rishon.edu' },
  credentials: {
    email: 'sarah@rishon.edu',
    password: bcrypt.hashSync('testpass', 10),
    tokenVersion: 0,
    isInvitationAccepted: true,
  },
  roles: ['מנהל'],
  isActive: true,
};

// Student in Tenant A only
export const studentA = {
  _id: new ObjectId(),
  tenantId: TENANT_A_ID,
  personalInfo: { firstName: 'Yoav', lastName: 'Shapira' },
  academicInfo: { instrumentProgress: [{ instrument: 'פסנתר', currentStage: 1, isPrimary: true }] },
  teacherAssignments: [{ teacherId: teacherA._id.toString(), isActive: true }],
  isActive: true,
};

// Student in Tenant B only
export const studentB = {
  _id: new ObjectId(),
  tenantId: TENANT_B_ID,
  personalInfo: { firstName: 'Noa', lastName: 'Mizrahi' },
  academicInfo: { instrumentProgress: [{ instrument: 'כינור', currentStage: 2, isPrimary: true }] },
  teacherAssignments: [{ teacherId: teacherB._id.toString(), isActive: true }],
  isActive: true,
};

export async function seedTwoTenants(db) {
  await db.collection('tenant').insertMany([tenantA, tenantB]);
  await db.collection('teacher').insertMany([teacherA, teacherB]);
  await db.collection('student').insertMany([studentA, studentB]);
  // ... orchestras, rehearsals, school_year, bagrut, etc.
}
```

### Pattern 2: Supertest with Real Middleware Chain
**What:** Build Express app with the REAL middleware chain (authenticateToken -> buildContext -> enforceTenant -> stripTenantId), no mocks on tenant middleware. Use supertest to make HTTP requests.
**When to use:** All HTTP-level isolation tests (TEST-01, TEST-02, TEST-04).
**Example:**
```javascript
// test/tenant-isolation/read-isolation.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

// CRITICAL: Do NOT use vi.mock on tenant middleware
// The real enforceTenant, buildContext, stripTenantId must run

function makeToken(teacher) {
  return jwt.sign({
    _id: teacher._id.toString(),
    tenantId: teacher.tenantId,
    roles: teacher.roles,
    email: teacher.credentials.email,
    version: 0,
  }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
}

describe('Cross-Tenant Read Isolation', () => {
  it('Tenant A admin listing students sees ZERO Tenant B students', async () => {
    const tokenA = makeToken(teacherA);
    const res = await request(app)
      .get('/api/student')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const students = res.body.data || res.body;
    // Must see only Tenant A students
    students.forEach(s => expect(s.tenantId).toBe(TENANT_A_ID));
    // Must NOT contain any Tenant B student
    expect(students.find(s => s._id === studentB._id.toString())).toBeUndefined();
  });

  it('Tenant A admin fetching Tenant B student by ID gets 404', async () => {
    const tokenA = makeToken(teacherA);
    const res = await request(app)
      .get(`/api/student/${studentB._id.toString()}`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Must be 404, NOT 403 (which would confirm existence)
    expect(res.status).toBe(404);
  });
});
```

### Pattern 3: Concurrent Context Contamination Test
**What:** Fire 100+ parallel HTTP requests with alternating tenant tokens. Verify every response contains ONLY data from the requesting tenant.
**When to use:** Async context contamination testing (success criterion 5).
**Example:**
```javascript
describe('Async Context Contamination', () => {
  it('100+ concurrent requests from mixed tenants never leak data', async () => {
    const tokenA = makeToken(teacherA);
    const tokenB = makeToken(teacherB);
    const requests = [];

    for (let i = 0; i < 120; i++) {
      const isA = i % 2 === 0;
      requests.push(
        request(app)
          .get('/api/student')
          .set('Authorization', `Bearer ${isA ? tokenA : tokenB}`)
          .then(res => ({ tenantExpected: isA ? TENANT_A_ID : TENANT_B_ID, body: res.body }))
      );
    }

    const results = await Promise.all(requests);
    for (const { tenantExpected, body } of results) {
      const students = body.data || body;
      if (Array.isArray(students)) {
        students.forEach(s => expect(s.tenantId).toBe(tenantExpected));
      }
    }
  });
});
```

### Pattern 4: Route Accountability Unit Test
**What:** Run the existing `validateRouteAccountability()` function as a test. Any new route that lacks enforceTenant or allowlist entry fails the test.
**When to use:** CI regression prevention (TEST-03).
**Example:**
```javascript
import { validateRouteAccountability } from '../../utils/validateAllowlist.js';

describe('Route Accountability', () => {
  it('every registered route is either enforced or allowlisted', () => {
    const result = validateRouteAccountability();
    expect(result.valid).toBe(true);
    expect(result.unaccountedRoutes).toEqual([]);
  });
});
```

### Anti-Patterns to Avoid
- **Mocking tenant middleware in isolation tests:** The whole point is to test the REAL middleware. Never `vi.mock('../middleware/tenant.middleware.js')` in isolation tests.
- **Using global test/setup.js:** It mocks out `requireTenantId` and `buildScopedFilter`. Tenant isolation tests MUST use a separate config without `setupFiles: ['./test/setup.js']`.
- **Testing only reads:** TEST-02 requires write rejection tests (POST, PUT, DELETE against wrong tenant).
- **Identical 403 vs 404 responses:** Cross-tenant access should return 404 (not found within your tenant), never 403 (which confirms existence). The Phase 5 error handling work standardized this.
- **Single-collection testing:** Tenant isolation must be verified across ALL tenant-scoped collections (student, teacher, orchestra, rehearsal, theory_lesson, bagrut, school_year, activity_attendance, hours_summary, import_log, ministry_report_snapshots).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory MongoDB | Custom mock DB | mongodb-memory-server 10.4.3 | Already installed, real MongoDB behavior including indexes and aggregations |
| HTTP request testing | Manual fetch/axios | supertest 7.2.2 | Already installed, integrates with Express without server.listen() |
| JWT generation for tests | Hard-coded token strings | `jwt.sign()` with test secrets | Tokens must include tenantId, roles, version -- hard-coded strings break |
| Test DB cleanup | Manual collection drops | `resetTestDatabase()` from test/setup/mongodb-memory-server.js | Already built, handles all collections |
| Route coverage tracking | Manual checklist | `validateRouteAccountability()` from utils/validateAllowlist.js | Already built, catches new unaccounted routes |
| CI pipeline | Custom scripts | GitHub Actions | Standard, free for public/private repos, well-documented mongodb-memory-server support |

**Key insight:** The project already has all the testing infrastructure. The gap is not tools -- it is test cases. No tenant isolation test exists at all. The Phase 6 work is writing tests, not building test infrastructure.

## Common Pitfalls

### Pitfall 1: Global Test Setup Mocking Out Tenant Guards
**What goes wrong:** Tests pass even when tenant isolation is broken because `test/setup.js` mocks `requireTenantId` to always return `'test-tenant-id'` and `buildScopedFilter` to pass through unchanged.
**Why it happens:** The global setup was designed for unit tests that don't care about tenant isolation.
**How to avoid:** Create `vitest.config.tenant-isolation.js` with NO `setupFiles`. Each test file sets up its own Express app with real middleware.
**Warning signs:** All tenant isolation tests pass immediately without any code changes.

### Pitfall 2: Testing Against Mocked Collections Instead of Real MongoDB
**What goes wrong:** Mock collections return whatever you tell them. They can't detect missing `tenantId` in queries because they don't filter -- they return preconfigured responses.
**Why it happens:** The existing integration test pattern (auth, IDOR, enrollment) uses `vi.mock('../../services/mongoDB.service.js')` with custom `findOne`/`find` mocks. These mocks return data regardless of the query filter.
**How to avoid:** For tenant isolation tests, use MongoDB Memory Server with REAL data. Insert documents for both tenants. Make real queries. Verify results contain only correct tenant's data.
**Warning signs:** Tests don't insert actual test data into a real database before querying.

### Pitfall 3: Not Testing All Collections
**What goes wrong:** Testing student and teacher isolation but forgetting rehearsal, theory_lesson, bagrut, orchestra, activity_attendance. A leak in any one collection is a security vulnerability.
**Why it happens:** There are 11 tenant-scoped collections. It's tempting to test just the "important" ones.
**How to avoid:** Systematic test matrix: for each tenant-scoped collection, test read isolation and write rejection.
**Warning signs:** Less than 11 collections covered in read isolation tests.

### Pitfall 4: ESM Import Issues with MongoDB Memory Server
**What goes wrong:** `vi.doMock` does not override ESM static imports. Services imported with `import { getCollection } from '...'` resolve the original module, not the mock.
**Why it happens:** The existing cascade performance tests are SKIPPED for exactly this reason (see `cascade-operations.test.js` line 38).
**How to avoid:** Two approaches: (1) Use dynamic `import()` AFTER `vi.doMock`, or (2) Don't mock `mongoDB.service.js` at all -- instead, connect MongoDB Memory Server and set `process.env.MONGODB_URI` before importing the service, or (3) create a setup file for the tenant-isolation config that connects MMS and exports the db for direct use. The project's `vitest.config.phase2.js` pattern (no setupFiles, tests handle own mocking) is the proven approach.
**Warning signs:** Tests import services at module top level before mocking the DB service.

### Pitfall 5: Concurrent Tests Sharing Global State
**What goes wrong:** `req.context.tenantId` bleeds between concurrent requests if any middleware or service uses module-level state.
**Why it happens:** Express is inherently request-scoped (each request has its own `req` object), but if services cache data in module-level variables (like a memoized tenant config), concurrent requests from different tenants could contaminate each other.
**How to avoid:** The concurrent test pattern (Pattern 3) fires 120 alternating requests and verifies every response. If any response contains wrong-tenant data, it catches the contamination.
**Warning signs:** Tests always run sequentially, never testing concurrent scenarios.

### Pitfall 6: Missing WebSocket Tenant Isolation Tests
**What goes wrong:** WebSocket rooms are tenant-scoped (`admins_{tenantId}`, `integrity_updates_{tenantId}`), but without testing, a bug in room joining could broadcast to wrong tenants.
**Why it happens:** WebSocket testing requires socket.io-client, which adds complexity.
**How to avoid:** At minimum, unit test the room name construction and verify the auth middleware extracts `tenantId` from JWT. Full WebSocket integration testing is deferred unless already achievable.
**Warning signs:** No WebSocket tests at all despite tenant-scoped room design.

### Pitfall 7: CI Timeout with MongoDB Memory Server
**What goes wrong:** MongoDB Memory Server downloads a MongoDB binary on first run. In CI (GitHub Actions), this download can take 30-60 seconds and may timeout.
**Why it happens:** No binary caching configured in CI workflow.
**How to avoid:** Cache the MongoDB binary in `.cache/mongodb-memory-server` using GitHub Actions' `actions/cache`. The project already configures `downloadDir: './node_modules/.cache/mongodb-memory-server/mongodb-binaries'`.
**Warning signs:** CI jobs take 3+ minutes or intermittently fail on the download step.

## Code Examples

### Vitest Config for Tenant Isolation Tests
```javascript
// vitest.config.tenant-isolation.js
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/tenant-isolation/**/*.test.js'],
    // NO setupFiles -- tenant isolation tests must NOT use global mocks
    testTimeout: 30000,
    hookTimeout: 20000,
    teardownTimeout: 10000,
    pool: 'forks',
    maxConcurrency: 3,
    minWorkers: 1,
    maxWorkers: 2,
    env: {
      NODE_ENV: 'test',
      ACCESS_TOKEN_SECRET: 'test-access-secret',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
});
```

### GitHub Actions CI Workflow
```yaml
# .github/workflows/tenant-isolation.yml
name: Tenant Isolation Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  tenant-isolation:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Cache MongoDB Memory Server binary
        uses: actions/cache@v4
        with:
          path: node_modules/.cache/mongodb-memory-server
          key: mms-binary-${{ runner.os }}-6.0.0

      - name: Install dependencies
        run: npm ci

      - name: Run tenant isolation tests
        run: npm run test:tenant-isolation

      - name: Run route accountability check
        run: node utils/validateAllowlist.js
```

### Allowlist Verification Test
```javascript
// test/tenant-isolation/allowlist-verification.test.js
import { describe, it, expect } from 'vitest';
import { CROSS_TENANT_ALLOWLIST } from '../../config/crossTenantAllowlist.js';

describe('Cross-Tenant Allowlist Verification', () => {
  it('allowlist has expected number of entries', () => {
    expect(CROSS_TENANT_ALLOWLIST.length).toBe(7);
  });

  it('every allowlisted route has a reason and category', () => {
    for (const entry of CROSS_TENANT_ALLOWLIST) {
      expect(entry.reason).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.route).toBeTruthy();
    }
  });

  it('auth routes are allowlisted (pre-tenant)', () => {
    const authEntry = CROSS_TENANT_ALLOWLIST.find(e => e.route === '/api/auth/*');
    expect(authEntry).toBeDefined();
    expect(authEntry.requiredRole).toBeNull();
    expect(authEntry.allowCrossTenant).toBe(true);
  });

  it('super-admin routes require super_admin role', () => {
    const saEntry = CROSS_TENANT_ALLOWLIST.find(e => e.route === '/api/super-admin/*');
    expect(saEntry).toBeDefined();
    expect(saEntry.requiredRole).toBe('super_admin');
  });
});
```

### stripTenantId Middleware Test
```javascript
// test/tenant-isolation/middleware/strip-tenant-id.test.js
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { stripTenantId } from '../../../middleware/tenant.middleware.js';

describe('stripTenantId middleware', () => {
  it('returns 400 TENANT_MISMATCH when client tenantId differs from server', async () => {
    const app = express();
    app.use(express.json());
    // Simulate context already set by enforceTenant
    app.use((req, res, next) => {
      req.context = { tenantId: 'server-tenant-id', userId: 'test-user' };
      next();
    });
    app.use(stripTenantId);
    app.post('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .post('/test')
      .send({ tenantId: 'DIFFERENT-tenant-id', name: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TENANT_MISMATCH');
  });

  it('silently strips matching tenantId from body', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.context = { tenantId: 'server-tenant-id' };
      next();
    });
    app.use(stripTenantId);
    app.post('/test', (req, res) => res.json({ body: req.body }));

    const res = await request(app)
      .post('/test')
      .send({ tenantId: 'server-tenant-id', name: 'test' });

    expect(res.status).toBe(200);
    expect(res.body.body.tenantId).toBeUndefined();
    expect(res.body.body.name).toBe('test');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Node.js testing | Vitest (native ESM, faster) | 2023-2024 | Project already uses Vitest 3.x |
| Mock DB for integration tests | MongoDB Memory Server | 2022+ | Real queries catch filter bugs that mocks miss |
| Manual CI scripts | GitHub Actions workflows | Standard | Free, yml-based, excellent mongodb-memory-server support |
| Single test config | Multiple vitest configs | vitest.config.phase2.js pattern | Already established in project -- tenant tests follow same pattern |

**Deprecated/outdated:**
- The cascade performance tests are SKIPPED (`describe.skip`) due to ESM mocking issues. Tenant isolation tests must avoid the same trap.
- `test/setup.js` mocks tenant middleware -- this is fine for unit tests but MUST NOT be used for tenant isolation tests.

## Open Questions

1. **Phase 2 query hardening completion status**
   - What we know: The tenant-enforcement-checklist.md (dated 2026-02-14) shows 50 FAIL, 17 PARTIAL, 1 PASS out of 105 endpoints. The phases 01-05 planning exists. Recent commits show cascade tenant wiring work.
   - What's unclear: How many of the 50 FAIL endpoints have been fixed since 2026-02-14? The tests can only verify what's been implemented.
   - Recommendation: Phase 6 tests should be written to test the EXPECTED behavior (tenantId filtering). Tests that fail because the service hasn't been updated yet are still valuable -- they document what's broken and will catch regressions when fixed.

2. **Which Vitest config pattern for MMS connection**
   - What we know: Two patterns exist: (a) `test/setup.js` with global `vi.doMock` (has ESM issues), (b) `vitest.config.phase2.js` with no setupFiles (each test handles own mocking).
   - What's unclear: Whether a shared setup file for MMS connection (without tenant mocks) would work reliably across test files with `pool: 'forks'`.
   - Recommendation: Use approach (b) -- each test file sets up its own MMS instance or uses a minimal setup file that ONLY initializes MMS and patches `mongoDB.service.js` via dynamic import. Follow the `vitest.config.phase2.js` precedent.

3. **WebSocket tenant isolation testing depth**
   - What we know: WebSocket rooms are tenant-scoped (`admins_{tenantId}`), `socket.tenantId` is extracted from JWT in auth middleware.
   - What's unclear: Whether full socket.io-client integration testing is worth the complexity for Phase 6 scope.
   - Recommendation: Write unit tests for room name construction and JWT-based tenantId extraction. Defer full WebSocket integration tests unless time permits. The HTTP API is the primary attack surface.

4. **Human verification checklist format**
   - What we know: Success criterion 6 requires a "human-walkable verification checklist executed and documented."
   - What's unclear: What exactly should this checklist cover beyond automated tests.
   - Recommendation: Create a `verification/checklist.md` covering manual spot-checks: (a) log in as Tenant A, verify sidebar shows only Tenant A data; (b) check MongoDB indexes include tenantId; (c) review `CROSS_TENANT_ALLOWLIST` entries; (d) verify error messages don't leak cross-tenant info.

## Test Matrix

### Collections Requiring Read Isolation Tests (TEST-01)

| Collection | Read Endpoints | Expected Result for Wrong Tenant |
|------------|---------------|----------------------------------|
| student | GET /api/student, GET /api/student/:id | Empty list / 404 |
| teacher | GET /api/teacher, GET /api/teacher/:id | Empty list / 404 |
| orchestra | GET /api/orchestra, GET /api/orchestra/:id | Empty list / 404 |
| rehearsal | GET /api/rehearsal, GET /api/rehearsal/:id | Empty list / 404 |
| theory_lesson | GET /api/theory, GET /api/theory/:id | Empty list / 404 |
| bagrut | GET /api/bagrut, GET /api/bagrut/:id | Empty list / 404 |
| school_year | GET /api/school-year, GET /api/school-year/:id | Empty list / 404 |
| hours_summary | GET /api/hours-summary | Empty list |
| activity_attendance | via /api/attendance/* endpoints | Empty results |

### Collections Requiring Write Isolation Tests (TEST-02)

| Collection | Write Endpoints | Expected Result for Wrong Tenant |
|------------|----------------|----------------------------------|
| student | POST /api/student, PUT /api/student/:id, DELETE /api/student/:id | 404 (can't find resource in own tenant) |
| teacher | POST /api/teacher, PUT /api/teacher/:id | 404 / ignored |
| orchestra | POST /api/orchestra, PUT /api/orchestra/:id | 404 |
| rehearsal | POST /api/rehearsal, PUT /api/rehearsal/:id | 404 |
| theory_lesson | POST /api/theory, PUT /api/theory/:id | 404 |
| bagrut | POST /api/bagrut, PUT /api/bagrut/:id | 404 |
| school_year | POST /api/school-year, PUT /api/school-year/:id/set-current | 404 |

### Allowlisted Routes (TEST-04)

| Route Pattern | Category | Test Assertion |
|---------------|----------|----------------|
| /api/auth/* | AUTH | Login works without tenant context; multi-tenant selection works |
| /api/super-admin/* | SUPER_ADMIN | Can list/manage all tenants; requires super_admin JWT |
| /api/tenant/* | TENANT_MGMT | Admin can read own tenant; cannot modify other tenants |
| /api/health/* | SYSTEM | Returns 200 without auth |
| /api/config | SYSTEM | Returns config without auth |

## NPM Scripts to Add

```json
{
  "test:tenant-isolation": "vitest run --config vitest.config.tenant-isolation.js",
  "test:tenant-isolation:watch": "vitest --config vitest.config.tenant-isolation.js",
  "test:ci": "npm run test:unit && npm run test:tenant-isolation && node utils/validateAllowlist.js"
}
```

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `server.js` -- complete middleware chain for all 20+ route groups
- Codebase analysis: `middleware/tenant.middleware.js` -- enforceTenant, buildContext, stripTenantId implementation
- Codebase analysis: `config/crossTenantAllowlist.js` -- 7 allowlist entries with categories
- Codebase analysis: `utils/validateAllowlist.js` -- route accountability validation utility
- Codebase analysis: `utils/queryScoping.js` -- buildScopedFilter, canAccessStudent, NotFoundError
- Codebase analysis: `test/setup.js` -- global mocks that bypass tenant guards
- Codebase analysis: `vitest.config.phase2.js` -- precedent for test config without global mocks
- Codebase analysis: `docs/tenant-enforcement-checklist.md` -- 105 endpoints, 50 FAIL, 17 PARTIAL
- Codebase analysis: `docs/query-inventory.md` -- 288 query locations across 14 collections
- Codebase analysis: `test/integration/idor-prevention.integration.test.js` -- existing supertest pattern

### Secondary (MEDIUM confidence)
- [Vitest Test API Reference](https://vitest.dev/api/) -- concurrent test context requirements
- [mongodb-memory-server GitHub Actions setup discussion](https://github.com/nodkz/mongodb-memory-server/discussions/566) -- CI caching
- [Supertest npm docs](https://www.npmjs.com/package/supertest) -- API reference
- [AWS SaaS Lens - Multi-tenant testing](https://wa.aws.amazon.com/saas.question.REL_3.en.html) -- isolation test strategies
- [TestGrid - Multi-Tenancy Testing](https://testgrid.io/blog/multi-tenancy/) -- testing methodology

### Tertiary (LOW confidence)
- [Steve Kinney - GitHub Actions Vitest setup](https://stevekinney.com/courses/testing/continuous-integration) -- CI workflow structure (tutorial-level)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already installed, versions verified from package.json and node_modules
- Architecture: HIGH -- test patterns derived from existing codebase patterns (vitest.config.phase2.js, idor-prevention test, auth integration test)
- Pitfalls: HIGH -- derived from actual bugs found in codebase (skipped cascade tests, ESM mock issues, global setup mocking tenant guards)
- CI/CD: MEDIUM -- GitHub Actions with mongodb-memory-server is well-documented but this project has zero CI history, so workflow may need iteration

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- testing tools are stable)
