# Milestones

## v1.0 — Multi-Tenant Architecture Hardening

**Shipped:** 2026-02-24
**Phases:** 9 (1-9)
**Plans:** 25
**Timeline:** 11 days (2026-02-14 → 2026-02-24)
**Execution time:** 2.6 hours
**Commits:** 108
**Files modified:** 130

### Accomplishments

1. **Query Inventory & Enforcement Infrastructure** — Audited 288 query locations across 22 services, created enforcement checklist for 105 routes, built compound indexes on all 11 tenant-scoped collections
2. **Service Layer Hardening & Write Protection** — Applied TENANT_GUARD and enforceTenant middleware across all routes, implemented three-layer defense against tenantId injection (middleware strip + Joi strip + service override)
3. **Cross-Tenant Allowlist & Route Accountability** — Created CROSS_TENANT_ALLOWLIST constant with 6 entries across 4 categories, CI validation utility for drift detection, 26/26 routes accounted
4. **Error Handling & Cascade Safety** — NotFoundError class preventing cross-tenant existence probing, tenant-scoped cascade deletion with WebSocket rooms and dry-run preview mode
5. **Comprehensive Testing & CI** — Vitest + MongoDB Memory Server framework with 50 automated tests, GitHub Actions CI pipeline, human verification checklist
6. **Import Feature Fixes** — Fixed teacher import normalization, expanded degree/role enums, dynamic instrument column detection with diagnostic reporting

### Requirements

- 18/18 v1 requirements satisfied (100%)
- See: `.planning/milestones/v1.0-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

## v1.1 — Super Admin Platform Management

**Shipped:** 2026-02-26
**Phases:** 5 (10-14)
**Plans:** 13
**Timeline:** 3 days (2026-02-24 → 2026-02-26)
**Backend files modified:** 53 (+10,597 / -834 lines)
**Frontend files modified:** 221 (+2,679 lines net)

### Accomplishments

1. **Super Admin Auth & Layout** — Refresh token with httpOnly cookie, dedicated frontend layout with sidebar and route guards, no more 401 errors on tenant-scoped endpoints
2. **Tenant Lifecycle Management** — isActive gating blocks deactivated tenants from login, soft-delete with grace period, permanent purge with pre-deletion snapshot, full audit trail on all mutations
3. **Platform Reporting** — Per-tenant usage statistics, Ministry report status, subscription health alerts with severity escalation, combined dashboard API endpoint
4. **Tenant Impersonation** — Scoped JWT passing through regular auth middleware, audit-logged actions during impersonation, ImpersonationBanner with Exit button and sessionStorage token stashing
5. **Super Admin Frontend** — Dashboard with reporting API, tenant list with inline CRUD, tenant detail/form pages, super admin management page with self-edit protection
6. **UX Polish** — Super admin-specific settings page (profile/password), tenant quick actions hidden from super admin sidebar

### Requirements

- 19/19 v1.1 requirements satisfied (100%)
- See: `.planning/milestones/v1.1-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---


## v1.2 — Student Import Enhancement

**Shipped:** 2026-02-27
**Phases:** 5 (15-19)
**Plans:** 8
**Timeline:** 1 day (2026-02-27)
**Commits:** 24
**Files modified:** 15 (+2,670 / -78 lines)

### Accomplishments

1. **Fixed Student Import Instrument Detection** — headerColMap passthrough bug fix giving parity with teacher import; reversed detection priority so department columns take precedence over abbreviation columns
2. **Proper instrumentProgress[] Entries** — Stage tracking with ministryStageLevel, currentStage, department field, and school year enrollment instead of flat instrument string
3. **Teacher-Student Linking from Import** — matchTeacherByName with both Hebrew name orderings, teacherAssignment creation with filter-based duplicate prevention, match status persisted in import_log
4. **Enriched Frontend Preview** — Hebrew-labeled changes, rich detail cards for new students, teacher match badges (green/red/amber), teacher match summary statistics matching teacher import quality
5. **Ministry Instrument Alias Resolution** — Text values from department columns (כלי הקשה, כלי פריטה, כלי נשיפה, etc.) resolved via alias map with department tracking and text normalization
6. **Start Date Calculation** — studyYears from Ministry Excel converted to root-level startDate on student documents (January 1st of currentYear - studyYears)

### Requirements

- 13/13 v1.2 requirements satisfied (100%)
- See: `.planning/milestones/v1.2-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.2-MILESTONE-AUDIT.md`

---

## v1.3 — Conservatory Information Import

**Shipped:** 2026-02-28
**Phases:** 3 (20-22)
**Plans:** 3
**Timeline:** 2 days (2026-02-27 → 2026-02-28)
**Commits:** 11
**Backend files modified:** 13 (+1,553 / -248 lines)

### Accomplishments

1. **Conservatory Excel Parser** — Form-style Ministry Excel parser using fixed cell addresses with SheetJS, reading 21 fields from label/value pair layout with formula/richText/date handling
2. **Import Preview + Execute** — Side-by-side diff of current vs imported conservatoryProfile fields, merge-based execute preserving manually-entered fields, integrated into existing import dispatcher
3. **Conservatory Import Frontend** — Third "פרטי קונסרבטוריון" tab on import page with upload, diff table (amber highlights for changes), and success confirmation
4. **Settings Page Expansion** — All 19 conservatoryProfile fields displayed and editable on settings page, organized in logical sections (identification, classification, supervision, contact, location)
5. **Ministry Export Profile Sheet** — "פרטי_קונסרבטוריון" sheet added to Ministry export workbook with form-style layout matching Ministry template, including summary statistics
6. **Parser Hardening** — Switched from ExcelJS to SheetJS for reliable formula result extraction, fixed Date handling and null cell values

### Requirements

- 9/9 v1.3 requirements satisfied (100%)
- See: `.planning/milestones/v1.3-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.3-ROADMAP.md`
- Requirements: `.planning/milestones/v1.3-REQUIREMENTS.md`

---


## v1.4 — Ensemble Import

**Shipped:** 2026-03-01
**Phases:** 4 (23-26)
**Plans:** 6
**Tasks:** 10
**Timeline:** 1 day (2026-02-28)
**Backend commits:** 8
**Backend files modified:** 13 (+2,815 / -54 lines)
**Frontend files modified:** 1 (ImportData.tsx)

### Accomplishments

1. **Ensemble Excel Sheet Parser** — Fixed-position column parser for Ministry "הרכבי ביצוע" sheet with Hebrew name decomposition (type/subType/performanceLevel), time serial conversion, cell-color performance level detection, and analytics mini-table extraction
2. **Ensemble Preview with Matching** — Conductor name-to-teacher cache matching (resolved/ambiguous/unresolved), exact-criteria orchestra matching with field-level change detection, schedule diff, and import_log persistence
3. **Bulk Ensemble Execute** — insertMany for new orchestras, bulkWrite for updates (preserving memberIds), $addToSet conductor linking, partial results tracking with skip reasons, tenant+year scoped
4. **Ensemble Import Frontend Tab** — 4th "הרכבים" tab on import page with upload-preview-results flow, conductor match badges (green/red/amber), and orchestra diff highlighting
5. **Student-Orchestra Linking** — Ensemble column detection (9 columns) in student import, orchestra name matching with geresh normalization, bulk dual $addToSet enrollment, idempotent re-import
6. **Frontend Orchestra Badges** — Orchestra match summary cards, per-student green/amber badges, purple link count stat card in student import results

### Requirements

- 24/24 v1.4 requirements satisfied (100%)
- See: `.planning/milestones/v1.4-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.4-ROADMAP.md`
- Requirements: `.planning/milestones/v1.4-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.4-MILESTONE-AUDIT.md`

---


## v1.5 — Privacy Compliance Foundation

**Shipped:** 2026-03-02
**Phases:** 4 (27-30)
**Plans:** 11
**Timeline:** 1 day (2026-03-02)

### Accomplishments

1. **Data Inventory & System Mapping** — Complete data flow mapping, collection-level inventory, third-party service catalog, and data classification for all PII/minors' data
2. **Governance Framework** — Security Officer appointment, privacy policy, information security policy, and access control procedures per Israeli Privacy Protection Regulations (2017)
3. **Operational Procedures** — Incident response plan, data breach notification procedures, data subject rights handling, and retention/deletion policies
4. **Audit Program** — Supplementary policies (encryption, backup, change management), internal audit program with 4-tier Minimal Safe Launch criteria for minors' data platform

### Requirements

- 32/32 v1.5 requirements satisfied (100%)
- See: `.planning/milestones/v1.5-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.5-ROADMAP.md`
- Requirements: `.planning/milestones/v1.5-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.6 — Room & Hours Management Table

**Shipped:** 2026-03-04
**Phases:** 8 (31-38)
**Plans:** 26
**Timeline:** 2 days (2026-03-03 → 2026-03-04)

### Accomplishments

1. **Room Data Foundation** — Room CRUD API with schema validation, seed data generation, and room management UI
2. **Room Schedule API & Conflict Detection** — Weekly schedule grid with time-slot conflict detection, teacher/room double-booking prevention
3. **Room Grid UI** — Read-only room schedule grid, interactive drag-and-drop lesson placement, week overview with color-coded occupancy
4. **Grid Interaction & Polish** — Click-to-assign, drag-to-move, conflict warnings, teacher schedule data seeding from existing time blocks
5. **UX Fixes & Conflict Prevention** — 9-plan wave fixing edge cases: overlap detection, resize behavior, empty slot handling, mobile responsiveness
6. **Single-Lesson Reschedule** — Detail modal for individual lesson slots with reschedule capability and conflict checking

### Archive

- Roadmap: `.planning/milestones/v1.6-ROADMAP.md`

---

## v1.7 — RBAC & Admin Provisioning

**Shipped:** 2026-03-06
**Phases:** 10 (39-48)
**Plans:** 15
**Timeline:** 2 days (2026-03-05 → 2026-03-06)
**Commits:** ~69

### Accomplishments

1. **Hybrid RBAC Engine** — 13 roles across 4 tiers (admin/coordinator/teaching/view-only) with per-tenant customizable permission matrix stored on tenant.rolePermissions, falling back to frozen DEFAULT_ROLE_PERMISSIONS
2. **requirePermission Middleware** — Domain/action/scope model replacing requireAuth on all routes, with union-merged multi-role resolution (most permissive scope wins)
3. **Department-Scoped Coordinators** — coordinatorDepartments[] field with buildScopedFilter integration filtering students by instrument department
4. **Transactional Admin Provisioning** — Single-form tenant + admin creation in MongoDB transaction with default password and requiresPasswordChange
5. **Settings UI** — Staff role assignment table with edit modal, permission matrix editor with scope cycling, reset-to-defaults, and locked domain indicators
6. **Super Admin Tenant Admin Management** — Dedicated page for viewing/editing tenant admins with password reset capability

### Requirements

- 24/24 v1.7 requirements satisfied (100%, 1 dropped — SAFE-03)
- See: `.planning/milestones/v1.7-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.7-ROADMAP.md`
- Requirements: `.planning/milestones/v1.7-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.7-MILESTONE-AUDIT.md`

---

## v1.8 — Admin Report Generator

**Shipped:** 2026-03-07
**Phases:** 8 (49-56)
**Plans:** 16
**Timeline:** 2 days (2026-03-06 → 2026-03-07)
**Commits:** 45

### Accomplishments

1. **Plugin-Based Report Infrastructure** — Auto-discovery generator registry, strict contract validation (metadata/columns/rows/summary), role-based scope builder (all/department/own), server-driven pagination and sorting with Hebrew locale
2. **18 Report Generators Across 4 Categories** — Teacher Workforce (hours summary, workload distribution, salary projection, roster), Student Activity (enrollment, attendance, assignments, orchestra participation), Institutional/Ministry (year-over-year, Ministry readiness audit, data quality, import history), Department/Schedule (overview, comparison, room utilization, schedule density, orchestra/theory schedule)
3. **Excel & PDF Export Engines** — Separate data shaping per format (EXPO-03), Excel with Hebrew headers and typed formatting, PDF with pdfkit using Reisinger-Yonatan TTF font for Hebrew RTL, conservatory header/footer, A4 landscape with page numbering
4. **KPI Dashboard with Alerts** — 6 metric cards with trend indicators (delta from comparison period), drill-down navigation to detailed reports, anomaly alerts (idle teachers, unassigned students, stale imports, data quality issues)
5. **Categorized Report Catalog** — 4-category grouping (Teacher, Student, Institutional, Department/Schedule) with role-filtered visibility, permission-based report access
6. **Frontend Reports UI** — ReportsPage with dashboard + catalog, ReportViewerShell with shared filters bar and export buttons, DefaultTableRenderer for any report, custom renderers (TeacherHoursChart bar chart, MinistryReadinessGauge SVG), year comparison toggle with side-by-side tables

### Requirements

- 38/38 v1.8 requirements satisfied (100%)
- See: `.planning/milestones/v1.8-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.8-ROADMAP.md`
- Requirements: `.planning/milestones/v1.8-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.8-MILESTONE-AUDIT.md`

---

## v1.9 — Rehearsals, Orchestras & Attendance Upgrade

**Shipped:** 2026-03-08
**Phases:** 9 (57-65)
**Plans:** 19
**Timeline:** 2 days (2026-03-07 -> 2026-03-08)
**Commits:** 64
**Files modified:** 61 (+7,555 / -569 lines)

### Accomplishments

1. **Transactional Rehearsal-Orchestra Sync** — Rehearsal CRUD atomically maintains bidirectional orchestra.rehearsalIds via withTransaction, with cascade cleanup on orchestra deactivation eliminating orphan references
2. **Cross-Source Conflict Detection Engine** — Room and teacher conflict detection across rehearsals, theory lessons, and time blocks with parallel 6-query architecture, 409 responses with actionable details, and bulk creation pre-validation
3. **Single Source of Truth Attendance Layer** — activity_attendance as canonical collection with transactional writes, membership validation, 3 statuses (present/absent/late with late counting as present for Ministry), and soft-delete on rehearsal removal
4. **Modern Attendance-Taking UX** — Tap-to-cycle status badges, 1500ms debounce auto-save, smart suggestions based on historical attendance rates, batch mark-all operations, per-student notes with animated expand, and orchestra grouping
5. **Interactive Rehearsal Calendar** — Month/week/day views with HTML5 native drag-and-drop rescheduling, conflict badges, attendance indicators, click-to-create from empty slots, orchestra/conductor/room/type filtering, and 15-minute snap grid
6. **Configurable Attendance Alerts & Dashboard** — Per-tenant absence thresholds (consecutive + rate), auto-flagging service, admin dashboard with Recharts trend charts, per-orchestra drill-down, student profile attendance widget, and conductor warning badges

### Requirements

- 28/28 v1.9 requirements satisfied (100%)
- See: `.planning/milestones/v1.9-REQUIREMENTS.md`

### Archive

- Roadmap: `.planning/milestones/v1.9-ROADMAP.md`
- Requirements: `.planning/milestones/v1.9-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.9-MILESTONE-AUDIT.md`

---
