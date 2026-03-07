# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v1.8 Admin Report Generator — Phase 56

## Current Position

Phase: 56 of 56
Plan: 2 of 2
Status: Phase 56 Complete
Last activity: 2026-03-07 — Plan 56-02 complete (Report Viewer Enhancements)

Progress: [██████████] 100%

## Performance Metrics

**All milestones:** 50 phases, 114 plans across 8 milestones
**v1.8 (50-01):** 2min, 2 tasks, 2 files
**v1.8 (50-02):** 2min, 2 tasks, 2 files
**v1.8 (51-01):** 1min, 2 tasks, 2 files
**v1.8 (51-02):** 2min, 2 tasks, 2 files
**v1.8 (52-01):** 1min, 2 tasks, 2 files
**v1.8 (52-02):** 3min, 2 tasks, 2 files
**v1.8 (53-01):** 1min, 2 tasks, 2 files
**v1.8 (53-02):** 3min, 3 tasks, 3 files
**v1.8 (54-01):** 3min, 3 tasks, 3 files
**v1.8 (54-02):** 3min, 2 tasks, 2 files
**v1.8 (55-01):** 3min, 2 tasks, 3 files
**v1.8 (55-02):** 1min, 2 tasks, 2 files
**v1.8 (56-01):** 3min, 2 tasks, 8 files
**v1.8 (56-02):** 4min, 2 tasks, 6 files
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
- **[52-01]** Year-over-year metrics from hours_summary + orchestra (year-scoped) + student (tenant-wide)
- **[52-01]** Institutional generators return empty for 'own' scope (not meaningful per-teacher)
- **[52-02]** Ministry audit delegates to exportService rather than reimplementing completion logic
- **[52-02]** Data quality generator queries collections directly for anomaly detection
- **[52-02]** Empty orchestras category also flags missing conductors
- **[53-01]** Teachers with multiple instruments counted in each corresponding department
- **[53-01]** Orchestra count column in overview set to 0 (no reliable orchestra-to-department mapping)
- **[53-01]** Percentage distribution uses filtered department totals for accurate within-scope distribution
- **[53-02]** Room utilization queries three data sources directly (no roomScheduleService dependency)
- **[53-02]** Peak hour computed by counting overlapping activities per hour slot 08-19
- **[53-02]** Schedule density gap analysis groups blocks by day, sorts by startTime, measures inter-block gaps
- **[53-02]** Schedule overview deduplicates rehearsals by groupId+day+time+location composite key
- **[54-01]** Excel shaper intentionally separate from contract.shapeResponse (EXPO-03 requirement)
- **[54-01]** Export uses limit=99999 to get all rows through existing orchestrator pipeline
- **[54-01]** Percentage values divided by 100 for Excel numFmt compatibility
- **[54-02]** Used pdfkit for PDF generation (lightweight, no headless browser dependency)
- **[54-02]** Reisinger-Yonatan TTF font for Hebrew RTL text rendering in PDFs
- **[54-02]** A4 landscape layout with buffered pages for post-render page numbering
- **[55-01]** Idle teacher count via aggregation pipeline (unwind teacherAssignments, collect assigned IDs, subtract from total)
- **[55-01]** Data quality score = 100 minus high-severity anomaly count (unassigned students + idle teachers), floored at 0
- **[55-01]** Previous school year found by sorting school_year by createdAt desc, picking one after current index
- **[55-02]** getCatalog imported directly from registry (pure metadata function, orchestrator pass-through adds no value)
- **[55-02]** 5 generator categories merged into 4 catalog categories: department+schedule become department-schedule
- **[55-02]** Empty categories omitted from response (role-filtered)
- **[56-01]** Used existing StatsCard for KPI cards, leveraging entity color system
- **[56-01]** Custom HTML table for DefaultTableRenderer (existing Table component too opinionated)
- **[56-01]** Cell alignment RTL convention: numbers left-aligned, text right-aligned
- **[56-02]** Lazy-load custom renderers to avoid bundle bloat for reports without charts
- **[56-02]** SVG gauge built without library (simple circle + stroke-dasharray/offset)
- **[56-02]** Year comparison toggle always visible — backend ignores param if unsupported
- **[56-02]** Top 15 teachers limit in bar chart to prevent overcrowded visualization

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 56-02-PLAN.md (Report Viewer Enhancements — phase 56 complete)
Resume: v1.8 milestone complete
