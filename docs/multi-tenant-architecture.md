# Multi-Tenant Architecture Guide

**Last updated:** 2026-02-14
**Status:** Canonical reference for all multi-tenant implementation work
**Audience:** Developers implementing Phase 2+ query hardening

---

## 1. Overview

### Core Principle

> **Every MongoDB query includes `tenantId` or is on the explicit allowlist. No exceptions.**

Tenuto.io uses a shared-database multi-tenant architecture where all tenants share the same MongoDB database. Tenant isolation is enforced at the application layer through query filters, not at the database level.

### Enforcement Model

**Default-deny with allowlist.** Every query MUST include a `tenantId` filter unless the operation is explicitly documented in the cross-tenant allowlist. If a query lacks `tenantId` and is not allowlisted, it is a security violation that can leak data across tenants.

### Server-Derived tenantId Only

The `tenantId` used in queries is ALWAYS derived from the authenticated teacher's JWT token, loaded by middleware, and placed on `req.context.tenantId`. The client NEVER supplies `tenantId` in request bodies or query parameters. Any client-supplied `tenantId` must be stripped or rejected.

---

## 2. Middleware Chain

Every authenticated request passes through this middleware chain before reaching route handlers:

```
authenticateToken -> buildContext -> addSchoolYearToRequest -> routes
```

### What Each Middleware Provides

| Middleware | Provides | File |
|-----------|----------|------|
| `authenticateToken` | `req.teacher` (full teacher document from JWT `_id` lookup) | `middleware/auth.middleware.js` |
| `buildContext` | `req.context` (standardized context object, see below) | `middleware/tenant.middleware.js` |
| `addSchoolYearToRequest` | `req.schoolYear` (current school year for tenant) | `middleware/school-year.middleware.js` |

### req.context Shape

Built by `buildContext` in `middleware/tenant.middleware.js` (lines 24-73):

```javascript
req.context = {
  tenantId: teacher.tenantId || null,   // Server-derived, from teacher document
  userId: teacherId,                     // Authenticated teacher's _id (string)
  userRoles: teacher.roles || [],        // Array of Hebrew role strings
  isAdmin: teacher.roles?.includes('מנהל') || false,
  schoolYearId: req.schoolYear?._id?.toString() || req.query.schoolYearId || null,
  scopes: {
    studentIds: teacher._studentAccessIds,   // Lazy-loaded from teacherAssignments
    orchestraIds: teacher.conducting?.orchestraIds || [],
  },
};
```

### Current Caveat

`req.context.tenantId` can be `null` if the teacher document lacks a `tenantId` field. `buildContext` does NOT throw in this case -- it silently sets `tenantId: null`. Phase 2 should harden `buildContext` to reject requests where `tenantId` is null (or apply `enforceTenant` middleware to all data-access routes).

---

## 3. Canonical Pattern: buildScopedFilter

**When to use:** EVERY service-layer query that hits MongoDB for tenant-scoped data.

**File:** `utils/queryScoping.js`

**Signature:**

```javascript
buildScopedFilter(collection, baseFilter, context)
```

- `collection` -- target collection name (`'student'`, `'teacher'`, `'orchestra'`, etc.)
- `baseFilter` -- caller-supplied filter criteria (e.g., `{ isActive: true }`)
- `context` -- `req.context` object from middleware

**Behavior:**

1. Copies `baseFilter` into a new object
2. Adds `tenantId` from `context.tenantId` (if available)
3. For non-admin users querying `'student'` collection, adds `teacherAssignments.teacherId` filter
4. Returns the combined filter object

**Current behavior (utils/queryScoping.js, line 16):** Silently skips `tenantId` if `context.tenantId` is null. Phase 2 should make this throw instead.

### Correct Usage

See `api/student/student.service.js` (lines 25-40) for the canonical example:

```javascript
// CORRECT: Always use buildScopedFilter with context
import { buildScopedFilter } from '../../utils/queryScoping.js';

async function getStudents(filterBy = {}, page = 1, limit = 0, options = {}) {
  const { context } = options;
  const collection = await getCollection('student');
  const criteria = _buildCriteria(filterBy);

  // Role-based scoping: prefer context
  if (context) {
    Object.assign(criteria, buildScopedFilter('student', {}, context));
  }

  const students = await collection.find(criteria).toArray();
  return students;
}
```

And in the controller (`api/student/student.controller.js`, line 30):

```javascript
// CORRECT: Controller passes req.context to service
const result = await studentService.getStudents(filterBy, page, limit, { context: req.context });
```

---

## 4. Canonical Pattern: requireTenantId

**When to use:** As a fail-fast guard at the start of service methods before running any queries.

**File:** `middleware/tenant.middleware.js` (lines 11-16)

**Signature:**

```javascript
requireTenantId(tenantId)
```

- Throws `Error('TENANT_GUARD: tenantId is required...')` if `tenantId` is falsy
- Returns `tenantId` if valid

### Correct Usage

```javascript
import { requireTenantId } from '../../middleware/tenant.middleware.js';

async function getTeacherById(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
    tenantId,  // Always included
  });
  return teacher;
}
```

### Current Status

`requireTenantId` exists in `middleware/tenant.middleware.js` but is NOT called anywhere in production code (see query inventory Finding 6). Phase 2 should add it as a guard to all service methods.

---

## 5. Canonical Pattern: enforceTenant Middleware

**When to use:** Applied at the route level to groups of routes that MUST be tenant-scoped.

**File:** `middleware/tenant.middleware.js` (lines 80-95)

**Behavior:** Returns HTTP 403 with `{ error: 'Tenant context is required', code: 'MISSING_TENANT' }` if `req.context.tenantId` is missing.

### Recommended Usage (Phase 2)

```javascript
// In server.js route registration:
import { enforceTenant } from './middleware/tenant.middleware.js';

app.use('/api/student', authenticateToken, buildContext, enforceTenant, addSchoolYearToRequest, studentRoutes);
app.use('/api/teacher', authenticateToken, buildContext, enforceTenant, addSchoolYearToRequest, teacherRoutes);
app.use('/api/orchestra', authenticateToken, buildContext, enforceTenant, addSchoolYearToRequest, orchestraRoutes);
// ... all data-access routes
```

### Current Status

`enforceTenant` exists but is NOT applied to any route in `server.js` (see query inventory Finding 5). All authenticated routes have `buildContext` but not `enforceTenant`. This means a teacher without `tenantId` can access routes with `req.context.tenantId === null`, and queries will run without tenant isolation.

---

## 6. Allowlist Pattern (Phase 4)

Cross-tenant operations must be explicitly documented and require special authorization.

### Pattern

```javascript
// config/constants.js or dedicated file
export const CROSS_TENANT_ALLOWLIST = [
  {
    route: '/api/auth/login',
    method: 'POST',
    reason: 'Login occurs before tenant context is established. Uses tenant selection flow.',
    requiredRole: null,  // Public
  },
  {
    route: '/api/auth/tenants',
    method: 'GET',
    reason: 'Returns available tenants for a given email during login.',
    requiredRole: null,  // Public
  },
  {
    route: '/api/super-admin/*',
    method: '*',
    reason: 'Super admin operates across all tenants by design.',
    requiredRole: 'super_admin',
  },
  {
    route: '/api/health/*',
    method: 'GET',
    reason: 'Health checks are system-level, not tenant-scoped.',
    requiredRole: null,  // Public
  },
  {
    route: '/api/admin/cascade-deletion/*',
    method: '*',
    reason: 'Cascade deletion operates by entity ID under admin authorization.',
    requiredRole: 'מנהל',
  },
];
```

### Phase 4 Implementation

Each cross-tenant operation entry should include:
- `route` and `method` -- exact route pattern
- `reason` -- why it needs cross-tenant access
- `requiredRole` -- minimum role required (null for public)

See the enforcement checklist (`docs/tenant-enforcement-checklist.md`) for the complete list of currently exempt operations.

---

## 7. Anti-Patterns (What NOT to Do)

### Anti-Pattern A: Conditional tenantId in _buildCriteria

**WRONG:**

```javascript
// teacher.service.js, lines 915-921
function _buildCriteria(filterBy) {
  const criteria = {};
  if (filterBy.tenantId) {           // <-- OPT-IN: only added if caller passes it
    criteria.tenantId = filterBy.tenantId;
  }
  // ... other filters
}
```

**Why dangerous:** tenantId is only included if the caller explicitly sets `filterBy.tenantId`. If the controller forgets to pass it, the query runs without tenant isolation. This is an opt-in pattern; multi-tenant isolation must be opt-OUT (default-deny).

**CORRECT:**

```javascript
function _buildCriteria(filterBy, context) {
  const criteria = buildScopedFilter('teacher', {}, context);
  // ... other filters added to criteria
}
```

This pattern appears in 6 services: `teacher.service.js`, `student.service.js`, `orchestra.service.js`, `rehearsal.service.js`, `theory.service.js`, `bagrut.service.js`.

---

### Anti-Pattern B: findOne by _id Without tenantId (IDOR Vulnerability)

**WRONG:**

```javascript
// teacher.service.js, lines 109-111
async function getTeacherById(teacherId, options = {}) {
  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
    // No tenantId! Any user who guesses this ObjectId can access any teacher
  });
}
```

**Why dangerous:** ObjectIds are sequential and guessable. An authenticated user in Tenant A could access records belonging to Tenant B by iterating IDs. This is an Insecure Direct Object Reference (IDOR) vulnerability.

**CORRECT:**

```javascript
async function getTeacherById(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const collection = await getCollection('teacher');
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
    tenantId,   // Always scoped to caller's tenant
  });
}
```

Every `getById` function in the codebase exhibits this pattern. See query inventory Finding 2.

---

### Anti-Pattern C: Aggregation Pipeline Without tenantId in $match

**WRONG:**

```javascript
// orchestra.service.js, line 110
const pipeline = [
  { $match: { _id: ObjectId.createFromHexString(orchestraId) } },  // No tenantId!
  { $lookup: { from: 'student', localField: 'members', foreignField: '_id', as: 'memberDetails' } },
];
```

**Why dangerous:** The initial `$match` returns a record regardless of tenant. The subsequent `$lookup` joins to ALL student records in the database, not just those in the same tenant.

**CORRECT:**

```javascript
const tenantId = requireTenantId(context?.tenantId);
const pipeline = [
  { $match: { _id: ObjectId.createFromHexString(orchestraId), tenantId } },
  { $lookup: {
      from: 'student',
      let: { memberIds: '$members' },
      pipeline: [
        { $match: { $expr: { $in: ['$_id', '$$memberIds'] }, tenantId } },
      ],
      as: 'memberDetails',
  }},
];
```

---

### Anti-Pattern D: $lookup Without Tenant Scoping in Pipeline Sub-expression

**WRONG:**

```javascript
// orchestra.service.js, getOrchestras aggregation (line 26)
{ $lookup: {
    from: 'student',
    localField: 'members',
    foreignField: '_id',
    as: 'memberDetails',
}}
```

**Why dangerous:** Simple `$lookup` with `localField`/`foreignField` has no way to add a tenant filter. It joins to ALL matching records across all tenants.

**CORRECT:**

```javascript
{ $lookup: {
    from: 'student',
    let: { memberIds: '$members', tid: '$tenantId' },
    pipeline: [
      { $match: { $expr: { $and: [
        { $in: ['$_id', '$$memberIds'] },
        { $eq: ['$tenantId', '$$tid'] }
      ]}}},
    ],
    as: 'memberDetails',
}}
```

Always use the pipeline form of `$lookup` when tenant scoping is needed.

---

### Anti-Pattern E: Controller Passing req.query Directly Without Context

**WRONG:**

```javascript
// Most controllers currently do this:
async function getTeachers(req, res) {
  const filterBy = {
    tenantId: req.context?.tenantId || null,  // Added to filterBy, not passed as context
    name: req.query.name,
  };
  const teachers = await teacherService.getTeachers(filterBy);
}
```

**Why dangerous:** The service's `_buildCriteria` receives `tenantId` in `filterBy` -- which is the opt-in pattern from Anti-Pattern A. If the controller has a bug or forgets to include `tenantId`, the query runs unscoped.

**CORRECT:**

```javascript
async function getTeachers(req, res) {
  const filterBy = { name: req.query.name };
  const teachers = await teacherService.getTeachers(filterBy, 1, 0, { context: req.context });
}
```

The service should accept `context` in options and use `buildScopedFilter` internally.

---

### Anti-Pattern F: Service Accepting tenantId as Optional Parameter

**WRONG:**

```javascript
async function calculateTeacherHours(teacherId, tenantId, schoolYearId) {
  // tenantId is an optional positional parameter -- easy to forget or pass as null
  const filter = tenantId ? { tenantId } : {};
}
```

**Why dangerous:** Making `tenantId` optional means callers can omit it. The service should require `context` and extract `tenantId` from it, failing fast if missing.

**CORRECT:**

```javascript
async function calculateTeacherHours(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  const filter = { tenantId };
}
```

---

## 8. Service Migration Checklist

Step-by-step guide for converting a service from ad-hoc tenant handling to the canonical pattern.

### Step 1: Add `context` to Options Parameter

Change service method signatures to accept `context` in an options object:

```javascript
// BEFORE:
async function getTeachers(filterBy = {}, page = 1, limit = 0)

// AFTER:
async function getTeachers(filterBy = {}, page = 1, limit = 0, options = {})
```

### Step 2: Replace `_buildCriteria` Conditional tenantId with `buildScopedFilter`

```javascript
import { buildScopedFilter } from '../../utils/queryScoping.js';

// BEFORE:
const criteria = _buildCriteria(filterBy);

// AFTER:
const { context } = options;
const baseCriteria = _buildCriteria(filterBy);  // Keep for non-tenant filters
const criteria = context
  ? { ...baseCriteria, ...buildScopedFilter('teacher', {}, context) }
  : baseCriteria;  // Backward compat during transition
```

Remove the `if (filterBy.tenantId) criteria.tenantId = filterBy.tenantId` line from `_buildCriteria`.

### Step 3: Add `requireTenantId` Guard to All Public Methods

```javascript
import { requireTenantId } from '../../middleware/tenant.middleware.js';

async function getTeacherById(teacherId, options = {}) {
  const tenantId = requireTenantId(options.context?.tenantId);
  // ... query with tenantId
}
```

### Step 4: Update `getById` Functions to Include tenantId in Filter

```javascript
// BEFORE:
const teacher = await collection.findOne({ _id: ObjectId.createFromHexString(teacherId) });

// AFTER:
const tenantId = requireTenantId(options.context?.tenantId);
const teacher = await collection.findOne({
  _id: ObjectId.createFromHexString(teacherId),
  tenantId,
});
```

### Step 5: Add tenantId to Aggregation `$match` Stages

```javascript
// BEFORE:
{ $match: { _id: ObjectId.createFromHexString(id) } }

// AFTER:
{ $match: { _id: ObjectId.createFromHexString(id), tenantId } }
```

### Step 6: Scope `$lookup` Pipelines with tenantId

Convert simple `$lookup` to pipeline form with tenant filter (see Anti-Pattern D).

### Step 7: Update Controller to Pass `{ context: req.context }` in Options

```javascript
// BEFORE:
const teachers = await teacherService.getTeachers({ tenantId: req.context?.tenantId, ...filterBy });

// AFTER:
const teachers = await teacherService.getTeachers(filterBy, page, limit, { context: req.context });
```

### Reference Files

- **Correct pattern (partial):** `api/student/student.service.js` -- uses `buildScopedFilter` for list queries (but not for getById or write operations)
- **Correct controller pattern:** `api/student/student.controller.js` -- passes `{ context: req.context }`
- **buildScopedFilter implementation:** `utils/queryScoping.js`
- **requireTenantId implementation:** `middleware/tenant.middleware.js`
- **enforceTenant implementation:** `middleware/tenant.middleware.js`
- **Middleware chain registration:** `server.js` (lines 128-265)

---

*This document defines "what correct looks like." It does NOT make code changes. Phase 2 plans will reference this guide when hardening individual services.*
