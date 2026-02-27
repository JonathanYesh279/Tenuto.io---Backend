# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v1.2 Student Import Enhancement — Phase 17 (Teacher-Student Linking)

## Current Position

Phase: 17 — third of 4 phases in v1.2
Plan: 01 (complete)
Status: Plan 17-01 complete, Plan 17-02 ready
Last activity: 2026-02-27 — Phase 17-01 executed (teacher name matching in preview)

Progress: [#################░░░] 81% (42/TBD plans — v1.0: 25, v1.1: 13, v1.2: 4/TBD)

## Performance Metrics

**v1.0 Milestone:**
- Total plans completed: 25
- Total phases: 9
- Average duration: 6 min/plan
- Total execution time: 2.6 hours
- Timeline: 11 days (2026-02-14 -> 2026-02-24)

**v1.1 Milestone:**
- Total plans completed: 13
- Phases: 5 (10-14), all complete
- Requirements: 19/19 satisfied
- Timeline: 3 days (2026-02-24 -> 2026-02-26)

**v1.2 Milestone:**
- Total plans completed: 4
- Phases: 4 (15-18), Phase 15 complete, Phase 16 complete (01+02), Phase 17 in progress (01 done)
- Requirements: 7/13 satisfied (BUGF-01, BGRT-01, BGRT-02, IQAL-01, IQAL-02, IQAL-03, IQAL-04)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 15-01 | Bug fix + column map | 4min | 2 | 2 |
| 16-01 | Preview enrichment | 3min | 2 | 2 |
| 16-02 | Execute import enrichment | 12min | 2 | 1 |
| 17-01 | Teacher name matching in preview | 3min | 2 | 1 |

## Accumulated Context

### Decisions

All v1.0/v1.1 decisions archived in PROJECT.md Key Decisions table.

v1.2 decisions:
- Phase 15-01: isBagrutCandidate defaults to null (not false) for backward compat — null means "unknown/not imported"
- Phase 15-01: Both "מגמת מוסיקה" and "מגמה" map to isBagrutCandidate — no collision with teacher ROLE_COLUMN_NAMES (separate import paths)
- Phase 16 (planning): Replicate addStudent() logic inline rather than routing through strict Joi schema — avoids fighting required class/instrumentProgress fields when import data is partial
- Phase 16 (planning): ministryLevelToStage maps 'ב' to 4 (lowest in range 4-5) — safest default since stage progression is upward
- Phase 16 (planning): Matched student instrument changes update primary only via $set on .0. index — do NOT replace entire instrumentProgress array (preserves test history)
- Phase 16-01: Teacher name changes always push with oldValue: null — teacher matching deferred to Phase 17
- Phase 16-01: instrumentProgress[0] field naming convention in change objects maps to MongoDB $set dot notation in Plan 02
- Phase 16-02: Dynamic import for schoolYearService matches existing addStudent() pattern
- Phase 16-02: teacherName changes skipped in execute (display-only, Phase 17 handles linking)
- Phase 16-02: Empty instrumentProgress[] acceptable for new students without valid instrument (bypasses Joi)
- Phase 16-02: Age field placed on personalInfo (not academicInfo) for new students to match canonical schema
- Phase 17-01: matchTeacherByName tries both firstName+lastName orderings (Hebrew names have no standard ordering)
- Phase 17-01: Single-word names match against either firstName or lastName individually
- Phase 17-01: teacherName removed from calculateStudentChanges -- teacher matching now via teacherMatch on preview entries

### Pending Todos

None.

### Blockers/Concerns

- ~~`detectInstrumentColumns` bug (BUGF-01) blocks all instrument-related work~~ RESOLVED in Phase 15-01
- `teacherAssignment` Joi schema requires day/time that Ministry files lack — import must bypass Joi and write directly via MongoDB `$push`. (Phase 17 concern)

## Session Continuity

Last session: 2026-02-27 (Phase 17-01 executed)
Stopped at: Completed 17-01-PLAN.md (teacher name matching in preview)
Resume: Execute 17-02-PLAN.md (teacher assignment creation during execute)
