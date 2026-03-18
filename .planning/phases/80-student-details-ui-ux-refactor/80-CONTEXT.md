# Phase 80: Student Details UI/UX Refactor - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Student Details page to match the Coursify LMS student details design reference (screenshot: `צילום מסך 2026-03-18 170201.png`). Faithful adaptation: translate to RTL Hebrew, map LMS course/enrollment concepts to Tenuto music school entities (instruments, orchestras, theory lessons, teacher assignments). Existing tab content (Schedule, Bagrut, Orchestra, Theory) gets restyled but keeps deep-dive functionality.

</domain>

<decisions>
## Implementation Decisions

### Layout Architecture
- **3-column dashboard** as primary view: profile card (RIGHT in RTL) | activity charts + summary cards (CENTER) | performance chart (LEFT in RTL)
- **True RTL mirroring** — profile card on right side, charts flow right-to-left
- **Dashboard + tabs hybrid** — main view is the dashboard; deep-dive tabs survive for complex content
- **Surviving tabs**: Schedule (calendar grid), Bagrut (grading system), Orchestra (enrollment mgmt), Theory (enrollment mgmt)
- **Tab bar below header** for navigation between dashboard and deep-dive tabs
- **All surviving tabs need complete UI/UX refactor** to match the new design system patterns
- **Full-width data table** below the 3-column section (spanning all columns)

### Profile Card (Right Column in RTL)
- **Avatar**: Keep current HeroUI User with getAvatarColorHex (colored circle + initials) — consistent with list pages
- **Badges next to name**: Primary instrument badge + class level badge (e.g., "פסנתר" + "כיתה ז'")
- **Subtitle under name**: "תחילת לימודים: [enrollment date]"
- **Contact actions**: Phone button, Email button (mailto), WhatsApp link — all three
- **Contact info section** ("פרטי קשר"): Email, phone, address (replacing design's Contact section)
- **Parent contact section** ("הורים"): Parent name, parent phone, parent email (replacing design's Social Media section)
- **Teacher assignments section** ("מורים"): List of assigned teachers with instrument (below parent contact)
- **Additional profile data**: All instruments with stage levels, study years count
- **Edit button** at bottom of card — inline edit mode (current behavior preserved)

### Charts & Analytics (Center + Left Columns)
- **Weekly lesson hours bar chart** (center, "פעילות שבועית"): Shows scheduled lesson hours per day (Sun-Fri), sourced from teacherAssignments + rehearsals + theory. Time period selector like design ("השבוע" dropdown)
- **3 summary cards below chart** (mixed key stats): Total weekly hours, orchestra enrollment count, theory lesson count — quick overview numbers
- **Attendance donut chart** (left column, "נוכחות"): Shows attendance breakdown — present/absent/late percentages. Sourced from activity_attendance records
- **Monthly attendance trend line** below donut: Shows attendance rate over months
- **No motivational quote** — skip the design's quote section, keep it data-focused

### Data Table (Full Width Bottom Section)
- **Unified enrollment table** ("רישומים"): Combines individual lessons, orchestra enrollments, and theory lessons in one table
- **Columns**: Colored type icon | Name (teacher/orchestra/class name) | Instrument | Day+Time | Room | Status badge
- **Type icons**: Blue circle for individual lesson, green circle for orchestra, purple circle for theory — matches design's colorful course icons
- **Filters**: Search bar + type filter dropdown (הכל/שיעור אישי/תזמורת/תאוריה) + day-of-week filter
- **Table styling**: HeroUI Table matching entity page pattern (Students/Teachers list pages)

### Claude's Discretion
- Exact chart library/component choice (Recharts already used in dashboard)
- Summary card visual style (follow GlassStatCard or design-faithful cards)
- Tab transition animations
- Loading states and skeleton designs
- Empty state designs for charts when no data
- Exact spacing and responsive breakpoints
- How to handle the header area (DetailPageHeader adaptation vs new header)

</decisions>

<specifics>
## Specific Ideas

- **Design reference**: Coursify LMS Student Details page (`/mnt/c/Users/yona2/Pictures/Screenshots/צילום מסך 2026-03-18 170201.png`)
- The design should be a faithful Hebrew RTL adaptation — not a creative reinterpretation
- Map every design element to a music school equivalent:
  - "Courses" → lessons/orchestras/theory (unified enrollments)
  - "Learning Activity" → weekly lesson hours
  - "Performance" → attendance metrics
  - "Social Media" → parent contact + teacher assignments
  - "STU-005 Active" badges → instrument + class badges
  - "Enrolled on" → תחילת לימודים
- Contact action buttons (phone, email, WhatsApp) are clickable with appropriate href protocols
- The surviving tabs (Schedule, Bagrut, Orchestra, Theory) also need a complete design refactor to match the new aesthetic — not just the dashboard

</specifics>

<deferred>
## Deferred Ideas

- Tab content redesign for Schedule/Bagrut/Orchestra/Theory may become separate phases if scope is too large
- Student photo upload capability (would enable real photos in avatar)
- Teacher notes/comments section on student profile

</deferred>

---

*Phase: 80-student-details-ui-ux-refactor*
*Context gathered: 2026-03-18*
