# Technology Stack: Super Admin Platform Management

**Project:** Tenuto.io Backend -- Super Admin SaaS Management Features
**Researched:** 2026-02-24
**Context:** Subsequent milestone -- adding tenant cascade deletion, impersonation, enhanced analytics, and dedicated super admin dashboard to existing multi-tenant backend.

## Executive Summary

This milestone builds on a **fully validated foundation**: Node.js + Express + MongoDB native driver with 5-layer tenant isolation, existing super admin auth (`authenticateSuperAdmin` middleware), basic tenant CRUD, and a React 18 + TypeScript + Tailwind CSS frontend. The core question is not "what stack?" but "what additions/changes to the existing stack?"

**Answer: Almost nothing new.** The existing stack handles 95% of what is needed. The new features are primarily **application-layer logic** built on top of existing infrastructure. The only meaningful additions are a Recharts upgrade and potentially Tremor for the dashboard UI -- both already partially present in the frontend.

**Key Principle:** Do not add dependencies for problems the existing stack already solves. The project has MongoDB transactions (`withTransaction`), WebSocket notifications (`cascadeWebSocketService`), structured logging (`pino`), validation (`joi`), and rate limiting (`express-rate-limit`). Use them.

---

## What Already Exists (DO NOT ADD)

Before listing what to add, it is critical to document what is already in place to prevent duplicate or conflicting library additions.

### Backend -- Already Present

| Technology | Version | Relevant To | Status |
|------------|---------|-------------|--------|
| MongoDB native driver | ^6.13.0 | Tenant cascade deletion (transactions, bulk ops) | Sufficient. `withTransaction()` in `mongoDB.service.js` handles atomicity. |
| jsonwebtoken | ^9.0.2 | Impersonation tokens | Sufficient. JWT signing/verification for impersonation tokens. |
| bcryptjs | ^3.0.0 | Super admin auth | Sufficient. Already used in `super-admin.service.js`. |
| joi | ^17.13.3 | Validation for new endpoints | Sufficient. Already used in `super-admin.validation.js`. |
| pino | ^10.3.0 | Audit logging for impersonation/deletion | Sufficient. Structured JSON logging with child loggers. |
| socket.io | ^4.8.1 | Real-time progress for cascade deletion | Sufficient. `cascadeWebSocketService` already exists with admin socket tracking. |
| express-rate-limit | ^7.5.0 | Rate limiting impersonation endpoints | Sufficient. Already configured in production. |
| helmet | ^8.0.0 | Security headers | Sufficient. Already in server.js. |
| dayjs | ^1.11.13 | Date formatting in reports | Sufficient. Already in use. |
| exceljs | ^4.4.0 | Report export (analytics CSV/Excel) | Sufficient. Already used for Ministry report exports. |

### Frontend -- Already Present

| Technology | Version | Relevant To | Status |
|------------|---------|-------------|--------|
| recharts | ^2.15.0 | Analytics dashboard charts | Sufficient for line/bar/pie charts. Already a dependency. |
| chart.js + react-chartjs-2 | ^4.4.0 / ^5.2.0 | Alternative chart library | Already present but Recharts is preferred for consistency. |
| @tanstack/react-query | ^4.35.0 | Data fetching for dashboard | Sufficient. Handles caching, refetch intervals, stale-while-revalidate. |
| zustand | ^4.4.1 | Super admin state management | Sufficient. Already used for cascade deletion state. |
| react-router-dom | ^6.15.0 | Dedicated super admin routes | Sufficient. Nested routes for admin layout. |
| @radix-ui/* | various | UI primitives (dialog, dropdown, tabs, etc.) | Sufficient. Full set already installed. |
| lucide-react | ^0.279.0 | Icons | Sufficient. |
| react-hot-toast | ^2.6.0 | Notifications | Sufficient. |
| framer-motion | ^10.16.4 | Animations | Sufficient. |
| tailwind-merge + clsx + cva | various | Styling utilities | Sufficient. |
| react-window | ^1.8.11 | Virtualized lists (tenant list at scale) | Sufficient. |

---

## Recommended Additions

### Backend -- Zero New Dependencies

**No new npm packages are needed for the backend.** Every feature maps to existing capabilities:

| Feature | Implementation Using Existing Stack | Why No New Library |
|---------|-------------------------------------|-------------------|
| Tenant cascade deletion | MongoDB transactions (`withTransaction`), bulk operations (`deleteMany`), existing `cascadeDeletion.service.js` patterns | Already has transaction-based cascade deletion for students. Tenant deletion is the same pattern at a larger scope. |
| Impersonation | `jsonwebtoken` for impersonation tokens, `authenticateSuperAdmin` middleware for authorization | Standard JWT claim extension. Add `impersonating: true`, `originalAdminId`, `targetTenantId` to token payload. |
| Enhanced analytics | MongoDB aggregation pipelines (`$group`, `$match`, `$facet`, `$bucket`) | Already using aggregation in `getPlatformAnalytics()` and `getTenantsWithStats()`. |
| Audit trail | `pino` structured logging + `security_log` / `deletion_audit` collections | Already logging to `security_log` collection. Add impersonation events. |
| Progress tracking (deletion) | `socket.io` via `cascadeWebSocketService` | Already has admin socket broadcasting. Add tenant-deletion-specific events. |

#### Backend Integration Details

**1. Tenant Cascade Deletion -- Using Existing `withTransaction` + Bulk Operations**

The existing `cascadeDeletion.service.js` already demonstrates the exact pattern: snapshot, iterate related collections, clean up references, audit. For tenant deletion, the scope is larger (all collections for a tenantId) but the pattern is identical.

MongoDB native driver ^6.13.0 supports:
- `session.withTransaction()` for atomicity (already used)
- `collection.deleteMany({ tenantId }, { session })` for bulk tenant-scoped deletion
- `collection.countDocuments({ tenantId })` for impact preview
- `collection.aggregate([{ $group }])` for deletion statistics

All 19 collections in `COLLECTIONS` constant are already enumerated in `config/constants.js`. The tenant deletion service iterates this list.

**Confidence:** HIGH -- pattern already proven in existing `cascadeDeletion.service.js` and `bulkCascadeDeleteStudents()`.

**2. Impersonation -- JWT Claim Extension**

The super admin JWT already includes `type: 'super_admin'` (see `super-admin.service.js` line 55). Impersonation adds:

```javascript
// Impersonation token payload
{
  _id: targetTenantAdminId,    // The admin being impersonated
  tenantId: targetTenantId,     // The target tenant
  type: 'teacher',              // Normal teacher token type (so existing middleware works)
  impersonation: {
    active: true,
    originalAdminId: superAdminId,
    originalAdminEmail: superAdminEmail,
    startedAt: Date.now(),
  },
  version: tokenVersion,        // Matches existing token version check
}
```

This token is consumed by the existing `authenticateToken` middleware without modification -- it sees a normal teacher token. The `impersonation` claim is checked only by:
1. A new middleware that restricts write operations during impersonation (optional, configurable)
2. Audit logging that tags all actions with `impersonatedBy`

No new JWT library needed. `jsonwebtoken ^9.0.2` handles this.

**Confidence:** HIGH -- standard JWT pattern, verified with existing codebase auth flow.

**3. Enhanced Analytics -- MongoDB Aggregation Pipelines**

The existing `getPlatformAnalytics()` already aggregates across tenants. Enhanced analytics extends this with:
- `$facet` for multi-dimensional aggregation in a single query
- `$bucket` / `$bucketAuto` for histogram data (e.g., student count distribution)
- `$lookup` with `$unwind` for cross-collection analytics
- Time-series queries using `$match` with date ranges on `createdAt` fields

All supported by MongoDB native driver ^6.13.0. No additional query builder or analytics library needed.

**Confidence:** HIGH -- MongoDB aggregation framework is mature and already used in the codebase.

**4. Real-time Deletion Progress -- Existing WebSocket Infrastructure**

The `cascadeWebSocketService` already has:
- `this.adminSockets` Set for broadcasting to admin clients
- JWT-based WebSocket authentication
- Notification history
- Event emission patterns

For tenant deletion progress, add events like:
```javascript
'tenant-deletion:started'
'tenant-deletion:progress'  // { collection, deleted, total, percentComplete }
'tenant-deletion:completed'
'tenant-deletion:failed'
```

**Confidence:** HIGH -- infrastructure exists, only needs new event types.

---

### Frontend -- Minimal Additions

#### Core Framework (No New Dependencies)

| Feature | Using Existing | Notes |
|---------|---------------|-------|
| Super admin layout | react-router-dom nested routes | New `SuperAdminLayout` component with sidebar, separate from tenant `Layout` |
| Dashboard charts | recharts ^2.15.0 | AreaChart, BarChart, PieChart, ResponsiveContainer already available |
| Data tables | Custom with react-window | Already used for virtualized lists. Build a `DataTable` component. |
| State management | zustand ^4.4.1 | New `useSuperAdminStore` for global admin state (selected tenant, impersonation status) |
| Data fetching | @tanstack/react-query ^4.35.0 | New query hooks with `refetchInterval` for live dashboard data |
| Confirmations | @radix-ui/react-dialog | Already installed. Use for "Are you sure you want to delete tenant X?" |
| Tabs/Navigation | @radix-ui/react-tabs | Already installed. Use for dashboard sections. |
| Toasts/Notifications | react-hot-toast | Already installed. Use for operation feedback. |

#### One Recommended Frontend Addition

| Library | Version | Purpose | Why Add |
|---------|---------|---------|---------|
| **@tremor/react** | ^3.18.0 | Pre-built analytics dashboard components | Provides `Card`, `Metric`, `AreaChart`, `BarList`, `DonutChart`, `BadgeDelta` -- purpose-built for admin dashboards. Reduces custom component development by ~60% for the analytics views. Built on Tailwind CSS, so it integrates seamlessly with the existing styling system. |

**Rationale for Tremor:** While Recharts is already installed and could handle all chart needs, Tremor provides the _surrounding_ dashboard components -- metric cards with delta indicators, spark lines, progress bars, KPI grids -- that would otherwise require significant custom development. It is the one addition that meaningfully accelerates dashboard delivery.

**Alternative: Build without Tremor.** If minimizing dependencies is preferred, all Tremor components can be replicated with existing Radix UI primitives + Recharts + Tailwind. The tradeoff is ~2-3 extra days of UI component development. Both approaches are viable.

**Confidence:** MEDIUM -- Tremor is well-maintained and Tailwind-native, but it adds ~200KB to the bundle. Verify bundle impact before committing.

---

## Recommended Stack Summary

### Backend (Zero Additions)

```bash
# No new packages needed
# All features built on existing dependencies
```

### Frontend (One Optional Addition)

```bash
# Optional: Tremor for dashboard components
npm install @tremor/react@^3.18.0

# No other additions needed
```

---

## Feature-to-Stack Mapping

### Tenant Cascade Deletion

| Layer | Technology | Specific API/Pattern |
|-------|-----------|---------------------|
| Transaction safety | mongodb ^6.13.0 | `withTransaction()`, `session` passing to all ops |
| Bulk deletion | mongodb ^6.13.0 | `deleteMany({ tenantId }, { session })` per collection |
| Impact preview | mongodb ^6.13.0 | `countDocuments({ tenantId })` per collection, `aggregate` for stats |
| Pre-deletion snapshot | mongodb ^6.13.0 | `find({ tenantId }).toArray()` per collection, store in `deletion_snapshots` |
| Progress notification | socket.io ^4.8.1 | `cascadeWebSocketService.io.to(adminSocketId).emit()` |
| Audit trail | pino ^10.3.0 + MongoDB | Structured log + `deletion_audit` collection insert |
| API endpoint | express ^4.21.2 | `DELETE /api/super-admin/tenants/:id` with `authenticateSuperAdmin` |
| Validation | joi ^17.13.3 | Validate deletion request body (confirmation code, reason) |

### Super Admin Impersonation

| Layer | Technology | Specific API/Pattern |
|-------|-----------|---------------------|
| Token generation | jsonwebtoken ^9.0.2 | `jwt.sign({ ...impersonationPayload }, secret, { expiresIn: '1h' })` |
| Authorization check | super-admin.middleware.js | `authenticateSuperAdmin` + `requirePermission('manage_tenants')` |
| Impersonation detection | New middleware | Check `decoded.impersonation?.active` in token |
| Write restrictions | New middleware | Block mutations during impersonation (configurable) |
| Session tracking | MongoDB + `security_log` | Log impersonation start/end with timestamps |
| Audit tagging | pino ^10.3.0 | Add `impersonatedBy` field to all log entries during impersonation |
| Frontend state | zustand ^4.4.1 | `isImpersonating`, `originalAdmin`, `impersonatedTenant` in store |
| Visual indicator | React + Tailwind | Persistent banner: "You are viewing as [Tenant Name]" |

### Enhanced Analytics Dashboard

| Layer | Technology | Specific API/Pattern |
|-------|-----------|---------------------|
| Data aggregation | mongodb ^6.13.0 | `$facet`, `$group`, `$bucket`, `$sortByCount` pipelines |
| API endpoints | express ^4.21.2 | `GET /api/super-admin/analytics/tenants`, `/analytics/trends`, `/analytics/health` |
| Caching | @tanstack/react-query ^4.35.0 | `staleTime: 5 * 60 * 1000`, `refetchInterval: 60 * 1000` for live data |
| Charts | recharts ^2.15.0 | `AreaChart` (trends), `BarChart` (comparisons), `PieChart` (distribution) |
| Dashboard cards | @tremor/react (optional) OR custom | `Card`, `Metric`, `BadgeDelta` for KPIs |
| Layout | react-router-dom ^6.15.0 | Nested route: `/super-admin/*` with `SuperAdminLayout` wrapper |

### Dedicated Super Admin Frontend

| Layer | Technology | Specific API/Pattern |
|-------|-----------|---------------------|
| Routing | react-router-dom ^6.15.0 | `/super-admin` prefix, `Outlet` for nested views |
| Auth context | React Context + zustand | Separate `SuperAdminAuthContext` (not the tenant auth) |
| API layer | Custom service (like existing `apiService.js`) | `superAdminApi.ts` with typed methods |
| Socket connection | socket.io-client ^4.8.1 | Already a frontend dependency. Connect to admin namespace. |
| Table components | Custom + react-window ^1.8.11 | Virtualized tenant/admin tables |
| Forms | react-hook-form + zod | Already in frontend. Use for tenant creation/edit. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Cascade deletion | MongoDB transactions (native) | Agenda.js / BullMQ for background jobs | Overkill for 3-10 tenants with <2000 docs each. Transactions complete in seconds. Add background processing only if deletion takes >30s. |
| Analytics caching | React Query staleTime | Redis caching layer | Not needed at current scale (3-10 tenants). MongoDB aggregation with proper indexes returns in <100ms. Add Redis only when dashboard queries take >500ms. |
| Dashboard UI | Recharts + custom (or Tremor) | Ant Design Pro / Material UI Dashboard | Would require replacing the entire frontend component system. Existing Radix + Tailwind is well-established. |
| Impersonation | JWT claim extension | Separate impersonation session (cookie-based) | JWT approach works with existing auth flow. Cookie-based would require refactoring both `authenticateToken` and frontend `AuthContext`. |
| Real-time updates | Existing socket.io | Server-Sent Events (SSE) | socket.io is already integrated with auth, CORS, and admin socket tracking. SSE would duplicate infrastructure. |
| Audit logging | pino + MongoDB collection | Dedicated audit service (e.g., Elasticsearch) | Over-engineering for current scale. MongoDB + pino gives structured, queryable audit logs. Move to ELK only at 50+ tenants. |
| CSV/Excel export | exceljs (existing) | Papa Parse / csv-writer | exceljs already handles Excel generation for Ministry reports. Reuse for analytics exports. |

---

## Integration Points -- Where New Code Connects to Existing Code

These are the **specific files and functions** that the new features will extend or call. This is critical for the roadmap to understand scope.

### Tenant Cascade Deletion

| Existing File | Integration Point |
|---------------|-------------------|
| `services/mongoDB.service.js` | `withTransaction()` for atomic multi-collection deletion |
| `services/cascadeDeletion.service.js` | Pattern reference for snapshot + cascaded cleanup + audit |
| `config/constants.js` | `COLLECTIONS` object -- iterate all collection names for tenant-scoped deletion |
| `middleware/super-admin.middleware.js` | `authenticateSuperAdmin` + `requirePermission('manage_tenants')` for endpoint protection |
| `api/super-admin/super-admin.route.js` | Add `DELETE /tenants/:id` route |
| `api/super-admin/super-admin.service.js` | Add `cascadeDeleteTenant()` method |
| `api/super-admin/super-admin.validation.js` | Add `deleteTenantSchema` (confirmation code, reason) |
| `services/cascadeWebSocketService.js` | Add tenant deletion progress events |

### Impersonation

| Existing File | Integration Point |
|---------------|-------------------|
| `api/super-admin/super-admin.route.js` | Add `POST /tenants/:id/impersonate` route |
| `api/super-admin/super-admin.service.js` | Add `startImpersonation()` -- generates impersonation JWT |
| `middleware/auth.middleware.js` | `authenticateToken` -- no changes needed (impersonation token is a valid teacher token) |
| `middleware/tenant.middleware.js` | `buildContext` -- automatically picks up tenantId from impersonation token |
| `config/constants.js` | Add `SUPER_ADMIN_PERMISSIONS` entry: `'impersonate'` |

### Enhanced Analytics

| Existing File | Integration Point |
|---------------|-------------------|
| `api/super-admin/super-admin.service.js` | Extend `getPlatformAnalytics()` with richer aggregation |
| `api/super-admin/super-admin.route.js` | Add analytics sub-routes |
| `api/super-admin/super-admin.controller.js` | Add analytics controller methods |

### New Files to Create

| File | Purpose |
|------|---------|
| `api/super-admin/tenant-deletion.service.js` | Tenant cascade deletion logic (isolated from main service for clarity) |
| `api/super-admin/impersonation.service.js` | Impersonation token generation, session tracking, audit |
| `api/super-admin/analytics.service.js` | Enhanced analytics aggregation pipelines |
| `middleware/impersonation.middleware.js` | Detect impersonation, restrict writes, tag audit logs |

---

## Configuration Changes

### Backend Environment Variables

```bash
# No new env vars for cascade deletion or analytics (use existing MONGODB_URI, JWT secrets)

# Optional: Impersonation token settings
IMPERSONATION_TOKEN_EXPIRY=1h          # Short-lived (default: 1h)
IMPERSONATION_WRITE_RESTRICTIONS=true  # Block writes during impersonation (default: true)
```

### New Constants (add to `config/constants.js`)

```javascript
// Add to SUPER_ADMIN_PERMISSIONS
export const SUPER_ADMIN_PERMISSIONS = [
  'manage_tenants',
  'view_analytics',
  'billing',
  'impersonate',       // NEW: Required for impersonation
  'delete_tenants',    // NEW: Required for cascade deletion (separate from manage_tenants)
];

// Tenant deletion confirmation
export const TENANT_DELETION_CONFIRMATION_PHRASE = 'DELETE';
```

### New Collection

```javascript
// Add to COLLECTIONS constant
IMPERSONATION_LOG: 'impersonation_log',  // Tracks all impersonation sessions
```

---

## Performance Considerations

### Tenant Cascade Deletion

At current scale (14 teachers, 364 students per tenant, ~2000 documents total per tenant), a full tenant cascade deletion will complete in **<5 seconds** using MongoDB transactions. No background job queue needed.

If the platform grows to 500+ teachers and 5000+ students per tenant, consider:
1. Breaking deletion into batches (1000 docs per batch)
2. Using a simple `setTimeout`-based queue (no need for BullMQ)
3. WebSocket progress updates per batch

### Analytics Aggregation

With 3-10 tenants, aggregation queries return in <100ms. The React Query caching layer (`staleTime: 5 minutes`) ensures the dashboard does not re-query on every navigation.

If tenant count grows to 50+, add:
1. Pre-computed analytics snapshots (nightly cron via `setInterval` or a simple scheduler)
2. MongoDB views for common aggregations

---

## What NOT to Add

Explicit list of libraries that might seem useful but would be counterproductive:

| Library | Why Not |
|---------|---------|
| **BullMQ / Agenda.js** | Background job queue is overkill. Tenant deletion completes in <5s. Socket.io handles progress. |
| **Redis** | No caching layer needed at 3-10 tenants. MongoDB + React Query sufficient. |
| **Mongoose** | Project deliberately uses native driver. Adding Mongoose would create two competing data access patterns. |
| **Passport.js** | Auth is already implemented with raw JWT. Passport adds abstraction without benefit. |
| **Winston** | Pino is already configured. Winston would be redundant. |
| **Elasticsearch** | Audit log search at current scale is fine with MongoDB queries. |
| **GraphQL** | REST API is well-established with 30+ routes. GraphQL migration would be a rewrite. |
| **Next.js / Remix** | Frontend is React SPA with Vite. No server-side rendering needed for admin dashboard. |
| **Ant Design / Material UI** | Would conflict with existing Radix + Tailwind component system. |
| **AdminJS / React Admin** | Auto-generated admin panels lack the customization needed for this domain. |

---

## MongoDB Version Compatibility Note

The project uses `mongodb ^6.13.0` (native driver). Key capabilities verified:

| Feature | Minimum Driver Version | Status |
|---------|----------------------|--------|
| Multi-document transactions | 4.0+ | Available |
| `withTransaction()` helper | 4.2+ | Available, already used |
| Bulk write operations | 3.6+ | Available |
| `$facet` aggregation | 3.4+ | Available |
| `$bucket` aggregation | 3.4+ | Available |
| Change streams | 3.6+ | Available (not needed for this milestone) |
| `countDocuments()` | 4.0+ | Available, already used |
| `deleteMany()` with session | 4.0+ | Available |

**MongoDB Atlas Compatibility:** All features work on MongoDB Atlas M0 (free tier) and above. Transactions require a replica set, which Atlas provides by default.

**Confidence:** HIGH -- verified against MongoDB Node.js driver documentation and existing codebase usage.

---

## Sources

### Official Documentation
- [MongoDB Node.js Driver -- Transactions](https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/)
- [MongoDB Change Streams](https://www.mongodb.com/docs/drivers/node/current/monitoring-and-logging/change-streams/)
- [MongoDB Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)

### Community Research
- [Cascading Deletes in MongoDB: 5 Proven Patterns](https://medium.com/@mail_99211/cascading-deletes-in-mongodb-5-proven-patterns-to-achieve-rdbms-style-integrity-c8c55ef7eea9)
- [How I Built a Secure User Impersonation Feature (ReactJS + NodeJS)](https://dev.to/akash_shukla/-how-i-built-a-secure-and-clean-user-impersonation-feature-reactjs-nodejs-40kn)
- [Multi-tenancy and MongoDB](https://medium.com/mongodb/multi-tenancy-and-mongodb-5658512ed398)
- [Recharts Dashboard Best Practices](https://embeddable.com/blog/what-is-recharts)
- [React Dashboard Libraries 2025](https://www.luzmo.com/blog/react-dashboard)
- [Tremor -- Tailwind CSS Dashboard Components](https://www.tremor.so/)
- [Securing Node.js Applications in 2025](https://habtesoft.medium.com/securing-your-node-js-applications-in-2025-best-practices-for-authentication-and-authorization-0bd574ae3bb3)

### Codebase Verification (PRIMARY source)
- `services/cascadeDeletion.service.js` -- Existing cascade deletion pattern with transactions
- `services/mongoDB.service.js` -- `withTransaction()` helper already available
- `api/super-admin/super-admin.service.js` -- Existing super admin service with analytics
- `middleware/super-admin.middleware.js` -- Existing auth + permission middleware
- `middleware/auth.middleware.js` -- Existing teacher auth (impersonation tokens flow through here)
- `middleware/tenant.middleware.js` -- `buildContext` + `enforceTenant` + `stripTenantId`
- `services/cascadeWebSocketService.js` -- Existing WebSocket with admin socket tracking
- `config/constants.js` -- All collections enumerated in `COLLECTIONS`
