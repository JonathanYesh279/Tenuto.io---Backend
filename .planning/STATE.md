# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Every MongoDB query either includes a tenantId filter or is explicitly allowlisted as cross-tenant. No exceptions.
**Current focus:** Phase 2 - Service Layer Query Hardening

## Current Position

Phase: 2 of 6 (Service Layer Query Hardening)
Plan: 6 of 8 in current phase
Status: Executing Phase 2
Last activity: 2026-02-15 - Completed 02-06 (schedule domain service hardening)

Progress: [█████████░] 45%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 6 min
- Total execution time: 0.94 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audit-infrastructure | 3/3 | 17 min | 6 min |
| 02-service-layer-query-hardening | 6/8 | 39 min | 7 min |

**Recent Trend:**
- Last 5 plans: 02-02 (5 min), 02-03 (7 min), 02-04 (6 min), 02-05 (12 min), 02-06 (7 min)
- Trend: Stable (6-7 min typical, outliers for complex services)

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
- [02-03] getTeacherByRole backward-compat: accepts string tenantId (legacy) or options object (canonical)
- [02-03] tenantId removed from teacher _buildCriteria -- exclusively handled by buildScopedFilter at call site
- [02-03] addTeacher sets tenantId from context (server-derived), removed client tenantId injection from controller
- [02-03] getTeacherIds now tenant-scoped (was CRITICAL vulnerability -- returned ALL teacher IDs cross-tenant)
- [02-03] No $lookup in teacher-lessons -- tenantId in first $match of aggregation pipeline is sufficient
- [02-04] All 4 orchestra $lookup pipelines use let tid: '$tenantId' with $eq filter (prevents cross-tenant joins)
- [02-04] Orchestra addOrchestra uses dynamic import() for ESM compat with getCurrentSchoolYear context
- [02-04] Rehearsal addRehearsal/bulkCreate set tenantId from context on document (server-derived)
- [02-04] All activity_attendance upserts/inserts include tenantId in filter and $set
- [02-04] Bulk delete/update operations include tenantId in all queries including transaction branches
- [02-05] Theory getTheoryLessons wraps createLessonFilterQuery with buildScopedFilter (two-layer filter composition)
- [02-05] Theory bulk operations set tenantId on each document and include tenantId in all delete criteria
- [02-05] Theory activity_attendance records include tenantId on inserts and deletes
- [02-05] Bagrut cross-service calls pass { context: options.context } to student setBagrutId/removeBagrutId
- [02-05] Both theory and bagrut _buildCriteria cleaned of tenantId handling
- [02-06] Time-block tenant scoping via parent teacher document query (sub-documents inherit parent's tenantId filter)
- [02-06] Internal helpers (checkStudentScheduleConflict, validateTimeBlockConflicts) receive tenantId as explicit parameter
- [02-06] calculateAvailableSlots adds options as 4th param to preserve signature (preferences != system context)
- [02-06] Analytics exportAttendanceReport threads context to all internal sub-calls
- [02-06] Context merging pattern: { ...filterOptions, context: req.context } when options already used for filters

### Pending Todos

None yet.

### Blockers/Concerns

**Known Gaps from Query Inventory (01-01):**
- 43 CRITICAL risk queries (no tenantId at all) across 22 API services
- 98 HIGH risk queries (conditional tenantId via _buildCriteria opt-in pattern)
- ~~buildScopedFilter used in only 1 of 22 services (student.service.js)~~ FIXED in 02-02/02-03/02-04/02-05 (now used in student + school-year + teacher + orchestra + rehearsal + theory + bagrut)
- ~~Every getById function queries by _id only (no tenant scope)~~ PARTIALLY FIXED in 02-02/02-03/02-04/02-05/02-06 (school-year, student, teacher, orchestra, rehearsal, theory, bagrut, time-block parent queries, attendance queries all include tenantId)
- ~~Aggregation $lookups in orchestra.service.js join cross-tenant~~ FIXED in 02-04 (all 4 $lookup pipelines now tenant-scoped)
- ~~enforceTenant middleware exists but is not applied to any route~~ FIXED in 02-01
- ~~buildContext tolerates null tenantId (does not throw)~~ FIXED in 02-01 (buildScopedFilter throws; buildContext still sets null for enforceTenant to catch)
- duplicateDetectionService.js and conflictDetectionService.js query without tenant scope
- Two cascade deletion systems exist (need unification but not blocking)
- past-activities.service.js calls rehearsalService.getRehearsals without context (will fail with TENANT_GUARD until admin services hardened)

**Enforcement Checklist Summary (01-02):**
- 50 FAIL endpoints need tenant isolation (17 P0 data leak + 33 P1 data corruption)
- 17 PARTIAL endpoints need migration to canonical pattern (pass tenantId but not context)
- Only 1 endpoint uses the canonical buildScopedFilter pattern

## Session Continuity

Last session: 2026-02-15 (Phase 2 continuing)
Stopped at: Completed 02-06-PLAN.md (Schedule Domain Service Hardening)
Resume file: .planning/phases/02-service-layer-query-hardening/02-07-PLAN.md
Resume task: Execute 02-07 (next plan in Phase 2)
