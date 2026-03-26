# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v2.1 Entity Page Consistency — IN PROGRESS

## Current Position

Phase: 84 of 84 (Theory Lesson Course Architecture)
Plan: 2 of 3 in current phase
Status: Plan 84-02 COMPLETE — course API routes, controller functions, enhanced bulkCreate
Last activity: 2026-03-26 — Plan 84-02 executed (2 tasks, 2 commits, 5 files)

Progress: [####################] 67% (v2.1 Phase 84 — 2/3 plans)

## Performance Metrics

**All milestones:** 83 phases, 171 plans across 12 milestones
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)
**v1.6:** 26 plans, 8 phases, 2 days (2026-03-03 -> 2026-03-04)
**v1.7:** 15 plans, 10 phases, 2 days (2026-03-05 -> 2026-03-06)
**v1.8:** 16 plans, 8 phases, 2 days (2026-03-06 -> 2026-03-07)
**v1.9:** 19 plans, 9 phases, 1 day (2026-03-07 -> 2026-03-08)
**v2.0:** 7 plans, 4 phases, 2 days (2026-03-10 -> 2026-03-11)

## Accumulated Context

### Decisions

- **[v2.0]** Token-first approach — define design tokens before migrating components
- **[v2.0]** Infrastructure only — update token system and shared components, don't touch individual pages
- **[v2.0]** Only ADD new CSS variable names — never change existing `:root` values (prior revert was caused by global changes)
- **[v2.0]** Primary color collision (CLR-01) is Phase 66 first plan — root blocker, must resolve before any visual cascade
- **[66-01]** primary-500 = #6366f1 (indigo), matching --primary CSS var — CLR-01 collision resolved
- **[66-01]** neutral scale uses direct var() refs (CSS vars already contain hsl() values)
- **[66-01]** warning/info have DEFAULT+foreground only — orange palette covers hex shade needs
- **[66-02]** Spacing values derived from current usage: page=24px, section=32px, card=24px, element=12px
- **[66-02]** Typography line heights Hebrew-optimized: 1.3-1.4 headings, 1.5-1.6 body
- **[66-02]** Table density tokens placed in spacing config for utility class flexibility
- **[67-01]** Semantic tokens (text-foreground, text-muted-foreground) preferred over neutral-NNN for dialog text
- **[67-01]** CVA Card variants: default=shadow-1, elevated=shadow-2, outlined=shadow-none+border-2
- **[67-01]** Graduated/pending badge variants kept as-is (no semantic token equivalents)
- **[67-02]** ActionButton delegates to CVA Button with variant/size mapping (single canonical button)
- **[67-02]** Dialog gap-4 kept as-is (no exact token match; spacing-element too tight, spacing-card too wide)
- **[67-02]** DialogTitle text-h3 is deliberate 2px increase (18->20px) for Hebrew readability
- **[67-03]** Calendar orange/purple event colors kept as raw Tailwind (no semantic equivalents)
- **[67-03]** ConfirmDeleteDialog severity colors (red/yellow/blue) are domain-specific, not migration targets
- **[67-03]** All 7 Phase 67 success criteria verified passing
- **[68-01]** No padding on PageShell — Layout.tsx already provides p-6, avoids double-padding bug
- **[68-01]** SectionWrapper uses semantic section element with h2 for title
- **[68-01]** FormLayout defaults to 2-column responsive grid
- **[69-01]** tailwind.config.js addComponents block left out of scope — used by Tailwind build step, not CSS dead code
- **[69-02]** All 4 remaining workaround CSS files classified as Permanent Exceptions — no migration targets remain
- **[69-02]** Permanent Exception header format established: FILE, STATUS, AUDITED, PURPOSE, WHY OVERRIDE CSS, COMPONENTS USING THIS FILE, MIGRATION NOTES
- **[v2.0]** v1.9 archived as-is with phases 61-65 deferred/completed outside GSD tracking
- **[v2.0]** All work in frontend repo: `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src`
- **[70-01]** MongoDB $inc for loginCount — auto-creates field on first increment, no migration needed
- **[70-01]** loginCount/lastLogin extracted in enrichment layer, not query projection
- **[70-02]** Full client-side pagination (20/page) replacing server-side load-more for Teachers page
- **[70-02]** Entity page restyle pattern established: GlassStatCard + GlassSelect + SearchInput + HeroUI Table/Pagination
- **[71-01]** Tab navigation kept as styled buttons (not HeroButton) for consistent toggle pattern
- **[71-01]** Category badge in TheoryLessonCard uses bg-primary/10 for readability vs raw bg-primary
- **[71-02]** isActive boolean checkbox converted to GlassSelect dropdown (active/inactive/all) for consistency
- **[71-02]** Sort dropdown also converted to GlassSelect for visual consistency
- **[71-02]** View mode toggle restyled to pill pattern matching Teachers page
- **[72-01]** Dual-role check pattern for API-facing filters: roles.some(r => r === 'תאוריה' || r === 'מורה תאוריה')
- **[72-01]** TeacherForm uses only normalized role (VALID_ROLES already has 'תאוריה') -- no backward compat needed
- **[72-01]** Display-only color maps retain legacy role entries for backward compatibility
- **[72-02]** Remove inline auth checks entirely — RBAC middleware is the single authorization authority
- **[72-02]** Ministry mapper checks both normalized and legacy role strings (export reads raw DB data)
- **[73-01]** weeklyHoursSummary defaults to null (not empty object) to signal "not yet calculated"
- **[73-01]** Dual-write pattern: hours_summary collection keeps full breakdown, teacher doc gets flat totals for list display
- **[73-02]** Post-import recalculation is non-fatal — import success is independent of hours calculation
- **[73-02]** Per-teacher calculation (not bulk) after import to only process affected teachers
- **[73-02]** Dynamic imports for hoursSummaryService/schoolYearService to avoid circular dependencies
- **[73]** hours_summary collection NOT deprecated — it provides per-student/per-orchestra breakdowns that weeklyHoursSummary (flat totals) intentionally doesn't replicate
- **[74-01]** GlassStatCard extended with valueClassName prop for red overloaded count
- **[74-01]** weeklyHoursSummary.totalWeeklyHours used as data source, NOT totalTeachingHours (time blocks)
- **[74-01]** Client-side sorting via useMemo + sortDescriptor state for Teachers table
- **[74-03]** Auto-recalculation hook placed AFTER transaction commit — non-transactional, fire-and-forget
- **[74-03]** Dynamic import() pattern reused from Phase 73 for circular dependency avoidance
- **[74-02]** Sorting/slicing done in TeacherPerformanceTable, not Dashboard data construction
- **[74-02]** AdminHoursOverview removed (101 lines dead code) — superseded by table hours integration
- **[75-01]** attendanceCount.total uses records.length (all marked students including late), not present+absent sum
- **[75-01]** Frontend || fallback pattern for backward compat with rehearsals lacking server attendanceCount
- **[76-01]** attendanceAlertService follows thin wrapper pattern (no try/catch) -- apiClient handles errors
- **[76-01]** Sidebar smart-redirect for dual-role admins preserved -- only default fallback changed to /attendance
- **[76-02]** Renamed מסומנים to בסיכון (at-risk) for clearer Hebrew UX
- **[76-02]** Rehearsal sort: upcoming/today first (ascending), then past (descending)
- **[76-02]** Multi-select orchestra filter replaces single GlassSelect
- **[76-02]** Orchestra rows clickable (no actions column), rehearsal cards use motion.div bounce
- **[76-02]** Orchestra avatar: #46ab7d green with white icon; Student avatar: HeroUI User + getAvatarColorHex
- **[76-02]** Fixed critical bug: activity_attendance.date stored as ISO string, not BSON Date — date filters must use string comparison
- **[76-02]** Default attendance rate is null/0 when no records (not 100%)
- **[78-01]** moveActivity handles day changes ONLY for timeBlocks -- rehearsal/theory use their own update APIs
- **[78-01]** Cross-source conflict check is non-fatal (returns empty on error) to avoid blocking theory lesson creation
- **[78-01]** effectiveDay pattern: targetDay overrides numericDay when provided, falls back to current day otherwise
- **[78-02]** Rehearsal day change calculates target date from JS Date to maintain date/dayOfWeek consistency
- **[78-02]** Conflict preview is non-blocking warning (amber banner) — server-side check is authoritative
- **[78-02]** Cross-day conflict preview fetches target day schedule via getRoomSchedule with 300ms debounce
- **[79-01]** RehearsalForm props changed from onCancel to open+onOpenChange for Dialog-controlled pattern
- **[79-01]** Badge dismiss button kept as raw button inside Badge (plan-specified chip dismiss pattern)
- **[79-01]** renderSingleFormFields extracted as shared function for Tabs and edit-mode reuse
- **[79-01]** Location grouping extracted to reusable locationGroups array with filter functions
- **[80-01]** ChatCircleDotsIcon used for WhatsApp button (WhatsappLogoIcon unavailable in project Phosphor icons)
- **[80-01]** getAvatarColorHex from avatarColorHash.ts (not avatarColors.ts)
- **[80-01]** Theory lessons fetched globally then filtered client-side by studentId (no dedicated student theory endpoint)
- **[80-01]** Teacher map pattern: fetch teacher details once in data hook, pass Record<id, info> to child components
- **[80-02]** SummaryCards uses compact custom cards (not GlassStatCard) for 3-column fit
- **[80-02]** AttendanceChart uses Recharts LineChart directly for monthly trend (TremorBarChart/DonutChart don't support lines)
- **[80-03]** StudentDetailsPageSimple refactored from 7 shadcn tabs to 5 HeroUI Tabs (dashboard default)
- **[80-03]** Surviving tabs: Schedule, Bagrut, Orchestra, Theory — all wired with existing props unchanged
- **[81-01]** Live data only — student schedule endpoint reads from timeBlocks/rehearsals/theory_lesson, never from stale scheduleInfo snapshots
- **[81-01]** Legacy assignments without timeBlockId fall back to top-level day/time fields (NOT scheduleInfo)
- **[81-01]** moveActivity write-through updates location and day only — lesson times within block are independent
- **[81-01]** rescheduleLesson already covered by removeLessonFromBlock + assignLessonToBlock lifecycle
- **[81-01]** Orchestra membership checked via both enrollments.orchestraIds AND orchestra.memberIds
- **[81-02]** useStudentScheduleData hook uses apiService (not studentDetailsApi) — singleton token caching bug
- **[81-02]** student prop removed from ScheduleTab — all data from hook, 4 call sites updated
- **[81-02]** 30s staleTime for schedule data React Query cache
- **[82-01]** No refreshToken localStorage storage -- follows forcePasswordChange pattern (apiClient.setToken only)
- **[82-01]** Credentials tab after General tab, before role-specific tabs -- visible to all users
- **[82-02]** Admin stats fetched via existing list endpoints (getTeachers/getStudents/getOrchestras) with Promise.allSettled
- **[82-02]** Role info widget below stats in center-left column for at-a-glance role context
- **[82-02]** GeneralInfoTab emerald/red status colors are semantic feedback, not design token migration targets
- **[83-01]** All activity_attendance date filters must use toISOString() -- dates stored as ISO strings, not BSON Date objects
- **[83-01]** sessionId is the correct field name in activity_attendance (not activityId)
- **[83-02]** All frontend attendance status comparisons must use Hebrew strings ('הגיע/ה', 'לא הגיע/ה', 'איחור') — backend returns Hebrew
- **[83-02]** Streak calculation counts 'איחור' (late) as present — arriving late is still attendance
- **[83-02]** Absence reasons computed from record notes field, grouped under 'לא צוינה סיבה' when empty
- **[83-03]** Shared STATUS_MAP import from rehearsalUtils for all attendance components (not inline constants)
- **[84-01]** Use 'איחור' (not 'איחר/ה') for activity_attendance analytics — MINISTRY_PRESENT_STATUSES canonical; 'איחר/ה' is theory.service.js embedded object only
- **[84-01]** linkLessonsToCourse uses $addToSet with $each for idempotency — bulk lesson association after bulkCreate
- **[84-01]** Migration does NOT auto-group existing lessons — courseId: null until user assigns via endpoints
- **[84-02]** Course routes placed BEFORE /:id routes — prevents Express treating 'courses' as an ID value
- **[84-02]** Dynamic import() for theoryCourseService in bulkCreate — avoids circular dependency (same as Phase 73)
- **[84-02]** linkLessonsToCourse failure is non-fatal in bulkCreate — lesson courseId stamp is authoritative
- **[84-02]** courseId: null stamped on every lesson even when no course created — explicit over implicit

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config.

### Roadmap Evolution

- Phase 70 added: Teachers Page Restyle & Login Activity Badges (v2.1 Entity Page Consistency)
- Phase 71 added: Theory & Orchestra Pages Restyle (v2.1 Entity Page Consistency)
- Phase 72 added: Theory Lesson Entity Fixes & Role Normalization (v2.1 Entity Page Consistency)
- Phase 73 added: Teacher Hours Import Refactor (v2.1 Entity Page Consistency)
- Phase 74 added: Teacher Hours UI & Dashboard Integration (v2.1 Entity Page Consistency)
- Phase 75 added: Rehearsal Attendance Tracking (v2.1 Entity Page Consistency)
- Phase 76 added: Attendance Management Page (v2.1 Entity Page Consistency)
- Phase 77 added: Dashboard Chart UX Enhancement (v2.1 Entity Page Consistency)
- Phase 78 added: Full Activity Rescheduling — Day/Room/Time (v2.1 Entity Page Consistency)
- Phase 79 added: Rehearsal Form Redesign — shadcn Dialog + design system components (v2.1 Entity Page Consistency)
- Phase 80 added: Student Details UI/UX Refactor + image design to copy from (v2.1 Entity Page Consistency)
- Phase 81 added: Schedule Single Source of Truth — eliminate data inconsistency between student schedule and room schedule (v2.1 Entity Page Consistency)
- Phase 82 added: Profile Page Redesign & Credentials Management — gradient header, 3-column layout, password change, role-aware dashboard (v2.1 Entity Page Consistency)
- Phase 83 added: Attendance Feature Deep Review — cross-entity sync, UI completeness & data correctness (v2.1 Entity Page Consistency)
- Phase 84 added: Theory Lesson Course Architecture — recurring lesson grouping, shared student rosters, cross-session attendance analytics (v2.1 Entity Page Consistency)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-26
Stopped at: Phase 84 Plan 02 complete — course API routes, controller, enhanced bulkCreate
Resume file: None
