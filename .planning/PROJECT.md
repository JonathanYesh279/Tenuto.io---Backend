# Tenuto.io — Multi-Tenant Music School Management Platform

## What This Is

A multi-tenant SaaS platform for Israeli music conservatories (Node.js + Express + MongoDB backend, React + TypeScript frontend). Manages teachers, students, lessons, orchestras, theory classes, bagrut programs, schedules, and Ministry of Education reporting. Features 5-layer tenant isolation, hybrid RBAC with 13 roles and per-tenant customizable permissions, a super admin platform for tenant CRUD/reporting/impersonation/admin provisioning, enriched import from Ministry Excel files for teachers/students/conservatory profile/ensembles with conductor matching and student-orchestra linking, room schedule management with conflict detection, Ministry export workbook generation, and a management reporting center with 18 reports across 4 categories, KPI dashboard with alerts, Excel/PDF export, and year-over-year comparison.

## Core Value

Reliable multi-tenant music school management where every teacher sees only their tenant's data, every query is tenant-scoped, and Ministry reporting is accurate.

## Requirements

### Validated

- ✓ Shared-database multi-tenant architecture with `tenantId` on all collections — existing
- ✓ JWT embeds `tenantId` during login — existing
- ✓ `buildContext` middleware builds `req.context` with tenantId, userId, roles, scopes — existing
- ✓ `buildScopedFilter()` utility injects tenantId + role-based filters — existing
- ✓ `requireTenantId()` guard throws if tenantId missing — existing
- ✓ `canAccessStudent()` / `canAccessOwnResource()` IDOR checks — existing
- ✓ Compound index on `credentials.email` + `tenantId` — existing
- ✓ `school_year.isCurrent` scoped by tenantId — existing
- ✓ Multi-tenant login with TENANT_SELECTION_REQUIRED flow — existing
- ✓ Complete audit of all service-layer queries for tenantId enforcement — v1.0
- ✓ All identified enforcement gaps fixed (288 query locations hardened) — v1.0
- ✓ Client-supplied tenantId stripped/rejected via three-layer defense — v1.0
- ✓ Canonical architecture guide documenting multi-tenant patterns — v1.0
- ✓ Enforcement checklist covering every route/service pair (105 endpoints) — v1.0
- ✓ Explicit CROSS_TENANT_ALLOWLIST for super-admin operations — v1.0
- ✓ Automated test suite proving cross-tenant queries fail (50 tests) — v1.0
- ✓ Human-walkable verification checklist for manual audit — v1.0
- ✓ Teacher import from Ministry Excel with normalization and validation — v1.0
- ✓ Super admin auth fixes (refresh token, dedicated layout, no 401 errors) — v1.1
- ✓ Tenant lifecycle management (isActive gating, soft-delete, purge with snapshot, audit trail) — v1.1
- ✓ Platform reporting (per-tenant usage, Ministry status, subscription health, combined dashboard) — v1.1
- ✓ Tenant impersonation (scoped JWT, audit-logged, frontend banner with Exit) — v1.1
- ✓ Super admin frontend (dashboard, tenant list/detail/form, SA management page) — v1.1
- ✓ Student import instrument detection parity with teacher import (headerColMap fix) — v1.2
- ✓ instrumentProgress[] with stage tracking, ministryStageLevel, department field — v1.2
- ✓ Teacher-student linking from Ministry import (matchTeacherByName, teacherAssignment creation) — v1.2
- ✓ Bagrut candidacy flag from Ministry Excel (isBagrutCandidate) — v1.2
- ✓ Enriched student import preview (Hebrew labels, teacher match badges, summary cards) — v1.2
- ✓ Ministry instrument alias resolution with department tracking — v1.2
- ✓ Start date calculation from studyYears — v1.2
- ✓ Conservatory Excel form parser (21 fields from fixed cell addresses, SheetJS) — v1.3
- ✓ Conservatory import preview with side-by-side diff (current vs imported values) — v1.3
- ✓ Conservatory import execute merging with existing profile — v1.3
- ✓ "פרטי קונסרבטוריון" import tab on frontend import page — v1.3
- ✓ Settings page displays and edits all 19 conservatoryProfile fields — v1.3
- ✓ Ministry export profile sheet ("פרטי_קונסרבטוריון") in export workbook — v1.3
- ✓ Ensemble Excel parser with Hebrew name decomposition and schedule extraction — v1.4
- ✓ Ensemble preview with conductor matching and orchestra diff detection — v1.4
- ✓ Bulk ensemble import (insertMany + bulkWrite) preserving existing memberIds — v1.4
- ✓ Ensemble import frontend tab with conductor/orchestra match badges — v1.4
- ✓ Student-orchestra linking from ensemble columns in student import — v1.4
- ✓ Orchestra schema: scheduleSlots[], ministryData.importedParticipantCount — v1.4
- ✓ Complete Israeli Privacy Protection Regulations (2017) documentation at MEDIUM security level — v1.5
- ✓ 24 compliance documents covering all 18 regulations (data inventory, policies, procedures, audit) — v1.5
- ✓ Security Officer role definition with pre-launch conflict-of-interest exception — v1.5
- ✓ Route-level security audit: seed and init-admin endpoints guarded by NODE_ENV — v1.5
- ✓ 29 technical remediation findings catalogued for v1.6 hardening — v1.5
- ✓ 4-tier Minimal Safe Launch criteria for minors' data platform — v1.5
- ✓ Room CRUD API with schema validation, weekly schedule grid, conflict detection, drag-and-drop — v1.6
- ✓ Single-lesson reschedule with detail modal and conflict checking — v1.6
- ✓ Hybrid RBAC engine: 13 roles across 4 tiers with per-tenant customizable permission matrix — v1.7
- ✓ requirePermission(domain, action) middleware replacing requireAuth on all routes — v1.7
- ✓ Department-scoped coordinator filtering through buildScopedFilter integration — v1.7
- ✓ Transactional tenant + admin provisioning (single form, MongoDB transaction) — v1.7
- ✓ Settings UI: staff role assignment table + permission matrix editor with reset-to-defaults — v1.7
- ✓ Super admin tenant admin management page with password reset — v1.7
- ✓ Admin lockout prevention: last-admin check, locked domains, immutable admin permissions — v1.7

- ✓ Plugin-based report infrastructure with auto-discovery registry, contract validation, and role-based scoping — v1.8
- ✓ 18 report generators across 4 categories (Teacher, Student, Institutional, Department/Schedule) — v1.8
- ✓ Excel and PDF export engines with separate data shaping per format and Hebrew RTL support — v1.8
- ✓ KPI dashboard with trend indicators, drill-down navigation, and anomaly alerts — v1.8
- ✓ Categorized report catalog with role-filtered visibility — v1.8
- ✓ Frontend Reports UI with DefaultTableRenderer, custom chart/gauge renderers, and year comparison — v1.8

### Active

(No active milestone — ready for next milestone planning)

### Out of Scope

- Database-per-tenant architecture — overkill for current scale, shared-DB is correct
- Row-level security at MongoDB driver level — not available in native driver
- Billing/payment integration — deferred to v2+
- Per-tenant rate limiting — separate concern
- Self-service tenant signup — only 3-10 conservatories, manual onboarding appropriate
- Impersonation of individual teachers — super admin impersonates tenant admin only
- Impersonation read-only guard — deferred (ASEC-03)
- Super admin 2FA/MFA — deferred (ASEC-01)
- Subscription enforcement (auto-block at limits) — deferred (SENF-01/02)
- Rehearsal auto-creation from imported schedule data — deferred (RHSL-01/02/03)
- Cross-validation of conductor hours vs teacher import hours — deferred (XVAL-01)
- Cross-validation of participant counts vs student enrollment — deferred (XVAL-02)
- Auto-assign students to orchestras from participant count — Excel has count, not student list
- Theory class enrollment from import — requires matching to existing theory lesson documents
- Full bagrut record creation from import — only flag enrollment, manual setup for program details
- Year-scoped conservatory settings — institutional facts don't change per year
- Director-to-teacher matching from import — director info stored directly on settings

## Context

**Current state:** v1.8 shipped (Admin Report Generator). Backend has ~100,000 LOC JavaScript. Frontend has React 18 + TypeScript + Vite + Tailwind. Platform features: 5-layer tenant isolation, hybrid RBAC with 13 roles and department-scoped coordinators, super admin dashboard with tenant admin management, enriched teacher/student/conservatory/ensemble import from Ministry Excel, Ministry export workbook, room schedule management with conflict detection, complete Israeli privacy compliance documentation package (24 documents), and management reporting center with 18 reports, KPI dashboard, Excel/PDF export. 9 milestones shipped (v1.0-v1.8), 56 phases, 119 plans.

**Tech stack:** Node.js + Express + MongoDB native driver (no Mongoose). React 18 + TypeScript + Vite + Tailwind CSS. Vitest + MongoDB Memory Server for testing. GitHub Actions CI pipeline.

**Known tech debt:**
- 4 controllers still expose err.message in 500 responses (schedule, super-admin, tenant, attendance)
- Placeholder for orphan detection logic in cascade-deletion.service.js
- Two cascade deletion systems coexist (re-export wrapper consolidation, not full merge)
- Backward compat shims in getCurrentSchoolYear and getTeacherByRole
- 29 remediation findings from v1.5 compliance audit (8 HIGH, 20 MEDIUM, 1 LOW) — technical enforcement deferred to v1.6
- `time_block`, `privateAttendance`, `privateLessons` collections not in TENANT_SCOPED_COLLECTIONS (use teacherId/studentId FK)
- `previewStudentImport` uses `Object.keys(rows[0])` for instrument headers instead of `parsedHeaders` (may miss columns empty in first row)
- `startDate` missing Hebrew label in `formatStudentChange` fieldLabels map
- `ministryLevelToStage()` exported but unused (intentional orphan after Phase 19 design change)
- IMPORT_TYPES constant missing 'conservatory' (unused at runtime, dispatcher uses hard-coded strings)
- Frontend `EnsemblePreviewEnsemble.schedule.activity1.dayOfWeek` typed as string but backend sends number|null (field unused in rendering)
- Phase 25 missing SUMMARY.md and VERIFICATION.md (code complete, documentation gap only)

**Tenant count:** Zero production tenants (pre-launch).

## Constraints

- **Tech stack**: Node.js + Express + MongoDB native driver (no ORM, no Mongoose)
- **No breaking changes**: Existing API contracts must be preserved
- **Performance**: tenantId filtering adds no measurable latency (compound indexes on all 11 collections)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Default-deny with allowlist | Safer than opt-in; gaps fail closed not open | ✓ Good — all 288 queries covered |
| Server-derived tenantId only | Client should never supply tenantId in request body | ✓ Good — three-layer strip/reject/override |
| `buildScopedFilter` as canonical pattern | Already exists, proven in student module | ✓ Good — extended to all 22 services |
| Automated + manual verification | Belt and suspenders for tenant isolation | ✓ Good — 50 tests + human checklist |
| IDOR returns 404 not 403 | Prevents cross-tenant existence probing | ✓ Good — consistent with OWASP guidance |
| Real MMS for tests (no mocks) | Ensures tenant middleware actually exercised | ✓ Good — caught real issues during test writing |
| Three-layer write protection | Middleware + Joi + service defense-in-depth | ✓ Good — any single layer prevents injection |
| teacherAssignments as single relationship source | Replaces redundant teacherIds/studentIds arrays | ✓ Good — simplifies queries, single source of truth |
| Impersonation JWT mirrors teacher JWT + 3 claims | Reuses existing auth middleware unchanged | ✓ Good — zero modifications to authenticateToken |
| Cascade consolidation via re-export wrapper | Safer than full merge; no import path changes | ✓ Good — all consumers use canonical API |
| Snapshot split per collection for purge | Avoids 16MB BSON limit on large tenants | ✓ Good — future-proof for growing data |
| Single reporting dashboard API endpoint | One network request instead of 3+ | ✓ Good — snappy dashboard load |
| Token stashing in sessionStorage | Survives page refresh, cleared on tab close | ✓ Good — impersonation state isolated per tab |
| instrumentProgress[] replaces flat instrument string | Supports stage tracking, tests, department | ✓ Good — rich instrument data per student |
| Department-first detection in import | Department columns checked before abbreviation | ✓ Good — fixes כלי הקשה being both instrument and department |
| Import bypasses Joi for teacherAssignment writes | Ministry files lack day/time fields; direct MongoDB $push | ✓ Good — avoids fighting strict Joi schema |
| startDate as root-level field (not nested) | Represents conservatory start date, not instrument-specific | ✓ Good — simple access, calculated from studyYears |
| matchTeacherByName tries both name orderings | Hebrew names have no standard first/last ordering | ✓ Good — handles אבי כהן and כהן אבי equally |
| isBagrutCandidate defaults to null (not false) | Null = unknown/not imported; false = explicitly not a candidate | ✓ Good — no false negatives for existing students |
| Fixed cell addresses for form-style Excel | Ministry form has no column headers; cell positions are stable | ✓ Good — reliable parsing of label/value pairs |
| SheetJS over ExcelJS for conservatory parser | ExcelJS returned null for formula cells; SheetJS handles formula results | ✓ Good — fixed Invalid Date and null cell bugs |
| Merge-based conservatory execute | Preserves manually-entered fields not in Excel | ✓ Good — no data loss on re-import |
| managerName dual mapping | Maps to both conservatoryProfile.managerName and director.name | ✓ Good — single source updates both locations |
| Fixed-position column parsing for ensemble Activity I/II | Duplicate header names can't be disambiguated by name alone | ✓ Good — finds nth 'ביום' occurrence, offsets +1/+2/+3 for sub-columns |
| SUBTYPE_KEYWORDS ordered longest-first | Prevents partial matches (e.g., 'קאמרי' matching before 'קאמרי קלאסי') | ✓ Good — correct decomposition of composite names |
| Conductor cache with Map closure | Same conductor leads multiple ensembles; avoid repeated DB lookups | ✓ Good — O(1) repeat lookups |
| Orchestra matching requires name AND conductorId | Same name can belong to different conductors | ✓ Good — prevents false matches |
| Type classification by participant count threshold | >12 = תזמורת (orchestra), <=12 = הרכב (ensemble) | ✓ Good — matches Ministry conventions |
| tenantId added after Joi validation for ensemble import | orchestraSchema has `tenantId: Joi.any().strip()` | ✓ Good — Joi doesn't strip needed field |
| Skip orchestras with unresolved conductors | Partial results better than blocking entire import | ✓ Good — skipped[] with reasons reported |
| Ensemble column detection by header text (not STUDENT_COLUMN_MAP) | Ensemble columns are variable-content, not fixed-field | ✓ Good — preserves column map semantics |
| Non-fatal orchestra enrollment in student import | Student data integrity more important than orchestra links | ✓ Good — errors logged, import not failed |
| Documentation-first compliance (v1.5 before v1.6 hardening) | Legal foundation needed before technical controls | ✓ Good — 32/32 requirements satisfied |
| MEDIUM security level assessment | Israeli regulations define 3 levels; MEDIUM fits pre-launch SaaS with minors' data | ✓ Good — requirements proportionate to risk |
| NODE_ENV guard for seed/init-admin endpoints | Environment-based route exclusion (routes don't exist in production) | ✓ Good — 404 in production, no attack surface |
| 4-tier Minimal Safe Launch criteria | Minors' data requires stricter launch gates than typical SaaS | ✓ Good — clear go/no-go checklist |

---
| Hybrid RBAC with per-tenant customizable permissions | Hardcoded defaults + tenant.rolePermissions override | ✓ Good — 13 roles, 4 tiers, per-tenant customization |
| Admin provisioning inline with tenant creation | Transaction: tenant + admin teacher in one step | ✓ Good — no chicken-and-egg, atomic operation |
| Department-scoped coordinators via coordinatorDepartments[] | Reuses INSTRUMENT_DEPARTMENTS for scoping | ✓ Good — buildScopedFilter handles department filtering |
| requirePermission replaces requireAuth | Domain/action/scope model with union merge | ✓ Good — all routes migrated, no regressions |
| Room schedule grid with conflict detection | Visual weekly grid, drag-and-drop, double-booking prevention | ✓ Good — teacher and room conflicts caught |
| Single-lesson reschedule | Move individual lessons without affecting recurring series | ✓ Good — conflict checking on reschedule |

| Generator plugin convention with auto-discovery registry | Convention over configuration — generators self-register | ✓ Good — 18 generators, zero manual wiring |
| Role-based scope builder (all/department/own) | Generators stay role-unaware, scope handled by infrastructure | ✓ Good — clean separation of concerns |
| PDFKit for PDF generation | Lightweight, no headless browser dependency | ✓ Good — fast generation, Hebrew RTL with custom font |
| Separate export shaping from display shaping | EXPO-03 requirement, different data needs per format | ✓ Good — Excel and PDF have independent formatters |
| 5 categories merged to 4 in catalog | department+schedule naturally group together | ✓ Good — cleaner UX, fewer categories |

---
*Last updated: 2026-03-07 after v1.8 milestone completion*
