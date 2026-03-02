# Mobile Device and Remote Access Policy

**Document ID:** MOB-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon platform architecture changes
**Related Documents:** ACPOL-01 (Access Control Policy), ACPOL-02 (Password and Authentication Policy), PERS-01/02/03 (Personnel Security Procedures), RISK-01 (Risk Assessment), SMAP-01 (Architecture Diagram), SMAP-02 (Data Flow Map), SECPR-01/02/03 (Security Procedures)

---

## 1. Purpose

This document defines the mobile device and remote access usage restrictions for the Tenuto.io music conservatory management platform, as required by **Regulation 12** (Takanat 12) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 12 requires that portable device connections to database systems be restricted or denied "in a manner compatible with the information security level applicable to the database, and employing commonly used encryption methods."

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, portable device access restrictions must be defined and periodically reviewed.

This policy focuses on user behavior and browser hygiene because Tenuto.io is a browser-based SaaS platform with no native mobile application, no Mobile Device Management (MDM), and no device enrollment requirements.

---

## 2. Scope

### 2.1 Devices Covered

This policy applies to **all devices** used to access the Tenuto.io platform:

- Smartphones (iOS, Android)
- Tablets (iPad, Android tablets)
- Laptops (personal and organizational)
- Desktop computers (personal and organizational)

### 2.2 Users Covered

This policy applies to **all authorized users** of the Tenuto.io platform:

**Platform personnel:**
- Super administrators (Menahel-Al)
- Developers
- Security Officer

**Tenant personnel:**
- Conservatory administrators (Menahel)
- Teachers (Moreh)
- Conductors (Menatze'akh)
- Ensemble instructors (Madrich Herkev)
- Theory teachers (Moreh Teoria)

### 2.3 Platform Architecture Context

Tenuto.io is a **browser-based SaaS platform**. The following architectural facts define the scope of this policy:

- There is **no native mobile application**. All access is through standard web browsers.
- There is **no MDM (Mobile Device Management)** enrollment. The platform does not install software on user devices.
- There is **no device-level management** capability. The platform cannot enforce settings on user devices.
- There is **no API access from user devices**. API access is server-to-server only (Express API to MongoDB Atlas, AWS S3, SendGrid, Gmail).
- All data in transit is encrypted with TLS 1.2+ (see ENCRYPTION-POLICY.md, ENC-01).
- Authentication is via JWT tokens stored in the browser (see AUTH-POLICY.md, ACPOL-02).

This policy therefore focuses on **user behavior** and **browser hygiene** rather than device-level technical controls.

---

## 3. Permitted Access Methods

### 3.1 Authorized Access

Access to Tenuto.io is permitted **only** through the following web browsers (current versions):

| Browser | Supported | Notes |
|---------|-----------|-------|
| Google Chrome | Yes | Recommended; most tested |
| Mozilla Firefox | Yes | Supported |
| Apple Safari | Yes | Supported (macOS and iOS) |
| Microsoft Edge | Yes | Supported (Chromium-based) |
| Other browsers | Not officially supported | May work but not tested; use at own risk |

Users must keep their browsers updated to the latest stable version to ensure current security patches are applied.

### 3.2 Prohibited Access Methods

- **Do not install any third-party application** claiming to provide Tenuto.io access. No native application exists. Any such application is unauthorized and potentially malicious.
- **Do not access the platform through browser automation tools** (e.g., Selenium, Puppeteer) from personal devices.
- **Do not access the platform API directly** from personal devices using tools like cURL, Postman, or custom scripts. API access from personal devices is not authorized.

---

## 4. Network Security Requirements

### 4.1 Trusted Networks (Required)

Users must access Tenuto.io from trusted networks:

| Network Type | Permitted | Notes |
|-------------|-----------|-------|
| Home network (private Wi-Fi) | Yes | Recommended default for remote work |
| School / conservatory network | Yes | Primary access point for in-person work |
| Cellular data (4G/5G) | Yes | Acceptable alternative to Wi-Fi |
| Organizational VPN | Yes | If available from organization |

### 4.2 Untrusted Networks (Avoid)

| Network Type | Permitted | Guidance |
|-------------|-----------|---------|
| Public Wi-Fi (cafes, restaurants) | Avoid | Use cellular data instead if public Wi-Fi is the only option |
| Airport Wi-Fi | Avoid | Use cellular data |
| Hotel Wi-Fi | Avoid | Use cellular data |
| Library / public computer lab Wi-Fi | Avoid | Use cellular data; do not use public computers (see Section 6) |

### 4.3 Why Network Security Matters

All connections to Tenuto.io use TLS 1.2+ encryption, which protects data in transit even on untrusted networks (enforced by the platform; reference SMAP-01 Section 4). However, public networks increase exposure to:

- Man-in-the-middle attacks that could intercept credentials before TLS is established
- DNS spoofing that could redirect users to fraudulent login pages
- Network-level surveillance of connection metadata (which sites are accessed, when)

These risks are documented as part of the R-04 (JWT compromise) scenario in RISK-ASSESSMENT.md (RISK-01). Using trusted networks reduces these risks.

---

## 5. Device Security Requirements

### 5.1 All Devices

The following requirements apply to any device used to access Tenuto.io:

| Requirement | Details | Rationale |
|------------|---------|-----------|
| Screen lock | **REQUIRED** -- PIN, pattern, biometric (fingerprint/face), or password | Prevents unauthorized access to an active session if the device is left unattended |
| Auto-lock timeout | Maximum **5 minutes** of inactivity before automatic screen lock | Limits exposure window for unattended devices |
| Operating system updates | Must be applied **promptly** (within 7 days of availability for security patches) | Security patches close known vulnerabilities |
| No rooting / jailbreaking | Do **NOT** root (Android) or jailbreak (iOS) devices used to access the platform | Rooting/jailbreaking disables OS-level security controls and increases malware risk |
| Device encryption | Do **NOT** disable device encryption | All modern iOS (since iOS 8) and Android (since Android 6) devices encrypt storage by default; disabling this removes a defense layer |
| Anti-malware | Recommended (not required) for Windows and Android devices | Reduces risk of keyloggers or credential-stealing malware |

### 5.2 Platform Personnel -- Additional Requirements

Platform personnel (developers, super admins, Security Officer) who access infrastructure systems (MongoDB Atlas, Render, AWS, SendGrid) must additionally:

- Follow any organizational device security policy if one exists and is stricter than this policy
- Use a dedicated browser profile or separate browser for infrastructure access
- Enable full-disk encryption on laptops used for development (BitLocker on Windows, FileVault on macOS)
- Infrastructure access (not application access) should be limited to secured development workstations, not mobile devices

---

## 6. Browser Security Requirements

### 6.1 Personal Devices (Primary Use Case)

Most tenant personnel (teachers, admins) access Tenuto.io from personal devices. The following requirements apply:

| Requirement | Details |
|------------|---------|
| Keep browser updated | Use the latest stable version of your browser |
| Log out explicitly | Always click "Log Out" when finished working in the platform; do not rely on session timeout alone |
| Password manager use | Recommended -- use a reputable password manager to generate and store strong, unique passwords |

### 6.2 Shared or Public Devices (Exceptional Case)

If accessing Tenuto.io from a shared device (e.g., a computer shared with family members, a school computer used by multiple staff):

| Requirement | Details |
|------------|---------|
| Use private/incognito mode | Open the platform in a private/incognito browsing window |
| Do **NOT** save credentials | Decline any browser prompt to save your username or password |
| Clear browser data after use | Clear browsing data (cache, cookies, history) after your session |
| Log out explicitly | Always click "Log Out" before closing the browser |

**Public computers** (library, internet cafe, hotel business center): **Do NOT access Tenuto.io from public computers.** The risk of keyloggers, cached credentials, and unauthorized access is too high.

### 6.3 JWT and Session Context

Users should understand that Tenuto.io stores session information (JWT tokens) in the browser's localStorage. Reference: AUTH-POLICY.md (ACPOL-02) Section 3 and R-04 in RISK-ASSESSMENT.md (RISK-01).

- **Clearing browser data removes your session** -- you will need to log in again
- **Logging out clears session tokens** from the browser
- **Access tokens expire after 15 minutes** -- if you leave the platform idle, you may need to re-authenticate (the refresh token extends sessions up to 30 days)
- On shared devices: clearing browser data is the most reliable way to ensure no session information remains

---

## 7. Data Handling Restrictions

### 7.1 Prohibited Actions

The following actions are **prohibited** for all users on all devices:

| Prohibited Action | Rationale |
|------------------|-----------|
| **Do NOT take screenshots** of student personal data (names, grades, personal information, contact details) | Student data is classified RESTRICTED (per DBDF-01); screenshots create uncontrolled copies outside the platform |
| **Do NOT export or download** student data to personal storage (Google Drive, Dropbox, OneDrive, USB drives, local folders) | Downloaded data is outside the platform's security controls |
| **Do NOT forward** student data via personal messaging applications (WhatsApp, Telegram, Signal, personal email) | Messaging applications are not approved for processing minors' personal data |
| **Do NOT copy-paste** student data to external applications (spreadsheets, documents, notes apps) | Creates uncontrolled copies of minors' data |
| **Do NOT photograph screens** displaying student data | Functionally equivalent to screenshots; same restrictions apply |

### 7.2 Permitted Exception

**Authorized data exports** through the platform's built-in export functionality (Ministry of Education report generation via `/api/export`) are permitted. These exports:

- Are restricted to administrator role (per ACPOL-01 Section 11.1)
- Generate standardized ministry reporting formats
- Are logged in `ministry_report_snapshots` (per SMAP-02 Section 3.6)
- Must be handled according to the data handling principles in SECPR-01/02/03 Section 6

### 7.3 Reference

These restrictions are aligned with:
- PERSONNEL-SECURITY.md (PERS-02) Training Topic 5 -- minors' data special handling
- PERSONNEL-SECURITY.md (PERS-02) Training Topic 3 -- data handling principles
- PERSONNEL-SECURITY.md (PERS-03) Confidentiality Agreement -- Obligations Section 2(b)

---

## 8. BYOD Policy (Bring Your Own Device)

### 8.1 Tenant Personnel

Tenant personnel (teachers, administrators, conductors, ensemble instructors, theory teachers) are **expected and permitted** to use personal devices to access Tenuto.io. This reflects the reality of conservatory operations where teachers use personal smartphones, tablets, and laptops.

- No device enrollment or registration is required
- No MDM software installation is required
- No device inventory or asset tracking is required at the platform level
- Users are responsible for maintaining their device security per Section 5
- Users are responsible for following browser security requirements per Section 6
- Users are responsible for following data handling restrictions per Section 7

### 8.2 Platform Personnel

Platform personnel (developers, super admins, Security Officer) may use personal devices for **application access** (logging into the platform as a user or super admin). For **infrastructure access** (MongoDB Atlas admin, Render dashboard, AWS console, SendGrid dashboard):

- Follow the organizational device policy if one exists
- Personal devices are permitted for infrastructure access only if no organizational device policy prohibits it
- Infrastructure access should be performed from a device that meets all requirements in Section 5, including full-disk encryption
- Development and infrastructure access from mobile phones is discouraged -- use laptops or desktops

### 8.3 No Device Inventory Required

At the current platform maturity (pre-launch, zero production tenants), no device inventory or device registration system is required. This policy may be revised if:

- The organization establishes a formal IT asset management program
- A security incident reveals that device-level controls are insufficient
- Regulatory requirements change to mandate device registration for medium-security databases

---

## 9. Lost or Stolen Device Procedure

### 9.1 Immediate Actions (Within 1 Hour)

If a device used to access Tenuto.io is lost or stolen, the user must:

| Step | Action | Who |
|------|--------|-----|
| 1 | **Immediately change your Tenuto.io password** from another device | User |
| 2 | **Report the loss** to your conservatory administrator (tenant personnel) or to the Security Officer (platform personnel) | User |
| 3 | **Remotely wipe browser data** if your device management allows it (e.g., Find My iPhone, Android Device Manager) | User (best effort) |

### 9.2 Administrative Response

Upon receiving a lost/stolen device report:

| Step | Action | Who |
|------|--------|-----|
| 4 | Assess whether the device had saved browser credentials or an active session | Admin / Security Officer |
| 5 | If credentials were saved: increment `tokenVersion` on the user's account to revoke all active tokens | Admin / Security Officer |
| 6 | If the device was used for platform personnel infrastructure access: evaluate need for secret rotation per PERS-01 Section 3.2 Step 3 | Security Officer |
| 7 | If credentials were saved: treat as potential **credential compromise** per INCIDENT-RESPONSE-PLAN.md (INCD-01) severity classification | Security Officer |
| 8 | Document the incident in the security incident log | Security Officer |

### 9.3 Limitations

The platform **cannot remotely wipe data** from user devices. Remote device management (wipe, lock, locate) is the user's responsibility using their device's built-in capabilities (Find My iPhone, Android Device Manager, Windows Find My Device). The platform's only remote capability is token revocation via `tokenVersion` increment, which invalidates all active sessions for the affected user.

---

## 10. Current Technical Controls

This section documents the current state of mobile-specific security controls. Honesty about the current state is essential for compliance.

### 10.1 What IS Enforced

| Control | Mechanism | Applies To | Reference |
|---------|-----------|-----------|-----------|
| TLS 1.2+ on all connections | Render platform TLS termination; MongoDB Atlas TLS requirement; AWS S3 HTTPS | All devices, all browsers | SMAP-01 Section 4; ENC-01 Section 2 |
| JWT with limited access token expiry | Access token: 15 minutes (1 hour per ACPOL-02); Refresh token: 30 days | All devices, all browsers | ACPOL-02 Section 3.1 |
| Token version revocation | `credentials.tokenVersion` counter enables immediate invalidation of all tokens for a user | All devices | ACPOL-02 Section 3.2 |
| Tenant isolation | Five-layer tenant isolation defense prevents cross-tenant data access | All devices | ACPOL-01 Section 5 |
| Role-based access control | `requireAuth()` and `ROLE_PERMISSIONS` restrict operations by role | All devices | ACPOL-01 Section 4 |

### 10.2 What Is NOT Enforced

| Gap | Description | Impact |
|-----|------------|--------|
| No session timeout on inactivity | If a browser tab is left open, the session remains active until the access token expires (15 minutes) or refresh token expires (30 days) | Unattended devices retain valid sessions |
| No device fingerprinting | The platform does not identify or restrict access by device characteristics | Cannot detect unauthorized device use |
| No concurrent session limits | A user can be logged in from unlimited devices simultaneously | Cannot detect or prevent session sharing |
| No ability to remotely terminate specific sessions | Token revocation (`tokenVersion`) terminates ALL sessions, not individual ones | Cannot selectively revoke a lost device's session without affecting all devices |
| No mobile-specific access restrictions | No responsive design restrictions, no mobile-specific rate limits, no geofencing | Mobile and desktop access are treated identically |
| No data-loss prevention for screenshots or copy-paste | Browser APIs do not provide reliable screenshot/copy prevention | Data handling restrictions (Section 7) are behavioral, not technical |

---

## 11. Gap Analysis and Planned Enhancements (v1.6)

Following the three-part pattern: Current State -> Gap -> Planned Remediation.

### 11.1 Session Inactivity Timeout

- **Current state:** No inactivity timeout. Sessions remain active as long as tokens are valid (up to 30 days via refresh).
- **Gap:** A user who walks away from their device without logging out leaves an active session. Combined with no screen lock requirement enforcement, this is a data exposure risk.
- **Planned remediation (v1.6):** Implement client-side inactivity detection that clears tokens after a configurable period of inactivity (recommended: 30 minutes for tenant personnel, 15 minutes for super admins).

### 11.2 Concurrent Session Management

- **Current state:** No concurrent session limits. A single account can maintain unlimited simultaneous sessions across devices.
- **Gap:** Cannot detect if a compromised credential is being used from an unauthorized device while the legitimate user is also logged in.
- **Planned remediation (v1.6):** Implement session tracking that records device characteristics (browser, OS, approximate location) on each login. Provide users and admins visibility into active sessions. Evaluate maximum concurrent session limits per role.

### 11.3 Selective Session Termination

- **Current state:** Token revocation via `tokenVersion` increment terminates ALL sessions for a user across ALL devices.
- **Gap:** Cannot revoke access from a single lost device without disrupting the user's sessions on other devices.
- **Planned remediation (v1.6):** Implement per-device session tracking with the ability to revoke individual sessions. This requires moving from stateless JWT to a session store or implementing a token blocklist.

### 11.4 Token Storage Security

- **Current state:** JWT tokens stored in browser `localStorage`, accessible to any JavaScript running on the same origin.
- **Gap:** An XSS vulnerability would allow an attacker to exfiltrate access tokens from any device (desktop or mobile). This is documented as R-04 in RISK-ASSESSMENT.md (RISK-01).
- **Planned remediation (v1.6):** Evaluate migrating access tokens to `httpOnly` secure cookies to prevent JavaScript access. Refresh tokens already use `httpOnly` cookies.

---

## 12. Review Schedule

### 12.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Currency of Section 10 (current technical controls) against actual platform capabilities
- Effectiveness of Section 7 (data handling restrictions) -- any incidents of data copying or screenshots reported?
- Status of Section 11 (v1.6 planned enhancements) -- which gaps have been closed?
- Relevance of browser support list (Section 3.1) -- any browser end-of-life or new browser to add?

### 12.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| Native mobile application developed | Full document rewrite -- would require MDM, app security, and device enrollment considerations |
| Security incident involving a mobile device | Sections 5, 6, 7, and 9 |
| Platform architecture change (e.g., new authentication method) | Section 10 (current controls) and Section 11 (gap analysis) |
| New device category or access method introduced | Sections 2, 3, and 5 |
| Lost/stolen device incident | Section 9 procedure effectiveness review |
| v1.6 implementation of session management features | Update Sections 10 and 11 to reflect new current state |

---

## 13. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Access Control Policy | ACPOL-01 | Defines roles and permissions; tenant isolation defense (Section 5) provides the foundation for safe mobile access |
| Password and Authentication Policy | ACPOL-02 | JWT token architecture (Section 3), session management (Section 6), token revocation mechanism used in lost device procedure |
| Personnel Security | PERS-01/02/03 | PERS-02 Training Topic 6 (device and access security) provides awareness training aligned with this policy. PERS-02 Topic 5 (minors' data handling) aligns with Section 7 data handling restrictions |
| Risk Assessment | RISK-01 | R-04 (JWT secret compromise) and R-05 (default password) are relevant to mobile access security; Section 4 network security references R-04 |
| Architecture Diagram | SMAP-01 | Section 4 security boundary annotations confirm TLS enforcement on all connections referenced in Section 10 |
| Data Flow Map | SMAP-02 | Data flow paths confirm that all personal data passes through TLS-encrypted connections |
| Security Procedures | SECPR-01/02/03 | Section 6 data handling rules by classification tier inform data handling restrictions in Section 7 |
| Encryption Policy | ENC-01 | Defines TLS and encryption standards referenced in Sections 4 and 10 |
| Glossary | GLOSS-01 | Terminology reference for Hebrew-English regulatory terms |

---

**Document ID:** MOB-01 -- Mobile Device and Remote Access Policy
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
