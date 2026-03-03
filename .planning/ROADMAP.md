# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [x] **v1.2 Student Import Enhancement** — Phases 15-19 (shipped 2026-02-27)
- [x] **v1.3 Conservatory Information Import** — Phases 20-22 (shipped 2026-02-28)
- [x] **v1.4 Ensemble Import** — Phases 23-26 (shipped 2026-02-28)
- [x] **v1.5 Privacy Compliance Foundation** — Phases 27-30 (shipped 2026-03-02)
- [ ] **v1.6 Room & Hours Management Table** — Phases 31-36 (in progress)

## Phases

<details>
<summary>v1.0 Multi-Tenant Architecture Hardening (Phases 1-9) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Audit & Infrastructure (3/3 plans) — completed 2026-02-14
- [x] Phase 2: Service Layer Query Hardening (8/8 plans) — completed 2026-02-15
- [x] Phase 3: Write Protection & Validation (1/1 plan) — completed 2026-02-23
- [x] Phase 4: Super-Admin Allowlist (2/2 plans) — completed 2026-02-23
- [x] Phase 5: Error Handling & Cascade Safety (4/4 plans) — completed 2026-02-24
- [x] Phase 6: Testing & Verification (4/4 plans) — completed 2026-02-24
- [x] Phase 7: Fix Import Teacher Null Properties (1/1 plan) — completed 2026-02-23
- [x] Phase 8: Fix Import Teacher Bugs (1/1 plan) — completed 2026-02-23
- [x] Phase 9: Fix Import Column Mapping (1/1 plan) — completed 2026-02-23

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 Super Admin Platform Management (Phases 10-14) — SHIPPED 2026-02-26</summary>

- [x] Phase 10: Super Admin Auth Fixes (2/2 plans) — completed 2026-02-24
- [x] Phase 11: Tenant Lifecycle Management (3/3 plans) — completed 2026-02-24
- [x] Phase 12: Platform Reporting (2/2 plans) — completed 2026-02-25
- [x] Phase 13: Impersonation (2/2 plans) — completed 2026-02-25
- [x] Phase 14: Super Admin Frontend (4/4 plans) — completed 2026-02-26

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.2 Student Import Enhancement (Phases 15-19) — SHIPPED 2026-02-27</summary>

- [x] Phase 15: Bug Fix + Column Map Extensions (1/1 plan) — completed 2026-02-27
- [x] Phase 16: Instrument Progress + Student Data Enrichment (2/2 plans) — completed 2026-02-27
- [x] Phase 17: Teacher-Student Linking (2/2 plans) — completed 2026-02-27
- [x] Phase 18: Frontend Preview Enhancement (1/1 plan) — completed 2026-02-27
- [x] Phase 19: Import Data Quality (2/2 plans) — completed 2026-02-27

See: `.planning/milestones/v1.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.3 Conservatory Information Import (Phases 20-22) — SHIPPED 2026-02-28</summary>

- [x] Phase 20: Conservatory Excel Parser + API (1/1 plan) — completed 2026-02-27
- [x] Phase 21: Conservatory Import Frontend (1/1 plan) — completed 2026-02-28
- [x] Phase 22: Settings Page Expansion (1/1 plan) — completed 2026-02-28

See: `.planning/milestones/v1.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.4 Ensemble Import (Phases 23-26) — SHIPPED 2026-02-28</summary>

- [x] Phase 23: Ensemble Parser and Preview (2/2 plans) — completed 2026-02-28
- [x] Phase 24: Ensemble Execute and Schema (1/1 plan) — completed 2026-02-28
- [x] Phase 25: Ensemble Import Frontend (1/1 plan) — completed 2026-02-28
- [x] Phase 26: Student-Orchestra Linking from Import (2/2 plans) — completed 2026-02-28

See: `.planning/milestones/v1.4-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.5 Privacy Compliance Foundation (Phases 27-30) — SHIPPED 2026-03-02</summary>

**Milestone Goal:** Establish regulatory documentation and governance framework required by Israeli Privacy Protection Regulations (Information Security), 2017 -- assessed security level: MEDIUM. All deliverables are compliance documents, not code. Technical hardening deferred to v1.6.

- [x] **Phase 27: Data Inventory and System Mapping** (4/4 plans) — completed 2026-03-02
- [x] **Phase 28: Governance Framework and Security Policies** (3/3 plans) — completed 2026-03-02
- [x] **Phase 29: Operational Procedures** (2/2 plans) — completed 2026-03-02
- [x] **Phase 30: Supplementary Policies and Audit Program** (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.5-ROADMAP.md` for full details.

</details>

### v1.6 Room & Hours Management Table (In Progress)

**Milestone Goal:** Give conservatory admins a visual room-scheduling grid -- rooms x time slots per weekday -- showing all lessons, rehearsals, and theory classes with drag-and-drop editing.

- [x] **Phase 31: Room Data Foundation** (3/3 plans) — completed 2026-03-03
- [x] **Phase 32: Room Schedule API & Conflict Detection** (2/2 plans) — completed 2026-03-03
- [x] **Phase 33: Read-Only Room Grid UI** (3/3 plans) — completed 2026-03-03
- [x] **Phase 34: Grid Interaction** (3/3 plans) — completed 2026-03-03
- [x] **Phase 35: Polish & Week Overview** (2/2 plans) — completed 2026-03-03
- [ ] **Phase 36: Seed Teacher Schedule Data** — Populate timeBlocks with assigned lessons and bidirectional student-teacher schedule data

## Phase Details

### Phase 31: Room Data Foundation
**Goal**: Admins can manage a canonical list of rooms in conservatory settings, and all existing location data references those rooms
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, SEED-01
**Success Criteria** (what must be TRUE):
  1. Admin can view the list of rooms on the conservatory settings page with name and active status
  2. Admin can add a new room, edit an existing room name, and deactivate a room from settings
  3. Admin can upload an Excel file to bulk-import room definitions on the settings page
  4. Creating or editing a theory lesson or rehearsal validates location against the tenant's room list instead of the hardcoded VALID_THEORY_LOCATIONS / VALID_LOCATIONS arrays
  5. Running the seed script produces rooms, time blocks with room assignments, rehearsals, and theory lessons sufficient for grid development (30+ teachers, 200+ time blocks, multiple conflicts)
**Plans:** 3 plans

Plans:
- [x] 31-01-PLAN.md — Room schema, CRUD endpoints, and settings UI
- [x] 31-02-PLAN.md — Room Excel import, dynamic validation, and location normalization migration
- [x] 31-03-PLAN.md — Dev seed script for rooms, time blocks, rehearsals, theory lessons, and conflicts

### Phase 32: Room Schedule API & Conflict Detection
**Goal**: A single API endpoint returns all room occupancy for a given weekday, merging private lessons, rehearsals, and theory classes, with conflicts detected across all sources
**Depends on**: Phase 31 (room definitions and seed data must exist)
**Requirements**: GRID-05, GRID-06
**Success Criteria** (what must be TRUE):
  1. GET /api/room-schedule?day=1 returns a unified response containing private lessons (from teacher.teaching.timeBlocks), rehearsals (from rehearsal collection), and theory classes (from theory_lesson collection) grouped by room
  2. Activities in the response include teacher name, student/group name, activity type, and time slot for each occupied cell
  3. When two or more activities occupy the same room at the same time, the response flags those activities with a conflict indicator
  4. Conflict detection covers all three data sources (a time block and a rehearsal in the same room at the same time are detected as a conflict, not just theory-vs-theory)
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md — Three-source aggregation service, conflict detection, and GET endpoint
- [x] 32-02-PLAN.md — Move activity endpoint with per-source update logic and conflict pre-check

### Phase 33: Read-Only Room Grid UI
**Goal**: Admins see a visual matrix of rooms x 30-minute time slots for each weekday, with color-coded activities and summary statistics
**Depends on**: Phase 32 (API endpoint must return unified room schedule data)
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, GRID-07
**Success Criteria** (what must be TRUE):
  1. Admin sees a grid with rooms as rows and 30-minute time slots as columns, scrollable horizontally, rendered in RTL layout
  2. Admin can switch between weekdays (Sunday through Friday) using day tabs, and the grid shows only that day's activities
  3. Each occupied cell displays the teacher name and the student or group name
  4. Cells are color-coded by activity type (blue for private lessons, purple for rehearsals, orange for theory) and conflict cells have a red border or warning indicator
  5. A summary statistics bar above or below the grid shows total rooms, occupied slots, free slots, and conflict count
**Plans:** 3 plans

Plans:
- [x] 33-01-PLAN.md — API service, route/sidebar registration, page skeleton with day selector and CSS grid
- [x] 33-02-PLAN.md — ActivityCell color coding, conflict indicators, tooltips, and conflict stacking
- [x] 33-03-PLAN.md — Summary statistics bar and unassigned activities row

### Phase 34: Grid Interaction
**Goal**: Admins can create lessons in empty slots, move lessons between rooms/times via drag-and-drop, and filter the grid
**Depends on**: Phase 33 (stable read-only grid must exist before adding interaction)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
**Success Criteria** (what must be TRUE):
  1. Admin can click an empty cell and a form opens with room, day, and time pre-filled to create a one-time lesson
  2. Admin can drag an activity card from one cell and drop it into another cell (different room or different time) and the lesson moves
  3. When a drag target would cause a teacher, student, or room conflict, the drop is blocked and an error message explains the conflict
  4. Admin can type a teacher name to filter the grid to show only that teacher's activities
  5. Admin can filter by room name or activity type (private/rehearsal/theory) and the grid updates immediately
**Plans:** 3 plans

Plans:
- [x] 34-01-PLAN.md — Filter controls (teacher search, room select, activity type toggles) and empty rooms display
- [x] 34-02-PLAN.md — Click-to-create lesson dialog with teacher selection in empty grid cells
- [x] 34-03-PLAN.md — Drag-and-drop with @dnd-kit/core, conflict validation, and move API integration

### Phase 35: Polish & Week Overview
**Goal**: Admins can print a day's schedule, see a compact week overview, and understand room utilization at a glance
**Depends on**: Phase 34 (full grid functionality should be stable before polish)
**Requirements**: PLSH-01, PLSH-02, PLSH-03
**Success Criteria** (what must be TRUE):
  1. Admin can click a print/export button and get a clean printable layout of the current day's room schedule (PDF or print dialog)
  2. Admin can switch to a week overview showing all 6 weekdays side by side in a compact format
  3. Each room row shows a utilization percentage (occupied slots / total slots across the week)
**Plans**: 2 plans

Plans:
- [x] 35-01-PLAN.md — Schedule toolbar with print/export PDF and Tailwind print styling
- [x] 35-02-PLAN.md — Week overview with compact mini-grid and room utilization indicators

### Phase 36: Seed Teacher Schedule Data
**Goal**: Running the seed script produces teachers with teaching days and time blocks populated with assigned student lessons, creating bidirectional schedule data that shows up in the room schedule grid
**Depends on**: Phase 35 (room schedule UI must exist to verify seed data displays correctly)
**Success Criteria** (what must be TRUE):
  1. Each seeded teacher has teaching days configured and 2-4 time blocks with properly slotted assigned lessons
  2. Each time block's assignedLessons array contains student lesson records with correct lessonStartTime/lessonEndTime within the block range
  3. Each student's teacherAssignments references the correct teacher, timeBlock, day, time, and location matching the teacher's assignedLesson
  4. The room schedule grid displays seeded activities (private lessons, rehearsals, theory) across all weekdays with visible room occupancy
  5. Week overview shows utilization data across rooms from the seeded schedule
**Plans**: 1 plan

Plans:
- [ ] 36-01-PLAN.md — Enhance seed script with teaching day configuration and bidirectional lesson assignment

## Progress

**Execution Order:**
Phases execute in numeric order: 31 -> 32 -> 33 -> 34 -> 35 -> 36

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 31. Room Data Foundation | v1.6 | 3/3 | ✓ Complete | 2026-03-03 |
| 32. Room Schedule API & Conflict Detection | v1.6 | 2/2 | ✓ Complete | 2026-03-03 |
| 33. Read-Only Room Grid UI | v1.6 | 3/3 | ✓ Complete | 2026-03-03 |
| 34. Grid Interaction | v1.6 | 3/3 | ✓ Complete | 2026-03-03 |
| 35. Polish & Week Overview | v1.6 | 2/2 | ✓ Complete | 2026-03-03 |
| 36. Seed Teacher Schedule Data | v1.6 | 0/1 | Not started | - |

**Previous milestones:** 30 phases, 66 plans across 6 milestones (all shipped)

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-03-03 -- Phase 36 added*
