# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Every MongoDB query either includes a tenantId filter or is explicitly allowlisted as cross-tenant. No exceptions.
**Current focus:** Phase 5 - Error Handling & Cascade Safety -- IN PROGRESS

## Current Position

Phase: 5 of 9 (Error Handling & Cascade Safety)
Plan: 3 of 4 in current phase (05-01, 05-02, 05-03 complete)
Status: Executing Phase 5
Last activity: 2026-02-24 - Completed 05-03 (Secondary cascade & aggregation tenant scoping)

Progress: [███████████████████░] 85% (phases 1-4 + phase 7-9 hotfixes + 05-01 + 05-02 + 05-03)

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 6 min
- Total execution time: 1.88 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audit-infrastructure | 3/3 | 17 min | 6 min |
| 02-service-layer-query-hardening | 8/8 | 48 min | 6 min |
| 07-fix-import-teacher-feature-null-properties-after-import | 1/1 | 7 min | 7 min |
| 08-fix-import-teacher-bugs-wrong-labels-missing-enums-failed-creation | 1/1 | 5 min | 5 min |
| 09-fix-import-teacher-missing-column-mapping-instruments-hours-degrees-certificates-management | 1/1 | 5 min | 5 min |
| 03-write-protection-validation | 1/1 | 4 min | 4 min |
| 04-super-admin-allowlist | 2/2 | 9 min | 5 min |
| 05-error-handling-cascade-safety | 3/4 | 17 min | 6 min |

**Recent Trend:**
- Last 5 plans: 04-01 (7 min), 04-02 (2 min), 05-01 (5 min), 05-02 (3 min), 05-03 (9 min)
- Trend: Stable (2-9 min typical)

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
- [02-07] Hours-summary signatures changed from positional tenantId to options.context pattern
- [02-07] Export service signatures reordered: generateFullReport(schoolYearId, userId, options) instead of (tenantId, schoolYearId, userId)
- [02-07] Ministry-mappers loadExportData hardened with requireTenantId guard (defense-in-depth, caller already validates)
- [02-07] Import internal helpers receive tenantId as explicit param (private functions, not via options)
- [02-08] tenantId injected via baseQuery in duplicateDetectionService (all 7 checks inherit from single baseQuery spread)
- [02-08] conflictDetectionService requireTenantId at leaf query methods (checkRoomConflicts/checkTeacherConflicts)
- [02-08] permissionService getFilteredData scopes admin queries by tenantId (admin sees own tenant only)
- [02-08] enhancedAuth.middleware.js updated despite being deprecated (defense-in-depth)
- [07-01] Separate teacherImportSchema instead of modifying main teacherSchema (relaxes phone/email/address for import)
- [07-01] Store normalized data in preview notFound entries to prevent MongoDB undefined-key stripping
- [07-01] Validate import documents through Joi before insertion for defaults and malformed data catching
- [07-01] Repair utility queries by credentials.invitationMode: IMPORT to find affected teachers
- [08-01] Add createdAt/updatedAt to Joi schema explicitly (not allowUnknown) for type validation and defaults
- [08-01] TEACHER_DEGREES expanded to 6 values: תואר שלישי, מוסמך בכיר added (ordered by level descending)
- [08-01] MANAGEMENT_ROLES expanded to 6 values: ריכוז אחר (פרט), תיאור תפקיד added
- [08-01] Frontend enums.ts must stay synced with backend config/constants.js enum arrays
- [09-01] Dynamic instrumentSectionStart replaces hardcoded colIndex < 24 threshold for instrument detection
- [09-01] KNOWN_NON_INSTRUMENT_HEADERS set prevents hours columns from being treated as instruments
- [09-01] Sub-header refinement only replaces headers when current header is NOT already mapped to a valid field
- [09-01] Parent-row context resolves generic "כן-לא" boolean labels to specific fields (certificate vs union)
- [09-01] parsedHeaders from parseExcelBufferWithHeaderDetection used instead of Object.keys(rows[0])
- [03-01] stripTenantId returns 400 TENANT_MISMATCH on mismatch (active rejection vs silent strip)
- [03-01] Strip from both req.body and req.query (defense-in-depth against query param injection)
- [03-01] Joi.any().strip() chosen over removing tenantId from schemas (backward-compat: schemas still accept the field)
- [04-01] Admin routes NOT in CROSS_TENANT_ALLOWLIST -- they are tenant-scoped via enforceTenant (not exempt)
- [04-01] 6 allowlist entries across 4 categories (AUTH, SUPER_ADMIN, TENANT_MGMT, SYSTEM)
- [04-01] Context extracted explicitly at each function level in past-activities for clarity and auditability
- [04-01] _getPastPrivateLessons tenantId uses conditional spread for backward-compat safety
- [04-02] Static route analysis over runtime Express introspection (no app object dependency, trivially updatable)
- [04-02] Two arrays (ENFORCED_ROUTE_PREFIXES + ALL_REGISTERED_PREFIXES) for clear enforcement vs registration separation
- [04-02] Exit code 1 on validation failure for CI pipeline integration
- [05-01] NotFoundError resourceType for server-side logging only; clients always get generic 'The requested resource was not found'
- [05-01] IDOR check returns 404 not 403 to prevent cross-tenant resource existence leaks
- [05-01] Keep 400/401/403/409 err.message (validation, auth, role-based, conflict messages are intentional)
- [05-01] Service-layer throw messages untouched (debugging preserved at service boundary)
- [05-01] 500 responses always return 'An unexpected error occurred' (never err.message)
- [05-02] Direct tenantId injection over buildScopedFilter for cascade internals (admin-initiated, no role scoping)
- [05-02] requireTenantId at 4 entry points: cascadeDeleteStudent, restoreStudent, getStudentDeletionAuditHistory, bulkUpdateTeacherSchedules
- [05-02] tenantId threaded through cascadeJobProcessor job.data to service calls (serializable, survives queue persistence)
- [05-02] Controller tenant-scopes student validation queries and passes req.context to all service calls
- [05-03] Direct tenantId injection for collection-based cascade/aggregation internals (consistent with 05-02 pattern)
- [05-03] requireTenantId at every public entry point (22 guards across 4 files)
- [05-03] $lookup sub-pipelines include $eq tenantId filter to prevent cross-tenant joins in bidirectional consistency checks
- [05-03] Deletion snapshots and audit logs include tenantId on document for scoped retrieval

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 7 added: Fix Import Teacher Feature - Null Properties After Import
- Phase 8 added: Fix Import Teacher Bugs — Wrong Labels, Missing Enums, Failed Creation
- Phase 9 added: Fix Import Teacher — Missing Column Mapping (instruments, hours, degrees, certificates, management)

### Blockers/Concerns

**Known Gaps from Query Inventory (01-01):**
- 43 CRITICAL risk queries (no tenantId at all) across 22 API services
- 98 HIGH risk queries (conditional tenantId via _buildCriteria opt-in pattern)
- ~~buildScopedFilter used in only 1 of 22 services (student.service.js)~~ FIXED in 02-02/02-03/02-04/02-05 (now used in student + school-year + teacher + orchestra + rehearsal + theory + bagrut)
- ~~Every getById function queries by _id only (no tenant scope)~~ PARTIALLY FIXED in 02-02/02-03/02-04/02-05/02-06 (school-year, student, teacher, orchestra, rehearsal, theory, bagrut, time-block parent queries, attendance queries all include tenantId)
- ~~Aggregation $lookups in orchestra.service.js join cross-tenant~~ FIXED in 02-04 (all 4 $lookup pipelines now tenant-scoped)
- ~~enforceTenant middleware exists but is not applied to any route~~ FIXED in 02-01
- ~~buildContext tolerates null tenantId (does not throw)~~ FIXED in 02-01 (buildScopedFilter throws; buildContext still sets null for enforceTenant to catch)
- ~~duplicateDetectionService.js and conflictDetectionService.js query without tenant scope~~ FIXED in 02-08
- ~~Two cascade deletion systems exist (need unification but not blocking)~~ FIXED: Transaction-based in 05-02, collection-based in 05-03 (both fully tenant-scoped)
- ~~past-activities.service.js calls rehearsalService.getRehearsals without context (will fail with TENANT_GUARD until admin services hardened)~~ FIXED in 04-01 (context threaded through all 3 helpers + tenantId on teacher findOne)

**Enforcement Checklist Summary (01-02):**
- 50 FAIL endpoints need tenant isolation (17 P0 data leak + 33 P1 data corruption)
- 17 PARTIAL endpoints need migration to canonical pattern (pass tenantId but not context)
- Only 1 endpoint uses the canonical buildScopedFilter pattern

## Session Continuity

Last session: 2026-02-24 (Phase 5 in progress)
Stopped at: Completed 05-03-PLAN.md (Secondary cascade & aggregation tenant scoping)
Resume file: .planning/phases/05-error-handling-cascade-safety/05-04-PLAN.md
Resume task: Execute 05-04 (final error handling plan)
