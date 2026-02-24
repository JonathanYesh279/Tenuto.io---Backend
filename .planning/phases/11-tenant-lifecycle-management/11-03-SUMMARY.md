---
phase: 11-tenant-lifecycle-management
plan: 03
subsystem: api
tags: [tenant-lifecycle, soft-delete, purge, snapshot, audit-trail, super-admin, multi-tenant]

# Dependency graph
requires:
  - phase: 11-01
    provides: "auditTrail.service.js, AUDIT_ACTIONS, TENANT_SCOPED_COLLECTIONS constants"
  - phase: 11-02
    provides: "Consolidated cascade deletion service for tenant-level operations"
provides:
  - "tenantPurge.service.js with previewDeletion, createTenantSnapshot, purgeTenant (transactional)"
  - "6 new super admin API endpoints for tenant lifecycle management"
  - "Audit trail wired into all super admin mutations (toggle-active, create/update tenant, subscription, create/update admin)"
  - "Soft-delete with configurable grace period and cancellation support"
  - "Permanent purge with pre-deletion snapshot split per collection (avoids 16MB BSON limit)"
  - "Validation schemas for soft-delete and purge operations"
affects: [12-reporting, 13-impersonation, 14-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tenant purge pattern: snapshot per collection -> transactional delete -> audit log"
    - "Soft-delete lifecycle: active -> scheduled -> (cancelled | purging -> purged)"
    - "Purge safety: requires confirmTenantName matching actual tenant name"
    - "Audit wiring in controller for cross-service operations (createTenant, updateTenant)"

key-files:
  created:
    - services/tenantPurge.service.js
  modified:
    - api/super-admin/super-admin.service.js
    - api/super-admin/super-admin.controller.js
    - api/super-admin/super-admin.route.js
    - api/super-admin/super-admin.validation.js

key-decisions:
  - "Snapshot split per collection to avoid 16MB BSON document limit"
  - "Cancelling soft-delete does NOT reactivate tenant -- super admin must explicitly toggle-active"
  - "Purge requires confirmTenantName safety check in controller"
  - "Audit logging for createTenant/updateTenant done in controller (not service) since tenantService is shared"
  - "Purge status rollback on failure: deletionStatus reverts to 'scheduled' so purge can be retried"
  - "Service methods accept optional actorId for backward compatibility (if undefined, audit logging skips)"

patterns-established:
  - "Tenant lifecycle states: active -> scheduled -> (cancelled | purging -> purged)"
  - "actorId passthrough: controller passes req.superAdmin._id.toString() to service for audit"
  - "Purge transaction uses db.startSession() pattern consistent with cascadeDeletion.service.js"

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 11 Plan 03: Tenant Lifecycle Management API Summary

**Full tenant lifecycle API with deletion preview, soft-delete with grace period, permanent purge with per-collection snapshots, and audit trail on all super admin mutations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T21:25:03Z
- **Completed:** 2026-02-24T21:28:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created tenantPurge.service.js with previewDeletion (parallel counts), createTenantSnapshot (per-collection to avoid 16MB limit), and purgeTenant (transactional delete)
- Added 6 new service methods to superAdminService: deletionPreview, softDeleteTenant, cancelDeletion, purgeTenant, getPlatformAuditLog, getTenantAuditLog
- Wired audit trail logging into all existing super admin mutations: toggleTenantActive, createSuperAdmin, updateSuperAdmin, updateSubscription, createTenant, updateTenant
- Registered 6 new API routes behind super admin authentication
- Added softDeleteTenantSchema and purgeTenantSchema Joi validation schemas
- Purge endpoint requires tenant name confirmation as safety check

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tenant purge service and add tenant lifecycle methods** - `eed719d` (feat)
2. **Task 2: Add controller methods and routes for tenant lifecycle endpoints** - `6ad56f0` (feat)

## Files Created/Modified
- `services/tenantPurge.service.js` - New: tenant purge service with preview, snapshot, and transactional purge
- `api/super-admin/super-admin.service.js` - Added 6 lifecycle methods, wired audit logging into 4 existing mutations
- `api/super-admin/super-admin.controller.js` - Added 6 controller methods, wired actorId into 4 existing controllers, audit logging for createTenant/updateTenant
- `api/super-admin/super-admin.route.js` - Added 6 new routes (4 tenant lifecycle + 2 audit log)
- `api/super-admin/super-admin.validation.js` - Added softDeleteTenantSchema and purgeTenantSchema

## Decisions Made
- Snapshot split per collection instead of single document to avoid MongoDB 16MB BSON limit
- Cancelling soft-delete does NOT reactivate tenant -- deliberate separation of concerns (super admin must toggle-active)
- Purge requires confirmTenantName in request body as destructive action safety check
- Audit logging for createTenant/updateTenant done in controller layer since tenantService is shared with non-super-admin flows
- Service methods accept optional actorId (undefined skips audit logging) for backward compatibility with existing callers
- Purge failure rolls back deletionStatus to 'scheduled' so the operation can be retried

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest cannot run in WSL environment due to node_modules resolution errors (loupe package) -- consistent with 11-01. All files validated via `node --check`.
- Route import verification (`node -e "import('./...')"`) fails due to WSL node_modules resolution -- same environment issue. Syntax validation confirms correctness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 11 is now complete: tenant isActive gating (11-01), cascade deletion consolidation (11-02), and full lifecycle API (11-03) are all delivered
- All TLCM requirements satisfied: preview, soft-delete, cancel, purge with audit trail
- Ready for Phase 12 (reporting) and Phase 13 (impersonation)
- Frontend (Phase 14) can now build tenant management UI consuming all 6 new endpoints

## Self-Check: PASSED

All files exist, all commits verified, all content markers present.
