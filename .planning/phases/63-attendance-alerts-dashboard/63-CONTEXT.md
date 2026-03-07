# Phase 63: Attendance Alerts & Dashboard - Post-Implementation Context

**Gathered:** 2026-03-07
**Status:** Post-implementation feedback — requires gap closure phases

<domain>
## Phase Boundary

Phase 63 delivered configurable attendance thresholds, auto-flagging, a dashboard page, student attendance widget, and conductor warning badges. This context captures user feedback on the shipped implementation across v1.9 (Phases 57-63), identifying what needs improvement in the calendar (Phase 62), attendance UX (Phase 60), and dashboard (Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Calendar Visual Redesign (Phase 62 improvements)
- Current calendar feels **flat and static** — needs the interactive feel of the room schedule page
- All three views (month, week, day) need the interactive treatment
- **Animations required:**
  - Smooth card movement when dragged/dropped (like Notion/Linear drag)
  - Micro-interactions: hover lifts, click ripples, subtle scale on focus
  - View transitions: switching month/week/day should animate (slide/fade), not hard-swap
- **Month view:** Combination of dot indicators + mini card previews + heat map coloring (busy days colored differently)
- **Rehearsal cards:** Minimal info — orchestra name + time + room (not overloaded)
- **Past vs future rehearsals:** Past rehearsals are dimmed/faded, future ones full opacity
- **Drag-and-drop:** Snap to 15-minute grid for fine-grained time control
- **Conflict feedback:** Real-time red highlight on drop zone if it would create a conflict — prevent the drop
- **Edit/delete:** Click card opens a slide-in side panel with full details and actions
- **Seeded conflicts cleanup:** Remove seeded rehearsals that have scheduling conflicts — these should never have been allowed

### Attendance Marking UX (Phase 60 improvements)
- **Main pain point:** Too many clicks when marking 30+ students
- **Status cycle:** Keep all 4 states (not marked -> present -> late -> absent) but make tapping faster
- **Grouping:** Group students by instrument section (כלי נגינה) for quick scanning
- **Bulk action:** "Mark All Present" button at top — conductor then just taps the exceptions
- **Auto-save:** Silent with subtle indicator (small green check/pulse, doesn't interrupt flow)
- **Visual design:** Bold, distinct status colors that you can scan instantly + richer rows (avatar, instrument icon, clearer tap targets)
- **Live summary:** Sticky header showing real-time count "23/34 נוכחים · 3 איחורים · 8 חסרים" updating as you tap
- **History view:** Last 3 session dots next to each student showing their recent attendance pattern (green/red/yellow dots)
- **Notes field:** Keep but hide by default — notes icon appears on tap, only expands when conductor wants to add a note
- **Navigation:** Both paths to attendance — quick action from calendar card AND from rehearsal detail page

### Dashboard Page Polish (Phase 63 improvements)
- Current dashboard is **too basic, missing information, and poorly organized**
- **Summary cards:** Right metrics (orchestras, students, rate, flagged) but need visual polish — icons, color treatment, better typography
- **Per-orchestra table:** Keep table format but needs better styling, sorting, visual indicators
- **Monthly trends:** Replace simple Tailwind bars with proper chart library (Recharts or similar) — line/area chart with hover tooltips
- **Missing features needed:**
  - Per-student drill-down: click flagged student to see full history inline
  - Trend comparison: this month vs last month, this semester vs previous
  - Recent alerts section: "3 new students flagged this week", "Orchestra X dropped below 70%"
- **Flagged students list:** Add action buttons per student — "Contact parent", "Dismiss flag", "View profile"
- **Filtering:** Preset quick buttons ("This week", "This month", "This semester") + custom date range picker
- **Export:** Not needed right now

### Claude's Discretion
- Exact chart library choice (Recharts, Victory, etc.)
- Specific animation library (framer-motion, CSS transitions, etc.)
- Instrument section ordering and collapse behavior
- Side panel layout and fields
- Alert notification styling

</decisions>

<specifics>
## Specific Ideas

- Calendar should feel like the existing room schedule page — interactive, alive, not a static grid
- Drag-and-drop should match the room schedule's feel with smooth animations
- The attendance marking should be fast enough that a conductor can mark 30+ students in under a minute
- History dots (last 3 sessions) give conductors instant pattern recognition without navigating away
- Dashboard needs real chart library — the Tailwind bars are placeholder-quality

</specifics>

<deferred>
## Deferred Ideas

- Mobile/tablet optimization for attendance marking during rehearsals — future phase
- Email/notification alerts when students are flagged — future phase (requires email service setup)
- Print-friendly dashboard view — future phase
- Attendance data export as Excel/PDF — future phase

</deferred>

---

*Phase: 63-attendance-alerts-dashboard*
*Context gathered: 2026-03-07*
