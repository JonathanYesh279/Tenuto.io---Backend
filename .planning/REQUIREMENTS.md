# Requirements: Tenuto.io — Super Admin Platform Management

**Defined:** 2026-02-24
**Core Value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data, every query is tenant-scoped, and Ministry reporting is accurate.

## v1.1 Requirements

Requirements for Super Admin Platform Management milestone. Each maps to roadmap phases.

### Bug Fixes & Foundation

- [x] **FIX-01**: Super admin dashboard no longer triggers 401 errors on tenant-scoped endpoints (school-year, student, teacher, orchestra, etc.)
- [x] **FIX-02**: Super admin has a dedicated frontend layout with its own sidebar, routing, and no school year selector or tenant-scoped navigation
- [ ] **FIX-03**: Deactivating a tenant via super admin blocks that tenant's users from logging in (tenant.isActive check in auth middleware)
- [x] **FIX-04**: Super admin can refresh their access token via `POST /api/super-admin/auth/refresh` without re-authenticating

### Tenant Lifecycle Management

- [ ] **TLCM-01**: Super admin can preview deletion impact (document counts per collection) before confirming tenant deletion
- [ ] **TLCM-02**: Super admin can soft-delete a tenant (mark for deletion with configurable grace period) before permanent purge
- [ ] **TLCM-03**: Super admin can permanently delete a tenant and ALL its data across all collections in a single atomic transaction with pre-deletion snapshot
- [ ] **TLCM-04**: All super admin mutations (create, update, delete, toggle-active, impersonate) are logged to an audit trail with actor identity and timestamp

### Impersonation

- [ ] **IMPR-01**: Super admin can impersonate a tenant's admin by receiving a scoped JWT that passes through regular auth middleware as that tenant's admin
- [ ] **IMPR-02**: Every action during impersonation is logged with both the super admin identity and the impersonated tenant context
- [ ] **IMPR-03**: Frontend displays a persistent visual banner during impersonation showing tenant name and an "Exit" button that restores super admin context

### Platform Reporting

- [ ] **REPT-01**: Super admin can view per-tenant usage statistics (teacher/student/orchestra counts, last admin login, subscription utilization %)
- [ ] **REPT-02**: Super admin can view Ministry report status per tenant (latest snapshot date, completion %, number of snapshots)
- [ ] **REPT-03**: Tenant list displays subscription health alerts (expiring soon, over-limit, inactive flags)
- [ ] **REPT-04**: Dashboard loads via a single combined API endpoint returning overview cards, tenant health list, and alerts

### Super Admin Frontend

- [ ] **SAUI-01**: Super admin dashboard page shows platform overview cards (total tenants, users, subscription breakdown) and tenant list with inline actions
- [ ] **SAUI-02**: Tenant detail page shows full tenant info (subscription, usage stats, ministry status) with edit, delete, and impersonate actions
- [ ] **SAUI-03**: Tenant create/edit forms work correctly via super admin frontend
- [ ] **SAUI-04**: Super admin management page (list, create, edit super admins) works via dedicated UI

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Subscription Enforcement

- **SENF-01**: System automatically blocks new teacher creation when tenant exceeds maxTeachers subscription limit
- **SENF-02**: System automatically blocks new student creation when tenant exceeds maxStudents subscription limit

### Advanced Security

- **ASEC-01**: Super admin 2FA/MFA for login
- **ASEC-02**: Seed endpoint disabled in production environment
- **ASEC-03**: Impersonation read-only guard (middleware that blocks write operations during impersonation)

### Enhanced Analytics

- **EANL-01**: Cross-tenant analytics comparison (side-by-side tenant metrics)
- **EANL-02**: Growth trends time-series report (teacher/student count over time)
- **EANL-03**: Attendance rate reports per tenant

### Tenant Operations

- **TOPS-01**: Tenant onboarding wizard (guided create -> subscribe -> admin -> school year flow)
- **TOPS-02**: Tenant data export for portability (JSON/zip download)
- **TOPS-03**: Bulk tenant operations (toggle active, update plan for multiple tenants)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-service tenant signup | Only 3-10 conservatories — manual onboarding is appropriate |
| Billing/payment integration (Stripe) | Subscriptions managed manually between organizations |
| White-labeling per tenant | All conservatories use Tenuto.io branding |
| Multi-level admin hierarchy | Super admin -> tenant admin is sufficient |
| Real-time tenant monitoring/alerting | At 3-10 tenants, dashboard refresh is sufficient |
| Database-per-tenant | Overkill for current scale |
| Impersonation of individual teachers | Super admin impersonates tenant admin only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 10 | Complete |
| FIX-02 | Phase 10 | Complete |
| FIX-03 | Phase 11 | Pending |
| FIX-04 | Phase 10 | Complete |
| TLCM-01 | Phase 11 | Pending |
| TLCM-02 | Phase 11 | Pending |
| TLCM-03 | Phase 11 | Pending |
| TLCM-04 | Phase 11 | Pending |
| IMPR-01 | Phase 13 | Pending |
| IMPR-02 | Phase 13 | Pending |
| IMPR-03 | Phase 13 | Pending |
| REPT-01 | Phase 12 | Pending |
| REPT-02 | Phase 12 | Pending |
| REPT-03 | Phase 12 | Pending |
| REPT-04 | Phase 12 | Pending |
| SAUI-01 | Phase 14 | Pending |
| SAUI-02 | Phase 14 | Pending |
| SAUI-03 | Phase 14 | Pending |
| SAUI-04 | Phase 14 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 (traceability updated with phase mappings)*
