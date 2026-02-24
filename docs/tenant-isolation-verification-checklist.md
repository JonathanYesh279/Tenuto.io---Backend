# Tenant Isolation Verification Checklist

**Purpose:** Manual verification guide for confirming multi-tenant isolation in production or staging. Complements the automated test suite (`npm run test:tenant-isolation`).

**Last verified:** [DATE]
**Verified by:** [NAME]

## Prerequisites

- [ ] Access to two separate tenant accounts (e.g., Raanana Conservatory and Rishon Conservatory)
- [ ] Admin credentials for both tenants
- [ ] Access to MongoDB shell or Compass for direct DB inspection

## 1. Authentication Isolation

- [ ] Log in as Tenant A admin -- verify JWT contains correct tenantId
- [ ] Log in as Tenant B admin -- verify JWT contains different tenantId
- [ ] Verify login without tenantId shows tenant selection (TENANT_SELECTION_REQUIRED)
- [ ] Verify JWT `exp` is reasonable (1 hour for access, 7 days for refresh)

## 2. Data Read Isolation

- [ ] As Tenant A admin, navigate to Students page -- verify only Tenant A students appear
- [ ] As Tenant A admin, navigate to Teachers page -- verify only Tenant A teachers appear
- [ ] As Tenant A admin, navigate to Orchestras page -- verify only Tenant A orchestras appear
- [ ] As Tenant A admin, navigate to Schedule page -- verify only Tenant A time blocks appear
- [ ] As Tenant A admin, navigate to Theory Lessons -- verify only Tenant A lessons appear
- [ ] As Tenant A admin, navigate to Bagrut -- verify only Tenant A records appear
- [ ] As Tenant A admin, navigate to Hours Summary -- verify only Tenant A summaries appear
- [ ] REPEAT all checks as Tenant B admin to verify symmetry

## 3. Data Write Isolation

- [ ] As Tenant A admin, create a new student -- verify the student document has tenantId = Tenant A
- [ ] As Tenant A admin, update a student -- verify the update query includes tenantId filter (check server logs or MongoDB profiler)
- [ ] Attempt to modify Tenant B student ID via Postman/curl with Tenant A token -- verify 404 response

## 4. URL/ID Manipulation (IDOR)

- [ ] Copy a Tenant B student's ObjectId
- [ ] As Tenant A admin, navigate to /students/{tenantB_studentId} -- verify 404 (not 403)
- [ ] As Tenant A admin, PUT /api/student/{tenantB_studentId} -- verify 404
- [ ] Verify error response does NOT reveal whether the resource exists in another tenant

## 5. Request Body Injection

- [ ] As Tenant A admin, POST /api/student with tenantId: "tenant-b-id" in request body -- verify 400 TENANT_MISMATCH
- [ ] As Tenant A admin, POST /api/student with tenantId matching own tenant in body -- verify tenantId is stripped (check created doc has server-derived tenantId)

## 6. Database Index Verification

- [ ] Run `db.student.getIndexes()` -- verify compound index on { tenantId: 1, ... } exists
- [ ] Run `db.teacher.getIndexes()` -- verify compound index on { tenantId: 1, ... } exists
- [ ] Run `db.orchestra.getIndexes()` -- verify compound index on { tenantId: 1, ... } exists
- [ ] Spot-check 3-4 other collections for tenantId compound indexes

## 7. Cross-Tenant Allowlist

- [ ] Review config/crossTenantAllowlist.js -- verify only expected routes are listed (6 entries)
- [ ] Run `node utils/validateAllowlist.js` -- verify "All routes accounted for"
- [ ] Verify /api/health/live returns 200 without auth
- [ ] Verify /api/config returns 200 without auth
- [ ] Verify /api/super-admin/* requires super_admin JWT (returns 401/403 without it)

## 8. Error Response Privacy

- [ ] Trigger a 404 on a resource from another tenant -- verify response says "not found" (no hint about other tenant)
- [ ] Trigger a validation error (400) -- verify response contains field-level detail but no tenantId leakage
- [ ] Trigger a 500 error (e.g., malformed request to a service) -- verify response says "An unexpected error occurred" (no stack trace, no details)

## 9. WebSocket Isolation (if applicable)

- [ ] Connect as Tenant A admin -- verify socket joins admins_{tenantA} room
- [ ] Trigger a cascade deletion in Tenant A -- verify WebSocket events only go to Tenant A admins
- [ ] Verify Tenant B admin does NOT receive Tenant A's WebSocket events

## Sign-off

- [ ] All items verified
- [ ] Any issues documented below

### Issues Found

_None / list issues here_
