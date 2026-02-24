# Feature Landscape: Super Admin SaaS Platform Management

**Domain:** SaaS platform administration -- tenant lifecycle, impersonation, reporting, dedicated frontend
**Researched:** 2026-02-24
**Overall Confidence:** HIGH

---

## Table Stakes

Features users expect from a SaaS platform management layer. Missing = platform feels unfinished or operationally blind.

| Feature | Why Expected | Complexity | Depends On (Existing) |
|---------|--------------|------------|----------------------|
| **Tenant cascade deletion** | Orphaned data is a liability -- legal (GDPR "right to erasure"), operational (stale data pollutes analytics), storage cost | High | `COLLECTIONS` constant (19 collections), existing `cascadeDeletion.service.js` pattern |
| **Soft-delete with grace period** | Industry standard -- 30-day recovery window before permanent purge prevents accidental data loss | Medium | `tenant.isActive` toggle already exists |
| **Deletion impact preview** | Admin must see what will be destroyed BEFORE confirming -- SaaS table stakes for destructive operations | Medium | Existing `previewCascadeDeletion()` pattern in `cascadeDeletion.service.js` |
| **Super admin impersonation** | Support staff need to see what tenant admin sees without sharing credentials -- every SaaS platform of scale has this | High | `authenticateSuperAdmin` middleware, JWT `type: 'super_admin'` claim |
| **Impersonation audit trail** | OWASP Multi-Tenant Security Cheat Sheet explicitly requires logging who impersonated whom, when, and what they did | Medium | `security_log` collection exists |
| **Visual impersonation indicator** | User must always know they are in impersonation mode -- prevents accidental actions and satisfies compliance | Low | Frontend-only; no backend dependency |
| **Per-tenant usage dashboard** | Platform operator needs to see teacher/student counts, last login dates, subscription utilization per tenant | Medium | `getTenantsWithStats()` already fetches basic counts |
| **Subscription health monitoring** | Expiring/over-limit subscriptions need visibility -- missed renewals = revenue loss | Low | `tenant.subscription` schema already has `plan`, `endDate`, `maxTeachers`, `maxStudents` |
| **Dedicated super admin frontend** | Current bug: super admin sees regular admin UI and gets 401 errors because `tenantId` is null in context. Separate layout needed | High | `superAdminNavigation` array exists in Sidebar.tsx but routes to regular `/dashboard` |
| **Super admin dashboard** | Landing page showing platform health: total tenants, users, active/inactive, subscription distribution | Low | `getPlatformAnalytics()` API + `SuperAdminDashboard.tsx` already exist (need bug fixes) |
| **Tenant detail view** | Click a tenant to see full details: subscription info, usage stats, admin contacts, ministry report status | Medium | `getTenantWithStats()` API exists but returns minimal data |

## Differentiators

Features not expected at this scale (3-10 tenants) but valuable for operational excellence.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Ministry report status per tenant** | Platform operator can see which tenants have generated reports, completion %, and when -- unique to this domain | Medium | Requires querying `ministry_report_snapshots` per tenant; no equivalent in any competitor |
| **Tenant data export for portability** | Builds trust with conservatory directors -- "your data is yours" messaging. Also GDPR compliance | Medium | Export all tenant data to JSON/zip on demand |
| **Per-tenant subscription enforcement** | Automatically disable new teacher/student creation when subscription limits reached | Low | Check `maxTeachers`/`maxStudents` in create services; already have the fields |
| **Super admin activity log** | Who created which tenants, who toggled what, full audit of super admin actions | Low | Log all super admin mutations to `security_log` with `actor: superAdminId` |
| **Tenant onboarding wizard** | Guided flow: create tenant -> set subscription -> create admin teacher -> seed school year | Medium | Currently manual 4-step process via separate API calls |
| **Bulk tenant operations** | Toggle active, update subscription plan for multiple tenants at once | Low | Convenience for when platform grows beyond 5-10 tenants |
| **Cross-tenant analytics comparison** | Compare two tenants side-by-side: teacher/student ratios, ministry report completeness | Medium | Valuable for the platform owner to identify under-performing conservatories |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Self-service tenant signup** | Only 3-10 Israeli conservatories exist as target market -- manual onboarding is fine and safer | Super admin creates tenants manually; add wizard later if needed |
| **Billing integration (Stripe, etc.)** | No real payment processing needed yet -- subscriptions are managed manually between organizations | Track subscription dates/limits in DB; handle billing offline |
| **White-labeling per tenant** | All conservatories use same branding (Tenuto.io) -- no demand for custom logos/colors | Single brand; defer if a tenant specifically requests |
| **Multi-level admin hierarchy** | Super admin -> tenant admin is sufficient. No need for "regional admin" or "ministry admin" roles | Two-level hierarchy only |
| **Real-time tenant monitoring/alerting** | At 3-10 tenants, manual dashboard checks are sufficient | Manual refresh on dashboard; add WebSocket/push later if needed |
| **Tenant data migration between instances** | No use case -- all tenants share one database | If needed, implement as one-off script |
| **Super admin 2FA/MFA** | Important eventually but not blocking for this milestone | Defer to security hardening milestone; document as future requirement |
| **Impersonation of individual teachers** | Super admin should only impersonate tenant admin, not jump into teacher accounts directly | Impersonate tenant admin who can then view teacher data normally |

## Feature Dependencies

```
Dedicated Super Admin Frontend
  |-- Super admin dashboard (fix 401 errors, separate layout)
  |-- Tenant list view (already have API, need proper UI)
  |-- Tenant detail view (expand existing API + build UI)
  |
  |-- Tenant cascade deletion
  |     |-- Deletion impact preview (show before confirming)
  |     |-- Soft-delete with grace period (disable first, purge later)
  |     `-- Audit trail (log who deleted what)
  |
  |-- Super admin impersonation
  |     |-- Impersonation JWT with "act" claim (RFC 8693)
  |     |-- Impersonation audit trail (security_log)
  |     `-- Visual impersonation indicator (frontend banner)
  |
  `-- Enhanced reporting
        |-- Per-tenant usage dashboard (expand getTenantsWithStats)
        |-- Subscription health monitoring (expiring/over-limit alerts)
        `-- Ministry report status per tenant (query snapshots)
```

**Critical path:** Fix the 401 errors / broken super admin frontend FIRST. Everything else is useless if the super admin cannot even access the dashboard.

## MVP Recommendation

### Phase 1: Fix What's Broken (Must Do First)

1. **Separate super admin routing/layout** -- The root cause of the 401 errors. Super admin has no `tenantId`, so all tenant-scoped middleware/APIs reject requests. The frontend must detect `isSuperAdmin` and route to a completely different layout with different API calls.
2. **Super admin dashboard bug fixes** -- `SuperAdminDashboard.tsx` exists and works when API calls succeed. Fix the routing so it renders in a proper super admin layout (no tenant sidebar, no school year selector, no tenant-scoped nav items).

### Phase 2: Core Platform Management

3. **Tenant detail view** -- Click a tenant in list to see full details: subscription, usage, admin contacts, quick actions (edit, toggle, delete). Expand `getTenantWithStats()` to include more data.
4. **Tenant cascade deletion** -- The most complex feature. Soft-delete first (set `isActive: false`), then background job to purge all data across all 19 collections after grace period.
5. **Deletion impact preview** -- Before confirming deletion, show exactly what will be destroyed: X teachers, Y students, Z orchestras, W school years, etc.

### Phase 3: Impersonation

6. **Super admin impersonation** -- Issue a scoped JWT with `act` claim preserving super admin identity. Frontend switches to tenant admin view with an "impersonation mode" banner.
7. **Impersonation audit trail** -- Every action during impersonation is logged with both the super admin ID and the impersonated tenant context.
8. **Visual impersonation indicator** -- Persistent banner: "Viewing as: [Tenant Name] admin | Exit impersonation"

### Phase 4: Enhanced Reporting

9. **Per-tenant usage dashboard** -- Expand analytics: last login per tenant, teacher/student growth, subscription utilization percentage.
10. **Subscription health monitoring** -- Flag tenants approaching limits or with expired subscriptions in the tenant list view.
11. **Ministry report status per tenant** -- Show latest report generation date, completion %, number of snapshots.

### Defer to Later

- Tenant onboarding wizard -- Nice but manual process works for 3-10 tenants
- Cross-tenant analytics comparison -- Low priority until more tenants exist
- Tenant data export -- Compliance requirement eventually, not blocking now
- Bulk tenant operations -- Premature optimization at current scale

## Detailed Feature Specifications

### 1. Tenant Cascade Deletion

**What it does:** Removes ALL data belonging to a tenant across ALL collections.

**Collections to purge (19 total, 17 tenant-scoped):**
- `tenant` -- the tenant document itself
- `teacher` -- all teachers with matching `tenantId`
- `student` -- all students with matching `tenantId`
- `orchestra` -- all orchestras
- `rehearsal` -- all rehearsals
- `theory_lesson` -- all theory lessons
- `bagrut` -- all bagrut records
- `school_year` -- all school years
- `activity_attendance` -- all attendance records
- `hours_summary` -- all hours summaries
- `import_log` -- all import logs
- `ministry_report_snapshots` -- all report snapshots
- `deletion_audit` -- all deletion audits (or archive separately)
- `deletion_snapshots` -- all deletion snapshots
- `security_log` -- tenant-scoped security logs (keep super admin logs)
- `migration_backups` -- tenant-scoped backups
- `integrityAuditLog` -- tenant-scoped integrity logs
- `integrityStatus` -- tenant-scoped integrity status

**NOT deleted:** `super_admin` collection (never tenant-scoped).

**Implementation pattern:**
1. **Preview** -- Count documents per collection for the tenant, return summary
2. **Soft delete** -- Set `tenant.isActive = false`, `tenant.markedForDeletion = true`, `tenant.deletionScheduledAt = Date.now() + 30 days`
3. **Grace period** -- 30 days during which soft-delete can be reversed
4. **Hard delete** -- Background job or manual trigger. Uses MongoDB session/transaction for atomicity. Deletes collection by collection with progress tracking.
5. **Audit** -- Create immutable record in a `platform_audit` or similar non-tenant-scoped collection

**Complexity: HIGH** -- Requires touching every collection, transaction support, background job, progress tracking, and error recovery for partial failures.

### 2. Super Admin Impersonation

**What it does:** Super admin temporarily "becomes" a tenant admin to see the platform from their perspective, debug issues, or perform support actions.

**JWT structure (following RFC 8693 "act" claim pattern):**
```json
{
  "_id": "<super-admin-id>",
  "type": "impersonation",
  "tenantId": "<target-tenant-id>",
  "impersonatedRole": "admin",
  "act": {
    "sub": "<super-admin-id>",
    "type": "super_admin",
    "email": "super@tenuto.io"
  },
  "iat": 1708790400,
  "exp": 1708794000
}
```

**Key design decisions:**
- Short-lived tokens (1 hour max, no refresh) -- limits blast radius
- Read-write access by default (super admin is troubleshooting) but could restrict to read-only if desired
- Every request during impersonation includes both `userId` (super admin) and `actingAs` context
- Backend middleware detects `type: 'impersonation'` and builds `req.context` with the target tenant's `tenantId`
- Existing `buildContext` middleware needs modification: when token type is `impersonation`, look up the target tenant admin instead of requiring a teacher record

**Security requirements (per OWASP Multi-Tenant Security Cheat Sheet):**
- Log initiation: who started impersonation, which tenant, timestamp
- Log all mutations during impersonation with `impersonatedBy` field
- Log termination: when impersonation ended (explicit exit or token expiry)
- Cannot impersonate another super admin
- Cannot create/delete super admins while impersonating

**Frontend behavior:**
- Persistent banner at top of page: "[Shield Icon] Impersonation Mode: Viewing as [Tenant Name] | [Exit Button]"
- Banner uses a distinct color (amber/orange) that cannot be confused with normal UI
- "Exit Impersonation" clears impersonation token, restores original super admin token
- All normal tenant admin functionality works (view students, teachers, reports, etc.)

**Complexity: HIGH** -- Requires JWT restructuring, middleware changes, frontend routing changes, and careful audit logging.

### 3. Enhanced Reporting

**Per-tenant usage dashboard -- expand `getTenantsWithStats()` to include:**
- Teacher count (active) -- already have
- Student count (active) -- already have
- Orchestra/ensemble count
- Last admin login date
- Subscription utilization: `teacherCount / maxTeachers * 100`, `studentCount / maxStudents * 100`
- Ministry report: latest snapshot date, completion percentage
- Data quality: % teachers with complete HR data (has `idNumber`, `degree`, `instruments[]`)

**Subscription health -- computed fields on tenant list:**
- "Expiring soon" flag: subscription `endDate` within 30 days
- "Over limit" flag: teacher or student count exceeds subscription max
- "Inactive" flag: tenant `isActive === false`
- Sort/filter by health status

**Ministry report status -- query `ministry_report_snapshots` per tenant:**
- Last report generation date
- Completion percentage of most recent snapshot
- Number of snapshots this school year
- "Never generated" flag for tenants with zero snapshots

**Complexity: MEDIUM** -- Mostly aggregation queries on existing data. The ministry report status query is the most complex (cross-collection join).

### 4. Dedicated Super Admin Frontend

**The root problem:** When a super admin logs in, the frontend stores `isSuperAdmin: true` and `tenantId: null` on the user object. But the app's routing, sidebar, and data fetching all assume a `tenantId` exists. This causes:
- 401 errors when tenant-scoped APIs are called without `tenantId`
- Wrong sidebar items (admin nav instead of super admin nav)
- School year selector tries to fetch school years with no tenant context
- Dashboard tries to load tenant-scoped analytics

**The fix: Separate super admin shell**

The frontend needs a completely separate "shell" or layout for super admin users:
- Different route prefix (e.g., `/platform/*` or detect from user type)
- Different sidebar (the `superAdminNavigation` array already exists but routes to wrong pages)
- No school year selector, no tenant context provider
- Uses `superAdminService` API calls exclusively (all `/api/super-admin/*` endpoints)

**Pages needed:**

| Page | Description | Backend API |
|------|-------------|-------------|
| `/platform/dashboard` | Platform stats + tenant list (existing `SuperAdminDashboard.tsx` with fixes) | `GET /super-admin/analytics` + `GET /super-admin/tenants` |
| `/platform/tenants` | Full tenant list with search, filter by status/plan, sort | `GET /super-admin/tenants` |
| `/platform/tenants/:id` | Tenant detail: subscription, usage, ministry status, actions (edit, delete, impersonate) | `GET /super-admin/tenants/:id` (expanded) |
| `/platform/tenants/new` | Create tenant form | `POST /super-admin/tenants` |
| `/platform/tenants/:id/edit` | Edit tenant/subscription form | `PUT /super-admin/tenants/:id` + `PUT /super-admin/tenants/:id/subscription` |
| `/platform/admins` | Super admin management (list, create, edit) | `GET/POST/PUT /super-admin/admins/*` |
| `/platform/settings` | Platform-level settings (if any) | Future |

**Complexity: HIGH** -- Requires significant frontend work: new layout component, new routing, new pages. Backend is mostly done (APIs exist).

## Complexity Assessment

| Complexity Level | Features | Timeline Estimate |
|------------------|----------|-------------------|
| **Low** (1-3 days each) | Subscription health monitoring, Super admin activity log, Visual impersonation indicator, Per-tenant subscription enforcement, Super admin dashboard bug fixes | 1-2 weeks total |
| **Medium** (3-7 days each) | Tenant detail view, Deletion impact preview, Impersonation audit trail, Per-tenant usage dashboard, Ministry report status, Soft-delete with grace period | 2-3 weeks total |
| **High** (7-14 days each) | Tenant cascade deletion (full purge), Super admin impersonation (JWT + middleware + frontend), Dedicated super admin frontend (new layout + pages) | 3-5 weeks total |

**Total estimated effort: 6-10 weeks** depending on how much parallelism is possible between backend and frontend work.

## Sources

### SaaS Platform Management Patterns
- [SaaS Identity and Access Management Best Practices - LoginRadius](https://www.loginradius.com/blog/engineering/saas-identity-access-management)
- [Best Practices for Multi-Tenant Authorization - Permit.io](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization)
- [The 2026 Guide: Best Practices for SaaS Management - BetterCloud](https://www.bettercloud.com/monitor/best-practices-for-saas-management/)
- [SaaS Multitenancy: Components, Pros and Cons and 5 Best Practices - Frontegg](https://frontegg.com/blog/saas-multitenancy)

### Tenant Deletion & Data Lifecycle
- [Cascading Deletes in MongoDB: 5 Proven Patterns - Medium](https://medium.com/@mail_99211/cascading-deletes-in-mongodb-5-proven-patterns-to-achieve-rdbms-style-integrity-c8c55ef7eea9)
- [Data Retention, Deletion, and Destruction in Microsoft 365 - Microsoft](https://learn.microsoft.com/en-us/compliance/assurance/assurance-data-retention-deletion-and-destruction-overview)
- [Deleting Personal Data - GDPR for SaaS](https://gdpr4saas.eu/deleting-personal-data)
- [SaaS Agreements: Data Retention and Deletion - Bodle Law](https://www.bodlelaw.com/saas/saas-agreements-data-retention-and-deletion)

### Impersonation & Security
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [Implementing Impersonation with SSO and JWT - Medium/Kameleoon](https://medium.com/kameleoon/implementing-impersonation-with-sso-and-jwt-95ce2eb60419)
- [RFC 8693: OAuth 2.0 Token Exchange (act claim)](https://www.rfc-editor.org/rfc/rfc8693.html)
- [Impersonation Approaches with OAuth and OpenID Connect - Curity](https://curity.io/resources/learn/impersonation-flow-approaches/)
- [Cross-Tenant Impersonation: Prevention and Detection - Okta](https://sec.okta.com/articles/2023/08/cross-tenant-impersonation-prevention-and-detection/)
- [User Impersonation - Descope Documentation](https://docs.descope.com/user-impersonation)

### Dashboard & Reporting Patterns
- [How to Effectively Monitor Multi-Tenant Operational Health - AWS SaaS Lens](https://wa.aws.amazon.com/saas.question.OPS_1.en.html)
- [Tenant Operations - SaaS Architecture](https://www.saas-architecture.com/dimensions/tenant-operations.html)
- [SaaS Dashboard: Metrics, KPIs, and Examples - Klipfolio](https://www.klipfolio.com/resources/dashboard-examples/saas)
