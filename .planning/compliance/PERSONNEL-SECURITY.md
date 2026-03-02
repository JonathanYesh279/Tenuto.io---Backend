# Personnel Security Procedures

**Document ID:** PERS-01/02/03
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual; training materials reviewed before each school year; confidentiality agreement template reviewed upon regulatory changes
**Related Documents:** ACPOL-01 (Access Control Policy), ACPOL-02 (Password and Authentication Policy), SECOFF-01/02 (Security Officer Role and Appointment), DBDF-01 (Data Inventory), DBDF-03 (Minors' Data Protection Assessment), SECPR-01/02/03 (Security Procedures), GLOSS-01 (Glossary)

---

## 1. Purpose

This document establishes the personnel security procedures for the Tenuto.io music conservatory management platform, as required by **Regulation 17** (Takanat 17) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 17 requires that personnel with access to personal data in a database assessed at medium security level or higher:

- Receive training on the security procedures governing the database
- Receive only the access necessary for their duties
- Sign a confidentiality undertaking covering the data to which they have access
- Are subject to defined onboarding and offboarding procedures that govern the granting and revocation of access

This document addresses these requirements through three sections:

- **PERS-01:** Onboarding and offboarding security procedures (Section 3)
- **PERS-02:** Security awareness training outline (Section 4)
- **PERS-03:** Confidentiality agreement template (Section 5)

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, all three personnel security controls are mandatory regulatory requirements.

---

## 2. Scope

This document covers two distinct populations of personnel who access personal data on the Tenuto.io platform:

### 2.1 Platform Personnel

**Definition:** Individuals with direct access to the platform's infrastructure, codebase, or administrative systems. This includes developers, the Security Officer, and super administrators.

**Access scope:** MongoDB Atlas admin console, Render hosting dashboard, AWS S3 management console, SendGrid dashboard, GitHub repository, super admin accounts in the `super_admin` collection.

**Risk level:** HIGH -- platform personnel can access all data across all tenants, including RESTRICTED minors' data and credentials. A compromised or negligent platform personnel member could affect every tenant on the platform.

### 2.2 Tenant Personnel

**Definition:** Individuals who access the platform through the application interface within the scope of a single tenant. This includes conservatory administrators (role: מנהל), teachers (role: מורה), conductors (role: מנצח), ensemble instructors (role: מדריך הרכב), and theory teachers (role: מורה תאוריה).

**Access scope:** Tenant-scoped data only, as defined in ACCESS-CONTROL-POLICY.md (ACPOL-01). Tenant isolation is enforced through the five-layer defense documented in ACPOL-01 Section 5.

**Risk level:** MEDIUM -- tenant personnel can access personal data of students (minors) within their tenant. A compromised teacher account could expose assigned students' personal information (RESTRICTED per DBDF-01).

### 2.3 Scope Exclusions

- **Students and parents:** End users who are data subjects, not personnel. They do not have login accounts and do not access the platform directly.
- **Third-party vendors:** Covered by VENDOR-MANAGEMENT.md (VEND-01/02/03). Vendor personnel access is governed by DPA provisions.

---

## 3. Onboarding and Offboarding Security Procedures (PERS-01)

### 3.1 Platform Personnel Onboarding

When a new platform team member (developer, Security Officer, or super administrator) joins, the following steps must be completed in sequence before the individual is granted access to any system containing personal data.

| Step | Action | Responsible Party | Verification / Completion Criteria |
|------|--------|-------------------|-----------------------------------|
| 1 | **Background check** (if applicable per organizational policy) | Hiring Manager | Background check completed and documented before any access is granted |
| 2 | **Sign confidentiality agreement** using the PERS-03 template (Section 5) | New Personnel | Signed copy filed in personnel records; copy provided to Security Officer |
| 3 | **Complete security awareness training** per the PERS-02 outline (Section 4) | New Personnel | Training record created with date, version, and acknowledgment signature |
| 4 | **Provision infrastructure access** -- grant access to the following services as required by role: MongoDB Atlas (admin or read-only), Render dashboard, AWS S3 console, SendGrid dashboard, GitHub repository (with appropriate branch protections) | Lead Developer | Access logged in personnel access register (Section 3.5) with service name, access level, and date granted |
| 5 | **Create super admin account** (if the role requires platform-level access) | Existing Super Admin | Account created in the `super_admin` collection with appropriate permissions; `isActive: true`; creation logged in `platform_audit_log` |
| 6 | **Document access scope in personnel access register** | Security Officer | Personnel access register updated with the new member's name, role, access scope, date, and authorizing party |

**Completion gate:** No access to production systems shall be granted until Steps 2 and 3 are completed. Infrastructure access (Step 4) and super admin account creation (Step 5) are blocked until the confidentiality agreement is signed and training is acknowledged.

### 3.2 Platform Personnel Offboarding

When a platform team member departs (resignation, termination, or role change that no longer requires infrastructure access), the following steps must be completed within **24 hours** of the departure date. The Lead Developer and Security Officer share responsibility for ensuring all steps are executed.

| Step | Action | Responsible Party | Verification / Completion Criteria |
|------|--------|-------------------|-----------------------------------|
| 1 | **Revoke all infrastructure access** across all services: MongoDB Atlas (remove user or rotate credentials), Render (remove team member), AWS S3 (revoke IAM user or access keys), SendGrid (revoke API key access), GitHub (remove from organization or repository) | Lead Developer | Access removal confirmed per service; verification screenshot or log entry for each service |
| 2 | **Deactivate super admin account** | Remaining Super Admin | `isActive: false` set on the departing member's `super_admin` document; deactivation logged in `platform_audit_log` |
| 3 | **Rotate shared secrets** if the departing member had access to any of the following: `JWT_SECRET` (ACCESS_TOKEN_SECRET), `JWT_REFRESH_SECRET` (REFRESH_TOKEN_SECRET), `MONGODB_URI`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SENDGRID_API_KEY`, `EMAIL_PASS` (Gmail app password) | Lead Developer | New secrets generated and updated in Render environment variables; application restarted; all existing user sessions invalidated (users must re-authenticate) |
| 4 | **Review and revoke personal API keys or tokens** -- audit all active tokens, API keys, and service credentials that may have been generated by or for the departing member | Security Officer | Audit completed; all personal tokens revoked; audit record filed |
| 5 | **Update personnel access register** | Security Officer | Register updated with departure date, services revoked, and confirmation of secret rotation (if applicable) |
| 6 | **Remind of ongoing confidentiality obligations** -- send written notification to the departing member that the confidentiality agreement (PERS-03) obligations survive termination | Security Officer | Written reminder sent (email or letter); copy filed in personnel records |

**CRITICAL NOTE on secret rotation (Step 3):** Rotating `JWT_SECRET` and `JWT_REFRESH_SECRET` invalidates ALL existing tokens for ALL users across ALL tenants. This is a platform-wide impact. The rotation must be planned during a low-usage window (outside conservatory operating hours) and communicated to tenant administrators in advance. See BACKUP-RECOVERY-PLAN.md (BACK-01) Runbook 4 for the detailed secret rotation procedure.

### 3.3 Tenant Personnel (Teacher/Admin) Onboarding

When a conservatory administrator creates a new teacher account, the following steps govern the secure provisioning of application access.

| Step | Action | Responsible Party | Verification / Completion Criteria |
|------|--------|-------------------|-----------------------------------|
| 1 | **Create teacher account** via the admin dashboard or Excel import | Tenant Admin (מנהל) | Account created in the `teacher` collection with `isActive: true` and appropriate `tenantId` |
| 2 | **Assign appropriate roles** per ACCESS-CONTROL-POLICY.md (ACPOL-01) Section 3 | Tenant Admin | Roles set in `teacher.roles[]` array (e.g., `["מורה"]`, `["מנהל", "מורה"]`); role assignment follows the principle of least privilege |
| 3 | **Send invitation email** with secure token link | System (automated) | Invitation email delivered to the teacher's email address; `credentials.invitationToken` generated with expiry; `credentials.invitationMode` set to `"INVITE"` |
| 4 | **Teacher sets password** via the invitation link | Teacher | Teacher creates a personal password via the invitation flow; `credentials.requiresPasswordChange` cleared; `credentials.isInvitationAccepted` set to `true`; `credentials.passwordSetAt` updated |
| 5 | **Acknowledge security awareness notice** (PERS-02 briefing) | Teacher | Teacher reads the security awareness briefing and provides acknowledgment; acknowledgment date recorded |

---

### 3.4 DEFAULT PASSWORD RISK (R-05) -- CRITICAL WARNING

> **WARNING:** This section documents a known CRITICAL security gap that must be addressed during onboarding.

**The risk:** When teacher accounts are created via **bulk import** (Excel upload through `api/import/import.service.js`), the system automatically sets the password to `"123456"` (bcrypt-hashed) in `auth.service.js`. The `credentials.requiresPasswordChange` flag is set to `true`, but enforcement depends on frontend cooperation -- **the backend does NOT block API access when this flag is true**.

**Reference:** This is documented as risk **R-05** in RISK-ASSESSMENT.md (RISK-01) and analyzed in detail in AUTH-POLICY.md (ACPOL-02) Section 2.2.

**Mandatory procedure until v1.6 removes default password assignment:**

1. **ALL new teacher accounts MUST use the invitation flow** (Step 3 above). Administrators must NOT rely on the bulk import path for initial account creation without immediately triggering invitation emails for each imported account.
2. If bulk import is used, the administrator MUST immediately trigger individual invitation emails for every imported teacher so they set a personal password.
3. Administrators MUST follow up within 7 days to verify that all newly created teachers have changed their password (i.e., `credentials.requiresPasswordChange` is `false` and `credentials.isInvitationAccepted` is `true`).
4. Accounts that retain the default password after 7 days should be deactivated (`isActive: false`) until the teacher completes the invitation flow.

**v1.6 remediation plan (from ACPOL-02):**
- Remove automatic default password assignment from `auth.service.js`
- Require all new accounts to go through the invitation email flow
- Add server-side enforcement: when `requiresPasswordChange` is `true`, reject all non-password-change API requests with HTTP 403
- Add monitoring for accounts with unchanged default passwords beyond 7 days

---

### 3.5 Tenant Personnel Offboarding

When a teacher leaves a conservatory or no longer requires platform access, the following steps govern the secure revocation of application access.

| Step | Action | Responsible Party | Verification / Completion Criteria |
|------|--------|-------------------|-----------------------------------|
| 1 | **Deactivate teacher account** by setting `isActive: false` | Tenant Admin (מנהל) | Teacher document updated with `isActive: false`; account can no longer authenticate |
| 2 | **Revoke active JWT tokens** by incrementing `tokenVersion` | System (automatic upon account deactivation) | `credentials.tokenVersion` incremented; all existing access and refresh tokens for this teacher are immediately invalidated; `credentials.refreshToken` cleared |
| 3 | **Review and reassign student assignments** -- ensure all students previously assigned to the departing teacher are reassigned to active teachers | Tenant Admin | `teacherAssignments` on affected student documents updated with new `teacherId`; no students left without an assigned teacher |
| 4 | **Audit departing teacher's recent data access** (when access logging is implemented per ACPOL-03) | Tenant Admin | Review of the departing teacher's data access for the preceding 30 days; any unusual access patterns flagged to the Security Officer |

**Note:** Tenant personnel offboarding does NOT require secret rotation (unlike platform personnel), because tenant users authenticate through the application layer and do not have direct access to infrastructure secrets. Token revocation via `tokenVersion` is sufficient.

### 3.6 Personnel Access Register

The Security Officer maintains a personnel access register documenting all individuals with access to the platform's infrastructure and administrative systems. This register serves as the authoritative record for access audit and compliance review purposes.

**Register format:**

| Name | Role | Access Scope | Date Granted | Date Revoked | Authorized By | Notes |
|------|------|-------------|-------------|-------------|---------------|-------|
| [Name] | [Developer / Security Officer / Super Admin] | [List of services: Atlas, Render, AWS, SendGrid, GitHub, super admin account] | [YYYY-MM-DD] | [YYYY-MM-DD or "Active"] | [Name of authorizing person] | [Any relevant notes, e.g., "Read-only Atlas access"] |

**Maintenance requirements:**
- Updated within 24 hours of any onboarding or offboarding event
- Reviewed quarterly by the Security Officer as part of the access review process (ACPOL-01 Section 9.2)
- Retained for the duration of the platform's operation plus 2 years after the last entry

**Note:** The personnel access register covers **platform personnel** only. Tenant personnel accounts are managed within the application by tenant administrators and tracked in the `teacher` collection. Tenant-level access reviews follow the process in ACPOL-01 Section 9.2.

---

## 4. Security Awareness Training Outline (PERS-02)

### 4.1 Training Audience

This training is designed for **conservatory administrators and teachers** (tenant-level users) who access personal data through the Tenuto.io platform. The training content is specific to the Tenuto.io platform and references actual data categories from DATA-INVENTORY.md (DBDF-01) and actual roles from ACCESS-CONTROL-POLICY.md (ACPOL-01).

Platform personnel (developers, Security Officer) should also complete this training, in addition to any platform-specific security training relevant to their infrastructure access responsibilities.

### 4.2 Training Frequency

| Requirement | Frequency | Regulatory Basis |
|------------|-----------|-----------------|
| Initial training | Upon onboarding, before access to student data is granted | Regulation 17 -- training before access to medium-security database |
| Refresher training | At least every **24 months** | Regulation 17 -- periodic training for medium-security databases |
| Recommended cadence | **Annually**, at the start of each school year (September) | Best practice -- aligns with natural tenant personnel changes at school year boundaries |
| Ad-hoc training | After a security incident affecting the platform or after significant platform changes | Best practice -- ensures personnel awareness of changed procedures |

### 4.3 Training Format

The training is delivered as a **written briefing document** specific to the Tenuto.io platform. This format:

- Can be distributed digitally to all tenant personnel
- Can be completed as a self-paced reading exercise
- Can be used as the basis for a live training session delivered by the tenant administrator
- Provides a documented, version-controlled training artifact

**Alternative delivery methods** (to be evaluated for v1.6):
- In-app acknowledgment flow (training content displayed within the platform with required acknowledgment before access is granted)
- Video recording of the training session
- Live webinar for multi-tenant training sessions

### 4.4 Training Topics

The following 7 topics constitute the complete security awareness training for tenant personnel. Each topic references specific Tenuto.io documents and platform features.

| # | Topic | Est. Duration | Content Description |
|---|-------|--------------|-------------------|
| 1 | **Platform overview and data responsibilities** | 10 minutes | What data the Tenuto.io platform holds: 22 MongoDB collections including student personal data (RESTRICTED), teacher personal data (SENSITIVE), and examination grades (RESTRICTED) -- as documented in DATA-INVENTORY.md (DBDF-01). Teachers' responsibility for protecting the data they access. The platform's Security Level: MEDIUM classification and what it means for data handling obligations. |
| 2 | **Password and account security** | 10 minutes | Strong password requirements (v1.6 will enforce 8+ characters, mixed case, at least one number). Never share login credentials with colleagues. Use the invitation flow to set a personal password. Report any suspicious login activity (unexpected password reset emails, inability to log in). Change password immediately if compromise is suspected. Reference: AUTH-POLICY.md (ACPOL-02). |
| 3 | **Data handling principles** | 10 minutes | Principle of least privilege: only access student data needed for your teaching role. Do not export student data outside the platform without explicit admin approval. Do not copy student information to personal devices, notebooks, or messaging applications. Do not share student data with parents or third parties through unofficial channels. Reference: ACPOL-01 role scoping and DBDF-04 data minimization. |
| 4 | **Recognizing security incidents** | 5 minutes | What to report: unexpected data appearing in your account, inability to log in, suspicious emails requesting credentials, system behavior that seems abnormal, discovery that student data has been shared outside the platform. How to report: contact your conservatory administrator (מנהל) immediately. The administrator escalates to the Security Officer per the incident response procedure. Reference: INCIDENT-RESPONSE-PLAN.md (INCD-01). |
| 5 | **Student data (minors) special handling** | 10 minutes | Students in the platform are primarily minors (ages 6-18). Their personal data receives the highest classification (RESTRICTED per DBDF-01). Heightened duty of care under Israeli privacy regulations -- reference MINORS-DATA.md (DBDF-03). Never take screenshots of student data. Never share student personal information via WhatsApp, email, or other messaging channels outside the platform. Parent/guardian contact information is also protected. If a parent requests their child's data, direct them to the conservatory administrator. |
| 6 | **Device and access security** | 5 minutes | Lock your device (computer, tablet, phone) when stepping away, even briefly. Use a secure network -- avoid accessing the platform on public Wi-Fi without a VPN. Do not access the platform on shared or public computers (e.g., library computers, shared workstations). Always log out when you are finished working in the platform. Do not save your password in browsers on shared devices. |
| 7 | **Incident reporting procedure** | 5 minutes | The internal reporting chain: **Teacher** reports to **Tenant Administrator (מנהל)** who escalates to the **Security Officer**. Every report is taken seriously. There are no penalties for reporting in good faith -- even if the report turns out to be a false alarm. Timely reporting is critical: a 24-hour delay in reporting can significantly increase the impact of a security incident. Reference: INCIDENT-RESPONSE-PLAN.md (INCD-01) Section on reporting chain. |

**Total estimated training time: 55 minutes**

### 4.5 Training Acknowledgment

Upon completing the training, each trainee must provide a written acknowledgment. The acknowledgment text:

> "I have read and understood the Tenuto.io Security Awareness Briefing (version [VERSION]). I understand my responsibilities for protecting personal data on the platform, including the special obligations for student (minors') data. I understand the incident reporting procedure and will report any suspected security concerns to my conservatory administrator."

### 4.6 Training Record Template

The following record is maintained for each training completion:

| Field | Description |
|-------|-------------|
| **Trainee Name** | Full name of the person trained |
| **Role** | Platform role: Teacher (מורה) / Admin (מנהל) / Conductor (מנצח) / Ensemble Instructor (מדריך הרכב) / Theory Teacher (מורה תאוריה) |
| **Tenant** | Conservatory name (tenant identifier) |
| **Training Date** | Date training was completed (YYYY-MM-DD) |
| **Training Version** | Version number of the training materials used (e.g., "1.0 -- March 2026") |
| **Delivery Method** | Self-paced document / Live session / Video / In-app (v1.6+) |
| **Acknowledgment** | Signed acknowledgment text (Section 4.5) with date |
| **Trainer / Verifier** | Name of the person who administered or verified completion of the training |

**Record retention:** Training records are retained for the duration of the individual's access to the platform plus 2 years after access is revoked. Records are maintained by the tenant administrator, with the Security Officer having audit access.

---

## 5. Confidentiality Agreement Template (PERS-03)

### 5.1 Purpose

This confidentiality agreement is signed by all personnel with access to personal data processed by the Tenuto.io platform. It establishes the legal obligation of confidentiality and the consequences of breach, as required by Regulation 17 of the Israeli Privacy Protection Regulations (Information Security), 5777-2017.

The agreement is signed during onboarding (Step 2 for platform personnel, referenced in Step 5 for tenant personnel via the training acknowledgment). The obligations survive the termination of the engagement.

### 5.2 Agreement Template

---

```
CONFIDENTIALITY AND DATA PROTECTION AGREEMENT
(Heskem Sodiyut VeHaganat Meida / הסכם סודיות והגנת מידע)

========================================================================

PARTIES

  Personnel Member:
    Full Name:       [FULL_NAME]
    Role:            [ROLE -- e.g., Developer, Security Officer, Super Admin,
                      Conservatory Administrator, Teacher]
    Date of Engagement: [START_DATE]

  Organization:
    Name:            [ORGANIZATION_NAME]
    Represented By:  [AUTHORIZED_REPRESENTATIVE_NAME]
    Title:           [AUTHORIZED_REPRESENTATIVE_TITLE]

========================================================================

WHEREAS the Personnel Member will have access to personal data processed
by the Tenuto.io music conservatory management platform in the course of
their duties; and

WHEREAS the platform processes personal data of teachers (adults) and
students (minors aged approximately 6-18), which is subject to the
Israeli Privacy Protection Law, 5741-1981 (Hok Haganat HaPratiyut) and
the Israeli Privacy Protection Regulations (Information Security),
5777-2017;

NOW THEREFORE the parties agree as follows:

------------------------------------------------------------------------

1. DEFINITION OF CONFIDENTIAL INFORMATION

   "Confidential Information" means all personal data and non-public
   information processed, stored, transmitted, or accessible through
   the Tenuto.io platform, including but not limited to:

   a) Student records: names, ages, addresses, phone numbers, email
      addresses, parent/guardian contact information, academic progress,
      examination grades (bagrut), instrument assignments, attendance
      records, and all other data classified as RESTRICTED in the
      platform's Data Inventory (DBDF-01)

   b) Teacher records: names, email addresses, phone numbers, addresses,
      Israeli ID numbers (Teudat Zehut), professional information, and
      all other data classified as SENSITIVE or RESTRICTED in DBDF-01

   c) Credentials: login credentials, hashed passwords, JWT tokens,
      API keys, invitation tokens, password reset tokens, and all
      authentication-related data

   d) Organizational data: tenant configurations, subscription details,
      conservatory profiles, business registration numbers

   e) System information: architecture details, security configurations,
      infrastructure access credentials, environment variables, database
      connection strings, encryption keys

   f) Compliance documents: risk assessments, security procedures,
      audit reports, incident reports, and all governance documentation

------------------------------------------------------------------------

2. OBLIGATIONS

   The Personnel Member agrees to:

   a) NOT disclose, publish, or otherwise make available any Confidential
      Information to any unauthorized person, whether inside or outside
      the Organization, except as strictly required to perform their
      duties

   b) NOT copy, reproduce, extract, or transfer Confidential Information
      to any personal device, external storage, cloud service, or
      messaging platform not authorized for platform operations

   c) NOT access Confidential Information beyond what is necessary for
      the performance of their duties (principle of least privilege)

   d) PROTECT Confidential Information against unauthorized access by
      implementing reasonable security measures including but not
      limited to: using strong passwords, locking devices when
      unattended, using secure networks, and logging out after sessions

   e) IMMEDIATELY REPORT any suspected or actual breach of
      confidentiality to the Security Officer or, if unavailable,
      to the conservatory administrator, without delay

   f) COMPLY with all security procedures documented in the Security
      Procedure Document (SECPR-01/02/03), the Access Control Policy
      (ACPOL-01), the Authentication Policy (ACPOL-02), and all other
      applicable compliance documents

------------------------------------------------------------------------

3. DURATION

   The obligations of confidentiality set forth in this Agreement:

   a) Take effect on the date this Agreement is signed

   b) Remain in full force during the Personnel Member's engagement
      with the Organization

   c) SURVIVE the termination of the engagement, regardless of the
      reason for termination, for an indefinite period with respect
      to personal data of minors, and for a period of five (5) years
      with respect to all other Confidential Information

------------------------------------------------------------------------

4. SPECIAL PROVISIONS FOR MINORS' DATA

   The Personnel Member specifically acknowledges and agrees that:

   a) The Tenuto.io platform processes personal data of MINORS
      (students aged approximately 6-18 enrolled in music
      conservatories)

   b) Minors' personal data is classified as RESTRICTED -- the highest
      classification tier -- in the platform's Data Inventory (DBDF-01)

   c) The processing of minors' data carries HEIGHTENED legal
      obligations under Israeli privacy law, including but not limited
      to the requirement for parental/guardian consent and the
      prohibition on using minors' data for purposes beyond the
      educational service

   d) The Personnel Member will exercise HEIGHTENED CARE when handling
      student data, including: never sharing student information
      outside the platform, never taking screenshots of student
      records, never discussing student data in public or unsecured
      settings, and never storing student data on personal devices

   e) A breach involving minors' data may result in ELEVATED penalties
      due to the vulnerable status of the data subjects

------------------------------------------------------------------------

5. RETURN AND DESTRUCTION UPON TERMINATION

   Upon termination of the engagement, the Personnel Member shall:

   a) Return to the Organization all materials containing Confidential
      Information, including physical documents, electronic files,
      copies, notes, and summaries

   b) Delete all Confidential Information from personal devices,
      accounts, and storage media

   c) Provide a written certification to the Security Officer
      confirming that all Confidential Information has been returned
      or destroyed and that no copies have been retained

------------------------------------------------------------------------

6. CONSEQUENCES OF BREACH

   The Personnel Member acknowledges that a breach of this Agreement
   may result in:

   a) DISCIPLINARY ACTION up to and including termination of
      engagement

   b) CIVIL LIABILITY for damages caused by the unauthorized
      disclosure or misuse of personal data, including compensation
      to affected data subjects

   c) CRIMINAL PENALTIES under the Israeli Privacy Protection Law,
      5741-1981 (Hok Haganat HaPratiyut), which provides for:
      - Fines for unauthorized use or disclosure of personal data
        from a database
      - Imprisonment of up to five (5) years for willful
        infringement of privacy through unauthorized access to or
        use of personal data from a database (Section 5 of the Law)

   d) REGULATORY ACTION by the Israeli Privacy Protection Authority
      (HaRashut LeHaganat HaPratiyut), which may include orders to
      cease processing, database registration sanctions, and public
      disclosure of the breach

------------------------------------------------------------------------

7. GENERAL PROVISIONS

   a) This Agreement is governed by the laws of the State of Israel

   b) This Agreement supplements and does not replace any other
      confidentiality or non-disclosure obligations the Personnel
      Member may have under their employment contract or engagement
      terms

   c) If any provision of this Agreement is found to be unenforceable,
      the remaining provisions shall continue in full force

   d) Any modification to this Agreement must be in writing and
      signed by both parties

========================================================================

SIGNATURES

_________________________          _________________________
Personnel Member                   Authorized Representative
Full Name: [FULL_NAME]             Full Name: [AUTH_REP_NAME]
Date: [DATE]                       Title: [AUTH_REP_TITLE]
                                   Date: [DATE]

========================================================================

WITNESS (optional)

_________________________
Witness Name: [WITNESS_NAME]
Date: [DATE]
```

---

## 6. Review Schedule

### 6.1 Regular Review

| Document Section | Review Frequency | Reviewer | Trigger for Additional Review |
|-----------------|-----------------|----------|------------------------------|
| PERS-01: Onboarding/Offboarding Procedures (Section 3) | Annually | Security Officer | Any personnel security incident; change to platform infrastructure; change to account provisioning flow |
| PERS-02: Training Outline (Section 4) | Before each school year (recommended: August) | Security Officer + Tenant Admin representative | After any security incident; after significant platform feature changes; after regulatory updates |
| PERS-03: Confidentiality Agreement (Section 5) | Annually, or upon regulatory changes | Security Officer + Legal counsel (when available) | Changes to Israeli Privacy Protection Law or regulations; addition of new data categories; platform architecture changes |
| Personnel Access Register (Section 3.6) | Quarterly | Security Officer | Any onboarding or offboarding event |

### 6.2 Triggered Review

An immediate review of the relevant section(s) is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| Security incident involving personnel negligence or unauthorized access | Full document review (Sections 3, 4, 5) |
| Regulatory update to Regulation 17 or related training/confidentiality requirements | PERS-02 and PERS-03 review |
| Change to the platform's authentication system (e.g., v1.6 removal of default passwords) | PERS-01 onboarding procedures, especially Section 3.4 |
| New third-party service added to the platform infrastructure | PERS-01 onboarding/offboarding tables (add new service to access provisioning/revocation steps) |
| Change to the role structure in ACCESS-CONTROL-POLICY.md (ACPOL-01) | PERS-02 training content review (role descriptions) |
| First production tenant onboarded | Full document review to confirm procedures are operationally ready |

---

## 7. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Access Control Policy | ACPOL-01 | Onboarding references role assignment (Section 3); training references role descriptions and permission matrix |
| Password and Authentication Policy | ACPOL-02 | Default password risk R-05 addressed in onboarding (Section 3.4); training references password requirements |
| Access Logging Policy | ACPOL-03 | Offboarding references access audit capability (when implemented) |
| Security Officer | SECOFF-01/02 | Document owner; Training coordination is Responsibility #10; Security Officer coordinates offboarding access revocation |
| Security Procedures | SECPR-01/02/03 | Parent procedure document; PERS-01 operationalizes user account lifecycle from SECPR-01a |
| Data Inventory | DBDF-01 | Training references 22 collections and data classifications; confidentiality agreement references data categories |
| Minors' Data Assessment | DBDF-03 | Training Topic 5 references minors' data handling requirements; confidentiality agreement Clause 4 references minors' data obligations |
| Risk Assessment | RISK-01 | R-05 (default password) directly addressed in onboarding procedures Section 3.4 |
| Incident Response Plan | INCD-01 | Training Topics 4 and 7 reference incident reporting chain and procedures |
| Glossary | GLOSS-01 | Terminology reference for Hebrew-English regulatory terms used throughout |
| Backup and Recovery Plan | BACK-01 | Platform offboarding Step 3 references BACK-01 Runbook 4 for secret rotation procedure |

---

**Document ID:** PERS-01/02/03 -- Personnel Security Procedures
**Phase:** 29 -- Operational Procedures
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
