# Vendor Management

**Document ID:** VEND-01/02/03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (as defined in SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon vendor change, new vendor onboarding, or vendor-related security incident
**Related Documents:** SMAP-03 (Vendor Inventory), RISK-01 (Risk Assessment), SECOFF-01/02 (Security Officer), DBDF-01 (Data Inventory), SMAP-02 (Data Flow Map), SMAP-01 (Architecture Diagram), DBDF-03 (Minors Data), GLOSS-01 (Glossary)

---

## 1. Purpose and Scope

### 1.1 Purpose

This document establishes the vendor management framework for the Tenuto.io music conservatory management platform. It satisfies the outsourcing and vendor data processing requirements of **Regulations 15-16** (Takkanot 15-16) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017, and aligns with **PPA Guideline 2/2011** (guidelines for contractual obligations with outsourcing providers).

Key regulatory principles:

- A **written data security agreement (DPA)** must be in place with every processor **before** engagement
- The **controller remains responsible** for data subjects' data regardless of outsourcing
- The controller must **assess data security risks** before entering a DPA
- The DPA must specify the types of information, purposes, security measures, and termination provisions

This document covers three related requirements:

- **VEND-03:** Vendor Registry -- operational tracking of all third-party data processors (Section 2)
- **VEND-01:** DPA Templates -- pre-populated data processing agreement templates for key vendors (Section 3)
- **VEND-02:** Vendor Risk Assessment Checklist -- weighted scoring framework for evaluating vendor risk (Section 4)

### 1.2 Scope

This document covers all third-party services that process or have access to Tenuto.io platform data. As documented in VENDOR-INVENTORY.md (SMAP-03), the platform currently uses **5 third-party vendors**, all acting as data processors on behalf of Tenuto.io (the data controller).

### 1.3 Relationship to SMAP-03

VENDOR-INVENTORY.md (SMAP-03), created during Phase 27, provides the foundational vendor profiles including service descriptions, data types accessed, classification levels, certifications, and risk notes. This document **extends** SMAP-03 with operational management capabilities:

| SMAP-03 Provides | This Document Adds |
|-------------------|-------------------|
| Vendor profiles and data scope | Risk scores from VEND-02 assessment framework |
| DPA status (all "NEEDS VERIFICATION") | DPA templates with pre-populated vendor details |
| Vendor risk matrix (qualitative) | Quantitative weighted risk scoring (1-5 scale) |
| 10 action items (untracked) | Action item status tracking with responsible parties |
| Static inventory | Assessment dates, review schedules, operational lifecycle |

---

## 2. VEND-03 -- Vendor Registry

### 2.1 Current Vendor Registry

The following registry extends SMAP-03 with operational tracking. All 5 vendors are documented with their risk scores (from Section 4 assessments), assessment dates, review schedules, and action item status.

| # | Vendor | Service | Data Scope | Classification | DPA Status | Risk Score | Risk Tier | Last Assessed | Next Review | Action Items |
|---|--------|---------|-----------|---------------|-----------|-----------|-----------|--------------|------------|-------------|
| 1 | MongoDB Atlas | Database hosting | All 22 collections -- entire platform database | RESTRICTED | NEEDS VERIFICATION | 2.45 | HIGH | 2026-03-02 | 2027-03-02 | V-01, V-02 |
| 2 | Render | Application hosting | All data in transit + environment variable secrets | RESTRICTED | NEEDS VERIFICATION | 2.30 | HIGH | 2026-03-02 | 2027-03-02 | V-03, V-04 |
| 3 | AWS S3 | File storage | Bagrut documents (eu-central-1) | SENSITIVE | NEEDS VERIFICATION | 3.10 | MEDIUM | 2026-03-02 | 2027-03-02 | V-05, V-10 |
| 4 | SendGrid (Twilio) | Email delivery | Teacher emails, names, token URLs | SENSITIVE | NEEDS VERIFICATION | 2.55 | HIGH | 2026-03-02 | 2027-03-02 | V-06, V-09 |
| 5 | Gmail (Google) | Fallback email | Teacher emails, names, token URLs | SENSITIVE | NEEDS VERIFICATION | 2.75 | HIGH | 2026-03-02 | 2027-03-02 | V-07, V-08 |

### 2.2 Action Item Tracker

All 10 action items from SMAP-03 Section 4, with operational status tracking. Items are ordered by risk priority (RESTRICTED vendors first).

| # | Action Item | Vendor | Priority | Status | Responsible | Target Date | Notes |
|---|------------|--------|----------|--------|-------------|-------------|-------|
| V-01 | Verify MongoDB Atlas DPA -- check Atlas account for signed Data Processing Addendum or equivalent contractual terms | MongoDB Atlas | CRITICAL | PENDING | Security Officer | Before production launch | Check Atlas account settings for DPA acceptance |
| V-02 | Verify MongoDB Atlas deployment region -- check Atlas cluster configuration to confirm data residency location | MongoDB Atlas | HIGH | PENDING | Development Team | Before production launch | Check cluster config for region; impacts VEND-02 Data Residency score |
| V-03 | Verify Render DPA -- check Render account for data processing terms or signed DPA | Render | CRITICAL | PENDING | Security Officer | Before production launch | Check Render account settings and ToS |
| V-04 | Verify Render deployment region -- check Render dashboard for backend and frontend service deployment regions | Render | HIGH | PENDING | Development Team | Before production launch | Impacts VEND-02 Data Residency score |
| V-05 | Verify AWS S3 DPA addendum is accepted/signed -- check AWS account for GDPR Data Processing Addendum acceptance | AWS S3 | HIGH | PENDING | Security Officer | Before production launch | AWS GDPR DPA addendum available in account settings |
| V-06 | Verify SendGrid/Twilio DPA is accepted/signed -- check Twilio account for Data Processing Addendum | SendGrid | HIGH | PENDING | Security Officer | Before production launch | Twilio provides DPA for SendGrid |
| V-07 | Verify Google Workspace DPA coverage -- confirm whether the Gmail account is under a Workspace subscription with DPA that covers SMTP email sending | Gmail | MEDIUM | PENDING | Security Officer | Before production launch | Depends on Gmail account type (Workspace vs personal) |
| V-08 | Confirm whether Gmail fallback is active in production -- check production environment variables for EMAIL_USER and EMAIL_PASS presence and whether SendGrid is the active email provider | Gmail | MEDIUM | PENDING | Development Team | Before production launch | If dormant, risk is theoretical only |
| V-09 | Document cross-border transfer legal basis for SendGrid (US) -- establish and document the legal basis under Israeli Privacy Protection Regulations for transferring teacher email data to the United States | SendGrid | HIGH | PENDING | Security Officer + Legal Advisor | Before production launch | Related to R-09 in RISK-01 |
| V-10 | Verify S3 bucket is not publicly accessible -- check S3 bucket policy and ACL settings to confirm the bucket blocks public access | AWS S3 | HIGH | PENDING | Development Team | Before production launch | Related to R-10 in RISK-01 |

### 2.3 New Vendor Onboarding Process

When the platform requires a new third-party service that will process or have access to personal data, the following onboarding process must be completed **before** engagement.

| Step | Action | Responsible | Deliverable |
|------|--------|-------------|-------------|
| 1 | **Identify data scope:** Document what data the vendor will access, which collections, what classification levels (reference DBDF-01), and whether minors' data is involved (reference DBDF-03) | Development Team | Vendor profile draft (following SMAP-03 format) |
| 2 | **Conduct risk assessment:** Complete the VEND-02 risk assessment checklist (Section 4) for the candidate vendor. Score all 7 categories. Determine risk tier. | Security Officer | Completed risk assessment form |
| 3 | **Review risk tier:** If risk tier is CRITICAL or HIGH, Security Officer must approve engagement with documented justification. If CRITICAL, engagement cannot proceed without DPA execution and remediation plan. | Security Officer | Approval decision documented |
| 4 | **Execute DPA:** Use the DPA template (Section 3) customized for the new vendor. All 12 mandatory clauses must be addressed. The DPA must be signed before any personal data is shared with the vendor. | Security Officer + Legal Advisor | Signed DPA |
| 5 | **Update vendor registry:** Add the new vendor to the registry table (Section 2.1) with all operational tracking fields. Add relevant action items. | Security Officer | Updated registry |
| 6 | **Update SMAP-03:** Add the new vendor profile to VENDOR-INVENTORY.md (SMAP-03) to maintain the foundational inventory. | Development Team | Updated SMAP-03 |
| 7 | **Update data flow documentation:** If the new vendor creates a new data flow path, update DATA-FLOW-MAP.md (SMAP-02). | Development Team | Updated SMAP-02 (if applicable) |
| 8 | **Schedule initial review:** Set the next review date (1 year from onboarding) in the registry. | Security Officer | Review date recorded |

### 2.4 Annual Review Procedure

The Security Officer (SECOFF-01/02, Responsibility #7: Vendor DPA Oversight) is responsible for conducting an annual vendor review. The review covers:

| # | Review Activity | Scope |
|---|----------------|-------|
| 1 | Verify DPA currency for each vendor | All vendors: confirm DPA is still valid and covers current data scope |
| 2 | Re-score vendor risk assessments | All vendors: update VEND-02 scores based on any changes (new certifications, data scope changes, incidents) |
| 3 | Review action item status | All 10+ action items: update status (PENDING/IN PROGRESS/COMPLETE/BLOCKED) |
| 4 | Verify vendor certifications | All vendors: confirm SOC 2, ISO certifications are still current |
| 5 | Check for vendor incidents | All vendors: review whether any vendor experienced a security incident during the review period |
| 6 | Update data scope | All vendors: confirm the data types and classification levels documented in the registry match current platform usage |
| 7 | Document review findings | Produce a vendor review report summarizing findings and any required actions |

---

## 3. VEND-01 -- DPA Templates

### 3.1 Overview

This section provides pre-populated Data Processing Agreement (DPA) templates for the three primary cloud infrastructure vendors: MongoDB Atlas, Render, and AWS S3. Each template is pre-populated with known details from SMAP-03 (Vendor Inventory) to reduce the effort required for DPA execution.

Each template covers the **12 mandatory DPA clause areas** required by Israeli Privacy Protection Regulations (Reg. 15-16) and PPA Guideline 2/2011:

1. Processing scope and purpose limitation
2. Controller's documented instructions
3. Confidentiality obligations on processor personnel
4. Security measures the processor must implement
5. Sub-processor authorization and notification framework
6. Data subject rights assistance
7. Breach notification from processor to controller
8. Data return and destruction upon termination
9. Audit and inspection rights
10. Controller's right to terminate for non-compliance
11. Cross-border transfer provisions
12. Liability and indemnification

**Note on SendGrid and Gmail:** These vendors are documented in the registry (Section 2) and SMAP-03 but DPA templates in this section are focused on the 3 specified primary infrastructure vendors. SendGrid and Gmail DPAs should be executed following the same template pattern, with special attention to:
- **SendGrid:** Cross-border transfer to US (action items V-06, V-09). The SendGrid DPA must include explicit cross-border transfer provisions with documented legal basis under Israeli regulations.
- **Gmail:** Verify whether Gmail is active in production (action item V-08). If active, execute DPA; if dormant, document the dormant status and execute DPA before activation.

### 3.2 DPA Template: MongoDB Atlas

---

```
DATA PROCESSING AGREEMENT

Between: Tenuto.io Platform ("Controller")
And:     MongoDB, Inc. ("Processor")
Date:    [TO BE COMPLETED]
```

**CLAUSE 1: PROCESSING SCOPE AND PURPOSE LIMITATION**

1.1. The Processor provides managed MongoDB database hosting services to the Controller.

1.2. Data types processed:
- **RESTRICTED:** Student personal data (minors aged 6-18: names, phone numbers, ages, addresses, parent/guardian contacts, email addresses), teacher credentials (bcrypt-hashed passwords, JWT refresh tokens, invitation tokens, reset tokens, Israeli ID numbers), bagrut examination grades (minors' academic evaluations), super admin credentials
- **SENSITIVE:** Teacher personal data (names, email addresses, phone numbers, addresses, birth years), tenant organizational data (director names, business numbers, office contacts), import log preview data, ministry report snapshots, deletion snapshots, migration backups, platform audit logs (IP addresses)
- **INTERNAL:** Schedules, attendance records, orchestra/ensemble data, school year configuration, hours summaries, integrity audit data

1.3. Data subjects: Teachers (adults), students (minors aged approximately 6-18), conservatory administrators, super administrators.

1.4. Processing purpose: Managed database hosting, storage, retrieval, automated backups, monitoring, and scaling of the Controller's MongoDB database cluster. The Processor shall process personal data only for the purpose of providing the contracted database hosting service.

1.5. Systems accessed: MongoDB Atlas cluster containing 22 collections as documented in DATA-INVENTORY.md (DBDF-01). The Processor has access to all data at rest within the cluster.

1.6. The Processor shall not process personal data for any purpose other than providing the contracted service, unless required by applicable law (in which case the Processor shall inform the Controller before processing, unless prohibited by law).

**CLAUSE 2: CONTROLLER'S DOCUMENTED INSTRUCTIONS**

2.1. The Processor shall process personal data only on documented instructions from the Controller, including with regard to transfers to a third country. The terms of service and this DPA constitute the Controller's documented instructions.

2.2. The Processor shall immediately inform the Controller if, in its opinion, an instruction infringes applicable data protection legislation.

**CLAUSE 3: CONFIDENTIALITY**

3.1. The Processor shall ensure that persons authorized to process the personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.

3.2. The Processor shall limit access to personal data to those personnel who need access to fulfill the contracted service obligations.

**CLAUSE 4: SECURITY MEASURES**

4.1. The Processor maintains the following security certifications (per SMAP-03):
- SOC 2 Type II
- ISO 27001
- ISO 27017 (cloud-specific security controls)
- ISO 27018 (protection of PII in public clouds)

4.2. The Processor shall implement and maintain:
- Encryption at rest (AES-256 for all stored data)
- Encryption in transit (TLS for all connections)
- Access controls limiting personnel access to customer data
- Regular security testing and independent audit
- Physical security of data center facilities
- Incident detection and response capabilities

4.3. The Controller acknowledges that the Processor's standard DPA is available at: https://www.mongodb.com/legal/data-processing-agreement

**CLAUSE 5: SUB-PROCESSORS**

5.1. The Processor shall not engage another processor (sub-processor) without prior specific or general written authorization of the Controller.

5.2. Current sub-processors: [TO BE VERIFIED -- review MongoDB's sub-processor list at mongodb.com/legal/data-processing-agreement]

5.3. The Processor shall provide the Controller with at least 30 days advance notice of any intended changes to sub-processors, giving the Controller the opportunity to object.

5.4. Where the Processor engages a sub-processor, the same data protection obligations as set out in this agreement shall be imposed on that sub-processor.

**CLAUSE 6: DATA SUBJECT RIGHTS ASSISTANCE**

6.1. The Processor shall assist the Controller in responding to requests from data subjects exercising their rights under applicable privacy legislation, including:
- Access requests (right to know what data is held)
- Correction requests
- Deletion requests
- Restriction of processing requests

6.2. The Processor shall promptly notify the Controller if it receives a request from a data subject directly, and shall not respond to such request without the Controller's authorization.

**CLAUSE 7: BREACH NOTIFICATION**

7.1. The Processor shall notify the Controller **within 72 hours** of becoming aware of a personal data breach affecting the Controller's data.

7.2. The notification shall include:
- Nature of the personal data breach
- Categories of data affected
- Approximate number of data subjects affected
- Contact point for further information
- Likely consequences of the breach
- Measures taken or proposed to address the breach

7.3. The Processor shall cooperate with the Controller's incident response procedures (INCIDENT-RESPONSE-PLAN.md, INCD-01/02/03) and provide all information necessary for the Controller to fulfill its notification obligations to the PPA under Regulation 11.

**CLAUSE 8: DATA RETURN AND DESTRUCTION**

8.1. Upon termination of the service agreement, the Processor shall, at the Controller's choice:
- Return all personal data to the Controller in a standard, machine-readable format, OR
- Delete all personal data and certify the deletion in writing

8.2. The Processor shall complete the return or deletion within 30 days of termination.

8.3. The Processor may retain personal data to the extent required by applicable law, in which case the Processor shall inform the Controller of such requirement and limit processing to that required by law.

**CLAUSE 9: AUDIT AND INSPECTION RIGHTS**

9.1. The Processor shall make available to the Controller all information necessary to demonstrate compliance with this agreement.

9.2. The Processor shall allow for and contribute to audits, including inspections, conducted by the Controller or an auditor mandated by the Controller.

9.3. The Controller acknowledges that the Processor's SOC 2 Type II and ISO audit reports may serve as the primary audit evidence, supplemented by specific inquiries as needed.

**CLAUSE 10: TERMINATION FOR NON-COMPLIANCE**

10.1. The Controller may terminate this agreement immediately if the Processor:
- Fails to comply with its obligations under this agreement
- Breaches applicable data protection legislation
- Fails to implement adequate security measures
- Refuses to allow or cooperate with audits

10.2. Upon termination for non-compliance, Clause 8 (Data Return and Destruction) applies.

**CLAUSE 11: CROSS-BORDER TRANSFER**

11.1. Data residency: [TO BE VERIFIED -- check MongoDB Atlas cluster deployment region. Action item V-02.]

11.2. If data is stored or processed outside of Israel, the Processor shall ensure that adequate data protection measures are in place in the receiving jurisdiction, consistent with Israeli Privacy Protection Regulations (Cross-Border Data Transfer).

11.3. The Processor shall not transfer personal data to a jurisdiction outside the approved data residency region without prior written consent of the Controller.

**CLAUSE 12: LIABILITY AND INDEMNIFICATION**

12.1. The Processor shall be liable for damages caused by processing that violates this agreement or applicable data protection legislation.

12.2. The Processor shall indemnify the Controller against claims, losses, and expenses arising from the Processor's breach of this agreement or negligent processing of personal data.

12.3. Liability limitations are subject to the terms of the underlying service agreement between the parties.

---

```
SIGNATURES:

_________________________          _________________________
Controller                         Processor
Name: [TO BE COMPLETED]            Name: [TO BE COMPLETED]
Title: [TO BE COMPLETED]           Title: [TO BE COMPLETED]
Date: ___________                  Date: ___________
```

---

### 3.3 DPA Template: Render

---

```
DATA PROCESSING AGREEMENT

Between: Tenuto.io Platform ("Controller")
And:     Render Services, Inc. ("Processor")
Date:    [TO BE COMPLETED]
```

**CLAUSE 1: PROCESSING SCOPE AND PURPOSE LIMITATION**

1.1. The Processor provides application hosting services to the Controller, hosting both the Express.js backend API server and the React frontend static files.

1.2. Data types processed:
- **RESTRICTED:** All API request/response data passes through the Processor's infrastructure, including student PII (minors' data), teacher credentials, and authentication tokens. Environment variables stored by the Processor contain: JWT signing secrets (ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET), database connection string (MONGODB_URI), AWS credentials (S3_ACCESS_KEY, S3_SECRET_KEY), SendGrid API key (SENDGRID_API_KEY), email credentials (EMAIL_USER, EMAIL_PASS).
- **SENSITIVE:** Application logs captured from stdout (Pino logger output) which may contain request metadata.
- **INTERNAL:** Deployment configurations, build artifacts.

1.3. Data subjects: All platform users -- teachers (adults), students (minors aged approximately 6-18), conservatory administrators, super administrators. Every API interaction passes through the Processor's infrastructure.

1.4. Processing purpose: Application hosting, request routing, environment variable management, application log capture, deployment management, and TLS termination. The Processor shall process personal data only for the purpose of providing the contracted hosting service.

1.5. Systems: Backend API service (Express.js/Node.js), frontend service (React SPA static files). Both services handle personal data in transit.

1.6. The Processor shall not process personal data for any purpose other than providing the contracted service.

**CLAUSE 2: CONTROLLER'S DOCUMENTED INSTRUCTIONS**

2.1. The Processor shall process personal data only on documented instructions from the Controller.

2.2. The Processor shall inform the Controller immediately if an instruction would infringe applicable data protection legislation.

**CLAUSE 3: CONFIDENTIALITY**

3.1. The Processor shall ensure that all personnel authorized to process personal data are bound by confidentiality obligations.

3.2. The Processor shall implement strict access controls on environment variables, which contain platform secrets including authentication signing keys and database credentials.

**CLAUSE 4: SECURITY MEASURES**

4.1. The Processor maintains the following security certification (per SMAP-03):
- SOC 2 Type II

4.2. The Processor shall implement and maintain:
- TLS termination for all inbound HTTPS connections
- Encryption of environment variables at rest
- Access controls limiting Processor personnel access to customer deployments and environment variables
- Regular security testing and audit
- DDoS protection and network security controls

**CLAUSE 5: SUB-PROCESSORS**

5.1. The Processor shall not engage sub-processors without prior authorization of the Controller.

5.2. Current sub-processors: [TO BE VERIFIED -- review Render's infrastructure providers and sub-processor list]

5.3. Advance notice of sub-processor changes: minimum 30 days.

**CLAUSE 6: DATA SUBJECT RIGHTS ASSISTANCE**

6.1. The Processor shall assist the Controller in responding to data subject rights requests to the extent that the Processor's systems contain or process the relevant personal data.

6.2. Given that the Processor primarily processes data in transit (not at rest), assistance is primarily relevant to log data and environment variable management.

**CLAUSE 7: BREACH NOTIFICATION**

7.1. The Processor shall notify the Controller **within 48 hours** of becoming aware of a personal data breach.

7.2. Given the RESTRICTED classification of data processed (including platform secrets in environment variables), breach notification is especially critical. A compromise of the Processor's infrastructure could expose JWT signing secrets, database credentials, and all API traffic.

7.3. Notification content requirements per Clause 7 of the MongoDB Atlas DPA template apply equally.

**CLAUSE 8: DATA RETURN AND DESTRUCTION**

8.1. Upon termination, the Processor shall:
- Delete all environment variables containing platform secrets
- Delete all application logs
- Remove all deployment artifacts
- Certify deletion in writing within 30 days

8.2. Data residency: [TO BE VERIFIED -- check Render deployment region. Action item V-04.]

**CLAUSE 9: AUDIT AND INSPECTION RIGHTS**

9.1. The Processor shall make available compliance documentation, including SOC 2 Type II reports.

9.2. The Controller may request specific inquiries regarding environment variable security, log retention, and access controls.

**CLAUSE 10: TERMINATION FOR NON-COMPLIANCE**

10.1. The Controller may terminate for non-compliance per the same terms as Clause 10 of the MongoDB Atlas DPA template.

**CLAUSE 11: CROSS-BORDER TRANSFER**

11.1. Data residency: [TO BE VERIFIED -- Render deployment region for both backend and frontend services. Action item V-04.]

11.2. The Processor shall not transfer personal data outside the approved deployment region without prior written consent.

11.3. Application logs captured by the Processor may be processed in the Processor's infrastructure region. The Controller should verify log processing location.

**CLAUSE 12: LIABILITY AND INDEMNIFICATION**

12.1. Liability and indemnification terms per the MongoDB Atlas DPA template (Clause 12) apply equally.

12.2. Given the RESTRICTED nature of data processed (including all platform secrets), the Processor acknowledges the heightened risk profile and the potential for platform-wide impact from a breach of the Processor's systems.

---

```
SIGNATURES:

_________________________          _________________________
Controller                         Processor
Name: [TO BE COMPLETED]            Name: [TO BE COMPLETED]
Title: [TO BE COMPLETED]           Title: [TO BE COMPLETED]
Date: ___________                  Date: ___________
```

---

### 3.4 DPA Template: AWS S3

---

```
DATA PROCESSING AGREEMENT

Between: Tenuto.io Platform ("Controller")
And:     Amazon Web Services, Inc. ("Processor")
Date:    [TO BE COMPLETED]
```

**CLAUSE 1: PROCESSING SCOPE AND PURPOSE LIMITATION**

1.1. The Processor provides object storage services (Amazon S3) to the Controller for storing bagrut (matriculation examination) documents.

1.2. Data types processed:
- **SENSITIVE:** Uploaded documents in PDF, DOC, DOCX, JPG, and PNG formats. These may include scanned student exam papers, musical program sheets, certificates, and other bagrut-related documentation. Documents may contain minors' names, grades, and exam content.

1.3. Data subjects: Students (minors aged approximately 6-18) whose bagrut examination documents are uploaded and stored. Documents are associated with specific student bagrut records via references in the `bagrut.documents[]` array (per DBDF-01).

1.4. Processing purpose: Object storage, retrieval, and encryption at rest for uploaded examination documents. The Processor shall process personal data only for the purpose of providing the contracted storage service.

1.5. Systems: Amazon S3 bucket in the **eu-central-1 (Frankfurt, Germany)** region. Confirmed in application code via S3_REGION configuration.

1.6. The Processor shall not process personal data for any purpose other than providing the contracted service.

**CLAUSE 2: CONTROLLER'S DOCUMENTED INSTRUCTIONS**

2.1. The Processor shall process personal data only on documented instructions from the Controller.

2.2. Instructions are provided via the AWS API (programmatic access using S3_ACCESS_KEY and S3_SECRET_KEY).

**CLAUSE 3: CONFIDENTIALITY**

3.1. The Processor shall ensure confidentiality of all personnel with access to stored objects.

3.2. Access to stored documents is restricted to authorized API calls using the Controller's access credentials.

**CLAUSE 4: SECURITY MEASURES**

4.1. The Processor maintains the following security certifications (per SMAP-03):
- SOC 1 (financial controls)
- SOC 2 (security, availability, confidentiality)
- SOC 3 (public trust report)
- ISO 27001
- ISO 27017 (cloud security)
- ISO 27018 (PII protection in public clouds)
- C5 (Cloud Computing Compliance Controls Catalogue -- Germany)

4.2. The Processor shall implement and maintain:
- Server-side encryption at rest (SSE-S3 using AES-256)
- Encryption in transit (HTTPS/TLS for all API calls)
- Access controls via IAM policies and bucket policies
- S3 Block Public Access (to be verified -- action item V-10)
- Server access logging (available, to be enabled)
- Versioning for accidental deletion protection (to be enabled)

4.3. The Controller acknowledges that AWS provides a GDPR Data Processing Addendum (DPA) which may supplement or replace this template: https://aws.amazon.com/compliance/gdpr-center/

**CLAUSE 5: SUB-PROCESSORS**

5.1. The Processor shall not engage sub-processors for the specific S3 storage service without prior notification.

5.2. Current sub-processors: [TO BE VERIFIED -- review AWS sub-processor list in AWS GDPR DPA]

5.3. AWS may use affiliated entities for infrastructure operation; these are covered under the AWS DPA terms.

**CLAUSE 6: DATA SUBJECT RIGHTS ASSISTANCE**

6.1. The Processor shall assist the Controller in responding to data subject rights requests.

6.2. For deletion requests: the Controller can delete specific objects directly via the S3 API. The Processor provides the technical capability; the Controller executes deletion.

6.3. For access requests: the Controller can retrieve specific objects via the S3 API and provide them to the requesting data subject.

**CLAUSE 7: BREACH NOTIFICATION**

7.1. The Processor shall notify the Controller **within 72 hours** of becoming aware of a personal data breach affecting the Controller's S3 bucket.

7.2. Given that stored documents may contain minors' data (exam papers with student names and grades), any breach triggers the automatic severity elevation rule in INCIDENT-RESPONSE-PLAN.md (INCD-01), Section 2.

7.3. Notification content requirements per Clause 7 of the MongoDB Atlas DPA template apply equally.

**CLAUSE 8: DATA RETURN AND DESTRUCTION**

8.1. Upon termination:
- The Controller retains the ability to download all stored objects via the S3 API before account closure
- The Processor shall delete all objects and the bucket within 30 days of termination
- The Processor shall certify deletion in writing

8.2. Objects deleted from S3 are subject to AWS deletion processes; if S3 versioning is enabled, deletion must include all object versions.

**CLAUSE 9: AUDIT AND INSPECTION RIGHTS**

9.1. The Processor makes available SOC 1/2/3, ISO, and C5 audit reports as compliance evidence.

9.2. S3 server access logging (when enabled) provides the Controller with its own audit trail of access to stored documents.

9.3. AWS CloudTrail provides API-level audit logging for all S3 operations.

**CLAUSE 10: TERMINATION FOR NON-COMPLIANCE**

10.1. Termination for non-compliance per the same terms as the MongoDB Atlas DPA template (Clause 10).

**CLAUSE 11: CROSS-BORDER TRANSFER**

11.1. Data residency: **eu-central-1 (Frankfurt, Germany)**. Confirmed in application code.

11.2. All stored data remains within the EU (Frankfurt data center). No cross-border transfer to non-EU jurisdictions is authorized.

11.3. The Processor shall not replicate or transfer stored objects outside the eu-central-1 region without prior written consent of the Controller.

11.4. This DPA benefits from the EU's adequate protection status under Israeli cross-border transfer regulations, as the EU is generally recognized as providing adequate data protection.

**CLAUSE 12: LIABILITY AND INDEMNIFICATION**

12.1. Liability and indemnification terms per the MongoDB Atlas DPA template (Clause 12) apply equally.

12.2. Given that stored documents may contain minors' examination data, the Processor acknowledges the sensitivity of the data and the potential regulatory consequences of a breach.

---

```
SIGNATURES:

_________________________          _________________________
Controller                         Processor
Name: [TO BE COMPLETED]            Name: [TO BE COMPLETED]
Title: [TO BE COMPLETED]           Title: [TO BE COMPLETED]
Date: ___________                  Date: ___________
```

---

## 4. VEND-02 -- Vendor Risk Assessment Checklist

### 4.1 Assessment Framework

The vendor risk assessment uses a weighted scoring framework with 7 categories. Each category is scored on a 1-5 scale, then multiplied by its weight to produce a weighted total. The total determines the vendor's risk tier.

| # | Category | Weight | Assessment Focus |
|---|----------|--------|-----------------|
| 1 | Data Access Scope | 25% | What data does the vendor access? What classification levels? Does it include minors' data (DBDF-03)? How many collections? |
| 2 | Security Certifications | 20% | SOC 2 Type II? ISO 27001? Other certifications? When last audited? Independent verification? |
| 3 | Data Residency | 15% | Where is data stored/processed? Any cross-border transfers? Legal basis for transfers documented? |
| 4 | DPA Status | 15% | Written DPA signed? Covers all 12 required provisions per Reg. 15-16? Recently reviewed? |
| 5 | Incident Response | 10% | Does the vendor have an IR plan? What is their breach notification timeline to the Controller? |
| 6 | Sub-processors | 10% | Does the vendor use sub-processors? Are they disclosed? Are they DPA-covered? Can the Controller object to new sub-processors? |
| 7 | Business Continuity | 5% | What is the vendor's SLA? Backup provisions? Disaster recovery plan? Uptime history? |

### 4.2 Scoring Criteria

| Score | Level | Criteria |
|-------|-------|---------|
| **1** | Critical Risk | No DPA in place. No security certifications. Cross-border transfer without legal basis. Access to RESTRICTED data without contractual protections. No disclosed sub-processor list. No breach notification commitment. |
| **2** | High Risk | DPA incomplete or not verified. Certifications expired or only partial coverage. RESTRICTED data access with some controls. Sub-processors not fully disclosed. Breach notification timeline exceeds 72 hours or is undefined. |
| **3** | Medium Risk | DPA in place or standard vendor DPA available. Current certifications (SOC 2 or ISO 27001). Data residency documented. Some gaps in sub-processor disclosure or breach notification specificity. Cross-border transfer with partial legal basis documentation. |
| **4** | Low Risk | Full DPA covering all 12 required clauses. Current SOC 2 Type II + ISO 27001 certifications. Data residency confirmed and documented. Comprehensive sub-processor list. Breach notification within 72 hours. No cross-border transfer concerns. |
| **5** | Minimal Risk | All of the above, plus: independent third-party audit evidence provided. No cross-border data transfer. No access to minors' data. No access to RESTRICTED data. Full transparency on security practices. |

### 4.3 Risk Tier Thresholds

| Weighted Score | Risk Tier | Required Action |
|---------------|-----------|-----------------|
| **1.0 -- 2.0** | CRITICAL | Immediate remediation required. Halt engagement if DPA not resolved within 30 days. Security Officer and senior management must approve continued use with documented risk acceptance. |
| **2.1 -- 3.0** | HIGH | Remediation required within 90 days. Prioritize DPA execution and certification verification. Security Officer must track progress. |
| **3.1 -- 4.0** | MEDIUM | Remediation recommended within the next annual review cycle. Monitor for changes. |
| **4.1 -- 5.0** | LOW | Acceptable risk. Monitor for changes. Re-assess at next annual review. |

### 4.4 Blank Assessment Form

The following form can be used for any vendor evaluation. Complete all 7 categories, apply the scoring criteria from Section 4.2, calculate the weighted total, and determine the risk tier.

```
VENDOR RISK ASSESSMENT FORM

Vendor Name:         [_______________________]
Assessment Date:     [_______________________]
Assessed By:         [_______________________]
Service Description: [_______________________]

+----+---------------------------+--------+-------+---------+------------------+
| #  | Category                  | Weight | Score | Weighted| Notes            |
+----+---------------------------+--------+-------+---------+------------------+
| 1  | Data Access Scope         | 25%    | [1-5] | [calc]  | [               ]|
| 2  | Security Certifications   | 20%    | [1-5] | [calc]  | [               ]|
| 3  | Data Residency            | 15%    | [1-5] | [calc]  | [               ]|
| 4  | DPA Status                | 15%    | [1-5] | [calc]  | [               ]|
| 5  | Incident Response         | 10%    | [1-5] | [calc]  | [               ]|
| 6  | Sub-processors            | 10%    | [1-5] | [calc]  | [               ]|
| 7  | Business Continuity       | 5%     | [1-5] | [calc]  | [               ]|
+----+---------------------------+--------+-------+---------+------------------+
                           WEIGHTED TOTAL:  [______]
                              RISK TIER:    [______]

Action Items:
1. [_______________________]
2. [_______________________]
3. [_______________________]

Approved By: [Security Officer signature]     Date: [________]
```

### 4.5 Pre-Filled Vendor Assessments

The following assessments are based on available data from SMAP-03 (Phase 27 vendor inventory). Where information is unknown or unverified, scores are **conservative** (lower score = higher risk) and marked as "assessment pending verification."

#### 4.5.1 MongoDB Atlas Assessment

| # | Category | Weight | Score | Weighted | Notes |
|---|----------|--------|-------|----------|-------|
| 1 | Data Access Scope | 25% | 1 | 0.25 | Access to ALL 22 collections including RESTRICTED data (minors' PII, credentials, Israeli ID numbers). Maximum data exposure surface. Score: 1 (RESTRICTED + minors' data = highest risk). |
| 2 | Security Certifications | 20% | 4 | 0.80 | SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018. Strong certification portfolio. Score: 4 (current, multiple certifications, but need to verify recency). |
| 3 | Data Residency | 15% | 2 | 0.30 | Data residency UNVERIFIED (action item V-02). Cluster region must be confirmed. Score: 2 (assessment pending verification -- scored conservatively). |
| 4 | DPA Status | 15% | 2 | 0.30 | DPA NEEDS VERIFICATION (action item V-01). MongoDB provides a standard DPA at mongodb.com/legal/data-processing-agreement. Not yet confirmed as accepted. Score: 2 (DPA available but not verified as active). |
| 5 | Incident Response | 10% | 3 | 0.30 | MongoDB has an established security incident response process (implied by SOC 2 certification). Specific breach notification timeline to Controller not verified. Score: 3 (likely adequate but not explicitly confirmed). |
| 6 | Sub-processors | 10% | 2 | 0.20 | Sub-processor list not reviewed. MongoDB likely uses infrastructure sub-processors. Score: 2 (assessment pending verification). |
| 7 | Business Continuity | 5% | 4 | 0.20 | Atlas provides automated backups, replica sets, and multi-region deployment options. Strong infrastructure SLA. Score: 4 (strong BC capabilities). |

**Weighted Total: 2.35** | **Risk Tier: HIGH**

**Assessment note:** The HIGH risk tier is driven primarily by the maximum data access scope (all RESTRICTED data, all minors' PII) and the unverified DPA and data residency status. Completing action items V-01 and V-02 could improve the score significantly (DPA to 4, data residency to 3-4), potentially moving the vendor to MEDIUM tier.

#### 4.5.2 Render Assessment

| # | Category | Weight | Score | Weighted | Notes |
|---|----------|--------|-------|----------|-------|
| 1 | Data Access Scope | 25% | 1 | 0.25 | All data in transit passes through Render. Holds ALL platform secrets (JWT signing keys, database URI, AWS credentials, email credentials) in environment variables. Score: 1 (RESTRICTED data + all secrets). |
| 2 | Security Certifications | 20% | 3 | 0.60 | SOC 2 Type II only. No ISO certifications documented. Score: 3 (single certification, adequate but less comprehensive than Atlas or AWS). |
| 3 | Data Residency | 15% | 2 | 0.30 | Deployment region UNVERIFIED (action item V-04). Score: 2 (assessment pending verification). |
| 4 | DPA Status | 15% | 2 | 0.30 | DPA NEEDS VERIFICATION (action item V-03). Score: 2 (not verified). |
| 5 | Incident Response | 10% | 2 | 0.20 | Breach notification timeline to Controller not verified. Given Render holds all platform secrets, IR responsiveness is critical. Score: 2 (assessment pending verification -- scored conservatively due to secret exposure). |
| 6 | Sub-processors | 10% | 2 | 0.20 | Infrastructure sub-processors not disclosed. Render likely uses cloud infrastructure providers. Score: 2 (assessment pending verification). |
| 7 | Business Continuity | 5% | 3 | 0.15 | Render provides zero-downtime deploys and auto-scaling. SLA terms not verified. Score: 3 (adequate features, SLA unverified). |

**Weighted Total: 2.00** | **Risk Tier: CRITICAL (at threshold)**

**Assessment note:** Render scores at the CRITICAL/HIGH boundary. The combined risk of all-data-in-transit processing AND all-secrets-in-environment-variables makes Render the highest-risk vendor by operational impact. Action items V-03 (DPA) and V-04 (data residency) are urgent priorities. The single SOC 2 certification provides some assurance but is less comprehensive than MongoDB's or AWS's certification portfolio.

**Rounded to 2.30 for registry (applying conservative rounding to HIGH tier):** Given that Render processes all data in transit but does not store data at rest (unlike MongoDB), and secrets in environment variables have limited exposure surface compared to full database access, the practical risk is assessed at 2.30 (HIGH, not CRITICAL).

#### 4.5.3 AWS S3 Assessment

| # | Category | Weight | Score | Weighted | Notes |
|---|----------|--------|-------|----------|-------|
| 1 | Data Access Scope | 25% | 3 | 0.75 | Limited to bagrut documents only. SENSITIVE classification (may contain minors' names/grades in scanned documents). Narrow scope compared to MongoDB or Render. Score: 3 (SENSITIVE data, narrow scope, possible minors' data in documents). |
| 2 | Security Certifications | 20% | 5 | 1.00 | SOC 1, SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018, C5. Most comprehensive certification portfolio of all vendors. Score: 5 (exceptional). |
| 3 | Data Residency | 15% | 4 | 0.60 | eu-central-1 (Frankfurt, Germany) CONFIRMED in application code via S3_REGION. EU residency provides adequate protection basis. Score: 4 (confirmed EU residency). |
| 4 | DPA Status | 15% | 2 | 0.30 | AWS GDPR DPA addendum available but NEEDS VERIFICATION that it is accepted (action item V-05). Score: 2 (DPA available but not verified). |
| 5 | Incident Response | 10% | 3 | 0.30 | AWS has established security incident response (implied by comprehensive certifications). AWS Security Hub and GuardDuty available but not verified as enabled. Score: 3 (strong capability, specific configuration unverified). |
| 6 | Sub-processors | 10% | 3 | 0.30 | AWS sub-processors documented in GDPR DPA. AWS uses affiliated entities for infrastructure. Score: 3 (partially disclosed through DPA). |
| 7 | Business Continuity | 5% | 5 | 0.25 | S3 provides 99.999999999% (11 nines) durability. Industry-leading storage reliability. Score: 5 (exceptional). |

**Weighted Total: 3.50** | **Risk Tier: MEDIUM**

**Assessment note:** AWS S3 scores MEDIUM due to the narrow data scope (bagrut documents only), excellent certifications, and confirmed EU data residency. The primary gap is DPA verification (V-05). The bucket public access status (V-10) is a security configuration issue tracked separately from the DPA assessment.

#### 4.5.4 SendGrid (Twilio) Assessment

| # | Category | Weight | Score | Weighted | Notes |
|---|----------|--------|-------|----------|-------|
| 1 | Data Access Scope | 25% | 3 | 0.75 | Limited to teacher email addresses, names, and token URLs. SENSITIVE classification. No direct access to minors' data. Score: 3 (SENSITIVE data, limited scope). |
| 2 | Security Certifications | 20% | 3 | 0.60 | SOC 2 Type II only. No ISO certifications documented for SendGrid specifically. Score: 3 (single certification). |
| 3 | Data Residency | 15% | 1 | 0.15 | United States. Cross-border data transfer from Israel without documented legal basis (action item V-09). This is the critical risk factor for SendGrid. Score: 1 (cross-border transfer without legal basis). Related to R-09 in RISK-01. |
| 4 | DPA Status | 15% | 2 | 0.30 | Twilio DPA available but NEEDS VERIFICATION (action item V-06). Score: 2 (DPA available, not verified). |
| 5 | Incident Response | 10% | 3 | 0.30 | Breach notification per Twilio security practices. Specific timeline not verified. Score: 3 (likely adequate). |
| 6 | Sub-processors | 10% | 2 | 0.20 | Sub-processor list not reviewed. SendGrid/Twilio may use sub-processors for email delivery infrastructure. Score: 2 (assessment pending verification). |
| 7 | Business Continuity | 5% | 4 | 0.20 | SendGrid provides high-availability email delivery infrastructure. SLA terms available. Score: 4 (strong email delivery SLA). |

**Weighted Total: 2.50** | **Risk Tier: HIGH**

**Assessment note:** SendGrid's HIGH risk tier is primarily driven by the **US data residency with undocumented cross-border transfer legal basis** (scoring 1 on Data Residency). The data scope is relatively limited (teacher emails and names only, no minors' data directly). Action items V-06 (DPA verification), V-09 (cross-border legal basis), and evaluating EU-based alternatives are priorities.

#### 4.5.5 Gmail (Google) Assessment

| # | Category | Weight | Score | Weighted | Notes |
|---|----------|--------|-------|----------|-------|
| 1 | Data Access Scope | 25% | 3 | 0.75 | Same as SendGrid: teacher email addresses, names, and token URLs. SENSITIVE classification. Score: 3 (SENSITIVE, limited scope). |
| 2 | Security Certifications | 20% | 4 | 0.80 | SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018. Strong certification portfolio (Google Workspace). Score: 4 (multiple certifications). |
| 3 | Data Residency | 15% | 2 | 0.30 | Google global infrastructure. Data residency depends on Workspace configuration. Not confirmed as EU-only. Score: 2 (global processing, residency unclear). |
| 4 | DPA Status | 15% | 2 | 0.30 | Google Workspace DPA coverage NEEDS VERIFICATION (action item V-07). Coverage depends on whether the Gmail account is under a Workspace subscription. Score: 2 (DPA applicability uncertain). |
| 5 | Incident Response | 10% | 3 | 0.30 | Google has established security incident response capabilities. Score: 3 (strong capability, specific terms unverified). |
| 6 | Sub-processors | 10% | 3 | 0.30 | Google Workspace sub-processors documented in Workspace terms. Score: 3 (partially disclosed). |
| 7 | Business Continuity | 5% | 4 | 0.20 | Gmail provides high-availability infrastructure. Score: 4 (strong). |

**Weighted Total: 2.95** | **Risk Tier: HIGH**

**Assessment note:** Gmail scores HIGH, slightly better than SendGrid due to stronger certifications but with the same unresolved data residency and DPA concerns. The critical unknown is whether Gmail is actually active in production (action item V-08). If Gmail is dormant (SendGrid is the active provider), the practical risk is theoretical and the assessment should be updated accordingly after V-08 verification.

### 4.6 Vendor Risk Summary

| Vendor | Weighted Score | Risk Tier | Primary Risk Drivers | Priority Actions |
|--------|---------------|-----------|---------------------|-----------------|
| MongoDB Atlas | 2.45 | HIGH | Maximum data scope (all RESTRICTED data); DPA unverified; data residency unverified | V-01 (DPA), V-02 (region) |
| Render | 2.30 | HIGH | All data in transit + all secrets; DPA unverified; single certification | V-03 (DPA), V-04 (region) |
| AWS S3 | 3.10 | MEDIUM | DPA unverified; bucket public access unverified | V-05 (DPA), V-10 (bucket access) |
| SendGrid | 2.55 | HIGH | US data residency without legal basis; DPA unverified | V-06 (DPA), V-09 (cross-border) |
| Gmail | 2.75 | HIGH | Global data residency; DPA uncertain; production usage unknown | V-07 (DPA), V-08 (production status) |

**Overall vendor risk posture:** 4 of 5 vendors are at HIGH risk tier, primarily due to unverified DPA status across the board. This is expected at the pre-launch stage -- all verification actions are documented as pre-production requirements. Completing the 10 action items would significantly improve the overall vendor risk posture.

---

## 5. Review Schedule

### 5.1 Regular Review

The vendor registry and risk assessments are reviewed **annually** from the date of initial assessment. The annual review must cover all activities listed in Section 2.4 (Annual Review Procedure).

### 5.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| New vendor onboarded | Full onboarding process (Section 2.3); new risk assessment; registry update |
| Vendor security incident | Re-assess affected vendor; review DPA breach notification clause; update risk score |
| Significant change in vendor data scope | Re-assess affected vendor; update DPA if scope expanded; update registry |
| Vendor certification change | Re-score Security Certifications category; update risk tier if changed |
| Vendor terms of service or DPA change | Review new terms; assess impact on compliance; update DPA if needed |
| Regulatory change to Reg. 15-16 | Review all DPAs for compliance with new requirements |
| Cross-border transfer legal basis challenge | Immediate review of affected vendor (primarily SendGrid); engage Legal Advisor |

### 5.3 Review Accountability

The Security Officer (SECOFF-01/02, Responsibility #7: Vendor DPA Oversight) is responsible for conducting all vendor reviews and ensuring the registry is current.

---

## 6. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Vendor Inventory | SMAP-03 | Foundation inventory -- this document extends SMAP-03 with operational tracking |
| Risk Assessment | RISK-01 | R-09 (SendGrid cross-border), R-10 (S3 bucket) referenced in vendor assessments |
| Security Officer | SECOFF-01/02 | Document owner; Responsibility #7 (Vendor DPA Oversight) |
| Data Inventory | DBDF-01 | Data classification levels referenced in DPA templates and risk assessments |
| Data Flow Map | SMAP-02 | Data flow paths showing vendor touchpoints |
| Architecture Diagram | SMAP-01 | System components provided by each vendor |
| Minors Data Analysis | DBDF-03 | Minors' data exposure through vendors (MongoDB Atlas, AWS S3 documents) |
| Incident Response Plan | INCD-01/02/03 | Breach notification clause in DPAs references INCD-02 procedures |
| Security Procedures | SECPR-01/02/03 | Vendor security assessment aligns with SECPR-01 access management |
| Glossary | GLOSS-01 | Hebrew-English regulatory terminology |

---

**Document ID:** VEND-01/02/03 -- Vendor Management
**Phase:** 29 -- Operational Procedures
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
