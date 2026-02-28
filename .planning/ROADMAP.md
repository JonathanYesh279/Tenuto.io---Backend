# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [x] **v1.2 Student Import Enhancement** — Phases 15-19 (shipped 2026-02-27)
- [x] **v1.3 Conservatory Information Import** — Phases 20-22 (shipped 2026-02-28)
- [ ] **v1.4 Ensemble Import** — Phases 23-25 (in progress)

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

### v1.4 Ensemble Import (In Progress)

**Milestone Goal:** Import orchestra/ensemble data from Ministry Excel files using the established preview-then-execute pattern, including Hebrew name decomposition, conductor matching, bulk-safe writes, and a 4th frontend import tab.

- [ ] **Phase 23: Ensemble Parser and Preview** - Parse Ministry ensemble Excel, decompose Hebrew names, match conductors and existing orchestras, deliver preview endpoint
- [ ] **Phase 24: Ensemble Execute and Schema** - Bulk-safe orchestra creation/update, conductor linking, ministry data storage, schema extensions
- [ ] **Phase 25: Ensemble Import Frontend** - 4th import tab with upload, preview, conductor/name warnings, and results flow

## Phase Details

### Phase 23: Ensemble Parser and Preview
**Goal**: Admin can upload a Ministry ensemble Excel and see a complete preview of parsed orchestras with conductor match status, type classification, schedule data, and diff against existing orchestras — before any data is written.
**Depends on**: Phase 22 (v1.3 complete; import infrastructure stable)
**Requirements**: PARS-01, PARS-02, PARS-03, PARS-04, PARS-05, PARS-06, PREV-01, PREV-02, PREV-03, PREV-04, PREV-05, SCHM-01, SCHM-02, SCHM-03
**Success Criteria** (what must be TRUE):
  1. Admin uploads a Ministry Excel file and the system finds and parses the "הרכבי ביצוע" sheet, returning structured ensemble rows with name, conductor, participant count, schedule times, and reporting hours
  2. Composite Hebrew ensemble names (e.g., "תז' כלי נשיפה ייצוגית") are decomposed into type, subType, and performanceLevel fields; unrecognized names appear as warnings in the preview rather than being silently dropped
  3. Each ensemble is classified as 'תזמורת' (>12 participants) or 'הרכב' (<=12 participants) based on the imported participant count
  4. Preview shows per-ensemble conductor match status (resolved/ambiguous/unresolved) and summary statistics, plus schedule data (day, start time, end time) for each ensemble
  5. Preview differentiates matched existing orchestras (with change diff highlighting) from new orchestras that will be created
**Plans:** 2 plans
Plans:
- [ ] 23-01-PLAN.md — Ensemble sheet parser with helpers (name decomposition, time conversion, performance level detection, analytics mini-table)
- [ ] 23-02-PLAN.md — Preview endpoint with conductor matching, orchestra matching, route/controller wiring, and schema extensions

### Phase 24: Ensemble Execute and Schema
**Goal**: Admin can execute the previewed ensemble import, creating new orchestras and updating existing ones with bulk-safe writes, proper conductor linking, and ministry data storage — all scoped by tenant and school year.
**Depends on**: Phase 23 (preview response shape and parsedData structure must be stable)
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06
**Success Criteria** (what must be TRUE):
  1. Executing an ensemble import creates new orchestras via bulk insert (not per-row addOrchestra calls) and updates existing matched orchestras with schedule, conductor, level, and ministry data — without overwriting memberIds
  2. Conductors are linked to their orchestras via teacher.conducting.orchestraIds using a single bulkWrite operation, not individual updates
  3. Import results report created count, updated count, and any skipped entries with reasons (e.g., unresolved conductor, validation failure)
  4. All created/updated orchestras are scoped to the correct tenantId and schoolYearId; coordinationHours and totalReportingHours are stored in orchestra.ministryData
**Plans**: TBD

### Phase 25: Ensemble Import Frontend
**Goal**: Admin can import ensembles from the existing import page using a new 4th tab that follows the same upload-preview-results flow as teachers, students, and conservatory imports.
**Depends on**: Phase 24 (backend API contract finalized — preview response shape and execute endpoint)
**Requirements**: FRNT-01, FRNT-02, FRNT-03, FRNT-04
**Success Criteria** (what must be TRUE):
  1. Import page shows a 4th tab labeled "הרכבים" alongside the existing teacher, student, and conservatory tabs
  2. Ensemble tab supports the full upload-then-preview-then-execute flow: file upload triggers preview display, user confirms to execute, results are shown
  3. Preview displays conductor match warnings (amber/red badges for ambiguous/unresolved conductors) and warnings for unrecognized ensemble names that could not be decomposed
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 23 -> 24 -> 25

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Audit & Infrastructure | v1.0 | 3/3 | Complete | 2026-02-14 |
| 2. Service Layer Query Hardening | v1.0 | 8/8 | Complete | 2026-02-15 |
| 3. Write Protection & Validation | v1.0 | 1/1 | Complete | 2026-02-23 |
| 4. Super-Admin Allowlist | v1.0 | 2/2 | Complete | 2026-02-23 |
| 5. Error Handling & Cascade Safety | v1.0 | 4/4 | Complete | 2026-02-24 |
| 6. Testing & Verification | v1.0 | 4/4 | Complete | 2026-02-24 |
| 7. Fix Import Teacher Null Properties | v1.0 | 1/1 | Complete | 2026-02-23 |
| 8. Fix Import Teacher Bugs | v1.0 | 1/1 | Complete | 2026-02-23 |
| 9. Fix Import Column Mapping | v1.0 | 1/1 | Complete | 2026-02-23 |
| 10. Super Admin Auth Fixes | v1.1 | 2/2 | Complete | 2026-02-24 |
| 11. Tenant Lifecycle Management | v1.1 | 3/3 | Complete | 2026-02-24 |
| 12. Platform Reporting | v1.1 | 2/2 | Complete | 2026-02-25 |
| 13. Impersonation | v1.1 | 2/2 | Complete | 2026-02-25 |
| 14. Super Admin Frontend | v1.1 | 4/4 | Complete | 2026-02-26 |
| 15. Bug Fix + Column Map Extensions | v1.2 | 1/1 | Complete | 2026-02-27 |
| 16. Instrument Progress + Student Data Enrichment | v1.2 | 2/2 | Complete | 2026-02-27 |
| 17. Teacher-Student Linking | v1.2 | 2/2 | Complete | 2026-02-27 |
| 18. Frontend Preview Enhancement | v1.2 | 1/1 | Complete | 2026-02-27 |
| 19. Import Data Quality | v1.2 | 2/2 | Complete | 2026-02-27 |
| 20. Conservatory Excel Parser + API | v1.3 | 1/1 | Complete | 2026-02-27 |
| 21. Conservatory Import Frontend | v1.3 | 1/1 | Complete | 2026-02-28 |
| 22. Settings Page Expansion | v1.3 | 1/1 | Complete | 2026-02-28 |
| 23. Ensemble Parser and Preview | v1.4 | 0/2 | Not started | - |
| 24. Ensemble Execute and Schema | v1.4 | 0/TBD | Not started | - |
| 25. Ensemble Import Frontend | v1.4 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-28 — Phase 23 planned (2 plans)*
