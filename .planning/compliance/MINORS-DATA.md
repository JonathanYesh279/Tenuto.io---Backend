# Minors' Data Protection Assessment (DBDF-03)

**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (to be appointed -- see Phase 28)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon changes to student data processing
**Related Documents:** DATA-INVENTORY.md (DBDF-01), DATA-PURPOSES.md (DBDF-02), DATA-MINIMIZATION.md (DBDF-04)

---

## 1. Regulatory Context

Students enrolled in Israeli music conservatories managed by Tenuto.io are primarily school-age children, ranging from grade alef through grade yud-bet (approximately ages 6 through 18). Under the Israeli Privacy Protection Regulations (Information Security), 2017, and in accordance with broader privacy principles for minors' data protection:

- **Heightened duty of care:** Personal data of minors requires stricter protections than adult data due to the vulnerable status of the data subjects.
- **Parental/guardian consent:** Processing of minors' personal data requires informed consent from a parent or legal guardian. This consent must be specific, informed, and freely given.
- **Data minimization:** Only data strictly necessary for the educational purpose should be collected and retained.
- **Purpose limitation:** Minors' data collected for music education management must not be repurposed for other activities without additional consent.

This document identifies every location in the Tenuto.io platform where minors' personal data appears, documents current protections, and flags gaps requiring remediation.

---

## 2. Minors' Data Inventory

### 2.1 Primary Collections (Direct Minors' Data)

These collections store personal data that directly identifies or describes minor students.

#### `student` Collection -- Classification: RESTRICTED

The primary repository of minors' personal data in the platform. Every document in this collection represents a conservatory student who is presumed to be a minor.

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `personalInfo.firstName` | string | Minor's first name | High -- direct identifier |
| `personalInfo.lastName` | string | Minor's last name | High -- direct identifier |
| `personalInfo.phone` | string | Minor's phone number (05XXXXXXXX) | High -- contact data |
| `personalInfo.age` | number | Minor's age | High -- confirms minor status |
| `personalInfo.address` | string | Minor's home address | High -- physical location |
| `personalInfo.parentName` | string | Parent/guardian name | Medium -- adult data linked to minor |
| `personalInfo.parentPhone` | string | Parent/guardian phone number | Medium -- adult data linked to minor |
| `personalInfo.parentEmail` | string | Parent/guardian email address | Medium -- adult data linked to minor |
| `personalInfo.studentEmail` | string | Student email address | High -- direct contact |
| `academicInfo.class` | string | School grade (alef through yud-bet) | Medium -- educational context |
| `academicInfo.instrumentProgress` | array | Instruments studied, progress stages, test results | Medium -- academic performance |
| `academicInfo.isBagrutCandidate` | boolean | Bagrut candidacy status | Medium -- academic status |
| `teacherAssignments` | array | Teacher-student lesson assignments with schedule details | Low -- operational data referencing the minor |
| `enrollments` | object | Orchestra, ensemble, and theory lesson memberships | Low -- operational enrollment data |

**Total RESTRICTED fields in student collection:** 9 direct personal identifier fields, plus academic and enrollment data.

#### `bagrut` Collection -- Classification: RESTRICTED

Stores formal examination grades and evaluations for minor students. This data is particularly sensitive as it constitutes an official academic record linked to Ministry of Education requirements.

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `studentId` | string | Reference to the minor's student record | Medium -- indirect identifier |
| `presentations[].grade` | number | Examination presentation grade | High -- academic evaluation of minor |
| `presentations[].gradeLevel` | string | Grade level classification | High -- academic evaluation of minor |
| `presentations[].detailedGrading` | object | Detailed grading breakdown | High -- granular academic evaluation |
| `magenBagrut.grade` | number | Shield grade (magen bagrut) score | High -- academic evaluation of minor |
| `magenBagrut.detailedGrading` | object | Detailed shield grading breakdown | High -- granular academic evaluation |
| `directorEvaluation.points` | number | Director's evaluation score (0-10) | High -- subjective evaluation of minor |
| `directorEvaluation.comments` | string | Director's evaluation comments | High -- qualitative assessment of minor |
| `finalGrade` | number | Computed final examination grade | High -- academic evaluation of minor |
| `finalGradeLevel` | string | Final grade level classification | High -- academic evaluation of minor |
| `program` | array | Musical pieces performed | Low -- academic context |

**Total RESTRICTED fields in bagrut collection:** 10 fields containing grades and evaluations of minors.

---

### 2.2 Secondary Collections (Indirect Minors' Data via References)

These collections contain references to minor students through IDs or denormalized name fields. They do not store comprehensive personal data but create linkage points and, in one case, expose a minor's name outside the student collection.

#### `teacher` Collection -- Denormalized Minor's Name

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `teaching.timeBlocks[].assignedLessons[].studentId` | string | Reference to a minor's student record | Low -- ID reference only |
| `teaching.timeBlocks[].assignedLessons[].studentName` | string | **Minor's name copied from student record** | **High -- direct identifier denormalized into a different collection** |

**Critical concern:** The `studentName` field denormalizes a minor's name into teacher documents. See Section 5 (Denormalization Risk) for detailed analysis.

#### `orchestra` Collection -- Student ID References

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `memberIds[]` | string[] | Array of student IDs (orchestra members) | Low -- ID references only, no PII |

#### `rehearsal` Collection -- Attendance by Student ID

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `attendance.present[]` | string[] | Student IDs marked present | Low -- ID references only |
| `attendance.absent[]` | string[] | Student IDs marked absent | Low -- ID references only |

#### `theory_lesson` Collection -- Enrollment and Attendance by Student ID

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `studentIds[]` | string[] | Enrolled student IDs | Low -- ID references only |
| `attendance.present[]` | string[] | Student IDs marked present | Low -- ID references only |
| `attendance.absent[]` | string[] | Student IDs marked absent | Low -- ID references only |

#### `activity_attendance` Collection -- Individual Attendance Records

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `studentId` | string | Reference to student | Low -- ID reference only |
| `status` | string | Attendance status (present/absent) | Low -- operational data |

---

### 2.3 Snapshot Collections (Complete Minors' Data Copies)

These collections are the highest-risk locations for minors' data because they store complete copies of documents from other collections, preserving all RESTRICTED fields without the access controls of the source collection.

#### `deletion_snapshots` Collection

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `snapshotData` | object | Full document snapshot before deletion | **Critical -- when entityType is 'student', contains complete student record with ALL RESTRICTED fields** |

When a student record is deleted through cascade deletion, the complete student document (including all personalInfo fields, academic data, and enrollment data) is copied into this snapshot collection. The snapshot is retained **indefinitely** with no TTL index.

#### `tenant_deletion_snapshots` Collection

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `collectionSnapshots` | object | Snapshots of ALL tenant-scoped collections | **Critical -- contains complete copies of ALL student records, ALL bagrut records, and ALL teacher records (including denormalized student names) for the entire tenant** |

When a tenant is purged, every document across all 14 tenant-scoped collections is copied into a single snapshot. This creates the most concentrated collection of minors' data in the system -- a single document may contain hundreds of student records.

#### `import_log` Collection

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `previewData` | object | Parsed Excel import data | **High -- when import type is 'students', contains parsed student PII from Excel upload including names, phone numbers, ages, and parent contact information** |

Import preview data is stored at the time of Excel upload and retained indefinitely, even after the import is executed or fails. A single import log document may contain dozens to hundreds of parsed student records.

#### `ministry_report_snapshots` Collection

| Field Path | Data Type | Description | Risk Level |
|---|---|---|---|
| `snapshotData` | object | Full ministry report snapshot | **High -- contains aggregated student data across the tenant, including student names, grades, instruments, and attendance summaries formatted for Ministry of Education reporting** |

Ministry report snapshots are generated each time an admin exports data for Ministry reporting. Each snapshot contains aggregated student information.

---

## 3. Summary: Where Minors' Data Exists

| Location Type | Collections | Total Fields with Minors' Data | Current Controls |
|---|---|---|---|
| **Primary (direct PII)** | `student`, `bagrut` | 19 RESTRICTED fields | Tenant isolation, role-based access, buildScopedFilter for teachers |
| **Secondary (references + denormalized name)** | `teacher`, `orchestra`, `rehearsal`, `theory_lesson`, `activity_attendance` | 1 RESTRICTED field (studentName) + 8 ID references | Tenant isolation, role-based access |
| **Snapshots (complete copies)** | `deletion_snapshots`, `tenant_deletion_snapshots`, `import_log`, `ministry_report_snapshots` | All source fields copied into blob | Tenant isolation only (no field-level controls on blob data) |

---

## 4. Special Handling Requirements

### 4.1 Current Protections

The following access controls are currently in place for minors' data:

| Protection | Description | Scope |
|---|---|---|
| **Tenant isolation** | Every query is automatically scoped by `tenantId` via `enforceTenant` middleware. A user in tenant A cannot access students in tenant B. | All tenant-scoped collections |
| **Role-based access** | `authenticateToken` middleware verifies JWT tokens. Route-level `requireAuth(['role'])` restricts access by role. | All authenticated routes |
| **Teacher-scoped queries** | `buildScopedFilter` restricts teacher-role users to only see students assigned to them via `teacherAssignments`. Teachers cannot see all students in the tenant. | Student queries by teacher role |
| **Context-based authorization** | `req.context.scopes.studentIds` limits which student IDs a teacher can access, preventing IDOR attacks without a database round-trip. | Student access checks |
| **Soft deletion** | Student records use `isActive: false` for soft deletion rather than permanent removal, preserving data for potential recovery. | Student deletion |

### 4.2 Identified Gaps

The following protections are absent and represent compliance gaps for minors' data processing:

**Gap 1: No parental consent mechanism**
- **Issue:** The platform does not implement a formal consent collection mechanism for processing minors' data. Student records are created by administrators without any documented parental consent workflow.
- **Regulatory requirement:** Israeli privacy regulations require parental/guardian consent for processing minors' personal data.
- **Recommendation:** Implement a parental consent workflow in v1.6 -- either digital consent capture or documented paper consent with a recorded consent flag on the student record.

**Gap 2: No minors' data access logging**
- **Issue:** There is no specific audit trail for who accesses student (minors') records, when, or what data they viewed. The `platform_audit_log` only tracks super admin actions, not tenant-level student data access.
- **Regulatory requirement:** Access to minors' data should be logged for accountability and incident investigation.
- **Recommendation:** Implement minors' data access audit trail in v1.6 -- log every read/write to the `student` and `bagrut` collections with actor, timestamp, and operation type.

**Gap 3: No age verification at data entry**
- **Issue:** The platform does not verify or validate that students are indeed minors at the point of data entry. The `personalInfo.age` field is optional and not used to trigger enhanced protections.
- **Regulatory requirement:** The system should be aware of a data subject's minor status to apply appropriate protections.
- **Recommendation:** Consider making `personalInfo.age` or `academicInfo.class` required, and use it to explicitly flag records as minors' data in the system.

**Gap 4: Snapshot collections retain minors' data indefinitely without separate controls**
- **Issue:** When student data is deleted from the `student` collection (via cascade deletion), a complete copy is preserved in `deletion_snapshots` with no TTL and no additional access controls beyond tenant scoping. The same applies to `tenant_deletion_snapshots`, `import_log` (previewData), and `ministry_report_snapshots`.
- **Regulatory requirement:** The data minimization principle requires that personal data not be retained beyond its purpose. Retaining deleted students' data indefinitely in snapshots contradicts the intent of the deletion.
- **Recommendation:** Implement TTL indexes on snapshot collections (90 days for deletion_snapshots, 90 days for tenant_deletion_snapshots). Purge `previewData` from import_log within 90 days of execution. Archive ministry_report_snapshots after 2 years.

**Gap 5: No data minimization in API responses**
- **Issue:** API endpoints that return student data may include all fields from the student document, even when the requesting context does not need all fields (e.g., a teacher viewing their schedule may receive full student PII when only the student name is needed).
- **Regulatory requirement:** Data minimization -- only return the data necessary for the specific use case.
- **Recommendation:** Implement field-level projection in API responses to return only the fields needed for each endpoint's purpose. Prioritize endpoints accessed by teacher-role users.

---

## 5. Denormalization Risk: Student Names in Teacher Documents

### 5.1 The Problem

The field `teacher.teaching.timeBlocks[].assignedLessons[].studentName` stores a copy of the minor's name directly in the teacher document. This denormalization creates several compliance risks:

### 5.2 Risk Analysis

| Risk | Description | Severity |
|---|---|---|
| **Extended exposure surface** | A breach of teacher data (which contains adult SENSITIVE data plus RESTRICTED credentials) also exposes minor students' names. An attacker who compromises teacher records obtains student names as a side effect. | Medium |
| **Deletion incompleteness** | When a student is deleted from the platform, their name persists in teacher time block records. The current cascade deletion process updates `assignedLessons` to remove the student, but the implementation should be verified to ensure the `studentName` field is also cleared or the lesson entry is removed entirely. | High |
| **Update desynchronization** | If a student's name is corrected (e.g., typo fix, legal name change), the denormalized `studentName` in teacher records may not be updated, leaving stale minors' data in the system. | Medium |
| **Scope creep** | Teacher documents were originally designed for adult employment data (SENSITIVE classification). The presence of minors' names elevates the entire document to RESTRICTED classification, requiring all teacher document protections to meet the RESTRICTED standard. | Low |

### 5.3 Recommendation

For v1.6 technical hardening:
1. **Option A (preferred):** Remove `studentName` from `assignedLessons` and resolve the name via a join/lookup at query time. This eliminates the denormalization entirely.
2. **Option B (pragmatic):** Keep `studentName` but implement a synchronization mechanism that updates all denormalized copies when a student name changes, and clears/removes entries when a student is deleted.

---

## 6. Minors' Data Flow

The following describes how minors' data moves through the system:

1. **Data entry:** Admin creates student record via API (`POST /api/students`). Student PII entered into `student` collection. No parental consent recorded.

2. **Teacher assignment:** Admin assigns student to teacher. `studentName` is denormalized into `teacher.teaching.timeBlocks[].assignedLessons[].studentName`.

3. **Group enrollment:** Admin enrolls student in orchestra/theory lesson. Student ID added to `orchestra.memberIds[]`, `theory_lesson.studentIds[]`.

4. **Attendance tracking:** Teacher/admin marks attendance. Student ID recorded in `rehearsal.attendance`, `theory_lesson.attendance`, `activity_attendance`.

5. **Bagrut examination:** Teacher/admin enters examination grades. Full grade data stored in `bagrut` collection referencing `studentId`.

6. **Ministry reporting:** Admin generates ministry report. Student data aggregated and snapshot stored in `ministry_report_snapshots.snapshotData`.

7. **Import:** Admin imports student data from Excel. Parsed data stored in `import_log.previewData` during preview. On execution, data moves to `student` collection.

8. **Deletion:** Admin deletes student. Cascade deletion removes references from `teacher`, `orchestra`, `rehearsal`, `theory_lesson`, `activity_attendance`. Complete snapshot stored in `deletion_snapshots.snapshotData`. Snapshot retained indefinitely.

9. **Tenant purge:** Super admin purges tenant. ALL student data across all collections copied to `tenant_deletion_snapshots.collectionSnapshots`. Original data deleted. Snapshot retained indefinitely.

---

*Document version: 1.0 | Last updated: 2026-03-02 | Next review: Annual or upon changes to student data processing*
