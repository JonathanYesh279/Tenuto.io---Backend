# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [ ] **v1.2 Student Import Enhancement** — Phases 15-18 (in progress)

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

### v1.2 Student Import Enhancement (In Progress)

**Milestone Goal:** Enhance student import from Ministry Excel files to support teacher linking, proper instrument progress with stage tracking, bagrut flagging, and polished frontend preview matching teacher import quality.

- [x] **Phase 15: Bug Fix + Column Map Extensions** — Fix instrument detection bug and extend column mappings for bagrut and schema additions (completed 2026-02-27)
- [x] **Phase 16: Instrument Progress + Student Data Enrichment** — Build instrumentProgress[] entries, stage level mapping, expanded change detection, and bagrut flagging (completed 2026-02-27)
- [x] **Phase 17: Teacher-Student Linking** — Match teacher names from Excel, persist resolved matches, create teacherAssignment entries (completed 2026-02-27)
- [ ] **Phase 18: Frontend Preview Enhancement** — Enriched student preview UI matching teacher import quality with detail cards, badges, and summary stats

## Phase Details

### Phase 15: Bug Fix + Column Map Extensions
**Goal**: Student import correctly detects instrument columns and recognizes new data fields (bagrut, isBagrutCandidate) from Ministry Excel files
**Depends on**: Nothing (first phase of v1.2; prerequisite for all subsequent phases)
**Requirements**: BUGF-01, IQAL-04, BGRT-01
**Success Criteria** (what must be TRUE):
  1. Student import preview detects instrument columns with the same accuracy as teacher import (no misdetection from missing headerColMap)
  2. Uploading a Ministry Excel file with a "מגמת מוסיקה" or "מגמה" column produces a preview that includes the bagrut flag value for each student row
  3. Student schema accepts `academicInfo.isBagrutCandidate` boolean without breaking existing student documents
**Plans:** 1 plan

Plans:
- [x] 15-01-PLAN.md -- Fix headerColMap passthrough bug + add bagrut column mapping and schema field

### Phase 16: Instrument Progress + Student Data Enrichment
**Goal**: Imported students have proper instrumentProgress[] entries with stage tracking, and the import detects changes across all enriched fields
**Depends on**: Phase 15 (correct instrument column detection and column map entries)
**Requirements**: IQAL-01, IQAL-02, IQAL-03, BGRT-02
**Success Criteria** (what must be TRUE):
  1. Importing a new student creates an `instrumentProgress[]` entry with instrumentName, isPrimary, currentStage, and ministryStageLevel (not a flat academicInfo.instrument string)
  2. Ministry stage level values (שלב א/ב/ג) in Excel are mapped to numeric currentStage values on the instrumentProgress entry
  3. Re-importing an existing student who changed instrument, stage level, lesson duration, or teacher shows those changes in the preview diff (not just studyYears/extraHour/class)
  4. Executing import on a student flagged with "מגמת מוסיקה" sets `academicInfo.isBagrutCandidate: true` on the student document
  5. Newly imported students are enrolled in the current school year and appear in school-year-scoped queries
**Plans:** 2 plans

Plans:
- [x] 16-01-PLAN.md -- Stage mapping + instrumentProgress builder + expanded change detection (preview enrichment)
- [x] 16-02-PLAN.md -- Refactor executeStudentImport for instrumentProgress, school year enrollment, and expanded updates

### Phase 17: Teacher-Student Linking
**Goal**: Students imported from Ministry files are linked to their teachers via teacherAssignment entries, with match status visible in preview
**Depends on**: Phase 16 (instrumentProgress and enriched change detection must exist before adding teacher linking)
**Requirements**: TLNK-01, TLNK-02, TLNK-03
**Success Criteria** (what must be TRUE):
  1. Preview matches the "המורה" column value against existing teachers (case-insensitive, both name orderings) and shows resolved/unresolved/ambiguous status per row
  2. Executing import creates a teacherAssignment entry on the student with the matched teacherId (without day/time schedule fields, marked as Ministry import)
  3. When a teacher name from Excel is not found in the tenant's teacher list, the preview displays a clear warning with the exact unresolved name
  4. Teacher match results are persisted in the import_log at preview time so execute never re-runs matching
**Plans:** 2 plans

Plans:
- [x] 17-01-PLAN.md -- Teacher name matching function + preview integration with match status and warnings
- [x] 17-02-PLAN.md -- Execute teacherAssignment creation for resolved matches with duplicate prevention

### Phase 18: Frontend Preview Enhancement
**Goal**: Student import preview shows the same quality of detail as teacher import preview, with rich row details, teacher match badges, and summary statistics
**Depends on**: Phase 17 (all backend enrichments must be in place for the frontend to display them)
**Requirements**: FEPV-01, FEPV-02, FEPV-03
**Success Criteria** (what must be TRUE):
  1. Each student row in the preview table shows enriched detail (instrument, teacher match status, class, stage level, bagrut flag) via a `getStudentRowDetails()` function mirroring the teacher import pattern
  2. Not-found (new) students show a rich detail card with all parsed import data instead of just a "תלמיד חדש" text label
  3. Teacher match status is displayed as a visual badge (matched/not found/ambiguous) in the preview table for each student row
**Plans:** 1 plan

Plans:
- [ ] 18-01-PLAN.md -- Student preview helpers (formatStudentChange, getTeacherMatchBadge, getStudentRowDetails) + teacher match summary cards

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16 -> 17 -> 18

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
| 18. Frontend Preview Enhancement | v1.2 | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-27 — Phase 18 planned (1 plan)*
