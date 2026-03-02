# Backup and Recovery Plan

**Document ID:** BACK-01
**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (SECOFF-01/02)
**Maintained By:** Development Team
**Review Cycle:** Annual or after any disaster recovery event
**Related Documents:** SECPR-01/02/03 (Security Procedures -- SECPR-02 backup section), SMAP-01 (Architecture Diagram), DBDF-01 (Data Inventory), RISK-01 (Risk Assessment), INCD-01 (Incident Response Plan), PERS-01/02/03 (Personnel Security)

---

## 1. Purpose

This document is the **Backup and Recovery Plan** for the Tenuto.io music conservatory management platform, as required by **Regulation 5(b)** (Takanat 5(b)) of the Israeli Privacy Protection Regulations (Information Security), 5777-2017 (Takkanot Haganat HaPratiyut -- Abtakhat Meida BeM'aarechot Meida, 5777-2017).

Regulation 5(b) requires that the security procedure document (Security Procedures, SECPR-01/02/03) include backup and recovery procedures appropriate to the security level of the database. This document **extends** the backup and recovery policy described in SECURITY-PROCEDURES.md (SECPR-02) Section 5 from a policy description into a full operational procedure with step-by-step runbooks.

The platform has been assessed at **Security Level: MEDIUM** (Ravat Avtachah Beinonit) per RISK-ASSESSMENT.md (RISK-01). At this level, documented backup and recovery procedures must exist and be periodically tested.

### 1.1 Scope

This plan covers the backup and recovery of all personal data stored on the Tenuto.io platform:

- **22 MongoDB collections** (14 tenant-scoped + 8 platform-level) as documented in DATA-INVENTORY.md (DBDF-01)
- **AWS S3 objects** (bagrut document uploads stored in eu-central-1)
- **Application secrets** (environment variables stored in Render)
- **Codebase** (Git repository hosted on GitHub)
- **Platform configuration** (Render service settings, MongoDB Atlas cluster configuration)

### 1.2 Document Relationship to SECPR-02

SECURITY-PROCEDURES.md (SECPR-02) Section 5 defines the backup policy: what should be backed up, the current state of backup capabilities, and identified gaps. This document (BACK-01) operationalizes that policy into:

1. Formally defined recovery objectives (RPO/RTO) with justification
2. A comprehensive inventory of all backup mechanisms
3. Step-by-step recovery runbooks for specific failure scenarios
4. A backup testing schedule with defined success criteria
5. A secrets management section documenting where all secrets reside

---

## 2. Recovery Objectives

### 2.1 RPO and RTO Targets

| Objective | Target | Definition | Justification | Status |
|-----------|--------|-----------|---------------|--------|
| **RPO (Recovery Point Objective)** | **24 hours** | Maximum acceptable data loss measured in time. If a disaster occurs, the platform may lose up to 24 hours of data changes. | Pre-launch SaaS; data changes occur during business hours (approximately 08:00-18:00 Israel time); one business day of data loss is recoverable by re-entering the day's work. Music education data changes (lesson attendance, grade updates) are low-frequency compared to transactional systems. | **Recommended -- pending Security Officer approval** |
| **RTO (Recovery Time Objective)** | **4 hours** | Maximum acceptable downtime. After a declared disaster, the platform must be operational within 4 hours. | Conservatory operations can continue manually (paper-based) for brief periods. Atlas point-in-time recovery + Render redeployment from GitHub is achievable within this window. 4 hours provides sufficient time for diagnosis, recovery, and verification. | **Recommended -- pending Security Officer approval** |

### 2.2 Objective Review

These recovery objectives are **pre-launch defaults** established based on the platform's current usage profile (zero production tenants). Upon production launch:

- The Security Officer must formally approve these targets
- Review with actual usage data within 6 months of first production tenant
- Adjust targets based on: number of tenants, daily transaction volume, business criticality assessment from tenant administrators
- Document any changes in a version update to this document

---

## 3. Backup Mechanisms Inventory

### 3.1 Complete Backup Layers

The following table documents all backup mechanisms available to the Tenuto.io platform, organized by layer (infrastructure, application, code, secrets).

| # | Layer | Mechanism | Frequency | Retention | Recovery Method | Data Covered | Status |
|---|-------|-----------|-----------|-----------|----------------|-------------|--------|
| 1 | Infrastructure | MongoDB Atlas automated snapshots | Per Atlas backup policy configuration (**TO BE VERIFIED**) | Per Atlas tier retention policy (**TO BE VERIFIED**) | Atlas Console > Backup > Restore from Snapshot | All 22 MongoDB collections | **Configuration NOT verified** -- action item |
| 2 | Infrastructure | MongoDB Atlas continuous backup (if enabled on cluster tier) | Continuous -- every change is recorded | Configurable point-in-time (PIT) recovery window (**TO BE VERIFIED**) | Atlas Console > Backup > Restore > Point-in-Time | All 22 MongoDB collections | **Enablement NOT verified** -- action item |
| 3 | Application | Deletion snapshots in `deletion_snapshots` collection | Per cascade deletion event (triggered when a student or teacher is deleted through the cascade deletion system) | **No TTL -- retained indefinitely** (90 days recommended, pending v1.6 TTL implementation) | Manual restoration from snapshot document (see Runbook 1) | Complete document copy of the deleted entity plus cascade-affected records |  Active -- snapshot creation confirmed in `cascadeDeletion.service.js` |
| 4 | Application | Tenant purge snapshots in `tenant_deletion_snapshots` collection | Per tenant purge event (triggered when a super admin permanently purges a deactivated tenant) | **No TTL -- retained indefinitely** (90-day grace period recommended) | Manual restoration from snapshot document (see Runbook 5) | Complete snapshot of ALL tenant data across all 14 tenant-scoped collections | Active -- snapshot creation confirmed in `tenantPurge.service.js` |
| 5 | Application | Migration backups in `migration_backups` collection | Per migration script execution (triggered during schema migration operations) | **No TTL -- retained indefinitely** (180 days recommended) | Manual rollback from backup document | Pre-migration document copies of affected records | Active -- created by migration scripts |
| 6 | Application | Soft-delete preservation via `isActive` flag | Per deactivation event (teacher or student deactivation) | Indefinite -- deactivated records remain in their source collection until hard delete | Set `isActive: true` on the document | Full document preserved in source collection with all fields intact | Active -- standard deactivation pattern across all entity types |
| 7 | Code | Git repository (GitHub) | Per commit | Indefinite (Git history) | Clone from GitHub; redeploy via Render (see Runbook 3) | Complete application codebase, configuration files, compliance documents | Active -- all code changes committed to GitHub |
| 8 | Secrets | Render environment variables | Manual management -- secrets are set via Render dashboard | Current values only -- **no version history, no backup** | Re-enter manually from secure backup (**if one exists**) | JWT_SECRET, JWT_REFRESH_SECRET, MONGODB_URI, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SENDGRID_API_KEY, EMAIL_PASS, and other environment variables (see Section 7) | **CRITICAL GAP -- no backup of secrets exists outside Render** |

### 3.2 Gaps and Risks

The following gaps in the backup infrastructure have been identified and are documented honestly for compliance purposes:

| # | Gap | Severity | Impact | Action Item | Target |
|---|-----|----------|--------|-------------|--------|
| 1 | **Atlas backup configuration has NOT been verified** | HIGH | The actual backup frequency, retention window, and point-in-time recovery availability are unknown. We cannot confirm that the RPO 24h objective is met by the current Atlas configuration. | Verify Atlas backup configuration in the Atlas console: check backup schedule, retention period, and PIT recovery enablement. Document actual values. | Pre-production launch |
| 2 | **No secure backup of secrets exists outside Render** | CRITICAL | If the Render account is compromised or the Render service is lost, ALL application secrets (database credentials, JWT signing keys, API keys) are lost with no recovery path. The platform cannot be redeployed without these secrets. | Implement a secure secret backup mechanism: encrypted vault (e.g., 1Password vault, HashiCorp Vault), encrypted offline storage, or encrypted document shared between authorized personnel. | Pre-production launch |
| 3 | **No TTL indexes on application-level snapshot collections** | MEDIUM | `deletion_snapshots`, `tenant_deletion_snapshots`, and `migration_backups` retain data indefinitely, including RESTRICTED minors' data that was explicitly deleted. This contradicts data minimization principles documented in DATA-MINIMIZATION.md (DBDF-04). | Implement TTL indexes: 90 days for `deletion_snapshots`, 90 days for `tenant_deletion_snapshots`, 180 days for `migration_backups`. | v1.6 |
| 4 | **Backup restoration has NEVER been tested** | CRITICAL | No backup restoration procedure has been executed against real data. The runbooks in this document (Section 5) are theoretical -- they have not been validated through practice. Unknown issues may exist: permissions, connection configurations, data format compatibility, recovery time accuracy. | Execute the backup testing schedule in Section 6. At minimum, complete one Atlas restore test and one application snapshot restore test before production launch. | Pre-production launch |
| 5 | **No backup for AWS S3 objects** | MEDIUM | Bagrut document uploads stored in S3 are not backed up separately. If the S3 bucket is deleted or corrupted, uploaded documents are lost. S3 provides 99.999999999% durability, but no cross-region replication or versioning has been verified. | Verify S3 bucket versioning is enabled. Evaluate enabling cross-region replication for disaster recovery. | Pre-production launch |

---

## 4. Backup Architecture Diagram

```
                    Tenuto.io Backup Layers
                    =======================

    [Application Layer]
    |
    |-- Cascade Deletion --> deletion_snapshots (per-entity snapshots)
    |-- Tenant Purge     --> tenant_deletion_snapshots (full tenant snapshot)
    |-- Migration        --> migration_backups (pre-migration copies)
    |-- Soft Delete      --> isActive: false (in-place preservation)
    |
    [Infrastructure Layer]
    |
    |-- MongoDB Atlas    --> Automated Snapshots (frequency TBD)
    |                    --> Continuous Backup / PIT (if enabled, TBD)
    |
    |-- AWS S3           --> S3 Durability (99.999999999%)
    |                    --> Versioning (TBD -- verify)
    |
    [Code Layer]
    |
    |-- GitHub           --> Git repository (full history)
    |
    [Secrets Layer]
    |
    |-- Render           --> Environment variables (NO BACKUP -- CRITICAL GAP)
```

---

## 5. Recovery Procedures -- Step-by-Step Runbooks

### 5.1 Runbook 1: Single Document Recovery

**Scenario:** An administrator accidentally deletes a student or teacher record through the cascade deletion system, and the record needs to be restored.

**Preconditions:**
- The deletion was performed through the cascade deletion system (which creates snapshots)
- The `deletion_snapshots` collection contains the snapshot for the deleted entity
- The deletion occurred within the snapshot retention window (currently indefinite; will be 90 days after TTL implementation)

**Steps:**

| Step | Action | Command / Location | Expected Result |
|------|--------|--------------------|-----------------|
| 1 | **Identify the deletion event** | Query `deletion_audit` collection: `db.deletion_audit.find({ deletedEntityType: "[student/teacher]", deletedEntityId: ObjectId("[entity_id]") })` | Deletion audit record found with `deletionDate`, `deletedBy`, and `cascadeDetails` |
| 2 | **Find the snapshot** | Query `deletion_snapshots` collection: `db.deletion_snapshots.find({ entityType: "[student/teacher]", entityId: "[entity_id]" })` | Snapshot document found containing `snapshotData` with the complete original document |
| 3 | **Extract the original document** | Copy the `snapshotData` field from the snapshot document. Remove any snapshot metadata fields (`_id` from the snapshot wrapper). Assign a new `_id` or use the original `_id` if not conflicting. | Clean document ready for re-insertion |
| 4 | **Re-insert into source collection** | Insert into `student` or `teacher` collection: `db.student.insertOne(restoredDocument)` | Document inserted with `isActive: true` |
| 5 | **Verify relationships** | For student records: check that `teacherAssignments` reference valid, active teachers. For teacher records: check that any referenced students still exist. | All referenced entities exist and are active |
| 6 | **Update teacherAssignments** (if student) | If the restored student had teacher assignments, verify they are intact in the restored document. If the cascade deletion removed assignment references from teacher time blocks, manually re-add the student to the appropriate teacher's `teaching.timeBlocks[].assignedLessons[]`. | Student-teacher relationship restored bidirectionally |
| 7 | **Verify restoration** | Query the source collection to confirm the document exists: `db.student.findOne({ _id: ObjectId("[entity_id]") })`. Log in as a tenant admin and verify the record appears in the application. | Document visible in the application with correct data |

**Estimated duration:** 30-60 minutes (depending on relationship complexity)
**Responsible party:** Lead Developer or Security Officer
**Post-recovery verification:** Tenant administrator confirms the restored record is complete and correct.

---

### 5.2 Runbook 2: Database Corruption Recovery

**Scenario:** Data integrity is compromised due to a bug, malicious modification, or accidental bulk data operation (e.g., an erroneous update query that modifies multiple documents incorrectly).

**Preconditions:**
- MongoDB Atlas backup is active (automated snapshots or continuous backup)
- The last known good timestamp can be determined (before the corruption occurred)
- Atlas console access is available to the Lead Developer or Security Officer

**Steps:**

| Step | Action | Command / Location | Expected Result |
|------|--------|--------------------|-----------------|
| 1 | **Determine last known good timestamp** | Review application logs (Render dashboard > Logs) and `platform_audit_log` / `deletion_audit` to identify when the corruption occurred. Establish the latest timestamp before the corruption event. | Timestamp identified: `YYYY-MM-DDTHH:MM:SSZ` |
| 2 | **Assess corruption scope** | Determine which collections are affected. Run sample queries on suspected collections. Check collection counts: `db.[collection].countDocuments({ tenantId: "[affected_tenant]" })`. Compare against known baselines or recent `hours_summary` / `ministry_report_snapshots` data. | Scope documented: affected collections, affected tenants, estimated record count |
| 3 | **Access Atlas Console** | Navigate to MongoDB Atlas > Project > Cluster > Backup | Atlas backup dashboard visible |
| 4 | **Initiate restoration to a TEST cluster** (do NOT restore directly to production) | Atlas Console > Backup > Restore > select "Point-in-Time" (if continuous backup available) or "Snapshot" (nearest snapshot before corruption) > Restore to a NEW cluster (test environment) | Restoration initiated; Atlas provides progress indicator |
| 5 | **Wait for restoration to complete** | Monitor Atlas restoration progress | Test cluster available with restored data |
| 6 | **Verify data integrity on test cluster** | Connect to the test cluster. Run verification queries: (a) Collection counts match expected values (b) Sample queries return correct data (c) Check affected collections specifically (d) Verify tenant isolation is intact (`db.[collection].distinct("tenantId")`) | All verification checks pass on test cluster |
| 7 | **Promote to production** | Option A: Point the application to the restored cluster (update `MONGODB_URI` in Render). Option B: Use `mongodump`/`mongorestore` to selectively restore affected collections from test cluster to production. Option C: If full cluster corruption, replace production with the restored cluster. | Production database contains clean data |
| 8 | **Verify application connectivity** | Restart the Render application service. Monitor application logs for connection errors. Test API endpoints: `GET /api/health`, then authenticated endpoints for affected tenants. | Application connects successfully; API endpoints respond correctly |
| 9 | **Document the event** | Create an incident report per INCIDENT-RESPONSE-PLAN.md (INCD-01). Document: root cause, data loss window (difference between corruption time and restore point), number of affected records, recovery time. | Incident report filed |

**Estimated duration:** 2-4 hours (within RTO 4h target)
**Responsible party:** Lead Developer with Security Officer oversight
**Post-recovery verification:** Run data integrity checks across all collections. Verify with at least one tenant administrator that their data is correct.
**Reference:** ARCHITECTURE-DIAGRAM.md (SMAP-01) for connection architecture between Render and MongoDB Atlas.

---

### 5.3 Runbook 3: Complete Hosting Failure

**Scenario:** The Render platform is unavailable (outage), the Render account is compromised (unauthorized access), or the Render service must be abandoned and the application redeployed on an alternative provider.

**Preconditions:**
- GitHub repository is accessible (the application codebase is intact)
- MongoDB Atlas is accessible (or can be restored from backup)
- A secure backup of environment variables exists (see Section 7 -- this is the CRITICAL gap)
- AWS S3 credentials and SendGrid API key are available

**Steps:**

| Step | Action | Command / Location | Expected Result |
|------|--------|--------------------|-----------------|
| 1 | **Verify GitHub repository is accessible** | Navigate to GitHub > repository page, or run `git clone [repo_url]` from a local machine | Repository accessible; latest code available |
| 2 | **Assess Render status** | Check Render status page (status.render.com). If the issue is a temporary outage, consider waiting for resolution. If the account is compromised or the service must be abandoned, proceed to Step 3. | Decision made: wait or redeploy |
| 3 | **Create new hosting service** | Option A (preferred): Create a new Render Web Service pointing to the GitHub repository. Option B (alternative): Deploy on an alternative Node.js hosting provider (Heroku, Railway, AWS Elastic Beanstalk, DigitalOcean App Platform). | New hosting service created |
| 4 | **Configure environment variables** | Set ALL environment variables from the secure backup (see Section 7 for the complete list). Critical variables: `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SENDGRID_API_KEY`, `EMAIL_PASS`, `FRONTEND_URL`, `S3_BUCKET`, `S3_REGION`, `FROM_EMAIL`, `EMAIL_USER`, `NODE_ENV`, `PORT` | All environment variables configured |
| 5 | **Set MongoDB Atlas connection string** | Ensure `MONGODB_URI` points to the correct Atlas cluster. If the Atlas cluster is accessible, use the existing connection string. If the Atlas cluster must be restored, complete Runbook 2 first. | Database connection string configured |
| 6 | **Configure S3 credentials** | Ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `S3_REGION` are correctly set. If AWS credentials were compromised, generate new IAM access keys first. | S3 file storage accessible |
| 7 | **Deploy the application** | Trigger deployment from the GitHub repository. Monitor deployment logs for errors. | Application deployed successfully; build completes without errors |
| 8 | **Verify all API endpoints** | Test: (a) `GET /api/health` -- health check responds (b) `POST /api/auth/login` -- authentication works (c) `GET /api/students` -- tenant-scoped data accessible (d) File upload/download -- S3 integration works (e) Email delivery -- SendGrid/Gmail sends test email | All critical endpoints respond correctly |
| 9 | **Update DNS if needed** | If the new hosting service has a different URL, update DNS records or the `FRONTEND_URL` environment variable to point to the new backend URL. Update the frontend application's API base URL if necessary. | Frontend can communicate with the new backend |
| 10 | **Notify tenant administrators** | Inform all tenant administrators of the service restoration. If tokens were invalidated, advise all users to log in again. | Administrators informed; users can access the platform |

**Estimated duration:** 1-3 hours (within RTO 4h target, assuming secrets are available)
**Responsible party:** Lead Developer
**CRITICAL dependency:** Step 4 requires a secure backup of all environment variables. If no backup exists (current state -- see Gap #2 in Section 3.2), secret recovery may be impossible, requiring generation of entirely new secrets (which invalidates all existing tokens and requires new database credentials from Atlas).

---

### 5.4 Runbook 4: Secret Compromise

**Scenario:** JWT signing secrets, database credentials, API keys, or other sensitive environment variables have been exposed (e.g., leaked in a log, committed to a public repository, discovered by an unauthorized party, or a departing team member had access).

**Preconditions:**
- The scope of the compromise has been assessed (which secrets are affected)
- Access to the Render dashboard is available for environment variable updates
- Access to each affected service's admin console is available for credential regeneration

**Steps:**

| Step | Action | Command / Location | Expected Result |
|------|--------|--------------------|-----------------|
| 1 | **Assess scope of compromise** | Determine which secrets were exposed and how. Document: (a) Which specific secrets were compromised (b) When the exposure occurred (c) Who may have had access (d) Whether any unauthorized use has been detected | Scope assessment documented |
| 2 | **Generate new JWT secrets** | Generate cryptographically secure random strings for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Two new 128-character hex strings generated |
| 3 | **Update JWT secrets in Render** | Render Dashboard > Service > Environment > update `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` with the new values | New JWT secrets configured in Render |
| 4 | **Acknowledge: ALL existing tokens are now invalid** | Changing JWT secrets immediately invalidates ALL existing access tokens and refresh tokens for ALL users across ALL tenants. Every user will need to re-authenticate. **CRITICAL:** There is no dual-key validation window -- the rotation is immediate and disruptive. | Impact acknowledged; plan for user communication prepared |
| 5 | **Generate new MongoDB credentials** (if `MONGODB_URI` was compromised) | MongoDB Atlas Console > Database Access > Edit User > Change Password (or create a new database user and delete the old one) | New database credentials generated |
| 6 | **Update `MONGODB_URI` in Render** | Render Dashboard > Service > Environment > update `MONGODB_URI` with the new connection string containing the new credentials | New database connection string configured |
| 7 | **Generate new AWS access keys** (if AWS credentials were compromised) | AWS IAM Console > Users > Security Credentials > Create Access Key (then deactivate/delete the old key) | New `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` generated |
| 8 | **Update AWS credentials in Render** | Render Dashboard > Service > Environment > update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` | New AWS credentials configured |
| 9 | **Generate new SendGrid API key** (if `SENDGRID_API_KEY` was compromised) | SendGrid Dashboard > Settings > API Keys > Create API Key (then revoke the old key) | New `SENDGRID_API_KEY` generated |
| 10 | **Update SendGrid key in Render** | Render Dashboard > Service > Environment > update `SENDGRID_API_KEY` | New SendGrid API key configured |
| 11 | **Generate new Gmail app password** (if `EMAIL_PASS` was compromised) | Google Account > Security > App Passwords > Generate new app password (revoke old one) | New `EMAIL_PASS` generated |
| 12 | **Restart application** | Render Dashboard > Manual Deploy or wait for automatic restart after environment variable changes | Application restarts with new secrets |
| 13 | **Verify application functions** | Test: (a) Health check responds (b) New login works with new JWT secrets (c) Database queries work with new credentials (d) File upload/download works with new AWS keys (e) Email sending works with new SendGrid/Gmail credentials | All services operational with new credentials |
| 14 | **Monitor for unauthorized access** | Review `platform_audit_log` and application logs for 72 hours after rotation for any attempts to use old credentials or tokens | No unauthorized access detected |
| 15 | **Update secure secret backup** | If a secure secret backup exists (see Section 7), update it with the new secret values. If no backup exists, this is the trigger to create one. | Secret backup updated with current values |
| 16 | **File incident report** | Create an incident report per INCIDENT-RESPONSE-PLAN.md (INCD-01). The severity depends on the scope: JWT secret compromise is P2 (affects all users); single API key compromise may be P3. | Incident report filed |

**Estimated duration:** 1-2 hours for full rotation
**Responsible party:** Lead Developer with Security Officer oversight
**CRITICAL NOTE:** Dual-key validation is NOT currently implemented. Token rotation causes **immediate session invalidation for ALL users**. This is a disruptive operation and should be communicated to tenant administrators before execution (unless the compromise requires immediate action, in which case user disruption is acceptable).

---

### 5.5 Runbook 5: Tenant Data Recovery

**Scenario:** A tenant was purged (permanently deleted) by a super admin, and the tenant or its data needs to be restored. This is only possible within the snapshot retention window (currently indefinite; planned 90-day window after TTL implementation).

**Preconditions:**
- The tenant purge was performed through the `tenantPurge.service.js` system (which creates snapshots)
- The `tenant_deletion_snapshots` collection contains the snapshot for the purged tenant
- The purge occurred within the retention window

**Steps:**

| Step | Action | Command / Location | Expected Result |
|------|--------|--------------------|-----------------|
| 1 | **Find tenant purge record** | Query `tenant_deletion_snapshots`: `db.tenant_deletion_snapshots.find({ tenantId: "[tenant_id]" })` | Snapshot document found with `tenantData` and `collectionSnapshots` |
| 2 | **Verify within retention window** | Check `createdAt` timestamp on the snapshot document. Compare against current date. If TTL is implemented, verify the document has not expired. | Snapshot is within retention window |
| 3 | **Extract tenant document** | Extract the `tenantData` field from the snapshot. This contains the complete tenant document. | Clean tenant document ready for re-insertion |
| 4 | **Re-insert tenant document** | Insert into `tenant` collection: `db.tenant.insertOne(tenantData)`. Set `isActive: true`, `deletionStatus: null`, clear `deletionScheduledAt` and `deletionPurgeAt`. | Tenant document restored in `tenant` collection |
| 5 | **Extract and re-insert teacher documents** | Extract teacher documents from `collectionSnapshots.teacher` (or equivalent key). Insert each into the `teacher` collection. Verify `tenantId` matches the restored tenant. | All teacher documents restored |
| 6 | **Extract and re-insert student documents** | Extract student documents from `collectionSnapshots.student`. Insert each into the `student` collection. Verify `tenantId` and `teacherAssignments` integrity. | All student documents restored |
| 7 | **Extract and re-insert related data** | Restore remaining tenant-scoped collection data from `collectionSnapshots`: `orchestra`, `rehearsal`, `theory_lesson`, `bagrut`, `school_year`, `activity_attendance`, `hours_summary`, `import_log`, `ministry_report_snapshots`, `deletion_audit`, `deletion_snapshots`, `security_log`. Insert documents into their respective collections. | All tenant-scoped collection data restored |
| 8 | **Verify tenant login** | Attempt to log in as the tenant administrator. If credentials were preserved in the snapshot, login should work. If not, trigger a password reset for the admin account. | Tenant administrator can log in |
| 9 | **Verify data relationships** | Check: (a) Student `teacherAssignments` reference existing teachers (b) Orchestra `memberIds` reference existing students (c) Orchestra `conductorId` references an existing teacher (d) Rehearsal `groupId` references existing orchestras (e) Theory lesson `teacherId` and `studentIds` reference existing entities | All relationships intact |
| 10 | **Log restoration** | Log the tenant restoration in `platform_audit_log` with the super admin who performed the restoration, the original purge details, and the restoration timestamp. | Audit trail complete |

**Estimated duration:** 1-3 hours (depending on tenant data volume)
**Responsible party:** Lead Developer with Super Admin account access
**Post-recovery verification:** Tenant administrator confirms all data is present and correct. Run data integrity checks for the restored tenant.

---

## 6. Backup Testing Schedule

### 6.1 Testing Requirements

**CRITICAL ACKNOWLEDGMENT:** No backup testing has been performed to date. The recovery runbooks in Section 5 are based on documented system capabilities and expected behavior but have NOT been validated through actual testing. This is flagged as a **CRITICAL pre-production action item**.

Backup testing must be performed according to the following schedule to validate recovery capabilities and maintain confidence in the backup infrastructure.

### 6.2 Testing Schedule

| # | Test Type | Frequency | Procedure | Success Criteria | Estimated Duration |
|---|-----------|-----------|-----------|------------------|-------------------|
| 1 | **Atlas backup verification** | **Quarterly** | Log into MongoDB Atlas console. Navigate to Backup section. Verify that automated backups are completing successfully. Check backup timestamps, retention policy, and any backup alerts or failures. | Backup completion confirmed with timestamps for the most recent backup. No backup failures in the past quarter. Backup frequency meets or exceeds RPO 24h requirement. | 15 minutes |
| 2 | **Atlas restore test** | **Annually** | Restore the most recent Atlas backup to a separate test cluster (NOT production). Run data integrity checks on the restored cluster: (a) All 22 collections present (b) Collection document counts match production (c) Sample queries return correct data across 3+ collections (d) Tenant isolation is intact (distinct tenantIds match). | All integrity checks pass. Restoration completes within the RTO 4h window. | 2-3 hours |
| 3 | **Application snapshot restore** | **Annually** | Select a recent entry from `deletion_snapshots`. Follow Runbook 1 to restore the deleted entity to a test environment. Compare the restored document against the original snapshot to verify field-level accuracy. | Restored document matches the snapshot data. All fields present and correct. Entity is functional within the application (can be queried, updated). | 1 hour |
| 4 | **Secret rotation drill** | **Annually** | Practice rotating JWT secrets in a **staging environment** (not production). Follow Runbook 4 Steps 2-4. Verify that old tokens are invalidated and new tokens are generated successfully on login. Document the procedure time. | Application continues operating with new secrets. Old tokens rejected. New login produces valid tokens. Rotation time documented. | 1 hour |
| 5 | **Full disaster recovery drill** | **Annually** | Simulate a complete hosting failure. Using a test/staging environment: (a) Destroy the application service (b) Follow Runbook 3 to redeploy from GitHub (c) Reconfigure all environment variables (d) Verify all API endpoints respond (e) Verify data is accessible. Measure total recovery time against RTO 4h. | Platform operational within RTO 4h. All API endpoints respond. Data accessible and correct. Recovery time documented for future reference. | 3-4 hours |

### 6.3 Testing Record Template

| Field | Description |
|-------|-------------|
| **Test Type** | Which test from the schedule (1-5) |
| **Date** | Date the test was performed (YYYY-MM-DD) |
| **Performed By** | Name and role of the person who conducted the test |
| **Environment** | Test cluster / staging / production (for verification-only tests) |
| **Result** | Pass / Fail / Partial |
| **Recovery Time** | Actual time from start to completion |
| **Issues Found** | Any issues discovered during testing |
| **Follow-up Actions** | Required remediation or procedure updates |
| **Verified By** | Security Officer sign-off |

### 6.4 First Testing Milestone

**Before the first production tenant is onboarded**, the following minimum testing must be completed:

1. Atlas backup verification (Test #1) -- confirm backups are active and meeting RPO
2. Atlas restore test (Test #2) -- confirm at least one successful restore to a test cluster
3. Application snapshot restore (Test #3) -- confirm the deletion snapshot restore procedure works
4. Secret backup creation -- create the first secure backup of all secrets (addressing Gap #2)

These four items are **blocking requirements** for production launch.

---

## 7. Secrets Management

### 7.1 Current Secret Storage

All application secrets are currently stored as **environment variables in the Render platform dashboard**. No secrets are committed to source control (`.env` files are in `.gitignore`).

### 7.2 Complete Secrets Inventory

| # | Secret Name | Classification | Purpose | Rotation Required On Personnel Departure |
|---|-------------|---------------|---------|------------------------------------------|
| 1 | `ACCESS_TOKEN_SECRET` (JWT_SECRET) | RESTRICTED | Signs JWT access tokens (1-hour expiry) for all tenant users | Yes -- invalidates ALL user sessions |
| 2 | `REFRESH_TOKEN_SECRET` (JWT_REFRESH_SECRET) | RESTRICTED | Signs JWT refresh tokens (30-day expiry) for all tenant users | Yes -- invalidates ALL user sessions |
| 3 | `MONGODB_URI` | RESTRICTED | MongoDB Atlas connection string with embedded credentials (username + password) | Yes -- if departing personnel had Atlas access |
| 4 | `AWS_ACCESS_KEY_ID` | RESTRICTED | AWS IAM access key for S3 file storage operations | Yes -- if departing personnel had AWS access |
| 5 | `AWS_SECRET_ACCESS_KEY` | RESTRICTED | AWS IAM secret key paired with access key | Yes -- if departing personnel had AWS access |
| 6 | `S3_BUCKET` (S3_BUCKET_NAME) | INTERNAL | S3 bucket name for file storage | No -- not a secret |
| 7 | `S3_REGION` | INTERNAL | AWS region for S3 bucket (eu-central-1) | No -- not a secret |
| 8 | `SENDGRID_API_KEY` | RESTRICTED | SendGrid API key for transactional email delivery | Yes -- if departing personnel had SendGrid access |
| 9 | `EMAIL_PASS` | RESTRICTED | Gmail app password for fallback email delivery | Yes -- if departing personnel had Gmail access |
| 10 | `EMAIL_USER` | INTERNAL | Gmail email address for fallback email sender | No -- not a secret |
| 11 | `FROM_EMAIL` | INTERNAL | Sender email address for transactional emails | No -- not a secret |
| 12 | `FRONTEND_URL` | INTERNAL | Frontend URL for CORS allowlist and email link generation | No -- not a secret |
| 13 | `NODE_ENV` | PUBLIC | Environment flag (development / production) | No -- not a secret |
| 14 | `PORT` | PUBLIC | Server listening port | No -- not a secret |

### 7.3 Risk Assessment

**Current risk:** If the Render account is compromised or lost, **ALL RESTRICTED secrets are lost with no recovery path**. This is the single most critical operational risk for platform continuity, because:

1. Without `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`, a redeployed application cannot validate any existing user sessions. New secrets can be generated, but all users must re-authenticate.
2. Without `MONGODB_URI`, the application cannot connect to the database. New database credentials can be generated through Atlas, but this requires Atlas admin access.
3. Without `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, file upload/download is broken. New keys can be generated through AWS IAM, but this requires AWS admin access.
4. Without `SENDGRID_API_KEY`, transactional emails (invitations, password resets) cannot be sent. A new key can be generated through SendGrid.

**Key insight:** Secrets 1-2 (JWT secrets) and 3 (MONGODB_URI) are the most critical. JWT secrets can be regenerated (at the cost of invalidating all sessions), but `MONGODB_URI` cannot be regenerated without Atlas admin console access -- if BOTH Render and Atlas access are lost simultaneously, the database data is effectively inaccessible.

### 7.4 Recommendation

**Before production launch**, implement a secure secret backup mechanism:

| Option | Description | Pros | Cons |
|--------|------------|------|------|
| **Encrypted password manager vault** (e.g., 1Password, Bitwarden) | Store all RESTRICTED secrets in an encrypted vault shared between authorized personnel | Easy to set up; access control built-in; audit trail; mobile access | Depends on a third-party service; another credential to manage |
| **Encrypted offline document** | Encrypted file (e.g., GPG-encrypted text file) stored in a secure location (safety deposit box, secure physical storage) | No third-party dependency; survives internet outage | Manual update process; risk of stale data; physical access required for recovery |
| **Cloud secret manager** (e.g., AWS Secrets Manager, HashiCorp Vault) | Dedicated secret management service with versioning, rotation, and access policies | Industry standard; automated rotation support; API access; audit trail | Additional cost; additional infrastructure to manage; may be overkill for current scale |

**Minimum viable approach for pre-launch:** Store a GPG-encrypted copy of all RESTRICTED environment variables in a secure location accessible to at least two authorized personnel members. Update the backup whenever a secret is rotated.

---

## 8. Review Schedule

### 8.1 Regular Review

This document is reviewed **annually** from the date of initial approval. The annual review must cover:

- Accuracy of the backup mechanisms inventory (Section 3) against current infrastructure
- Currency of the recovery runbooks (Section 5) against current system architecture
- Status of all gaps documented in Section 3.2
- Results from the backup testing schedule (Section 6) -- review all test records from the past year
- Currency of the secrets inventory (Section 7) against current environment variables
- RPO/RTO targets (Section 2) reviewed against actual usage patterns
- Security Officer approval of recovery objectives (annually)

### 8.2 Triggered Review

An immediate review of the relevant section(s) is triggered by:

| Trigger | Review Scope |
|---------|-------------|
| Any disaster recovery event (actual, not drill) | Full document review; update runbooks based on lessons learned |
| Change to infrastructure provider (e.g., migrate from Render to alternative) | Runbooks 3 and 4; secrets inventory |
| Change to MongoDB Atlas cluster configuration (tier, backup settings) | Sections 2, 3, and Runbook 2 |
| Addition of a new data store (e.g., Redis, Elasticsearch) | Backup mechanisms inventory; new runbook if needed |
| Secret rotation event | Secrets inventory update |
| Post-testing findings that reveal procedure gaps | Affected runbook(s) |
| First production tenant onboarded | Full document review; confirm all pre-production action items are completed |

---

## 9. Document Cross-References

| Document | ID | Relationship |
|----------|-----|-------------|
| Security Procedures | SECPR-01/02/03 | Parent document; this plan extends SECPR-02 Section 5 (backup and recovery) into full operational procedures |
| Architecture Diagram | SMAP-01 | Defines infrastructure components referenced in runbooks (MongoDB Atlas, Render, AWS S3, SendGrid, Gmail) |
| Data Inventory | DBDF-01 | Defines the 22 collections that must be backed up and their data classifications |
| Data Minimization | DBDF-04 | Informs TTL recommendations for snapshot collections |
| Risk Assessment | RISK-01 | Backup gaps contribute to risk exposure; R-04 (JWT compromise) directly addressed in Runbook 4 |
| Incident Response Plan | INCD-01 | Recovery events may trigger incident reports; Runbooks 2 and 4 reference INCD-01 for incident documentation |
| Personnel Security | PERS-01/02/03 | Platform personnel offboarding (PERS-01 Section 3.2 Step 3) references Runbook 4 for secret rotation procedure |
| Security Officer | SECOFF-01/02 | Document owner; Security Officer approves recovery objectives and oversees backup testing |
| Glossary | GLOSS-01 | Terminology reference for regulatory terms |

---

**Document ID:** BACK-01 -- Backup and Recovery Plan
**Phase:** 29 -- Operational Procedures
**Created:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
