# Requirements: Tenuto.io — Student Import Enhancement

**Defined:** 2026-02-27
**Core Value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data, every query is tenant-scoped, and Ministry reporting is accurate.

## v1.2 Requirements

Requirements for student import enhancement. Each maps to roadmap phases.

### Bug Fix

- [ ] **BUGF-01**: Fix `detectInstrumentColumns` to pass `headerColMap` in student import path (parity with teacher path)

### Import Data Quality

- [ ] **IQAL-01**: Student import creates `instrumentProgress[]` array entry with instrumentName, isPrimary, currentStage, and ministryStageLevel (not flat `academicInfo.instrument`)
- [ ] **IQAL-02**: Ministry stage level (שלב א/ב/ג) maps to numeric `currentStage` on the instrumentProgress entry
- [ ] **IQAL-03**: `calculateStudentChanges` detects changes in instrument, stage level, lesson duration, and teacher assignment (not just studyYears/extraHour/class)
- [ ] **IQAL-04**: Student schema updated with `academicInfo.isBagrutCandidate` boolean field (backward-compatible addition)

### Teacher-Student Linking

- [ ] **TLNK-01**: Preview matches "המורה" column to existing teachers by firstName+lastName and shows match status
- [ ] **TLNK-02**: Execute creates a teacherAssignment entry on the student with matched teacherId (without day/time schedule)
- [ ] **TLNK-03**: Preview warns when teacher name not found in tenant's teacher list

### Bagrut Flagging

- [ ] **BGRT-01**: "מגמת מוסיקה" column detected and parsed as boolean flag
- [ ] **BGRT-02**: Execute sets `academicInfo.isBagrutCandidate: true` for flagged students

### Frontend Preview Enhancement

- [ ] **FEPV-01**: Student preview shows enriched detail per row (instrument, teacher match, class, stage, bagrut) matching teacher import quality
- [ ] **FEPV-02**: Not-found students show rich card with all import data (not just "תלמיד חדש" text)
- [ ] **FEPV-03**: Teacher match status displayed with badge (matched/not found) in preview table

## Future Requirements

### Orchestra Auto-Assignment (v2+)

- **ORCH-01**: Orchestra documents define accepted stage-level range
- **ORCH-02**: Orchestra service auto-matches students to orchestras by stage level
- **ORCH-03**: Import triggers orchestra assignment check for newly imported students

### Theory Class Enrollment (v2+)

- **THRY-01**: Theory lesson enrollment from import based on category matching

## Out of Scope

| Feature | Reason |
|---------|--------|
| Orchestra/ensemble auto-assignment from import | Future feature — stage-level-based matching in orchestra service |
| Theory class enrollment from import | Requires matching to existing theory lesson documents |
| Full bagrut record creation from import | Only flag enrollment; manual setup for program details |
| Fuzzy teacher name matching | Exact match sufficient for conservatory staff; fuzzy matching risks false positives |
| Import job queue / async processing | Conservatory files are small (< 1,300 rows), synchronous import completes in seconds |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUGF-01 | Phase 15 | Pending |
| IQAL-01 | Phase 16 | Pending |
| IQAL-02 | Phase 16 | Pending |
| IQAL-03 | Phase 16 | Pending |
| IQAL-04 | Phase 15 | Pending |
| TLNK-01 | Phase 17 | Pending |
| TLNK-02 | Phase 17 | Pending |
| TLNK-03 | Phase 17 | Pending |
| BGRT-01 | Phase 15 | Pending |
| BGRT-02 | Phase 16 | Pending |
| FEPV-01 | Phase 18 | Pending |
| FEPV-02 | Phase 18 | Pending |
| FEPV-03 | Phase 18 | Pending |

**Coverage:**
- v1.2 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — traceability updated with final phase mappings*
