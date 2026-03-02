# Periodic Security Audit Program

**Document ID:** AUDT-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon regulatory changes affecting audit requirements
**Related Documents:** SECOFF-01/02 (Security Officer Role and Appointment), RISK-01 (Risk Assessment), ACPOL-03 (Access Logging Policy), AUDT-02 (Compliance Self-Assessment Checklist), AUDT-03 (Remediation Tracking Process), GLOSS-01 (Glossary)

---

## 1. Purpose

This document establishes the periodic security audit program for the Tenuto.io music conservatory management platform, as required by **Regulation 18** (Takanat 18) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 18 requires:

- **Audit frequency:** Either an internal or external audit at least once every **24 months** for databases at medium security level
- **Risk assessment frequency:** Risk assessments must be reviewed at least once every **18 months** for medium-security databases (Regulation 13)
- **Audit scope:** The audit must include a report addressing the security measures' compliance with the security protocol and "identification of deficiencies and proposals for remediating them"
- **Auditor independence:** The audit must be conducted by someone **other than the Security Officer** to ensure objectivity

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). This document establishes an annual audit cycle that **exceeds** the regulatory minimum of 24 months, ensuring continuous regulatory compliance and proactive risk management.

This audit program ties together all 21+ compliance documents produced during Phases 27-30 of the v1.5 Privacy Compliance Foundation milestone into a coherent, ongoing compliance verification framework. The compliance self-assessment checklist (AUDT-02) defines WHAT to verify. The remediation tracking process (AUDT-03) defines how to HANDLE findings. This document defines WHEN and HOW to verify.

---

## 2. Audit Schedule

### 2.1 Audit Activities and Frequencies

The following table defines the audit cycle. The annual cadence exceeds the regulatory minimum to ensure proactive compliance management.

| Activity | Frequency | Regulatory Minimum | Responsible Party | Output Document |
|----------|-----------|-------------------|-------------------|-----------------|
| Full compliance audit | Annual | 24 months (Reg. 18) | External auditor (independent party) | Formal audit report (Section 7) |
| Risk assessment update | Annual | 18 months (Reg. 13) | Security Officer + external reviewer | Updated RISK-01 with dated change log |
| Self-assessment (AUDT-02 checklist) | Semi-annual | Not specified | Security Officer | Completed AUDT-02 with status updates |
| Log review schedule | Per ACPOL-03 Section 6 | Per Reg. 10 | Security Officer | Log review reports |
| Document review cycle | Annual | Per each document's review schedule | Security Officer | Document revision log |
| Remediation register review | Quarterly | Not specified | Security Officer | Updated AUDT-03 with status changes |

### 2.2 Recommended Annual Calendar

The following calendar provides a structured schedule for distributing audit activities across the year. The timing aligns with the Israeli school year cycle (September start) to minimize disruption to conservatory operations.

| Quarter | Period | Primary Activities |
|---------|--------|-------------------|
| **Q1** | January - March | Internal self-assessment using AUDT-02 checklist. Quarterly AUDT-03 remediation register review. Review all compliance documents for currency. |
| **Q2** | April - June | Risk assessment update (RISK-01 refresh): re-score existing risks, identify new risks, archive resolved risks. Vendor DPA status review (VEND-01/02/03). Quarterly AUDT-03 remediation register review. |
| **Q3** | July - September | External audit engagement and execution. This is scheduled during the Israeli summer when conservatory operations are at lowest volume. Quarterly AUDT-03 remediation register review. |
| **Q4** | October - December | Remediation planning for audit findings. Document updates based on audit recommendations. Second semi-annual self-assessment using AUDT-02. Quarterly AUDT-03 remediation register review. Prepare for next annual cycle. |

### 2.3 Pre-Production Note

The first audit must occur before or shortly after the first production tenant is onboarded. Per SECOFF-01/02 Section 5.2, pre-launch requirements include scheduling the annual compliance audit before real tenant data is being processed. See Section 8 (First Audit Timeline) for the specific pre-production schedule.

---

## 3. Audit Scope

The audit covers **all 18 regulations** of the Israeli Privacy Protection Regulations (Information Security), 5777-2017, using the compliance self-assessment checklist (AUDT-02) as the structured framework.

### 3.1 Scope Areas

| # | Scope Area | Description | Primary Documents |
|---|-----------|-------------|-------------------|
| 1 | Documentation completeness | All 21+ compliance documents from Phases 27-30 are current, internally consistent, and cross-referenced | All compliance documents |
| 2 | Technical controls verification | Spot-check documented controls against actual configuration: Atlas encryption settings, TLS certificates, access control configuration, backup configuration, S3 bucket policy | SMAP-01, SMAP-02, ENC-01, BACK-01 |
| 3 | Access control review | Verify role assignments match documented access control policy; review permission matrix against actual route-level enforcement; verify tenant isolation controls | ACPOL-01, ACPOL-02 |
| 4 | Log review | Verify logging infrastructure matches documented policy; review log retention configuration; verify log review process is functioning | ACPOL-03, LOG-01 |
| 5 | Vendor compliance | Verify DPA execution status for all 5 vendors; review vendor risk scores; verify vendor certifications are current | SMAP-03, VEND-01/02/03 |
| 6 | Personnel records | Verify training completion records; verify confidentiality agreements are signed; review onboarding/offboarding procedures are followed | PERS-01/02/03 |
| 7 | Incident response readiness | Verify contact list is current; verify notification templates are ready; review any incidents since last audit | INCD-01/02/03 |
| 8 | Data inventory currency | Verify collection inventory matches actual database structure; verify data classification assignments are current | DBDF-01, DBDF-02, DBDF-03, DBDF-04 |
| 9 | Risk register currency | Verify all risks have current scores; verify new risks have been identified and assessed; review risk acceptance decisions | RISK-01 |
| 10 | Encryption compliance | Verify all connection paths use TLS 1.2+; verify at-rest encryption configuration; review gap remediation progress | ENC-01 |
| 11 | Mobile device compliance | Verify mobile access policy is communicated; review any device-related incidents | MOB-01 |
| 12 | Backup and recovery | Verify backup configuration matches policy; verify recovery procedures have been tested per schedule | BACK-01 |

### 3.2 Out of Scope

The following are explicitly **out of scope** for the compliance audit:

- **Penetration testing:** The compliance audit is a documentation and configuration review, not a technical penetration test. Penetration testing may be separately commissioned by the Security Officer per SECOFF-01/02 Responsibility #9 (resource advocacy).
- **Code review:** Source code review for security vulnerabilities is a development activity, not a compliance audit activity.
- **Performance testing:** Application performance is not a compliance requirement under the Privacy Protection Regulations.

---

## 4. Audit Types

### 4.1 Internal Self-Assessment

| Attribute | Details |
|-----------|---------|
| **Performed by** | Security Officer (SECOFF-01/02) |
| **Cadence** | Semi-annual (Q1 and Q4 per the annual calendar) |
| **Tool** | Compliance Self-Assessment Checklist (AUDT-02) |
| **Purpose** | Ongoing compliance monitoring between formal external audits. Identifies emerging gaps, verifies remediation progress, and ensures documentation currency. |
| **Output** | Completed AUDT-02 checklist with updated status column, evidence notes, and assessment date. New findings entered in AUDT-03 remediation tracker. |
| **Independence note** | The self-assessment is conducted by the Security Officer and is NOT a substitute for the independent external audit required by Regulation 18. It supplements the external audit by providing continuous monitoring. |

### 4.2 External Audit

| Attribute | Details |
|-----------|---------|
| **Performed by** | Independent external party (MUST NOT be the Security Officer -- Regulation 18 requirement) |
| **Cadence** | Annual (Q3 per the annual calendar) |
| **Purpose** | Formal compliance verification as required by Regulation 18. Provides independent assurance that security controls are implemented as documented. |
| **Output** | Formal audit report per the format defined in Section 7. Findings entered in AUDT-03 remediation tracker. |
| **Independence requirement** | Per SECOFF-01/02 Section 3.5, the current developer-as-Security-Officer arrangement REQUIRES external audit to maintain independence. The auditor must be independent from platform development. |

**External Auditor Qualifications:**

The external auditor engaged for the annual compliance audit must meet the following minimum qualifications:

1. **Regulatory familiarity:** Familiarity with the Israeli Privacy Protection Regulations (Information Security), 5777-2017, and the Privacy Protection Authority's guidelines
2. **Assessment experience:** Experience conducting information security assessments or compliance audits for databases containing personal data
3. **Independence:** No direct involvement in the design, development, or operation of the Tenuto.io platform or its security controls
4. **Minors' data awareness:** Understanding of the elevated protection requirements for minors' personal data under Israeli law

---

## 5. Auditor Independence

### 5.1 Regulatory Requirement

Regulation 18 of the Israeli Privacy Protection Regulations explicitly requires that the auditor who conducts the periodic audit **must NOT be the Security Officer**. This independence requirement ensures that the person assessing compliance is not the same person responsible for implementing and maintaining the security controls.

### 5.2 Conflict of Interest Acknowledgment

SECOFF-01/02 Section 3.5 acknowledges a conflict of interest in the pre-launch phase: the same individual (developer) holds both the development role and the Security Officer role. This conflict makes independent audit even more critical, as the Security Officer cannot objectively assess controls they personally implemented.

### 5.3 Independence Resolution

| Phase | Arrangement | Independence Measure |
|-------|-------------|---------------------|
| **Pre-launch** (current) | Developer holds Security Officer role | ALL formal audits conducted by external party. Security Officer coordinates (scheduling, document preparation, evidence gathering) but does NOT conduct the assessment. |
| **Post-launch** (single Security Officer) | Dedicated Security Officer appointed | External auditor conducts annual audit. Security Officer conducts semi-annual self-assessments. |
| **Post-launch** (team growth) | Team includes Security Officer + other personnel | Internal auditor may be appointed provided they have no direct role in implementing the security controls being audited. External audit still recommended annually. |

### 5.4 Coordination vs. Assessment

The Security Officer's role in the audit process is **coordination**, not assessment:

- **Security Officer coordinates:** Audit scheduling, document preparation, evidence gathering, logistics, remediation follow-up
- **External auditor assesses:** Control effectiveness, documentation completeness, regulatory compliance, gap identification, recommendations
- **Security Officer does NOT:** Assess their own controls, sign off on their own compliance, determine their own findings

---

## 6. Audit Methodology

The audit follows a three-phase approach that progresses from documentation review through technical verification to gap analysis.

### Phase 1 -- Documentation Review

**Objective:** Verify all compliance documents are current, internally consistent, and cross-referenced.

**Activities:**

1. Walk through the AUDT-02 compliance checklist systematically, regulation by regulation
2. Verify all 21+ compliance documents are present and have been reviewed within their stated review cycle
3. Check document cross-references: verify that referenced sections exist and are current
4. Review document version history and change logs
5. Confirm all documents reflect the current platform architecture and operational state

**Output:** Documentation completeness assessment with list of any outdated, missing, or inconsistent documents.

### Phase 2 -- Technical Verification

**Objective:** Spot-check that documented controls are actually implemented as described. This is a configuration review, NOT a penetration test.

**Activities:**

1. **Atlas encryption:** Verify that MongoDB Atlas encryption at rest is enabled (per ENC-01 Section 3)
2. **TLS configuration:** Verify TLS 1.2+ is enforced on all connection paths (per ENC-01 Section 2)
3. **Access control:** Verify role-based access control configuration matches ACPOL-01 permission matrix
4. **Backup configuration:** Verify Atlas backup schedule and retention match BACK-01 Section 3
5. **S3 bucket policy:** Verify S3 Block Public Access is enabled; review bucket policy (per RISK-01 R-10)
6. **Environment variables:** Verify secrets management practices match documented procedures (no secrets in code)
7. **Logging infrastructure:** Verify log targets exist and are recording events per ACPOL-03

**Output:** Technical verification report with pass/fail for each control point. Discrepancies noted as findings.

### Phase 3 -- Gap Analysis and Reporting

**Objective:** Compare findings against documented controls, classify gaps by severity, and produce the formal audit report.

**Activities:**

1. Compile all findings from Phase 1 and Phase 2
2. Classify each finding by severity using the RISK-01 risk framework (CRITICAL / HIGH / MEDIUM / LOW)
3. Apply the minors' data severity elevation rule (per INCIDENT-RESPONSE-PLAN.md): findings affecting minors' data are elevated one severity level
4. Map findings to specific regulations and document references
5. Develop recommended remediation for each finding
6. Produce the formal audit report per Section 7

**Output:** Formal audit report. All findings entered in AUDT-03 remediation tracker.

---

## 7. Audit Report Format

Each audit (internal self-assessment or external audit) must produce a report containing the following sections:

### 7.1 Required Report Contents

| Section | Contents |
|---------|----------|
| **1. Audit Identification** | Audit date, audit type (self-assessment / external), auditor name and qualifications, audit scope |
| **2. Methodology Summary** | Brief description of the methodology used (reference Section 6 of this document for the standard methodology) |
| **3. Scope Confirmation** | Confirmation that all scope areas from Section 3 were reviewed, with any exclusions noted and justified |
| **4. Findings Table** | Structured table of all findings (format below) |
| **5. Overall Compliance Posture** | Summary assessment: number of findings by severity, percentage of checklist items compliant, overall compliance rating |
| **6. Previous Audit Comparison** | Comparison with previous audit findings (if applicable): findings resolved, findings unchanged, new findings. First audit: baseline establishment, no comparison. |
| **7. Recommendations** | Prioritized list of remediation recommendations |
| **8. Auditor Signature** | Signed by the auditor (external) or Security Officer (self-assessment) with date |

### 7.2 Findings Table Format

| Finding ID | Regulation | Severity | Description | Affected Document / Control | Recommended Remediation | Target Date |
|-----------|-----------|----------|-------------|---------------------------|------------------------|-------------|
| FIND-YYYY-NNN | Reg. [N] -- [Subject] | CRITICAL / HIGH / MEDIUM / LOW | [What the gap or deficiency is] | [Document ID, Section] | [What needs to be done] | [Date] |

**Finding ID convention:** `FIND-[year]-[sequential number]` (e.g., FIND-2026-001).

Findings are entered into AUDT-03 (Remediation Tracking) using the `REM-NNN` finding ID format for lifecycle tracking.

---

## 8. First Audit Timeline

The first audit establishes the baseline against which all future audits will be compared. The following timeline is tied to the production launch milestone.

| Milestone | Activity | Timeline | Responsible |
|-----------|----------|----------|-------------|
| **Pre-production** | Complete self-assessment using AUDT-02 checklist | Before first tenant onboarding | Security Officer |
| **Pre-production** | Review and verify all compliance documents are current | Before first tenant onboarding | Security Officer |
| **Pre-production** | Review initial remediation register (AUDT-03 Section 8) and confirm severity assignments | Before first tenant onboarding | Security Officer |
| **Post-launch + 3 months** | Engage external auditor for baseline audit | Within 3 months of first production tenant | Security Officer (coordination) |
| **Post-launch + 6 months** | Complete baseline external audit | Within 6 months of first production tenant | External auditor |
| **Post-launch + 6 months** | Enter all audit findings in AUDT-03 remediation tracker | Immediately following audit completion | Security Officer |
| **Post-launch + 12 months** | First annual audit cycle begins | 12 months after baseline audit | Per annual calendar (Section 2.2) |

**Note:** The pre-production self-assessment is a critical milestone. It confirms that the v1.5 compliance documentation is complete and internally consistent before real personal data (especially minors' data) is processed on the platform.

---

## 9. Amendment 13 Note

Israel's Privacy Protection Law **Amendment 13** (effective August 2025) enhances transparency requirements and enforcement powers of the Privacy Protection Authority (PPA). Key implications for the audit program:

1. **Enhanced enforcement:** The PPA has expanded authority to impose administrative fines, increasing the consequences of non-compliance findings
2. **Transparency requirements:** Strengthened requirements for data processing transparency may affect the scope of future audits
3. **Organizational accountability:** Enhanced accountability requirements may introduce additional audit criteria

**Action required:** The audit program should be reviewed when Amendment 13 secondary regulations are finalized to ensure the audit scope, checklist (AUDT-02), and remediation process (AUDT-03) remain aligned with current regulatory requirements. This item is flagged for Security Officer review in the next audit cycle.

**Current assessment:** The v1.5 compliance documentation program (Phases 27-30) is based on the 2017 Information Security Regulations, which remain the primary compliance target. Amendment 13 reinforces the importance of the practices already established in this program but may introduce additional specific requirements as secondary regulations are published.

---

## 10. Review Schedule

### 10.1 Regular Review

This document is reviewed **annually** as part of the Q4 document review cycle (see Section 2.2). The review must cover:

- Accuracy of the audit schedule against actual execution
- Appropriateness of the annual calendar timing
- Completeness of the audit scope against current regulatory requirements
- Effectiveness of the audit methodology based on previous audit experience
- Auditor independence arrangements

### 10.2 Triggered Review

An immediate review of this document is triggered by any of the following events:

| Trigger | Review Scope |
|---------|-------------|
| Regulatory changes to Regulation 18 or audit requirements | Full document review for compliance |
| Amendment 13 secondary regulations published | Audit scope and methodology review |
| Change of Security Officer | Coordination responsibilities review |
| Significant security incident | Audit schedule and scope review (may trigger emergency audit) |
| First production tenant onboarded | Pre-launch timeline activation (Section 8) |
| External auditor feedback on methodology | Methodology refinement |

---

## 11. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Security Officer Role and Appointment | SECOFF-01/02 | Security Officer coordinates audits (Responsibility #6); conflict of interest provisions (Section 3.5) require external audit |
| Risk Assessment | RISK-01 | Risk baseline for audit findings severity classification; risk assessment update is an audit activity |
| Access Logging Policy | ACPOL-03 | Log review schedule (Section 6) is an audit-tracked activity |
| Compliance Self-Assessment Checklist | AUDT-02 | Primary tool for self-assessment and structured audit walkthrough |
| Remediation Tracking Process | AUDT-03 | All audit findings are tracked through the remediation lifecycle defined in AUDT-03 |
| Access Control Policy | ACPOL-01 | Access control review is an audit scope area |
| Password and Authentication Policy | ACPOL-02 | Authentication controls verification is an audit scope area |
| Encryption Standards Policy | ENC-01 | Encryption configuration verification is an audit scope area |
| Backup and Recovery Plan | BACK-01 | Backup configuration verification is an audit scope area |
| Incident Response Plan | INCD-01/02/03 | Incident response readiness is an audit scope area |
| Vendor Management | VEND-01/02/03 | Vendor DPA status is an audit scope area |
| Vendor Inventory | SMAP-03 | Vendor inventory currency is an audit scope area |
| Personnel Security | PERS-01/02/03 | Training and confidentiality records are an audit scope area |
| Data Inventory | DBDF-01 | Data inventory currency is an audit scope area |
| Data Purposes | DBDF-02 | Data purpose documentation is an audit scope area |
| Minors' Data Assessment | DBDF-03 | Minors' data protections are an audit scope area |
| Data Minimization | DBDF-04 | Data minimization review is an audit scope area |
| Architecture Diagram | SMAP-01 | Technical controls verification references architecture documentation |
| Data Flow Map | SMAP-02 | Data flow verification is an audit scope area |
| Security Procedures | SECPR-01/02/03 | Security procedures compliance is an audit scope area |
| User Notification Policy | LOG-01 | User notification compliance is an audit scope area |
| Mobile Device Policy | MOB-01 | Mobile device compliance is an audit scope area |
| Glossary | GLOSS-01 | Terminology reference for audit documentation |

---

**Document ID:** AUDT-01
**Phase:** 30 -- Supplementary Policies and Audit Program
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
