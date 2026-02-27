# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** Import Data Quality — Phase 19 complete (stage validation, instrument alias, department tracking, start date calculation)

## Current Position

Phase: 19 — Import Data Quality (COMPLETE)
Plan: 02 (complete)
Status: Phase 19 complete (all plans: 01 + 02)
Last activity: 2026-02-27 — Phase 19-02 executed (start date calculation from studyYears)

Progress: [##################░░] 88% (46/TBD plans — v1.0: 25, v1.1: 13, v1.2: 6, v1.3: 2/TBD)

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
- Total plans completed: 6
- Phases: 4 (15-18), all complete — Phase 15 (01), Phase 16 (01+02), Phase 17 (01+02), Phase 18 (01)
- Requirements: 13/13 satisfied (BUGF-01, BGRT-01, BGRT-02, IQAL-01, IQAL-02, IQAL-03, IQAL-04, TLNK-01, TLNK-02, TLNK-03, FEPV-01, FEPV-02, FEPV-03)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 15-01 | Bug fix + column map | 4min | 2 | 2 |
| 16-01 | Preview enrichment | 3min | 2 | 2 |
| 16-02 | Execute import enrichment | 12min | 2 | 1 |
| 17-01 | Teacher name matching in preview | 3min | 2 | 1 |
| 17-02 | Teacher assignment creation in execute | 3min | 2 | 1 |
| 18-01 | Frontend preview enhancement | 10min | 2 | 1 |
| 19-01 | Stage validation + instrument alias + department | 4min | 2 | 3 |
| 19-02 | Start date calculation from studyYears | 3min | 2 | 2 |

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
- Phase 17-02: Separate updateOne for teacherAssignment $push -- avoids $push conflict with instrumentProgress, keeps filter-based duplicate check clean
- Phase 17-02: Students with no field changes but resolved teacher match are processed (modified early-continue guard)
- Phase 17-02: Dead teacherName skip code removed from execute loop (Plan 01 already removed teacherName from changes)
- Phase 18-01: Used (previewData.preview as any).teacherMatchSummary to avoid modifying PreviewData interface — consistent with existing any usage
- Phase 18-01: Teacher match badge hidden for status 'none' — rows with no teacher name data show no badge
- Phase 18-01: Student preview helpers follow same top-level function pattern as teacher helpers (formatStudentChange mirrors formatTeacherChange)

v1.3 decisions:
- Phase 19-01: Stage 0 added to VALID_STAGES (0-8) for students not yet assigned a stage level
- Phase 19-01: ministryLevelToStage auto-conversion removed -- raw ministry level stored, teacher sets numeric stage manually
- Phase 19-01: readInstrumentMatrix returns {instrumentName, department} objects -- teacher path maps back to strings for backward compat
- Phase 19-01: Department on instrumentProgress resolved from import context first, INSTRUMENT_MAP fallback second
- Phase 19-02: startDate is root-level field on student document (not nested under academicInfo) -- represents conservatory start date
- Phase 19-02: Schema default is null (not new Date()) -- only import populates from studyYears
- Phase 19-02: Import fallback to new Date() only when studyYears missing or invalid
- Phase 19-02: Year-only comparison for startDate changes avoids timezone mismatches

### Roadmap Evolution

- Phase 19 added: Import Data Quality — stage levels, instrument sections, start date calculation

### Pending Todos

None.

### Blockers/Concerns

- ~~`detectInstrumentColumns` bug (BUGF-01) blocks all instrument-related work~~ RESOLVED in Phase 15-01
- ~~`teacherAssignment` Joi schema requires day/time that Ministry files lack — import must bypass Joi and write directly via MongoDB `$push`. (Phase 17 concern)~~ RESOLVED in Phase 17-02: assignments omit day/time/duration, written directly via $push

## Session Continuity

Last session: 2026-02-27 (Phase 19-02 executed)
Stopped at: Completed 19-02-PLAN.md (start date calculation from studyYears)
Resume: Phase 19 complete (both plans). Ready for next phase.
