# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** - Phases 1-9 (shipped 2026-02-24)
- [ ] **v1.1 Super Admin Platform Management** - Phases 10-14 (in progress)

## Phases

<details>
<summary>v1.0 Multi-Tenant Architecture Hardening (Phases 1-9) - SHIPPED 2026-02-24</summary>

- [x] Phase 1: Audit & Infrastructure (3/3 plans) - completed 2026-02-14
- [x] Phase 2: Service Layer Query Hardening (8/8 plans) - completed 2026-02-15
- [x] Phase 3: Write Protection & Validation (1/1 plan) - completed 2026-02-23
- [x] Phase 4: Super-Admin Allowlist (2/2 plans) - completed 2026-02-23
- [x] Phase 5: Error Handling & Cascade Safety (4/4 plans) - completed 2026-02-24
- [x] Phase 6: Testing & Verification (4/4 plans) - completed 2026-02-24
- [x] Phase 7: Fix Import Teacher Null Properties (1/1 plan) - completed 2026-02-23
- [x] Phase 8: Fix Import Teacher Bugs (1/1 plan) - completed 2026-02-23
- [x] Phase 9: Fix Import Column Mapping (1/1 plan) - completed 2026-02-23

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

### v1.1 Super Admin Platform Management (In Progress)

**Milestone Goal:** Transform the super admin from a limited API-only role into a full SaaS platform operator with tenant CRUD, reporting, impersonation, and a dedicated frontend dashboard.

**Phase Numbering:**
- Integer phases (10, 11, 12, ...): Planned milestone work
- Decimal phases (10.1, 10.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 10: Super Admin Auth Fixes** (2/2 plans) - completed 2026-02-24
- [x] **Phase 11: Tenant Lifecycle Management** (3/3 plans) - completed 2026-02-24
- [x] **Phase 12: Platform Reporting** (2/2 plans) - completed 2026-02-25
- [ ] **Phase 13: Impersonation** (2 plans) - Super admin can view-as-tenant-admin with full audit trail
- [ ] **Phase 14: Super Admin Frontend** - Dedicated dashboard, tenant management pages, and admin CRUD UI

## Phase Details

### Phase 10: Super Admin Auth Fixes
**Goal**: Super admin can log in, navigate a dedicated layout, and maintain sessions without hitting 401 errors or seeing tenant-scoped UI
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: FIX-01, FIX-02, FIX-04
**Success Criteria** (what must be TRUE):
  1. Super admin can log in and navigate to the dashboard without any 401 errors from tenant-scoped endpoints (school-year, student, teacher, orchestra)
  2. Super admin sees a dedicated frontend layout with its own sidebar containing only platform-level navigation — no school year selector, no tenant-scoped menu items
  3. Super admin can refresh their access token via `POST /api/super-admin/auth/refresh` and continue using the dashboard without re-authenticating
  4. Regular tenant admin login flow is completely unaffected by these changes
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md -- Backend refresh endpoint + frontend auth wiring (FIX-04)
- [x] 10-02-PLAN.md -- Frontend layout, provider, and route guards (FIX-01, FIX-02)

### Phase 11: Tenant Lifecycle Management
**Goal**: Super admin can deactivate tenants (blocking login), preview deletion impact, soft-delete with grace period, permanently purge tenant data, and every mutation is audit-logged
**Depends on**: Phase 10 (super admin must have working dashboard access)
**Requirements**: FIX-03, TLCM-01, TLCM-02, TLCM-03, TLCM-04
**Success Criteria** (what must be TRUE):
  1. When super admin deactivates a tenant, that tenant's users immediately cannot log in — auth middleware checks tenant.isActive and rejects requests
  2. Super admin can view a deletion impact preview showing document counts per collection before confirming any deletion
  3. Super admin can soft-delete a tenant (marking it for deletion with a configurable grace period) and later permanently purge it — all data across all collections removed atomically with a pre-deletion snapshot preserved
  4. Every super admin mutation (create, update, delete, toggle-active) is recorded in an audit trail with the actor's identity and timestamp
  5. The two existing cascade deletion systems are consolidated into one transaction-based system before tenant deletion is built on top
**Plans**: 3 plans

Plans:
- [x] 11-01-PLAN.md -- Auth middleware tenant.isActive gating (FIX-03) + audit trail service (TLCM-04 foundation)
- [x] 11-02-PLAN.md -- Cascade deletion system consolidation (success criteria #5)
- [x] 11-03-PLAN.md -- Tenant lifecycle endpoints: deletion preview, soft-delete, purge, audit log wiring (TLCM-01, TLCM-02, TLCM-03, TLCM-04)

### Phase 12: Platform Reporting
**Goal**: Super admin can view cross-tenant analytics covering usage statistics, Ministry report status, and subscription health from dedicated API endpoints
**Depends on**: Phase 10 (needs working super admin auth context)
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04
**Success Criteria** (what must be TRUE):
  1. Super admin can view per-tenant usage statistics including teacher count, student count, orchestra count, last admin login, and subscription utilization percentage
  2. Super admin can view Ministry report status per tenant showing latest snapshot date, completion percentage, and number of snapshots
  3. Tenant list displays subscription health alerts — expiring soon, over-limit, and inactive flags — alongside each tenant
  4. A single combined dashboard API endpoint returns overview cards, tenant health list, and alerts in one response (consumed by Phase 14 frontend)
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md -- Reporting service functions and validation schemas (REPT-01, REPT-02, REPT-03, REPT-04 data layer)
- [x] 12-02-PLAN.md -- Reporting controller, routes, and database indexes (REPT-04 HTTP layer)

### Phase 13: Impersonation
**Goal**: Super admin can impersonate a tenant's admin to see exactly what they see, with every action audit-logged and a clear visual indicator in the frontend
**Depends on**: Phase 11 (tenant.isActive gating prevents impersonating deactivated tenants), Phase 12 (reporting APIs stable before adding highest-risk auth feature)
**Requirements**: IMPR-01, IMPR-02, IMPR-03
**Success Criteria** (what must be TRUE):
  1. Super admin can start impersonation of a tenant's admin and receive a scoped JWT that passes through regular auth middleware — seeing exactly what that tenant's admin sees
  2. Every action performed during impersonation is logged with both the super admin identity and the impersonated tenant context
  3. Frontend displays a persistent visual banner during impersonation showing the tenant name and an "Exit" button that restores super admin context without requiring re-login
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md -- Backend impersonation endpoints, audit enrichment middleware, and audit constants (IMPR-01, IMPR-02)
- [ ] 13-02-PLAN.md -- Frontend impersonation: auth context, token stashing, ImpersonationBanner component (IMPR-03)

### Phase 14: Super Admin Frontend
**Goal**: Super admin has a complete frontend dashboard with platform overview, tenant management pages with inline CRUD actions, and a super admin management page
**Depends on**: Phase 10 (layout), Phase 11 (deletion APIs), Phase 12 (reporting APIs), Phase 13 (impersonation APIs)
**Requirements**: SAUI-01, SAUI-02, SAUI-03, SAUI-04
**Success Criteria** (what must be TRUE):
  1. Super admin dashboard page shows platform overview cards (total tenants, total users, subscription breakdown) and a tenant list with inline actions (edit, delete, impersonate, toggle-active)
  2. Tenant detail page shows full tenant info (subscription details, usage stats, Ministry report status) with working edit, delete, and impersonate action buttons
  3. Tenant create and edit forms submit correctly via the super admin frontend and the tenant list reflects changes immediately
  4. Super admin management page allows listing, creating, and editing super admin accounts via a dedicated UI
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD
- [ ] 14-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Audit & Infrastructure | v1.0 | 3/3 | Complete | 2026-02-14 |
| 2. Service Layer Query Hardening | v1.0 | 8/8 | Complete | 2026-02-15 |
| 3. Write Protection & Validation | v1.0 | 1/1 | Complete | 2026-02-23 |
| 4. Super-Admin Allowlist | v1.0 | 2/2 | Complete | 2026-02-23 |
| 5. Error Handling & Cascade Safety | v1.0 | 4/4 | Complete | 2026-02-24 |
| 6. Testing & Verification | v1.0 | 4/4 | Complete | 2026-02-24 |
| 7. Fix Import Teacher Null Properties | v1.0 | 1/1 | Complete | 2026-02-23 |
| 8. Fix Import Teacher Bugs | v1.0 | 1/1 | Complete | 2026-02-23 |
| 9. Fix Import Column Mapping | v1.0 | 1/1 | Complete | 2026-02-23 |
| 10. Super Admin Auth Fixes | v1.1 | 2/2 | Complete | 2026-02-24 |
| 11. Tenant Lifecycle Management | v1.1 | 3/3 | Complete | 2026-02-24 |
| 12. Platform Reporting | v1.1 | 2/2 | Complete | 2026-02-25 |
| 13. Impersonation | v1.1 | 0/2 | Not started | - |
| 14. Super Admin Frontend | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-25 (Phase 13 planned -- 2 plans created)*
