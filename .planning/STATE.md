# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Every MongoDB query either includes a tenantId filter or is explicitly allowlisted as cross-tenant. No exceptions.
**Current focus:** Phase 2 - Service Layer Query Hardening

## Current Position

Phase: 2 of 6 (Service Layer Query Hardening)
Plan: 2 of 8 in current phase
Status: Executing Phase 2
Last activity: 2026-02-14 - Completed 02-02 (school-year and student service hardening)

Progress: [█████░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5 min
- Total execution time: 0.40 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audit-infrastructure | 3/3 | 17 min | 6 min |
| 02-service-layer-query-hardening | 2/8 | 7 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-02 (5 min), 01-03 (3 min), 02-01 (2 min), 02-02 (5 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Default-deny with allowlist (safer than opt-in; gaps fail closed)
- Server-derived tenantId only (client never supplies tenantId)
- buildScopedFilter as canonical pattern (already exists, proven in student module)
- Automated + manual verification (belt and suspenders for tenant isolation)
- [01-01] _buildCriteria classified as HIGH risk (opt-in tenantId, not default-deny)
- [01-01] All getById functions classified CRITICAL (no tenant filter on _id lookups)
- [01-01] Admin/cascade/auth services classified EXEMPT (intentionally cross-tenant)
- [01-01] req.context audit PASS with caveats: buildContext tolerates null, services ignore context.tenantId, enforceTenant unused
- [01-02] Only 1 of 105 endpoints fully PASS (student.getStudents with buildScopedFilter + context)
- [01-02] 50 FAIL + 17 PARTIAL + 31 EXEMPT + 6 N/A endpoints documented
- [01-02] 3 shared services flagged for hardening: duplicateDetectionService, conflictDetectionService, permissionService
- [01-02] 4-wave fix order established: P0 reads -> P1 writes -> P2 fragile -> shared services
- [01-03] 16 compound indexes across 11 collections (time_block excluded as embedded in teacher docs)
- [01-03] Background index creation to avoid blocking production database
- [01-03] Script does not auto-drop old indexes (requires manual verification)
- [01-03] Unique compound index on tenantId + credentials.email replaces email-only index
- [02-01] buildScopedFilter now throws TENANT_GUARD on null tenantId (fail-fast over silent skip)
- [02-01] enforceTenant placed between buildContext and addSchoolYearToRequest in middleware chain
- [02-01] Admin/auth/super-admin/health/files/tenant/config routes exempt from enforceTenant
- [02-01] School year IDOR fix: schoolYearId lookup now tenant-scoped via req.context.tenantId
- [02-02] Backward compat for getCurrentSchoolYear: accepts string tenantId (legacy) or options object (new pattern)
- [02-02] tenantId removed from student _buildCriteria -- exclusively handled by buildScopedFilter at call site
- [02-02] getStudents context is now mandatory (no more optional conditional scoping)
- [02-02] Fixed pre-existing bug: undefined teacherRelationshipSyncRequired -> teacherAssignmentsSyncRequired
- [02-02] All write operations derive tenantId from context (server-side, never from client body)

### Pending Todos

None yet.

### Blockers/Concerns

**Known Gaps from Query Inventory (01-01):**
- 43 CRITICAL risk queries (no tenantId at all) across 22 API services
- 98 HIGH risk queries (conditional tenantId via _buildCriteria opt-in pattern)
- ~~buildScopedFilter used in only 1 of 22 services (student.service.js)~~ FIXED in 02-02 (now used in student + school-year)
- ~~Every getById function queries by _id only (no tenant scope)~~ PARTIALLY FIXED in 02-02 (school-year and student getById now include tenantId)
- Aggregation $lookups in orchestra.service.js join cross-tenant
- ~~enforceTenant middleware exists but is not applied to any route~~ FIXED in 02-01
- ~~buildContext tolerates null tenantId (does not throw)~~ FIXED in 02-01 (buildScopedFilter throws; buildContext still sets null for enforceTenant to catch)
- duplicateDetectionService.js and conflictDetectionService.js query without tenant scope
- Two cascade deletion systems exist (need unification but not blocking)

**Enforcement Checklist Summary (01-02):**
- 50 FAIL endpoints need tenant isolation (17 P0 data leak + 33 P1 data corruption)
- 17 PARTIAL endpoints need migration to canonical pattern (pass tenantId but not context)
- Only 1 endpoint uses the canonical buildScopedFilter pattern

## Session Continuity

Last session: 2026-02-14 (Phase 2 continuing)
Stopped at: Completed 02-02-PLAN.md (School-Year and Student Service Hardening)
Resume file: .planning/phases/02-service-layer-query-hardening/02-03-PLAN.md
Resume task: Execute 02-03 (next plan in Phase 2)
