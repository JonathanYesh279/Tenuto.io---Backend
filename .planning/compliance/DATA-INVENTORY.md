# Database Definition Document (DBDF-01): Data Inventory

**Version:** 1.0
**Date:** 2026-03-02
**Classification:** INTERNAL -- COMPLIANCE DOCUMENT
**Document Owner:** Security Officer (to be appointed -- see Phase 28)
**Maintained By:** Development Team
**Review Cycle:** Annual or upon schema changes

---

## 1. Document Purpose

This document catalogs all personal data holdings of the Tenuto.io platform, classified at the field level per the Israeli Privacy Protection Regulations (Information Security), 2017. The platform has been assessed at **Security Level: MEDIUM**. This inventory covers every MongoDB collection used by the platform, identifying which collections contain personal data, what sensitivity level applies to each field, and the lawful basis for processing. It serves as the foundational reference for all subsequent compliance documents, risk assessments, and audit activities.

---

## 2. Classification Scheme

All fields in every collection are classified using the following four-tier sensitivity scheme:

| Level | Label | Description | Examples |
|---|---|---|---|
| 1 | **PUBLIC** | No privacy implications. Data that could be exposed without harm. | Instrument lists, enum constants, health check status, application version |
| 2 | **INTERNAL** | Operational data not publicly visible. No direct personal data, but may reveal organizational structure or business logic. | Tenant configuration, school year settings, schedule data, orchestra names, attendance records by ID |
| 3 | **SENSITIVE** | Adult personal data. Requires access controls and audit logging. | Teacher PII (name, email, phone, ID number, address), organizational contact details, business registration numbers |
| 4 | **RESTRICTED** | Highest classification. Minors' personal data AND credentials (passwords, tokens, API keys). Requires strictest controls, encryption at rest, and minimal access. | Student PII (all fields identifying minors under 18), hashed passwords, JWT tokens, invitation tokens, reset tokens, API keys |

**Key principle:** Minors' data receives the same classification level as credentials (RESTRICTED). This reflects the heightened duty of care required when processing data of individuals under 18, consistent with Israeli privacy regulations and international best practices.

---

## 3. Collection Summary

The platform uses **22 MongoDB collections**: 14 tenant-scoped (with `tenantId` on every document) and 8 platform-level (no `tenantId`).

### 3.1 Tenant-Scoped Collections

| # | Collection Name | Contains Personal Data | Overall Classification | Record Count Estimate |
|---|---|---|---|---|
| 1 | `teacher` | Yes -- adult PII + credentials + denormalized minor names | RESTRICTED | N/A -- runtime data |
| 2 | `student` | Yes -- minors' PII | RESTRICTED | N/A -- runtime data |
| 3 | `orchestra` | No | INTERNAL | N/A -- runtime data |
| 4 | `rehearsal` | No (references by ID only) | INTERNAL | N/A -- runtime data |
| 5 | `theory_lesson` | No (references by ID only) | INTERNAL | N/A -- runtime data |
| 6 | `bagrut` | Yes -- minors' exam grades | RESTRICTED | N/A -- runtime data |
| 7 | `school_year` | No | INTERNAL | N/A -- runtime data |
| 8 | `activity_attendance` | No (references by ID only) | INTERNAL | N/A -- runtime data |
| 9 | `hours_summary` | No (references by ID only) | INTERNAL | N/A -- runtime data |
| 10 | `import_log` | Yes -- may contain PII in previewData blob | SENSITIVE | N/A -- runtime data |
| 11 | `ministry_report_snapshots` | Yes -- contains teacher/student data in snapshot | SENSITIVE | N/A -- runtime data |
| 12 | `deletion_audit` | No (references by ID only) | INTERNAL | N/A -- runtime data |
| 13 | `deletion_snapshots` | Yes -- contains full document copies | SENSITIVE | N/A -- runtime data |
| 14 | `security_log` | No | INTERNAL | N/A -- runtime data |

### 3.2 Platform-Level Collections

| # | Collection Name | Contains Personal Data | Overall Classification | Record Count Estimate |
|---|---|---|---|---|
| 15 | `tenant` | Yes -- director name, organizational contacts | SENSITIVE | N/A -- runtime data |
| 16 | `super_admin` | Yes -- admin PII + credentials | RESTRICTED | N/A -- runtime data |
| 17 | `platform_audit_log` | Yes -- IP addresses | SENSITIVE | N/A -- runtime data |
| 18 | `tenant_deletion_snapshots` | Yes -- complete tenant data including all PII | SENSITIVE | N/A -- runtime data |
| 19 | `migration_backups` | Yes -- pre-migration document copies | SENSITIVE | N/A -- runtime data |
| 20 | `integrityAuditLog` | No | INTERNAL | N/A -- runtime data |
| 21 | `integrityStatus` | No | INTERNAL | N/A -- runtime data |
| 22 | `healthcheck` | No | PUBLIC | N/A -- runtime data |

---

## 4. Detailed Field-Level Inventory

### 4.1 student Collection

**Overall Classification:** RESTRICTED (minors' data)
**Tenant-Scoped:** Yes
**Source:** `api/student/student.validation.js`, `api/student/student.service.js`
**Lawful Basis:** Contractual necessity -- required to deliver music education services per enrollment agreement
**Minors' Data:** YES -- students are primarily school-age children (grades alef through yud-bet, approximately ages 6-18). Parent/guardian contact information included.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | System identifier |
| `tenantId` | string | INTERNAL | Multi-tenant scoping |
| `personalInfo.firstName` | string | RESTRICTED | Minor's first name |
| `personalInfo.lastName` | string | RESTRICTED | Minor's last name |
| `personalInfo.phone` | string | RESTRICTED | Minor's phone number (pattern: 05XXXXXXXX) |
| `personalInfo.age` | number | RESTRICTED | Minor's age |
| `personalInfo.address` | string | RESTRICTED | Minor's home address |
| `personalInfo.parentName` | string | RESTRICTED | Parent/guardian name |
| `personalInfo.parentPhone` | string | RESTRICTED | Parent/guardian phone number |
| `personalInfo.parentEmail` | string | RESTRICTED | Parent/guardian email address |
| `personalInfo.studentEmail` | string | RESTRICTED | Student email address |
| `academicInfo.instrumentProgress` | array | INTERNAL | Array of instrument progress records |
| `academicInfo.instrumentProgress[].instrumentName` | string | INTERNAL | Instrument being studied |
| `academicInfo.instrumentProgress[].isPrimary` | boolean | INTERNAL | Whether this is the primary instrument |
| `academicInfo.instrumentProgress[].currentStage` | number | INTERNAL | Progress stage (0-8) |
| `academicInfo.instrumentProgress[].ministryStageLevel` | string | INTERNAL | Ministry-defined stage level |
| `academicInfo.instrumentProgress[].department` | string | INTERNAL | Department classification |
| `academicInfo.instrumentProgress[].tests` | object | INTERNAL | Stage and technical test results |
| `academicInfo.instrumentProgress[].tests.stageTest.status` | string | INTERNAL | Stage test status |
| `academicInfo.instrumentProgress[].tests.stageTest.lastTestDate` | date | INTERNAL | Last stage test date |
| `academicInfo.instrumentProgress[].tests.stageTest.nextTestDate` | date | INTERNAL | Next stage test date |
| `academicInfo.instrumentProgress[].tests.stageTest.notes` | string | INTERNAL | Stage test notes |
| `academicInfo.instrumentProgress[].tests.technicalTest.status` | string | INTERNAL | Technical test status |
| `academicInfo.instrumentProgress[].tests.technicalTest.lastTestDate` | date | INTERNAL | Last technical test date |
| `academicInfo.instrumentProgress[].tests.technicalTest.nextTestDate` | date | INTERNAL | Next technical test date |
| `academicInfo.instrumentProgress[].tests.technicalTest.notes` | string | INTERNAL | Technical test notes |
| `academicInfo.class` | string | INTERNAL | School grade (alef through yud-bet) |
| `academicInfo.studyYears` | number | INTERNAL | Years of musical study |
| `academicInfo.extraHour` | number | INTERNAL | Extra teaching hours allocated |
| `academicInfo.tests.bagrutId` | string | INTERNAL | Reference to bagrut examination record |
| `academicInfo.isBagrutCandidate` | boolean | INTERNAL | Bagrut candidacy status |
| `enrollments.orchestraIds` | string[] | INTERNAL | Orchestra membership references |
| `enrollments.ensembleIds` | string[] | INTERNAL | Ensemble membership references |
| `enrollments.theoryLessonIds` | string[] | INTERNAL | Theory lesson enrollment references |
| `enrollments.schoolYears` | array | INTERNAL | School year enrollment records |
| `enrollments.schoolYears[].schoolYearId` | string | INTERNAL | School year reference |
| `enrollments.schoolYears[].isActive` | boolean | INTERNAL | Enrollment active status for year |
| `teacherAssignments` | array | INTERNAL | Teacher-student relationships (single source of truth) |
| `teacherAssignments[].teacherId` | string | INTERNAL | Assigned teacher reference |
| `teacherAssignments[].scheduleSlotId` | string | INTERNAL | Schedule slot reference |
| `teacherAssignments[].day` | string | INTERNAL | Lesson day of week |
| `teacherAssignments[].time` | string | INTERNAL | Lesson time (HH:MM) |
| `teacherAssignments[].duration` | number | INTERNAL | Lesson duration in minutes |
| `teacherAssignments[].location` | string | INTERNAL | Lesson location |
| `teacherAssignments[].isActive` | boolean | INTERNAL | Assignment active status |
| `teacherAssignments[].startDate` | date | INTERNAL | Assignment start date |
| `teacherAssignments[].endDate` | date | INTERNAL | Assignment end date |
| `teacherAssignments[].notes` | string | INTERNAL | Assignment notes |
| `teacherAssignments[].isRecurring` | boolean | INTERNAL | Whether lesson recurs weekly |
| `teacherAssignments[].scheduleInfo` | object | INTERNAL | Additional schedule metadata |
| `teacherAssignments[].createdAt` | date | INTERNAL | Assignment creation timestamp |
| `teacherAssignments[].updatedAt` | date | INTERNAL | Assignment last update timestamp |
| `startDate` | date | INTERNAL | Enrollment start date |
| `isActive` | boolean | INTERNAL | Soft-delete flag |
| `createdAt` | date | INTERNAL | Record creation timestamp |
| `updatedAt` | date | INTERNAL | Last update timestamp |

---

### 4.2 teacher Collection

**Overall Classification:** RESTRICTED (contains credentials and denormalized minors' names)
**Tenant-Scoped:** Yes
**Source:** `api/teacher/teacher.validation.js`, `api/auth/auth.service.js`
**Lawful Basis:** Contractual necessity -- required to manage employment/engagement with the conservatory. Legal obligation for Israeli ID number (tax/employment reporting).
**Note:** Credentials are stored in the same document as personal information. The `teaching.timeBlocks[].assignedLessons[].studentName` field denormalizes minors' names into teacher records.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | System identifier |
| `tenantId` | string | INTERNAL | Multi-tenant scoping |
| `personalInfo.firstName` | string | SENSITIVE | Teacher's first name |
| `personalInfo.lastName` | string | SENSITIVE | Teacher's last name |
| `personalInfo.phone` | string | SENSITIVE | Teacher's phone number (pattern: 05XXXXXXXX) |
| `personalInfo.email` | string | SENSITIVE | Teacher's email address |
| `personalInfo.address` | string | SENSITIVE | Teacher's home address |
| `personalInfo.idNumber` | string | SENSITIVE | Israeli ID number (9-digit Teudat Zehut) |
| `personalInfo.birthYear` | number | SENSITIVE | Year of birth |
| `roles` | string[] | INTERNAL | System roles (teacher, admin, conductor, etc.) |
| `professionalInfo.instrument` | string | INTERNAL | Legacy primary instrument field |
| `professionalInfo.instruments` | string[] | INTERNAL | Instruments taught |
| `professionalInfo.isActive` | boolean | INTERNAL | Professional active status |
| `professionalInfo.classification` | string | INTERNAL | Teacher classification category |
| `professionalInfo.degree` | string | INTERNAL | Academic degree |
| `professionalInfo.hasTeachingCertificate` | boolean | INTERNAL | Teaching certification status |
| `professionalInfo.teachingExperienceYears` | number | INTERNAL | Years of teaching experience |
| `professionalInfo.isUnionMember` | boolean | INTERNAL | Union membership status |
| `professionalInfo.teachingSubjects` | string[] | INTERNAL | Subjects taught |
| `managementInfo.role` | string | INTERNAL | Management role designation |
| `managementInfo.managementHours` | number | INTERNAL | Weekly management hours |
| `managementInfo.accompHours` | number | INTERNAL | Weekly accompaniment hours |
| `managementInfo.ensembleCoordHours` | number | INTERNAL | Weekly ensemble coordination hours |
| `managementInfo.travelTimeHours` | number | INTERNAL | Weekly travel time hours |
| `managementInfo.teachingHours` | number | INTERNAL | Weekly teaching hours allocation |
| `managementInfo.ensembleHours` | number | INTERNAL | Weekly ensemble hours |
| `managementInfo.theoryHours` | number | INTERNAL | Weekly theory teaching hours |
| `managementInfo.coordinationHours` | number | INTERNAL | Weekly coordination hours |
| `managementInfo.breakTimeHours` | number | INTERNAL | Weekly break time hours |
| `managementInfo.totalWeeklyHours` | number | INTERNAL | Total weekly hours (computed) |
| `teaching.timeBlocks` | array | INTERNAL | Weekly schedule time blocks |
| `teaching.timeBlocks[]._id` | ObjectId | INTERNAL | Time block identifier |
| `teaching.timeBlocks[].studentId` | string | INTERNAL | Assigned student reference |
| `teaching.timeBlocks[].day` | string | INTERNAL | Day of week |
| `teaching.timeBlocks[].startTime` | string | INTERNAL | Block start time (HH:MM) |
| `teaching.timeBlocks[].endTime` | string | INTERNAL | Block end time (HH:MM) |
| `teaching.timeBlocks[].duration` | number | INTERNAL | Block duration in minutes |
| `teaching.timeBlocks[].isAvailable` | boolean | INTERNAL | Availability flag |
| `teaching.timeBlocks[].location` | string | INTERNAL | Teaching location |
| `teaching.timeBlocks[].notes` | string | INTERNAL | Time block notes |
| `teaching.timeBlocks[].recurring` | object | INTERNAL | Recurrence settings |
| `teaching.timeBlocks[].recurring.isRecurring` | boolean | INTERNAL | Whether block recurs |
| `teaching.timeBlocks[].recurring.startDate` | date | INTERNAL | Recurrence start date |
| `teaching.timeBlocks[].recurring.endDate` | date | INTERNAL | Recurrence end date |
| `teaching.timeBlocks[].recurring.excludeDates` | date[] | INTERNAL | Dates excluded from recurrence |
| `teaching.timeBlocks[].createdAt` | date | INTERNAL | Block creation timestamp |
| `teaching.timeBlocks[].updatedAt` | date | INTERNAL | Block last update timestamp |
| `teaching.timeBlocks[].assignedLessons` | array | INTERNAL | Lessons assigned within this block |
| `teaching.timeBlocks[].assignedLessons[].studentId` | string | INTERNAL | Student reference |
| `teaching.timeBlocks[].assignedLessons[].studentName` | string | RESTRICTED | Minor's name (denormalized from student record) |
| `teaching.timeBlocks[].assignedLessons[].lessonStartTime` | string | INTERNAL | Lesson start time |
| `teaching.timeBlocks[].assignedLessons[].lessonEndTime` | string | INTERNAL | Lesson end time |
| `teaching.timeBlocks[].assignedLessons[].isActive` | boolean | INTERNAL | Lesson active status |
| `conducting.orchestraIds` | string[] | INTERNAL | Orchestra IDs conducted |
| `ensemblesIds` | string[] | INTERNAL | Ensemble assignment IDs |
| `schoolYears` | array | INTERNAL | School year enrollment records |
| `schoolYears[].schoolYearId` | string | INTERNAL | School year reference |
| `schoolYears[].isActive` | boolean | INTERNAL | Enrollment active status |
| `credentials.email` | string | RESTRICTED | Login email address |
| `credentials.password` | string | RESTRICTED | bcrypt-hashed password (10 salt rounds) |
| `credentials.refreshToken` | string | RESTRICTED | Active JWT refresh token |
| `credentials.tokenVersion` | number | RESTRICTED | Token revocation counter |
| `credentials.invitationToken` | string | RESTRICTED | Invitation token (temporary) |
| `credentials.invitationExpiry` | date | INTERNAL | Invitation token expiry timestamp |
| `credentials.isInvitationAccepted` | boolean | INTERNAL | Whether invitation was accepted |
| `credentials.invitedAt` | date | INTERNAL | Invitation timestamp |
| `credentials.invitedBy` | string | INTERNAL | Reference to user who invited |
| `credentials.passwordSetAt` | date | INTERNAL | When password was last set |
| `credentials.lastLogin` | date | INTERNAL | Last successful login timestamp |
| `credentials.resetToken` | string | RESTRICTED | Password reset token (temporary) |
| `credentials.resetTokenExpiry` | date | INTERNAL | Reset token expiry timestamp |
| `credentials.requiresPasswordChange` | boolean | INTERNAL | Forced password change flag |
| `credentials.invitationMode` | string | INTERNAL | How account was created (INVITE/IMPORT) |
| `isActive` | boolean | INTERNAL | Soft-delete flag |
| `createdAt` | date | INTERNAL | Record creation timestamp |
| `updatedAt` | date | INTERNAL | Last update timestamp |

---

### 4.3 tenant Collection

**Overall Classification:** SENSITIVE
**Tenant-Scoped:** No (platform-level)
**Source:** `api/tenant/tenant.validation.js`
**Lawful Basis:** Contractual necessity -- required to deliver the SaaS platform service.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Tenant identifier |
| `slug` | string | PUBLIC | URL-safe tenant identifier |
| `name` | string | INTERNAL | Conservatory display name |
| `city` | string | INTERNAL | City location |
| `director.name` | string | SENSITIVE | Director's name |
| `director.teacherId` | string | INTERNAL | Director's teacher record reference |
| `ministryInfo.institutionCode` | string | INTERNAL | Ministry of Education institution code |
| `ministryInfo.districtName` | string | INTERNAL | Ministry district name |
| `settings.lessonDurations` | number[] | INTERNAL | Allowed lesson durations (minutes) |
| `settings.schoolStartMonth` | number | INTERNAL | School year start month (1-12) |
| `subscription.plan` | string | INTERNAL | Subscription tier |
| `subscription.startDate` | date | INTERNAL | Subscription start date |
| `subscription.endDate` | date | INTERNAL | Subscription end date |
| `subscription.isActive` | boolean | INTERNAL | Subscription active status |
| `subscription.maxTeachers` | number | INTERNAL | Maximum teacher count limit |
| `subscription.maxStudents` | number | INTERNAL | Maximum student count limit |
| `conservatoryProfile.code` | string | INTERNAL | Conservatory code |
| `conservatoryProfile.ownershipName` | string | INTERNAL | Ownership entity name |
| `conservatoryProfile.status` | string | INTERNAL | Conservatory operational status |
| `conservatoryProfile.socialCluster` | string | INTERNAL | Social cluster classification |
| `conservatoryProfile.businessNumber` | string | SENSITIVE | Business registration number |
| `conservatoryProfile.supportUnit` | string | INTERNAL | Support unit designation |
| `conservatoryProfile.mixedCityFactor` | string | INTERNAL | Mixed city factor |
| `conservatoryProfile.stage` | string | INTERNAL | Development stage |
| `conservatoryProfile.stageDescription` | string | INTERNAL | Stage description |
| `conservatoryProfile.officePhone` | string | SENSITIVE | Office phone number |
| `conservatoryProfile.mobilePhone` | string | SENSITIVE | Mobile phone number |
| `conservatoryProfile.cityCode` | string | INTERNAL | City code |
| `conservatoryProfile.sizeCategory` | string | INTERNAL | Size category |
| `conservatoryProfile.mainDepartment` | string | INTERNAL | Main department |
| `conservatoryProfile.supervisionStatus` | string | INTERNAL | Supervision status |
| `conservatoryProfile.email` | string | SENSITIVE | Organizational email address |
| `conservatoryProfile.address` | string | SENSITIVE | Physical address |
| `conservatoryProfile.managerName` | string | SENSITIVE | Manager name |
| `conservatoryProfile.managerNotes` | string | INTERNAL | Internal manager notes |
| `conservatoryProfile.district` | string | INTERNAL | District classification |
| `deletionStatus` | string | INTERNAL | Tenant lifecycle state |
| `deletionScheduledAt` | date | INTERNAL | Soft-delete scheduled timestamp |
| `deletionPurgeAt` | date | INTERNAL | Permanent purge deadline |
| `deletionRequestedBy` | string | INTERNAL | Who requested deletion |
| `deletionReason` | string | INTERNAL | Deletion reason |
| `isActive` | boolean | INTERNAL | Active status |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Last update timestamp |

---

### 4.4 super_admin Collection

**Overall Classification:** RESTRICTED
**Tenant-Scoped:** No (platform-level)
**Source:** `api/super-admin/super-admin.validation.js`, `api/super-admin/super-admin.service.js`
**Lawful Basis:** Legitimate interest -- platform administration requires operator accounts.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Admin identifier |
| `email` | string | RESTRICTED | Admin login email |
| `password` | string | RESTRICTED | bcrypt-hashed password |
| `name` | string | SENSITIVE | Admin display name |
| `permissions` | string[] | INTERNAL | Permission set |
| `refreshToken` | string | RESTRICTED | Active JWT refresh token |
| `lastLogin` | date | INTERNAL | Last login timestamp |
| `isActive` | boolean | INTERNAL | Active status |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Update timestamp |

---

### 4.5 orchestra Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/orchestra/orchestra.validation.js`
**Lawful Basis:** Contractual necessity -- required to organize ensemble activities.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Orchestra identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `name` | string | INTERNAL | Orchestra/ensemble name |
| `type` | string | INTERNAL | Type (orchestra/ensemble) |
| `subType` | string | INTERNAL | Subtype classification |
| `performanceLevel` | string | INTERNAL | Level (beginner/intermediate/representative) |
| `conductorId` | string | INTERNAL | Reference to teacher |
| `memberIds` | string[] | INTERNAL | References to student IDs |
| `rehearsalIds` | string[] | INTERNAL | References to rehearsal IDs |
| `scheduleSlots` | array | INTERNAL | Weekly schedule slots |
| `schoolYearId` | string | INTERNAL | School year reference |
| `location` | string | INTERNAL | Rehearsal location |
| `ministryData` | object | INTERNAL | Ministry reporting fields |
| `isActive` | boolean | INTERNAL | Active status |
| `lastModified` | date | INTERNAL | Last modification timestamp |

---

### 4.6 rehearsal Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/rehearsal/rehearsal.validation.js`, `api/rehearsal/rehearsal.service.js`
**Lawful Basis:** Contractual necessity -- tracking attendance for educational delivery.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Rehearsal identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `groupId` | string | INTERNAL | Orchestra/ensemble reference |
| `type` | string | INTERNAL | Rehearsal type |
| `date` | date | INTERNAL | Rehearsal date (UTC) |
| `dayOfWeek` | number | INTERNAL | Day of week (0-6) |
| `startTime` | string | INTERNAL | Start time (HH:MM) |
| `endTime` | string | INTERNAL | End time (HH:MM) |
| `location` | string | INTERNAL | Location |
| `attendance.present` | string[] | INTERNAL | Student IDs marked present |
| `attendance.absent` | string[] | INTERNAL | Student IDs marked absent |
| `notes` | string | INTERNAL | Rehearsal notes |
| `schoolYearId` | string | INTERNAL | School year reference |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Update timestamp |

---

### 4.7 theory_lesson Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/theory/theory.service.js`
**Lawful Basis:** Contractual necessity -- managing group theory instruction.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Lesson identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `teacherId` | string | INTERNAL | Teacher reference |
| `category` | string | INTERNAL | Lesson category |
| `groupId` | string | INTERNAL | Group identifier |
| `date` | date | INTERNAL | Lesson date |
| `dayOfWeek` | number | INTERNAL | Day of week (0-6) |
| `startTime` | string | INTERNAL | Start time (HH:MM) |
| `endTime` | string | INTERNAL | End time (HH:MM) |
| `studentIds` | string[] | INTERNAL | Enrolled student IDs |
| `attendance.present` | string[] | INTERNAL | Student IDs marked present |
| `attendance.absent` | string[] | INTERNAL | Student IDs marked absent |
| `schoolYearId` | string | INTERNAL | School year reference |
| `location` | string | INTERNAL | Lesson location |
| `notes` | string | INTERNAL | Lesson notes |
| `isActive` | boolean | INTERNAL | Active status |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Update timestamp |

---

### 4.8 bagrut Collection

**Overall Classification:** RESTRICTED (minors' examination data)
**Tenant-Scoped:** Yes
**Source:** `api/bagrut/bagrut.service.js`, `api/bagrut/bagrut.validation.js`
**Lawful Basis:** Legal obligation -- Israeli Ministry of Education bagrut examination requirements.
**Minors' Data:** YES -- exam grades for minor students, including detailed grading breakdowns.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Bagrut record identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `studentId` | string | INTERNAL | Student reference |
| `teacherId` | string | INTERNAL | Teacher reference |
| `presentations` | array | RESTRICTED | Exam presentation records |
| `presentations[].grade` | number | RESTRICTED | Presentation grade |
| `presentations[].gradeLevel` | string | RESTRICTED | Grade level classification |
| `presentations[].detailedGrading` | object | RESTRICTED | Detailed grading breakdown |
| `presentations[].reviewedBy` | string | INTERNAL | Examiner name(s) |
| `presentations[].lastUpdatedBy` | string | INTERNAL | Audit: who last updated |
| `magenBagrut` | object | RESTRICTED | Shield grade (magen bagrut) |
| `magenBagrut.grade` | number | RESTRICTED | Shield grade score |
| `magenBagrut.detailedGrading` | object | RESTRICTED | Detailed shield grading |
| `directorEvaluation` | object | RESTRICTED | Director's evaluation |
| `directorEvaluation.points` | number | RESTRICTED | Evaluation score (0-10) |
| `directorEvaluation.comments` | string | INTERNAL | Evaluation comments |
| `finalGrade` | number | RESTRICTED | Computed final grade |
| `finalGradeLevel` | string | RESTRICTED | Final grade level classification |
| `program` | array | INTERNAL | Musical program pieces |
| `accompaniment.accompanists` | array | INTERNAL | Accompanist information |
| `documents` | array | INTERNAL | Attached examination documents |
| `documents[].uploadedBy` | string | INTERNAL | Uploader reference |
| `recitalUnits` | number | INTERNAL | Recital unit count (3 or 5) |
| `recitalField` | string | INTERNAL | Recital field (classical/jazz/vocal) |
| `isCompleted` | boolean | INTERNAL | Completion status |
| `completionDate` | date | INTERNAL | Completion date |
| `teacherSignature` | string | SENSITIVE | Teacher's digital signature |
| `isActive` | boolean | INTERNAL | Active status |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Update timestamp |

---

### 4.9 school_year Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/school-year/school-year.service.js`
**Lawful Basis:** Contractual necessity -- academic year organization.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | School year identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `name` | string | INTERNAL | Display name (e.g., "2025-2026") |
| `startDate` | date | INTERNAL | Year start date |
| `endDate` | date | INTERNAL | Year end date |
| `isCurrent` | boolean | INTERNAL | Current year flag |
| `isActive` | boolean | INTERNAL | Active status |
| `createdAt` | date | INTERNAL | Creation timestamp |
| `updatedAt` | date | INTERNAL | Update timestamp |

---

### 4.10 activity_attendance Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/orchestra/orchestra.service.js` (attendance tracking)
**Lawful Basis:** Contractual necessity -- tracking attendance for service delivery and reporting.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Record identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `studentId` | string | INTERNAL | Student reference |
| `activityType` | string | INTERNAL | Activity type (orchestra/theory) |
| `groupId` | string | INTERNAL | Group/orchestra reference |
| `sessionId` | string | INTERNAL | Session reference |
| `date` | date | INTERNAL | Activity date |
| `status` | string | INTERNAL | Attendance status (present/absent) |
| `notes` | string | INTERNAL | Attendance notes |
| `createdAt` | date | INTERNAL | Creation timestamp |

---

### 4.11 hours_summary Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `api/hours-summary/hours-summary.service.js`
**Lawful Basis:** Contractual necessity + Legal obligation -- Ministry of Education reporting.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Summary identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `teacherId` | string | INTERNAL | Teacher reference |
| `schoolYearId` | string | INTERNAL | School year reference |
| `individualHours` | number | INTERNAL | Individual lesson hours total |
| `orchestraHours` | number | INTERNAL | Orchestra conducting hours |
| `theoryHours` | number | INTERNAL | Theory teaching hours |
| `managementHours` | number | INTERNAL | Management hours allocation |
| `totalWeeklyHours` | number | INTERNAL | Total weekly hours (computed) |
| `breakdown` | object | INTERNAL | Detailed hour breakdowns by category |
| `calculatedAt` | date | INTERNAL | Computation timestamp |

---

### 4.12 import_log Collection

**Overall Classification:** SENSITIVE (may contain PII in blob fields)
**Tenant-Scoped:** Yes
**Source:** `api/import/import.service.js`
**Lawful Basis:** Legitimate interest -- operational logging for data quality.
**Note:** The `previewData` field may contain full teacher/student PII from Excel uploads. No retention policy or cleanup mechanism exists.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Import log identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `type` | string | INTERNAL | Import type (teachers/students/ensembles) |
| `status` | string | INTERNAL | Processing status (pending/executed/failed) |
| `uploadedBy` | string | INTERNAL | User who uploaded |
| `previewData` | object | SENSITIVE | Parsed import data -- may contain full PII of teachers/students |
| `results` | object | INTERNAL | Import results and error details |
| `createdAt` | date | INTERNAL | Upload timestamp |
| `executedAt` | date | INTERNAL | Execution timestamp |

---

### 4.13 ministry_report_snapshots Collection

**Overall Classification:** SENSITIVE (contains aggregated PII in snapshot)
**Tenant-Scoped:** Yes
**Source:** `api/export/export.service.js`
**Lawful Basis:** Legal obligation -- Ministry of Education reporting requirements.
**Note:** The `snapshotData` field contains a full snapshot of reported data including teacher and student information aggregated across collections.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Snapshot identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `generatedAt` | date | INTERNAL | Generation timestamp |
| `generatedBy` | string | INTERNAL | User who generated the report |
| `completionPercentage` | number | INTERNAL | Report completeness percentage |
| `snapshotData` | object | SENSITIVE | Full report snapshot -- contains teacher and student data |
| `schoolYearId` | string | INTERNAL | School year reference |

---

### 4.14 deletion_audit Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** `services/cascadeDeletion.service.js`
**Lawful Basis:** Legitimate interest -- deletion audit trail for compliance.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Audit entry identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `deletedEntityType` | string | INTERNAL | Type of entity deleted (student/teacher/etc.) |
| `deletedEntityId` | string | INTERNAL | Deleted entity's ID |
| `deletedBy` | string | INTERNAL | User who performed deletion |
| `deletionDate` | date | INTERNAL | When deletion occurred |
| `cascadeDetails` | object | INTERNAL | Cascade deletion details (affected collections/counts) |

---

### 4.15 deletion_snapshots Collection

**Overall Classification:** SENSITIVE (contains full document copies including PII)
**Tenant-Scoped:** Yes
**Source:** `services/cascadeDeletion.service.js`
**Lawful Basis:** Legitimate interest -- data recovery capability.
**Note:** Contains complete document copies of deleted entities, including all PII of the deleted student or teacher.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Snapshot identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `entityType` | string | INTERNAL | Entity type (student/teacher) |
| `entityId` | string | INTERNAL | Entity ID |
| `snapshotData` | object | SENSITIVE | Full document snapshot before deletion |
| `deletedAt` | date | INTERNAL | Deletion timestamp |

---

### 4.16 security_log Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** Yes
**Source:** Inferred from COLLECTIONS constant and TENANT_SCOPED_COLLECTIONS array
**Lawful Basis:** Legitimate interest -- security monitoring.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Log entry identifier |
| `tenantId` | string | INTERNAL | Tenant scoping |
| `event` | string | INTERNAL | Security event type |
| `userId` | string | INTERNAL | Related user reference |
| `details` | object | INTERNAL | Event details |
| `timestamp` | date | INTERNAL | Event timestamp |

---

### 4.17 platform_audit_log Collection

**Overall Classification:** SENSITIVE (contains IP addresses)
**Tenant-Scoped:** No (platform-level)
**Source:** `services/auditTrail.service.js`
**Lawful Basis:** Legitimate interest -- platform governance and compliance audit trail.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Entry identifier |
| `action` | string | INTERNAL | Audit action type (e.g., TENANT_CREATED, ADMIN_LOGIN) |
| `actorId` | string | INTERNAL | Super admin who performed the action |
| `actorType` | string | INTERNAL | Always 'super_admin' |
| `targetType` | string | INTERNAL | Target entity type |
| `targetId` | string | INTERNAL | Target entity ID |
| `details` | object | INTERNAL | Action details (may include tenant/admin names) |
| `timestamp` | date | INTERNAL | Action timestamp |
| `ip` | string | SENSITIVE | Request IP address |

---

### 4.18 tenant_deletion_snapshots Collection

**Overall Classification:** SENSITIVE (contains complete tenant data including all PII)
**Tenant-Scoped:** No (platform-level)
**Source:** `services/tenantPurge.service.js`
**Lawful Basis:** Legal obligation -- data recovery window before permanent deletion.
**Note:** Contains ALL data for a purged tenant, including all student PII (RESTRICTED-level data), teacher PII, and credentials. This is the most data-dense collection in terms of PII exposure surface.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Snapshot identifier |
| `tenantId` | string | INTERNAL | Purged tenant ID |
| `tenantData` | object | SENSITIVE | Complete tenant document snapshot |
| `collectionSnapshots` | object | SENSITIVE | Snapshots of all tenant-scoped collections |
| `createdAt` | date | INTERNAL | Snapshot creation timestamp |

---

### 4.19 migration_backups Collection

**Overall Classification:** SENSITIVE (contains pre-migration document copies)
**Tenant-Scoped:** No (platform-level)
**Source:** Migration scripts
**Lawful Basis:** Legitimate interest -- migration safety and rollback capability.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Backup identifier |
| `migrationName` | string | INTERNAL | Migration script name |
| `backupData` | object | SENSITIVE | Pre-migration document snapshots |
| `createdAt` | date | INTERNAL | Backup creation timestamp |

---

### 4.20 integrityAuditLog Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** No (platform-level)
**Source:** Inferred from COLLECTIONS constant (integrity checking subsystem)
**Lawful Basis:** Legitimate interest -- data quality assurance.
**Note:** Schema details inferred from collection purpose. Contains results of automated data integrity checks across the platform.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Audit log entry identifier |
| `checkType` | string | INTERNAL | Type of integrity check performed |
| `results` | object | INTERNAL | Check results and findings |
| `timestamp` | date | INTERNAL | When check was executed |

---

### 4.21 integrityStatus Collection

**Overall Classification:** INTERNAL
**Tenant-Scoped:** No (platform-level)
**Source:** Inferred from COLLECTIONS constant (integrity checking subsystem)
**Lawful Basis:** Legitimate interest -- data quality assurance.
**Note:** Schema details inferred from collection purpose. Stores current integrity status of data across collections.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | ObjectId | INTERNAL | Status record identifier |
| `status` | string | INTERNAL | Current integrity status |
| `lastChecked` | date | INTERNAL | Last check timestamp |
| `details` | object | INTERNAL | Status details |

---

### 4.22 healthcheck Collection

**Overall Classification:** PUBLIC
**Tenant-Scoped:** No (platform-level)
**Source:** `services/mongoDB.service.js` (line 33-38)
**Lawful Basis:** N/A -- no personal data.

| Field Path | Type | Sensitivity | Purpose |
|---|---|---|---|
| `_id` | string | PUBLIC | Always 'startup' |
| `status` | string | PUBLIC | Health status ('ok') |
| `timestamp` | date | PUBLIC | Last health check time |
| `dbName` | string | PUBLIC | Database name |

---

## 5. Data Classification Notes

### 5.1 Minors' Data Classification Rationale

All student personal information fields are classified as **RESTRICTED** -- the same level as credentials (passwords, tokens, API keys). This decision reflects:

1. **Israeli Privacy Protection Regulations (Information Security), 2017:** Heightened duty of care for minors' data. Students in the platform are primarily school-age children (grades alef through yud-bet, approximately ages 6-18).
2. **Parental consent requirements:** Parent/guardian contact details stored alongside student records.
3. **Proportionality principle:** The potential harm from unauthorized disclosure of children's personal data is significantly greater than for adults, warranting the highest classification tier.

### 5.2 Denormalization Concern: Student Names in Teacher Records

The field `teacher.teaching.timeBlocks[].assignedLessons[].studentName` copies minors' names from the `student` collection into teacher documents. This creates:

- **Additional exposure surface:** A breach of teacher data also exposes student names.
- **Data synchronization risk:** If a student name is updated, the denormalized copy in teacher records may become stale.
- **Deletion complexity:** Deleting a student's data requires updating all teacher records that contain the denormalized name.

This denormalization is documented in the risk assessment (see RISK-ASSESSMENT.md, R-12).

### 5.3 Collections with Embedded PII in Blob Fields

The following collections store large object fields that may contain personal data from other collections. These "blob" fields make it difficult to apply field-level access controls:

| Collection | Blob Field | Contents | Effective Classification |
|---|---|---|---|
| `import_log` | `previewData` | Parsed Excel data -- may contain full teacher or student PII | SENSITIVE (may contain RESTRICTED data if student import) |
| `ministry_report_snapshots` | `snapshotData` | Full ministry report -- contains aggregated teacher and student data | SENSITIVE (contains RESTRICTED student data) |
| `deletion_snapshots` | `snapshotData` | Complete document copy before deletion -- mirrors source classification | SENSITIVE (may contain RESTRICTED data) |
| `tenant_deletion_snapshots` | `collectionSnapshots` | Complete tenant data across all collections -- contains all PII | SENSITIVE (contains RESTRICTED student and credential data) |
| `migration_backups` | `backupData` | Pre-migration document snapshots -- mirrors source classification | SENSITIVE (may contain RESTRICTED data) |

**Note:** While these blob fields are classified as SENSITIVE at the collection level, they effectively contain RESTRICTED-level data when they include student PII or credentials. Future compliance work should consider whether these collections require RESTRICTED classification or field-level encryption.

### 5.4 No Retention Policy Enforcement

No collection in the platform has TTL (Time-To-Live) indexes or automated cleanup mechanisms. All data is retained indefinitely unless manually deleted. This applies to:

- `import_log.previewData` -- full import data persisted after execution
- `deletion_snapshots` -- deleted entity data retained indefinitely
- `tenant_deletion_snapshots` -- purged tenant data retained indefinitely
- `migration_backups` -- all migration backups retained indefinitely
- `ministry_report_snapshots` -- all generated reports retained indefinitely

Retention policy definition and enforcement are planned for subsequent compliance phases.

---

*Document version: 1.0 | Last updated: 2026-03-02 | Next review: Upon schema changes or annual review*
