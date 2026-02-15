# Roadmap: Multi-Tenant Architecture Hardening

## Overview

This milestone systematically hardens Tenuto.io's multi-tenant isolation by auditing every MongoDB query path, standardizing enforcement patterns across all services, and delivering automated verification that no query can leak data across tenants. The system already has the infrastructure (req.context, buildScopedFilter, requireTenantId) but enforcement is inconsistent. This roadmap transforms partial compliance into 100% verified isolation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Audit & Infrastructure** - Inventory every query path, standardize patterns, document architecture ✓ 2026-02-14
- [x] **Phase 2: Service Layer Query Hardening** - Universal tenantId filtering in all services ✓ 2026-02-15
- [ ] **Phase 3: Write Protection & Validation** - Prevent client-supplied tenantId from overriding server context
- [ ] **Phase 4: Super-Admin Allowlist** - Explicit cross-tenant operations with authorization
- [ ] **Phase 5: Error Handling & Cascade Safety** - Tenant-scoped errors, safe cascade deletions
- [ ] **Phase 6: Testing & Verification** - Automated + manual verification of complete isolation

## Phase Details

### Phase 1: Audit & Infrastructure
**Goal**: Complete understanding of current state and canonical patterns documented
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. Every MongoDB query location is inventoried with risk categorization
  2. Architecture guide exists documenting req.context, buildScopedFilter, requireTenantId, and allowlist patterns
  3. Enforcement checklist exists covering every route/service pair with pass/fail status
  4. Compound indexes { tenantId: 1, ... } exist on all collections queried by tenantId
  5. Audit of req.context population confirms tenantId present on every authenticated route
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Query inventory and req.context population audit
- [x] 01-02-PLAN.md -- Architecture guide and enforcement checklist
- [x] 01-03-PLAN.md -- Compound index creation script

### Phase 2: Service Layer Query Hardening
**Goal**: Every MongoDB query includes tenantId filter or is on explicit allowlist
**Depends on**: Phase 1
**Requirements**: QENF-01, QENF-02, QENF-03, WPRT-01
**Success Criteria** (what must be TRUE):
  1. All service methods accept context parameter with standardized signature
  2. All MongoDB find/findOne/update/delete calls use buildScopedFilter (including deleteOne/deleteMany)
  3. All _buildCriteria and filter-building helper methods require context.tenantId
  4. Services throw error if called without context parameter (fail-fast validation)
  5. All write operations derive tenantId from req.context, never from client request body
  6. All aggregation pipelines include $match { tenantId } as the first stage
**Plans:** 8 plans

Plans:
- [x] 02-01-PLAN.md -- Infrastructure hardening (buildScopedFilter, enforceTenant, buildContext, addSchoolYearToRequest)
- [x] 02-02-PLAN.md -- School-year + student service full hardening (foundational services)
- [x] 02-03-PLAN.md -- Teacher + teacher-lessons service full hardening
- [x] 02-04-PLAN.md -- Orchestra + rehearsal service full hardening (aggregation pipelines)
- [x] 02-05-PLAN.md -- Theory + bagrut service full hardening (cross-service calls)
- [x] 02-06-PLAN.md -- Time-block + schedule attendance + analytics attendance hardening
- [x] 02-07-PLAN.md -- Hours-summary + import + export service hardening
- [x] 02-08-PLAN.md -- Shared services (duplicateDetection, conflictDetection, permissionService)

### Phase 3: Write Protection & Validation
**Goal**: Client cannot override server-derived tenantId in any write operation
**Depends on**: Phase 2
**Requirements**: WPRT-02, WPRT-03
**Success Criteria** (what must be TRUE):
  1. Validation middleware strips tenantId from request bodies before controllers execute
  2. If client-supplied tenantId differs from req.context.tenantId, operation throws error
  3. All insertOne, insertMany, updateOne, updateMany operations validate tenantId matches context
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning

### Phase 4: Super-Admin Allowlist
**Goal**: Cross-tenant operations are explicitly documented and require admin role + allowCrossTenant flag
**Depends on**: Phase 2 (Phase 3 can run in parallel)
**Requirements**: QENF-04, QENF-05
**Success Criteria** (what must be TRUE):
  1. CROSS_TENANT_ALLOWLIST constant exists as code artifact documenting every intentional cross-tenant operation
  2. Allowlisted operations require both admin role AND explicit allowCrossTenant: true flag
  3. Middleware enforces allowlist at route level (non-allowlisted routes cannot bypass tenantId)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

### Phase 5: Error Handling & Cascade Safety
**Goal**: Error responses never reveal cross-tenant data existence, cascade deletions are tenant-safe
**Depends on**: Phase 2
**Requirements**: ERRH-01, ERRH-02
**Success Criteria** (what must be TRUE):
  1. Not found responses are consistent regardless of whether resource exists in different tenant
  2. Error messages never reveal whether resource exists in another tenant
  3. Both cascade deletion systems audited and unified with tenant-scoped queries
  4. All cascade queries use buildScopedFilter to prevent cross-tenant deletion
  5. Dry-run preview mode exists for cascade deletions
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during planning

### Phase 6: Testing & Verification
**Goal**: Automated test suite proves cross-tenant isolation works with zero false negatives
**Depends on**: Phases 1, 2, 3, 4, 5
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Integration tests prove cross-tenant read queries return empty (not other tenant's data)
  2. Integration tests prove cross-tenant write operations are rejected
  3. Tests run in CI on every PR to catch isolation regressions
  4. Tests cover all allowlisted cross-tenant operations to verify they work only for authorized roles
  5. Load tests with 100+ concurrent requests prove no async context contamination
  6. Human-walkable verification checklist executed and documented
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audit & Infrastructure | 3/3 | ✓ Complete | 2026-02-14 |
| 2. Service Layer Query Hardening | 8/8 | ✓ Complete | 2026-02-15 |
| 3. Write Protection & Validation | 0/TBD | Not started | - |
| 4. Super-Admin Allowlist | 0/TBD | Not started | - |
| 5. Error Handling & Cascade Safety | 0/TBD | Not started | - |
| 6. Testing & Verification | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-15 (Phase 2 complete)*
