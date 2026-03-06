# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [x] **v1.2 Student Import Enhancement** — Phases 15-19 (shipped 2026-02-27)
- [x] **v1.3 Conservatory Information Import** — Phases 20-22 (shipped 2026-02-28)
- [x] **v1.4 Ensemble Import** — Phases 23-26 (shipped 2026-02-28)
- [x] **v1.5 Privacy Compliance Foundation** — Phases 27-30 (shipped 2026-03-02)
- [x] **v1.6 Room & Hours Management Table** — Phases 31-38 (shipped 2026-03-04)
- [ ] **v1.7 RBAC & Admin Provisioning** — Phases 39-48

## Phases

<details>
<summary>v1.0 Multi-Tenant Architecture Hardening (Phases 1-9) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Audit & Infrastructure (3/3 plans) — completed 2026-02-14
- [x] Phase 2: Service Layer Query Hardening (8/8 plans) — completed 2026-02-15
- [x] Phase 3: Write Protection & Validation (1/1 plan) — completed 2026-02-23
- [x] Phase 4: Super-Admin Allowlist (2/2 plans) — completed 2026-02-23
- [x] Phase 5: Error Handling & Cascade Safety (4/4 plans) — completed 2026-02-24
- [x] Phase 6: Testing & Verification (4/4 plans) — completed 2026-02-24
- [x] Phase 7: Fix Import Teacher Null Properties (1/1 plan) — completed 2026-02-23
- [x] Phase 8: Fix Import Teacher Bugs (1/1 plan) — completed 2026-02-23
- [x] Phase 9: Fix Import Column Mapping (1/1 plan) — completed 2026-02-23

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 Super Admin Platform Management (Phases 10-14) — SHIPPED 2026-02-26</summary>

- [x] Phase 10: Super Admin Auth Fixes (2/2 plans) — completed 2026-02-24
- [x] Phase 11: Tenant Lifecycle Management (3/3 plans) — completed 2026-02-24
- [x] Phase 12: Platform Reporting (2/2 plans) — completed 2026-02-25
- [x] Phase 13: Impersonation (2/2 plans) — completed 2026-02-25
- [x] Phase 14: Super Admin Frontend (4/4 plans) — completed 2026-02-26

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.2 Student Import Enhancement (Phases 15-19) — SHIPPED 2026-02-27</summary>

- [x] Phase 15: Bug Fix + Column Map Extensions (1/1 plan) — completed 2026-02-27
- [x] Phase 16: Instrument Progress + Student Data Enrichment (2/2 plans) — completed 2026-02-27
- [x] Phase 17: Teacher-Student Linking (2/2 plans) — completed 2026-02-27
- [x] Phase 18: Frontend Preview Enhancement (1/1 plan) — completed 2026-02-27
- [x] Phase 19: Import Data Quality (2/2 plans) — completed 2026-02-27

See: `.planning/milestones/v1.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.3 Conservatory Information Import (Phases 20-22) — SHIPPED 2026-02-28</summary>

- [x] Phase 20: Conservatory Excel Parser + API (1/1 plan) — completed 2026-02-27
- [x] Phase 21: Conservatory Import Frontend (1/1 plan) — completed 2026-02-28
- [x] Phase 22: Settings Page Expansion (1/1 plan) — completed 2026-02-28

See: `.planning/milestones/v1.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.4 Ensemble Import (Phases 23-26) — SHIPPED 2026-02-28</summary>

- [x] Phase 23: Ensemble Parser and Preview (2/2 plans) — completed 2026-02-28
- [x] Phase 24: Ensemble Execute and Schema (1/1 plan) — completed 2026-02-28
- [x] Phase 25: Ensemble Import Frontend (1/1 plan) — completed 2026-02-28
- [x] Phase 26: Student-Orchestra Linking from Import (2/2 plans) — completed 2026-02-28

See: `.planning/milestones/v1.4-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.5 Privacy Compliance Foundation (Phases 27-30) — SHIPPED 2026-03-02</summary>

- [x] Phase 27: Data Inventory and System Mapping (4/4 plans) — completed 2026-03-02
- [x] Phase 28: Governance Framework and Security Policies (3/3 plans) — completed 2026-03-02
- [x] Phase 29: Operational Procedures (2/2 plans) — completed 2026-03-02
- [x] Phase 30: Supplementary Policies and Audit Program (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.5-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.6 Room & Hours Management Table (Phases 31-38) — SHIPPED 2026-03-04</summary>

- [x] Phase 31: Room Data Foundation (3/3 plans) — completed 2026-03-03
- [x] Phase 32: Room Schedule API & Conflict Detection (2/2 plans) — completed 2026-03-03
- [x] Phase 33: Read-Only Room Grid UI (3/3 plans) — completed 2026-03-03
- [x] Phase 34: Grid Interaction (3/3 plans) — completed 2026-03-03
- [x] Phase 35: Polish & Week Overview (2/2 plans) — completed 2026-03-03
- [x] Phase 36: Seed Teacher Schedule Data (1/1 plan) — completed 2026-03-03
- [x] Phase 37: Room Schedule UX Fixes & Conflict Prevention (9/9 plans) — completed 2026-03-04
- [x] Phase 38: Single-Lesson Reschedule & Detail Modal (3/3 plans) — completed 2026-03-04

See: `.planning/milestones/v1.6-ROADMAP.md` for full details.

</details>

## v1.7 RBAC & Admin Provisioning

**Milestone Goal:** Give conservatory admins granular role-based access control with department-scoped coordinators, and fix the missing admin-creation step in tenant provisioning.

**Design doc:** `docs/plans/2026-03-05-rbac-admin-provisioning-design.md`

- [x] **Phase 39: Role & Permission Foundation** — Constants, data model, and hardcoded defaults (completed 2026-03-05)
- [x] **Phase 40: Permission Engine & Middleware** — requirePermission, buildContext extension, department-scoped filtering (completed 2026-03-05)
- [x] **Phase 41: Route Migration** — Migrate all routes from requireAuth(roles[]) to requirePermission(domain, action) (completed 2026-03-05)
- [x] **Phase 42: Admin Provisioning** — Tenant creation with inline admin account in a transaction (completed 2026-03-05)
- [x] **Phase 43: Permission Configuration API & Safeguards** — Admin customization endpoints with lockout prevention (completed 2026-03-05)
- [x] **Phase 44: Settings UI** — Staff role assignment table and permission matrix editor (completed 2026-03-05)
- [x] **Phase 45: Super Admin Tenant Admin Management** — Dedicated super admin page for viewing and managing tenant admin accounts (completed 2026-03-06)
- [x] **Phase 46: Bagrut UI/UX Alignment** — Upgrade bagrut pages to modern FilterPanel + SearchInput patterns matching other pages, add grade and age filters (completed 2026-03-06)
- [ ] **Phase 47: Department Scope Wiring & Route Migration** — Wire req.permissionScope through controllers/services to buildScopedFilter, migrate remaining routes to requirePermission
- [ ] **Phase 48: v1.7 Bug Fixes & Polish** — Fix teacherProfile crash, console.log cleanup, sidebar nav link, ROLE_COLORS

## Phase Details

### Phase 39: Role & Permission Foundation
**Goal**: The system has a complete, typed vocabulary of roles, permission domains, actions, and scopes -- with hardcoded defaults that any phase can reference
**Depends on**: Nothing (first phase of v1.7)
**Requirements**: ROLE-01, ROLE-02, ROLE-05, PERM-02, CONF-01, CONF-02
**Success Criteria** (what must be TRUE):
  1. `TEACHER_ROLES` array includes all 13 roles (3 admin-tier, 2 coordinator, 7 teaching, 1 view-only) and the teacher Joi schema accepts them
  2. `ADMIN_TIER_ROLES` and `COORDINATOR_ROLES` subsets are exported and usable as guards in any module
  3. `DEFAULT_ROLE_PERMISSIONS` constant defines the complete domain/action/scope matrix for all 13 roles, with admin-tier roles having identical full-access permissions
  4. Tenant schema accepts an optional `rolePermissions` field, and when missing, middleware code can fall back to `DEFAULT_ROLE_PERMISSIONS` without error
  5. `PERMISSION_DOMAINS` and `PERMISSION_ACTIONS` constants enumerate all 9 domains and their valid actions
**Plans:** 2 plans
Plans:
- [x] 39-01-PLAN.md — Role constants, permission vocabulary, and DEFAULT_ROLE_PERMISSIONS matrix
- [x] 39-02-PLAN.md — Admin-tier middleware awareness and buildContext permission resolution

### Phase 40: Permission Engine & Middleware
**Goal**: Every request carries resolved effective permissions on `req.context`, and `requirePermission(domain, action)` can gate any route with scope-aware filtering -- including department-scoped coordinators
**Depends on**: Phase 39 (role constants and DEFAULT_ROLE_PERMISSIONS must exist)
**Requirements**: PERM-01, PERM-03, PERM-04, PERM-05, ROLE-03, ROLE-04, CONF-05
**Success Criteria** (what must be TRUE):
  1. `buildContext` resolves the union of all teacher roles into `req.context.effectivePermissions` -- a teacher with roles `['מורה', 'רכז/ת מחלקתי']` gets the most permissive scope per domain/action
  2. `requirePermission('students', 'view')` returns 403 for a teacher without that permission, and sets `req.permissionScope` to `'all'`, `'department'`, or `'own'` for authorized teachers
  3. A department coordinator viewing students sees only students whose any instrument falls within their `coordinatorDepartments` -- `buildScopedFilter` adds the instrument-based filter automatically
  4. `settings` and `roles` domains return 403 for any non-admin-tier role, regardless of tenant rolePermissions customization
  5. `req.context` includes `coordinatorDepartments` (array) and `isCoordinator` (boolean) for downstream use
**Plans:** 1 plan
Plans:
- [x] 40-01-PLAN.md — requirePermission middleware and buildScopedFilter department scope extension

### Phase 41: Route Migration
**Goal**: Every route in the application uses `requirePermission(domain, action)` instead of `requireAuth(roles[])`, with no change in externally observable access patterns for existing roles
**Depends on**: Phase 40 (requirePermission middleware must be functional)
**Requirements**: PERM-06
**Success Criteria** (what must be TRUE):
  1. No route file imports or calls `requireAuth` -- all replaced with `requirePermission(domain, action)`
  2. An admin (`מנהל`) can still access every endpoint they could before migration (no regressions)
  3. A regular teacher (`מורה`) can still access their own students and schedule but cannot access admin endpoints (settings, teacher management)
  4. Super admin routes remain unchanged (they use `requireSuperAdmin`, not `requireAuth`)
**Plans:** 2 plans
Plans:
- [x] 41-01-PLAN.md — Core domain routes (student, teacher, orchestra, rehearsal, theory, bagrut, file)
- [x] 41-02-PLAN.md — Schedule, reports, admin, and settings routes

### Phase 42: Admin Provisioning
**Goal**: Super admin can create a new tenant with its first admin account in a single step -- no chicken-and-egg problem
**Depends on**: Phase 39 (DEFAULT_ROLE_PERMISSIONS needed for PROV-04)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04
**Success Criteria** (what must be TRUE):
  1. Super admin tenant creation form includes admin account fields (firstName, lastName, email) alongside tenant fields (name, slug, city)
  2. Submitting the form creates both the tenant document and the admin teacher document in a single MongoDB transaction -- if either fails, neither is created
  3. The created admin teacher has `roles: ['מנהל']`, a hashed default password, and `requiresPasswordChange: true`
  4. The created tenant document has `rolePermissions` populated with the hardcoded defaults from Phase 39
**Plans:** 1 plan
Plans:
- [x] 42-01-PLAN.md — Transactional tenant + admin creation with validation and audit

### Phase 43: Permission Configuration API & Safeguards
**Goal**: Tenant admins can customize their permission matrix per role and assign roles to staff, with safeguards preventing admin lockout
**Depends on**: Phase 40 (permission engine must resolve permissions), Phase 41 (routes must use requirePermission)
**Requirements**: CONF-03, CONF-04, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Admin can PUT to `/api/settings/roles/:roleName` to customize a role's permissions, and the changes take effect on next request from teachers with that role
  2. Admin can POST to `/api/settings/roles/:roleName/reset` to restore a role's permissions to the hardcoded defaults
  3. Attempting to remove the last `מנהל` role from a tenant returns an error and the role is not removed
  4. Attempting to downgrade `מנהל` permissions (reduce scope or remove domain access) returns an error and the permissions are unchanged
  5. PUT to `/api/teacher/:id/roles` allows admin to assign multiple roles to a teacher, with `coordinatorDepartments` accepted when `רכז/ת מחלקתי` is included
**Plans:** 2 plans
Plans:
- [x] 43-01-PLAN.md — Permission configuration API (settings/roles endpoints with admin safeguards)
- [x] 43-02-PLAN.md — Teacher role assignment endpoint with last-admin prevention

### Phase 44: Settings UI
**Goal**: Tenant admins can manage staff roles and customize the permission matrix from a visual interface in conservatory settings
**Depends on**: Phase 43 (backend APIs for role assignment and permission configuration must exist)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Settings page shows a "roles and permissions" tab with a table of all staff members, their current roles, and an edit button per row
  2. Clicking edit opens a modal with role checkboxes -- selecting `רכז/ת מחלקתי` reveals a department multi-select dropdown populated from INSTRUMENT_DEPARTMENTS
  3. Permission matrix editor shows a role dropdown, a domains-by-actions grid, and scope indicators (all/department/own) -- changes save to the backend
  4. "Reset to Default" button per role restores hardcoded defaults and refreshes the grid
  5. Admin-only domains (settings, roles) appear visually locked for non-admin roles and cannot be toggled
**Plans:** 3 plans
Plans:
- [x] 44-01-PLAN.md — RBAC constants, API service, and staff role assignment UI (UI-01, UI-02, UI-03)
- [x] 44-02-PLAN.md — Permission matrix editor with scope cycling and reset (UI-04, UI-05, UI-06)
- [ ] 44-03-PLAN.md — Visual verification checkpoint (deferred to user testing)

### Phase 45: Super Admin Tenant Admin Management
**Goal**: Super admin has a dedicated page to view all tenant admin accounts with their credentials info, and can update admin details (name, email, password reset) per tenant
**Depends on**: Phase 42 (admin provisioning creates admin accounts that this phase manages)
**Plans:** 2 plans
Plans:
- [x] 45-01-PLAN.md — Backend API for tenant admin listing, update, and password reset
- [x] 45-02-PLAN.md — Frontend tenant admin management page with edit and reset actions

### Phase 46: Bagrut UI/UX Alignment
**Goal**: Bagrut pages use the same modern FilterPanel, SearchInput, EmptyState/ErrorState, and TableSkeleton patterns as Students/Teachers/Orchestras pages, with new grade and age filters
**Depends on**: Phase 44 (modern component patterns must exist)
**Success Criteria** (what must be TRUE):
  1. Bagrut list page uses FilterPanel component instead of inline `<select>` dropdowns
  2. SearchInput component replaces the basic `<input>` search field
  3. New "student grade" (כיתה) filter allows filtering bagruts by student class/grade level
  4. New "student age" filter allows filtering bagruts by student age range
  5. Filters persist in URL search params (useSearchParams) so they survive page refresh
  6. EmptyState and ErrorState components replace custom inline empty/error markup
  7. TableSkeleton used for loading states instead of spinner
**Plans:** 1 plan
Plans:
- [x] 46-01-PLAN.md — Modernize Bagrut list with SearchInput, FilterPanel, grade/age filters, and URL persistence

### Phase 47: Department Scope Wiring & Route Migration
**Goal**: Department coordinators actually see department-scoped data, and all route files use requirePermission
**Depends on**: Phase 40 (buildScopedFilter department scope code), Phase 41 (route migration pattern)
**Requirements**: PERM-05, PERM-06
**Gap Closure:** Closes gaps from v1.7 audit
**Success Criteria** (what must be TRUE):
  1. Controllers pass `req.permissionScope` to service layer, services forward it as 4th arg to `buildScopedFilter`
  2. A department coordinator querying students sees only students with instruments in their departments (not all students, not only their own)
  3. `analytics/attendance.routes.js` and `schedule/attendance.routes.js` use `requirePermission(domain, action)` on all routes
  4. No route file in the codebase uses `requireAuth` (except super admin routes using `requireSuperAdmin`)
**Plans:** 1 plan
Plans:
- [ ] 47-01-PLAN.md — Wire scope through controllers/services and add requirePermission to attendance routes

### Phase 48: v1.7 Bug Fixes & Polish
**Goal**: Fix remaining bugs and tech debt from v1.7 audit — teacher-role bagrut crash, debug logs, navigation, cosmetics
**Depends on**: Phase 46 (Bagruts.tsx), Phase 45 (TenantAdminManagementPage)
**Gap Closure:** Closes tech debt from v1.7 audit
**Success Criteria** (what must be TRUE):
  1. Teacher-role users can load the bagrut list page without ReferenceError (teacherProfile fix)
  2. No `console.log` debugging statements in Bagruts.tsx
  3. Super admin sidebar includes navigation link to `/tenant-admins`
  4. `ROLE_COLORS` in TenantAdminManagementPage.tsx uses current role names
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 39 -> 40 -> 41 -> 42 -> 43 -> 44 -> 45 -> 46 -> 47 -> 48

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 39. Role & Permission Foundation | v1.7 | 2/2 | ✓ Complete | 2026-03-05 |
| 40. Permission Engine & Middleware | v1.7 | 1/1 | ✓ Complete | 2026-03-05 |
| 41. Route Migration | v1.7 | 2/2 | ✓ Complete | 2026-03-05 |
| 42. Admin Provisioning | v1.7 | 1/1 | ✓ Complete | 2026-03-05 |
| 43. Permission Configuration API & Safeguards | v1.7 | 2/2 | ✓ Complete | 2026-03-05 |
| 44. Settings UI | v1.7 | 2/2 | ✓ Complete | 2026-03-05 |
| 45. Super Admin Tenant Admin Management | v1.7 | 2/2 | ✓ Complete | 2026-03-06 |
| 46. Bagrut UI/UX Alignment | v1.7 | 1/1 | ✓ Complete | 2026-03-06 |
| 47. Department Scope Wiring & Route Migration | v1.7 | 0/1 | Pending | — |
| 48. v1.7 Bug Fixes & Polish | v1.7 | 0/0 | Pending | — |

**Previous milestones:** 38 phases, 92+ plans across 7 milestones (pre-v1.7) (all shipped)

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-03-06 -- Phase 47 planned (Department Scope Wiring & Route Migration)*
