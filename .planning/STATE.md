# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v1.8 Admin Report Generator — Phase 51 (Student Activity Generators)

## Current Position

Phase: 51 of 56 (Student Activity Generators)
Plan: 2 of TBD in current phase
Status: Executing
Last activity: 2026-03-07 — Plan 51-02 complete (attendance + orchestra participation generators)

Progress: [███░░░░░░░] 25%

## Performance Metrics

**All milestones:** 50 phases, 112 plans across 8 milestones
**v1.8 (50-01):** 2min, 2 tasks, 2 files
**v1.8 (50-02):** 2min, 2 tasks, 2 files
**v1.8 (51-01):** 1min, 2 tasks, 2 files
**v1.8 (51-02):** 2min, 2 tasks, 2 files
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)
**v1.6:** 26 plans, 8 phases, 2 days (2026-03-03 -> 2026-03-04)
**v1.7:** 15 plans, 10 phases, 2 days (2026-03-05 -> 2026-03-06)

## Accumulated Context

### Decisions

- **[49-01]** Generator plugin convention: `{id}.generator.js` default export with id/name/category/roles/generate
- **[49-01]** Scope builder returns typed scope objects (all/department/own) so generators are role-unaware
- **[49-01]** Underscore-prefixed generators skipped in production (dev/test stubs only)
- **[49-02]** Report-specific params validated against generator.params with type coercion and allowed-values
- **[49-02]** Sorting in-memory after generator returns, before pagination slice
- **[49-02]** loadGenerators() called on startup after MongoDB init
- **[50-01]** Hours data sourced from pre-computed hours_summary collection, not calculated on-the-fly
- **[50-01]** Department filtering resolves teacher instruments to departments via getInstrumentDepartment()
- **[50-02]** Salary projection uses hardcoded MoE reference rates with classification x degree matrix
- **[50-02]** Monthly = weekly * 4.33, annual = monthly * 10 (school year convention)
- **[50-02]** Roster queries teacher collection directly (not hours_summary) for complete listing
- **[51-01]** Primary instrument resolved from instrumentProgress with isPrimary flag, fallback to first entry
- **[51-01]** Assignments generator: one row per active assignment, unassigned students get single placeholder row
- **[51-01]** Bulk teacher fetch pattern: collect IDs from assignments, single $in query, build lookup map
- **[51-02]** Attendance: query activity_attendance directly for bulk aggregation (not analytics service)
- **[51-02]** Trend: 10-record window, split recent-5 vs older-5, 10% threshold for improving/declining
- **[51-02]** Orchestra membership: build full map from all orchestras even when filtering by orchestraId

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 51-02-PLAN.md (student attendance + orchestra participation generators)
Resume: Continue with next plan in phase 51 or run `/gsd:execute-phase 51` for remaining plans
