# Tenant Enforcement Checklist

**Last updated:** 2026-02-14
**Data source:** `docs/query-inventory.md` (288 query locations, 2026-02-14)
**Purpose:** Ground truth for Phase 2 query hardening. Every route/service pair marked pass or fail.

---

## Legend

| Status | Symbol | Meaning |
|--------|--------|---------|
| **PASS** | PASS | Service uses `buildScopedFilter` with context, and controller passes context |
| **FAIL** | FAIL | Service has no tenantId, or tenantId is conditional but controller does not pass context object |
| **PARTIAL** | PARTIAL | Service has conditional tenantId AND controller does pass tenantId (works but fragile -- not canonical pattern) |
| **EXEMPT** | EXEMPT | Intentionally cross-tenant (auth, super-admin, health, cascade deletion) |
| **N/A** | N/A | No database query involved (static response, file serving, redirect) |

## Priority Levels

| Priority | Criteria |
|----------|----------|
| **P0** (Critical) | Read operations that could leak data across tenants (GET endpoints with FAIL status) |
| **P1** (High) | Write operations that could affect wrong tenant's data (POST/PUT/DELETE with FAIL) |
| **P2** (Medium) | Operations with PARTIAL status (works but not using canonical pattern) |
| **P3** (Low) | Admin-only operations with FAIL (lower risk because admin access is restricted) |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total route endpoints** | 105 |
| **PASS** | 1 |
| **FAIL** | 50 |
| **PARTIAL** | 17 |
| **EXEMPT** | 31 |
| **N/A** | 6 |

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 17 | GET endpoints with FAIL -- data leak risk |
| **P1** | 33 | POST/PUT/DELETE endpoints with FAIL -- data corruption risk |
| **P2** | 17 | PARTIAL endpoints -- works but fragile |
| **P3** | 0 | Admin FAIL endpoints (all admin ops are EXEMPT) |

---

## Module Checklists

### Module: student

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/student | GET | getStudents | getStudents | YES (context) | YES (buildScopedFilter) | PASS | -- |
| /api/student/:id | GET | getStudentById | getStudentById | YES (tenantId) | CONDITIONAL | PARTIAL | P2 |
| /api/student | POST | addStudent | addStudent | NO | NO | FAIL | P1 |
| /api/student/:id | PUT | updateStudent | updateStudent | NO | NO | FAIL | P1 |
| /api/student/:id/test | PUT | updateStudentTest | updateStudentTest | NO | NO | FAIL | P1 |
| /api/student/:id/stage-level | PATCH | updateStudentStageLevel | updateStudentStageLevel | NO | NO | FAIL | P1 |
| /api/student/:id | DELETE | removeStudent | removeStudent | NO | NO | FAIL | P1 |
| /api/student/:studentId/private-lesson-attendance | GET | getStudentPrivateLessonStats | getStudentPrivateLessonStats | NO | NO | FAIL | P0 |
| /api/student/:studentId/attendance-history | GET | getStudentAttendanceHistory | getStudentAttendanceHistory | NO | NO | FAIL | P0 |

**Summary: 9 endpoints. 1 PASS, 1 PARTIAL, 7 FAIL.**

---

### Module: teacher

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/teacher | GET | getTeachers | getTeachers | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/teacher/profile/me | GET | getMyProfile | getTeacherById | YES (tenantId) | CONDITIONAL | PARTIAL | P2 |
| /api/teacher/profile/me | PUT | updateMyProfile | updateTeacher | NO | NO | FAIL | P1 |
| /api/teacher/debug/ids | GET | getTeacherIds | getTeacherIds | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/lessons | GET | getTeacherLessons | getTeacherLessons | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/weekly-schedule | GET | getTeacherWeeklySchedule | getTeacherLessons | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/day-schedule/:day | GET | getTeacherDaySchedule | getTeacherLessons | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/lesson-stats | GET | getTeacherLessonStats | getTeacherLessons | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/students-with-lessons | GET | getTeacherStudentsWithLessons | getTeacherLessons | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/validate-lessons | GET | validateTeacherLessonData | validateTeacherLessonData | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/lesson-attendance-summary | GET | getTeacherAttendanceOverview | getTeacherAttendanceOverview | NO | NO | FAIL | P0 |
| /api/teacher/:id | GET | getTeacherById | getTeacherById | YES (tenantId) | CONDITIONAL | PARTIAL | P2 |
| /api/teacher/role/:role | GET | getTeacherByRole | getTeacherByRole | YES (tenantId) | CONDITIONAL | PARTIAL | P2 |
| /api/teacher | POST | addTeacher | addTeacher | YES (tenantId on body) | NO (not in query) | FAIL | P1 |
| /api/teacher/:id/schedule | POST | updateTeacherSchedule | updateTeacherSchedule | NO | NO | FAIL | P1 |
| /api/teacher/:id | PUT | updateTeacher | updateTeacher | NO | NO | FAIL | P1 |
| /api/teacher/:id | DELETE | removeTeacher | removeTeacher | NO | NO | FAIL | P1 |
| /api/teacher/:teacherId/student/:studentId | POST | addStudentToTeacher | addStudentToTeacher | NO | NO | FAIL | P1 |
| /api/teacher/:teacherId/student/:studentId | DELETE | removeStudentFromTeacher | removeStudentFromTeacher | NO | NO | FAIL | P1 |
| /api/teacher/:teacherId/time-blocks | GET | getTimeBlocks | getTimeBlocks | NO | NO | FAIL | P0 |
| /api/teacher/:teacherId/time-block | POST | createTimeBlock | createTimeBlock | NO | NO | FAIL | P1 |
| /api/teacher/:teacherId/time-block/:timeBlockId | PUT | updateTimeBlock | updateTimeBlock | NO | NO | FAIL | P1 |
| /api/teacher/:teacherId/time-block/:timeBlockId | DELETE | deleteTimeBlock | deleteTimeBlock | NO | NO | FAIL | P1 |
| /api/teacher/invitation/validate/:token | GET | validateInvitation | validateInvitation | NO (public) | NO | EXEMPT | -- |
| /api/teacher/invitation/accept/:token | POST | acceptInvitation | acceptInvitation | NO (public) | NO | EXEMPT | -- |
| /api/teacher/invitation/resend/:teacherId | POST | resendInvitation | resendInvitation | NO | NO | EXEMPT | -- |

**Summary: 26 endpoints. 0 PASS, 4 PARTIAL, 19 FAIL, 3 EXEMPT.**

---

### Module: orchestra

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/orchestra | GET | getOrchestras | getOrchestras | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/orchestra/:id | GET | getOrchestraById | getOrchestraById | NO | NO | FAIL | P0 |
| /api/orchestra | POST | addOrchestra | addOrchestra | YES (tenantId on body) | NO (not in query) | FAIL | P1 |
| /api/orchestra/:id | PUT | updateOrchestra | updateOrchestra | NO | NO | FAIL | P1 |
| /api/orchestra/:id | DELETE | removeOrchestra | removeOrchestra | NO | NO | FAIL | P1 |
| /api/orchestra/:id/members | POST | addMember | addMember | NO | NO | FAIL | P1 |
| /api/orchestra/:id/members/:studentId | DELETE | removeMember | removeMember | NO | NO | FAIL | P1 |
| /api/orchestra/:id/rehearsals/:rehearsalId/attendance | GET | getRehearsalAttendance | getRehearsalAttendance | NO | NO | FAIL | P0 |
| /api/orchestra/:id/rehearsals/:rehearsalId/attendance | PUT | updateRehearsalAttendance | updateRehearsalAttendance | NO | NO | FAIL | P1 |
| /api/orchestra/:orchestraId/student/:studentId/attendance | GET | getStudentAttendanceStats | getStudentAttendanceStats | NO | NO | FAIL | P0 |

**Summary: 10 endpoints. 0 PASS, 1 PARTIAL, 9 FAIL.**

---

### Module: rehearsal

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/rehearsal | GET | getRehearsals | getRehearsals | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/rehearsal/orchestra/:orchestraId | GET | getOrchestraRehearsals | getRehearsals | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/rehearsal/:id | GET | getRehearsalById | getRehearsalById | NO | NO | FAIL | P0 |
| /api/rehearsal | POST | addRehearsal | addRehearsal | NO | NO | FAIL | P1 |
| /api/rehearsal/:id | PUT | updateRehearsal | updateRehearsal | NO | NO | FAIL | P1 |
| /api/rehearsal/:id | DELETE | removeRehearsal | removeRehearsal | NO | NO | FAIL | P1 |
| /api/rehearsal/:rehearsalId/attendance | PUT | updateAttendance | updateAttendance | NO | NO | FAIL | P1 |
| /api/rehearsal/bulk | POST | bulkCreateRehearsals | bulkCreateRehearsals | NO | NO | FAIL | P1 |
| /api/rehearsal/orchestra/:orchestraId | DELETE | bulkDeleteRehearsalsByOrchestra | bulkDeleteRehearsalsByOrchestra | NO | NO | FAIL | P1 |
| /api/rehearsal/orchestra/:orchestraId/date-range | DELETE | bulkDeleteRehearsalsByDateRange | bulkDeleteRehearsalsByDateRange | NO | NO | FAIL | P1 |
| /api/rehearsal/orchestra/:orchestraId | PUT | bulkUpdateRehearsalsByOrchestra | bulkUpdateRehearsalsByOrchestra | NO | NO | FAIL | P1 |

**Summary: 11 endpoints. 0 PASS, 2 PARTIAL, 9 FAIL.**

---

### Module: theory

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/theory | GET | getTheoryLessons | getTheoryLessons | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/theory/category/:category | GET | getTheoryLessonsByCategory | getTheoryLessons | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/theory/teacher/:teacherId | GET | getTheoryLessonsByTeacher | getTheoryLessons | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/theory/student/:studentId/stats | GET | getStudentTheoryAttendanceStats | getStudentTheoryAttendanceStats | NO | NO | FAIL | P0 |
| /api/theory/:id | GET | getTheoryLessonById | getTheoryLessonById | NO | NO | FAIL | P0 |
| /api/theory/:id/attendance | GET | getTheoryAttendance | (inline query) | NO | NO | FAIL | P0 |
| /api/theory | POST | addTheoryLesson | addTheoryLesson | NO | NO | FAIL | P1 |
| /api/theory/bulk-create | POST | bulkCreateTheoryLessons | bulkCreateTheoryLessons | NO | NO | FAIL | P1 |
| /api/theory/:id/student | POST | addStudentToTheory | addStudentToTheory | NO | NO | FAIL | P1 |
| /api/theory/:id | PUT | updateTheoryLesson | updateTheoryLesson | NO | NO | FAIL | P1 |
| /api/theory/:id/attendance | PUT | updateTheoryAttendance | updateTheoryAttendance | NO | NO | FAIL | P1 |
| /api/theory/bulk-delete-by-date | DELETE | bulkDeleteTheoryLessonsByDate | bulkDeleteTheoryLessonsByDate | NO | NO | FAIL | P1 |
| /api/theory/bulk-delete-by-category/:category | DELETE | bulkDeleteTheoryLessonsByCategory | bulkDeleteTheoryLessonsByCategory | NO | NO | FAIL | P1 |
| /api/theory/bulk-delete-by-teacher/:teacherId | DELETE | bulkDeleteTheoryLessonsByTeacher | bulkDeleteTheoryLessonsByTeacher | NO | NO | FAIL | P1 |
| /api/theory/:id | DELETE | removeTheoryLesson | removeTheoryLesson | NO | NO | FAIL | P1 |
| /api/theory/:id/student/:studentId | DELETE | removeStudentFromTheory | removeStudentFromTheory | NO | NO | FAIL | P1 |

**Summary: 16 endpoints. 0 PASS, 3 PARTIAL, 13 FAIL.**

---

### Module: bagrut

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/bagrut | GET | getBagruts | getBagruts | YES (tenantId in filterBy) | CONDITIONAL | PARTIAL | P2 |
| /api/bagrut/:id | GET | getBagrutById | getBagrutById | NO | NO | FAIL | P0 |
| /api/bagrut/student/:studentId | GET | getBagrutByStudentId | getBagrutByStudentId | NO | NO | FAIL | P0 |
| /api/bagrut | POST | addBagrut | addBagrut | NO | NO | FAIL | P1 |
| /api/bagrut/:id | PUT | updateBagrut | updateBagrut | NO | NO | FAIL | P1 |
| /api/bagrut/:id | DELETE | removeBagrut | removeBagrut | NO | NO | FAIL | P1 |
| /api/bagrut/:id/presentation/:presentationIndex | PUT | updatePresentation | updatePresentation | NO | NO | FAIL | P1 |
| /api/bagrut/:id/magenBagrut | PUT | updateMagenBagrut | updateMagenBagrut | NO | NO | FAIL | P1 |
| /api/bagrut/:id/gradingDetails | PUT | updateGradingDetails | updateGradingDetails | NO | NO | FAIL | P1 |
| /api/bagrut/:id/calculateFinalGrade | PUT | calculateFinalGrade | calculateAndUpdateFinalGrade | NO | NO | FAIL | P1 |
| /api/bagrut/:id/complete | PUT | completeBagrut | completeBagrut | NO | NO | FAIL | P1 |
| /api/bagrut/:id/directorEvaluation | PUT | updateDirectorEvaluation | updateDirectorEvaluation | NO | NO | FAIL | P1 |
| /api/bagrut/:id/recitalConfiguration | PUT | setRecitalConfiguration | setRecitalConfiguration | NO | NO | FAIL | P1 |
| /api/bagrut/:id/document | POST | addDocument | addDocument | NO | NO | FAIL | P1 |
| /api/bagrut/:id/document/:documentId | DELETE | removeDocument | removeDocument | NO | NO | FAIL | P1 |
| /api/bagrut/:id/program | POST | addProgramPiece | addProgramPiece | NO | NO | FAIL | P1 |
| /api/bagrut/:id/program | PUT | updateProgram | updateProgram | NO | NO | FAIL | P1 |
| /api/bagrut/:id/program/:pieceId | DELETE | removeProgramPiece | removeProgramPiece | NO | NO | FAIL | P1 |
| /api/bagrut/:id/accompanist | POST | addAccompanist | addAccompanist | NO | NO | FAIL | P1 |
| /api/bagrut/:id/accompanist/:accompanistId | DELETE | removeAccompanist | removeAccompanist | NO | NO | FAIL | P1 |

**Summary: 20 endpoints. 0 PASS, 1 PARTIAL, 19 FAIL.**

---

### Module: school-year

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/school-year | GET | getSchoolYears | getSchoolYears | NO | CONDITIONAL | FAIL | P0 |
| /api/school-year/current | GET | getCurrentSchoolYear | getCurrentSchoolYear | NO | CONDITIONAL | FAIL | P0 |
| /api/school-year/:id | GET | getSchoolYearById | getSchoolYearById | NO | NO | FAIL | P0 |
| /api/school-year | POST | createSchoolYear | createSchoolYear | NO | NO | FAIL | P1 |
| /api/school-year/:id | PUT | updateSchoolYear | updateSchoolYear | NO | NO | FAIL | P1 |
| /api/school-year/:id/set-current | PUT | setCurrentSchoolYear | setCurrentSchoolYear | NO | NO | FAIL | P1 |
| /api/school-year/:id/rollover | PUT | rolloverToNewYear | rolloverToNewYear | NO | NO | FAIL | P1 |

**Summary: 7 endpoints. 0 PASS, 0 PARTIAL, 7 FAIL.**

---

### Module: schedule

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/schedule/repair | POST | repairRelationships | repair-relationships.js | NO | NO | FAIL | P1 |
| /api/schedule/validate | GET | validateIntegrity | (inline) | NO | NO | FAIL | P0 |
| /api/schedule/teacher/:teacherId/assign-student | POST | assignStudentToTeacher | (inline) | NO | NO | FAIL | P1 |
| /api/schedule/teacher/:teacherId/students/:studentId | DELETE | removeStudentFromTeacher | (inline) | NO | NO | FAIL | P1 |
| /api/schedule/migrate-to-time-blocks | POST | migrateToTimeBlocks | (inline) | NO | NO | FAIL | P1 |
| /api/schedule/migration-backup | POST | createMigrationBackup | (inline) | NO | NO | FAIL | P1 |
| /api/schedule/rollback-migration | POST | rollbackTimeBlockMigration | (inline) | NO | NO | FAIL | P1 |
| /api/schedule/migration-report | GET | getMigrationReport | (inline) | NO | NO | FAIL | P0 |

**Sub-module: time-block (mounted at /api/schedule/time-blocks and /api/time-block via dual mount)**

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| POST /teacher/:teacherId/time-block | POST | createTimeBlock | createTimeBlock | NO | NO | FAIL | P1 |
| PUT /teacher/:teacherId/time-block/:blockId | PUT | updateTimeBlock | updateTimeBlock | NO | NO | FAIL | P1 |
| DELETE /teacher/:teacherId/time-block/:blockId | DELETE | deleteTimeBlock | deleteTimeBlock | NO | NO | FAIL | P1 |
| GET /teacher/:teacherId/time-blocks | GET | getTeacherTimeBlocks | getTimeBlocks | NO | NO | FAIL | P0 |
| GET /teacher/:teacherId/schedule-with-blocks | GET | getTeacherScheduleWithBlocks | getTimeBlocks | NO | NO | FAIL | P0 |
| GET /teacher/:teacherId/available-slots | GET | getAvailableSlots | (derived) | NO | NO | FAIL | P0 |
| POST /teacher/:teacherId/find-optimal-slot | POST | findOptimalSlot | findOptimalSlot | NO | NO | FAIL | P1 |
| POST /assign-lesson | POST | assignLessonToBlock | assignLessonToBlock | NO | NO | FAIL | P1 |
| DELETE /lesson/:teacherId/:timeBlockId/:lessonId | DELETE | removeLessonFromBlock | removeLessonFromBlock | NO | NO | FAIL | P1 |
| POST /lesson-options | POST | getLessonScheduleOptions | (derived) | NO | NO | FAIL | P1 |
| GET /teacher/:teacherId/utilization-stats | GET | getBlockUtilizationStats | (derived) | NO | NO | FAIL | P0 |

**Summary: 19 endpoints. 0 PASS, 0 PARTIAL, 19 FAIL.**

---

### Module: attendance (schedule/attendance)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/attendance/students/:studentId/private-lesson-attendance | GET | getStudentPrivateLessonStats | getStudentPrivateLessonStats | NO | NO | FAIL | P0 |
| /api/attendance/students/:studentId/attendance-history | GET | getStudentAttendanceHistory | getStudentAttendanceHistory | NO | NO | FAIL | P0 |
| /api/attendance/teachers/:teacherId/lesson-attendance-summary | GET | getTeacherAttendanceOverview | getTeacherAttendanceOverview | NO | NO | FAIL | P0 |

**Summary: 3 endpoints. 0 PASS, 0 PARTIAL, 3 FAIL.**

---

### Module: analytics

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/analytics/students/:studentId/attendance | GET | getStudentAttendanceStats | getStudentAttendanceStats | NO | NO | FAIL | P0 |
| /api/analytics/teachers/:teacherId/attendance | GET | getTeacherAttendanceAnalytics | getTeacherAttendanceAnalytics | NO | NO | FAIL | P0 |
| /api/analytics/attendance/overall | GET | getOverallAttendanceReport | getOverallAttendanceReport | NO | NO | FAIL | P0 |
| /api/analytics/attendance/trends | GET | getAttendanceTrends | getAttendanceTrends | NO | NO | FAIL | P0 |
| /api/analytics/attendance/compare | POST | getAttendanceComparison | getAttendanceComparison | NO | NO | FAIL | P1 |
| /api/analytics/:entityType/:entityId/insights | GET | generateAttendanceInsights | generateAttendanceInsights | NO | NO | FAIL | P0 |
| /api/analytics/attendance/export | POST | exportAttendanceReport | exportAttendanceReport | NO | NO | FAIL | P1 |

**Summary: 7 endpoints. 0 PASS, 0 PARTIAL, 7 FAIL.**

---

### Module: auth

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/auth/init-admin | POST | initAdmin | (inline) | NO (public) | N/A | EXEMPT | -- |
| /api/auth/login | POST | login | login | NO (public) | OPTIONAL | EXEMPT | -- |
| /api/auth/tenants | GET | getTenantsForEmail | _getTenantsForTeachers | NO (public) | N/A | EXEMPT | -- |
| /api/auth/refresh | POST | refresh | refreshAccessToken | NO (public) | N/A | EXEMPT | -- |
| /api/auth/forgot-password | POST | forgotPassword | forgotPassword | NO (public) | N/A | EXEMPT | -- |
| /api/auth/reset-password | POST | resetPassword | resetPassword | NO (public) | N/A | EXEMPT | -- |
| /api/auth/accept-invitation | POST | acceptInvitation | acceptInvitation | NO (public) | N/A | EXEMPT | -- |
| /api/auth/validate | GET | validateToken | (JWT check) | N/A | N/A | N/A | -- |
| /api/auth/logout | POST | logout | logout | N/A | N/A | EXEMPT | -- |
| /api/auth/change-password | POST | changePassword | changePassword | N/A | N/A | EXEMPT | -- |
| /api/auth/force-password-change | POST | forcePasswordChange | forcePasswordChange | N/A | N/A | EXEMPT | -- |
| /api/auth/migrate-users | POST | migrateExistingUsers | (admin migration) | N/A | N/A | EXEMPT | -- |
| /api/auth/migrate-invitations | POST | migratePendingInvitations | (admin migration) | N/A | N/A | EXEMPT | -- |
| /api/auth/invitation-stats | GET | getInvitationModeStats | (admin query) | N/A | N/A | EXEMPT | -- |
| /api/auth/check-teacher/:email | GET | checkTeacherByEmail | (admin query) | N/A | N/A | EXEMPT | -- |
| /api/auth/remove-teacher/:email | DELETE | removeTeacherByEmail | (admin mutation) | N/A | N/A | EXEMPT | -- |

**Summary: 16 endpoints. All EXEMPT -- auth operates before or independently of tenant context.**

---

### Module: super-admin

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/super-admin/auth/login | POST | login | login | N/A | N/A | EXEMPT | -- |
| /api/super-admin/seed | POST | seed | seedSuperAdmin | N/A | N/A | EXEMPT | -- |
| /api/super-admin/auth/logout | POST | logout | logout | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants | GET | getTenants | getTenantsWithStats | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants/:id | GET | getTenantById | getTenantWithStats | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants | POST | createTenant | createTenant | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants/:id | PUT | updateTenant | updateTenant | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants/:id/subscription | PUT | updateSubscription | (inline) | N/A | N/A | EXEMPT | -- |
| /api/super-admin/tenants/:id/toggle-active | PUT | toggleTenantActive | (inline) | N/A | N/A | EXEMPT | -- |
| /api/super-admin/analytics | GET | getAnalytics | getPlatformAnalytics | N/A | N/A | EXEMPT | -- |
| /api/super-admin/admins | GET | getAdmins | (inline) | N/A | N/A | EXEMPT | -- |
| /api/super-admin/admins | POST | createAdmin | createSuperAdmin | N/A | N/A | EXEMPT | -- |
| /api/super-admin/admins/:id | PUT | updateAdmin | updateSuperAdmin | N/A | N/A | EXEMPT | -- |

**Summary: 13 endpoints. All EXEMPT -- super admin operates cross-tenant by design.**

---

### Module: tenant

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/tenant | GET | getTenants | getTenants | NO | N/A | EXEMPT | -- |
| /api/tenant/:id | GET | getTenantById | getTenantById | NO | N/A | EXEMPT | -- |
| /api/tenant | POST | createTenant | createTenant | NO | N/A | EXEMPT | -- |
| /api/tenant/:id | PUT | updateTenant | updateTenant | NO | N/A | EXEMPT | -- |

**Summary: 4 endpoints. All EXEMPT -- tenant service manages tenant records themselves.**

---

### Module: hours-summary

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/hours-summary | GET | getHoursSummary | getHoursSummary | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/hours-summary/teacher/:teacherId | GET | getTeacherHours | getHoursSummaryByTeacher | NO | NO | FAIL | P0 |
| /api/hours-summary/calculate/:teacherId | POST | calculateTeacherHours | calculateTeacherHours | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/hours-summary/calculate | POST | calculateAllHours | calculateAllTeacherHours | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |

**Summary: 4 endpoints. 0 PASS, 3 PARTIAL, 1 FAIL.**

---

### Module: import

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/import/teachers/preview | POST | previewTeacherImport | previewTeacherImport | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/import/students/preview | POST | previewStudentImport | previewStudentImport | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/import/execute/:importLogId | POST | executeImport | executeImport | YES (tenantId param) | NO (queries by _id) | FAIL | P1 |

**Summary: 3 endpoints. 0 PASS, 2 PARTIAL, 1 FAIL.**

---

### Module: export

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/export/status | GET | getCompletionStatus | (delegates to services) | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/export/validate | GET | crossValidate | (delegates to services) | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |
| /api/export/download | GET | downloadFullReport | generateFullReport | YES (tenantId param) | CONDITIONAL | PARTIAL | P2 |

**Summary: 3 endpoints. 0 PASS, 3 PARTIAL, 0 FAIL.**

---

### Module: health

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/health/live | GET | (inline) | N/A | N/A | N/A | N/A | -- |
| /api/health/ready | GET | (inline) | N/A (db.ping) | N/A | N/A | N/A | -- |

**Summary: 2 endpoints. All N/A -- no tenant-scoped data access.**

---

### Module: file

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/files/:filename | GET | serveFile | N/A (filesystem) | N/A | N/A | N/A | -- |

**Summary: 1 endpoint. N/A -- serves static files from disk/S3, no MongoDB query.**

---

### Module: admin (cascade-deletion)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/admin/student/:studentId/deletion-preview | POST | previewCascadeDeletion | prepareStudentDeletion | NO | NO | EXEMPT | -- |
| /api/admin/student/:studentId/cascade | DELETE | executeCascadeDeletion | executeStudentDeletion | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/orphaned-references | POST | cleanupOrphanedReferences | (cascade services) | NO | NO | EXEMPT | -- |
| /api/admin/deletion/rollback/:snapshotId | POST | rollbackDeletion | restoreFromSnapshot | NO | NO | EXEMPT | -- |
| /api/admin/deletion/audit-log | GET | getAuditLog | getAuditLog | NO | NO | EXEMPT | -- |
| /api/admin/deletion/snapshots | GET | getAvailableSnapshots | (cascade services) | NO | NO | EXEMPT | -- |
| /api/admin/deletion/operations | GET | getRunningOperations | (cascade services) | NO | NO | EXEMPT | -- |
| /api/admin/deletion/operations/:operationId/cancel | POST | cancelOperation | (cascade services) | NO | NO | EXEMPT | -- |

**Summary: 8 endpoints. All EXEMPT -- admin cascade deletion operates by entity ID under admin authorization.**

---

### Module: admin (consistency-validation)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/admin/consistency-validation/validate-teacher-student-sync | POST | validateTeacherStudentSync | (inline aggregate) | NO | NO | EXEMPT | -- |
| /api/admin/consistency-validation/system-consistency-report | GET | getSystemConsistencyReport | (inline) | NO | NO | EXEMPT | -- |
| /api/admin/consistency-validation/validate-all-teacher-lessons | POST | validateAllTeacherLessons | (inline) | NO | NO | EXEMPT | -- |
| /api/admin/consistency-validation/data-integrity-stats | GET | getDataIntegrityStats | getValidationStats | NO | NO | EXEMPT | -- |
| /api/admin/consistency-validation/repair-data-inconsistencies | POST | repairDataInconsistencies | repairAssignment | NO | NO | EXEMPT | -- |
| /api/admin/consistency-validation/health-check | GET | performHealthCheck | healthCheck | NO | NO | EXEMPT | -- |

**Summary: 6 endpoints. All EXEMPT -- admin diagnostic tools.**

---

### Module: admin (date-monitoring)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/admin/date-monitoring/metrics | GET | getMetrics | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/report | GET | getMonitoringReport | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/database-health | GET | getDatabaseHealth | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/status | GET | getSystemStatus | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/health-check | GET | runHealthCheck | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/alerts | GET | getAlerts | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/alerts/:alertId/acknowledge | PUT | acknowledgeAlert | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/cleanup | DELETE | clearOldData | (monitoring service) | NO | NO | EXEMPT | -- |
| /api/admin/date-monitoring/export | GET | exportData | (monitoring service) | NO | NO | EXEMPT | -- |

**Summary: 9 endpoints. All EXEMPT -- admin date monitoring tools.**

---

### Module: admin (cleanup)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/admin/cleanup/detect-inconsistencies | GET | detectInconsistencies | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/report | GET | generateReport | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/fix-all | POST | fixAllInconsistencies | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/fix-relationship/:teacherId/:studentId | POST | fixRelationship | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/fix-assignments/:studentId | POST | fixOrphanedAssignments | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/fix-schedule/:studentId | POST | fixOrphanedSchedule | (dataCleanupService) | NO | NO | EXEMPT | -- |
| /api/admin/cleanup/student/:studentId/deletion-preview | POST | getStudentDeletionPreview | (studentDeletionPreview) | NO | NO | EXEMPT | -- |

**Summary: 7 endpoints. All EXEMPT -- admin cleanup tools.**

---

### Module: admin (past-activities)

| Route | Method | Controller Function | Service Function | Passes Context? | tenantId in Query? | Status | Priority |
|-------|--------|--------------------|--------------------|----------------|-------------------|--------|----------|
| /api/admin/past-activities | GET | getPastActivities | (pastActivitiesService) | NO | NO | EXEMPT | -- |
| /api/admin/past-activities/:type | GET | getPastActivitiesByType | (pastActivitiesService) | NO | NO | EXEMPT | -- |

**Summary: 2 endpoints. All EXEMPT -- admin tools for viewing historical data.**

---

## Shared Services

Services called by multiple controllers. These do not have their own routes but affect tenant isolation for any caller.

| Service | File | Queries | tenantId Status | Risk | Notes |
|---------|------|---------|----------------|------|-------|
| **duplicateDetectionService** | services/duplicateDetectionService.js | ~8 | NO | CRITICAL | Queries teacher collection for duplicates without tenantId. A teacher in Tenant A is flagged as duplicate when creating same person in Tenant B. |
| **permissionService** | services/permissionService.js | ~6 | NO | HIGH | Checks permissions via teacherAssignments without tenant scope. Queries student collection. |
| **conflictDetectionService** | services/conflictDetectionService.js | ~2 | NO | CRITICAL | Queries theory_lesson for room/time conflicts without tenantId. Different tenants share room names independently. |
| **cascadeDeletion.service** | services/cascadeDeletion.service.js | ~28 | NO | EXEMPT | Transaction-based cascade deletion. Admin-only, operates by entity ID. |
| **cascadeDeletionService** | services/cascadeDeletionService.js | ~38 | NO | EXEMPT | Collection-based cascade deletion. Admin-only. |
| **cascadeDeletionAggregation.service** | services/cascadeDeletionAggregation.service.js | ~22 | NO | EXEMPT | Aggregation pipelines for orphan detection. Admin-only. |
| **cascadeJobProcessor** | services/cascadeJobProcessor.js | ~12 | NO | EXEMPT | Background job processing for cascade deletions. |
| **relationshipValidationService** | services/relationshipValidationService.js | ~8 | NO | EXEMPT | Validates relationship integrity. Admin utility. |
| **dataCleanupService** | services/dataCleanupService.js | ~11 | NO | EXEMPT | Admin data cleanup operations. |
| **dateConsistencyService** | services/dateConsistencyService.js | ~11 | NO | EXEMPT | Admin date monitoring/fixing tool. |
| **dateMonitoringService** | services/dateMonitoringService.js | ~6 | NO | EXEMPT | Admin date health monitoring. |

**Shared services requiring Phase 2 hardening:** duplicateDetectionService (CRITICAL), conflictDetectionService (CRITICAL), permissionService (HIGH).

---

## Middleware

| Middleware | File | Query | tenantId Status | Risk | Notes |
|-----------|------|-------|----------------|------|-------|
| **authenticateToken** | middleware/auth.middleware.js | findOne on teacher by JWT _id | N/A | N/A | Authentication step that loads teacher record (provides tenantId for buildContext). |
| **buildContext** | middleware/tenant.middleware.js | find on student for _studentAccessIds | NO | MEDIUM | Queries `teacherAssignments.teacherId` without tenantId. Should include tenantId to prevent loading cross-tenant student IDs. |
| **addSchoolYearToRequest** | middleware/school-year.middleware.js | findOne/insertOne on school_year | CONDITIONAL | MEDIUM | Uses req.context.tenantId from prior middleware but falls through to default creation without tenant scope. |
| **enforceTenant** | middleware/tenant.middleware.js | N/A (checks req.context) | N/A | N/A | Exists but is NOT applied to any route. |
| **enhancedAuth** | middleware/enhancedAuth.middleware.js | findOne on teacher | N/A | N/A | Deprecated. Not wired to any route. |
| **superAdminAuth** | middleware/super-admin.middleware.js | findOne on super_admin | N/A | EXEMPT | Super admin authentication. |

---

## Phase 2 Fix Order

Prioritized list of modules and services to fix, ordered by risk severity.

### Wave 1: P0 Failures (Data Leak Risk -- GET endpoints without tenantId)

Fix these first. Any authenticated user can read other tenants' data.

1. **student.service.js** -- getStudentById (IDOR), getStudentPrivateLessonStats, getStudentAttendanceHistory
2. **teacher.service.js** -- getTeacherById (IDOR), getTeacherIds (no tenantId at all), getTeacherLessons, all lesson endpoints
3. **teacher-lessons.service.js** -- getTeacherLessons (aggregation without tenantId), validateTeacherLessonData
4. **orchestra.service.js** -- getOrchestraById (IDOR + unscoped $lookup), getRehearsalAttendance, getStudentAttendanceStats
5. **rehearsal.service.js** -- getRehearsalById (IDOR)
6. **theory.service.js** -- getTheoryLessonById (IDOR), getStudentTheoryAttendanceStats
7. **bagrut.service.js** -- getBagrutById (IDOR), getBagrutByStudentId
8. **school-year.service.js** -- getSchoolYearById (IDOR), getSchoolYears, getCurrentSchoolYear
9. **attendance.service.js** (schedule) -- all 3 endpoints
10. **analytics/attendance.service.js** -- all endpoints
11. **hours-summary.service.js** -- getHoursSummaryByTeacher
12. **time-block.service.js** -- getTeacherTimeBlocks, getAvailableSlots, getBlockUtilizationStats

### Wave 2: P1 Failures (Data Corruption Risk -- POST/PUT/DELETE endpoints without tenantId)

Fix these second. Write operations could affect wrong tenant's data.

1. **student.service.js** -- addStudent, updateStudent, updateStudentTest, updateStudentStageLevel, removeStudent
2. **teacher.service.js** -- addTeacher, updateTeacher, removeTeacher, updateTeacherSchedule, addStudentToTeacher, removeStudentFromTeacher, createTimeBlock, updateTimeBlock, deleteTimeBlock
3. **orchestra.service.js** -- addOrchestra, updateOrchestra, removeOrchestra, addMember, removeMember, updateRehearsalAttendance
4. **rehearsal.service.js** -- addRehearsal, updateRehearsal, removeRehearsal, updateAttendance, all bulk operations
5. **theory.service.js** -- addTheoryLesson, updateTheoryLesson, removeTheoryLesson, updateTheoryAttendance, addStudentToTheory, removeStudentFromTheory, all bulk operations
6. **bagrut.service.js** -- addBagrut, updateBagrut, removeBagrut, and all sub-resource endpoints (17 total)
7. **school-year.service.js** -- createSchoolYear, updateSchoolYear, setCurrentSchoolYear, rolloverToNewYear
8. **import.service.js** -- executeImport
9. **time-block.service.js** -- createTimeBlock, updateTimeBlock, assignLessonToBlock, removeLessonFromBlock, findOptimalSlot

### Wave 3: P2 Partial (Fragile Enforcement -- works but not canonical)

Fix these third. Currently working but using ad-hoc patterns that can break silently.

1. **student.service.js** -- getStudentById (passes tenantId but not full context)
2. **teacher.service.js** -- getTeachers, getTeacherById, getTeacherByRole (pass tenantId in filterBy, not context)
3. **orchestra.service.js** -- getOrchestras (passes tenantId in filterBy)
4. **rehearsal.service.js** -- getRehearsals (passes tenantId in filterBy)
5. **theory.service.js** -- getTheoryLessons and variants (pass tenantId in filterBy)
6. **bagrut.service.js** -- getBagruts (passes tenantId in filterBy)
7. **hours-summary.service.js** -- getHoursSummary, calculateTeacherHours, calculateAllTeacherHours
8. **import.service.js** -- previewTeacherImport, previewStudentImport
9. **export.service.js** -- all 3 endpoints

### Wave 4: Shared Services

Fix these after API services are hardened.

1. **duplicateDetectionService.js** (CRITICAL) -- must scope duplicate detection within tenant
2. **conflictDetectionService.js** (CRITICAL) -- must scope room/time conflict detection within tenant
3. **permissionService.js** (HIGH) -- must include tenantId in student permission queries
4. **buildContext middleware** (MEDIUM) -- student access list query should include tenantId
5. **addSchoolYearToRequest middleware** (MEDIUM) -- default school year creation should be tenant-scoped

---

*Cross-references: `docs/query-inventory.md` for query-level detail. `docs/multi-tenant-architecture.md` for canonical patterns.*
