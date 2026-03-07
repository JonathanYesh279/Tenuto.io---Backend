# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v1.9 Rehearsals, Orchestras & Attendance Upgrade — Phase 62

## Current Position

Phase: 62 of 63 (Rehearsal Calendar UX)
Plan: 3/3 complete
Status: Phase 62 complete (gap closure done)
Last activity: 2026-03-07 — Completed 62-03-PLAN.md (gap closure)

Progress: [█████████░] ~86% (v1.9)

## Performance Metrics

**All milestones:** 56 phases, 119 plans across 9 milestones
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)
**v1.6:** 26 plans, 8 phases, 2 days (2026-03-03 -> 2026-03-04)
**v1.7:** 15 plans, 10 phases, 2 days (2026-03-05 -> 2026-03-06)
**v1.8:** 16 plans, 8 phases, 2 days (2026-03-06 -> 2026-03-07)

## Accumulated Context

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config.

### Decisions

- **[57-01]** Use withTransaction utility for all rehearsal write operations instead of manual session management
- **[57-01]** Remove all non-transactional fallback code paths -- withTransaction always has client
- **[57-01]** Remove all silent error swallowing on orchestra sync -- transaction atomicity handles failures
- **[57-02]** Hard-delete rehearsals on orchestra deactivation (consistent with removeRehearsal pattern)
- **[57-02]** All orchestra mutation functions (add, update, remove) wrapped in withTransaction
- **[58-01]** Separate rehearsalConflictService.js rather than extending theory-specific conflictDetectionService.js
- **[58-01]** Parallel Promise.all for all 6 conflict queries (3 room + 3 teacher) for performance
- **[58-01]** CONFLICT error code pattern with 409 HTTP response for scheduling conflicts
- **[58-02]** Preserve BULK_CONFLICT error through service catch block (re-throw instead of wrapping)
- **[58-02]** Sequential per-date conflict checks acceptable for typical 30-40 date bulk creation
- **[59-01]** Per-student records schema replaces old present/absent arrays for attendance input
- **[59-01]** Membership validation rejects entire request if any student is not a member (no partial writes)
- **[59-01]** activity_attendance uses rehearsal.type dynamically for activityType (supports both orchestra and ensemble)
- **[59-02]** Soft-delete attendance records with isArchived:true instead of hard-delete on rehearsal removal
- **[59-02]** Orchestra attendance write path delegates to canonical rehearsal.updateAttendance (no duplicate logic)
- **[59-02]** Late (איחור) counts as present in all Ministry reporting and attendance rate calculations
- **[60-01]** Minimum 3 rehearsals threshold before flagging frequentAbsent to avoid false positives on new members
- **[60-01]** Reuse MINISTRY_PRESENT_STATUSES for present counting consistency with existing getStudentAttendanceStats
- **[60-02]** Auto-save debounce at 1500ms with hasInteracted guard to prevent saving on initial render
- **[60-02]** STATUS_CYCLE array with modulo wrap for tap-to-cycle through fixed status sequence
- **[60-02]** Attendance summary in details page now shows late count alongside present/absent
- **[61-01]** Take Attendance button shown for all past rehearsals (not just those with existing attendance)
- **[61-01]** preselectedOrchestraId passed via navigate state for Add Rehearsal button
- **[62-01]** HTML5 native drag-and-drop (no library) for rehearsal rescheduling
- **[62-01]** Day view shows 07:00-22:00 with 60px per hour for clear time-slot visibility
- **[62-01]** Pre-fill uses existing initialData prop without groupId to avoid triggering edit mode
- **[62-01]** Week view drag changes date only; day view drag changes both date and time
- **[62-02]** Group rehearsals by date for O(n) conflict detection instead of O(n^2) pairwise comparison
- **[62-02]** Conflict badges use ring-2 + WarningIcon overlay for visibility on colored card backgrounds
- **[62-02]** Attendance badges shown on all past rehearsals regardless of card variant (minimal, compact, full)
- **[62-03]** Check initialData?.groupId (not !!initialData) to distinguish pre-fill create mode from edit mode
- **[62-03]** Use Hebrew type values in activity type filter to match existing rehearsal.type field

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 62-03-PLAN.md (phase 62 gap closure complete)
Resume: /gsd:execute-phase 63
