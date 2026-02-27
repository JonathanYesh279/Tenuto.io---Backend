# Tenuto.io — Multi-Tenant Music School Management Platform

## What This Is

A multi-tenant SaaS platform for Israeli music conservatories (Node.js + Express + MongoDB backend, React + TypeScript frontend). Manages teachers, students, lessons, orchestras, theory classes, bagrut programs, schedules, and Ministry of Education reporting. Features 5-layer tenant isolation, a super admin platform for tenant CRUD/reporting/impersonation, and enriched import from Ministry Excel files for both teachers and students.

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

### Active

No active requirements. Next milestone not yet defined.

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

**Current state:** v1.2 shipped. Backend has ~93,000 LOC JavaScript. Frontend has React 18 + TypeScript + Vite + Tailwind. Super admin has a complete platform management dashboard. Student import from Ministry Excel now matches teacher import quality with instrument detection, teacher linking, stage tracking, department tracking, bagrut flagging, start date calculation, and enriched frontend preview.

**Tech stack:** Node.js + Express + MongoDB native driver (no Mongoose). React 18 + TypeScript + Vite + Tailwind CSS. Vitest + MongoDB Memory Server for testing. GitHub Actions CI pipeline.

**Known tech debt:**
- 4 controllers still expose err.message in 500 responses (schedule, super-admin, tenant, attendance)
- Placeholder for orphan detection logic in cascade-deletion.service.js
- Two cascade deletion systems coexist (re-export wrapper consolidation, not full merge)
- Backward compat shims in getCurrentSchoolYear and getTeacherByRole
- `/api/super-admin/seed` has no rate-limit or environment guard
- `time_block`, `privateAttendance`, `privateLessons` collections not in TENANT_SCOPED_COLLECTIONS (use teacherId/studentId FK)
- `previewStudentImport` uses `Object.keys(rows[0])` for instrument headers instead of `parsedHeaders` (may miss columns empty in first row)
- `startDate` missing Hebrew label in `formatStudentChange` fieldLabels map
- `ministryLevelToStage()` exported but unused (intentional orphan after Phase 19 design change)

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

---
*Last updated: 2026-02-27 after v1.2 milestone completed*
