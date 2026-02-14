# Phase 2: Service Layer Query Hardening - Research

**Researched:** 2026-02-15
**Domain:** Multi-tenant query isolation in a Node.js/Express/MongoDB application
**Confidence:** HIGH

## Summary

Phase 2 transforms Tenuto.io's multi-tenant isolation from "opt-in via filterBy" to "default-deny via context." The codebase already has all the infrastructure (req.context with tenantId, buildScopedFilter utility, requireTenantId guard, enforceTenant middleware) but only 1 of 22 API services uses the canonical pattern. The Phase 1 audit identified 50 FAIL and 17 PARTIAL endpoints requiring hardening across a well-structured module system.

The core transformation is mechanical: (1) wire enforceTenant middleware to all data-access routes in server.js, (2) add `options = {}` parameter with context to every service method, (3) replace conditional `if (filterBy.tenantId)` in all six `_buildCriteria` functions with mandatory `buildScopedFilter`, (4) add `requireTenantId` + tenantId to every getById and write query, and (5) scope aggregation `$match` stages and `$lookup` pipelines with tenantId. The risk is in the volume (22 services, 67 FAIL/PARTIAL endpoints, 288 query locations) and in cascading internal calls (getById functions called internally by write functions, service-to-service imports).

**Primary recommendation:** Work in waves matching the Phase 1 fix order (P0 reads, P1 writes, P2 partial, shared services), converting one complete service at a time (service + controller + all internal callers) rather than doing all reads first then all writes. This prevents half-hardened states where a service's getById is hardened but its internal calls from updateX still use the old signature.

## Standard Stack

### Core (Already in Codebase)

| Library/Utility | Location | Purpose | Status |
|----------------|----------|---------|--------|
| `buildScopedFilter` | `utils/queryScoping.js` | Build MongoDB filter with tenantId + role scoping | EXISTS, used by 1/22 services |
| `requireTenantId` | `middleware/tenant.middleware.js` | Fail-fast guard, throws if tenantId missing | EXISTS, used by 0 services |
| `enforceTenant` | `middleware/tenant.middleware.js` | Route-level middleware, 403 if no tenantId | EXISTS, applied to 0 routes |
| `buildContext` | `middleware/tenant.middleware.js` | Builds req.context from JWT teacher doc | EXISTS, applied to all auth routes |
| `canAccessStudent` | `utils/queryScoping.js` | IDOR check via pre-loaded scopes | EXISTS, used by student controller |
| `canAccessOwnResource` | `utils/queryScoping.js` | Resource ownership check | EXISTS |

### Supporting (No New Dependencies)

No new libraries are needed. This phase is entirely refactoring existing code to use existing utilities consistently. The MongoDB native driver, Express middleware chain, and utility functions are all in place.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-service requireTenantId calls | Mongoose middleware plugin | Project deliberately uses native MongoDB driver; adding Mongoose would be a massive rewrite |
| Manual buildScopedFilter in every query | MongoDB query rewriting proxy | Over-engineered for 22 services; adds opaque abstraction layer |
| enforceTenant on each route group | Global middleware with allowlist | Could work but risks allowlist mistakes; current explicit opt-in per route group is clearer |

**Installation:** None required.

## Architecture Patterns

### Existing Module Structure (Unchanged)

```
api/
  [module]/
    [module].route.js        # Express route definitions
    [module].controller.js   # HTTP request/response handling
    [module].service.js      # Business logic, MongoDB queries
    [module].validation.js   # Joi/Zod schemas
middleware/
  tenant.middleware.js       # buildContext, enforceTenant, requireTenantId
  auth.middleware.js         # authenticateToken (JWT)
  school-year.middleware.js  # addSchoolYearToRequest
utils/
  queryScoping.js            # buildScopedFilter, canAccessStudent, canAccessOwnResource
services/
  *.js                       # Shared services (cascade, duplicate detection, etc.)
```

### Pattern 1: Canonical Service Method Signature

**What:** Every service method accepts an `options` parameter with `context` from req.context.
**When to use:** ALL service methods that touch MongoDB.
**Example:**

```javascript
// Source: api/student/student.service.js (the ONE correct example)
async function getStudents(filterBy = {}, page = 1, limit = 0, options = {}) {
  const { context } = options;
  const collection = await getCollection('student');
  const criteria = _buildCriteria(filterBy);

  if (context) {
    Object.assign(criteria, buildScopedFilter('student', {}, context));
  }

  const students = await collection.find(criteria).toArray();
  return students;
}
```

**Phase 2 hardened version (what it should become):**

```javascript
async function getStudents(filterBy = {}, page = 1, limit = 0, options = {}) {
  const { context } = options;
  const tenantId = requireTenantId(context?.tenantId);

  const collection = await getCollection('student');
  const criteria = buildScopedFilter('student', _buildCriteria(filterBy), context);

  const students = await collection.find(criteria).toArray();
  return students;
}
```

### Pattern 2: Hardened getById

**What:** Every getById includes tenantId in the filter alongside _id.
**When to use:** ALL findOne-by-ID queries.
**Example:**

```javascript
// BEFORE (current IDOR vulnerability in every service):
async function getTeacherById(teacherId, options = {}) {
  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
  });
}

// AFTER:
async function getTeacherById(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
    tenantId,
  });
}
```

### Pattern 3: Hardened Write Operation

**What:** Insert/update/delete operations derive tenantId from context, never from request body.
**When to use:** ALL write operations.
**Example:**

```javascript
// BEFORE:
async function addOrchestra(orchestraToAdd) {
  const { error, value } = validateOrchestra(orchestraToAdd);
  const collection = await getCollection('orchestra');
  const result = await collection.insertOne(value);
}

// AFTER:
async function addOrchestra(orchestraToAdd, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const { error, value } = validateOrchestra(orchestraToAdd);
  value.tenantId = tenantId;  // Server-derived, never from client
  const collection = await getCollection('orchestra');
  const result = await collection.insertOne(value);
}
```

### Pattern 4: Hardened _buildCriteria

**What:** Remove conditional tenantId from _buildCriteria; callers must use buildScopedFilter separately.
**When to use:** All six services with _buildCriteria functions.
**Example:**

```javascript
// BEFORE (in 6 services):
function _buildCriteria(filterBy) {
  const criteria = {};
  if (filterBy.tenantId) {          // OPT-IN -- dangerous
    criteria.tenantId = filterBy.tenantId;
  }
  // ... other filters
  return criteria;
}

// AFTER:
function _buildCriteria(filterBy) {
  const criteria = {};
  // tenantId handled by buildScopedFilter at call site -- NOT here
  // ... other filters (name, instrument, role, etc.)
  return criteria;
}
```

### Pattern 5: Hardened Aggregation Pipeline

**What:** Aggregation pipelines include tenantId in the first $match and in every $lookup pipeline.
**When to use:** All aggregation pipelines (orchestra.service.js has the most complex ones).
**Example:**

```javascript
// BEFORE:
const pipeline = [
  { $match: { _id: ObjectId.createFromHexString(orchestraId) } },
  { $lookup: { from: 'student', localField: 'memberIds', foreignField: '_id', as: 'members' } },
];

// AFTER:
const tenantId = requireTenantId(options.context?.tenantId);
const pipeline = [
  { $match: { _id: ObjectId.createFromHexString(orchestraId), tenantId } },
  { $lookup: {
      from: 'student',
      let: { memberIds: '$memberIds', tid: '$tenantId' },
      pipeline: [
        { $match: { $expr: { $and: [
          { $in: ['$_id', { $map: { input: '$$memberIds', as: 'm', in: { $toObjectId: '$$m' } } }] },
          { $eq: ['$tenantId', '$$tid'] }
        ] } } },
      ],
      as: 'members',
  } },
];
```

### Pattern 6: Controller Context Passing

**What:** Controllers pass `{ context: req.context }` in options, never `tenantId` as a separate value.
**When to use:** ALL controller-to-service calls.
**Example:**

```javascript
// BEFORE (teacher.controller.js):
async function getTeachers(req, res, next) {
  const filterBy = {
    tenantId: req.context?.tenantId || null,  // Anti-pattern E
    name: req.query.name,
  };
  const result = await teacherService.getTeachers(filterBy, page, limit);
}

// AFTER:
async function getTeachers(req, res, next) {
  const filterBy = { name: req.query.name };
  const result = await teacherService.getTeachers(filterBy, page, limit, { context: req.context });
}
```

### Anti-Patterns to Avoid

- **Half-hardened service:** Hardening getById but not updating internal callers (e.g., updateStudent calls getStudentById internally without context -- will break).
- **Adding context without requireTenantId:** Using `if (context?.tenantId)` instead of `requireTenantId(context?.tenantId)` -- preserves opt-in pattern.
- **Stripping tenantId from _buildCriteria before controller is updated:** Will break PARTIAL endpoints that currently work via filterBy.tenantId.
- **Forgetting the student.service.js batch-IDs path:** _buildCriteria has an early return for `filterBy.ids` that currently returns before tenantId is applied. Must ensure tenantId is applied even for batch ID lookups.
- **Changing positional parameters on exported functions:** Services export named functions used by controllers and by other services (e.g., bagrutService.getBagrutById called from student.service.js). Changing parameter positions will break callers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant filter injection | Custom MongoDB proxy/wrapper | `buildScopedFilter` + `requireTenantId` | Already exists, tested, handles role scoping |
| Tenant enforcement at route level | Per-controller tenantId checks | `enforceTenant` middleware in server.js | Already exists, handles null tenantId case, returns proper 403 |
| Student IDOR checks | Per-query student.teacherAssignments lookups | `canAccessStudent(id, context)` | Already exists, uses pre-loaded scopes (zero DB round-trips) |

**Key insight:** Every necessary utility already exists in the codebase. Phase 2 is purely about **wiring** -- making all services use what's already built.

## Common Pitfalls

### Pitfall 1: Internal Service-to-Service Call Chain Breakage

**What goes wrong:** Service A's getById is hardened to require context. Service B calls A's getById internally without context. Service B breaks at runtime.
**Why it happens:** Many services call getById functions internally (student.service.js calls getStudentById 3 times internally; orchestra.service.js calls getOrchestraById 8 times internally; theory.service.js calls getTheoryLessonById 3 times internally). These internal calls currently don't pass context.
**How to avoid:** When hardening a service, search for ALL callers of every function being changed -- both from controllers AND from other services and internal functions. Thread context through the entire call chain.
**Warning signs:** `Error: TENANT_GUARD: tenantId is required` appearing in functions that don't directly receive HTTP requests.

**Known internal call chains that need context threading:**
- `student.service.js`: addStudent -> getCurrentSchoolYear (needs tenantId); updateStudent -> getStudentById (needs context); getStudentBagrut -> getBagrutById (needs context)
- `orchestra.service.js`: addOrchestra -> getCurrentSchoolYear (needs tenantId); updateOrchestra -> getOrchestraById (needs context); addMember/removeMember -> getOrchestraById (needs context); 8 internal getOrchestraById calls total
- `theory.service.js`: addTheoryLesson -> getCurrentSchoolYear (needs tenantId); 3 internal getTheoryLessonById calls
- `rehearsal.service.js`: updateAttendance -> getRehearsalById (needs context)
- `bagrut.service.js`: addBagrut -> studentService.setBagrutId; removeBagrut -> studentService.removeBagrutId (cross-service calls)

### Pitfall 2: Backward Compatibility During Transition

**What goes wrong:** Making context mandatory immediately breaks callers that haven't been updated yet.
**Why it happens:** Services are used by controllers, by other services, and potentially by scripts. A Big Bang change where requireTenantId is added to every function simultaneously would require updating ALL callers in a single commit.
**How to avoid:** Harden service-by-service. When hardening a service, update ALL its callers (controller + other services that import it) in the same commit. The "whole service at a time" approach prevents half-hardened states.
**Warning signs:** Callers found via grep that weren't updated in the same commit.

### Pitfall 3: The _buildCriteria Early Return Path

**What goes wrong:** Several _buildCriteria functions (student.service.js, orchestra.service.js) have an early return for batch ID lookups (`if (filterBy.ids) { ... return criteria }`) that bypasses the tenantId line entirely.
**Why it happens:** The early return was added before multi-tenancy. When ids are provided, the function returns immediately without checking tenantId.
**How to avoid:** After removing the conditional `if (filterBy.tenantId)` from _buildCriteria, move tenant scoping to the call site using buildScopedFilter. The early return in _buildCriteria becomes safe because tenantId is applied at the call site, not inside _buildCriteria. Verify this explicitly for batch ID paths.
**Warning signs:** A batch ID query returning results from another tenant.

### Pitfall 4: Aggregation $lookup Without Tenant Scope

**What goes wrong:** Adding tenantId to the primary $match but not to $lookup sub-pipelines. The primary query is tenant-scoped but the join fetches data from all tenants.
**Why it happens:** Simple $lookup (localField/foreignField) has no way to add filters. Must convert to pipeline form. orchestra.service.js has 4 aggregation pipelines with $lookup.
**How to avoid:** Convert every $lookup from simple form to pipeline form with tenantId filter. Use `let: { tid: '$tenantId' }` and `$eq: ['$tenantId', '$$tid']` in the $match expression.
**Warning signs:** $lookup in aggregation pipeline using `localField`/`foreignField` instead of `pipeline` form.

### Pitfall 5: enforceTenant Breaking the School Year Middleware

**What goes wrong:** `addSchoolYearToRequest` middleware runs AFTER buildContext but queries school_year collection. If enforceTenant is placed before addSchoolYearToRequest, it will block requests from teachers without tenantId before the school year can be loaded.
**Why it happens:** The middleware chain is `authenticateToken -> buildContext -> addSchoolYearToRequest -> routes`. enforceTenant must go between buildContext and addSchoolYearToRequest (or be added as part of the same chain slot).
**How to avoid:** Place enforceTenant after buildContext but before addSchoolYearToRequest. The addSchoolYearToRequest middleware already handles tenantId conditionally (line 31-33 of school-year.middleware.js uses `req.teacher?.tenantId`), so it works whether enforceTenant is before or after it. But enforceTenant rejecting first is cleaner.
**Warning signs:** 403 errors on routes that should work for authenticated teachers.

### Pitfall 6: Two Distinct Cascade Deletion Systems

**What goes wrong:** The codebase has TWO separate cascade deletion systems: `services/cascadeDeletion.service.js` (transaction-based, ~28 queries) and `services/cascadeDeletionService.js` (collection-based, ~38 queries). Both are EXEMPT from Phase 2 (admin-only, entity-ID-based). But if Phase 2 inadvertently changes shared getById functions they call, it could break them.
**How to avoid:** Cascade deletion services are EXEMPT per the enforcement checklist. When hardening getById functions, ensure that cascade services (which are admin-only and may not have req.context) continue to work. One approach: cascade services can pass a special admin context or be updated in Phase 5 (Error Handling & Cascade Safety).
**Warning signs:** Cascade deletion operations failing after Phase 2 changes.

### Pitfall 7: buildScopedFilter Silently Skips Null tenantId

**What goes wrong:** The current buildScopedFilter (line 16 of queryScoping.js) uses `if (context.tenantId)` -- meaning null/undefined tenantId is silently ignored. If requireTenantId is not called before buildScopedFilter, a missing tenantId produces no error.
**How to avoid:** Always call `requireTenantId(context?.tenantId)` BEFORE buildScopedFilter. The requireTenantId throws; buildScopedFilter does not. Consider also hardening buildScopedFilter itself to throw on null tenantId.
**Warning signs:** Queries executing successfully without tenantId filter despite using buildScopedFilter.

## Code Examples

### Example 1: Complete Service Hardening (Teacher Service)

```javascript
// teacher.service.js - BEFORE:
import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

async function getTeachers(filterBy = {}, page = 1, limit = 0) {
  const collection = await getCollection('teacher');
  const criteria = _buildCriteria(filterBy);  // tenantId opt-in
  return await collection.find(criteria).toArray();
}

async function getTeacherById(teacherId, options = {}) {
  const collection = await getCollection('teacher');
  const filter = { _id: ObjectId.createFromHexString(teacherId) };
  if (options.tenantId) filter.tenantId = options.tenantId;  // optional
  return await collection.findOne(filter);
}

function _buildCriteria(filterBy) {
  const criteria = {};
  if (filterBy.tenantId) { criteria.tenantId = filterBy.tenantId; }  // opt-in
  // ... other filters
  return criteria;
}

// teacher.service.js - AFTER:
import { buildScopedFilter } from '../../utils/queryScoping.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';

async function getTeachers(filterBy = {}, page = 1, limit = 0, options = {}) {
  const { context } = options;
  requireTenantId(context?.tenantId);
  const collection = await getCollection('teacher');
  const criteria = buildScopedFilter('teacher', _buildCriteria(filterBy), context);
  return await collection.find(criteria).toArray();
}

async function getTeacherById(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const collection = await getCollection('teacher');
  return await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
    tenantId,
  });
}

function _buildCriteria(filterBy) {
  const criteria = {};
  // NO tenantId here -- handled by buildScopedFilter at call site
  // ... other filters remain unchanged
  return criteria;
}
```

### Example 2: Controller Update

```javascript
// teacher.controller.js - BEFORE:
async function getTeachers(req, res, next) {
  const filterBy = {
    tenantId: req.context?.tenantId || null,  // Anti-pattern: tenantId in filterBy
    name: req.query.name,
  };
  const result = await teacherService.getTeachers(filterBy, page, limit);
  res.json(result);
}

// teacher.controller.js - AFTER:
async function getTeachers(req, res, next) {
  const filterBy = { name: req.query.name };
  const result = await teacherService.getTeachers(filterBy, page, limit, { context: req.context });
  res.json(result);
}
```

### Example 3: enforceTenant in server.js

```javascript
// server.js - BEFORE:
app.use('/api/student', authenticateToken, buildContext, addSchoolYearToRequest, studentRoutes);

// server.js - AFTER:
app.use('/api/student', authenticateToken, buildContext, enforceTenant, addSchoolYearToRequest, studentRoutes);
```

### Example 4: Hardening buildScopedFilter Itself

```javascript
// utils/queryScoping.js - BEFORE:
export function buildScopedFilter(collection, baseFilter, context) {
  const filter = { ...baseFilter };
  if (context.tenantId) {         // Silently skips null
    filter.tenantId = context.tenantId;
  }
  // ...
}

// utils/queryScoping.js - AFTER:
export function buildScopedFilter(collection, baseFilter, context) {
  if (!context?.tenantId) {
    throw new Error('TENANT_GUARD: buildScopedFilter requires context.tenantId');
  }
  const filter = { ...baseFilter, tenantId: context.tenantId };
  // ...
}
```

## Codebase-Specific Findings

### Service Inventory (Confidence: HIGH)

**22 API services** across 13 modules, plus **11 shared services**:

| Service File | Exported Functions | _buildCriteria? | Aggregations? | Internal getById calls | Priority |
|-------------|-------------------|-----------------|---------------|----------------------|----------|
| student.service.js | 12 | YES | 0 | 3 internal | P0/P1 |
| teacher.service.js | 14 | YES | 0 | 0 (but sub-doc queries) | P0/P1 |
| teacher-lessons.service.js | 6 | NO | 1 large pipeline | 0 | P0 |
| orchestra.service.js | 10 | YES | 2 (with $lookup) | 8 internal | P0/P1 |
| rehearsal.service.js | 11 | YES | 0 | 2 internal | P0/P1 |
| theory.service.js | ~16 | YES | 0 | 3 internal | P0/P1 |
| bagrut.service.js | ~20 | YES | 0 | 0 (cross-service calls) | P0/P1 |
| school-year.service.js | 7 | NO | 0 | 1 internal | P0/P1 |
| time-block.service.js | 10 | NO | 0 | 0 (sub-doc of teacher) | P0/P1 |
| attendance.service.js (schedule) | 3 | NO | 0 | 0 | P0 |
| attendance.service.js (analytics) | 7 | NO | 3+ | 0 | P0 |
| hours-summary.service.js | 4 | NO | 0 | 0 | P2 |
| import.service.js | 3 | NO | 0 | 0 | P2 |
| export.service.js | 3 | NO | 0 | 0 | P2 |
| invitation.service.js | ~3 | NO | 0 | 0 | EXEMPT |

**3 shared services** needing hardening:

| Service | Queries | Risk | Called By |
|---------|---------|------|-----------|
| duplicateDetectionService.js | ~8 | CRITICAL | teacher.service.js (addTeacher) |
| conflictDetectionService.js | ~2 | CRITICAL | theory.service.js (addTheoryLesson) |
| permissionService.js | ~6 | HIGH | multiple controllers |

### Endpoint Statistics (Confidence: HIGH)

From the Phase 1 enforcement checklist:
- **50 FAIL** endpoints (no tenant isolation)
- **17 PARTIAL** endpoints (fragile opt-in via filterBy)
- **1 PASS** endpoint (student.getStudents)
- **31 EXEMPT** endpoints (auth, super-admin, admin tools)
- **6 N/A** endpoints (health, files)
- **Total:** 105 endpoints

### Query Operation Types (Confidence: HIGH)

From the Phase 1 query inventory (288 total):
- **43 CRITICAL** (no tenantId at all)
- **98 HIGH** (conditional tenantId in _buildCriteria)
- **56 MEDIUM** (ad-hoc tenantId handling)
- **8 LOW** (uses buildScopedFilter)
- **83 EXEMPT** (auth/admin/cascade -- intentionally cross-tenant)

### Middleware Chain in server.js (Confidence: HIGH)

All 15 data-access route groups currently use: `authenticateToken, buildContext, [addSchoolYearToRequest,] routes`

Routes that need enforceTenant added (13 route groups):
1. `/api/student` -- has addSchoolYearToRequest
2. `/api/teacher` -- has addSchoolYearToRequest
3. `/api/teachers` (plural alias)
4. `/api/orchestra` -- has addSchoolYearToRequest
5. `/api/rehearsal` -- has addSchoolYearToRequest
6. `/api/theory` -- has addSchoolYearToRequest
7. `/api/bagrut` -- has addSchoolYearToRequest
8. `/api/school-year` -- has addSchoolYearToRequest
9. `/api/schedule` -- has addSchoolYearToRequest
10. `/api/attendance` -- has addSchoolYearToRequest
11. `/api/analytics` -- has addSchoolYearToRequest
12. `/api/hours-summary` -- has addSchoolYearToRequest
13. `/api/import`
14. `/api/export` -- has addSchoolYearToRequest
15. `/api` (time-block routes) -- has addSchoolYearToRequest

Routes that should NOT get enforceTenant:
- `/api/auth` -- public, no tenant context before login
- `/api/super-admin` -- cross-tenant by design
- `/api/tenant` -- manages tenant records themselves
- `/api/health` -- system-level
- `/api/files` -- static file serving (review: may need tenantId for file scoping)
- `/api/admin/*` (5 route groups) -- EXEMPT admin tools

### Key Signature Changes Required (Confidence: HIGH)

**Functions that currently accept NO options/context parameter and need it added:**

1. `getTeachers(filterBy, page, limit)` -> add `options = {}`
2. `getTeacherIds()` -> add `options = {}`
3. `addTeacher(teacherData)` -> add `options = {}`
4. `updateTeacher(id, data)` -> add `options = {}`
5. `removeTeacher(id)` -> add `options = {}`
6. `getOrchestraById(id)` -> add `options = {}`
7. `getOrchestras(filterBy)` -> add `options = {}`
8. `addOrchestra(data)` -> add `options = {}`
9. `getRehearsalById(id)` -> add `options = {}`
10. `getRehearsals(filterBy)` -> add `options = {}`
11. `addRehearsal(data, teacherId, isAdmin)` -> add `options = {}`
12. `getTheoryLessonById(id)` -> add `options = {}`
13. `getTheoryLessons(filterBy)` -> add `options = {}`
14. `addTheoryLesson(data)` -> add `options = {}`
15. `getBagrutById(id)` -> add `options = {}`
16. `getBagruts(filterBy)` -> add `options = {}`
17. `addBagrut(data)` -> add `options = {}`
18. `getSchoolYears(tenantId)` -> change to `options = {}`
19. `getCurrentSchoolYear(tenantId)` -> change to `options = {}`
20. `getSchoolYearById(id)` -> add `options = {}`
21. All time-block functions (4+)
22. All attendance functions (3+)
23. All analytics functions (7)
24. Hours-summary functions (4)

Plus all the sub-operations (updatePresentation, removeMember, etc.) -- roughly 100+ function signatures total.

### buildContext Middleware Enhancement Needed (Confidence: HIGH)

The buildContext query for student access list (line 38-43 of tenant.middleware.js) currently queries WITHOUT tenantId:

```javascript
const students = await studentCollection
  .find(
    { 'teacherAssignments.teacherId': teacherId, 'teacherAssignments.isActive': true },
    { projection: { _id: 1 } }
  )
  .toArray();
```

This should include `tenantId: teacher.tenantId` in the filter to prevent loading cross-tenant student IDs into the access scope.

### addSchoolYearToRequest Enhancement Needed (Confidence: HIGH)

Line 15-16 of school-year.middleware.js queries school_year by `_id` alone when schoolYearId is provided in query params -- no tenantId check. This is an IDOR path: a user could pass another tenant's school year ID.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| filterBy.tenantId opt-in | buildScopedFilter + requireTenantId | Infrastructure built Phase 1 (2026-02-14) | Only 1 service adopted. Phase 2 universalizes. |
| Teacher/student relationship via teacherIds[] | teacherAssignments as single source of truth | Phase 5A (previous milestone) | Simplifies tenant scoping -- only one array to check |
| fullName single field | firstName + lastName split | Phase 4B (previous milestone) | No impact on tenant scoping |

## Open Questions

1. **EXEMPT Admin Services During Transition**
   - What we know: 31 EXEMPT endpoints (admin, cascade, auth, super-admin) intentionally need cross-tenant access
   - What's unclear: When hardening getById functions, should EXEMPT services receive a special "admin context" object or bypass requireTenantId?
   - Recommendation: Add a `{ context: { tenantId: null, isSystemCall: true } }` pattern for internal/admin calls, with requireTenantId accepting system calls. Alternatively, EXEMPT services can continue calling getById directly from the collection (bypass service layer). Defer to Phase 5 (cascade safety).

2. **time-block.service.js vs teacher.service.js Overlap**
   - What we know: Both services manage teacher time blocks. teacher.service.js has createTimeBlock/updateTimeBlock/deleteTimeBlock AND time-block.service.js has the same. Teacher's time blocks are sub-documents of the teacher collection.
   - What's unclear: Which service is authoritative? Are both called from controllers?
   - Recommendation: Both need hardening, but since time blocks are teacher sub-documents, tenant scoping is achieved by scoping the parent teacher findOne by tenantId. No need for a separate tenantId on time block sub-documents.

3. **Batch ID Lookups Across Tenants**
   - What we know: student.service.js and orchestra.service.js support `filterBy.ids` for batch fetching by specific IDs. Currently no tenantId check on these paths.
   - What's unclear: Can a legitimate request include IDs from multiple tenants? (No -- single tenant context per request.)
   - Recommendation: Apply tenantId to batch lookups. After buildScopedFilter is applied at call site, the criteria will include `tenantId` alongside `_id: { $in: [...] }`. Only IDs matching the caller's tenant will be returned.

4. **Should buildScopedFilter Be Hardened to Throw on Null tenantId?**
   - What we know: Currently buildScopedFilter silently skips null tenantId. requireTenantId is the intended guard.
   - What's unclear: Are there legitimate cases where buildScopedFilter should receive null tenantId (e.g., admin browsing across tenants)?
   - Recommendation: Yes, harden buildScopedFilter to throw. Admin/cross-tenant operations should use direct collection queries, not buildScopedFilter. This eliminates the silent-skip bug class entirely.

## Implementation Order Recommendation

Based on the Phase 1 fix order and dependency analysis:

### Sub-Phase A: Infrastructure Hardening (1 plan)
- Harden buildScopedFilter to throw on null tenantId
- Add enforceTenant middleware to all data-access routes in server.js
- Fix buildContext student query to include tenantId
- Fix addSchoolYearToRequest school_year queries to include tenantId

### Sub-Phase B: Core Entity Services - P0 Reads (1 plan)
- teacher.service.js + teacher.controller.js (getById, getTeachers, getTeacherIds, getTeacherByRole)
- student.service.js + student.controller.js (getStudentById, attendance stats)
- school-year.service.js + controller (getSchoolYears, getCurrentSchoolYear, getSchoolYearById)
- teacher-lessons.service.js + controller (all GET endpoints -- aggregation pipeline)

### Sub-Phase C: Supporting Entity Services - P0 Reads (1 plan)
- orchestra.service.js + controller (getOrchestraById, getOrchestras -- aggregation + $lookup)
- rehearsal.service.js + controller (getRehearsalById, getRehearsals)
- theory.service.js + controller (getTheoryLessonById, getTheoryLessons, stats)
- bagrut.service.js + controller (getBagrutById, getBagruts, getBagrutByStudentId)

### Sub-Phase D: Schedule, Analytics, and Attendance Services - P0 Reads (1 plan)
- time-block.service.js + controller (getTeacherTimeBlocks, availableSlots, utilization)
- attendance.service.js (schedule) + controller (all 3 endpoints)
- attendance.service.js (analytics) + controller (all 7 endpoints)

### Sub-Phase E: Write Operations - P1 (1 plan)
- All add/update/remove across student, teacher, orchestra, rehearsal, theory, bagrut, school-year
- All bulk operations (theory bulk create/delete, rehearsal bulk create/delete)
- Time-block create/update/delete and lesson assignment operations

### Sub-Phase F: PARTIAL Endpoints + Import/Export + Hours Summary - P2 (1 plan)
- hours-summary.service.js (calculateTeacherHours, calculateAllTeacherHours, getHoursSummary)
- import.service.js (previewTeacherImport, previewStudentImport, executeImport)
- export.service.js (generateFullReport, getCompletionStatus, crossValidate)

### Sub-Phase G: Shared Services (1 plan)
- duplicateDetectionService.js (scope duplicate checks within tenant)
- conflictDetectionService.js (scope conflict checks within tenant)
- permissionService.js (add tenantId to student queries)

**Total: 7 sub-phases, each producing one plan file.**

## Sources

### Primary (HIGH confidence)
- **Phase 1 artifacts (codebase):**
  - `docs/query-inventory.md` -- 288 query locations, risk categorization
  - `docs/multi-tenant-architecture.md` -- canonical patterns, anti-patterns, migration checklist
  - `docs/tenant-enforcement-checklist.md` -- 105 endpoints with pass/fail status
  - `scripts/create-tenant-indexes.js` -- 16 compound indexes
- **Source code (codebase):**
  - `utils/queryScoping.js` -- buildScopedFilter, canAccessStudent, canAccessOwnResource
  - `middleware/tenant.middleware.js` -- requireTenantId, buildContext, enforceTenant
  - `middleware/school-year.middleware.js` -- addSchoolYearToRequest
  - `server.js` -- route registration and middleware chain
  - All 22 service files and 13 controller files examined

### Secondary (MEDIUM confidence)
- **MongoDB native driver multi-tenancy patterns:** Well-established pattern of shared-DB with tenant discriminator field. MongoDB documentation confirms compound indexes with tenantId as leftmost field is the standard approach for query isolation + performance.

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase examination.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all utilities exist in codebase, no external dependencies needed
- Architecture: HIGH -- patterns documented in architecture guide, one canonical example exists
- Pitfalls: HIGH -- identified from direct code analysis of internal call chains and query patterns
- Implementation order: HIGH -- derived from Phase 1 enforcement checklist priority system

**Research date:** 2026-02-15
**Valid until:** No expiration -- based on codebase state, not external library versions
