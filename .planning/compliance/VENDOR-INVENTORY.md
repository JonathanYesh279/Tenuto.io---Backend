# Third-Party Vendor and Data Processor Inventory

**Document ID:** SMAP-03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Author:** Tenuto.io Platform Team

---

## 1. Purpose

This document inventories all third-party services that process or have access to Tenuto.io platform data. It fulfills the requirement under Israeli Privacy Protection Regulations (Takkanot Haganat HaPratiyut, 5777-2017) to document data processors, their scope of access, and the existence of appropriate data processing agreements (DPAs).

All vendors listed here act as data processors on behalf of Tenuto.io (the data controller). Each vendor profile documents the specific data categories accessed, the residency of that data, and the current status of contractual data protection obligations.

---

## 2. Vendor Summary

| # | Vendor | Service Type | Data Classification Accessed | DPA Status | Action Required |
|---|--------|-------------|------------------------------|------------|-----------------|
| 1 | MongoDB Atlas | Database hosting | RESTRICTED | NEEDS VERIFICATION | Verify DPA and deployment region |
| 2 | Render | Application hosting | RESTRICTED | NEEDS VERIFICATION | Verify DPA and deployment region |
| 3 | Amazon Web Services (S3) | File storage | SENSITIVE | NEEDS VERIFICATION | Verify DPA addendum signed |
| 4 | SendGrid (Twilio) | Email delivery | SENSITIVE | NEEDS VERIFICATION | Verify DPA signed; document cross-border basis |
| 5 | Google (Gmail via Nodemailer) | Fallback email delivery | SENSITIVE | NEEDS VERIFICATION | Verify Workspace DPA coverage; confirm production usage |

---

## 3. Detailed Vendor Profiles

### 3.1 MongoDB Atlas

| Property | Details |
|----------|---------|
| **Service Name** | MongoDB Atlas (MongoDB, Inc.) |
| **What They Provide** | Managed MongoDB database hosting with automated backups, monitoring, and scaling |
| **Data Types Accessed** | ALL platform data -- every collection is hosted on Atlas, including: student personal data (minors' names, addresses, phone numbers, parent contacts), teacher personal data (names, Israeli ID numbers, addresses, credentials), bagrut exam grades, attendance records, tenant organizational data, deletion/import snapshots, audit logs |
| **DPA Status** | NEEDS VERIFICATION -- check MongoDB Atlas account for Data Processing Addendum acceptance or signed DPA |
| **Data Residency** | NEEDS VERIFICATION -- must check Atlas cluster configuration for deployment region. Connection string is stored in MONGODB_URI environment variable on Render |
| **Compliance Certifications** | SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018, HIPAA eligible (verify current certification status at MongoDB Trust Center) |
| **Data Classification** | **RESTRICTED** -- stores all platform data including minors' PII, credentials (hashed passwords, JWT tokens), and Israeli ID numbers |

**Risk Notes:**
- Atlas has access to ALL data at rest and manages encryption at rest
- Backup snapshots contain complete database copies including all PII
- Atlas operators could theoretically access data (standard for managed database services)
- Database connection string in environment variables is the single point of access control

---

### 3.2 Render

| Property | Details |
|----------|---------|
| **Service Name** | Render (Render Services, Inc.) |
| **What They Provide** | Application hosting for both the Express.js backend API server and the React frontend static files |
| **Data Types Accessed** | All data in transit through the API server (every API request/response passes through Render infrastructure), environment variables containing JWT signing secrets (ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET), database connection string (MONGODB_URI), AWS credentials (S3_ACCESS_KEY, S3_SECRET_KEY), SendGrid API key, application logs captured from stdout (Pino logger output) |
| **DPA Status** | NEEDS VERIFICATION -- check Render account settings for DPA or Terms of Service data processing provisions |
| **Data Residency** | NEEDS VERIFICATION -- check Render dashboard for the deployment region of both backend and frontend services |
| **Compliance Certifications** | SOC 2 Type II (verify current certification status at Render security page) |
| **Data Classification** | **RESTRICTED** -- processes all data in transit including minors' PII, holds all platform secrets in environment variables |

**Risk Notes:**
- Render holds ALL platform secrets in environment variables (JWT secrets, database URI, AWS keys, email credentials)
- All API traffic passes through Render's infrastructure unencrypted at the application layer
- Application logs captured by Render may contain request metadata
- Render staff with infrastructure access could theoretically access environment variables

---

### 3.3 Amazon Web Services (S3)

| Property | Details |
|----------|---------|
| **Service Name** | Amazon Simple Storage Service -- S3 (Amazon Web Services, Inc.) |
| **What They Provide** | Object storage for file uploads related to bagrut (matriculation exam) records |
| **Data Types Accessed** | Uploaded documents in PDF, DOC, DOCX, JPG, and PNG formats. These may include scanned student exam papers, musical program sheets, certificates, and other bagrut-related documentation. Files are associated with specific student bagrut records via document references stored in the `bagrut.documents[]` array |
| **DPA Status** | NEEDS VERIFICATION -- AWS provides a GDPR Data Processing Addendum (DPA). Check whether it has been accepted in the AWS account settings or signed separately |
| **Data Residency** | **eu-central-1 (Frankfurt, Germany)** -- confirmed in code via S3_REGION configuration. Data remains within the EU |
| **Compliance Certifications** | SOC 1, SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018, GDPR-ready, C5 (Germany) |
| **Data Classification** | **SENSITIVE** -- stored documents may contain scanned papers with student names, grades, and exam content (minors' data in document form) |

**Risk Notes:**
- S3 bucket access policy configuration needs verification (ensure bucket is not publicly accessible)
- Files are stored with AWS-managed encryption at rest (verify SSE configuration)
- A local storage fallback exists (STORAGE_MODE environment variable) -- verify which mode is active in production
- Presigned URLs are not currently used; direct S3 access is via access key credentials

---

### 3.4 SendGrid (Twilio)

| Property | Details |
|----------|---------|
| **Service Name** | SendGrid (Twilio, Inc.) |
| **What They Provide** | Transactional email delivery for teacher account invitations, password reset emails, and welcome messages |
| **Data Types Accessed** | Teacher email addresses (recipients), teacher first and last names (used in email personalization), invitation token URLs (containing time-limited tokens that grant account setup access), password reset token URLs (containing time-limited tokens that grant password change access) |
| **DPA Status** | NEEDS VERIFICATION -- Twilio provides a Data Processing Addendum for SendGrid. Check whether it has been accepted in the Twilio/SendGrid account or signed separately |
| **Data Residency** | **United States** -- SendGrid is a US-based service. Email data is processed and potentially stored (for delivery logs) on US infrastructure. This constitutes a cross-border data transfer from Israel |
| **Compliance Certifications** | SOC 2 Type II |
| **Data Classification** | **SENSITIVE** -- processes teacher email addresses and names; token URLs in emails could grant temporary account access if intercepted |

**Risk Notes:**
- **Cross-border data transfer:** Teacher email addresses and names are transferred from Israel to the United States for email delivery. This requires a documented legal basis under Israeli Privacy Protection Regulations for cross-border transfer (Section 2 of the Cross-Border Transfer Regulations)
- Invitation and reset tokens embedded in email URLs are time-limited but grant significant access if intercepted
- SendGrid delivery logs may retain recipient email addresses and message metadata
- Consider evaluating EU-based email delivery alternatives to avoid cross-border transfer requirements

---

### 3.5 Google (Gmail via Nodemailer)

| Property | Details |
|----------|---------|
| **Service Name** | Google Gmail (via Nodemailer SMTP) |
| **What They Provide** | Fallback email delivery when SendGrid is not configured. Uses Gmail SMTP with application-specific password authentication |
| **Data Types Accessed** | Same categories as SendGrid: teacher email addresses, teacher names, invitation token URLs, and password reset token URLs |
| **DPA Status** | NEEDS VERIFICATION -- typically covered by Google Workspace Terms of Service or a Google Workspace DPA. Verify whether the Gmail account used is under a Google Workspace subscription with appropriate data processing terms |
| **Data Residency** | **Google global infrastructure** -- data may be processed across Google's worldwide data center network. Specific residency depends on Google Workspace configuration (if applicable) |
| **Compliance Certifications** | SOC 2, SOC 3, ISO 27001, ISO 27017, ISO 27018 |
| **Data Classification** | **SENSITIVE** -- same data scope as SendGrid |

**Risk Notes:**
- **Production usage unclear:** Verify whether Gmail fallback is actually active in the production environment. If SendGrid is configured and operational, Gmail may be dormant
- Gmail SMTP uses application-specific password (EMAIL_PASS environment variable) -- this credential grants email sending capability
- Same cross-border transfer considerations as SendGrid if Gmail processes data outside Israel
- Google's data processing is governed by broader Terms of Service -- a dedicated DPA may offer stronger contractual protections

---

## 4. Action Items

The following verification actions must be completed to bring this inventory to full compliance status. Items are ordered by risk priority (RESTRICTED vendors first).

- [ ] **V-01:** Verify MongoDB Atlas DPA -- check Atlas account for signed Data Processing Addendum or equivalent contractual terms
- [ ] **V-02:** Verify MongoDB Atlas deployment region -- check Atlas cluster configuration to confirm data residency location
- [ ] **V-03:** Verify Render DPA -- check Render account for data processing terms or signed DPA
- [ ] **V-04:** Verify Render deployment region -- check Render dashboard for backend and frontend service deployment regions
- [ ] **V-05:** Verify AWS S3 DPA addendum is accepted/signed -- check AWS account for GDPR Data Processing Addendum acceptance
- [ ] **V-06:** Verify SendGrid/Twilio DPA is accepted/signed -- check Twilio account for Data Processing Addendum
- [ ] **V-07:** Verify Google Workspace DPA coverage -- confirm whether the Gmail account used is under a Workspace subscription with a DPA that covers SMTP email sending
- [ ] **V-08:** Confirm whether Gmail fallback is active in production -- check production environment variables for EMAIL_USER and EMAIL_PASS presence and whether SendGrid is the active email provider
- [ ] **V-09:** Document cross-border transfer legal basis for SendGrid (US) -- establish and document the legal basis under Israeli Privacy Protection Regulations for transferring teacher email data to the United States
- [ ] **V-10:** Verify S3 bucket is not publicly accessible -- check S3 bucket policy and ACL settings to confirm the bucket blocks public access

---

## 5. Vendor Risk Matrix

| Vendor | Data Access Scope | Classification | Vendor Risk Level | Justification |
|--------|-------------------|---------------|-------------------|---------------|
| MongoDB Atlas | All platform data (22 collections) | RESTRICTED | **CRITICAL** | Stores entire database including minors' PII and credentials; total data loss if compromised |
| Render | All data in transit + all secrets | RESTRICTED | **HIGH** | Processes every API request; holds JWT secrets and database credentials in environment variables |
| Amazon Web Services (S3) | Uploaded exam documents | SENSITIVE | **MEDIUM** | Limited to file storage; documents may contain student information but scope is narrow |
| SendGrid (Twilio) | Teacher emails, names, token URLs | SENSITIVE | **MEDIUM** | Limited PII scope; cross-border transfer to US adds regulatory risk |
| Google (Gmail) | Teacher emails, names, token URLs | SENSITIVE | **LOW-MEDIUM** | Same data scope as SendGrid but may be dormant in production; verify actual usage |

---

## 6. Review Schedule

This vendor inventory must be reviewed and updated:

- **Annually** as part of the regular compliance review cycle
- **When adding new third-party services** that process or access platform data
- **When vendor terms change** (DPA updates, certification changes, residency changes)
- **When data access scope changes** (new data types shared with existing vendors)

---

*Document: SMAP-03 -- Third-Party Vendor and Data Processor Inventory*
*Phase: 27-data-inventory-system-mapping*
*Created: 2026-03-02*
