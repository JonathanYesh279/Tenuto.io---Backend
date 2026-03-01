# Data Minimization Review Process (DBDF-04)

**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (to be appointed -- see Phase 28)
**Maintained By:** Development Team
**Review Cycle:** Annual (this document defines the review process itself)
**Related Documents:** DATA-INVENTORY.md (DBDF-01), DATA-PURPOSES.md (DBDF-02), MINORS-DATA.md (DBDF-03)

---

## 1. Purpose

The data minimization principle requires that personal data be adequate, relevant, and limited to what is necessary for the purposes for which it is processed. Data must not be retained longer than necessary for its stated purpose.

This document defines the annual review process for ensuring that the Tenuto.io platform collects only necessary data, retains it only for as long as needed, and removes or archives data that is no longer required. The process applies to all personal data holdings documented in DATA-INVENTORY.md (DBDF-01).

---

## 2. Review Scope

Each annual review covers the following areas:

### 2.1 Collection and Field Audit
- All MongoDB collections and their fields as documented in DATA-INVENTORY.md
- Any new collections or fields added since the last review
- Any collections or fields deprecated or removed since the last review
- Verification that the documented inventory matches the current codebase

### 2.2 Retention Compliance
- Are recommended retention periods (from DATA-PURPOSES.md) being enforced?
- Are TTL indexes in place where specified?
- Are automated cleanup jobs running successfully?
- Are there collections where data has accumulated beyond the recommended retention period?

### 2.3 Inactive and Expired Data
- Students with `isActive: false` who have been inactive for longer than the recommended retention period
- Teachers with deactivated accounts whose credentials have not been purged
- Closed school years with associated operational data (rehearsals, attendance, theory lessons) not yet archived
- Expired tokens (invitation tokens, reset tokens) that have not been cleaned up

### 2.4 Snapshot Collection Cleanup
- `deletion_snapshots`: Are snapshots older than the retention window being purged?
- `tenant_deletion_snapshots`: Are tenant snapshots older than the retention window being purged?
- `migration_backups`: Are backups from completed migrations being removed after the retention window?
- `ministry_report_snapshots`: Are old report snapshots being archived or purged per policy?

### 2.5 Import Log Cleanup
- Is `previewData` being removed from `import_log` documents after import execution?
- Are there pending/failed imports with stale previewData that should be cleaned?
- What is the total volume of PII stored in import_log previewData across all tenants?

### 2.6 Denormalized Data Freshness
- Is `studentName` in `teacher.teaching.timeBlocks[].assignedLessons[]` synchronized with current student records?
- Are there denormalized student names for students who have been deleted or deactivated?
- Has the denormalization been remediated (per MINORS-DATA.md Section 5 recommendations)?

### 2.7 Third-Party Data Sharing
- Review data shared with each third-party vendor (MongoDB Atlas, AWS S3, SendGrid, Gmail, Render)
- Verify DPA status with each vendor
- Check for any new third-party integrations added since the last review
- Verify cross-border data transfer compliance (particularly SendGrid US transfer)

---

## 3. Review Process

### Step 1: Initiate Annual Review

**Responsible:** Security Officer (to be appointed in Phase 28)
**Timing:** Annually on the anniversary of the initial review, or triggered by an interim review event (see Section 4)
**Action:** Security Officer creates a review record documenting the review date, scope, and participants. Notify the development team of the upcoming review.

### Step 2: Validate Data Inventory Against Current Codebase

**Responsible:** Development Team
**Action:** Compare DATA-INVENTORY.md against the current `config/constants.js` COLLECTIONS constant and all service/validation files. Identify:
- New collections not yet documented
- New fields added to existing collections
- Collections or fields removed from the codebase but still in the inventory document
- Changes to data classification that may be needed

**Output:** Updated DATA-INVENTORY.md if discrepancies found, or confirmation that inventory is current.

### Step 3: Review Each Collection Against Its Documented Purpose

**Responsible:** Security Officer + Development Team
**Action:** For each collection in DATA-PURPOSES.md:
- Is the documented purpose still accurate?
- Is the lawful basis still appropriate?
- Is any data being collected that is not necessary for the stated purpose?
- Are there fields that could be removed without affecting the documented purpose?
- Has the data processing activity changed in a way that requires updating the purpose or basis?

**Output:** Updated DATA-PURPOSES.md if changes identified, or confirmation that purposes are current.

### Step 4: Check Retention Compliance

**Responsible:** Development Team
**Action:** For each collection with a recommended retention period:
- Verify TTL indexes exist (query: `db.collection.getIndexes()`)
- Verify cleanup jobs are scheduled and running (check cron/scheduler configuration)
- Run sample queries to identify documents older than the retention period
- Document any retention violations (data retained beyond the recommended period)

**Output:** Retention compliance report with violations listed and remediation plan.

### Step 5: Review Access Patterns

**Responsible:** Security Officer
**Action:** Review access logs for anomalous patterns:
- Bulk data exports (large result sets from student or teacher endpoints)
- Unusual access to minors' data (access outside normal working hours, access by unexpected users)
- Access patterns suggesting data harvesting or unauthorized data extraction
- Super admin impersonation sessions -- frequency, duration, and scope

**Output:** Access pattern report with any anomalies flagged for investigation.

### Step 6: Document Findings and Remediation Actions

**Responsible:** Security Officer
**Action:** Compile findings from Steps 2-5 into a single review report. For each finding:
- Describe the issue
- Assess the risk level (CRITICAL / HIGH / MEDIUM / LOW)
- Propose remediation action
- Assign responsibility and timeline for remediation
- Track remediation to completion

**Output:** Annual review report with remediation tracker.

### Step 7: Update Compliance Documents

**Responsible:** Development Team + Security Officer
**Action:** Update the following documents based on review findings:
- DATA-INVENTORY.md -- if collections or fields changed
- DATA-PURPOSES.md -- if purposes, lawful bases, or retention recommendations changed
- MINORS-DATA.md -- if minors' data locations changed
- RISK-ASSESSMENT.md -- if new risks identified or existing risks changed
- VENDOR-INVENTORY.md -- if vendor relationships changed

**Output:** Updated compliance documents with version increments and change notes.

---

## 4. Review Schedule

### 4.1 Annual Review

The primary data minimization review is conducted annually. The first review should be conducted no later than 12 months after the initial compliance document creation (initial creation date: 2026-03-02; first review due by: 2027-03-02).

### 4.2 Interim Reviews

An interim review (covering the full scope of Section 2) is triggered by any of the following events:

| Trigger Event | Rationale | Review Scope |
|---|---|---|
| **New collection creation** | New data holdings need to be documented and assessed | Steps 2, 3 (new collection only) |
| **New third-party vendor integration** | New data sharing requires DPA and transfer assessment | Step 2 (vendor scope), Step 3 |
| **Data breach incident** | Breach may reveal inadequate controls or excessive data retention | Full scope (Steps 2-7) |
| **Regulatory change** | Changes to Israeli Privacy Protection Regulations or related law | Steps 3, 6, 7 (regulatory impact assessment) |
| **Significant platform change** | Major architectural changes, new data flows, or new user types | Steps 2, 3, 5 |
| **User/tenant request** | Data subject access request or deletion request reveals gaps | Steps 3, 4 (relevant collection scope) |

### 4.3 Review Calendar

| Period | Activity |
|---|---|
| **Month 1** (review initiation) | Step 1: Initiate review, notify team |
| **Month 1-2** | Steps 2-3: Inventory validation and purpose review |
| **Month 2** | Steps 4-5: Retention compliance and access pattern review |
| **Month 2-3** | Step 6: Document findings and remediation plan |
| **Month 3** | Step 7: Update compliance documents |
| **Ongoing** | Track remediation actions to completion |

---

## 5. Review Output Template

The reviewer completes the following checklist for each annual review. This template should be copied into a new document for each review cycle.

```markdown
# Data Minimization Annual Review -- [YEAR]

**Review date:** [DATE]
**Reviewer:** [NAME / ROLE]
**Review period:** [START DATE] to [END DATE]

## Checklist

### Inventory Validation
- [ ] DATA-INVENTORY.md matches current codebase collections
- [ ] All new collections since last review are documented
- [ ] All removed collections since last review are marked as deprecated
- [ ] Field-level inventory is accurate for collections with changes

### Purpose and Lawful Basis
- [ ] Each collection's documented purpose is still accurate
- [ ] Each collection's lawful basis is still appropriate
- [ ] No collection is processing data beyond its stated purpose
- [ ] No unnecessary fields identified for removal

### Retention Compliance
- [ ] TTL indexes are in place where specified
- [ ] Automated cleanup jobs are running
- [ ] No data found beyond recommended retention periods
- [ ] Snapshot collections (deletion_snapshots, tenant_deletion_snapshots) are being purged
- [ ] Import log previewData is being cleaned after execution
- [ ] Migration backups are being purged after retention window

### Minors' Data
- [ ] All locations of minors' data match MINORS-DATA.md
- [ ] Parental consent mechanism is in place (or gap documented)
- [ ] Minors' data access logging is operational (or gap documented)
- [ ] Denormalized studentName in teacher records is synchronized
- [ ] Deleted students' names have been removed from teacher records

### Access Patterns
- [ ] No anomalous bulk data exports detected
- [ ] No unauthorized access to minors' data detected
- [ ] Impersonation sessions reviewed -- no concerns
- [ ] Access logging is adequate for accountability

### Third-Party Vendors
- [ ] DPA status verified for all vendors
- [ ] Cross-border transfer compliance verified (SendGrid)
- [ ] No new vendors added without DPA assessment
- [ ] Vendor compliance certifications are current

### Data Identified for Removal/Archival
- [ ] Inactive students beyond retention period: [COUNT / N/A]
- [ ] Deactivated teacher credentials not yet purged: [COUNT / N/A]
- [ ] Closed school year data not yet archived: [COUNT / N/A]
- [ ] Stale import preview data: [COUNT / N/A]
- [ ] Expired tokens not yet cleaned: [COUNT / N/A]

## Findings

| # | Finding | Risk Level | Remediation | Owner | Deadline | Status |
|---|---|---|---|---|---|---|
| 1 | [Description] | [CRITICAL/HIGH/MEDIUM/LOW] | [Action] | [Name] | [Date] | [Open/In Progress/Closed] |

## Remediation Tracker

| Finding # | Action | Status | Completed Date | Verified By |
|---|---|---|---|---|
| 1 | [Action] | [Not Started/In Progress/Complete] | [Date or N/A] | [Name or N/A] |

## Review Sign-Off

- [ ] Review completed by: [Name] on [Date]
- [ ] Remediation plan approved by: [Name] on [Date]
- [ ] Compliance documents updated: [Yes/No -- list documents updated]
```

---

## 6. Metrics and Reporting

To measure the effectiveness of the data minimization program over time, the following metrics should be tracked at each annual review:

| Metric | Description | Target |
|---|---|---|
| **Collections with retention enforcement** | Number of collections with active TTL indexes or cleanup jobs vs. total collections with recommended retention | 100% of collections with recommended retention have enforcement |
| **Stale snapshot volume** | Number of snapshot documents (deletion_snapshots, tenant_deletion_snapshots) older than retention window | 0 (all purged within window) |
| **Import log cleanup rate** | Percentage of executed imports where previewData has been purged | 100% purged within retention window |
| **Denormalized data freshness** | Number of teacher records with stale or orphaned studentName entries | 0 |
| **Review findings closure rate** | Percentage of findings from previous review that have been remediated | 100% within 6 months of review |
| **Time to first review** | Days between compliance document creation and first annual review | Less than or equal to 365 days |

---

*Document version: 1.0 | Last updated: 2026-03-02 | Next review: Annual (this document is itself reviewed as part of the annual process)*
