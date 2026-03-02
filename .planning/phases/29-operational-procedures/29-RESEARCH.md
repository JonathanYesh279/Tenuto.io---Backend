# Phase 29: Operational Procedures - Research

**Researched:** 2026-03-02
**Domain:** Israeli Privacy Compliance -- Operational Procedures (Incident Response, Vendor Management, Personnel Security, Backup/Recovery)
**Confidence:** HIGH

---

## Summary

Phase 29 creates the operational procedures that implement the governance framework and policies established in Phase 28. While Phase 28 defined WHO is responsible (Security Officer) and WHAT the rules are (security policies), Phase 29 defines HOW those rules are executed in day-to-day operations. All deliverables are compliance documents (markdown files stored in `.planning/compliance/`). No code changes.

The phase covers 10 requirements grouped into four operational domains: Incident Response (INCD-01/02/03), Vendor Management (VEND-01/02/03), Personnel Security (PERS-01/02/03), and Backup/Recovery (BACK-01). Each domain produces actionable procedures, templates, and checklists that the Security Officer and platform administrators can use immediately upon production launch. The documents must build upon Phase 27 foundations (data inventory, vendor inventory, risk assessment) and Phase 28 policies (Security Officer role, security procedures, access control), cross-referencing them extensively.

The key structural insight is that these 10 requirements group naturally into 3-4 compliance documents. Incident response is one cohesive document (IR plan + breach notification + incident log template). Vendor management is another (DPA templates + risk assessment checklist + vendor registry). Personnel security is a third (onboarding/offboarding + training outline + confidentiality agreement). Backup/recovery extends the SECPR-02 section of SECURITY-PROCEDURES.md into a standalone operational document. Each document follows the established format from Phases 27-28: document ID, version, classification header, cross-references, and the Current State/Gap/Planned Remediation pattern where applicable.

**Primary recommendation:** Produce 3-4 compliance documents following the established Phase 27/28 format. Group related requirements into coherent documents: one for incident response (INCD-01/02/03), one for vendor management (VEND-01/02/03), one for personnel security (PERS-01/02/03), and one for backup/recovery (BACK-01). All documents reference the Security Officer as the responsible party and cross-link to Phase 27 data inventory and Phase 28 policies.

---

## Regulatory Framework

### Israeli Privacy Protection Regulations (Information Security), 5777-2017

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit). The following regulations are directly relevant to Phase 29:

| Regulation | Subject | Phase 29 Deliverable |
|-----------|---------|---------------------|
| Reg. 11 | Severe security incident notification | INCD-01, INCD-02, INCD-03 |
| Reg. 15-16 | Outsourcing and vendor data processing | VEND-01, VEND-02, VEND-03 |
| Reg. 17 | Personnel training and access obligations | PERS-01, PERS-02, PERS-03 |
| Reg. 5(b) | Backup and recovery procedures | BACK-01 |

**Confidence: MEDIUM** -- Regulation number mappings based on multiple English-language secondary sources (ICLG, DLA Piper, Baker McKenzie, AYR). Hebrew original not directly analyzed.

### Incident Notification Requirements (Reg. 11)

For **medium-security databases**, a "Severe Security Incident" (Teuna Chmurah / תקנת חמורה) is defined as:
- Unauthorized use of a **substantial/material part** of the database
- Use exceeding authorization affecting a substantial part of the database
- Compromise of the integrity of a substantial part of the data

Key notification obligations:
1. **Immediate notification to the PPA** (Privacy Protection Authority / Registrar of Databases) -- no specific hour/day deadline, but "immediately" after becoming aware
2. **Follow-up report** detailing steps taken in response to the incident
3. **Data subject notification** is NOT mandatory by default -- the PPA may ORDER notification after consulting with the Israel National Cyber Directorate, on a case-by-case basis
4. Notification submitted via a **specific PPA form** (online or email) containing: contact details, Security Officer details, incident date, data leak status, database registration status, controller/processor status, prior reports to other regulators, cyber insurance status, types of personal data processed, number of affected data subjects, number of authorized access holders

**Confidence: HIGH** -- Multiple authoritative sources agree (Baker McKenzie, AYR, ICLG, Legalink, DLA Piper).

### Vendor/Outsourcing DPA Requirements (Reg. 15-16)

The regulations and PPA Guideline 2/2011 require:
1. **Written data security agreement** with every processor BEFORE engagement
2. Agreement must specify:
   - Types of information to be processed
   - Purposes of processing
   - Systems the processor will access
   - Processing activities to be performed
   - Security measures the processor must implement
   - Duration and termination effects (data return/destruction)
   - Confidentiality obligations on processor's personnel and sub-contractors
   - Annual compliance reporting obligations
   - Incident notification obligations
   - Controller's audit and supervision rights
3. Controller must **assess data security risks** before entering the agreement
4. Controller **remains responsible** for data subjects' data regardless of outsourcing

The PPA published a clarifying manual on September 14, 2023, detailing contractual obligations with outsourcing providers including security questionnaires and control verification methods.

**Confidence: MEDIUM** -- Based on ICLG 2025-2026, DLA Piper, and Linklaters sources. Specific clause-level requirements may vary.

### Personnel Security Requirements (Reg. 17)

The regulations require:
1. Training for personnel with access to personal data upon granting new access credentials or modifying existing credentials
2. For medium-security databases, training must be conducted **at least once every 24 months** (PPA recommends annually)
3. Training records must be maintained

**Confidence: MEDIUM** -- Training frequency from ICLG and general secondary sources. Specific curriculum requirements not enumerated in available English translations.

---

## Phase 27-28 Foundation (Prerequisites)

Phase 29 documents MUST reference and build upon these existing compliance outputs:

### Phase 27 Documents

| Document | ID | Phase 29 Uses It For |
|----------|----|--------------------|
| DATA-INVENTORY.md | DBDF-01 | Incident scope assessment (which collections/data were affected) |
| DATA-PURPOSES.md | DBDF-02 | Retention requirements for incident logs; data subject notification scope |
| MINORS-DATA.md | DBDF-03 | Elevated incident severity when minors' data is involved |
| ARCHITECTURE-DIAGRAM.md | SMAP-01 | Incident response technical scope; backup infrastructure |
| DATA-FLOW-MAP.md | SMAP-02 | Breach impact tracing; vendor data exposure paths |
| VENDOR-INVENTORY.md | SMAP-03 | Vendor registry foundation; 5 vendors with DPA action items; risk matrix |
| RISK-ASSESSMENT.md | RISK-01 | 12 risks mapped to incident scenarios; risk scores for severity classification |
| GLOSSARY.md | GLOSS-01 | Consistent Hebrew-English terminology |

### Phase 28 Documents

| Document | ID | Phase 29 Uses It For |
|----------|----|--------------------|
| SECURITY-OFFICER.md | SECOFF-01/02 | Security Officer is incident coordinator (Responsibility #5); owns vendor DPA review (Responsibility #7); coordinates training (Responsibility #10) |
| SECURITY-PROCEDURES.md | SECPR-01/02/03 | SECPR-02 defines backup current state and gaps; BACK-01 extends this into operational procedure |
| ACCESS-CONTROL-POLICY.md | ACPOL-01 | Role-based access for onboarding/offboarding provisioning steps |
| AUTH-POLICY.md | ACPOL-02 | Authentication controls referenced in onboarding procedures |
| ACCESS-LOGGING-POLICY.md | ACPOL-03 | Logging categories referenced in incident investigation procedures |

### Key Facts from Phases 27-28

These facts constrain what Phase 29 documents must describe:

- **Security Officer responsibilities already defined:** Responsibility #5 (incident coordination), #7 (vendor DPA oversight), #10 (training coordination) -- Phase 29 procedures detail HOW these are executed
- **4-level escalation procedure** previously decided: anomaly detection -> security incident investigation -> severe security incident -> regulatory breach notification
- **5 vendors documented** in SMAP-03: MongoDB Atlas (CRITICAL risk), Render (HIGH risk), AWS S3 (MEDIUM), SendGrid (MEDIUM), Gmail (LOW-MEDIUM) -- all with DPA status "NEEDS VERIFICATION" and 10 action items
- **RPO 24h / RTO 4h** documented as recommended defaults in SECPR-02 -- BACK-01 operationalizes these
- **No backup restoration testing** has been performed -- BACK-01 must define the testing procedure
- **Pre-launch conflict of interest exception:** developer-as-Security-Officer is acknowledged with mitigation measures
- **12 risks identified** in RISK-01 with specific risk IDs (R-01 through R-12) -- incident scenarios should map to these
- **SendGrid cross-border transfer to US** requires DPA verification (action item V-06, V-09)
- **Default password "123456"** vulnerability (R-05) -- relevant to personnel onboarding procedures
- **No onboarding/offboarding procedures** documented anywhere -- identified as a gap in SECPR-01 Section 2.1

---

## Architecture Patterns

### Recommended Document Structure

```
.planning/compliance/
  INCIDENT-RESPONSE-PLAN.md        -- INCD-01 + INCD-02 + INCD-03
  VENDOR-MANAGEMENT.md             -- VEND-01 + VEND-02 + VEND-03
  PERSONNEL-SECURITY.md            -- PERS-01 + PERS-02 + PERS-03
  BACKUP-RECOVERY-PLAN.md          -- BACK-01
```

**Rationale for grouping:**
- INCD-01 (IR plan), INCD-02 (breach notification), and INCD-03 (incident log template) are three sections of one coherent incident response document. The IR plan defines severity levels, the breach notification section defines escalation to the PPA, and the incident log template provides the documentation format.
- VEND-01 (DPA templates), VEND-02 (risk assessment checklist), and VEND-03 (vendor registry) are three sections of vendor management. The registry documents who the vendors are, the risk assessment scores them, and the DPA templates provide the contractual framework.
- PERS-01 (onboarding/offboarding), PERS-02 (training outline), and PERS-03 (confidentiality agreement) are three sections of personnel security. They cover the full lifecycle: join (onboarding + training), operate (under confidentiality agreement), leave (offboarding).
- BACK-01 is a standalone document because backup/recovery is operationally distinct and extends SECPR-02 from SECURITY-PROCEDURES.md into a full operational procedure.

### Document Format Pattern (Established in Phases 27-28)

Every compliance document follows this structure:

```markdown
# [Document Title]

**Document ID:** [ID]
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (as defined in SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon [trigger condition]
**Related Documents:** [cross-references to other compliance docs]

---

## 1. Purpose
[Why this document exists, what regulation it satisfies]

## 2. Scope
[What systems, data, users it covers]

## 3-N. [Content sections]
[Actual procedure/template content]

## N+1. Review Schedule
[When and how the document is reviewed]

---

*Document: [ID] -- [Title]*
*Phase: 29-operational-procedures*
*Created: 2026-03-02*
```

### Pattern: Actionable Procedures with Clear Ownership

Unlike Phase 28 policy documents that describe "what" and "why," Phase 29 procedures describe "how," "who," and "when." Each procedure section should follow this structure:

1. **Trigger** -- What initiates this procedure (event, schedule, request)
2. **Responsible Party** -- Who executes each step (Security Officer, Platform Admin, Developer)
3. **Steps** -- Numbered, actionable steps with decision points
4. **Escalation** -- When and how to escalate to the next level
5. **Documentation** -- What records must be created
6. **Review** -- When this procedure is reviewed for currency

### Pattern: Template Documents

Several requirements call for templates (DPA template, incident log template, confidentiality agreement). Templates should:
- Include all required fields with clear descriptions
- Use placeholder syntax: `[FIELD_NAME -- description]`
- Include instructions for completion
- Reference the governing regulation or policy

### Anti-Patterns to Avoid

- **Generic boilerplate:** Procedures must reference the actual Tenuto.io implementation -- specific vendor names (MongoDB Atlas, Render, AWS S3, SendGrid, Gmail), specific roles (the 8 tenant roles + super admin), specific collections, specific code paths.
- **Procedure without escalation:** Every procedure must define what happens when the normal path fails or when a higher authority is needed.
- **Template without context:** DPA templates must be pre-populated with known vendor details from SMAP-03, not blank forms.
- **Training outline without platform specifics:** The training outline must cover Tenuto.io's actual data handling, not generic privacy awareness.
- **Backup procedure without testing:** The backup/recovery document must include a testing schedule and success criteria, not just describe the backup mechanism.

---

## Detailed Requirements Mapping

### INCD-01: Incident Response Plan

**Document:** INCIDENT-RESPONSE-PLAN.md, Section 3

**What to include:**

**Severity Classification (P1-P4):**

| Severity | Name | Definition (Tenuto.io-specific) | Response Time | Examples |
|----------|------|--------------------------------|---------------|---------|
| P1 | Critical | Confirmed data breach affecting minors' PII (student records) or credential exposure across tenants. Meets PPA "Severe Security Incident" definition for medium-security database. | Immediate (within 1 hour) | Cross-tenant data leak (R-01), database dump with credentials exposed (R-02), mass student PII exposure (R-03), JWT secret compromise enabling platform-wide access (R-04) |
| P2 | High | Confirmed unauthorized access or data integrity compromise within a single tenant. Significant system availability impact. May constitute a Severe Security Incident pending scope assessment. | Within 4 hours | S3 bucket exposed publicly (R-10), single-tenant admin account compromised via default password (R-05), complete database corruption requiring Atlas recovery |
| P3 | Medium | Suspected unauthorized access, failed exploitation attempt, partial system degradation. Regulatory non-compliance discovered. | Within 24 hours | SendGrid DPA non-compliance discovered (R-09), import log PII retention violation found (R-06), deletion snapshots accumulating PII beyond policy (R-07) |
| P4 | Low | Minor security anomaly, policy violation without data exposure, informational events. | Within 72 hours | Failed login attempt pattern from single IP, student name denormalization inconsistency (R-12), insufficient logging gap discovered (R-08) |

**Role Assignments:**

| Role | Person/Position | Responsibilities During Incident |
|------|----------------|--------------------------------|
| Incident Commander | Security Officer (SECOFF-01/02) | Overall incident management; declares severity; authorizes escalation |
| Technical Lead | Lead Developer / CTO | Technical investigation; containment actions; evidence preservation |
| Communications Lead | Incident Commander (pre-launch, single-person team) | Tenant notification; PPA notification; status updates |
| Legal Advisor | External counsel (on retainer) | Regulatory notification guidance; liability assessment |

**Incident Lifecycle Phases (aligned with NIST SP 800-61):**
1. **Preparation** -- IR plan exists; roles assigned; communication channels tested
2. **Detection and Analysis** -- Identify the incident; classify severity; document initial findings
3. **Containment** -- Stop the damage; isolate affected systems; preserve evidence
4. **Eradication** -- Remove the threat; patch the vulnerability; verify remediation
5. **Recovery** -- Restore services; verify data integrity; monitor for recurrence
6. **Post-Incident Activity** -- Document lessons learned; update IR plan; communicate findings

### INCD-02: Breach Notification Procedure

**Document:** INCIDENT-RESPONSE-PLAN.md, Section 4

**What to include:**

**4-Level Escalation Procedure** (previously decided):

| Level | Trigger | Action | Timeline | Responsible |
|-------|---------|--------|----------|-------------|
| 1 -- Anomaly Detection | Unusual system behavior, failed access patterns, monitoring alert | Log event; investigate; determine if security incident | Ongoing monitoring | Development Team |
| 2 -- Security Incident Investigation | Confirmed unauthorized access or system compromise (any severity) | Classify severity (P1-P4); begin incident response lifecycle; notify Security Officer | Within response time per severity | Technical Lead -> Security Officer |
| 3 -- Severe Security Incident | P1 or P2 confirmed affecting substantial part of database (meets Reg. 11 definition) | Activate PPA notification procedure; prepare PPA form; notify senior management | Immediately upon determination | Security Officer |
| 4 -- Regulatory Breach Notification | PPA notification submitted; PPA may order data subject notification | Submit PPA form; await PPA direction on data subject notification; engage legal counsel | Immediately (PPA); as directed (data subjects) | Security Officer + Legal Advisor |

**PPA Notification Form Fields:**
The notification must include all fields required by the PPA reporting form:
- Reporting entity contact details (organization name, address, phone, email)
- Senior management contact details
- Security Officer (data security officer) contact details
- Date of incident discovery
- Date incident is believed to have occurred
- Whether a data leak occurred (yes/no/unknown)
- Database registration status with the PPA
- Organization status: controller or processor
- Whether the incident was reported to another regulator or law enforcement
- Cyber insurance coverage status
- Types of personal data processed (from DBDF-01 classifications)
- Number of data subjects potentially affected
- Number of authorized access holders to the affected data
- Description of the incident
- Steps taken in response

**Data Subject Notification:**
- NOT mandatory by default under Israeli regulations
- PPA may ORDER notification after consulting with the Israel National Cyber Directorate
- If ordered: notification must describe what happened, what data was affected, what the data subject should do (e.g., change passwords), and contact information for the Security Officer
- Template for data subject notification should be pre-drafted

### INCD-03: Incident Log Template

**Document:** INCIDENT-RESPONSE-PLAN.md, Section 5 (or appendix)

**Required fields for every incident log entry:**

| Field | Description | Required |
|-------|-------------|----------|
| Incident ID | Unique identifier (format: INC-YYYY-NNN) | Yes |
| Date/Time Detected | When the incident was first identified | Yes |
| Date/Time Occurred | Estimated time the incident actually occurred | Yes |
| Reported By | Name/role of person who detected the incident | Yes |
| Severity | P1/P2/P3/P4 (may be updated during investigation) | Yes |
| Classification | Type: data breach, unauthorized access, system compromise, availability, policy violation | Yes |
| Affected Systems | Which components (database, API, hosting, email, storage) | Yes |
| Affected Data | Data types and classifications per DBDF-01 | Yes |
| Affected Tenants | Which tenants' data was impacted (or "all" for platform-level) | Yes |
| Minors Data Involved | Yes/No -- triggers elevated handling per DBDF-03 | Yes |
| Estimated Scope | Number of records/data subjects potentially affected | Yes |
| Description | Narrative description of what happened | Yes |
| Root Cause | Technical cause (filled during/after investigation) | When known |
| Containment Actions | Steps taken to stop the damage | Yes |
| Eradication Actions | Steps taken to remove the threat | Yes |
| Recovery Actions | Steps taken to restore normal operations | Yes |
| PPA Notified | Yes/No/Not Required -- with date if yes | Yes |
| Data Subjects Notified | Yes/No/Not Required/Ordered by PPA -- with date if yes | Yes |
| Lessons Learned | What to improve to prevent recurrence | Post-incident |
| Plan Updates | Changes made to IR plan or other compliance documents | Post-incident |
| Resolved Date | When the incident was fully resolved | When resolved |
| Reviewed By | Security Officer sign-off | Post-resolution |

### VEND-01: DPA Templates

**Document:** VENDOR-MANAGEMENT.md, Section 3

**What to include:**

One DPA template for each of the 3 specified cloud vendors, pre-populated with known details from SMAP-03:

**Template for MongoDB Atlas:**
- Processor: MongoDB, Inc.
- Processing purpose: Managed database hosting -- stores ALL platform data (22 collections)
- Data categories: RESTRICTED (student PII, teacher credentials, Israeli ID numbers), SENSITIVE (audit logs, import data, organizational data), INTERNAL (schedules, attendance)
- Data subjects: Teachers (adults), students (minors aged 6-18), administrators, super admins
- Data residency: [TO BE VERIFIED -- Atlas cluster region]
- Security measures: SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018; encryption at rest; replica sets
- Sub-processors: [to be verified from MongoDB DPA at mongodb.com/legal/data-processing-agreement]
- Note: MongoDB has a standard DPA available at https://www.mongodb.com/legal/data-processing-agreement (last updated January 15, 2026)

**Template for Render:**
- Processor: Render Services, Inc.
- Processing purpose: Application hosting -- processes all data in transit; holds all platform secrets in environment variables
- Data categories: RESTRICTED (all API request/response data passes through; JWT secrets, database URI, AWS keys stored as env vars)
- Data subjects: All platform users (teachers, students, administrators)
- Data residency: [TO BE VERIFIED -- Render deployment region]
- Security measures: SOC 2 Type II
- Sub-processors: [to be verified]

**Template for AWS S3:**
- Processor: Amazon Web Services, Inc.
- Processing purpose: File storage for bagrut (matriculation exam) documents
- Data categories: SENSITIVE (uploaded exam papers, certificates, program sheets -- may contain minors' names and grades)
- Data subjects: Students (minors aged 6-18) whose bagrut documents are stored
- Data residency: eu-central-1 (Frankfurt, Germany) -- confirmed in code via S3_REGION configuration
- Security measures: SOC 1, SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018; encryption at rest
- Sub-processors: [to be verified from AWS DPA]
- Note: AWS provides a GDPR Data Processing Addendum; verify acceptance in AWS account settings

**Each DPA template must include clauses for:**
1. Processing scope and purpose limitation
2. Controller's documented instructions
3. Confidentiality obligations on processor personnel
4. Security measures the processor must implement
5. Sub-processor authorization and notification framework
6. Data subject rights assistance
7. Breach notification from processor to controller (timeline and format)
8. Data return and destruction upon termination
9. Audit and inspection rights
10. Controller's right to terminate for non-compliance
11. Cross-border transfer provisions (especially for SendGrid -- US)
12. Liability and indemnification

### VEND-02: Vendor Risk Assessment Checklist

**Document:** VENDOR-MANAGEMENT.md, Section 4

**What to include:**

A structured assessment framework with weighted scoring:

**Assessment Categories:**

| Category | Weight | Questions |
|----------|--------|-----------|
| Data Access Scope | 25% | What data does the vendor access? What classification levels? Does it include minors' data? |
| Security Certifications | 20% | SOC 2? ISO 27001? Other certifications? When last audited? |
| Data Residency | 15% | Where is data stored? Any cross-border transfers? Legal basis for transfers? |
| DPA Status | 15% | Written DPA signed? Covers all required provisions per Reg. 15-16? |
| Incident Response | 10% | Does the vendor have an IR plan? What is their breach notification timeline to us? |
| Sub-processors | 10% | Does the vendor use sub-processors? Are they disclosed? Are they DPA-covered? |
| Business Continuity | 5% | What is the vendor's SLA? Backup provisions? Disaster recovery plan? |

**Scoring Framework:**

| Score | Level | Criteria |
|-------|-------|----------|
| 1 | Critical Risk | No DPA, no certifications, cross-border without legal basis, access to RESTRICTED data |
| 2 | High Risk | DPA incomplete, certifications expired or partial, RESTRICTED data access |
| 3 | Medium Risk | DPA in place, certifications current, some gaps in sub-processor disclosure |
| 4 | Low Risk | Full DPA, current certifications, data residency documented, comprehensive sub-processor list |
| 5 | Minimal Risk | All above + independent audit evidence + no cross-border transfer + no minors' data access |

**Weighted total determines vendor risk tier:**
- Score 1.0-2.0: CRITICAL -- immediate remediation required; halt engagement if DPA not resolved within 30 days
- Score 2.1-3.0: HIGH -- remediation required within 90 days
- Score 3.1-4.0: MEDIUM -- remediation recommended within next review cycle
- Score 4.1-5.0: LOW -- acceptable; monitor for changes

### VEND-03: Vendor Registry

**Document:** VENDOR-MANAGEMENT.md, Section 2

**What to include:**

Build upon SMAP-03 (Vendor Inventory from Phase 27) by adding operational status tracking:

| Vendor | Service | Data Scope | Classification | DPA Status | Risk Score | Last Assessed | Next Review | Action Items |
|--------|---------|-----------|---------------|-----------|-----------|--------------|------------|-------------|
| MongoDB Atlas | Database hosting | All 22 collections | RESTRICTED | NEEDS VERIFICATION | [to be scored] | 2026-03-02 (Phase 27) | [+ 1 year] | V-01, V-02 |
| Render | Application hosting | All data in transit + secrets | RESTRICTED | NEEDS VERIFICATION | [to be scored] | 2026-03-02 (Phase 27) | [+ 1 year] | V-03, V-04 |
| AWS S3 | File storage | Bagrut documents | SENSITIVE | NEEDS VERIFICATION | [to be scored] | 2026-03-02 (Phase 27) | [+ 1 year] | V-05, V-10 |
| SendGrid | Email delivery | Teacher emails, names, tokens | SENSITIVE | NEEDS VERIFICATION | [to be scored] | 2026-03-02 (Phase 27) | [+ 1 year] | V-06, V-09 |
| Gmail | Fallback email | Teacher emails, names, tokens | SENSITIVE | NEEDS VERIFICATION | [to be scored] | 2026-03-02 (Phase 27) | [+ 1 year] | V-07, V-08 |

**The registry must include:**
- All 10 action items from SMAP-03 Section 4 with status tracking
- A new-vendor onboarding process (what to do when adding a 6th vendor)
- Annual review trigger and procedure
- Risk score from the VEND-02 assessment framework

### PERS-01: Onboarding/Offboarding Security Procedures

**Document:** PERSONNEL-SECURITY.md, Section 3

**What to include:**

**Two user populations with different procedures:**

1. **Platform personnel** (developers, Security Officer, super admins) -- direct access to infrastructure
2. **Tenant personnel** (conservatory admins, teachers) -- access through the application

**Platform Personnel Onboarding:**

| Step | Action | Responsible | Verification |
|------|--------|-------------|-------------|
| 1 | Background check (if applicable) | Hiring manager | Completed before access granted |
| 2 | Sign confidentiality agreement (PERS-03 template) | New personnel | Signed copy filed |
| 3 | Complete security awareness training (PERS-02 outline) | New personnel | Training record created |
| 4 | Provision infrastructure access (MongoDB Atlas, Render, AWS, SendGrid, GitHub) | Lead Developer | Access logged with scope and date |
| 5 | Create super admin account (if applicable) | Existing super admin | Account created in `super_admin` collection |
| 6 | Document access scope in personnel access register | Security Officer | Register updated |

**Platform Personnel Offboarding:**

| Step | Action | Responsible | Verification |
|------|--------|-------------|-------------|
| 1 | Revoke all infrastructure access (Atlas, Render, AWS, SendGrid, GitHub) | Lead Developer | Access removal confirmed per service |
| 2 | Deactivate super admin account | Remaining super admin | `isActive: false` in `super_admin` collection |
| 3 | Rotate shared secrets if departing personnel had access | Lead Developer | JWT secrets, API keys rotated |
| 4 | Review and revoke any personal API keys or tokens | Security Officer | Audit of active tokens |
| 5 | Update personnel access register | Security Officer | Register updated with departure date |
| 6 | Remind of ongoing confidentiality obligations | Security Officer | Written reminder sent |

**Tenant Personnel (Teacher/Admin) Onboarding:**

| Step | Action | Responsible | Verification |
|------|--------|-------------|-------------|
| 1 | Admin creates teacher account (via dashboard or import) | Tenant Admin | Account created in `teacher` collection |
| 2 | Assign appropriate roles per ACCESS-CONTROL-POLICY.md | Tenant Admin | Roles set in `teacher.roles[]` |
| 3 | Send invitation email with secure token link | System (automated) | Invitation email delivered |
| 4 | Teacher sets password via invitation link | Teacher | `requiresPasswordChange` cleared |
| 5 | Acknowledge security awareness notice (PERS-02 briefing) | Teacher | Acknowledgment recorded |

**Tenant Personnel Offboarding:**

| Step | Action | Responsible | Verification |
|------|--------|-------------|-------------|
| 1 | Set `isActive: false` on teacher account | Tenant Admin | Account deactivated |
| 2 | Revoke active JWT tokens (increment `tokenVersion`) | System (automatic on deactivation) | Token invalidated |
| 3 | Review and reassign student assignments | Tenant Admin | Students reassigned to active teachers |
| 4 | Audit departing teacher's recent data access (when logging is implemented) | Tenant Admin | Access review completed |

**Note on default password risk:** The onboarding procedure must explicitly address the R-05 risk (default password "123456"). Until v1.6 removes this, the procedure must require that the invitation flow is used for ALL new accounts, and that teachers change their password immediately upon first login. The `requiresPasswordChange` enforcement is the control.

### PERS-02: Security Awareness Training Outline

**Document:** PERSONNEL-SECURITY.md, Section 4

**What to include:**

**Training audience:** Conservatory administrators and teachers (tenant-level users)
**Frequency:** Upon onboarding + at least once every 24 months (per regulatory requirement for medium-security databases). Recommended: annually at the start of each school year.
**Format:** Written briefing document (platform-specific, not generic); can be delivered as a self-paced document or a live session.

**Training Topics:**

| # | Topic | Duration (est.) | Content |
|---|-------|----------------|---------|
| 1 | Platform overview and data responsibilities | 10 min | What data the platform holds (reference DBDF-01); teachers' responsibility for student data; minors' data sensitivity (reference DBDF-03) |
| 2 | Password and account security | 10 min | Strong password requirements; never share credentials; invitation flow; report suspicious login attempts |
| 3 | Data handling principles | 10 min | Principle of least privilege; only access data needed for your role; do not export student data outside the platform without admin approval |
| 4 | Recognizing security incidents | 5 min | What to report: unexpected data access, suspicious emails, system behavior changes; how to report: contact tenant admin who escalates to Security Officer |
| 5 | Student data (minors) special handling | 10 min | Heightened sensitivity of student records; never share student information outside the platform; parent/guardian data privacy; no screenshots of student data |
| 6 | Device and access security | 5 min | Lock device when stepping away; use secure networks; do not access platform on shared/public computers; log out when finished |
| 7 | Incident reporting procedure | 5 min | Internal reporting chain: Teacher -> Tenant Admin -> Security Officer; what constitutes a reportable event |

**Total estimated time: 55 minutes**

**Training Record Template:**

| Field | Description |
|-------|-------------|
| Trainee Name | Full name of the person trained |
| Role | Teacher / Admin / Department Head / etc. |
| Tenant | Conservatory name |
| Training Date | Date training was completed |
| Training Version | Version of training materials used |
| Delivery Method | Self-paced document / Live session / Video |
| Acknowledgment | "I have read and understood the security awareness briefing" |
| Trainer / Verifier | Name of person who verified completion |

### PERS-03: Confidentiality Agreement Template

**Document:** PERSONNEL-SECURITY.md, Section 5 (or appendix)

**What to include:**

A template confidentiality agreement for personnel with access to platform data (primarily platform personnel -- developers, Security Officer, super admins). The agreement should cover:

1. Definition of confidential information: all personal data processed by the platform, including but not limited to student records (minors' PII), teacher credentials and personal data, organizational data, system architecture and security configurations
2. Obligations: not to disclose, copy, or use confidential information except as required for duties; protect against unauthorized access; report any suspected breach
3. Duration: obligations survive termination of engagement/employment
4. Minors' data clause: special acknowledgment of the sensitivity of minors' personal data and the heightened legal obligations
5. Return/destruction: upon termination, return or certify destruction of all confidential information in their possession
6. Consequences of breach: reference to Israeli Privacy Protection Law penalties (fines, imprisonment for willful infringement)
7. Signature lines: personnel member + authorized organizational representative

### BACK-01: Backup and Recovery Policy

**Document:** BACKUP-RECOVERY-PLAN.md

**What to include:**

This document extends SECPR-02 (Section 5 of SECURITY-PROCEDURES.md) from a policy description into a full operational procedure.

**Recovery Objectives (from SECPR-02, formalized):**

| Objective | Target | Justification | Status |
|-----------|--------|---------------|--------|
| RPO | 24 hours | Pre-launch SaaS; data changes during business hours; acceptable to lose one business day | Recommended -- pending Security Officer approval |
| RTO | 4 hours | Conservatory operations can continue manually for brief periods; Atlas PIT recovery + Render redeploy achievable within window | Recommended -- pending Security Officer approval |

**Backup Mechanisms:**

| Layer | Mechanism | Frequency | Retention | Recovery Method |
|-------|-----------|-----------|-----------|----------------|
| Infrastructure | MongoDB Atlas automated snapshots | Per Atlas backup policy (verify configuration) | Per Atlas tier (verify retention window) | Atlas Console -> Restore -> Point-in-Time or Snapshot |
| Infrastructure | MongoDB Atlas continuous backup (if enabled) | Continuous | Configurable PIT window | Atlas Console -> Restore -> Point-in-Time |
| Application | Deletion snapshots in `deletion_snapshots` | Per cascade deletion event | 90 days (recommended, pending TTL) | Manual restoration from snapshot document |
| Application | Tenant purge snapshots in `tenant_deletion_snapshots` | Per tenant purge event | 90 days grace period | Manual restoration from snapshot document |
| Application | Migration backups in `migration_backups` | Per migration script execution | 180 days (recommended, pending TTL) | Manual rollback from backup document |
| Application | Soft-delete preservation | Per deactivation event | Indefinite (until hard delete) | Set `isActive: true` |
| Code | Git repository (GitHub) | Per commit | Indefinite | Clone from GitHub; redeploy via Render |
| Secrets | Render environment variables | Manual management | Current values only | Re-enter from secure backup (if one exists) |

**Recovery Procedures (Step-by-Step Runbooks):**

The document must include recovery procedures for these scenarios:
1. **Single document recovery** -- restore an accidentally deleted student/teacher record from `deletion_snapshots`
2. **Database corruption** -- restore from Atlas PIT backup to a known-good timestamp
3. **Complete hosting failure** -- redeploy application from GitHub to Render (or alternative provider)
4. **Secret compromise** -- rotate all JWT secrets, database credentials, and API keys
5. **Tenant data recovery** -- restore a purged tenant from `tenant_deletion_snapshots` within the 90-day window

**Backup Testing Schedule:**

| Test | Frequency | Procedure | Success Criteria |
|------|-----------|-----------|------------------|
| Atlas backup verification | Quarterly | Verify in Atlas console that backups are completing successfully | Backup completion confirmed with timestamps |
| Atlas restore test | Annually | Restore a backup to a test cluster; run data integrity checks | All collections present; record counts match; sample queries return correct data |
| Application snapshot restore | Annually | Restore a deletion snapshot to verify the restoration procedure works | Restored document matches original (compare fields) |
| Secret rotation drill | Annually | Practice rotating JWT secrets with dual-key validation window | Application continues operating during rotation; old tokens are invalidated |
| Full disaster recovery drill | Annually | Simulate complete failure; execute recovery from scratch | Platform operational within RTO; data loss within RPO |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DPA legal clauses | Custom legal language from scratch | PPA Guideline 2/2011 provisions + vendor-provided DPA framework | Legal agreements require regulatory expertise; use established frameworks |
| Incident severity classification | Custom severity taxonomy | Standard P1-P4 mapped to Israeli "Severe Security Incident" definition | Industry-standard classification makes the IR plan legible to auditors and external counsel |
| Vendor risk scoring | Arbitrary risk numbers | Weighted category scoring aligned with industry practice (SIG Lite, CAIQ frameworks) | Structured scoring ensures repeatable, comparable assessments |
| Training curriculum | Generic privacy awareness | Platform-specific training referencing actual DBDF-01 data inventory and actual roles from ACPOL-01 | Generic training fails compliance because it does not address the specific data and systems |
| Breach notification form | Custom notification format | PPA-prescribed form fields (as documented in regulatory sources) | The PPA expects specific information in a specific format; custom formats risk non-compliance |

**Key insight:** Phase 29 procedures operationalize the policies from Phase 28. They must be specific to Tenuto.io (referencing actual vendors, actual data classifications, actual roles) while following established regulatory and industry frameworks (Israeli regulations, NIST IR lifecycle, standard DPA provisions).

---

## Common Pitfalls

### Pitfall 1: IR Plan Not Mapped to Identified Risks
**What goes wrong:** The incident response plan describes generic incident types (DDoS, malware) but does not address the 12 specific risks identified in RISK-01.
**Why it happens:** IR plans are often written as standalone documents without connecting to the organization's specific risk profile.
**How to avoid:** Each P1-P4 severity level must include specific examples from the R-01 through R-12 risk register. The IR plan should be a direct operational response to the risks already identified.
**Warning signs:** IR plan examples mention threats not in the risk register; risk register threats have no matching IR procedure.

### Pitfall 2: DPA Template Without Vendor-Specific Details
**What goes wrong:** The DPA template is a generic form that requires 100% manual completion. It provides no value over a blank document.
**Why it happens:** Template creators avoid committing to vendor-specific details to keep the template "reusable."
**How to avoid:** Pre-populate each DPA template with known details from SMAP-03 (vendor name, data scope, data classification, known certifications, data residency where confirmed). Leave blanks only for information that genuinely requires verification.
**Warning signs:** DPA templates contain only placeholder fields. No vendor name, no data scope, no specific data types.

### Pitfall 3: Onboarding Procedure Ignoring Default Password Risk
**What goes wrong:** The onboarding procedure describes account creation but does not address the known R-05 vulnerability (default password "123456").
**Why it happens:** The procedure focuses on the happy path (invitation flow) and does not account for the import/bulk creation path where default passwords are auto-set.
**How to avoid:** The onboarding procedure must explicitly state that all new accounts must use the invitation flow, and must reference R-05 with a warning about the default password risk and the `requiresPasswordChange` enforcement mechanism.
**Warning signs:** No mention of R-05 or default passwords in the onboarding section.

### Pitfall 4: Backup/Recovery Procedure Without Testing Evidence
**What goes wrong:** The backup procedure describes the backup mechanism but has never been tested. When a real recovery is needed, the procedure fails because of undocumented steps, changed configurations, or permissions issues.
**Why it happens:** Backup testing is operationally disruptive and easily deferred.
**How to avoid:** The BACK-01 document must include a testing schedule with specific frequency, procedure, and success criteria. The document should acknowledge that NO testing has been performed to date and flag this as a pre-production action item.
**Warning signs:** No "Testing" or "Verification" section in the backup procedure. No acknowledgment that testing is needed.

### Pitfall 5: Personnel Security Without Tenant-Level Procedures
**What goes wrong:** The personnel security document only covers platform-level personnel (developers, Security Officer) and ignores the tenant-level user lifecycle (conservatory admins and teachers).
**Why it happens:** "Personnel security" is naturally associated with employees, not end users.
**How to avoid:** The document must explicitly cover both populations: platform personnel (infrastructure access) and tenant personnel (application access). The procedures differ significantly -- platform personnel offboarding requires secret rotation; tenant personnel offboarding requires token revocation and student reassignment.
**Warning signs:** No mention of teacher account creation/deactivation. No mention of `isActive` flag or `tokenVersion`.

### Pitfall 6: Vendor Registry Duplicating SMAP-03 Without Adding Value
**What goes wrong:** VEND-03 (vendor registry) is a copy-paste of SMAP-03 (vendor inventory from Phase 27) with no additional operational content.
**Why it happens:** The source data is the same; the temptation is to just reproduce it.
**How to avoid:** VEND-03 must ADD operational tracking on top of SMAP-03: risk scores from VEND-02 framework, assessment dates, next review dates, action item status tracking, and a new-vendor onboarding process. It is a living operational document, not a static inventory.
**Warning signs:** VEND-03 contains no information not already in SMAP-03. No risk scores. No review dates. No action item status.

---

## Document Templates / Examples

### Incident Log Entry Example

```markdown
## Incident: INC-2026-001

| Field | Value |
|-------|-------|
| **Incident ID** | INC-2026-001 |
| **Date/Time Detected** | 2026-MM-DD HH:MM UTC |
| **Date/Time Occurred** | 2026-MM-DD HH:MM UTC (estimated) |
| **Reported By** | [Name], [Role] |
| **Severity** | P2 -- High |
| **Classification** | Unauthorized Access |
| **Affected Systems** | MongoDB Atlas (teacher collection) |
| **Affected Data** | Teacher credentials (RESTRICTED per DBDF-01) |
| **Affected Tenants** | Tenant: [name] |
| **Minors Data Involved** | No (teacher data only) |
| **Estimated Scope** | ~14 teacher records |
| **Description** | [Narrative] |
| **Root Cause** | [To be determined during investigation] |
| **Containment Actions** | 1. Reset affected passwords. 2. Increment tokenVersion for all affected teachers. 3. ... |
| **Eradication Actions** | [After root cause identified] |
| **Recovery Actions** | [After threat removed] |
| **PPA Notified** | Not Required -- does not meet "substantial part" threshold for medium-security DB |
| **Data Subjects Notified** | N/A |
| **Lessons Learned** | [Post-incident] |
| **Resolved Date** | [When resolved] |
| **Reviewed By** | Security Officer -- [date] |
```

### DPA Key Clauses Template

```markdown
## DATA PROCESSING AGREEMENT

Between: Tenuto.io Platform ("Controller")
And: [VENDOR_NAME] ("Processor")

### 1. Scope of Processing
- **Data types:** [from SMAP-03 vendor profile]
- **Data subjects:** [teachers/students/admins as applicable]
- **Processing purpose:** [specific service provided]
- **Systems accessed:** [specific systems from SMAP-03]

### 2. Security Measures
The Processor shall implement and maintain:
- [Vendor's stated certifications from SMAP-03]
- Encryption at rest and in transit
- Access controls limiting personnel access to data
- Regular security testing and audit

### 3. Sub-processors
- Processor shall not engage sub-processors without prior written consent
- Current sub-processors: [list or reference vendor's sub-processor page]
- Notification of new sub-processors: [30 days advance notice]

### 4. Breach Notification
- Processor shall notify Controller within [24/48/72] hours of discovering a personal data breach
- Notification shall include: nature of breach, categories of data affected, approximate number of data subjects, contact point, likely consequences, measures taken

### 5. Data Return and Destruction
- Upon termination: Processor shall [return / destroy] all personal data within [30] days
- Processor shall certify destruction in writing

### 6. Audit Rights
- Controller may audit Processor's compliance [annually / upon reasonable notice]
- Processor shall provide compliance reports [annually]

### 7. Cross-Border Transfer
- [If applicable -- e.g., SendGrid US transfer]
- Legal basis: [Standard Contractual Clauses / adequacy / consent / contractual necessity]

### 8. Term and Termination
- Duration: [aligned with service agreement]
- Controller may terminate if Processor fails to comply with data protection obligations
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic IR plans | Risk-mapped IR plans referencing specific organizational risk register | Industry trend 2020+ | IR plans address actual threats, not theoretical ones |
| Vendor DPAs as optional | Written DPAs mandatory before engagement (Israeli Reg. 15-16) | 2017 regulations | All 5 Tenuto.io vendors require DPA verification |
| Ad-hoc personnel training | Documented training with records, minimum 24-month cycle for medium-security | 2017 regulations | Training must be tracked and repeated |
| PPA notification only for "high" databases | Medium-security databases also subject to notification for severe incidents affecting substantial part | 2017 regulations, clarified 2022 | Tenuto.io's medium-security database is within scope |
| Data subject notification mandatory upon breach | PPA decides case-by-case after consulting Cyber Directorate | Israeli model differs from GDPR | Do NOT auto-notify data subjects; await PPA direction |

**Important distinction from GDPR:** Israeli breach notification does NOT require mandatory data subject notification. The PPA makes this determination. Copying a GDPR-style auto-notification procedure would be incorrect for the Israeli regulatory context.

---

## Open Questions

1. **Atlas Backup Configuration**
   - What we know: Atlas provides automated backups; continuous backup enables PIT recovery with RPO as low as 1 minute
   - What is unclear: The actual backup configuration for the Tenuto.io Atlas cluster has not been verified (frequency, retention window, PIT availability)
   - Recommendation: BACK-01 should document the expected configuration and flag verification as a pre-production action item. Do not state backup capabilities as fact without verification.

2. **Secret Backup Strategy**
   - What we know: All secrets are stored in Render environment variables. If the Render account is lost, secrets are lost.
   - What is unclear: Whether a secure backup of secrets exists outside Render (encrypted vault, offline storage)
   - Recommendation: BACK-01 should include a "Secrets Management" section that documents where secrets are stored and recommends a secure backup mechanism.

3. **PPA Form Availability**
   - What we know: The PPA prescribes a specific form for breach notification; submissions can be online or via email
   - What is unclear: The exact current version of the PPA form and submission URL
   - Recommendation: INCD-02 should document the known required fields and include a note to download the current PPA form before production launch. Include the gov.il reference URL.

4. **Vendor-Provided DPAs vs. Custom DPAs**
   - What we know: MongoDB has a standard DPA at mongodb.com/legal/data-processing-agreement (updated Jan 2026). AWS provides a GDPR DPA addendum. SendGrid/Twilio has a DPA.
   - What is unclear: Whether vendor-provided DPAs satisfy Israeli regulatory requirements or whether custom/supplementary clauses are needed
   - Recommendation: VEND-01 should provide templates that can be used as supplements to vendor-provided DPAs. The templates should list Israeli-specific provisions that must be verified in the vendor's standard DPA. Flag legal review as needed.

5. **Training Delivery for Tenant Users**
   - What we know: Training is required for medium-security databases at least every 24 months
   - What is unclear: The practical delivery mechanism for conservatory admins and teachers -- will it be in-app, a document, a live session, or a video?
   - Recommendation: PERS-02 should define the training content (topics, duration) but leave the delivery mechanism flexible. Recommend a self-paced written briefing for pre-launch, with the option to add in-app acknowledgment flows in v1.6.

---

## Sources

### Primary (HIGH confidence)
- Phase 27 compliance documents (9 documents in `.planning/compliance/`) -- direct analysis
- Phase 28 compliance documents (5 documents in `.planning/compliance/`) -- direct analysis
- Phase 28 RESEARCH.md -- technical state, regulatory framework
- Codebase analysis: existing backup mechanisms, authentication, access control
- SECURITY-PROCEDURES.md SECPR-02 -- backup current state and gaps
- SECURITY-OFFICER.md SECOFF-01/02 -- responsibility assignments (#5, #7, #10)
- VENDOR-INVENTORY.md SMAP-03 -- 5 vendors, 10 action items, risk matrix
- RISK-ASSESSMENT.md RISK-01 -- 12 risks with IDs R-01 through R-12

### Secondary (MEDIUM confidence)
- [ICLG Data Protection Report 2025-2026 Israel](https://iclg.com/practice-areas/data-protection-laws-and-regulations/israel) -- breach notification, vendor DPA, training requirements
- [AYR -- Q&A Reporting Security Breaches in Israel](https://www.ayr.co.il/qa-reporting-security-breaches-involving-personal-data-in-israel/) -- PPA notification form fields, severe incident definition
- [DLA Piper Data Protection Laws Israel](https://www.dlapiperdataprotection.com/index.html?t=law&c=IL) -- vendor outsourcing agreements, training obligations
- [Baker McKenzie Global Data Handbook -- Israel](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/emea/israel/topics/security-requirements-and-breach-notification) -- breach notification requirements
- [MongoDB Data Processing Agreement](https://www.mongodb.com/legal/data-processing-agreement) -- MongoDB standard DPA reference (updated Jan 2026)
- [MongoDB Atlas Backup Guidance](https://www.mongodb.com/docs/atlas/architecture/current/backups/) -- Atlas backup capabilities, RPO/RTO
- [Incident.io -- Designing Severity Levels](https://incident.io/blog/designing-your-incident-severity-levels) -- P1-P4 severity framework
- [NIST SP 800-61r3](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r3.pdf) -- incident response lifecycle reference
- [Splunk -- Incident Severity Levels](https://www.splunk.com/en_us/blog/learn/incident-severity-levels.html) -- severity level industry practice

### Tertiary (LOW confidence)
- Exact regulation number-to-requirement mappings (15, 16, 17) -- based on English secondary sources, not direct Hebrew analysis
- PPA form exact fields and submission URL -- aggregated from multiple secondary sources; form version not verified
- Training frequency "24 months" -- from ICLG; specific sub-regulation number not confirmed

---

## Metadata

**Confidence breakdown:**
- Incident response framework: HIGH -- NIST lifecycle is well-established; Israeli Reg. 11 notification requirements confirmed across multiple sources; severity classification based on standard P1-P4 with Tenuto.io risk mapping
- Vendor management: HIGH -- DPA requirements confirmed across multiple Israeli legal sources; vendor data from Phase 27 SMAP-03 is verified; DPA template structure follows established regulatory provisions
- Personnel security: MEDIUM -- Training frequency (24 months) from secondary sources; onboarding/offboarding procedures derived from Phase 28 gaps and platform technical architecture; confidentiality agreement structure follows standard practice
- Backup/recovery: HIGH -- MongoDB Atlas capabilities documented in official docs; current platform state thoroughly documented in SECPR-02; recovery procedures derived from actual platform architecture

**Research date:** 2026-03-02
**Valid until:** 60 days (regulatory framework is stable; compliance document patterns established in Phases 27-28)
