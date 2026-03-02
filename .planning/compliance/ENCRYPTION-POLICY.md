# Encryption Standards Policy

**Document ID:** ENC-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon changes to encryption infrastructure
**Related Documents:** SMAP-01 (Architecture Diagram), SMAP-02 (Data Flow Map), SECPR-01/02/03 (Security Procedures), RISK-01 (Risk Assessment), ACPOL-02 (Password and Authentication Policy), DBDF-01 (Data Inventory), GLOSS-01 (Glossary)

---

## 1. Purpose

This document defines the encryption standards for all data in transit and at rest on the Tenuto.io music conservatory management platform, as required by **Regulation 14** (Takanat 14) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 14 requires: "The transfer of information from the database through a public network or the Internet will be conducted by commonly used encryption methods."

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, encryption must be applied to all data transfers over public networks, and encryption standards must be documented and periodically reviewed.

This document is the **single authoritative source** for encryption standards on the Tenuto.io platform. ARCHITECTURE-DIAGRAM.md (SMAP-01) and DATA-FLOW-MAP.md (SMAP-02) provide the evidence that these standards are met; this document consolidates that evidence into policy.

---

## 2. Encryption Standards for Data in Transit

### 2.1 Policy Statement

**ALL data transmission over public networks MUST use TLS 1.2 or higher.** No unencrypted connections are permitted between any platform components. This standard applies to all connection paths documented below.

### 2.2 Connection Inventory

The following table documents every connection path in the platform with its encryption status. Source: ARCHITECTURE-DIAGRAM.md (SMAP-01) Section 4 (Security Boundary Annotations) and DATA-FLOW-MAP.md (SMAP-02) Section 5 (Data in Transit Summary).

| # | Connection Path | Protocol | Minimum TLS Version | Certificate Management | Status | Source Reference |
|---|----------------|----------|--------------------|-----------------------|--------|-----------------|
| 1 | Browser to React Frontend (Render) | HTTPS | TLS 1.2+ | Render-managed (automatic provisioning and renewal via Let's Encrypt) | **ENFORCED** | SMAP-01 Section 4.1 |
| 2 | Browser to Express API (Render) | HTTPS | TLS 1.2+ | Render-managed (same certificate as frontend; API served from same Render instance) | **ENFORCED** | SMAP-01 Section 4.1 |
| 3 | Express API to MongoDB Atlas | MongoDB wire protocol over TLS | TLS 1.2+ | Atlas-managed certificate (Atlas requires TLS for all connections) | **ENFORCED** | SMAP-01 Section 4.2 |
| 4 | Express API to AWS S3 | HTTPS | TLS 1.2+ | AWS-managed certificate (AWS SDK uses HTTPS by default) | **ENFORCED** | SMAP-01 Section 4.3 |
| 5 | Express API to SendGrid | HTTPS API | TLS 1.2+ | SendGrid-managed certificate | **ENFORCED** | SMAP-01 Section 4.4 |
| 6 | Express API to Gmail (SMTP) | SMTP with STARTTLS | TLS (version managed by Gmail) | Gmail-managed certificate | **ENFORCED** | SMAP-01 Section 4.4 |
| 7 | Browser WebSocket (Socket.io) | WSS (WebSocket Secure, TLS) | TLS 1.2+ | Render-managed (shares the API server's TLS certificate) | **ENFORCED** | SMAP-01 Section 3 |
| 8 | MongoDB Atlas internal replication | TLS | Managed by Atlas | Atlas-managed (internal to Atlas cluster) | **ENFORCED** (provider-managed, transparent to application) | Atlas documentation |

### 2.3 Network Architecture Note

All component-to-component communication occurs over the **public internet** with TLS/HTTPS encryption. There are no VPN tunnels, private subnets, or dedicated network links between any components (reference SMAP-01 Section 4.5). Security relies entirely on:

1. TLS encryption in transit
2. Per-component authentication (JWT, connection strings, API keys, access keys)
3. Application-level tenant isolation

### 2.4 Cross-Border Data Transfers

Two connection paths involve cross-border data transfer, where personal data exits the hosting region:

| Transfer | Source Region | Destination Region | Data Types Transferred | Encryption | DPA Status |
|----------|-------------|-------------------|----------------------|-----------|-----------|
| API to SendGrid | Render hosting region | United States | Teacher names, email addresses, invitation/reset token URLs | TLS 1.2+ (HTTPS) | NEEDS VERIFICATION (see SMAP-03) |
| API to Gmail | Render hosting region | Google global infrastructure | Same as SendGrid | TLS (STARTTLS) | NEEDS VERIFICATION (see SMAP-03) |

Source: DATA-FLOW-MAP.md (SMAP-02) Section 5, Cross-border data transfers table. See also R-09 (SendGrid/Email Data in Transit to US) in RISK-ASSESSMENT.md (RISK-01).

---

## 3. Encryption Standards for Data at Rest

### 3.1 Policy Statement

**ALL persistent data storage MUST use encryption at rest.** Provider-managed encryption is the current standard for all storage locations. The platform does not implement application-level encryption for data at rest (see Gap Analysis, Section 5).

### 3.2 Storage Inventory

The following table documents every data storage location with its encryption status. Source: DATA-FLOW-MAP.md (SMAP-02) Section 4 (Data at Rest Summary).

| # | Storage Location | Data Classifications Present | Encryption Method | Key Management | Status | Source Reference |
|---|-----------------|-----------------------------|--------------------|---------------|--------|-----------------|
| 1 | MongoDB Atlas (22 collections) | RESTRICTED + SENSITIVE + INTERNAL | AES-256 encryption at rest | Atlas-managed keys (transparent to application; Atlas encrypts all data on disk using AES-256-CBC or AES-256-GCM) | **ENFORCED** (provider default, cannot be disabled) | SMAP-02 Section 4; Atlas documentation |
| 2 | AWS S3 (eu-central-1, Frankfurt) | SENSITIVE (bagrut document uploads: PDF, DOC, DOCX, JPG, PNG) | SSE-S3 (Server-Side Encryption with S3-managed keys, AES-256) | AWS-managed keys (S3 handles key generation, encryption, and decryption transparently) | **ENFORCED** (S3 default encryption enabled) | SMAP-01 Section 4.3; SMAP-02 Section 4 |
| 3 | Render application logs | INTERNAL (sensitive fields redacted by Pino logger) | Render platform default encryption | Render-managed (platform-level encryption of log storage) | **ENFORCED** (provider default) | SMAP-01 Section 3; SMAP-02 Section 4 |
| 4 | Render environment variables (secrets) | RESTRICTED (JWT secrets, database credentials, API keys) | Render platform encryption for secrets | Render-managed (environment variables encrypted at rest on Render infrastructure) | **ENFORCED** (provider default) | SMAP-01 Section 6 |
| 5 | Browser localStorage | RESTRICTED (JWT access token in plaintext) | **NOT ENCRYPTED** | N/A -- browser localStorage provides no encryption; data is plaintext, accessible to any JavaScript on the same origin | **GAP** -- see Section 5, Gap 3 | SMAP-01 Section 4.1; SMAP-02 Section 4; R-04 in RISK-01 |
| 6 | Browser httpOnly cookie | RESTRICTED (JWT refresh token) | **NOT ENCRYPTED** (stored by browser) | N/A -- browser manages cookie storage; httpOnly flag prevents JavaScript access but does not encrypt the value | **PARTIAL** -- httpOnly mitigates XSS but does not provide encryption | SMAP-02 Section 4; ACPOL-02 Section 3.1 |

---

## 4. Key Management Principles

### 4.1 Infrastructure-Provider-Managed Keys

All encryption at rest currently uses **infrastructure-provider-managed keys**. The application has no direct involvement in key generation, storage, rotation, or destruction for at-rest encryption.

| Provider | Key Management Approach | Rotation | Application Visibility |
|----------|----------------------|----------|----------------------|
| MongoDB Atlas | Atlas manages encryption keys for data at rest; keys are rotated per Atlas internal schedule | Transparent -- no application action required | None -- encryption/decryption is transparent |
| AWS S3 | S3 manages SSE-S3 keys; keys are rotated per AWS internal schedule | Transparent -- no application action required | None -- encryption/decryption is transparent |
| Render | Render manages encryption for environment variables and log storage | Transparent -- no application action required | None -- accessed as plaintext environment variables at runtime |

### 4.2 Application-Level Cryptographic Operations

The application performs the following cryptographic operations directly:

| Operation | Algorithm / Method | Purpose | Implementation | Reference |
|-----------|-------------------|---------|---------------|-----------|
| Password hashing | bcrypt with 10 salt rounds | One-way hash of user passwords for verification (not encryption, but relevant to data protection) | `api/auth/auth.service.js` | ACPOL-02 Section 2.1 |
| Token generation | `crypto.randomBytes` | Generate cryptographically secure random values for refresh tokens and invitation tokens | `api/auth/auth.service.js` | ACPOL-02 Section 3 |
| JWT signing | HMAC-SHA256 (HS256) | Sign JWT access tokens and refresh tokens with server-held secrets | `jsonwebtoken` library using `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` | ACPOL-02 Section 3.1 |

### 4.3 Secret Storage

All application secrets are stored in **Render environment variables**. No secrets are committed to source control. The complete secret inventory is documented in ARCHITECTURE-DIAGRAM.md (SMAP-01) Section 6 and BACKUP-RECOVERY-PLAN.md (BACK-01) Section 7.

| Secret | Classification | Purpose |
|--------|---------------|---------|
| `ACCESS_TOKEN_SECRET` | RESTRICTED | JWT access token signing key (HMAC-SHA256) |
| `REFRESH_TOKEN_SECRET` | RESTRICTED | JWT refresh token signing key (HMAC-SHA256) |
| `MONGODB_URI` | RESTRICTED | Database connection string with credentials |
| `S3_ACCESS_KEY` | RESTRICTED | AWS S3 access key |
| `S3_SECRET_KEY` | RESTRICTED | AWS S3 secret key |
| `SENDGRID_API_KEY` | RESTRICTED | SendGrid API authentication key |
| `EMAIL_PASS` | RESTRICTED | Gmail app password (fallback email) |

### 4.4 Key Rotation

| Key Type | Current Rotation Mechanism | Gap | Planned Remediation |
|----------|--------------------------|-----|-------------------|
| Infrastructure encryption keys (Atlas, S3, Render) | Managed by providers -- transparent, automatic | None -- provider rotation is adequate | No change needed |
| JWT signing secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`) | **Manual rotation only** -- requires updating Render environment variables and restarting the application | **CRITICAL:** Rotation invalidates ALL active sessions for ALL users across ALL tenants (no dual-key validation window exists). Must be performed during low-usage window. See BACK-01 Runbook 4. | v1.6: Implement dual-key validation during rotation window to allow graceful rotation without mass session invalidation |
| AWS access keys | **Manual rotation** -- requires updating Render environment variables | No automated rotation mechanism | v1.6: Evaluate AWS IAM role-based authentication (no static keys) |
| SendGrid API key | **Manual rotation** -- requires updating Render environment variables | No automated rotation mechanism | Low priority -- rotate on personnel offboarding per PERS-01 Section 3.2 |
| Gmail app password | **Manual rotation** -- requires updating Render environment variables | No automated rotation mechanism | Low priority -- rotate on personnel offboarding per PERS-01 Section 3.2 |

---

## 5. Gap Analysis

Following the three-part pattern: Current State -> Gap -> Planned Remediation.

### 5.1 Gap 1: No Field-Level Encryption for RESTRICTED Data

- **Current state:** Several MongoDB collections contain blob fields with RESTRICTED-equivalent data that receive only Atlas-level AES-256 encryption at rest:
  - `import_log.previewData` -- contains full parsed Excel data (teacher and student PII from imports)
  - `deletion_snapshots.snapshotData` and `deletion_snapshots.collectionSnapshots` -- contain complete document copies of deleted records (including minors' data, credentials)
  - `tenant_deletion_snapshots` -- contains complete tenant data snapshots
  - `ministry_report_snapshots` -- contains aggregated teacher and student data for ministry reporting
- **Gap:** Regulation 14 and the data classification framework in DATA-INVENTORY.md (DBDF-01) suggest that RESTRICTED data should have additional protection beyond provider-level encryption. If an Atlas admin account is compromised, these blob fields are readable in plaintext. The data is classified SENSITIVE in DBDF-01 but effectively contains RESTRICTED-level information (minors' PII, credentials).
- **Planned remediation (v1.6):** Evaluate field-level encryption for blob collections using MongoDB Client-Side Field Level Encryption (CSFLE) or application-level encryption before storage. Alternatively, implement TTL-based auto-deletion (90-day recommended per R-06 and R-07 in RISK-01) as a compensating control that limits the exposure window.

### 5.2 Gap 2: No Application-Level Encryption Key Rotation

- **Current state:** JWT signing secrets are static environment variables on Render. Rotation requires manual update and application restart, which invalidates ALL active sessions for ALL users platform-wide.
- **Gap:** No mechanism for graceful key rotation. A compromised JWT secret remains valid for all tokens signed with it until manual rotation occurs. Manual rotation causes a service disruption (all users must re-authenticate). There is no dual-key validation window during rotation.
- **Planned remediation (v1.6):** Implement dual-key JWT validation: during rotation, accept tokens signed with either the old key or the new key for a defined transition period (recommended: 2 hours, matching the access token expiry). After the transition period, drop the old key. This allows rotation without mass session invalidation.

### 5.3 Gap 3: JWT Stored in Plaintext in Browser localStorage

- **Current state:** JWT access tokens are stored in browser `localStorage`, which provides no encryption. Any JavaScript running on the same origin can read the token value. This applies to all devices (desktop and mobile browsers).
- **Gap:** Regulation 12 (portable devices) and Regulation 14 (encryption) imply that data should be protected on user devices. `localStorage` provides no encryption, and an XSS vulnerability would allow an attacker to exfiltrate access tokens. This is documented as risk R-04 (JWT Secret Compromise) in RISK-ASSESSMENT.md (RISK-01).
- **Mitigation in place:** Access token expiry limits the exposure window (15 minutes for API access, 1 hour for token validity per ACPOL-02). Refresh tokens are stored in `httpOnly` cookies, preventing JavaScript access.
- **Planned remediation (v1.6):** Evaluate migrating access tokens from `localStorage` to `httpOnly` secure cookies. This would prevent JavaScript access to tokens entirely, closing the XSS token theft vector. Requires evaluation of CSRF implications (cookie-based auth requires CSRF protection).

### 5.4 Gap 4: Data Classification Handling Rules NOT Technically Enforced by Tier

- **Current state:** SECURITY-PROCEDURES.md (SECPR-01/02/03) Section 6 documents handling rules for each data classification tier (PUBLIC, INTERNAL, SENSITIVE, RESTRICTED). However, no technical controls differentiate the encryption treatment of data by classification tier. All data receives identical encryption: TLS in transit + Atlas AES-256 at rest.
- **Gap:** A comprehensive encryption policy would apply different encryption levels by data classification: RESTRICTED data would receive application-level encryption with application-managed keys, while PUBLIC data would receive only transport encryption. Currently, the platform cannot distinguish between a PUBLIC `healthcheck` response and a RESTRICTED student record at the encryption layer.
- **Planned remediation (v1.6):** Evaluate field-level encryption for SENSITIVE and RESTRICTED classifications. Begin with RESTRICTED blob fields (Gap 1) as the highest-value target. Full per-field classification-based encryption is a v1.7+ consideration.

### 5.5 Gap 5: No Certificate Pinning or Custom CA Verification

- **Current state:** All TLS connections rely on standard CA trust chain verification. The application does not implement certificate pinning or custom CA verification for any connection.
- **Gap:** Provider certificate changes (Atlas, Render, AWS, SendGrid) are transparent to the application. A compromised CA could issue a fraudulent certificate that the application would accept.
- **Assessment:** **ACCEPTABLE risk** for the current security level (MEDIUM). Certificate pinning is a defense-in-depth measure appropriate for HIGH or CRITICAL security databases. The standard CA trust chain provides adequate protection for a medium-security SaaS platform, and certificate pinning introduces operational complexity (pins must be updated when certificates rotate).
- **No remediation planned.** Monitor for changes in security level assessment. If the platform is reclassified to HIGH security, certificate pinning should be re-evaluated.

---

## 6. Encryption by Data Classification

The following table maps the data classification tiers from DATA-INVENTORY.md (DBDF-01) to encryption standards. Currently, all tiers receive identical encryption treatment. Differentiation is a v1.6 enhancement.

| Classification Tier | Data Examples | Transit Encryption | At-Rest Encryption | Additional Encryption | Status |
|--------------------|--------------|-------------------|-------------------|---------------------|--------|
| **PUBLIC** | Health check status, instrument lists, collection metadata | TLS 1.2+ (enforced) | Atlas AES-256 (enforced) | None required | Adequate |
| **INTERNAL** | Schedules, attendance records, audit logs, operational data | TLS 1.2+ (enforced) | Atlas AES-256 (enforced) | None required | Adequate |
| **SENSITIVE** | Teacher PII (names, phone, email, address, ID number), bagrut documents (S3) | TLS 1.2+ (enforced) | Atlas AES-256 / S3 SSE-S3 (enforced) | Field-level encryption **recommended** for v1.6 | Partial -- transit and at-rest adequate; field-level recommended |
| **RESTRICTED** | Student PII (minors' names, addresses, grades, parent contacts), credentials (hashed passwords, JWT tokens), blob fields (import preview, deletion snapshots) | TLS 1.2+ (enforced) | Atlas AES-256 (enforced) | Field-level encryption **REQUIRED** for v1.6 | Gap -- transit and at-rest adequate; field-level required |

**Note:** The "REQUIRED for v1.6" designation for RESTRICTED field-level encryption is a policy-level requirement. Implementation complexity and performance implications will be evaluated during v1.6 planning. If field-level encryption is not feasible for all RESTRICTED fields, compensating controls (TTL-based deletion of blob fields, enhanced access logging) will be documented.

---

## 7. Review Schedule

### 7.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Accuracy of Section 2 (data in transit) against current connection paths -- any new providers or connection types?
- Accuracy of Section 3 (data at rest) against current storage locations -- any new storage services?
- Currency of Section 4 (key management) against current key rotation practices
- Status of Section 5 (gap analysis) -- which gaps have been closed?
- Alignment with ARCHITECTURE-DIAGRAM.md (SMAP-01) and DATA-FLOW-MAP.md (SMAP-02) -- this document must not contradict those source documents

### 7.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| New third-party provider integrated (e.g., new email service, new storage service) | Section 2 (transit) and/or Section 3 (at-rest) update |
| Change to TLS configuration on any connection path | Section 2 update |
| Provider changes encryption defaults (e.g., Atlas changes encryption algorithm) | Section 3 and Section 4 update |
| Security incident involving data exposure | Full document review; gap analysis reassessment |
| Implementation of v1.6 encryption enhancements | Full document update to reflect new current state (gaps closed, new controls added) |
| Change to data classification framework (DBDF-01) | Section 6 (encryption by classification) update |
| JWT secret rotation event | Document the rotation in Section 4.4; update rotation history if maintained |

---

## 8. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Architecture Diagram | SMAP-01 | **Primary evidence source** for data-in-transit encryption. Section 3 (component details) documents encryption per component. Section 4 (security boundary annotations) documents TLS per connection path. Section 6 documents secret inventory. |
| Data Flow Map | SMAP-02 | **Primary evidence source** for data-at-rest encryption and cross-border transfers. Section 4 (data at rest summary) documents encryption per storage location. Section 5 (data in transit summary) documents TLS per connection. |
| Security Procedures | SECPR-01/02/03 | Section 6 (data handling) documents handling rules per classification tier that this encryption policy should technically enforce (Gap 4). |
| Risk Assessment | RISK-01 | R-02 (credential exposure in database dump) relates to Gap 1 (no field-level encryption). R-04 (JWT secret compromise) relates to Gap 2 (no key rotation) and Gap 3 (localStorage JWT). R-10 (S3 misconfiguration) relates to S3 encryption at rest. |
| Password and Authentication Policy | ACPOL-02 | Documents JWT architecture (Section 3), token storage (localStorage, httpOnly cookies), and signing algorithm (HS256) referenced in Sections 3, 4, and 5 of this policy. |
| Data Inventory | DBDF-01 | Data classification framework (PUBLIC/INTERNAL/SENSITIVE/RESTRICTED) used in Section 6 to map encryption requirements by tier. |
| Backup and Recovery Plan | BACK-01 | Runbook 4 (secret rotation procedure) documents the operational process for JWT secret rotation referenced in Section 4.4. Section 7 documents the complete secret inventory. |
| Mobile Device Policy | MOB-01 | Section 10 (current technical controls) references TLS enforcement documented in this policy. Gap 3 (localStorage JWT) is also referenced in MOB-01 Section 11.4. |
| Glossary | GLOSS-01 | Terminology reference for Hebrew-English regulatory terms. |

---

**Document ID:** ENC-01 -- Encryption Standards Policy
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
