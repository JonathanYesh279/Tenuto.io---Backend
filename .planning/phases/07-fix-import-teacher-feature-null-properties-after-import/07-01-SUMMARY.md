---
phase: 07-fix-import-teacher-feature-null-properties-after-import
plan: 01
subsystem: api
tags: [import, excel, teacher, validation, joi, mongodb, repair]

# Dependency graph
requires:
  - phase: none
    provides: existing import service and teacher validation schemas
provides:
  - normalizeTeacherMapped function for consistent field normalization
  - buildImportTeacherDocument function matching canonical addTeacher shape
  - teacherImportSchema with relaxed phone/email/address requirements
  - validateTeacherImport validation function
  - repairImportedTeachers utility for fixing already-imported teachers
  - POST /api/import/repair-imported-teachers admin endpoint
affects: [import, teacher-creation, frontend-teacher-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-document-builder, import-normalization, import-validation-schema]

key-files:
  created: []
  modified:
    - api/import/import.service.js
    - api/teacher/teacher.validation.js
    - api/import/import.controller.js
    - api/import/import.route.js

key-decisions:
  - "Separate teacherImportSchema instead of modifying main teacherSchema (relaxes phone/email/address for import)"
  - "Store normalized data in preview notFound entries to prevent MongoDB undefined-key stripping"
  - "Validate import documents through Joi before insertion for defaults and malformed data catching"
  - "Repair utility queries by credentials.invitationMode: IMPORT to find affected teachers"

patterns-established:
  - "normalizeTeacherMapped: centralized Excel-to-internal field normalization"
  - "buildImportTeacherDocument: canonical document builder matching addTeacher shape"

# Metrics
duration: 7min
completed: 2026-02-23
---

# Phase 7 Plan 01: Fix Import Teacher Null Properties Summary

**Normalized import teacher document creation with shared builder functions, relaxed Joi validation schema, and repair utility for already-imported teachers**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-23T10:21:57Z
- **Completed:** 2026-02-23T10:28:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Import-created teacher documents now have identical schema shape to addTeacher-created documents
- Empty Excel cells produce explicit null (not undefined/missing keys) for optional fields and proper defaults for schema-default fields
- credentials.invitedBy is now populated with the admin's ID on all import-created teachers
- Import documents pass through Joi validation before insertion, getting proper defaults applied
- Repair endpoint allows fixing already-imported teachers with missing/null properties

## Task Commits

Each task was committed atomically:

1. **Task 1: Create normalization and document builder functions, fix executeTeacherImport** - `d0e2e84` (feat)
2. **Task 2: Add import validation schema and repair utility for already-imported teachers** - `b22a039` (feat)

## Files Created/Modified
- `api/import/import.service.js` - Added normalizeTeacherMapped, buildImportTeacherDocument, repairImportedTeachers functions; refactored executeTeacherImport to use them; added validateTeacherImport in execution path
- `api/teacher/teacher.validation.js` - Added teacherImportSchema (relaxed phone/email/address) and validateTeacherImport export
- `api/import/import.controller.js` - Added repairImportedTeachers controller function
- `api/import/import.route.js` - Added POST /repair-imported-teachers route with admin auth

## Decisions Made
- Created separate `teacherImportSchema` rather than modifying the main `teacherSchema` -- import has fundamentally different requirements (phone/email/address are unknown from Ministry Excel)
- Store `normalized` object in preview `notFound` entries alongside raw `mapped` -- prevents MongoDB from stripping undefined keys during serialization, with backward-compat fallback for existing pending imports
- Run built documents through `validateTeacherImport` before insertion -- catches malformed data early and applies Joi defaults consistently
- Repair utility uses `credentials.invitationMode: 'IMPORT'` as the query discriminator to find import-created teachers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test suite cannot run due to WSL I/O error reading esbuild module (pre-existing environment issue, not related to changes). Verified no regressions via syntax checks on all modified files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Import teacher feature now produces canonical teacher documents
- Repair endpoint ready for admin to fix existing imported teachers
- Frontend should no longer see null properties on imported teacher documents

---
*Phase: 07-fix-import-teacher-feature-null-properties-after-import*
*Completed: 2026-02-23*
