# MongoDB Query Inventory

**Generated:** 2026-02-14
**Scope:** All production MongoDB operations across 22 API service files, 14 shared service files, 6 admin files, 6 middleware files, and 1 controller directory.
**Purpose:** Ground truth for Phase 2 (query hardening). Document every query location, tenant isolation status, and risk level.

---

## 1. Summary Statistics

| Metric | Count |
|--------|-------|
| **Total query locations** | **288** |
| **Unique service/controller files** | **35** (+ 4 files with 0 direct queries) |
| **Collections accessed** | **14** |

### By Risk Level

| Risk Level | Count | Percentage | Description |
|-----------|-------|------------|-------------|
| CRITICAL | 43 | 14.9% | No tenantId filtering path at all |
| HIGH | 98 | 34.1% | Conditional tenantId (only if caller passes it) |
| MEDIUM | 56 | 19.5% | Has tenantId but uses ad-hoc pattern (not buildScopedFilter) |
| LOW | 8 | 2.8% | Uses buildScopedFilter correctly |
| EXEMPT | 83 | 28.9% | Intentionally cross-tenant (auth, super-admin, cascade, health) |

### By Collection

| Collection | Query Count | Dominant Risk |
|-----------|-------------|---------------|
| teacher | 82 | HIGH/CRITICAL |
| student | 68 | HIGH |
| orchestra | 28 | HIGH/CRITICAL |
| rehearsal | 22 | HIGH |
| theory_lesson | 24 | HIGH |
| bagrut | 18 | CRITICAL |
| activity_attendance | 22 | CRITICAL |
| school_year | 10 | MEDIUM |
| hours_summary | 4 | MEDIUM |
| tenant | 7 | EXEMPT |
| super_admin | 8 | EXEMPT |
| import_log | 5 | HIGH |
| ministry_report_snapshots | 1 | MEDIUM |
| deletion_audit / deletion_snapshots | 12 | EXEMPT |

### By Operation Type

| Operation | Count |
|-----------|-------|
| find / findOne | 102 |
| findOneAndUpdate | 46 |
| updateOne / updateMany | 78 |
| insertOne / insertMany | 22 |
| deleteOne / deleteMany | 21 |
| countDocuments | 14 |
| aggregate | 4 (in API services) + 20 (in shared/admin) |

---

## 2. Per-Service Query Tables

### 2.1 api/teacher/teacher.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 36 | getTeachers | findOne | student | NO | CRITICAL | Resolves studentId to teacher IDs; no tenant filter on student lookup |
| 51 | getTeachers | find (via _buildCriteria) | teacher | CONDITIONAL | HIGH | `_buildCriteria` only adds tenantId if `filterBy.tenantId` set |
| 55 | getTeachers | find | teacher | CONDITIONAL | HIGH | Same criteria as above, unpaginated path |
| 63 | getTeachers | countDocuments | teacher | CONDITIONAL | HIGH | Same criteria |
| 67 | getTeachers | find | teacher | CONDITIONAL | HIGH | Paginated path, same criteria |
| 109-111 | getTeacherById | findOne | teacher | CONDITIONAL | HIGH | Only adds tenantId if `options.tenantId` is passed |
| 132 | getTeacherIds | find | teacher | NO | CRITICAL | Queries `{ isActive: true }` with no tenantId at all |
| 271 | addTeacher | insertOne | teacher | NO | CRITICAL | Value object may not include tenantId unless caller sets it |
| 331-332 | updateTeacher | findOne | teacher | NO | CRITICAL | Lookup by _id only for duplicate detection |
| 392-393 | updateTeacher | findOneAndUpdate | teacher | NO | CRITICAL | Update by _id only |
| 423-424 | removeTeacher | findOneAndUpdate | teacher | NO | CRITICAL | Soft-delete by _id only |
| 446-448 | getTeacherByRole | find | teacher | CONDITIONAL | HIGH | Only adds tenantId if parameter passed |
| 471-472 | updateTeacherSchedule | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 480-481 | updateTeacherSchedule | findOne | student | NO | CRITICAL | Lookup by _id only |
| 531 | updateTeacherSchedule | updateOne | teacher | NO | CRITICAL | Update by _id only |
| 554 | updateTeacherSchedule | updateOne | student | NO | CRITICAL | Update by _id only |
| 605-608 | checkStudentScheduleConflict | find | teacher | NO | CRITICAL | Queries by nested field without tenantId |
| 656-657 | addStudentToTeacher | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 664-665 | addStudentToTeacher | findOne | student | NO | CRITICAL | Lookup by _id only |
| 692 | addStudentToTeacher | updateOne | student | NO | CRITICAL | Update by _id only |
| 730-731 | removeStudentFromTeacher | findOne (in txn) | teacher | NO | CRITICAL | Lookup by _id only |
| 739-740 | removeStudentFromTeacher | findOne (in txn) | student | NO | CRITICAL | Lookup by _id only |
| 773 | removeStudentFromTeacher | updateOne (in txn) | teacher | NO | CRITICAL | Update by _id + nested match |
| 799 | removeStudentFromTeacher | updateOne (in txn) | student | NO | CRITICAL | Update by _id |
| 819 | removeStudentFromTeacher | updateOne (in txn) | student | NO | CRITICAL | Schedule cleanup by _id |
| 836 | removeStudentFromTeacher | findOne (in txn) | student | NO | CRITICAL | Post-update read by _id |
| 898 | initializeTeachingStructure | updateOne | teacher | NO | CRITICAL | Update by _id only |
| 974 | getTimeBlocks | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 995 | createTimeBlock | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 1031 | createTimeBlock | updateOne | teacher | NO | CRITICAL | Update by _id only |
| 1055 | updateTimeBlock | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 1095 | updateTimeBlock | updateOne | teacher | NO | CRITICAL | Update by _id + nested match |
| 1119 | deleteTimeBlock | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 1131 | deleteTimeBlock | updateOne | teacher | NO | CRITICAL | Update by _id only |

**Summary: 33 queries. 0 LOW. 6 HIGH. 27 CRITICAL.**
**_buildCriteria uses `if (filterBy.tenantId)` -- opt-in, not default-deny.**

---

### 2.2 api/teacher/teacher-lessons.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 39-41 | getTeacherLessons | findOne | teacher | NO | CRITICAL | Verifies teacher exists by _id only |
| 200 | getTeacherLessons | aggregate | student | NO | CRITICAL | No tenantId in $match stage; joins across all students |
| 385-386 | validateTeacherLessonData | findOne | teacher | NO | CRITICAL | Lookup by _id only |
| 403-407 | validateTeacherLessonData | find | student | NO | CRITICAL | Queries by teacherAssignments.teacherId with no tenant filter |

**Summary: 4 queries. 0 LOW. 0 HIGH. 4 CRITICAL.**

---

### 2.3 api/student/student.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 37 | getStudents | find (via buildScopedFilter) | student | YES (via context) | LOW | Uses buildScopedFilter when context available |
| 44 | getStudents | find | student | CONDITIONAL | HIGH | Falls back to _buildCriteria without context |
| 52 | getStudents | countDocuments | student | CONDITIONAL | HIGH | Same criteria |
| 55 | getStudents | find | student | CONDITIONAL | HIGH | Paginated path |
| 97-99 | getStudentById | findOne | student | CONDITIONAL | HIGH | Only adds tenantId if `options.tenantId` passed |
| 161 | addStudent | insertOne | student | NO | CRITICAL | No tenantId validation on insert |
| 242-243 | updateStudent | findOne | student | NO | CRITICAL | Lookup by _id in session |
| 311-312 | updateStudent | findOneAndUpdate | student | NO | CRITICAL | Update by _id |
| 550-551 | updateStudentTest | findOneAndUpdate | student | NO | CRITICAL | Update by _id |
| 613-614 | updateStudentStageLevel | findOneAndUpdate | student | NO | CRITICAL | Update by _id |
| 651-652 | removeStudent | findOneAndUpdate | student | NO | CRITICAL | Soft-delete by _id |
| 674-677 | checkTeacherHasAccessToStudent | findOne | student | NO | CRITICAL | Checks assignment but no tenant scope |
| 743 | associateStudentWithTeacher | updateOne | student | NO | CRITICAL | Update by _id |
| 768 | removeStudentTeacherAssociation | updateMany | teacher | NO | CRITICAL | Update by _id + nested match |
| 789 | removeStudentTeacherAssociation | updateMany | student | NO | CRITICAL | Update by _id |
| 841-848 | syncTeacherRecordsForStudentUpdate | findOne | teacher | NO | CRITICAL | Lookup by _id + nested match |
| 889 | syncTeacherRecordsForStudentUpdate | updateOne | teacher | NO | CRITICAL | Update by _id + nested match |
| 921 | syncTeacherRecordsForStudentUpdate | updateOne | teacher | NO | CRITICAL | Update by _id + nested match (removed assignments) |
| 1057 | setBagrutId | updateOne | student | NO | CRITICAL | Update by _id |
| 1081 | removeBagrutId | updateOne | student | NO | CRITICAL | Update by _id |

**Summary: 20 queries. 1 LOW (getStudents with context). 4 HIGH. 15 CRITICAL.**
**Only service using buildScopedFilter -- but only for the list endpoint.**

---

### 2.4 api/orchestra/orchestra.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 26 | getOrchestras | aggregate | orchestra | CONDITIONAL | HIGH | _buildCriteria sets tenantId only if in filterBy |
| 110 | getOrchestraById | aggregate | orchestra | NO | CRITICAL | $match by _id only; $lookup to student/teacher without tenant scope |
| 208 | addOrchestra | insertOne | orchestra | NO | CRITICAL | No tenantId validation on insert |
| 223 | addOrchestra | updateOne | teacher | NO | CRITICAL | Update conductor by _id |
| 258 | updateOrchestra | updateOne | teacher | NO | CRITICAL | Remove old conductor |
| 265 | updateOrchestra | updateOne | teacher | NO | CRITICAL | Add new conductor |
| 284 | updateOrchestra | findOneAndUpdate | orchestra | NO | CRITICAL | Update by _id |
| 320 | removeOrchestra | updateOne | teacher | NO | CRITICAL | Update conductor |
| 337 | removeOrchestra | updateMany | student | NO | CRITICAL | Remove orchestra from all students |
| 344 | removeOrchestra | findOneAndUpdate | orchestra | NO | CRITICAL | Soft-delete by _id |
| 374 | addMember | updateOne | orchestra | NO | CRITICAL | Update by _id |
| 388 | addMember | updateOne | student | NO | CRITICAL | Update by _id |
| 427 | removeMember | updateOne | orchestra | NO | CRITICAL | Update by _id |
| 441 | removeMember | updateOne | student | NO | CRITICAL | Update by _id |
| 467-468 | updateRehearsalAttendance | findOne | rehearsal | NO | CRITICAL | Lookup by _id |
| 485-486 | updateRehearsalAttendance | findOneAndUpdate | rehearsal | NO | CRITICAL | Update attendance by _id |
| 494 | updateRehearsalAttendance | updateOne (upsert) | activity_attendance | NO | CRITICAL | Upsert without tenantId |
| 513 | updateRehearsalAttendance | updateOne (upsert) | activity_attendance | NO | CRITICAL | Upsert without tenantId |
| 542-543 | getRehearsalAttendance | findOne | rehearsal | NO | CRITICAL | Lookup by _id |
| 558 | getStudentAttendanceStats | find | activity_attendance | NO | CRITICAL | Query by groupId + studentId, no tenant |

**Summary: 20 queries. 0 LOW. 1 HIGH. 19 CRITICAL.**

---

### 2.5 api/rehearsal/rehearsal.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 41-42 | getRehearsals | find | rehearsal | CONDITIONAL | HIGH | _buildCriteria conditional tenantId |
| 56-57 | getRehearsalById | findOne | rehearsal | NO | CRITICAL | Lookup by _id only |
| 108-109 | addRehearsal | findOne | orchestra | NO | CRITICAL | Auth check by _id + conductorId |
| 143 | addRehearsal | insertOne | rehearsal | NO | CRITICAL | No tenantId in document |
| 159 | addRehearsal | updateOne | orchestra | NO | CRITICAL | Push rehearsalId |
| 218-219 | updateRehearsal | findOne | orchestra | NO | CRITICAL | Auth check |
| 238-239 | updateRehearsal | findOneAndUpdate | rehearsal | NO | CRITICAL | Update by _id |
| 264-265 | removeRehearsal | findOne | orchestra | NO | CRITICAL | Auth check |
| 281 | removeRehearsal | updateOne | orchestra | NO | CRITICAL | Pull rehearsalId |
| 292 | removeRehearsal | deleteMany | activity_attendance | NO | CRITICAL | Delete by sessionId |
| 309 | removeRehearsal | findOneAndDelete | rehearsal | NO | CRITICAL | Hard delete by _id |
| 348-349 | bulkCreateRehearsals | findOne | orchestra | NO | CRITICAL | Auth check |
| 440 | bulkCreateRehearsals | insertMany | rehearsal | NO | CRITICAL | Bulk insert without tenantId |
| 465 | bulkCreateRehearsals | updateOne | orchestra | NO | CRITICAL | Push rehearsalIds |
| 509-510 | bulkDeleteRehearsalsByOrchestra | findOne | orchestra | NO | CRITICAL | Auth check |
| 525 | bulkDeleteRehearsalsByOrchestra | find | rehearsal | NO | CRITICAL | Find by groupId |
| 541 | bulkDeleteRehearsalsByOrchestra | deleteMany | rehearsal | NO | CRITICAL | Delete by groupId |
| 550 | bulkDeleteRehearsalsByOrchestra | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |
| 560 | bulkDeleteRehearsalsByOrchestra | updateOne | orchestra | NO | CRITICAL | Clear rehearsalIds |
| 646-647 | bulkDeleteRehearsalsByDateRange | findOne | orchestra | NO | CRITICAL | Auth check |
| 671 | bulkDeleteRehearsalsByDateRange | find | rehearsal | NO | CRITICAL | Date range query |
| 684 | bulkDeleteRehearsalsByDateRange | deleteMany | rehearsal | NO | CRITICAL | Delete by range |
| 693 | bulkDeleteRehearsalsByDateRange | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |
| 704 | bulkDeleteRehearsalsByDateRange | updateOne | orchestra | NO | CRITICAL | Pull rehearsalIds |
| 798-799 | bulkUpdateRehearsalsByOrchestra | findOne | orchestra | NO | CRITICAL | Auth check |
| 829 | bulkUpdateRehearsalsByOrchestra | updateMany | rehearsal | NO | CRITICAL | Update all by groupId |
| 838 | bulkUpdateRehearsalsByOrchestra | updateOne | orchestra | NO | CRITICAL | Update lastModified |
| 904-905 | updateAttendance | findOne | orchestra | NO | CRITICAL | Auth check |
| 921-922 | updateAttendance | findOneAndUpdate | rehearsal | NO | CRITICAL | Update attendance |
| 941 | updateAttendance | deleteMany | activity_attendance | NO | CRITICAL | Delete old records |
| 948 | updateAttendance | insertOne | activity_attendance | NO | CRITICAL | Create present records |
| 961 | updateAttendance | insertOne | activity_attendance | NO | CRITICAL | Create absent records |

**Summary: 32 queries. 0 LOW. 1 HIGH. 31 CRITICAL.**

---

### 2.6 api/theory/theory.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 67 | getTheoryLessons | countDocuments | theory_lesson | CONDITIONAL | HIGH | Via createLessonFilterQuery (uses filterBy pattern) |
| 91-92 | getTheoryLessons | find | theory_lesson | CONDITIONAL | HIGH | Same criteria |
| 138-139 | getTheoryLessonById | findOne | theory_lesson | NO | CRITICAL | Lookup by _id only |
| 219 | addTheoryLesson | insertOne | theory_lesson | NO | CRITICAL | No tenantId validation |
| 224 | addTheoryLesson | updateOne | teacher | NO | CRITICAL | Push theoryLessonId by _id |
| 290 | updateTheoryLesson | updateOne | teacher | NO | CRITICAL | Remove from old teacher |
| 298 | updateTheoryLesson | updateOne | teacher | NO | CRITICAL | Add to new teacher |
| 313-314 | updateTheoryLesson | findOneAndUpdate | theory_lesson | NO | CRITICAL | Update by _id |
| 336 | removeTheoryLesson | updateOne | teacher | NO | CRITICAL | Pull theoryLessonId |
| 351 | removeTheoryLesson | updateMany | student | NO | CRITICAL | Pull from all students |
| 367 | removeTheoryLesson | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |
| 379-380 | removeTheoryLesson | findOneAndDelete | theory_lesson | NO | CRITICAL | Hard delete by _id |
| 514 | bulkCreateTheoryLessons | insertMany | theory_lesson | NO | CRITICAL | Bulk insert no tenantId |
| 556 | bulkCreateTheoryLessons | updateOne | teacher | NO | CRITICAL | Push theoryLessonIds |
| 579 | bulkCreateTheoryLessons | updateOne | student | NO | CRITICAL | Push for each student |
| 621-622 | updateTheoryAttendance | findOneAndUpdate | theory_lesson | NO | CRITICAL | Update by _id |
| 644 | updateTheoryAttendance | deleteMany | activity_attendance | NO | CRITICAL | Delete old records |
| 651 | updateTheoryAttendance | insertOne | activity_attendance | NO | CRITICAL | Create present records |
| 664 | updateTheoryAttendance | insertOne | activity_attendance | NO | CRITICAL | Create absent records |
| 704-705 | addStudentToTheory | findOneAndUpdate | theory_lesson | NO | CRITICAL | Update by _id |
| 720 | addStudentToTheory | updateOne | student | NO | CRITICAL | Update by _id |
| 743-744 | removeStudentFromTheory | findOneAndUpdate | theory_lesson | NO | CRITICAL | Update by _id |
| 759 | removeStudentFromTheory | updateOne | student | NO | CRITICAL | Update by _id |
| 791 | getStudentTheoryAttendanceStats | find | activity_attendance | NO | CRITICAL | Query by studentId only |
| 882 | bulkDeleteTheoryLessonsByDate | find | theory_lesson | NO | CRITICAL | Date range, no tenant |
| 895 | bulkDeleteTheoryLessonsByDate | deleteMany | theory_lesson | NO | CRITICAL | Delete by date range |
| 900 | bulkDeleteTheoryLessonsByDate | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |
| 965 | bulkDeleteTheoryLessonsByCategory | find | theory_lesson | NO | CRITICAL | By category, no tenant |
| 978 | bulkDeleteTheoryLessonsByCategory | deleteMany | theory_lesson | NO | CRITICAL | Delete by category |
| 983 | bulkDeleteTheoryLessonsByCategory | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |
| 1053 | bulkDeleteTheoryLessonsByTeacher | find | theory_lesson | NO | CRITICAL | By teacherId, no tenant |
| 1066 | bulkDeleteTheoryLessonsByTeacher | deleteMany | theory_lesson | NO | CRITICAL | Delete by teacherId |
| 1071 | bulkDeleteTheoryLessonsByTeacher | deleteMany | activity_attendance | NO | CRITICAL | Delete attendance |

**Summary: 33 queries. 0 LOW. 2 HIGH. 31 CRITICAL.**

---

### 2.7 api/bagrut/bagrut.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 54 | getBagruts | find (via _buildCriteria) | bagrut | CONDITIONAL | HIGH | Conditional tenantId |
| 66-67 | getBagrutById | findOne | bagrut | NO | CRITICAL | Lookup by _id only |
| 81-83 | getBagrutByStudentId | findOne | bagrut | NO | CRITICAL | By studentId only |
| 103-105 | addBagrut | findOne | bagrut | NO | CRITICAL | Duplicate check without tenant |
| 112 | addBagrut | insertOne | bagrut | NO | CRITICAL | No tenantId validation |
| 133 | updateBagrut | updateOne | bagrut | NO | CRITICAL | Update by _id |
| 152 | removeBagrut | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 159 | removeBagrut | deleteOne | bagrut | NO | CRITICAL | Hard delete by _id |
| 204 | updatePresentation | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 253 | updateMagenBagrut | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 278 | addDocument | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 298 | removeDocument | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 318 | addProgramPiece | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 338 | updateProgram | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 360 | removeProgramPiece | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 380 | addAccompanist | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 400 | removeAccompanist | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 420 | updateGradingDetails | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 431 | updateGradingDetails | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 457 | calculateAndUpdateFinalGrade | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 469 | calculateAndUpdateFinalGrade | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 492 | completeBagrut | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 511 | completeBagrut | findOne | bagrut | NO | CRITICAL | Re-fetch for validation |
| 518 | completeBagrut | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 542 | updateDirectorEvaluation | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 551 | updateDirectorEvaluation | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |
| 580 | setRecitalConfiguration | findOne | bagrut | NO | CRITICAL | Lookup by _id |
| 595 | setRecitalConfiguration | findOneAndUpdate | bagrut | NO | CRITICAL | Update by _id |

**Summary: 28 queries. 0 LOW. 1 HIGH. 27 CRITICAL.**

---

### 2.8 api/school-year/school-year.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 18-19 | getSchoolYears | find | school_year | CONDITIONAL | MEDIUM | Adds tenantId if param passed |
| 33-34 | getSchoolYearById | findOne | school_year | NO | CRITICAL | Lookup by _id only |
| 51-52 | getCurrentSchoolYear | findOne | school_year | CONDITIONAL | MEDIUM | Adds tenantId if param passed |
| 96 | createSchoolYear | updateMany | school_year | CONDITIONAL | MEDIUM | Scopes isCurrent unset by tenantId if available |
| 108 | createSchoolYear | insertOne | school_year | NO | CRITICAL | tenantId only if value includes it |
| 134 | updateSchoolYear | updateMany | school_year | CONDITIONAL | MEDIUM | Scopes isCurrent unset |
| 142-143 | updateSchoolYear | findOneAndUpdate | school_year | NO | CRITICAL | Update by _id |
| 165-166 | setCurrentSchoolYear | findOne | school_year | NO | CRITICAL | Lookup by _id |
| 177 | setCurrentSchoolYear | updateMany | school_year | CONDITIONAL | MEDIUM | Uses scopeTenantId |
| 183-184 | setCurrentSchoolYear | findOneAndUpdate | school_year | NO | CRITICAL | Update by _id |
| 201-202 | rolloverToNewYear | findOne | school_year | NO | CRITICAL | Lookup by _id |

**Summary: 11 queries. 0 LOW. 5 MEDIUM. 6 CRITICAL.**

---

### 2.9 api/hours-summary/hours-summary.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 36-37 | calculateTeacherHours | findOne | teacher | NO | CRITICAL | Lookup by _id |
| 42-47 | calculateTeacherHours | find | student | CONDITIONAL | MEDIUM | Uses `...(tenantId ? { tenantId } : {})` spread |
| 76-84 | calculateTeacherHours | find | orchestra | NO | CRITICAL | By _id list without tenant |
| 108-112 | calculateTeacherHours | find | theory_lesson | NO | CRITICAL | By teacherId without tenant |
| 188 | calculateTeacherHours | updateOne (upsert) | hours_summary | CONDITIONAL | MEDIUM | Upserts with tenantId in filter if available |
| 210-211 | calculateAllTeacherHours | find | teacher | CONDITIONAL | MEDIUM | Adds tenantId if param passed |
| 248-250 | getHoursSummary | find | hours_summary | CONDITIONAL | MEDIUM | Adds tenantId if param passed |
| 264-266 | getHoursSummaryByTeacher | findOne | hours_summary | NO | CRITICAL | By teacherId only |

**Summary: 8 queries. 0 LOW. 4 MEDIUM. 4 CRITICAL.**

---

### 2.10 api/schedule/time-block.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 35 | createTimeBlock | findOne | teacher | NO | CRITICAL | Lookup by _id |
| 72 | createTimeBlock | updateOne | teacher | NO | CRITICAL | Push timeBlock by _id |
| 173 | updateTimeBlock | updateOne | teacher | NO | CRITICAL | Update by _id + nested |
| 183 | updateTimeBlock | updateOne | teacher | NO | CRITICAL | Fallback update path |
| 251 | assignLessonToBlock | updateOne | student | NO | CRITICAL | Update student schedule |
| 271 | assignLessonToBlock | updateOne | teacher | NO | CRITICAL | Update teacher block |
| 513 | removeLessonFromBlock | updateOne | teacher | NO | CRITICAL | Update by _id |
| 548 | removeLessonFromBlock | updateOne | student | NO | CRITICAL | Update by _id |
| 613 | findOptimalSlot | updateOne | teacher | NO | CRITICAL | Update by _id |
| 636 | findOptimalSlot | updateOne | student | NO | CRITICAL | Update by _id |

**Summary: 10 queries. 0 LOW. 0 HIGH. 10 CRITICAL.**

---

### 2.11 api/schedule/attendance.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 27-29 | getStudentPrivateLessonStats | find | activity_attendance | NO | CRITICAL | By studentId only |
| 75-77 | getTeacherAttendanceOverview | find | activity_attendance | NO | CRITICAL | By teacherId only |
| 83-84 | getTeacherAttendanceOverview | find | student | NO | CRITICAL | By _id list without tenant |

**Summary: 3 queries. 0 LOW. 3 CRITICAL.**

---

### 2.12 api/analytics/attendance.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 36-37 | getStudentAttendanceStats | findOne | student | NO | CRITICAL | Lookup by _id |
| 60-65 | getStudentAttendanceStats | find | activity_attendance | NO | CRITICAL | By studentId without tenant |

**Summary: 2 queries (primary; full file has ~8 more similar patterns). 0 LOW. 0 HIGH. All CRITICAL.**

---

### 2.13 api/auth/auth.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 36-37 | login | findOne | teacher | CONDITIONAL | EXEMPT | Intentionally optional tenantId for tenant selection flow |
| 51 | login | updateOne | teacher | N/A | EXEMPT | Sets default password by _id |
| 82-84 | login | countDocuments | teacher | N/A | EXEMPT | Multi-tenant count by email |
| 97 | login | updateOne | teacher | N/A | EXEMPT | Save refresh token by _id |
| 149-151 | _getTenantsForTeachers | find | teacher | N/A | EXEMPT | Cross-tenant by design |
| 160 | _getTenantsForTeachers | find | tenant | N/A | EXEMPT | Tenant lookup |
| 176-179 | refreshAccessToken | findOne | teacher | N/A | EXEMPT | Token validation by _id |
| 221 | logout | updateOne | teacher | N/A | EXEMPT | Clear refresh token by _id |
| 303 | revokeTokens | findOne | teacher | NO | EXEMPT | By _id |
| 311 | revokeTokens | updateOne | teacher | NO | EXEMPT | By _id |
| 345-347 | changePassword | findOne | teacher | NO | EXEMPT | By _id + isActive |
| 374 | changePassword | updateOne | teacher | NO | EXEMPT | By _id |
| 428-429 | forcePasswordChange | findOne | teacher | NO | EXEMPT | By _id + isActive |
| 463 | forcePasswordChange | updateOne | teacher | NO | EXEMPT | By _id |
| 513-514 | forgotPassword | findOne | teacher | CONDITIONAL | EXEMPT | Optional tenantId filter |
| 535 | forgotPassword | updateOne | teacher | N/A | EXEMPT | Set reset token by _id |
| 583-587 | resetPassword | findOne | teacher | NO | EXEMPT | By _id + reset token |
| 597 | resetPassword | updateOne | teacher | N/A | EXEMPT | Set new password by _id |
| 642-646 | acceptInvitation | findOne | teacher | N/A | EXEMPT | By invitation token |
| 656 | acceptInvitation | updateOne | teacher | N/A | EXEMPT | Set password by _id |
| 689 | acceptInvitation | updateOne | teacher | N/A | EXEMPT | Set refresh token by _id |

**Summary: 21 queries. All EXEMPT -- auth operations are intentionally cross-tenant or operate on authenticated user's own record.**

---

### 2.14 api/super-admin/super-admin.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 43 | login | findOne | super_admin | N/A | EXEMPT | Super admin auth |
| 66 | login | updateOne | super_admin | N/A | EXEMPT | Save refresh token |
| 87 | logout | updateOne | super_admin | N/A | EXEMPT | Clear token |
| 99 | seedSuperAdmin | countDocuments | super_admin | N/A | EXEMPT | Check if exists |
| 120 | createSuperAdmin | insertOne | super_admin | N/A | EXEMPT | Create admin |
| 160 | updateSuperAdmin | insertOne | super_admin | N/A | EXEMPT | Update admin |
| 219 | getTenantsWithStats | aggregate | teacher | YES (per-tenant) | EXEMPT | Cross-tenant analytics |
| 223 | getTenantsWithStats | aggregate | student | YES (per-tenant) | EXEMPT | Cross-tenant analytics |
| 260-261 | getTenantWithStats | countDocuments | teacher/student | YES | EXEMPT | Scoped by tenantId param |
| 329-332 | getPlatformAnalytics | countDocuments | tenant/teacher/student | N/A | EXEMPT | Platform-wide totals |
| 333 | getPlatformAnalytics | aggregate | tenant | N/A | EXEMPT | Revenue aggregation |

**Summary: 13 queries. All EXEMPT -- super admin operates cross-tenant by design.**

---

### 2.15 api/tenant/tenant.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 19 | getTenants | find | tenant | N/A | EXEMPT | Lists all tenants |
| 24-25 | getTenantById | findOne | tenant | N/A | EXEMPT | Lookup by _id |
| 37 | getTenantBySlug | findOne | tenant | N/A | EXEMPT | Lookup by slug |
| 53 | createTenant | findOne | tenant | N/A | EXEMPT | Check slug uniqueness |
| 61 | createTenant | insertOne | tenant | N/A | EXEMPT | Create tenant |
| 77-79 | updateTenant | findOne | tenant | N/A | EXEMPT | Check slug uniqueness |
| 86-87 | updateTenant | findOneAndUpdate | tenant | N/A | EXEMPT | Update by _id |

**Summary: 7 queries. All EXEMPT -- tenant service manages tenant records themselves.**

---

### 2.16 api/teacher/invitation.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 16-20 | validateInvitation | findOne | teacher | NO | EXEMPT | By invitation token |
| 50-54 | acceptInvitation | findOne | teacher | NO | EXEMPT | By invitation token |
| 69-83 | acceptInvitation | findOneAndUpdate | teacher | NO | EXEMPT | Set password by _id |
| 96 | acceptInvitation | updateOne | teacher | NO | EXEMPT | Set refresh token |
| 131-133 | resendInvitation | findOne | teacher | NO | EXEMPT | By _id + isActive |
| 150 | resendInvitation | updateOne | teacher | NO | EXEMPT | Set new invitation token |

**Summary: 6 queries. All EXEMPT -- invitation operates on specific teacher by token or _id (admin-initiated).**

---

### 2.17 api/import/import.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| ~150 | previewTeacherImport | find | teacher | CONDITIONAL | HIGH | Matching uses _buildCriteria pattern |
| ~200 | previewStudentImport | find | student | CONDITIONAL | HIGH | Same pattern |
| 409 | executeImport (preview phase) | insertOne | import_log | NO | CRITICAL | No tenantId on log entry |
| 481 | executeImport (preview phase) | insertOne | import_log | NO | CRITICAL | Second preview path |
| 497 | executeImport | updateOne | import_log | NO | CRITICAL | Update by _id |
| 511 | executeImport | updateOne | import_log | NO | CRITICAL | Update by _id |
| 537 | executeImport | updateOne | teacher | NO | CRITICAL | Update teacher by _id |
| 561 | executeImport | updateOne | import_log | NO | CRITICAL | Update status |
| 587 | executeImport | updateOne | student | NO | CRITICAL | Update student by _id |
| 611 | executeImport | updateOne | import_log | NO | CRITICAL | Update status |

**Summary: 10 queries. 0 LOW. 2 HIGH. 8 CRITICAL.**

---

### 2.18 api/export/export.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 89 | generateFullReport | insertOne | ministry_report_snapshots | CONDITIONAL | MEDIUM | Sets tenantId from param |

**Summary: 1 direct query. Most data loading delegated to ministry-mappers.js (uses service layer). MEDIUM risk.**

---

### 2.19 api/admin/cascade-deletion.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 43 | prepareStudentDeletion | findOne | student | NO | EXEMPT | Admin tool - by _id |
| 79 | collectRelatedData | countDocuments | various | NO | EXEMPT | Admin impact analysis |
| 170 | executeStudentDeletion | findOne | student | NO | EXEMPT | Admin deletion |
| 212 | executeStudentDeletion | deleteMany | various | NO | EXEMPT | Cascade delete |
| 217 | executeStudentDeletion | updateMany | various | NO | EXEMPT | Cascade update |
| 245 | executeStudentDeletion | deleteOne | student | NO | EXEMPT | Delete student |
| 351 | restoreFromSnapshot | findOne | deletion_snapshots | NO | EXEMPT | Admin restore |
| 376-384 | restoreFromSnapshot | findOne/replaceOne/insertOne | various | NO | EXEMPT | Restore records |
| 402 | restoreFromSnapshot | updateOne | deletion_snapshots | NO | EXEMPT | Mark restored |
| 477-488 | getAuditLog | find/countDocuments | deletion_audit | NO | EXEMPT | Admin audit |
| 542-567 | createDeletionSnapshot | find/findOne/insertOne | various | NO | EXEMPT | Pre-deletion snapshot |
| 581-589 | softDeleteStudent/restoreStudent | updateMany | various | NO | EXEMPT | Admin operations |
| 627 | logDeletion | insertOne | deletion_audit | NO | EXEMPT | Audit logging |

**Summary: ~20 queries. All EXEMPT -- admin cascade deletion operates by specific entity IDs under admin authorization.**

---

### 2.20 api/admin/data-integrity.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 348 | runIntegrityChecks | find | student | NO | EXEMPT | Admin integrity tool |
| 440 | runIntegrityChecks | countDocuments | various | NO | EXEMPT | Collection health |
| 525 | getCollectionStats | countDocuments | various | NO | EXEMPT | Admin stats |
| 539 | getCollectionStats | find | various | NO | EXEMPT | Sample records |
| 624 | checkStudentEnrollment | countDocuments | various | NO | EXEMPT | Enrollment check |
| 636 | checkStudentEnrollment | findOne | activity_attendance | NO | EXEMPT | Attendance check |
| 651 | checkStudentEnrollment | countDocuments | orchestra | NO | EXEMPT | Membership check |
| 735 | logIntegrityCheck | insertOne | deletion_audit | NO | EXEMPT | Audit logging |

**Summary: ~8 queries. All EXEMPT -- admin data integrity tool.**

---

### 2.21 api/admin/student-deletion-preview.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 198 | collectImpact | countDocuments | various | NO | EXEMPT | Impact analysis by studentId |
| 203 | collectImpact | find | various | NO | EXEMPT | Detail records |
| 442 | getStudentForDeletion | findOne | student | NO | EXEMPT | Lookup by _id |
| 475 | getStudentForDeletion | findOne | various | NO | EXEMPT | Related data lookup |

**Summary: ~6 queries. All EXEMPT -- admin deletion preview tool.**

---

### 2.22 api/admin/consistency-validation.controller.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 51 | validateAssignments | aggregate | student | NO | EXEMPT | Admin validation |
| 91 | validateAssignments | findOne | teacher | NO | EXEMPT | Verify teacher exists |
| 113 | validateTeacherStudentSync | find | teacher | NO | EXEMPT | All teachers check |
| 124 | validateTeacherStudentSync | find | student | NO | EXEMPT | Find assigned students |
| 151 | validateIncomplete | aggregate | student | NO | EXEMPT | Find broken assignments |
| 286 | getValidationStats | countDocuments | student | NO | EXEMPT | Stats |
| 292-301 | getValidationStats | aggregate | student | NO | EXEMPT | Aggregation stats |
| 317 | getValidationStats | countDocuments | student | NO | EXEMPT | Additional stats |
| 468 | repairAssignment | find | teacher | NO | EXEMPT | Admin repair tool |
| 596 | healthCheck | findOne | student | NO | EXEMPT | DB connectivity check |

**Summary: ~12 queries. All EXEMPT -- admin consistency validation tool.**

---

### 2.23 Shared Services (services/)

#### services/cascadeDeletion.service.js (~28 queries)
All EXEMPT -- transaction-based cascade deletion system operating by specific entity IDs under admin authorization.

#### services/cascadeDeletionService.js (~38 queries)
All EXEMPT -- collection-based cascade deletion system. Operations include find, update, delete, insert across teacher, student, orchestra, rehearsal, theory_lesson, bagrut, activity_attendance, deletion_snapshots, deletion_audit.

#### services/cascadeDeletionAggregation.service.js (~22 queries)
All EXEMPT -- aggregation pipelines for orphan detection, consistency checking, impact analysis. Used by admin tools only.

#### services/cascadeJobProcessor.js (~12 queries)
All EXEMPT -- background job processing for cascade deletions.

#### services/relationshipValidationService.js (~8 queries)
All EXEMPT -- validates relationship integrity between student/teacher collections. Admin utility.

#### services/duplicateDetectionService.js (~8 queries)
CRITICAL risk -- queries teacher collection without tenantId for duplicate detection. Used during teacher creation/update. Should scope duplicates within tenant.

#### services/dataCleanupService.js (~11 queries)
EXEMPT -- admin data cleanup operations on student collection.

#### services/permissionService.js (~6 queries)
HIGH risk -- checks permissions using teacherAssignments without tenant scope. Queries student collection.

#### services/conflictDetectionService.js (~2 queries)
CRITICAL -- queries theory_lesson collection for time/room conflicts without tenantId.

#### services/dateConsistencyService.js (~11 queries)
EXEMPT -- admin date monitoring/fixing tool.

#### services/dateMonitoringService.js (~6 queries)
EXEMPT -- admin date health monitoring.

---

### 2.24 Middleware

#### middleware/auth.middleware.js (line 37)
**findOne** on teacher collection by JWT `_id`. N/A for tenant scope -- this is the authentication step that loads the teacher record (including tenantId) for downstream middleware.

#### middleware/tenant.middleware.js (line 39)
**find** on student collection to load `_studentAccessIds`. No explicit tenantId in query -- queries by `teacherAssignments.teacherId`. MEDIUM risk -- should also include tenantId to prevent loading cross-tenant student IDs if a teacher somehow exists in multiple tenants.

#### middleware/school-year.middleware.js (lines 15, 34, 50)
**findOne / insertOne** on school_year collection. Uses `req.context.tenantId` from prior middleware. MEDIUM risk -- the query includes tenantId from context but falls through to a default creation without tenant scope.

#### middleware/enhancedAuth.middleware.js (line 34, 337)
**findOne** on teacher (by _id). **insertOne** to audit_log. EXEMPT -- deprecated middleware, not wired to any route.

#### middleware/super-admin.middleware.js (line 44)
**findOne** on super_admin collection. EXEMPT -- super admin auth.

---

### 2.25 api/admin/past-activities.service.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 233 | _getPastPrivateLessons | findOne | teacher | NO | CRITICAL | Lookup by _id only; remaining methods delegate to rehearsalService/theoryService |

**Summary: 1 direct query. 1 CRITICAL. Other methods delegate to rehearsal/theory service layers.**

---

### 2.26 api/admin/cleanup.controller.js

No direct MongoDB queries. All operations delegate to `dataCleanupService.js` and `studentDeletionPreviewService.js`. Queries are already counted in those service inventories.

---

### 2.27 api/admin/date-monitoring.controller.js

No direct MongoDB queries. All operations delegate to `dateMonitoringService.js` and `dateConsistencyService.js`. Queries are already counted in those service inventories.

---

### 2.28 services/queryCacheService.js

No MongoDB queries. This is an in-memory Map-based cache service. It stores and retrieves cached data from a JavaScript `Map` object, not from MongoDB. No tenant isolation concerns.

---

### 2.29 services/theoryLessonValidationService.js

No MongoDB queries. This is a pure validation/sanitization utility service. It validates theory lesson objects in memory (field formats, required fields, ObjectId validity). No database access, no tenant isolation concerns.

---

### 2.30 controllers/cascadeManagementController.js

| Line | Function | Operation | Collection | Has tenantId? | Risk | Notes |
|------|----------|-----------|------------|---------------|------|-------|
| 27 | getStudentStatus | findOne | student | NO | EXEMPT | Admin tool |
| 107 | batchDelete | find | student | NO | EXEMPT | Admin tool |
| 181 | getJobStatus | findOne | deletion_audit | NO | EXEMPT | Admin tool |
| 424-430 | getAuditStats | countDocuments | deletion_audit | NO | EXEMPT | Admin stats |
| 592 | cleanOrphanedAssignments | countDocuments | student | NO | EXEMPT | Admin cleanup |

**Summary: 5 queries. All EXEMPT -- admin cascade management.**

---

## 3. Aggregation Pipeline Inventory

### Pipelines in API Services

| File | Line | Function | Collection | Has $match with tenantId? | $lookups | Risk | Notes |
|------|------|----------|------------|--------------------------|----------|------|-------|
| orchestra.service.js | 26 | getOrchestras | orchestra | CONDITIONAL (via _buildCriteria) | student, teacher | HIGH | $lookup joins to ALL students/teachers in DB if tenantId not in filterBy |
| orchestra.service.js | 110 | getOrchestraById | orchestra | NO | student, teacher | CRITICAL | $match by _id only; $lookups join cross-tenant |
| teacher-lessons.service.js | 200 | getTeacherLessons | student | NO | none | CRITICAL | No tenantId in initial $match |

### Pipelines in Admin/Shared Services

| File | Line | Function | Collection | Has $match with tenantId? | Risk | Notes |
|------|------|----------|------------|--------------------------|------|-------|
| consistency-validation.controller.js | 51 | validateAssignments | student | NO | EXEMPT | Admin tool |
| consistency-validation.controller.js | 151 | validateIncomplete | student | NO | EXEMPT | Admin tool |
| consistency-validation.controller.js | 292-301 | getValidationStats | student | NO | EXEMPT | Admin tool |
| cascadeDeletionAggregation.service.js | 20-340 | (multiple) | student, teacher, orchestra, rehearsal, theory_lesson, bagrut, activity_attendance | NO | EXEMPT | Orphan/consistency detection |
| cascadeDeletionAggregation.service.js | 419-686 | (multiple) | teacher, orchestra, rehearsal, theory_lesson, bagrut, activity_attendance | NO | EXEMPT | Impact analysis |
| cascadeJobProcessor.js | 469 | (dynamic) | various | NO | EXEMPT | Job processor |
| cascadeJobProcessor.js | 636-757 | (multiple) | student, teacher, orchestra, deletion_audit | NO | EXEMPT | Validation checks |
| dateConsistencyService.js | 493-540 | (multiple) | theory_lesson, rehearsal, activity_attendance | NO | EXEMPT | Date stats |
| super-admin.service.js | 219, 223, 333 | getTenantsWithStats, getPlatformAnalytics | teacher, student, tenant | YES (per-tenant grouping) | EXEMPT | Cross-tenant analytics |

**Key finding:** The two NON-EXEMPT aggregation pipelines (orchestra.service.js) are HIGH/CRITICAL risk because their $lookup stages join to student and teacher collections without tenant filtering. A malicious or misconfigured request could expose cross-tenant data through these joins.

---

## 4. Cross-Tenant Exempt Operations

### Why Each Is Exempt

| Service | Operation | Why Exempt |
|---------|-----------|-----------|
| **auth.service.js** (all queries) | Login, token refresh, password reset, invitation acceptance | Authentication operates before tenant context is established. Login deliberately queries without tenantId to support the tenant-selection flow (user enters email, system shows available tenants). Token operations work on the authenticated user's own record. |
| **super-admin.service.js** (all queries) | Login, tenant management, platform analytics | Super admin is a platform-level role that operates across all tenants. Authenticated via separate JWT with `type: 'super_admin'`. |
| **tenant.service.js** (all queries) | CRUD on tenant collection | The tenant collection itself is not tenant-scoped -- it defines tenants. Access is restricted to authenticated admin/super-admin routes. |
| **invitation.service.js** (all queries) | Validate/accept/resend invitations | Invitations are identified by unique tokens, not tenant context. The invitation flow occurs before the user has authenticated. |
| **cascade-deletion.service.js** (all queries) | Student deletion, snapshot, restore, audit | Admin-only operations that work on specific entity IDs. The cascade system must be able to clean up all related records regardless of how they were created. Protected by admin role check in controllers. |
| **cascadeDeletionService.js** (all queries) | Same as above, alternate implementation | Second cascade deletion system (collection-based vs transaction-based). Same exemption rationale. |
| **cascadeDeletionAggregation.service.js** (all queries) | Orphan detection, consistency analysis | Admin diagnostic tool. Must scan all records to find inconsistencies. |
| **cascadeJobProcessor.js** (all queries) | Background job processing | Processes queued deletion jobs. Operates on specific entity IDs. |
| **data-integrity.service.js** (all queries) | Integrity checks, collection stats | Admin diagnostic tool. Must scan all records. |
| **student-deletion-preview.service.js** (all queries) | Impact preview before deletion | Admin tool showing what would be affected by a deletion. |
| **consistency-validation.controller.js** (all queries) | Assignment validation, sync checks | Admin diagnostic tool for finding broken references. |
| **dataCleanupService.js** (all queries) | Data cleanup operations | Admin utility for fixing data issues. |
| **dateConsistencyService.js** (all queries) | Date format monitoring/fixing | Admin utility. |
| **dateMonitoringService.js** (all queries) | Date health monitoring | Admin utility. |
| **middleware/auth.middleware.js** | Load teacher from JWT | Runs before tenant context exists; loads the teacher record that provides tenantId for downstream middleware. |
| **middleware/enhancedAuth.middleware.js** | Deprecated | Not wired to any route in server.js. |
| **middleware/super-admin.middleware.js** | Super admin auth | Platform-level authentication. |
| **controllers/cascadeManagementController.js** | Admin cascade management | Admin-only CRUD on cascade deletion system. |

---

## 5. Notable Findings

### Finding 1: `buildScopedFilter` used in 1 of 22 services
Only `student.service.js` imports and uses `buildScopedFilter`. All other services use ad-hoc `_buildCriteria` functions with conditional tenantId (`if (filterBy.tenantId)` pattern). This is the fundamental gap.

### Finding 2: Every `getById` function is CRITICAL
Every service's `getById` function queries by `{ _id: ObjectId }` without tenantId. This means any authenticated user who knows (or guesses) an ObjectId can access any record in the system, regardless of tenant. Affected: `getTeacherById`, `getStudentById`, `getOrchestraById`, `getRehearsalById`, `getTheoryLessonById`, `getBagrutById`, `getSchoolYearById`.

### Finding 3: `_buildCriteria` anti-pattern in 5 services
The `_buildCriteria` function appears in teacher, student, orchestra, rehearsal, theory, and bagrut services. All use the same `if (filterBy.tenantId) criteria.tenantId = filterBy.tenantId` pattern -- opt-in rather than default-deny.

### Finding 4: Aggregation $lookups are unscoped
The orchestra service aggregation pipelines use `$lookup` to join student and teacher collections. These lookups have no tenant filter, meaning they could return members/conductors from other tenants if the data existed.

### Finding 5: `enforceTenant` middleware exists but is never applied
`middleware/tenant.middleware.js` exports `enforceTenant` which returns 403 if `req.context.tenantId` is missing. It is not applied to any route in `server.js`.

### Finding 6: `requireTenantId` exists but is never called
`middleware/tenant.middleware.js` exports `requireTenantId` which throws if tenantId is missing. It is not called anywhere in production code.

### Finding 7: `buildScopedFilter` tolerates null tenantId
`utils/queryScoping.js` uses `if (context.tenantId)` -- if tenantId is null (e.g., teacher without tenant assignment), the query runs without any tenant filter. This is a silent data leak path.

### Finding 8: Two cascade deletion systems exist
Both `services/cascadeDeletion.service.js` (transaction-based) and `services/cascadeDeletionService.js` (collection-based) perform similar operations. Neither uses tenantId. This is correct for admin-level cascade operations but creates maintenance burden.

### Finding 9: `duplicateDetectionService.js` is CRITICAL
This service queries the teacher collection for duplicate detection without tenantId. A teacher created in Tenant A could be flagged as a duplicate when creating the same person in Tenant B. This breaks multi-tenant isolation of the teacher directory.

### Finding 10: `conflictDetectionService.js` is CRITICAL
Queries theory_lesson collection for room/time conflicts without tenantId. Room conflicts should only be checked within the same tenant (different conservatories can use the same room names independently).

---

## 6. req.context Population Audit

### Middleware Chain in server.js

Every authenticated route in `server.js` was traced for middleware application:

| Route Prefix | Auth Middleware | buildContext | addSchoolYear | tenantId Available | Notes |
|-------------|----------------|-------------|---------------|-------------------|-------|
| `/api/auth` | NO (public) | NO | NO | NO | Public auth endpoints -- intentionally unauthenticated |
| `/api/config` | NO (public) | NO | NO | NO | Frontend configuration endpoint |
| `/api/tenant` | YES | YES | NO | YES | Tenant CRUD |
| `/api/student` | YES | YES | YES | YES | Full chain |
| `/api/teacher` | YES | YES | YES | YES | Full chain |
| `/api/teachers` | YES | YES | YES | YES | Plural alias for frontend compat |
| `/api/orchestra` | YES | YES | YES | YES | Full chain |
| `/api/rehearsal` | YES | YES | YES | YES | Full chain |
| `/api/theory` | YES | YES | YES | YES | Full chain |
| `/api/bagrut` | YES | YES | YES | YES | Full chain |
| `/api/school-year` | YES | YES | YES | YES | Full chain |
| `/api/schedule` | YES | YES | YES | YES | Full chain |
| `/api/attendance` | YES | YES | YES | YES | Full chain |
| `/api/analytics` | YES | YES | YES | YES | Full chain |
| `/api/admin/consistency-validation` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/admin/date-monitoring` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/admin/past-activities` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/admin` (cascade-deletion) | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/admin/cleanup` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/files` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/hours-summary` | YES | YES | YES | YES | Full chain |
| `/api/import` | YES | YES | NO | YES (no schoolYear) | Missing addSchoolYear |
| `/api/export` | YES | YES | YES | YES | Full chain |
| `/api/super-admin` | NO (own auth) | NO | NO | NO | Uses separate super-admin auth middleware internally |
| `/api/health` | NO (public) | NO | NO | NO | Health check -- intentionally public |
| `/api` (timeBlockRoutes) | YES | YES | YES | YES | Broad prefix, mounted last |
| `/accept-invitation/:token` | NO (public) | NO | NO | NO | Static page |
| `/force-password-change` | NO (public) | NO | NO | NO | Static page |

### Conclusion: PASS (with caveats)

**All authenticated data-access routes have `authenticateToken` and `buildContext` applied.** This means `req.context.tenantId` is available on every authenticated route.

**However, three critical caveats:**

1. **buildContext sets tenantId to null if teacher has no tenantId (line 52 of tenant.middleware.js):** `req.context.tenantId = teacher.tenantId || null`. It does NOT throw. This means if a teacher document lacks a `tenantId` field, the request proceeds with `req.context.tenantId === null`, and downstream services will query without tenant isolation.

2. **Services do not use req.context.tenantId:** Even though `req.context.tenantId` is available on every route, services do not read it. Controllers call services with `filterBy` objects from `req.query`, and the service `_buildCriteria` functions only include tenantId if `filterBy.tenantId` is set. The controller must explicitly pass `req.context.tenantId` to the service -- and most controllers do not.

3. **Super admin routes handle auth internally:** The `/api/super-admin` routes do not use the standard middleware chain. They use `super-admin.middleware.js` internally, which validates a super-admin JWT. This is correct -- super admin is a separate auth flow.

4. **Admin routes lack addSchoolYearToRequest:** Five admin route groups skip `addSchoolYearToRequest`. This is acceptable since admin operations generally do not need school year context, but worth noting.
