# Roadmap: Tenuto.io Backend

## Milestones

- [x] **v1.0 Multi-Tenant Architecture Hardening** — Phases 1-9 (shipped 2026-02-24)
- [x] **v1.1 Super Admin Platform Management** — Phases 10-14 (shipped 2026-02-26)
- [x] **v1.2 Student Import Enhancement** — Phases 15-19 (shipped 2026-02-27)
- [x] **v1.3 Conservatory Information Import** — Phases 20-22 (shipped 2026-02-28)
- [x] **v1.4 Ensemble Import** — Phases 23-26 (shipped 2026-02-28)
- [ ] **v1.5 Privacy Compliance Foundation** — Phases 27-30 (in progress)

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

### v1.5 Privacy Compliance Foundation (In Progress)

**Milestone Goal:** Establish regulatory documentation and governance framework required by Israeli Privacy Protection Regulations (Information Security), 2017 -- assessed security level: MEDIUM. All deliverables are compliance documents, not code. Technical hardening deferred to v1.6.

- [x] **Phase 27: Data Inventory and System Mapping** (4/4 plans) — completed 2026-03-02
- [x] **Phase 28: Governance Framework and Security Policies** (3/3 plans) — completed 2026-03-02
- [x] **Phase 29: Operational Procedures** (2/2 plans) — completed 2026-03-02
- [ ] **Phase 30: Supplementary Policies and Audit Program** (0/2 plans) - Complete remaining policies (logging, mobile, encryption) and establish ongoing audit framework

## Phase Details

### Phase 27: Data Inventory and System Mapping
**Goal**: The platform's personal data holdings, system architecture, data flows, and risks are fully documented and classified
**Depends on**: Nothing (foundation for all subsequent compliance documents)
**Requirements**: DBDF-01, DBDF-02, DBDF-03, DBDF-04, SMAP-01, SMAP-02, SMAP-03, RISK-01
**Success Criteria** (what must be TRUE):
  1. A Database Definition Document exists listing every MongoDB collection containing personal data, with field-level sensitivity classification (public / internal / sensitive / restricted)
  2. Each collection entry specifies its data purpose, lawful basis for processing, and retention policy
  3. Collections holding minors' data are explicitly identified with their special handling requirements documented
  4. A system architecture diagram documents all components (Express API, MongoDB Atlas, S3, Render) with data classification labels, and a data flow map traces personal data movement between components
  5. A risk assessment document identifies threats, vulnerabilities, and existing/planned mitigations, and a third-party vendor inventory lists every external service with its data access scope
**Plans:** 4 plans
Plans:
- [x] 27-01-PLAN.md -- Complete field-level data inventory for all 22 MongoDB collections
- [x] 27-02-PLAN.md -- Lawful basis, retention, minors' data handling, and data minimization process
- [x] 27-03-PLAN.md -- System architecture and data flow diagrams (Mermaid)
- [x] 27-04-PLAN.md -- Vendor inventory, risk assessment, and Hebrew-English glossary

### Phase 28: Governance Framework and Security Policies
**Goal**: Organizational accountability is established and all security rules governing access, authentication, and data handling are formally documented
**Depends on**: Phase 27 (policies reference the data inventory, system map, and risk assessment)
**Requirements**: SECOFF-01, SECOFF-02, SECPR-01, SECPR-02, SECPR-03, ACPOL-01, ACPOL-02, ACPOL-03
**Success Criteria** (what must be TRUE):
  1. A Security Officer role is formally defined with responsibilities per Regulation 3, and a named appointment document specifies contact information and authority scope
  2. A Security Procedure Document exists covering access management, authentication policies, authorization rules, backup/recovery procedures, and data handling/retention/deletion practices
  3. An Access Control Policy documents all 8 application roles, their permissions, and tenant data boundaries
  4. A Password and Authentication Policy documents current controls (JWT, refresh tokens, credential storage) and identifies planned v1.6 technical hardening items
  5. An Access Logging Policy defines which events are logged, the log retention period, and the review schedule
**Plans:** 3 plans
Plans:
- [x] 28-01-PLAN.md -- Security Officer role definition and appointment document
- [x] 28-02-PLAN.md -- Security Procedure Document (access, auth, backup, retention)
- [x] 28-03-PLAN.md -- Access control, authentication, and logging policies

### Phase 29: Operational Procedures
**Goal**: Procedures exist for handling security incidents, managing vendor relationships, onboarding/offboarding personnel, and recovering from data loss
**Depends on**: Phase 28 (procedures implement the policies defined in Phase 28; escalation paths reference the Security Officer)
**Requirements**: INCD-01, INCD-02, INCD-03, VEND-01, VEND-02, VEND-03, PERS-01, PERS-02, PERS-03, BACK-01
**Success Criteria** (what must be TRUE):
  1. An Incident Response Plan exists with severity classification (P1-P4), escalation procedures, and role assignments
  2. A breach notification procedure specifies immediate reporting requirements and an incident log template captures all required documentation fields
  3. Data Processing Agreement templates exist for each cloud vendor (MongoDB Atlas, Render, AWS S3), and a vendor risk assessment checklist with scoring framework is ready for use
  4. A vendor registry documents all third-party data processors with their specific data scope
  5. Onboarding/offboarding security procedures define access provisioning and revocation steps, a security awareness training outline exists for conservatory admins and teachers, and a confidentiality agreement template is ready for personnel with data access
**Plans:** 2 plans
Plans:
- [x] 29-01-PLAN.md -- Incident response plan (INCD-01/02/03) and vendor management (VEND-01/02/03)
- [x] 29-02-PLAN.md -- Personnel security (PERS-01/02/03) and backup/recovery plan (BACK-01)

### Phase 30: Supplementary Policies and Audit Program
**Goal**: All remaining policy gaps are closed and an ongoing compliance verification program is established
**Depends on**: Phase 29 (the audit checklist and self-assessment reference all documents produced in Phases 27-29)
**Requirements**: LOG-01, MOB-01, ENC-01, AUDT-01, AUDT-02, AUDT-03
**Success Criteria** (what must be TRUE):
  1. A user notification policy exists informing all authorized users that their access and activity are logged and monitored
  2. A mobile device policy defines usage restrictions and required safeguards for accessing the platform from mobile devices
  3. An encryption policy defines standards for data in transit (TLS) and at rest, including protocols and key management principles
  4. A periodic security audit program exists with annual schedule and scope definition, and a compliance self-assessment checklist maps controls to all 18 regulations
  5. A remediation tracking process is documented for handling audit findings through to resolution
**Plans:** 2 plans
Plans:
- [ ] 30-01-PLAN.md -- Supplementary policies: user notification (LOG-01), mobile device (MOB-01), encryption (ENC-01)
- [ ] 30-02-PLAN.md -- Audit program (AUDT-01), compliance self-assessment checklist (AUDT-02), remediation tracking (AUDT-03)

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-9 | v1.0 | 25/25 | Complete | 2026-02-24 |
| 10-14 | v1.1 | 13/13 | Complete | 2026-02-26 |
| 15-19 | v1.2 | 8/8 | Complete | 2026-02-27 |
| 20-22 | v1.3 | 3/3 | Complete | 2026-02-28 |
| 23-26 | v1.4 | 6/6 | Complete | 2026-02-28 |
| 27 | v1.5 | 4/4 | Complete | 2026-03-02 |
| 28 | v1.5 | 3/3 | Complete | 2026-03-02 |
| 29 | v1.5 | 2/2 | Complete | 2026-03-02 |
| 30 | v1.5 | 0/2 | Not started | - |

**Total:** 30 phases, 69 plans across 6 milestones
**Phase 27 documents:** 9 compliance artifacts in `.planning/compliance/`
**Phase 28 documents:** 5 compliance artifacts in `.planning/compliance/`
**Phase 29 documents:** 4 compliance artifacts in `.planning/compliance/`
**Phase 30 documents:** 6 compliance artifacts planned for `.planning/compliance/`

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-03-02 -- Phase 30 planned (2 plans, 6 compliance documents)*
