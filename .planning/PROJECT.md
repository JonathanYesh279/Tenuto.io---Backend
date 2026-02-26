# Tenuto.io — Multi-Tenant Music School Management Platform

## What This Is

A multi-tenant SaaS platform for Israeli music conservatories (Node.js + Express + MongoDB backend, React + TypeScript frontend). Manages teachers, students, lessons, orchestras, theory classes, bagrut programs, schedules, and Ministry of Education reporting. Features 5-layer tenant isolation, a super admin platform for tenant CRUD/reporting/impersonation, and a dedicated super admin frontend dashboard.

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

### Active

#### Current Milestone: v1.2 — Student Import Enhancement

**Goal:** Enhance the existing student import from Ministry Excel files to support teacher linking, proper instrument progress, ministry stage levels, bagrut flags, and polished frontend preview.

**Target features:**
- Teacher-student linking from "המורה" column (match to existing teachers, create teacherAssignment)
- Proper instrumentProgress entries with stage tracking (not flat instrument field)
- Ministry stage level (שלב א/ב/ג) stored on instrumentProgress
- Bagrut program flag for מגמת מוסיקה students
- Enhanced frontend preview matching teacher import quality
- Improved change detection and field display for student imports

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
- Orchestra/ensemble auto-assignment from import — future feature (stage-level-based matching in orchestra service)
- Theory class enrollment from import — requires matching to existing theory lesson documents
- Full bagrut record creation from import — only flag enrollment, manual setup for program details

## Context

**Current state:** v1.1 shipped. Backend has 90,546 LOC JavaScript. Frontend has React 18 + TypeScript + Vite + Tailwind. Super admin has a complete platform management dashboard with tenant CRUD, reporting, impersonation, and admin management. Basic student import exists (name, class, studyYears, instrument, age) but lacks teacher linking, instrumentProgress, and enriched preview.

**Tech stack:** Node.js + Express + MongoDB native driver (no Mongoose). React 18 + TypeScript + Vite + Tailwind CSS. Vitest + MongoDB Memory Server for testing. GitHub Actions CI pipeline.

**Known tech debt:**
- 4 controllers still expose err.message in 500 responses (schedule, super-admin, tenant, attendance)
- Placeholder for orphan detection logic in cascade-deletion.service.js
- Two cascade deletion systems coexist (re-export wrapper consolidation, not full merge)
- Backward compat shims in getCurrentSchoolYear and getTeacherByRole
- `/api/super-admin/seed` has no rate-limit or environment guard
- `time_block`, `privateAttendance`, `privateLessons` collections not in TENANT_SCOPED_COLLECTIONS (use teacherId/studentId FK)

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

---
*Last updated: 2026-02-26 after v1.2 milestone started*
