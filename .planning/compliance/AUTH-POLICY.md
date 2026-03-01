# Password and Authentication Policy

**Document ID:** ACPOL-02
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon authentication system changes
**Related Documents:** SECOFF-01/02 (Security Officer), SECPR-01/02/03 (Security Procedures), RISK-01 (Risk Assessment, specifically R-04 and R-05), ACPOL-01 (Access Control Policy), GLOSS-01 (Glossary)

---

## 1. Purpose

This document defines the authentication controls for all Tenuto.io platform users, as required by **Regulations 13-14** (Takkanot 13-14) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017. It covers password management, token-based authentication, and session controls.

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, authentication procedures must be documented and periodically reviewed.

Each section follows the **Current State / Gap / Planned Remediation (v1.6)** pattern to honestly document the current authentication posture and planned improvements.

---

## 2. Password Policy

### 2.1 Password Controls Assessment

| Area | Current Control | Gap | Planned v1.6 Hardening |
|------|----------------|-----|----------------------|
| Hashing algorithm | bcrypt with 10 salt rounds (`api/auth/auth.service.js`) | None -- adequate for current security level | No change needed; monitor bcrypt cost recommendations |
| Default passwords | `"123456"` auto-set for teacher accounts created without a password (via admin dashboard or bulk import) | **CRITICAL -- R-05 from RISK-01.** "123456" is the world's most common password. Accounts are trivially accessible until password is changed. | Remove default password assignment entirely; implement invitation flow with one-time secure setup token |
| Minimum length | No server-side enforcement | No minimum password length required | Enforce 8+ characters minimum |
| Complexity rules | No server-side enforcement | No complexity requirements (uppercase, lowercase, numbers, symbols) | Require mixed case + at least one number minimum |
| Password history | Not tracked | Users can reuse their previous password immediately after changing it | Track last 5 password hashes; prevent reuse |
| Password expiry | No expiry policy | Passwords never expire regardless of age | Evaluate 12-month expiry for admin roles; assess general expiry vs. breach-based rotation |
| Forced change flag | `credentials.requiresPasswordChange` flag exists on teacher documents | Only used for initial setup (default password accounts); enforcement depends on frontend cooperation -- backend does not block API access when flag is true | Extend to post-breach forced change; add server-side enforcement that blocks non-password-change API requests when flag is true |
| Password reset | Reset token mechanism exists (`credentials.resetToken`, `credentials.resetTokenExpiry`) | Reset token expiry duration not verified; no rate limiting on reset requests | Verify token expiry (recommended: 1 hour); add rate limiting on reset endpoint |

### 2.2 Default Password Vulnerability (R-05)

**This is the most significant authentication gap identified in the risk assessment.**

**Current behavior:** In `auth.service.js`, when a teacher account is created without a password (common path for admin-created accounts and all bulk-imported accounts), the system automatically sets the password to `"123456"` (bcrypt-hashed). The `requiresPasswordChange` flag is set to `true`.

**Risk scenario:**
1. Admin imports 50 teachers via Excel upload
2. All 50 accounts receive the default password `"123456"`
3. The `requiresPasswordChange` flag is set but enforcement depends on frontend behavior
4. If a teacher navigates directly to the API or the frontend does not enforce the change, the account is accessible with a universally known password
5. The attacker gains access to the teacher's assigned students' data (minors' PII)

**v1.6 Remediation plan:**
1. Remove automatic default password assignment from `auth.service.js`
2. Require all new accounts to go through the invitation email flow (email with secure token link)
3. Add server-side enforcement: when `requiresPasswordChange` is `true`, the API should reject all non-password-change requests with a 403 status
4. Add monitoring for accounts that retain unchanged default passwords beyond 7 days
5. Implement admin notification for accounts with outstanding password changes

---

## 3. Token Management

### 3.1 JWT Architecture

The platform uses JSON Web Tokens (JWT) for stateless authentication. Two token types are used:

| Token Type | Purpose | Expiry | Signing | Claims | Storage |
|-----------|---------|--------|---------|--------|---------|
| Access token | API request authentication | 1 hour | HS256 (symmetric HMAC-SHA256) | `userId`, `tenantId`, `role`, `email` | `localStorage` on frontend |
| Refresh token | Obtain new access tokens | 30 days | HS256 (symmetric HMAC-SHA256) | `userId`, `tenantId`, `tokenVersion` | `localStorage` on frontend; stored in `teacher.credentials.refreshToken` |

**Super admin tokens** contain an additional `type: 'super_admin'` claim and are validated by the separate `super-admin.middleware.js` middleware.

**Impersonation tokens** contain an `isImpersonation: true` claim and are scoped to the target tenant. They are generated when a super admin initiates impersonation and function as standard tenant-scoped JWTs.

### 3.2 Token Revocation

Token revocation is implemented via a `tokenVersion` counter on teacher credentials:

1. Each teacher document has a `credentials.tokenVersion` integer field
2. When a token is generated, the current `tokenVersion` is embedded as a claim
3. On each request, `auth.middleware.js` (lines 51-58) compares the token's `tokenVersion` against the current value in the database
4. Incrementing `tokenVersion` immediately invalidates ALL existing tokens for that user
5. This provides a "logout all devices" capability and incident response mechanism

### 3.3 Token Security Assessment

| Aspect | Current State | Risk Level | Reference | v1.6 Plan |
|--------|--------------|-----------|-----------|-----------|
| Signing algorithm | HS256 symmetric -- same secret used for signing and verification | MEDIUM (R-04 in RISK-01) | `api/auth/auth.service.js` | Evaluate RS256 asymmetric signing to separate signing and verification keys |
| Key rotation | No rotation mechanism -- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` are static environment variables on Render | HIGH | Render environment variables | Implement scheduled key rotation with dual-key validation during rotation window |
| Token storage (frontend) | `localStorage` -- accessible to any JavaScript running on the page | MEDIUM (XSS vector) | Frontend `AuthContext` | Evaluate migration to `httpOnly` secure cookies to prevent XSS token theft |
| Token binding | None -- tokens are valid from any IP/device/browser | LOW | -- | Evaluate device fingerprint or IP binding for high-privilege tokens |
| Refresh token scope | 30-day validity with no rotation on use | MEDIUM | `api/auth/auth.service.js` | Implement refresh token rotation (new refresh token issued on each refresh) to limit window of stolen refresh token exploitation |
| Secret isolation | Secrets stored in Render environment variables, not in code or version control | ADEQUATE | Render platform | Maintain current isolation; add key rotation |

### 3.4 Token Lifecycle

```
1. Login:  POST /api/auth/login
           -> Validates credentials (bcrypt compare)
           -> Checks tenant active status
           -> Checks tokenVersion
           -> Generates access token (1h) + refresh token (30d)
           -> Stores refresh token in teacher.credentials.refreshToken
           -> Returns both tokens to client

2. Request: Any authenticated API call
            -> auth.middleware.js extracts token from Authorization header
            -> Validates JWT signature and expiry
            -> Checks tokenVersion against database value
            -> Attaches user context to request

3. Refresh: POST /api/auth/refresh
            -> Validates refresh token signature and expiry
            -> Checks tokenVersion
            -> Generates new access token (1h)
            -> Returns new access token

4. Logout:  POST /api/auth/logout
            -> Clears refresh token from teacher.credentials
            -> Client removes tokens from localStorage

5. Force logout (all devices):
            -> Increment tokenVersion on teacher document
            -> All existing tokens immediately invalid
```

---

## 4. Account Lockout Policy

### 4.1 Current State

**NOT IMPLEMENTED.** There is no account lockout mechanism. An attacker can make unlimited login attempts against any account without restriction, delay, or notification.

### 4.2 Gap Analysis

The absence of account lockout is a significant gap for a platform processing minors' data. Combined with the default password vulnerability (R-05), this means an attacker could systematically try `"123456"` against every teacher email address in a tenant without being blocked.

### 4.3 Recommended Policy (v1.6)

| Threshold | Action |
|-----------|--------|
| 5 consecutive failed login attempts | Lock account for 1 minute; log event to `security_log` |
| 8 consecutive failed login attempts | Lock account for 5 minutes; log event to `security_log` |
| 10 consecutive failed login attempts | Lock account for 30 minutes; log event to `security_log`; notify tenant admin via platform notification |
| Admin unlock | Tenant admin can unlock any locked account in their tenant via admin tools |
| Auto-reset | Failed attempt counter resets after successful login |

Implementation considerations:
- Store lockout state in `teacher.credentials` (e.g., `failedLoginAttempts`, `lockoutUntil`)
- Check lockout state before password comparison to prevent timing attacks
- Log all lockout events to `security_log` with IP address and user agent
- Super admin accounts should have stricter thresholds (3 attempts before lockout)

---

## 5. Multi-Factor Authentication

### 5.1 Current State

**NOT IMPLEMENTED** for any role. All accounts authenticate solely with email + password.

### 5.2 Recommended Policy (v1.6)

| Role | MFA Requirement | Method |
|------|----------------|--------|
| Super Admin (סופר-אדמין) | **Mandatory** | TOTP-based (authenticator app such as Google Authenticator, Authy) |
| Tenant Admin (מנהל) | **Recommended** (opt-in initially, mandatory in v1.7) | TOTP-based |
| All other tenant roles | **Optional** (opt-in) | TOTP-based |

Implementation considerations:
- TOTP (Time-based One-Time Password) per RFC 6238 -- no dependency on SMS infrastructure
- Store TOTP secret in a dedicated field (not in the main credentials object) -- encrypted at rest
- Provide recovery codes (one-time use) during MFA enrollment
- Allow tenant admins to enforce MFA for all users in their tenant
- MFA bypass for the super admin seed endpoint should be gated by environment (development only)

---

## 6. Session Management

### 6.1 Current State

The platform uses **stateless JWT-based sessions**. There is no server-side session store. Session state is entirely represented by the JWT tokens held by the client.

| Aspect | Current Implementation |
|--------|---------------------|
| Session initiation | Login endpoint returns JWT access + refresh tokens |
| Session validation | Each request validates JWT signature, expiry, and tokenVersion |
| Session timeout | Implicit via 1-hour access token expiry; 30-day refresh extends session |
| Concurrent sessions | No limit -- same account can be authenticated from unlimited devices simultaneously |
| Session termination | Logout clears refresh token; force-logout via tokenVersion increment |
| Activity tracking | `credentials.lastLogin` updated on login; no ongoing activity tracking |

### 6.2 Gap Analysis

| Gap | Description | Impact |
|-----|------------|--------|
| No concurrent session limits | A compromised account can be used from multiple locations simultaneously without detection | An attacker could maintain a session while the legitimate user is also logged in, making detection difficult |
| No "active sessions" view | Users cannot see where they are logged in or revoke specific sessions | Users cannot self-detect unauthorized sessions |
| No session activity tracking | Only `lastLogin` is tracked; no ongoing session activity events logged | Cannot determine when a session was last active or what it accessed |
| No idle timeout | A browser tab left open retains valid tokens until natural expiry | Unattended workstations remain authenticated |
| Token refresh extends indefinitely | As long as refresh is called within 30 days, the session persists indefinitely | Long-lived sessions increase exposure window |

### 6.3 v1.6 Plan

- Evaluate adding session metadata to `security_log` (login IP, user agent, last activity timestamp)
- Consider implementing a maximum session lifetime (e.g., 7 days even with refresh, requiring re-authentication)
- Evaluate refresh token rotation (issue new refresh token on each use, invalidating the previous)
- Add "active sessions" API endpoint for user self-service session management

---

## 7. Super Admin Authentication

### 7.1 Separate Authentication Flow

Super admin accounts are completely isolated from tenant user accounts:

| Aspect | Detail |
|--------|--------|
| Data store | `super_admin` collection (not `teacher`) |
| Login endpoint | `POST /api/super-admin/login` |
| Middleware | `super-admin.middleware.js` validates `type: 'super_admin'` JWT claim |
| Token | Contains `type: 'super_admin'` claim; validated against `super_admin` collection |
| Seed mechanism | Initial super admin created via seed endpoint |

### 7.2 Super Admin Seed Endpoint

**Current concern:** The super admin seed endpoint allows creation of a super admin account. This endpoint currently has no rate limiting or environment guard, meaning it could potentially be called in production.

**Gap:** R-04 related -- if the seed endpoint is accessible in production, an attacker could potentially create a super admin account.

**v1.6 Remediation:** Gate the seed endpoint behind an environment check (e.g., `NODE_ENV !== 'production'`); add rate limiting; add IP allowlisting.

---

## 8. Known Authentication Risks

### 8.1 R-04: JWT Secret Compromise

**Source:** RISK-ASSESSMENT.md (RISK-01)

| Aspect | Detail |
|--------|--------|
| **Threat** | The `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET` environment variables are leaked or compromised, allowing forging of valid JWTs for any user on any tenant |
| **Current mitigation** | Secrets stored in Render environment variables (not in code); separate secrets for access and refresh tokens; tokenVersion counter for per-user revocation; 1-hour access token expiry limits exposure window |
| **Residual risk** | No key rotation mechanism. If compromised, all tokens are forgeable until secrets are manually changed. Manual rotation requires Render dashboard access and application restart |
| **v1.6 plan** | Implement periodic secret rotation; add dual-key validation during rotation window; evaluate RS256 asymmetric signing |

### 8.2 R-05: Default Password Exploitation

**Source:** RISK-ASSESSMENT.md (RISK-01)

| Aspect | Detail |
|--------|--------|
| **Threat** | Default password `"123456"` trivially accessible for accounts created without explicit password. Combined with no account lockout, enables systematic credential stuffing |
| **Current mitigation** | `requiresPasswordChange` flag set to `true` on default-password accounts; bcrypt hashing (literal `"123456"` is not stored) |
| **Residual risk** | **CRITICAL gap.** Frontend enforcement is not guaranteed. Backend does not block API access when `requiresPasswordChange` is true. Bulk import can create many vulnerable accounts simultaneously |
| **v1.6 plan** | Remove default password entirely; require invitation flow for all new accounts; server-side enforcement of password change requirement |

---

## 9. Authentication Event Logging

### 9.1 Current State

**Authentication events are NOT systematically logged.** The following events occur without any security log entry:

- Successful logins
- Failed login attempts (including with reason: wrong password, account not found, tenant deactivated)
- Token refresh operations
- Password changes
- Password reset requests
- Logout events
- Account lockout events (no lockout mechanism exists)

The `credentials.lastLogin` field is updated on successful login, but this is a single overwritten timestamp -- it does not provide a history of login events.

### 9.2 Gap

This is a significant component of R-08 (Insufficient Logging for Compliance) from RISK-ASSESSMENT.md. Without authentication event logging:

- Cannot detect brute-force login attempts
- Cannot investigate unauthorized access incidents
- Cannot demonstrate authentication monitoring for compliance
- Cannot identify compromised accounts based on unusual login patterns (new IP, new location, unusual time)

### 9.3 v1.6 Plan

Implement structured authentication event logging to `security_log` collection with the following event types:

| Event Type | Trigger | Fields Logged |
|-----------|---------|---------------|
| `auth.login_success` | Successful login | userId, tenantId, email, IP, userAgent, timestamp |
| `auth.login_failure` | Failed login attempt | email (attempted), reason (wrong_password/not_found/tenant_deactivated/locked), IP, userAgent, timestamp |
| `auth.token_refresh` | Token refresh | userId, tenantId, IP, timestamp |
| `auth.logout` | Explicit logout | userId, tenantId, IP, timestamp |
| `auth.password_change` | Password changed | userId, tenantId, changedBy (self or admin), timestamp |
| `auth.password_reset_request` | Reset request initiated | email, IP, timestamp |
| `auth.password_reset_complete` | Reset completed | userId, tenantId, timestamp |
| `auth.force_logout` | tokenVersion incremented | userId, tenantId, triggeredBy, timestamp |
| `auth.account_lockout` | Lockout threshold reached | email, IP, failedAttempts, lockoutDuration, timestamp |

See ACCESS-LOGGING-POLICY.md (ACPOL-03) for comprehensive logging requirements across all event categories.

---

## 10. Review Schedule

### 10.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The review must cover:

- Accuracy of password policy against current `auth.service.js` implementation
- Token expiry and signing configuration against current deployment
- Status of all v1.6 remediation items
- Alignment with current RISK-01 risk scores (R-04, R-05)

### 10.2 Triggered Review

An immediate review is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| Authentication-related security incident | Full document review |
| JWT library update or migration | Token management section |
| Change to password policy or hashing | Password policy section |
| Change to token expiry or signing configuration | Token management section |
| Implementation of MFA or account lockout | Respective sections update |
| Deployment of v1.6 authentication hardening | Full document review to update current state |

---

## 11. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Security Officer | SECOFF-01/02 | Document owner; approves authentication policy changes |
| Security Procedures | SECPR-01/02/03 | Parent procedure document; this policy implements SECPR-01a authentication controls |
| Risk Assessment | RISK-01 | Source for R-04 (JWT compromise) and R-05 (default password) risks |
| Access Control Policy | ACPOL-01 | Companion policy covering role-based access; relies on authentication for identity verification |
| Access Logging Policy | ACPOL-03 | Companion policy covering authentication event logging requirements |
| Glossary | GLOSS-01 | Terminology reference for regulatory terms |

---

**Document ID:** ACPOL-02 -- Password and Authentication Policy
**Phase:** 28 -- Governance Framework and Security Policies
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
