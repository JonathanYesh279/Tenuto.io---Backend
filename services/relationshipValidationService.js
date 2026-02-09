/**
 * Relationship Validation Service
 *
 * Validates teacher-student relationship integrity using teacherAssignments
 * as the single source of truth on student documents.
 */

import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const relationshipValidationService = {
  validateStudentTeacherRelationships,
  validateTeacherStudentRelationships,
  validateBidirectionalRelationships,
  detectRelationshipInconsistencies,
  repairRelationshipInconsistencies,
};

/**
 * Validate that all teachers referenced in a student's teacherAssignments exist
 * @param {string} studentId - Student ID to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateStudentTeacherRelationships(studentId) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validatedTeachers: []
    };

    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      validationResult.isValid = false;
      validationResult.errors.push(`Student not found: ${studentId}`);
      return validationResult;
    }

    const activeAssignments = (student.teacherAssignments || []).filter(a => a.isActive !== false);
    if (activeAssignments.length === 0) {
      return validationResult;
    }

    const teacherIds = [...new Set(activeAssignments.map(a => a.teacherId))];

    for (const teacherId of teacherIds) {
      if (!ObjectId.isValid(teacherId)) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid teacher ID format in assignment: ${teacherId}`);
        continue;
      }

      const teacher = await teacherCollection.findOne({
        _id: ObjectId.createFromHexString(teacherId),
        isActive: { $ne: false }
      });

      if (!teacher) {
        validationResult.warnings.push({
          type: 'ORPHANED_ASSIGNMENT',
          message: `Teacher ${teacherId} referenced in assignment does not exist or is inactive`,
          teacherId,
          fixable: true
        });
      }

      validationResult.validatedTeachers.push({
        teacherId,
        teacherName: teacher
          ? `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim()
          : 'Not Found',
        instrument: teacher?.professionalInfo?.instrument,
        exists: !!teacher
      });
    }

    return validationResult;
  } catch (error) {
    console.error('Error validating student-teacher relationships:', error);
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      validatedTeachers: []
    };
  }
}

/**
 * Validate that all students assigned to a teacher have valid active assignments
 * @param {string} teacherId - Teacher ID to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateTeacherStudentRelationships(teacherId) {
  try {
    const studentCollection = await getCollection('student');
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validatedStudents: []
    };

    // Find all students with active assignments for this teacher
    const students = await studentCollection.find({
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.isActive': { $ne: false },
      isActive: { $ne: false }
    }).toArray();

    for (const student of students) {
      const studentId = student._id.toString();
      const assignments = (student.teacherAssignments || []).filter(
        a => a.teacherId === teacherId && a.isActive !== false
      );

      // Check for incomplete assignment data
      for (const assignment of assignments) {
        if (!assignment.day || !assignment.time || !assignment.duration) {
          validationResult.warnings.push({
            type: 'INCOMPLETE_ASSIGNMENT',
            message: `Student ${studentId} has incomplete assignment (missing day/time/duration)`,
            studentId,
            studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
            fixable: false
          });
        }
      }

      validationResult.validatedStudents.push({
        studentId,
        studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
        assignmentCount: assignments.length
      });
    }

    return validationResult;
  } catch (error) {
    console.error('Error validating teacher-student relationships:', error);
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      validatedStudents: []
    };
  }
}

/**
 * Validate that a specific student-teacher assignment exists and is active
 * @param {string} studentId - Student ID
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Object>} Validation result
 */
async function validateBidirectionalRelationships(studentId, teacherId) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const result = {
      isValid: true,
      hasActiveAssignment: false,
      errors: []
    };

    if (!ObjectId.isValid(studentId)) {
      result.isValid = false;
      result.errors.push(`Invalid student ID format: ${studentId}`);
      return result;
    }

    if (!ObjectId.isValid(teacherId)) {
      result.isValid = false;
      result.errors.push(`Invalid teacher ID format: ${teacherId}`);
      return result;
    }

    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      result.isValid = false;
      result.errors.push(`Student not found: ${studentId}`);
      return result;
    }

    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      result.isValid = false;
      result.errors.push(`Teacher not found: ${teacherId}`);
      return result;
    }

    result.hasActiveAssignment = (student.teacherAssignments || []).some(
      a => a.teacherId === teacherId && a.isActive !== false
    );

    return result;
  } catch (error) {
    console.error('Error validating relationships:', error);
    return {
      isValid: false,
      hasActiveAssignment: false,
      errors: [`Validation failed: ${error.message}`]
    };
  }
}

/**
 * Detect all relationship inconsistencies in the database
 * Checks teacherAssignments for orphaned references (non-existent teachers)
 * @returns {Promise<Object>} Inconsistencies report
 */
async function detectRelationshipInconsistencies() {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const report = {
      summary: {
        totalStudents: 0,
        totalTeachers: 0,
        studentsWithAssignments: 0,
        inconsistentRelationships: 0
      },
      inconsistencies: [],
      orphanedReferences: {
        studentsWithInvalidTeachers: [],
        teachersWithInvalidStudents: []
      }
    };

    // Get all active teachers for lookup
    const teachers = await teacherCollection.find({
      isActive: { $ne: false }
    }).toArray();
    report.summary.totalTeachers = teachers.length;

    const validTeacherIds = new Set(teachers.map(t => t._id.toString()));

    // Analyze students
    const students = await studentCollection.find({
      isActive: { $ne: false }
    }).toArray();
    report.summary.totalStudents = students.length;

    for (const student of students) {
      const studentId = student._id.toString();
      const activeAssignments = (student.teacherAssignments || []).filter(a => a.isActive !== false);

      if (activeAssignments.length === 0) continue;
      report.summary.studentsWithAssignments++;

      for (const assignment of activeAssignments) {
        const teacherId = assignment.teacherId;

        if (!teacherId || !ObjectId.isValid(teacherId)) {
          report.orphanedReferences.studentsWithInvalidTeachers.push({
            studentId,
            studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
            invalidTeacherId: teacherId
          });
          report.summary.inconsistentRelationships++;
          continue;
        }

        if (!validTeacherIds.has(teacherId)) {
          report.orphanedReferences.studentsWithInvalidTeachers.push({
            studentId,
            studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
            missingTeacherId: teacherId
          });
          report.summary.inconsistentRelationships++;
        }
      }
    }

    return report;
  } catch (error) {
    console.error('Error detecting relationship inconsistencies:', error);
    throw error;
  }
}

/**
 * Repair detected relationship inconsistencies
 * Deactivates orphaned teacherAssignments that reference non-existent teachers
 * @param {Object} inconsistenciesReport - Report from detectRelationshipInconsistencies
 * @param {boolean} dryRun - If true, only simulate repairs without making changes
 * @returns {Promise<Object>} Repair results
 */
async function repairRelationshipInconsistencies(inconsistenciesReport, dryRun = false) {
  try {
    const studentCollection = await getCollection('student');

    const repairResults = {
      dryRun,
      repaired: {
        studentTeacherLinks: 0,
        teacherStudentLinks: 0,
        orphanedReferences: 0
      },
      errors: []
    };

    const orphanedRefs = inconsistenciesReport.orphanedReferences.studentsWithInvalidTeachers;

    console.log(`${dryRun ? '🧪 DRY RUN:' : '🔧'} Repairing ${orphanedRefs.length} orphaned assignments...`);

    // Group orphaned references by studentId for batch updates
    const studentOrphans = {};
    for (const orphan of orphanedRefs) {
      if (!studentOrphans[orphan.studentId]) {
        studentOrphans[orphan.studentId] = [];
      }
      studentOrphans[orphan.studentId].push(orphan.invalidTeacherId || orphan.missingTeacherId);
    }

    for (const [studentId, teacherIds] of Object.entries(studentOrphans)) {
      try {
        console.log(`${dryRun ? 'WOULD DEACTIVATE:' : 'DEACTIVATING:'} ${teacherIds.length} orphaned assignments for student ${studentId}`);

        if (!dryRun) {
          // Deactivate assignments referencing non-existent teachers
          for (const teacherId of teacherIds) {
            await studentCollection.updateOne(
              { _id: ObjectId.createFromHexString(studentId) },
              {
                $set: {
                  'teacherAssignments.$[elem].isActive': false,
                  'teacherAssignments.$[elem].endDate': new Date(),
                  'teacherAssignments.$[elem].updatedAt': new Date(),
                  updatedAt: new Date()
                }
              },
              {
                arrayFilters: [{ 'elem.teacherId': teacherId, 'elem.isActive': { $ne: false } }]
              }
            );
          }
        }
        repairResults.repaired.orphanedReferences += teacherIds.length;
      } catch (error) {
        repairResults.errors.push(`Failed to repair student ${studentId}: ${error.message}`);
        console.error(`❌ Repair failed:`, error);
      }
    }

    return repairResults;
  } catch (error) {
    console.error('Error repairing relationship inconsistencies:', error);
    throw error;
  }
}
