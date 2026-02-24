# Project Research Summary

**Project:** Tenuto.io Backend — v1.1 Super Admin Platform Management
**Domain:** Multi-tenant SaaS platform administration for conservatory management
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

The v1.1 Super Admin Platform Management milestone extends the existing multi-tenant architecture with platform-level controls: tenant cascade deletion, super admin impersonation, enhanced cross-tenant reporting, and a dedicated super admin frontend dashboard. Research reveals a critical insight: **95% of requirements are already satisfied by the existing stack.** The Node.js + Express + MongoDB native driver foundation, combined with existing cascade deletion patterns, JWT authentication, Socket.io WebSocket infrastructure, and React 18 + TypeScript frontend, handles all core needs.

The recommended approach is to **extend existing patterns, not add new technologies.** Tenant cascade deletion follows the proven transaction-based pattern in `services/cascadeDeletion.service.js`. Super admin impersonation uses scoped JWT tokens that pass through the existing `authenticateToken` middleware without modification. Cross-tenant analytics use MongoDB aggregation pipelines without caching (3-10 tenants make real-time aggregation faster than cache complexity). The frontend separation requires no new libraries — just separate routing and localStorage namespaces.

**Key risks are architectural, not technical:** (1) Missing collections during tenant cascade deletion — the student cascade touches 7 collections; tenant deletion must handle all 19. (2) Super admin token incompatibility — `authenticateToken` looks up teachers, not super admins, requiring an impersonation token strategy. (3) Two incompatible cascade deletion systems exist in the codebase — consolidation is mandatory before building tenant deletion. (4) Frontend auth storage collision between super admin and regular admin tokens. Mitigation for all risks is well-defined in research; execution discipline is critical.

## Key Findings

### Recommended Stack

The existing stack is sufficient. **Zero backend dependencies needed.** Frontend needs one optional addition: Tremor for dashboard UI components (reduces custom component development by ~60%) — but this is optional; the same UI can be built with existing Radix + Recharts + Tailwind.

**Core technologies (already present):**
- **MongoDB native driver ^6.13.0:** Handles tenant cascade deletion via `withTransaction()`, cross-tenant aggregation via `$facet`/`$group`, and all data operations. Multi-document transactions work on MongoDB Atlas M0 free tier.
- **jsonwebtoken ^9.0.2:** Generates impersonation tokens with dual-identity claims (`_id`: teacher being impersonated, `impersonatedBy`: super admin identity). No new library needed.
- **socket.io ^4.8.1:** Real-time deletion progress notifications via existing `cascadeWebSocketService` admin socket infrastructure.
- **pino ^10.3.0:** Audit logging for impersonation sessions and tenant deletions, integrating with existing `security_log` collection.
- **Recharts ^2.15.0 (frontend):** Analytics dashboard charts. Already installed; no upgrade needed.
- **@tanstack/react-query ^4.35.0 (frontend):** Data fetching with `staleTime: 5min` and `refetchInterval: 60s` for live dashboard data. Already installed.
- **Zustand ^4.4.1 (frontend):** Super admin state management (impersonation status, selected tenant). Already used for cascade deletion state.

**What NOT to add:**
- BullMQ/Agenda.js (background jobs) — tenant deletion completes in <5s via transaction; overkill.
- Redis (caching) — MongoDB + React Query sufficient for 3-10 tenants; add only at 50+ tenants.
- Mongoose (ORM) — project deliberately uses native driver; adding Mongoose creates competing patterns.
- Elasticsearch (audit search) — MongoDB queries sufficient at current scale.
- GraphQL — REST API well-established; GraphQL would be a rewrite.

### Expected Features

**Must have (table stakes):**
- **Tenant cascade deletion** — Legal (GDPR "right to erasure"), operational (stale data pollutes analytics), storage cost. Industry standard. Requires preview before confirm, grace period (30 days soft-delete), full audit trail.
- **Super admin impersonation** — Support staff must see what tenant admin sees without sharing credentials. Every SaaS platform of scale has this. OWASP Multi-Tenant Security Cheat Sheet explicitly requires audit trail: who impersonated whom, when, what actions.
- **Dedicated super admin frontend** — Current bug: super admin sees regular admin UI and gets 401 errors because `tenantId` is null. Separate layout mandatory (no tenant sidebar, no school year selector, super admin routes only).
- **Per-tenant usage dashboard** — Platform operator needs teacher/student counts, last login dates, subscription utilization. Basic version exists (`getTenantsWithStats()`); needs expansion.
- **Subscription health monitoring** — Expiring/over-limit subscriptions need visibility. Missed renewals = revenue loss. Schema already has `plan`, `endDate`, `maxTeachers`, `maxStudents` fields.
- **Deletion impact preview** — Admin must see what will be destroyed BEFORE confirming. SaaS table stakes for destructive operations.

**Should have (competitive differentiators):**
- **Ministry report status per tenant** — Unique to this domain. Platform operator sees which tenants generated reports, completion percentage, when. Queries `ministry_report_snapshots` per tenant.
- **Tenant data export for portability** — Builds trust ("your data is yours"), GDPR compliance. Export all tenant data to JSON/zip.
- **Super admin activity log** — Who created tenants, who toggled what, full audit of super admin actions. Log to `security_log` with `actor: superAdminId`.
- **Tenant onboarding wizard** — Guided flow: create tenant → set subscription → create admin teacher → seed school year. Currently manual 4-step process.

**Defer (v2+):**
- Self-service tenant signup — Only 3-10 Israeli conservatories exist; manual onboarding is fine.
- Billing integration (Stripe) — Subscriptions managed manually between organizations; no payment processing needed.
- White-labeling per tenant — All conservatories use same branding; no demand.
- Multi-level admin hierarchy — Two levels (super admin → tenant admin) sufficient.
- Real-time monitoring/alerting — Manual dashboard checks sufficient at 3-10 tenants.
- Super admin 2FA/MFA — Important eventually; defer to security hardening milestone.

### Architecture Approach

The super admin subsystem operates as a **parallel auth path** alongside tenant-scoped auth. It does NOT go through `authenticateToken` → `buildContext` → `enforceTenant`. This design is correct and must be preserved. New features extend this parallel path.

**Major components:**

1. **Tenant Deletion Service** (`services/tenantDeletion.service.js`) — Follows the transaction-based pattern from `cascadeDeletion.service.js` (NOT the collection-based `cascadeDeletionService.js`). Pre-deletion snapshot stored in `tenant_deletion_snapshots` collection (platform-level, not tenant-scoped). Deletion order: leaf collections first (attendance, hours_summary, import_log), then cross-referenced (rehearsal, theory_lesson, bagrut, orchestra, student), then core (teacher, school_year), finally tenant record. Uses MongoDB session with `withTransaction()` for atomicity.

2. **Impersonation Service** (`services/impersonation.service.js`) — Issues scoped JWT tokens with dual-identity claims. Token structure: `_id` (target tenant admin teacher ID), `tenantId` (target tenant), `impersonatedBy` (super admin identity), `impersonation: true`, short expiry (30 min, no refresh). Token passes through existing `authenticateToken` middleware unchanged because `_id` references a real teacher. Middleware detects `impersonatedBy` claim and sets `req.impersonatedBy` for audit logging. Read-only by default via new `impersonation.middleware.js` that blocks POST/PUT/DELETE.

3. **Platform Reports Service** (`services/platformReports.service.js`) — Cross-tenant aggregation pipelines using MongoDB `$group`, `$facet`, `$lookup`. No tenantId filter. Runs under `authenticateSuperAdmin` only. No caching layer (3-10 tenants = <1s query time). Reports: usage overview (counts per tenant), ministry status (join with `ministry_report_snapshots`), subscription health (expiring/over-limit flags), growth trends (time-series on `createdAt`), attendance rates.

4. **Impersonation Middleware** (`middleware/impersonation.middleware.js`) — Two guards: `impersonationReadOnly` (blocks writes for impersonation tokens) and `blockImpersonation` (blocks sensitive ops entirely). Applied globally after `authenticateToken` on tenant-scoped routes.

### Critical Pitfalls

1. **Tenant cascade deletion will miss collections** — Student cascade touches 7 collections; tenant deletion must handle all 19 in `COLLECTIONS` constant plus audit trails. The codebase has TWO cascade deletion systems with incompatible interfaces (`cascadeDeletion.service.js` vs `cascadeDeletionService.js`). Prevention: Build deletion manifest from `COLLECTIONS` constant, consolidate to transaction-based system BEFORE building tenant deletion, add post-deletion verification step.

2. **Super admin token incompatible with tenant-scoped middleware** — `authenticateToken` looks up `teacher` collection; super admin tokens reference `super_admin` collection. Result: 401 `USER_NOT_FOUND`. Prevention: Use impersonation token strategy — issue JWT with teacher `_id` + `impersonatedBy` claim. Existing middleware works unchanged.

3. **Cross-tenant reports trigger tenant guard exceptions** — `requireTenantId()` and `buildScopedFilter()` throw errors when tenantId is null. Cross-tenant analytics intentionally omit tenantId. Prevention: Add `isSuperAdmin` flag to context, modify `buildScopedFilter()` to allow null tenantId when `isSuperAdmin === true`. Do NOT modify `requireTenantId()` (must stay strict).

4. **Two incompatible cascade deletion systems** — Different session creation, entry signatures, soft-delete fields, audit collections, attendance handling (archive vs hard-delete). Prevention: Consolidate to `cascadeDeletion.service.js` (transaction-based, uses `requireTenantId` guard, archives instead of hard-deleting, has restoration support).

5. **Frontend auth storage collision** — Regular admin and super admin tokens stored in same localStorage keys. Super admin login overwrites regular session. Impersonation token replaces super admin token; when impersonation expires, super admin must re-login. Prevention: Separate localStorage namespaces (`tenuto_sa_*` for super admin, `tenuto_impersonation_*` for impersonation). Preserve super admin token during impersonation. Token-type-based routing.

## Implications for Roadmap

Based on research, suggested 4-phase structure:

### Phase 1: Foundation Hardening & Impersonation
**Rationale:** Fix what's broken first. The super admin frontend currently has 401 errors due to token/context incompatibility. Cannot build features on broken auth. Impersonation is the bridge between super admin auth path and tenant-scoped data access — every subsequent feature depends on this.

**Delivers:**
- Consolidated cascade deletion service (remove duplicate system)
- Super admin impersonation (JWT generation, audit trail, frontend banner)
- Impersonation middleware (read-only guard, sensitive ops block)
- Frontend auth namespace separation (localStorage keys, token-type routing)
- Super admin token refresh endpoint

**Addresses:**
- Pitfall 2 (token incompatibility)
- Pitfall 4 (two cascade systems)
- Pitfall 5 (auth storage collision)
- Pitfall 12 (missing refresh endpoint)

**Uses:**
- `jsonwebtoken` for dual-identity tokens
- `pino` + `security_log` for impersonation audit
- Existing `authenticateToken` middleware (no changes)

**Research flag:** SKIP — patterns are well-defined in research. Execution is straightforward.

---

### Phase 2: Tenant Lifecycle Management
**Rationale:** With impersonation working, super admin can now view tenant data. Next priority is tenant CRUD, especially deletion (complex, high-risk). Deletion must come before frontend dashboard because dashboard shows deletion actions.

**Delivers:**
- Tenant deletion service with full cascade (19 collections)
- Deletion manifest (which collections, which strategy per collection)
- Deletion impact preview (show counts before confirm)
- Two-phase deletion (deactivate → grace period → purge)
- Post-deletion verification step
- `tenant.isActive` wired into `enforceTenant` middleware (gate data access)
- Session invalidation on tenant deactivation

**Addresses:**
- Pitfall 1 (missing collections)
- Pitfall 6 (active sessions survive deactivation)
- Pitfall 11 (toggleTenantActive doesn't gate access)
- Pitfall 8 (hours_summary stale cache)
- Pitfall 14 (orphaned file storage)

**Uses:**
- MongoDB `withTransaction()` for atomic deletion
- Socket.io for real-time deletion progress
- `tenant_deletion_snapshots` collection (new)
- Pattern from `cascadeDeletion.service.js` (consolidated in Phase 1)

**Avoids:**
- Hard delete without snapshot (anti-pattern 5 from PITFALLS.md)
- Modifying `enforceTenant` to bypass tenant checks (anti-pattern 1)

**Research flag:** SKIP — deletion pattern verified in existing code. Manifest is enumeration task, not research.

---

### Phase 3: Cross-Tenant Analytics & Reporting
**Rationale:** Tenant management (Phase 2) establishes platform control. Reporting provides visibility into platform health. Must come after Phase 1 (needs `isSuperAdmin` context flag) but before Phase 4 (dashboard UI consumes these APIs).

**Delivers:**
- Platform reports service (6 report types)
- Cross-tenant context factory (`buildCrossTenantContext()`)
- Modified `buildScopedFilter()` to accept `isSuperAdmin` flag
- Combined dashboard payload endpoint (`GET /api/super-admin/dashboard`)
- Individual report endpoints (`GET /api/super-admin/reports/:type`)
- Subscription health monitoring (expiring/over-limit flags)
- Ministry report status per tenant

**Addresses:**
- Pitfall 3 (tenant guard exceptions)
- Pitfall 9 (aggregation performance at scale — design cacheable from start)

**Uses:**
- MongoDB `$facet`, `$group`, `$bucket` aggregation
- No caching layer (3-10 tenants, <1s queries)
- Existing `getPlatformAnalytics()` as base (extend, don't replace)

**Implements:**
- Report types: usage overview, ministry status, subscription health, growth trends, attendance rates, active usage

**Research flag:** SKIP — MongoDB aggregation patterns well-documented. Queries are domain-specific but technically standard.

---

### Phase 4: Super Admin Frontend Dashboard
**Rationale:** All backend APIs are ready (impersonation, deletion, reporting). Final phase is frontend integration — separate layout, routing, dashboard UI, tenant management pages, impersonation controls.

**Delivers:**
- Separate super admin layout (no tenant sidebar, no school year selector)
- Super admin routing (`/platform/*` prefix or token-type detection)
- Dashboard page (platform stats + tenant list)
- Tenant detail page (subscription, usage, ministry status, actions)
- Tenant management UI (create, edit, delete with preview)
- Impersonation UI (start impersonation, visual banner, exit)
- Super admin nav items routing to correct pages

**Addresses:**
- Missing super admin frontend (table stakes)
- Frontend routing collision (related to Pitfall 5)
- 401 errors on super admin dashboard (root problem from executive summary)

**Uses:**
- Recharts for dashboard charts
- @tanstack/react-query with `staleTime: 5min`, `refetchInterval: 60s`
- Zustand for super admin state (`isImpersonating`, `selectedTenant`)
- @radix-ui for dialogs, tabs, dropdowns (deletion confirmation, report sections)
- Optional: Tremor for dashboard cards/metrics (or build custom with existing Radix + Tailwind)

**Complexity:** HIGH — requires new layout component, new routing architecture, 5-6 new pages, impersonation state management, deletion confirmation flows.

**Research flag:** NEEDS RESEARCH — If Tremor is used, research component API and integration with existing Tailwind setup. If building custom, research dashboard layout patterns for multi-metric views.

---

### Phase Ordering Rationale

1. **Foundation first (Phase 1):** Broken auth blocks everything. Impersonation is the auth bridge to tenant data. Consolidating cascade systems prevents building on wrong foundation.

2. **Deletion second (Phase 2):** Highest risk feature. Must be battle-tested before frontend exposes it to super admins. Complex enough to warrant isolated development.

3. **Reporting third (Phase 3):** Depends on `isSuperAdmin` context flag from Phase 1. Dashboard UI (Phase 4) consumes reporting APIs — must exist first.

4. **Frontend last (Phase 4):** Consumes all backend APIs. Pure presentation layer. Can be developed in parallel with Phase 3 but not deployed until Phase 3 completes.

**Dependency chain:**
- Phase 2 depends on Phase 1 (consolidated cascade pattern)
- Phase 3 depends on Phase 1 (`isSuperAdmin` context flag)
- Phase 4 depends on Phases 1, 2, 3 (all backend APIs)

**Integration risks addressed:**
- Super admin impersonating then deleting that same tenant → Impersonation token references deleted tenant. Mitigation: Block deletion during active impersonation session (check `impersonation_sessions` before deletion).
- Impersonation token has tenantId, but report queries need no tenantId → Two separate contexts. Impersonation uses regular tenant context. Reports use cross-tenant context. No collision.
- "Exit impersonation" must restore super admin context without reload → Frontend clears `tenuto_impersonation_*` localStorage, reverts to `tenuto_sa_*` token, invalidates React Query cache for tenant-scoped data.

### Research Flags

**Phases needing research during planning:**
- **Phase 4 (Frontend Dashboard):** If Tremor is used, research component API, bundle size impact (~200KB), integration with existing form components. If building custom dashboard cards, research layout patterns for KPI grids with Recharts + Tailwind.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Impersonation):** JWT patterns, middleware composition, localStorage namespacing — all well-documented. Execution is straightforward.
- **Phase 2 (Deletion):** Transaction-based cascade deletion pattern proven in existing codebase. Manifest is enumeration, not research.
- **Phase 3 (Reporting):** MongoDB aggregation framework mature and already used in codebase. Queries are domain-specific but technically standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | 95% of needs met by existing stack. No new backend dependencies. Optional frontend addition (Tremor) has clear alternative (build custom). |
| Features | **HIGH** | Table stakes verified against SaaS platform management best practices (OWASP, LoginRadius, Frontegg, Permit.io). Differentiators unique to domain (ministry reports). Anti-features explicitly defined. |
| Architecture | **HIGH** | Based on direct codebase analysis (11+ collections, existing cascade systems, 5-layer tenant isolation, super admin auth path). Patterns proven in production (transaction-based cascade, JWT auth, WebSocket notifications). |
| Pitfalls | **HIGH** | Critical pitfalls identified through codebase analysis (two cascade deletion systems, token lookup in teacher collection, tenant guard strictness). CVE-2025-55241 validates impersonation token risks. |

**Overall confidence:** **HIGH**

### Gaps to Address

**Tremor vs custom dashboard components:**
- Research shows Tremor accelerates dashboard development (~60% reduction in custom component code) but adds ~200KB to bundle.
- Gap: No decision yet on whether bundle size is acceptable. Validation needed: measure current frontend bundle size, assess 200KB impact percentage.
- How to handle: Phase 4 planning should include bundle analysis. If bundle impact >10%, defer Tremor and build custom components.

**Impersonation read-only enforcement granularity:**
- Research recommends read-only by default with per-operation overrides for safe mutations (e.g., logout).
- Gap: Which operations should be allowed during impersonation? Research didn't define allowlist.
- How to handle: During Phase 1 planning, enumerate safe endpoints. Conservative start: read-only for all mutations except `POST /api/auth/logout`. Expand if support use cases require writes.

**Cross-tenant report caching threshold:**
- Research says no caching at 3-10 tenants (<1s queries). Add caching at 50+ tenants.
- Gap: What if tenant count is 15-30? Gray area.
- How to handle: Phase 3 should include performance benchmarks with 30 tenants (seed test data). If queries take >3s, add caching in same phase. Otherwise defer.

**School year auto-creation during impersonation:**
- Pitfall 7 identifies risk: `addSchoolYearToRequest` middleware creates school year for impersonated tenant if missing.
- Gap: Should impersonation skip school year middleware entirely, or just skip auto-creation?
- How to handle: Phase 1 planning should decide. Recommendation: skip auto-creation, not entire middleware (tenant might legitimately have school year configured).

## Sources

### Primary (HIGH confidence)
- **Tenuto.io Backend codebase** — Direct analysis of 19 collections, existing `cascadeDeletion.service.js` and `cascadeDeletionService.js` patterns, `authenticateToken` / `buildContext` / `enforceTenant` middleware chain, `super-admin.service.js` + `super-admin.middleware.js`, `COLLECTIONS` constant, WebSocket infrastructure. PRIMARY source for all architectural decisions.
- [MongoDB Node.js Driver Documentation — Transactions](https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/) — `withTransaction()` usage, session handling, multi-document atomicity.
- [MongoDB Aggregation Pipeline Manual](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) — `$facet`, `$group`, `$bucket` patterns.
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — Impersonation audit requirements, tenant isolation best practices.

### Secondary (MEDIUM confidence)
- [Cascading Deletes in MongoDB: 5 Proven Patterns](https://medium.com/@mail_99211/cascading-deletes-in-mongodb-5-proven-patterns-to-achieve-rdbms-style-integrity-c8c55ef7eea9) — Transaction-based vs queue-based cascade patterns. Verified against existing codebase.
- [Implementing Impersonation with SSO and JWT](https://medium.com/kameleoon/implementing-impersonation-with-sso-and-jwt-95ce2eb60419) — Dual-identity token structure, `act` claim pattern (RFC 8693).
- [SaaS Identity and Access Management Best Practices - LoginRadius](https://www.loginradius.com/blog/engineering/saas-identity-access-management) — Multi-tenant auth patterns.
- [Best Practices for Multi-Tenant Authorization - Permit.io](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization) — Cross-tenant query scoping.
- [Tremor — Tailwind CSS Dashboard Components](https://www.tremor.so/) — Dashboard component library evaluation.
- [Recharts Dashboard Best Practices](https://embeddable.com/blog/what-is-recharts) — Chart composition patterns.

### Tertiary (LOW confidence)
- [CVE-2025-55241: Actor Token Impersonation Vulnerability](https://dirkjanm.io/obtaining-global-admin-in-every-entra-id-tenant-with-actor-tokens/) — Real-world JWT impersonation attack. Validates security concerns for impersonation tokens.
- [Cross-Subdomain JWT Account Takeover](https://deepstrike.io/blog/cross-subdomain-jwt-account-take-over) — Penetration test writeup. Relevant to localStorage namespace separation.

---

**Research completed:** 2026-02-24
**Ready for roadmap:** Yes
**Files synthesized:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
