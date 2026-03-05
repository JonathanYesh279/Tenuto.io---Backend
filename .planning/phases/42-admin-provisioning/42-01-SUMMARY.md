---
phase: 42-admin-provisioning
plan: 01
subsystem: api
tags: [mongodb-transactions, tenant-provisioning, bcrypt, rbac]

requires:
  - phase: 39-01
    provides: DEFAULT_ROLE_PERMISSIONS and permission constants
provides:
  - createTenantWithAdmin transactional service function
  - createTenantWithAdminSchema Joi validation
  - Updated controller wiring for atomic tenant+admin creation
affects: [42-02, admin-provisioning, frontend-tenant-form]

tech-stack:
  added: []
  patterns: [withTransaction for atomic multi-collection inserts]

key-files:
  created: []
  modified:
    - api/super-admin/super-admin.validation.js
    - api/super-admin/super-admin.service.js
    - api/super-admin/super-admin.controller.js

key-decisions:
  - "Deep clone DEFAULT_ROLE_PERMISSIONS via JSON.parse/stringify for tenant rolePermissions"
  - "No cross-tenant email uniqueness check since tenant is brand new (email index is compound with tenantId)"
  - "Admin teacher gets invitationMode DEFAULT_PASSWORD with requiresPasswordChange: true"

patterns-established:
  - "Tenant provisioning pattern: withTransaction wrapping tenant + teacher inserts with session"

duration: 3min
completed: 2026-03-05
---

# Phase 42 Plan 01: Tenant + Admin Provisioning Summary

**Atomic tenant+admin creation via MongoDB transaction with DEFAULT_ROLE_PERMISSIONS, hashed default password, and requiresPasswordChange flag**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T09:11:17Z
- **Completed:** 2026-03-05T09:13:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- createTenantWithAdminSchema validates combined tenant + admin fields (name, slug, city, adminFirstName, adminLastName, adminEmail)
- createTenantWithAdmin service uses withTransaction for atomic tenant + admin teacher creation
- Controller wired to new service; audit log includes adminEmail
- Admin teacher created with roles ['מנהל'], hashed default password, requiresPasswordChange: true

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createTenantWithAdmin validation and service function** - `233e375` (feat)
2. **Task 2: Wire controller to use createTenantWithAdmin** - `744c3ff` (feat)

## Files Created/Modified
- `api/super-admin/super-admin.validation.js` - Added createTenantWithAdminSchema
- `api/super-admin/super-admin.service.js` - Added createTenantWithAdmin with withTransaction, DEFAULT_ROLE_PERMISSIONS deep clone, bcrypt password hashing
- `api/super-admin/super-admin.controller.js` - Replaced tenantService.createTenant with superAdminService.createTenantWithAdmin

## Decisions Made
- Deep clone DEFAULT_ROLE_PERMISSIONS via JSON.parse/stringify (safe since all values are strings, no dates/ObjectIds)
- No cross-tenant email uniqueness check needed for brand new tenant (compound index is tenantId + email)
- Admin teacher uses invitationMode: 'DEFAULT_PASSWORD' with requiresPasswordChange: true

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POST /api/super-admin/tenants now accepts admin fields and creates both atomically
- Ready for Phase 42-02 (route/endpoint updates if needed) or frontend integration

---
*Phase: 42-admin-provisioning*
*Completed: 2026-03-05*
