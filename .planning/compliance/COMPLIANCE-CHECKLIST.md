# Compliance Self-Assessment Checklist

**Document ID:** AUDT-02
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Semi-annual (used for self-assessment per AUDT-01) and upon regulatory changes
**Related Documents:** ALL compliance documents from Phases 27-30 (this is the master cross-reference document). See Section 8 for the complete document index.

---

## 1. Purpose

This checklist maps every requirement of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017) to the controls and documentation produced by the Tenuto.io compliance program (Phases 27-30 of v1.5 Privacy Compliance Foundation).

It serves as:

1. **The primary tool for internal self-assessment** per AUDT-01 (Periodic Security Audit Program), to be completed semi-annually by the Security Officer
2. **The evidence framework for external audits** per Regulation 18, providing auditors with a structured walkthrough of compliance controls
3. **The master cross-reference document** that connects all 21+ compliance artifacts into a coherent compliance picture

Each checklist item includes: regulation reference, requirement description, control implemented, document reference with specific section, compliance status, and evidence notes.

---

## 2. How to Use This Checklist

### 2.1 Assessment Process

1. **Review each item** against the referenced document and section. Open the referenced document and verify the control is still current and accurately described.
2. **Update the Status column** for each item using one of the four status levels defined in Section 3.
3. **Update Evidence Notes** with current evidence: dates of last verification, configuration screenshots, observation notes, or cross-references to other evidence.
4. **New findings:** For any item where the status changes to Partially Compliant, Non-Compliant, or where a new gap is discovered, enter a finding in the AUDT-03 (Remediation Tracking) register.
5. **Record the assessment** in the Assessment Record table (Section 6) with the date, assessor, and summary.

### 2.2 Roles

| Role | Use of This Checklist |
|------|----------------------|
| **Security Officer** (self-assessment) | Walk through every item semi-annually, update statuses, enter new findings in AUDT-03 |
| **External Auditor** (formal audit) | Use as the structured audit framework, verify statuses independently, produce findings per AUDT-01 Section 7 |
| **Development Team** | Reference for understanding what controls are expected and where gaps need remediation |

### 2.3 Date This Assessment

**Assessment Date:** _____________
**Assessor:** _____________
**Assessment Type:** [ ] Self-Assessment [ ] External Audit

---

## 3. Compliance Status Legend

| Status | Definition | Action Required |
|--------|-----------|-----------------|
| **Compliant** | Control fully implemented and documented. Evidence is available and current. | None -- maintain and verify in next assessment. |
| **Partially Compliant** | Control exists but has documented gaps. Policy is defined but technical enforcement is incomplete, OR documentation exists but operational implementation is pending. | Enter in AUDT-03 remediation tracker. Target remediation in v1.6 or next planning cycle. |
| **Non-Compliant** | Control is not implemented. No documentation or technical enforcement exists for this requirement. | Enter in AUDT-03 as HIGH or CRITICAL severity. Prioritize in v1.6 remediation planning. |
| **Planned for v1.6** | Control is not yet implemented. Remediation is already planned and tracked in AUDT-03 with a v1.6 target date. | Already tracked in AUDT-03. Verify progress at each assessment. |

---

## 4. Assessment Checklist

### Regulation 1 -- Definitions (Hagdarot)

Establishes the terminology and definitions used throughout the regulations.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 1.1 | Hebrew-English regulatory terms defined for audit clarity | Comprehensive glossary mapping 30+ Hebrew regulatory terms to English equivalents across 6 categories | GLOSS-01 | Full document | **Compliant** | Glossary covers all key regulatory terms including Security Officer, database definition, security levels, and data classification terminology |

---

### Regulation 2 -- Database Definition Document (Mismach Hagdarat Ma'agarei Meida)

Requires documentation of all databases containing personal data, including their structure, purpose, and classification.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 2.1 | All collections with PII identified and classified | 22 MongoDB collections inventoried with PII flags and sensitivity classification (RESTRICTED / SENSITIVE / INTERNAL / PUBLIC) | DBDF-01 | Section 2 | **Compliant** | 11 collections flagged as containing PII; 4-tier classification applied to all collections |
| 2.2 | Field-level sensitivity classification | Every field in PII-containing collections classified with sensitivity tier and PII flag | DBDF-01 | Section 2 (per-collection tables) | **Compliant** | Field-level tables for all 22 collections with data type, sensitivity, PII flag |
| 2.3 | Data purpose and lawful basis documented | Processing purpose and lawful basis documented for each collection with regulatory mapping | DBDF-02 | Section 2 | **Compliant** | 6 lawful bases applied across all collections; regulatory references included |
| 2.4 | Retention policies defined per collection | Retention periods documented for all PII-containing collections with enforcement mechanism noted | DBDF-02 | Section 3 | **Partially Compliant** | Retention policies defined but TTL enforcement not technically implemented. No MongoDB TTL indexes exist on any collection. Tracked as R-11 in RISK-01. |
| 2.5 | Minors' data specifically identified | Dedicated assessment of minors' data processing including age range, data types, and elevated protection requirements | DBDF-03 | Full document | **Compliant** | Students aged 6-18 identified; 5 minors' data handling gaps documented with v1.6 remediation plan |
| 2.6 | Data minimization process documented | Annual data minimization review process defined with specific review areas and findings framework | DBDF-04 | Full document | **Partially Compliant** | Process defined and documented; no technical enforcement of data minimization. Initial review identifies denormalized studentName (R-12) and preview data retention (R-06). |
| 2.7 | Database registered with Privacy Protection Authority (PPA) | Database registration status verified with PPA | -- | -- | **TO BE VERIFIED** | Registration requirement unclear for pre-launch platform. Flagged for Security Officer verification before production launch. See 30-RESEARCH.md Open Question #3. |

---

### Regulation 3 -- Security Officer (Memuneh Al Avtachat Meida)

Requires appointment of a Security Officer with defined responsibilities and reporting authority.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 3.1 | Security Officer role defined with responsibilities | 10 responsibilities defined with specific actions, frequencies, and deliverables | SECOFF-01/02 | Section 3.3 | **Compliant** | Responsibilities cover risk register, policy maintenance, monitoring, reporting, incident coordination, audit coordination, vendor oversight, data minimization, resource advocacy, training |
| 3.2 | Named individual appointed as Security Officer | Formal appointment document template with position, authority, and scope | SECOFF-01/02 | Section 4 | **Partially Compliant** | Position title documented (CTO / Lead Developer); named individual required before production launch. Appointment template ready for completion. |
| 3.3 | Conflict of interest documented and mitigated | Conflict of interest provisions documented for pre-launch developer-as-Security-Officer arrangement with interim mitigations and resolution timeline | SECOFF-01/02 | Section 3.5 | **Compliant** | Pre-launch exception documented; external audit required as mitigation; resolution timeline tied to production launch or team growth |
| 3.4 | Reporting line to senior management | Direct reporting to CEO/CTO with escalation authority and independence from IT operations | SECOFF-01/02 | Section 3.2 | **Compliant** | Reporting line defined; independence requirement documented |
| 3.5 | Adequate resources provided | Required resources enumerated: production environment access, Atlas/Render/S3/SendGrid consoles, audit budget, tooling budget, training materials | SECOFF-01/02 | Section 3.6 | **Compliant** | 8 required resources specified |

---

### Regulation 4 -- Security Procedure Document (Mismach Nohalei Avtacha)

Requires establishment of a security procedure document covering access management, authentication, and data handling.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 4.1 | Security procedures established | Comprehensive security procedures document covering access management, authentication, backup, data handling, change management, and operations | SECPR-01/02/03 | Full document | **Compliant** | Three sub-documents address procedures (SECPR-01), backup/recovery (SECPR-02), and data handling (SECPR-03) |
| 4.2 | Access management procedures | Procedures for granting, modifying, and revoking access; role-based access model documented | SECPR-01 | Section 3 | **Compliant** | Procedures reference ACPOL-01 permission matrix |
| 4.3 | Authentication procedures | Password requirements, token management, session handling procedures documented | SECPR-01 | Section 4 | **Compliant** | References ACPOL-02 authentication policy |
| 4.4 | Data handling procedures by classification | Handling rules defined for each data classification tier (RESTRICTED, SENSITIVE, INTERNAL, PUBLIC) | SECPR-03 | Section 6 | **Partially Compliant** | Handling rules documented per tier but NOT technically enforced differently by classification level. All tiers receive same technical controls. |

---

### Regulation 5 -- Security Procedure Contents (Tokhen Nohalei Avtacha)

Specifies required contents of the security procedure including backup, recovery, retention, and deletion.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 5.1 | Backup procedures documented | Atlas automated backup (continuous, 2-hour granularity), S3 versioning, application-level snapshots (deletion/import) | SECPR-02 / BACK-01 | SECPR-02 Section 5, BACK-01 Section 3 | **Compliant** | Three-tier backup architecture documented with provider details |
| 5.2 | Recovery procedures with runbooks | Step-by-step recovery runbooks for Atlas point-in-time restore, S3 versioned object recovery, and application snapshot restore | BACK-01 | Section 5 | **Compliant** | Detailed runbooks with specific Atlas/S3 commands and procedures |
| 5.3 | Backup testing schedule | Quarterly testing schedule for Atlas restore, S3 recovery, and application snapshot restore with escalation procedure | BACK-01 | Section 6 | **Partially Compliant** | Testing schedule defined; no testing has been performed yet. 4 blocking pre-production requirements identified (Atlas backup verification, restore test, snapshot restore, secure secret backup). |
| 5.4 | Data retention and deletion procedures | Retention periods defined per collection; soft-delete, cascade deletion, and tenant purge mechanisms documented | SECPR-03 / DBDF-02 | SECPR-03 Section 7, DBDF-02 Section 3 | **Partially Compliant** | Procedures documented; TTL enforcement not technically implemented. Deletion mechanisms (soft-delete, cascade, tenant purge) are implemented. |

---

### Regulation 6 -- Physical Security (Avtacha Fizit)

Requires physical security measures for systems containing personal data.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 6.1 | Physical security for data processing infrastructure | Cloud-hosted platform with no on-premises infrastructure. Physical security fully managed by cloud providers under shared responsibility model. | SECPR-01 | Section 2 | **Compliant** | N/A for cloud-hosted SaaS. MongoDB Atlas (AWS), Render (AWS/GCP), AWS S3 all maintain SOC 2 / ISO 27001 certifications covering physical security. Provider certifications documented in SMAP-03. |

---

### Regulation 7 -- System and Data Mapping (Mipu'i Ma'arachot VeNtunim)

Requires documentation of system architecture, data flows, and third-party services.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 7.1 | Architecture diagram with data classification | System architecture diagram showing all components, connections, data classification labels, and security boundary annotations | SMAP-01 | Full document | **Compliant** | 7 components documented with protocol, data classification, encryption status |
| 7.2 | Data flow map tracing PII movement | 11 data flow paths documented with source, destination, data types, encryption status, and classification level | SMAP-02 | Full document | **Compliant** | Includes authentication, CRUD operations, import, export, impersonation flow |
| 7.3 | Third-party vendor inventory | 5 vendors documented with service type, data access scope, classification, certifications, and DPA status | SMAP-03 | Full document | **Compliant** | MongoDB Atlas, Render, AWS S3, SendGrid, Gmail documented with risk notes |

---

### Regulation 8 -- Access Control / Authorization (Bakarat Gisha -- Harsha'ot)

Requires role-based access control with documented permissions.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 8.1 | All application roles documented | 10 roles documented: 5 active (Super Admin, Admin, Teacher, Conductor, Ensemble Instructor) and 5 unused (Deputy Admin, Department Head, Accompanist, Teacher-Accompanist, Guest) | ACPOL-01 | Section 2 | **Compliant** | Roles derived from actual ROLE_PERMISSIONS configuration |
| 8.2 | Permission matrix per role | Complete permission matrix mapping each active role to API endpoint access with route-level enforcement verification | ACPOL-01 | Section 3 | **Compliant** | Matrix shows actual requireAuth() arrays per route group |
| 8.3 | Tenant data boundaries | Multi-tenant isolation controls: enforceTenant middleware, buildContext with tenantId injection, buildScopedFilter, stripTenantId | ACPOL-01 | Section 4 | **Compliant** | 4 layers of tenant isolation documented |
| 8.4 | Unused roles identified and documented | 5 roles with no RBAC entry AND no route-level auth identified as functionally unused | ACPOL-01 | Section 5 | **Compliant** | Unused roles documented; no security risk because they have no permissions |

---

### Regulation 9 -- Access Control / Authentication (Bakarat Gisha -- Zimui)

Requires authentication mechanisms for database access.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 9.1 | Authentication mechanisms documented | JWT-based authentication: access tokens (1-hour expiry), refresh tokens (version counter for revocation), bcrypt password hashing (10 rounds) | ACPOL-02 | Section 2-4 | **Compliant** | Token lifecycle, generation, validation, revocation all documented |
| 9.2 | Password policy defined | Minimum password requirements, password change flow, invitation-based account creation documented | ACPOL-02 | Section 3 | **Partially Compliant** | Password policy exists but default password "123456" auto-set on accounts created without password (R-05). requiresPasswordChange flag depends on frontend enforcement. |
| 9.3 | Token management (JWT lifecycle) | Access and refresh token lifecycle: generation, validation, refresh, revocation, expiry. Separate secrets for access and refresh tokens. | ACPOL-02 | Section 4 | **Compliant** | Token version counter enables per-user revocation; access tokens expire after 1 hour |
| 9.4 | Multi-factor authentication (MFA) | MFA required for medium-security databases | ACPOL-02 | -- | **Non-Compliant** | No MFA exists on the platform. No second authentication factor for any user role. Planned for v1.6. |

---

### Regulation 10 -- Access Logging and Monitoring (Rishum Gisha VeNitur)

Requires logging of access to personal data and monitoring mechanisms.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 10.1 | Logging policy established | Comprehensive logging policy covering log targets, events, retention, and review schedule | ACPOL-03 | Full document | **Compliant** | 5 log targets documented (platform_audit_log, deletion_audit, security_log, import_log, Pino logger) |
| 10.2 | Events logged defined | Events categorized by current implementation status: LOGGED (admin actions, deletions), PARTIALLY LOGGED (security events), NOT LOGGED (tenant-level CRUD, auth events) | ACPOL-03 | Section 2-3 | **Partially Compliant** | Limited logging categories. Super admin and deletion events well-logged; tenant-level administrative actions, authentication events, and minors' data access NOT logged. R-08 in RISK-01. |
| 10.3 | Log retention schedule | Three-tier retention: 30 days operational, 2 years security, 7 years legal/minors' data | ACPOL-03 | Section 5 | **Compliant** | Retention tiers defined with regulatory basis for each |
| 10.4 | Log review schedule | Review schedule defined: weekly anomaly checks, monthly summary review, quarterly trend analysis | ACPOL-03 | Section 6 | **Compliant** | Schedule aligned with SECOFF-01/02 reporting cadence |
| 10.5 | User notification about monitoring (Reg. 10(e)) | User notification policy defining what users are told about monitoring, delivery mechanism, and user rights | LOG-01 | Full document | **Partially Compliant** | Policy defined with draft notification text and delivery mechanism (login banner or ToS clause). Uses honest "may be monitored" language reflecting partial monitoring capabilities. Delivery mechanism not yet implemented. |

---

### Regulation 11 -- Incident Response (Tipul BeIru'ei Avtacha)

Requires an incident response plan with severity classification and notification procedures.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 11.1 | Incident response plan with severity classification | 4-priority incident classification (P1 Critical through P4 Low) with response time targets, escalation procedures, and role assignments | INCD-01 | Section 2 | **Compliant** | Priority-based classification with specific SLAs per level |
| 11.2 | Breach notification procedure | PPA-directed notification model: data subject notification not mandatory; PPA orders case-by-case. Notification templates for PPA and data subjects included. | INCD-02 | Section 3.3 | **Compliant** | 4-level escalation: anomaly detection, security incident, data breach, regulatory breach notification |
| 11.3 | Incident log template | Standardized incident report format with all required fields: detection, classification, containment, eradication, recovery, lessons learned | INCD-03 | Appendix | **Compliant** | Template includes PPA notification form fields |
| 11.4 | Minors' data incident escalation | Automatic severity elevation for minors' data incidents: P4->P3, P3->P2, P2->P1 | INCD-01 | Section 2 | **Compliant** | Severity elevation rule ensures minors' data incidents receive elevated response |

---

### Regulation 12 -- Portable Device Restrictions (Hagbalot Al Hatkhanim Niydim)

Requires restrictions on portable device access compatible with the security level.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 12.1 | Mobile device policy defined | Browser-based SaaS access policy: no MDM, no native app, focus on user behavior and browser hygiene | MOB-01 | Full document | **Compliant** | Appropriately scoped for browser-only access model |
| 12.2 | Data handling restrictions on devices | Restrictions on screenshots, exports, sharing via messaging apps. BYOD policy for tenant and platform personnel. | MOB-01 | Section 7 | **Partially Compliant** | Policy-level restrictions defined; no DLP (Data Loss Prevention) technical enforcement. Users advised not to screenshot student data or forward via WhatsApp/email, but this is not technically enforced. |
| 12.3 | Lost/stolen device procedure | Immediate password change, admin notification, session review procedure | MOB-01 | Section 9 | **Compliant** | Procedure documented; relies on JWT expiry (1-hour access token) as technical control |
| 12.4 | Network security requirements | Guidance on avoiding public Wi-Fi, preferring trusted networks, using VPN when available | MOB-01 | Section 4 | **Compliant** | User behavior guidance documented |

---

### Regulation 13 -- Risk Assessment (Ha'arakhat Sikunim)

Requires periodic risk assessment for databases at medium security level or higher.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 13.1 | Risk assessment conducted | Formal risk assessment using Likelihood x Impact matrix with 12 identified risks scored and classified | RISK-01 | Full document | **Compliant** | Assessment completed 2026-03-02; 3x3 risk matrix with defined levels |
| 13.2 | Threats and vulnerabilities identified | 12 specific threats identified covering cross-tenant leaks, credential exposure, API vulnerabilities, default passwords, data retention, logging gaps, cross-border transfer, S3 misconfiguration | RISK-01 | Section 3 | **Compliant** | Comprehensive threat identification across platform components |
| 13.3 | Existing and planned mitigations documented | Each risk has: existing controls, recommended mitigations, target phase (v1.6), and residual risk assessment | RISK-01 | Section 3 (per-risk) | **Compliant** | Mitigations documented for all 12 risks |
| 13.4 | Risk acceptance criteria defined | Acceptance criteria by risk level: CRITICAL (immediate), HIGH (v1.6), MEDIUM (2 cycles), LOW (accept/opportunistic) | RISK-01 | Section 6.4 | **Compliant** | Explicit acceptance decisions for LOW (R-12), MEDIUM (R-05,06,07,08,09), and HIGH (R-01,02,03,04,10,11) |

---

### Regulation 14 -- Communication Security / Encryption (Hatzfana)

Requires encryption for data transfer over public networks and appropriate encryption standards.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 14.1 | Encryption policy for data in transit | TLS 1.2+ enforced on all 8 connection paths: browser-frontend, browser-API, API-Atlas, API-S3, API-SendGrid, API-Gmail, WebSocket, Atlas replication | ENC-01 | Section 2 | **Compliant** | All connection paths verified as ENFORCED with provider-managed certificates |
| 14.2 | Encryption for data at rest | Provider-level encryption: Atlas AES-256 default encryption, S3 SSE (SSE-S3), Render platform default | ENC-01 | Section 3 | **Partially Compliant** | Provider-level encryption covers all stored data. No field-level encryption for RESTRICTED data (PII within blob fields like previewData, snapshotData). Gap documented in ENC-01 Section 6. |
| 14.3 | Key management principles | Provider-managed key management (Atlas, AWS, Render). Application-level: bcrypt for passwords, crypto.randomBytes for tokens. | ENC-01 | Section 4 | **Partially Compliant** | No application-level encryption key management or key rotation mechanism. Provider-managed only. |
| 14.4 | Browser data encryption | JWT and session data stored in browser localStorage | ENC-01 | Section 3 | **Partially Compliant** | Browser localStorage stores JWT in plaintext -- XSS risk. Documented as R-04 related concern. No mitigation beyond CSP headers. |

---

### Regulations 15-16 -- Outsourcing / Vendor Management (Miy'un Shiru'tim)

Requires written data security agreements with all data processors and vendor risk assessment.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 15.1 | Vendor inventory with data scope | 5 vendors documented with service type, data access scope, classification level, and certifications | SMAP-03 | Full document | **Compliant** | MongoDB Atlas, Render, AWS S3, SendGrid, Gmail all inventoried with data scope detail |
| 15.2 | DPA templates for all vendors | Pre-populated DPA templates with 12 mandatory clause areas per Israeli Reg. 15-16 and PPA Guideline 2/2011 | VEND-02 | Section 4 | **Partially Compliant** | DPA templates created with vendor-specific details. DPAs NOT yet executed with all 5 vendors. Execution required before production launch. |
| 15.3 | Vendor risk assessment | Quantitative weighted risk scoring (1-5 scale) for all 5 vendors: MongoDB Atlas (2.45 HIGH), Render (2.30 HIGH), AWS S3 (3.10 MEDIUM), SendGrid (2.55 HIGH), Gmail (2.75 HIGH) | VEND-03 | Section 3 | **Compliant** | Risk scores calculated; monitoring recommendations documented per vendor |
| 15.4 | Cross-border data transfer basis | SendGrid transfers teacher email/name data to US infrastructure | SMAP-03 / VEND-01 | SMAP-03 Section 4.4, VEND-01 | **Partially Compliant** | Cross-border transfer identified and documented as risk R-09. Legal basis for transfer NOT yet documented. DPA with cross-border provisions needed. |

---

### Regulation 17 -- Personnel Security / Training (Avtachat Koach Adam)

Requires training, confidentiality agreements, and onboarding/offboarding procedures for personnel with data access.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 17.1 | Onboarding/offboarding procedures | Platform and tenant personnel onboarding (access provisioning, training) and offboarding (access revocation, secret rotation, handover) procedures defined | PERS-01 | Section 3 | **Compliant** | Separate procedures for platform and tenant personnel; offboarding includes secret rotation note |
| 17.2 | Security awareness training | Training outline with 8 topics: data handling, password security, incident reporting, minors' data, device security, social engineering, terms compliance, rights and responsibilities | PERS-02 | Section 4 | **Partially Compliant** | Training outline created with topic descriptions and delivery method. Training NOT yet delivered to any personnel. No completion records exist. |
| 17.3 | Confidentiality agreements | Agreement template covering data confidentiality, minors' data protections, incident reporting obligation, and post-termination obligations (indefinite for minors' data) | PERS-03 | Section 5 | **Partially Compliant** | Template created with all required clauses. Agreements NOT yet signed by any personnel. |

---

### Regulation 18 -- Periodic Audit (Bikoret Tik'ufit)

Requires periodic security audit at least every 24 months with auditor independence.

| # | Requirement | Control | Document | Section | Status | Evidence / Notes |
|---|------------|---------|----------|---------|--------|-----------------|
| 18.1 | Audit program established | Annual audit cycle exceeding regulatory 24-month minimum. Schedule includes self-assessment, external audit, risk assessment update, document review, and remediation tracking. | AUDT-01 | Full document | **Compliant** | Audit schedule, methodology, report format, and first audit timeline all defined |
| 18.2 | Self-assessment checklist | This document (AUDT-02) -- comprehensive checklist mapping all 18 regulations to controls with document references and compliance statuses | AUDT-02 | This document | **Compliant** | Master cross-reference document with 50+ checklist items |
| 18.3 | Remediation tracking | Formal finding lifecycle (Open -> Assigned -> In Progress -> Verification -> Closed) with severity-based SLAs and initial remediation register | AUDT-03 | Full document | **Compliant** | Finding lifecycle, severity framework, and initial register pre-populated with known gaps |
| 18.4 | Auditor independence | External audit required; auditor must NOT be the Security Officer. Pre-launch conflict of interest acknowledged and mitigated. | AUDT-01 | Section 5 | **Compliant** | Independence provisions align with SECOFF-01/02 Section 3.5 |
| 18.5 | First audit scheduled | Pre-production self-assessment before first tenant; external audit within 6 months of first production tenant | AUDT-01 | Section 8 | **Partially Compliant** | Timeline defined; first assessment not yet executed (platform is pre-launch). |

---

## 5. Summary Statistics

**Assessment Date:** 2026-03-02 (initial baseline during document creation)

| Metric | Count | Percentage |
|--------|-------|-----------|
| **Total checklist items** | 51 | 100% |
| **Compliant** | 31 | 61% |
| **Partially Compliant** | 18 | 35% |
| **Non-Compliant** | 1 | 2% |
| **TO BE VERIFIED** | 1 | 2% |

**Breakdown by regulation:**

| Regulation | Items | Compliant | Partially | Non-Compliant | To Verify |
|-----------|-------|-----------|-----------|---------------|-----------|
| Reg. 1 -- Definitions | 1 | 1 | 0 | 0 | 0 |
| Reg. 2 -- Database Definition | 7 | 3 | 3 | 0 | 1 |
| Reg. 3 -- Security Officer | 5 | 4 | 1 | 0 | 0 |
| Reg. 4 -- Security Procedures | 4 | 3 | 1 | 0 | 0 |
| Reg. 5 -- Procedure Contents | 4 | 2 | 2 | 0 | 0 |
| Reg. 6 -- Physical Security | 1 | 1 | 0 | 0 | 0 |
| Reg. 7 -- System Mapping | 3 | 3 | 0 | 0 | 0 |
| Reg. 8 -- Authorization | 4 | 4 | 0 | 0 | 0 |
| Reg. 9 -- Authentication | 4 | 2 | 1 | 1 | 0 |
| Reg. 10 -- Logging | 5 | 3 | 2 | 0 | 0 |
| Reg. 11 -- Incident Response | 4 | 4 | 0 | 0 | 0 |
| Reg. 12 -- Portable Devices | 4 | 3 | 1 | 0 | 0 |
| Reg. 13 -- Risk Assessment | 4 | 4 | 0 | 0 | 0 |
| Reg. 14 -- Encryption | 4 | 1 | 3 | 0 | 0 |
| Reg. 15-16 -- Vendors | 4 | 2 | 2 | 0 | 0 |
| Reg. 17 -- Personnel | 3 | 1 | 2 | 0 | 0 |
| Reg. 18 -- Periodic Audit | 5 | 4 | 1 | 0 | 0 |

**Overall Assessment:** The Tenuto.io compliance program achieves **61% full compliance** at the documentation and policy level. The 35% partially compliant items primarily reflect the intentional v1.5 scope limitation: policies and documentation are established, but technical enforcement is deferred to v1.6 Technical Hardening. The single non-compliant item (no MFA) is a known gap planned for v1.6. This is consistent with the compliance strategy of establishing the governance foundation before implementing technical controls.

---

## 6. Assessment Record

Record each assessment conducted using this checklist:

| Date | Assessor | Type (Self / External) | Items Reviewed | New Findings | Findings Closed | Overall Status |
|------|---------|----------------------|----------------|-------------|----------------|----------------|
| 2026-03-02 | Development Team | Baseline (document creation) | 51 | 25+ (initial register) | 0 | Baseline established |
| | | | | | | |
| | | | | | | |

---

## 7. Review Schedule

### 7.1 Regular Review

- **Semi-annual:** This checklist is used for the internal self-assessment per AUDT-01 Section 4.1. During each semi-annual assessment, all items are reviewed and statuses updated.
- **Annual:** The checklist structure itself (items, regulation mapping, document references) is formally reviewed annually per AUDT-01 to ensure it remains aligned with the current regulatory environment and platform architecture.

### 7.2 Triggered Review

| Trigger | Review Scope |
|---------|-------------|
| Regulatory changes to any of the 18 regulations | Affected regulation section(s) |
| Amendment 13 secondary regulations published | Full checklist review for new requirements |
| New compliance document created | Add checklist items referencing new document |
| Existing compliance document significantly revised | Update affected checklist items |
| New platform feature with compliance implications | Review affected regulations and add items if needed |
| External audit findings | Update statuses and evidence notes for affected items |

---

## 8. Document Cross-References (Master Document Index)

This table serves as the master index for all compliance documents produced during the Tenuto.io v1.5 Privacy Compliance Foundation milestone (Phases 27-30).

| Document | ID | Phase | Primary Regulation(s) | Description |
|----------|-----|-------|----------------------|-------------|
| Data Inventory | DBDF-01 | 27 | Reg. 2 | 22 MongoDB collections inventoried with PII classification |
| Data Purposes | DBDF-02 | 27 | Reg. 2 | Processing purposes, lawful basis, retention policies |
| Minors' Data Assessment | DBDF-03 | 27 | Reg. 2 | Minors' data identification and elevated protection |
| Data Minimization Review | DBDF-04 | 27 | Reg. 2 | Annual data minimization review process |
| Architecture Diagram | SMAP-01 | 27 | Reg. 7 | System architecture with security annotations |
| Data Flow Map | SMAP-02 | 27 | Reg. 7 | 11 data flow paths with encryption and classification |
| Vendor Inventory | SMAP-03 | 27 | Reg. 7, 15-16 | 5 third-party vendors with data scope and certifications |
| Risk Assessment | RISK-01 | 27 | Reg. 13 | 12 risks assessed with Likelihood x Impact matrix |
| Glossary | GLOSS-01 | 27 | Reg. 1 | 30+ Hebrew-English regulatory term mappings |
| Security Officer | SECOFF-01/02 | 28 | Reg. 3 | Role definition and appointment template |
| Security Procedures | SECPR-01/02/03 | 28 | Reg. 4-5 | Access management, backup, data handling procedures |
| Access Control Policy | ACPOL-01 | 28 | Reg. 8 | Role-based access control with permission matrix |
| Password and Authentication Policy | ACPOL-02 | 28 | Reg. 9 | JWT authentication, password policy, token management |
| Access Logging Policy | ACPOL-03 | 28 | Reg. 10 | Logging targets, events, retention, review schedule |
| Incident Response Plan | INCD-01/02/03 | 29 | Reg. 11 | Severity classification, response procedures, notification |
| Vendor Management | VEND-01/02/03 | 29 | Reg. 15-16 | DPA templates, vendor risk scoring, registry |
| Personnel Security | PERS-01/02/03 | 29 | Reg. 17 | Onboarding/offboarding, training, confidentiality |
| Backup and Recovery Plan | BACK-01 | 29 | Reg. 5 | Backup architecture, recovery runbooks, testing schedule |
| User Notification Policy | LOG-01 | 30 | Reg. 10(e) | Monitoring notification, delivery mechanism, user rights |
| Mobile Device Policy | MOB-01 | 30 | Reg. 12 | Browser-based access policy, device security, BYOD |
| Encryption Standards Policy | ENC-01 | 30 | Reg. 14 | Transit/at-rest encryption inventory, key management, gaps |
| Periodic Audit Program | AUDT-01 | 30 | Reg. 18 | Annual audit cycle, methodology, first audit timeline |
| Compliance Self-Assessment Checklist | AUDT-02 | 30 | All regulations | This document -- master compliance cross-reference |
| Remediation Tracking Process | AUDT-03 | 30 | Reg. 18 | Finding lifecycle, severity SLAs, initial register |

**Total:** 24 compliance documents (some covering multiple sub-requirements under combined IDs)

---

**Document ID:** AUDT-02
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
