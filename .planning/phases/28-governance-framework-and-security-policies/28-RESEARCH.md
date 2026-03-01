# Phase 28: Governance Framework and Security Policies - Research

**Researched:** 2026-03-02
**Domain:** Israeli Privacy Compliance -- Governance Documents and Security Policies
**Confidence:** HIGH

---

## Summary

Phase 28 creates the governance framework and formal security policies required by the Israeli Privacy Protection Regulations (Information Security), 5777-2017. All deliverables are compliance documents (markdown files stored in `.planning/compliance/`). No code changes. This phase depends heavily on the Phase 27 outputs: 9 compliance documents covering data inventory, system architecture, data flows, risk assessment, vendor inventory, and minors' data analysis.

The phase covers 8 requirements grouped into three categories: Security Officer appointment (SECOFF-01, SECOFF-02), Security Procedure Document creation (SECPR-01, SECPR-02, SECPR-03), and Access Control Policies (ACPOL-01, ACPOL-02, ACPOL-03). Each document must reference the Phase 27 foundation and describe the platform's current technical state accurately -- documenting what exists today and identifying gaps for v1.6 Technical Hardening.

The key insight for planning is that these documents are interconnected: the Security Officer appointment document establishes WHO is responsible, the Security Procedure Document establishes WHAT the rules are, and the Access Control Policies document HOW those rules are enforced technically. The natural dependency order is: Security Officer first (all other documents reference this role), then the overarching Security Procedure Document, then the three specific access control policies.

**Primary recommendation:** Produce 5-6 compliance documents following the same format established in Phase 27 (document ID, version, date, classification header; numbered sections; cross-references to Phase 27 documents). The Security Officer role definition should be the first document created since all others reference it as the document owner.

---

## Regulatory Framework

### Israeli Privacy Protection Regulations (Information Security), 5777-2017

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit). For medium-level databases, the following regulations apply (Regulations 1-4, 5(a)(b)(e), 6-15, 16(a)(b)(c)(e), 17, 18(a), 19, 20).

**Confidence: MEDIUM** -- Regulation number-to-requirement mappings are based on multiple secondary sources. The official English translation PDF from gov.il is available but could not be parsed programmatically. The Hebrew original is the only legally binding text.

### Key Regulations for Phase 28

| Regulation | Subject | Phase 28 Deliverable |
|-----------|---------|---------------------|
| Reg. 3 | Security Officer appointment | SECOFF-01, SECOFF-02 |
| Reg. 4 | Security Procedure Document | SECPR-01, SECPR-02, SECPR-03 |
| Reg. 8-9 | Access control and authorization | ACPOL-01 |
| Reg. 12 | Access logging | ACPOL-03 |
| Reg. 13-14 | Authentication controls | ACPOL-02 |

### Security Officer Requirements (Reg. 3)

Per the regulations, the Security Officer (Memuneh Al Avtachat Meida):
- Must report to a senior manager (not subordinate to IT)
- Must prepare a security policy
- Must develop and implement a continuous monitoring plan
- Must report findings to management
- Must be provided with necessary resources
- Must avoid conflicts of interest
- Appointment must be documented

**Confidence: HIGH** -- Multiple authoritative sources (ICLG, Legal500, DLA Piper, IAPP) agree on these requirements.

### Security Procedure Document Requirements (Reg. 4)

The Security Procedure Document (Nohal Avtachat Meida) must:
- Be a written policy for protecting personal data
- Address risk management
- Cover access management and authorization
- Cover authentication procedures
- Cover backup and recovery
- Cover data handling, retention, and deletion
- Be reviewed periodically

**Confidence: MEDIUM** -- Sources agree on the general scope but granular sub-requirements are not fully enumerated in available English translations. The scope described in the phase requirements (SECPR-01 through SECPR-03) aligns with what multiple sources describe.

### Access Control Requirements (Reg. 8-9, 12-14)

For medium-security databases:
- Detailed access control policies must be defined
- Access controls must be reviewed periodically
- Authentication procedures must be documented
- Access logs must be maintained (automatic documentation mechanisms)
- Incident documentation and reporting for severe security incidents

**Confidence: MEDIUM** -- Specific technical requirements at the regulation level are not fully available in English translations, but the general obligations are well-established across multiple legal references.

---

## Phase 27 Foundation (Prerequisites)

Phase 28 documents MUST reference and build upon these Phase 27 outputs:

| Document | ID | Phase 28 Uses It For |
|----------|----|--------------------|
| DATA-INVENTORY.md | DBDF-01 | Access control policy references data classifications |
| DATA-PURPOSES.md | DBDF-02 | Security procedures reference lawful basis and retention gaps |
| MINORS-DATA.md | DBDF-03 | All policies include minors' data handling requirements |
| DATA-MINIMIZATION.md | DBDF-04 | Security procedures reference the annual review process |
| ARCHITECTURE-DIAGRAM.md | SMAP-01 | Security procedures reference system components |
| DATA-FLOW-MAP.md | SMAP-02 | Security procedures reference data flow paths |
| VENDOR-INVENTORY.md | SMAP-03 | Security procedures reference third-party handling |
| RISK-ASSESSMENT.md | RISK-01 | All documents reference identified risks |
| GLOSSARY.md | GLOSS-01 | All documents use consistent regulatory terminology |

### Key Facts from Phase 27

These facts constrain what Phase 28 documents must describe:

- **22 MongoDB collections** (14 tenant-scoped, 8 platform-level)
- **5 third-party vendors**: MongoDB Atlas, Render, AWS S3, SendGrid, Gmail -- all with "NEEDS VERIFICATION" DPA status
- **12 identified risks**: 6 HIGH, 5 MEDIUM, 1 LOW, 0 CRITICAL
- **11 collections flagged NEEDS RETENTION POLICY** (all PII-containing collections)
- **5 minors' data handling gaps** (consent, access logging, age verification, snapshot retention, API minimization)
- **Cross-border data transfer** to US via SendGrid requires DPA verification
- **Default password "123456"** auto-set is a documented critical finding
- **No TTL indexes** on any collection -- no automated retention enforcement

---

## Current Technical State (What Documents Must Describe)

### Authentication Architecture

| Control | Implementation | Where in Code |
|---------|---------------|---------------|
| JWT access tokens | 1-hour expiry, HS256 signing | `auth.middleware.js`, `api/auth/auth.service.js` |
| JWT refresh tokens | 30-day expiry | `api/auth/auth.service.js` |
| Password hashing | bcrypt with 10 salt rounds | `api/auth/auth.service.js` |
| Token revocation | `tokenVersion` counter on teacher credentials | `auth.middleware.js:51-58` |
| Tenant deactivation check | Blocks requests from deactivated tenants | `auth.middleware.js:61-76` |
| Password change enforcement | `requiresPasswordChange` flag + `checkPasswordChangeRequired` middleware | `auth.middleware.js:175-223` |
| Super admin separate auth | `type: 'super_admin'` JWT claim, separate middleware | `super-admin.middleware.js` |

### Role-Based Access Control (8 Application Roles)

**Tenant-Level Roles (stored in `teacher.roles[]`):**

| Role (Hebrew) | Role (English) | Permissions Summary |
|--------------|----------------|-------------------|
| **מנהל** | Admin | Full access within tenant -- all CRUD on all resources |
| **סגן מנהל** | Deputy Admin | Not explicitly defined in ROLE_PERMISSIONS -- falls back to role-specific requireAuth checks |
| **ראש מגמה** | Department Head | Not explicitly defined in ROLE_PERMISSIONS -- may use teacher permissions |
| **מורה** | Teacher | Own profile read/update, assigned students read/update, own schedule, rehearsal read, theory read |
| **מנצח** | Conductor | Own profile, orchestra read/conduct/update, student read, rehearsal CRUD, schedule CRUD |
| **מלווה** | Accompanist | Not explicitly defined as separate role in ROLE_PERMISSIONS |
| **מורה-מלווה** | Teacher-Accompanist | Not explicitly defined as separate role in ROLE_PERMISSIONS |
| **אורח** | Guest | Not explicitly defined in ROLE_PERMISSIONS |

**Platform-Level Role:**

| Role | Permissions |
|------|-----------|
| **סופר-אדמין** (Super Admin) | Tenant CRUD, platform reporting, impersonation, user management -- stored in separate `super_admin` collection |

**Note for Access Control Policy:** The `permissionService.js` ROLE_PERMISSIONS map only defines 5 roles (מנהל, מורה, מנצח, מדריך הרכב, מורה תאוריה). The other 3 declared roles (סגן מנהל, ראש מגמה, מלווה/מורה-מלווה, אורח) are handled via `requireAuth()` checks in route files but have no explicit RBAC permission mapping. The access control policy document must accurately reflect this gap -- documenting both the formal RBAC definitions AND the route-level auth patterns.

### Tenant Isolation Controls

| Layer | Control | Code |
|-------|---------|------|
| 1 | `enforceTenant` middleware | `tenant.middleware.js:117-132` |
| 2 | `buildContext` adds tenantId to req.context | `tenant.middleware.js:24-77` |
| 3 | `stripTenantId` prevents client-side override | `tenant.middleware.js:85-110` |
| 4 | `buildScopedFilter` injects tenantId into all queries | `utils/queryScoping.js:12-30` |
| 5 | `requireTenantId` guard in service layer | `tenant.middleware.js:11-16` |

### Current Audit Logging

| What Is Logged | Where | Scope |
|---------------|-------|-------|
| Super admin actions (impersonation, tenant management) | `platform_audit_log` collection | Platform-wide |
| Cascade deletion events | `deletion_audit` collection | Per-tenant |
| Security events | `security_log` collection | Per-tenant (limited usage) |
| Impersonated mutating actions | `platform_audit_log` collection | Per impersonation session |
| Application-level logs | Pino logger (stdout) | Not structured for compliance |

**Not Currently Logged (Gap):**
- Tenant-level admin data access (who viewed/edited student records)
- Teacher data access events (who accessed which students)
- Authentication events (login success/failure with IP, browser, timestamp)
- Password change events
- Role/permission changes
- Data export events
- Import operations (beyond import_log metadata)

### Backup and Recovery

| Mechanism | Implementation |
|-----------|---------------|
| MongoDB Atlas automated backups | Managed by Atlas (verify configuration) |
| Deletion snapshots | `deletion_snapshots` collection -- no TTL |
| Tenant purge snapshots | `tenant_deletion_snapshots` -- no TTL |
| Migration backups | `migration_backups` -- no TTL |
| Soft deletion | `isActive: false` on core entities |
| Cascade deletion with recovery | Complete document snapshots before delete |

---

## Architecture Patterns

### Recommended Document Structure

```
.planning/compliance/
  SECURITY-OFFICER.md         -- SECOFF-01 + SECOFF-02
  SECURITY-PROCEDURES.md      -- SECPR-01 + SECPR-02 + SECPR-03
  ACCESS-CONTROL-POLICY.md    -- ACPOL-01
  AUTH-POLICY.md              -- ACPOL-02
  ACCESS-LOGGING-POLICY.md    -- ACPOL-03
```

**Rationale for grouping:**
- SECOFF-01 (role definition) and SECOFF-02 (appointment) are two sections of one document. They cannot exist independently.
- SECPR-01, SECPR-02, SECPR-03 are three sections of the Security Procedure Document. The regulation requires a single comprehensive document, not three separate ones.
- ACPOL-01, ACPOL-02, ACPOL-03 are three distinct policy areas and should be separate documents for clarity and independent review cycles.

### Document Format Pattern (from Phase 27)

Every compliance document follows this structure:

```markdown
# [Document Title]

**Document ID:** [ID]
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (named in SECOFF-02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon [trigger condition]
**Related Documents:** [cross-references to other compliance docs]

---

## 1. Purpose
[Why this document exists, what regulation it satisfies]

## 2. Scope
[What systems, data, users it covers]

## 3-N. [Content sections]
[Actual policy/procedure content]

## N+1. Review Schedule
[When and how the document is reviewed]

---

*Document: [ID] -- [Title]*
*Phase: 28-governance-framework-and-security-policies*
*Created: 2026-03-02*
```

### Pattern: Current State + Gap + v1.6 Remediation

Each policy section should follow this three-part structure:

1. **Current State** -- What controls exist today (referencing actual code)
2. **Gap Analysis** -- Where the current state does not meet the regulatory requirement or best practice
3. **Planned Remediation** -- What will be addressed in v1.6 Technical Hardening

This pattern is critical because v1.5 is documentation-only. The documents must honestly describe the current state, not an aspirational state.

### Anti-Patterns to Avoid

- **Aspirational documentation:** Writing policies as if controls already exist when they do not. Each document must clearly distinguish "current controls" from "planned controls."
- **Copy-paste regulatory text:** Regulations should be referenced, not copied verbatim. The policy documents should describe the platform-specific implementation.
- **Orphaned documents:** Every document must cross-reference related Phase 27 and Phase 28 documents. No document should stand alone without context links.
- **Generic security boilerplate:** Policies must reference the actual Tenuto.io implementation (specific collection names, middleware names, code paths).
- **Vague role descriptions:** The Security Officer role must have specific, actionable responsibilities -- not generic "ensure security" statements.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Regulatory text interpretation | Custom legal analysis | Phase 27 risk assessment findings + established regulatory guides | Regulatory interpretation requires legal expertise; documents should reference identified risks, not reinterpret law |
| Access control matrix | Abstract RBAC from scratch | Actual ROLE_PERMISSIONS map from permissionService.js | The policy must document the real system, not an idealized one |
| Risk identification | New risk assessment | Phase 27 RISK-ASSESSMENT.md (12 identified risks) | Risks are already formally assessed; Phase 28 policies reference them, not re-derive them |
| Security terminology | Custom glossary | Phase 27 GLOSSARY.md | 30+ terms already mapped Hebrew-English |

**Key insight:** Phase 28 documents describe and formalize what was inventoried in Phase 27. They should not re-discover facts about the system -- they should reference Phase 27 findings and build governance structures on top of them.

---

## Common Pitfalls

### Pitfall 1: Documenting Aspirational State Instead of Current State
**What goes wrong:** Policy documents describe controls that do not yet exist (e.g., "all access is logged" when access logging is minimal).
**Why it happens:** Natural tendency to write what "should" be rather than what "is," especially when the gap is embarrassing.
**How to avoid:** Every policy section uses the "Current State / Gap / Planned Remediation" three-part pattern. Gaps are explicitly flagged with a reference to v1.6.
**Warning signs:** Statements without code/system references. Passive voice hiding the absence of controls.

### Pitfall 2: Security Officer Role Without Actionable Responsibilities
**What goes wrong:** The Security Officer role is defined with vague responsibilities like "ensure information security" without specific, measurable tasks.
**Why it happens:** Regulatory text uses general language; the tendency is to restate it.
**How to avoid:** Map each responsibility to a specific action: "Review the risk register quarterly" not "manage security risks." Include frequency, deliverables, and escalation paths.
**Warning signs:** Responsibilities that cannot be verified as complete/incomplete.

### Pitfall 3: Access Control Policy Not Matching Actual Code
**What goes wrong:** The access control policy describes a clean RBAC model with all 8 roles neatly defined, but the actual code only has 5 roles in ROLE_PERMISSIONS and the others handled ad-hoc.
**Why it happens:** Desire for a clean narrative versus messy implementation reality.
**How to avoid:** Document both the formal RBAC (permissionService.js) AND the route-level requireAuth patterns. Flag the discrepancy as a gap.
**Warning signs:** Role descriptions that sound identical. Roles listed without specific permission differences.

### Pitfall 4: Logging Policy Without Retention or Review Mechanism
**What goes wrong:** The logging policy defines what events to log but not how long to retain logs, who reviews them, or what triggers a review.
**Why it happens:** Logging feels like a purely technical problem; the governance aspects (retention, review schedule) are forgotten.
**How to avoid:** Every logging category must specify: what events, where stored, retention period, review frequency, reviewer role.
**Warning signs:** "Logs are kept" without time limits. No mention of who reads the logs.

### Pitfall 5: Password Policy Ignoring Known Weaknesses
**What goes wrong:** The authentication policy documents bcrypt and JWT but omits the known "123456" default password vulnerability.
**Why it happens:** Reluctance to document known security weaknesses in a formal policy document.
**How to avoid:** The authentication policy MUST reference R-05 (Default Password Exploitation) from RISK-ASSESSMENT.md and document the planned v1.6 remediation. Honest documentation is a regulatory requirement.
**Warning signs:** Only positive controls documented. No "known gaps" section.

---

## Detailed Requirements Mapping

### SECOFF-01: Security Officer Role Definition

**What to document:**
- Role title: Memuneh Al Avtachat Meida (Security Officer)
- Reporting line: Reports to [senior manager / CEO / CTO]
- Independence: Cannot be subordinate to IT operations
- Specific responsibilities:
  - Own and maintain the risk register (RISK-01)
  - Review the risk register quarterly
  - Prepare and update the security policy (this document set)
  - Develop and implement a continuous monitoring plan
  - Report security findings to management (frequency: quarterly)
  - Coordinate incident response per Regulation 11
  - Ensure adequate resources for security measures
  - Conduct or coordinate annual compliance audit per Regulation 18
  - Review third-party vendor DPA status annually (SMAP-03 action items)
  - Oversee the annual data minimization review (DBDF-04)
- Authority scope: Can halt data processing activities that pose unacceptable risk
- Conflict of interest: Must not be responsible for the systems being secured (avoid dual developer/security role)
- Resources: Specify what resources the role requires (budget, tools, external audit access)

### SECOFF-02: Appointment Document

**What to document:**
- Named individual or position holder
- Contact information (email, phone)
- Effective date of appointment
- Authority scope (which databases, which systems)
- Signature lines (appointee + appointing authority)

**Note:** Since this is pre-launch with zero production tenants, the appointment can specify a position (e.g., "CTO" or "Lead Developer") rather than a named individual, with the understanding that a named individual must be appointed before production launch.

### SECPR-01: Access Management, Authentication, and Authorization

**What to document -- Current State:**
- Authentication: JWT (HS256), access tokens 1h expiry, refresh tokens 30d expiry
- Password storage: bcrypt 10 rounds
- Token revocation: tokenVersion counter
- Middleware chain: authenticateToken -> enrichImpersonationContext -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest
- Role-based access: 5 roles defined in ROLE_PERMISSIONS, 3 additional roles handled via requireAuth route checks
- Tenant isolation: 5-layer defense (see Current Technical State section above)
- Super admin: Separate collection, separate middleware, `type: 'super_admin'` JWT claim
- Impersonation: Super admin generates teacher JWT with `isImpersonation: true` claim

**What to document -- Gaps:**
- Default password "123456" auto-set (R-05)
- No MFA/2FA for any role
- JWT signing uses symmetric keys (HS256), no key rotation mechanism
- No session timeout (beyond 1h access token expiry)
- No account lockout after failed login attempts
- 3 roles (סגן מנהל, מלווה/מורה-מלווה, אורח) lack formal RBAC permission definitions
- No password complexity requirements enforced server-side
- Token stored in localStorage on frontend (XSS vector)
- Super admin seed endpoint has no rate-limit or environment guard

### SECPR-02: Backup, Recovery, and Business Continuity

**What to document -- Current State:**
- MongoDB Atlas managed backups (verify configuration)
- Soft-delete with `isActive: false` on core entities
- Cascade deletion with full document snapshots in `deletion_snapshots`
- Tenant purge with full data dump in `tenant_deletion_snapshots`
- Migration backups in `migration_backups`

**What to document -- Gaps:**
- No documented Recovery Point Objective (RPO)
- No documented Recovery Time Objective (RTO)
- No disaster recovery plan
- No backup restoration testing schedule
- Snapshot collections have no TTL (R-07, R-11)
- No business continuity plan

### SECPR-03: Data Handling, Retention, and Deletion

**What to document -- Current State:**
- 11 collections flagged NEEDS RETENTION POLICY (from DATA-PURPOSES.md)
- Soft delete via `isActive: false`
- Cascade deletion for entity removal
- Tenant purge for full tenant deletion with 90-day grace period
- Import preview data retained indefinitely (R-06)
- Deletion snapshots retained indefinitely (R-07)

**What to document -- Gaps:**
- No TTL indexes on any collection (R-11)
- No automated retention enforcement
- Recommended retention periods documented in DATA-PURPOSES.md but not yet binding
- No data subject deletion/access request procedure
- previewData not purged after import execution
- Cross-border data transfer to SendGrid (US) not formally documented (R-09)

### ACPOL-01: Access Control Policy (All 8 Roles)

**What to document:**
- Complete role inventory (all 8 + super admin = 9)
- Per-role permission matrix (what each role can read/create/update/delete)
- Tenant data boundaries (each tenant's users see only their data)
- Admin override scope (מנהל sees all within tenant)
- Super admin cross-tenant capabilities (with impersonation audit)
- Role assignment process (who can assign roles, how)
- Principle of least privilege implementation
- IDOR prevention (canAccessStudent, canAccessOwnResource)

**Structure recommendation:**

| Section | Content |
|---------|---------|
| Role inventory | Table of all 9 roles with Hebrew name, English name, description, scope |
| Permission matrix | Grid of role x resource x operation (read/create/update/delete) |
| Tenant boundaries | How tenantId scoping works at each layer |
| Formal RBAC vs. route-level auth | Honest documentation of the two patterns |
| Minors' data access | Additional restrictions for student/bagrut data |
| Super admin capabilities | Cross-tenant operations, impersonation rules, audit requirements |
| Gap analysis | Roles without formal RBAC, inconsistencies |

### ACPOL-02: Password and Authentication Policy

**What to document:**

| Area | Current Control | Planned v1.6 Hardening |
|------|----------------|----------------------|
| Password hashing | bcrypt 10 rounds | No change needed |
| Default passwords | "123456" auto-set for teachers without password (R-05) | Remove default passwords; require invitation flow |
| Password complexity | No server-side enforcement | Add minimum length, complexity requirements |
| Password history | Not tracked | Consider tracking last N passwords |
| Account lockout | Not implemented | Add lockout after N failed attempts |
| JWT signing | HS256 symmetric key | Evaluate RS256 asymmetric; implement key rotation |
| Access token expiry | 1 hour | Review appropriateness |
| Refresh token expiry | 30 days | Review appropriateness |
| Token storage | localStorage (frontend) | Evaluate httpOnly cookies |
| MFA | Not implemented | Plan for super admin MFA minimum |
| Session management | Token-based, no server-side session | Document trade-offs |

### ACPOL-03: Access Logging Policy

**What to document:**

| Category | What to Log | Current State | Gap |
|----------|------------|---------------|-----|
| Authentication events | Login success/failure, logout, token refresh | Not systematically logged | Need structured auth event logging |
| Authorization events | Permission checks, role-based access decisions | Not logged | Need authorization decision logging |
| Data access (minors) | Read/write to student and bagrut collections | Not logged | Critical gap -- minors' data access |
| Data modification | Create/update/delete on PII collections | Partially via deletion_audit | Need comprehensive change logging |
| Admin actions | Super admin platform operations | Logged in platform_audit_log | Adequate for platform level |
| Impersonation | Mutating actions during impersonation | Logged in platform_audit_log | Adequate |
| Export events | Ministry report generation | Saved as snapshots | Need event logging too |
| Import events | Data import operations | Saved in import_log | Need security event logging |

**Log retention:**
- Define retention period per log category
- Reference DATA-PURPOSES.md retention recommendations
- Minimum: 1 year for operational logs, 7 years for compliance-critical logs

**Review schedule:**
- Who reviews logs
- How frequently (weekly/monthly/quarterly)
- What triggers an ad-hoc review
- Escalation procedure for anomalies

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic security boilerplate | Platform-specific technical documentation | v1.5 initiative | Documents reference actual code paths and configurations |
| No formal risk assessment | 12 risks formally scored with Likelihood x Impact | Phase 27 (2026-03-02) | Risk-informed policy development |
| No data inventory | Field-level classification of 22 collections | Phase 27 (2026-03-02) | Policies can reference specific data categories |
| Generic RBAC description | Code-derived role-permission mapping | This research | Access control policy based on actual permissionService.js |

**Amendment 13 (August 2025):**
Israel's Amendment 13 to the Privacy Protection Law (5774-2024, effective August 14, 2025) introduced:
- Administrative enforcement powers for the Privacy Protection Authority
- Fines of 15,000-300,000+ NIS (up to 5% of domestic annual revenue)
- Expanded DPO requirements for certain entities
- This increases the urgency of having proper governance documentation

**Confidence: MEDIUM** -- Amendment 13 details from Legal500 and IAPP sources; specific applicability to Tenuto.io's entity type not verified.

---

## Open Questions

1. **Named Security Officer**
   - What we know: The role must be defined with specific responsibilities. A position can be named pre-launch.
   - What is unclear: Whether the user wants to name a specific individual or use a position title.
   - Recommendation: Use position title (e.g., "CTO / Lead Developer") in the appointment document with a placeholder for the named individual. Flag that a named appointment is required before production launch.

2. **RPO and RTO for Business Continuity**
   - What we know: No documented recovery objectives exist. MongoDB Atlas provides managed backups.
   - What is unclear: What recovery targets are acceptable to the business.
   - Recommendation: Document placeholder values (RPO: 24 hours, RTO: 4 hours) as "recommended defaults" subject to business owner approval. These are reasonable for a pre-launch SaaS with zero production tenants.

3. **Retention Period Finalization**
   - What we know: DATA-PURPOSES.md recommends retention periods for 11 collections. These are recommendations, not binding decisions.
   - What is unclear: Whether Phase 28 should formalize these recommendations into binding policy or continue recommending.
   - Recommendation: Phase 28 Security Procedure Document should reference the DATA-PURPOSES.md recommendations and state "pending formal approval by Security Officer." Actual TTL enforcement is v1.6 scope.

4. **Cross-Border Transfer Legal Basis**
   - What we know: SendGrid transfers data to US. DPA status is unverified (SMAP-03 action item V-06).
   - What is unclear: What legal basis will be used for the cross-border transfer (contractual clauses, consent, adequacy).
   - Recommendation: Document the cross-border transfer fact in SECPR-03 and flag DPA verification as a pre-launch action item. Do not assert a legal basis until the DPA is verified.

5. **Roles Not in ROLE_PERMISSIONS**
   - What we know: 3 of the 8 declared roles (plus variants) lack formal RBAC definitions in permissionService.js.
   - What is unclear: Whether these roles are actively used or vestigial.
   - Recommendation: Document all 8 roles in the access control policy. For roles without formal RBAC, document the actual route-level auth patterns and flag the gap for v1.6 RBAC alignment.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `middleware/auth.middleware.js` -- authentication and authorization implementation
- Codebase analysis: `middleware/tenant.middleware.js` -- tenant isolation controls
- Codebase analysis: `services/permissionService.js` -- RBAC role-permission definitions
- Codebase analysis: `utils/queryScoping.js` -- query scoping utilities
- Codebase analysis: `middleware/super-admin.middleware.js` -- super admin authentication
- Codebase analysis: `services/auditTrail.service.js` -- audit logging implementation
- Phase 27 compliance documents (9 documents in `.planning/compliance/`)
- Phase 27 RESEARCH.md -- complete data inventory and risk surface analysis
- Phase 27 VERIFICATION.md -- 12/12 truths verified

### Secondary (MEDIUM confidence)
- [ICLG Data Protection Report 2025-2026 Israel](https://iclg.com/practice-areas/data-protection-laws-and-regulations/israel) -- Security Officer requirements, Amendment 13 details
- [Legal500 Israel Data Protection & Cybersecurity](https://www.legal500.com/guides/chapter/israel-data-protection-cybersecurity/) -- CISO reporting requirements, access control obligations
- [DLA Piper Data Protection Laws Israel](https://www.dlapiperdataprotection.com/index.html?t=law&c=IL) -- Security officer subordination, logging requirements
- [IAPP Israeli Data Security Regulations Tutorial](https://iapp.org/news/a/the-new-israeli-data-security-regulations-a-tutorial) -- Security level classifications
- [Israeli Privacy Protection Authority - gov.il](https://www.gov.il/en/pages/data_security_eng) -- Official regulations reference

### Tertiary (LOW confidence)
- Amendment 13 specific applicability to Tenuto.io's entity type -- not verified against actual entity classification criteria
- Exact regulation number-to-requirement mappings for medium security level -- based on secondary source summaries, not direct Hebrew text analysis

---

## Metadata

**Confidence breakdown:**
- Phase 27 foundation: HIGH -- directly verified from 9 completed compliance documents + verification report
- Current technical state: HIGH -- derived from codebase analysis of actual middleware, services, and utility code
- Regulatory requirements: MEDIUM -- based on multiple authoritative English-language secondary sources; Hebrew original text not directly analyzed
- Document structure: HIGH -- follows established Phase 27 patterns
- Gap analysis: HIGH -- gaps derived from comparing actual code against regulatory obligations and Phase 27 risk assessment

**Research date:** 2026-03-02
**Valid until:** 60 days (regulatory framework is stable; codebase changes would invalidate technical state sections)
