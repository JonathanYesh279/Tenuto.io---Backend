# Phase 37: Room Schedule UX Fixes & Conflict Prevention - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the existing room schedule grid's usability and prevent scheduling conflicts. This phase covers: larger cells with better readability, clearer color coding, a dedicated fullscreen route, conflict prevention at scheduling time (create + drag-and-drop), filter UX improvements, and PDF export fixes. No new scheduling capabilities — only improving what v1.6 built.

</domain>

<decisions>
## Implementation Decisions

### Cell size & readability
- Significantly larger cells: 120px+ column width, 80px+ row height
- Each cell shows three lines of info: teacher name, student/group name, and time range (e.g. 08:00-08:30) — all readable without hovering
- Teacher and student labels use prefix labels for clarity: מורה: before teacher name, תלמיד: before student name
- Dedicated fullscreen page route (/room-schedule/fullscreen or similar) with no sidebar/header — linked from the main room schedule page

### Visual clarity
- Keep light pastel backgrounds (blue-100, purple-100, orange-100) but add a thick (4px) right border in a strong accent color per activity type — easy to scan which type each cell is
- Conflicts should be prevented, not displayed — but keep a subtle conflict indicator (simple red border) as a safety net for edge cases (imported data, bugs)
- Remove the 12 intentional conflicts from the seed script — seed data should be realistic with no conflicts, like production data

### Conflict prevention
- Pre-check in create dialog: before showing the form, load existing activities for that room+time. If occupied, show warning with who's there and block submission
- Drag-and-drop: visual drop zone feedback (red/disabled for conflict, green for available) while dragging, AND reject if they somehow drop on an occupied slot
- All three conflict types prevented: room overlaps, teacher double-booking, student double-booking
- Specific error messages: "החדר תפוס ע"י [teacher name] בשעות [time range]" — show exactly who/what is conflicting

### Filter & export fixes
- Activity type toggles: improve visual on/off states AND update summary bar stats to reflect only visible (filtered) activities
- PDF export: both formats available — grid-style visual PDF (mirrors on-screen layout) AND tabular data PDF
- Week PDF: one PDF file with 6 pages (one per day, Sunday through Friday)
- Filters affect export: what you see is what you export (filtered view = filtered PDF)

### Claude's Discretion
- Exact fullscreen route path and navigation UX
- Grid-style PDF layout implementation approach
- Drop zone visual feedback styling (exact colors/animations)
- How to efficiently pre-check conflicts in the create dialog (API call vs. using already-loaded schedule data)

</decisions>

<specifics>
## Specific Ideas

- The user emphasized that conflicts should NOT exist in the app — prevention is the real feature, not visualization. The grid conflict UI is a safety net only.
- Seed script should be cleaned up to produce zero conflicts — realistic production-like data
- "What you see is what you export" principle for PDF + filters

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-room-schedule-ux-fixes-conflict-prevention*
*Context gathered: 2026-03-03*
