# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [x] **v1.2 Student Import Enhancement** — Phases 15-19 (shipped 2026-02-27)
- [ ] **v1.3 Conservatory Information Import** — Phases 20-22 (in progress)

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

### v1.3 Conservatory Information Import (In Progress)

**Milestone Goal:** Import conservatory profile data from Ministry of Education Excel form into tenant settings, with full settings page display and edit capability.

- [x] **Phase 20: Conservatory Excel Parser + API** - Backend service to parse Ministry form-style Excel and preview/execute endpoints — completed 2026-02-27
- [ ] **Phase 21: Conservatory Import Frontend** - New import tab with upload, diff preview, and execute flow
- [ ] **Phase 22: Settings Page Expansion** - Display and edit all conservatoryProfile fields on the settings page

## Phase Details

### Phase 20: Conservatory Excel Parser + API
**Goal**: Admin can upload a Ministry conservatory Excel form and receive a structured preview of parsed fields, then execute the import to update tenant settings
**Depends on**: Nothing (backend schema and tenant PUT endpoint already exist)
**Requirements**: XLSX-01, XLSX-02, IMUX-04
**Success Criteria** (what must be TRUE):
  1. Uploading a Ministry conservatory Excel file returns a structured JSON object with all recognized conservatoryProfile fields and their parsed values
  2. Director contact info (name, office phone, mobile, email) is correctly extracted from the form and included in the parsed output
  3. Preview response includes both current tenant values and imported values for each field, enabling diff comparison
  4. Execute endpoint updates the tenant's conservatoryProfile via the existing tenant update mechanism, and the updated values persist in the database
**Plans**: 1 plan

Plans:
- [x] 20-01-PLAN.md — Parse conservatory Excel form + preview/execute endpoints — completed 2026-02-27

### Phase 21: Conservatory Import Frontend
**Goal**: Admin can import conservatory profile data through a dedicated tab in the import page, with a clear visual diff before committing changes
**Depends on**: Phase 20 (needs parser API and preview/execute endpoints)
**Requirements**: IMUX-01, IMUX-02, IMUX-03
**Success Criteria** (what must be TRUE):
  1. Import page shows a third tab labeled "פרטי קונסרבטוריון" alongside the existing teachers and students tabs
  2. Upload step accepts .xlsx files and displays guidance specific to the Ministry conservatory form format
  3. After upload, a side-by-side diff shows current settings values next to imported values for every field, with changed fields visually highlighted
  4. Clicking execute applies the import and the user sees confirmation that settings were updated
**Plans**: 1 plan

Plans:
- [ ] 21-01-PLAN.md — Add conservatory tab with diff preview and execute flow to import page

### Phase 22: Settings Page Expansion
**Goal**: Admin can view and edit all conservatory profile fields directly on the settings page, whether populated by import or manual entry
**Depends on**: Nothing (uses existing PUT /api/tenant/:id; can run in parallel with Phases 20-21)
**Requirements**: STPG-01, STPG-02, STPG-03
**Success Criteria** (what must be TRUE):
  1. Settings page displays all 19 conservatoryProfile fields organized in logical sections (identification, classification, contact, management)
  2. Every displayed conservatoryProfile field is editable and changes are saved successfully via the existing tenant update endpoint
  3. Existing settings sections (general info, director, Ministry info, defaults) continue to function correctly and are not broken by the expansion
**Plans**: TBD

Plans:
- [ ] 22-01: TBD

## Progress

**Execution Order:**
Phases 20 and 22 can execute in parallel. Phase 21 depends on Phase 20.

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
| 21. Conservatory Import Frontend | v1.3 | 0/1 | Planned | - |
| 22. Settings Page Expansion | v1.3 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-27 — Phase 21 planned*
