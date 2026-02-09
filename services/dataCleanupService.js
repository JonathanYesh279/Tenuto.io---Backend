/**
 * Data Cleanup Service
 *
 * This service provides functions to detect and fix data inconsistencies
 * in teacher-student relationships, specifically:
 * - Orphaned teacherAssignments referencing non-existent teachers
 * - Inactive teacherAssignments with stale data
 * - Mismatched schedule information
 *
 * teacherAssignments on student documents is the single source of truth
 * for all teacher-student relationships.
 */

import { getCollection, withTransaction } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const dataCleanupService = {
  detectInconsistencies,
  fixAllInconsistencies,
  fixTeacherStudentRelationships,
  fixOrphanedTeacherAssignments,
  fixOrphanedScheduleInfo,
  generateCleanupReport
};

/**
 * Detect all data inconsistencies in teacher-student relationships
 */
async function detectInconsistencies() {
  try {
    console.log('🔍 CLEANUP DETECTION: Starting comprehensive data consistency check...');

    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    const issues = {
      orphanedTeacherAssignments: [],
      inactiveStudentsWithActiveAssignments: [],
      orphanedScheduleInfo: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      }
    };

    // Get all active teachers for lookup
    const teachers = await teacherCollection.find({}).toArray();
    const students = await studentCollection.find({}).toArray();

    console.log(`📊 Analyzing ${teachers.length} teachers and ${students.length} students...`);

    const validTeacherIds = new Set(teachers.map(t => t._id.toString()));

    // Check all students for inconsistencies
    for (const student of students) {
      try {
        const studentId = student._id.toString();
        const studentName = `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim() || 'Unknown';

        // Check teacherAssignments for orphaned teacher references
        if (student.teacherAssignments && Array.isArray(student.teacherAssignments) && student.teacherAssignments.length > 0) {
          for (const assignment of student.teacherAssignments) {
            if (assignment && assignment.teacherId) {
              const teacherId = assignment.teacherId;

              if (!validTeacherIds.has(teacherId)) {
                issues.orphanedTeacherAssignments.push({
                  studentId,
                  studentName,
                  assignmentId: assignment._id || 'no-id',
                  orphanedTeacherId: teacherId,
                  isActive: assignment.isActive,
                  severity: 'HIGH'
                });
              }
            }
          }
        }

        // Check for inactive students that still have active assignments
        if (student.isActive === false) {
          const activeAssignments = (student.teacherAssignments || []).filter(a => a.isActive !== false);
          if (activeAssignments.length > 0) {
            issues.inactiveStudentsWithActiveAssignments.push({
              studentId,
              studentName,
              activeAssignmentCount: activeAssignments.length,
              teacherIds: activeAssignments.map(a => a.teacherId),
              severity: 'MEDIUM'
            });
          }
        }

        // Check schedule info for orphaned references
        try {
          if (student.scheduleInfo &&
              student.scheduleInfo.lessonSchedule &&
              Array.isArray(student.scheduleInfo.lessonSchedule) &&
              student.scheduleInfo.lessonSchedule.length > 0) {

            for (const lesson of student.scheduleInfo.lessonSchedule) {
              if (lesson && lesson.teacherId) {
                const teacherExists = validTeacherIds.has(lesson.teacherId);
                const hasActiveAssignment = student.teacherAssignments?.some(
                  a => a.teacherId === lesson.teacherId && a.isActive
                );

                if (!teacherExists || !hasActiveAssignment) {
                  issues.orphanedScheduleInfo.push({
                    studentId,
                    studentName,
                    scheduleItem: lesson,
                    teacherExists,
                    hasActiveAssignment,
                    severity: 'MEDIUM'
                  });
                }
              }
            }
          }
        } catch (scheduleError) {
          console.warn(`⚠️ Error checking schedule info for student ${studentId}: ${scheduleError.message}`);
        }

      } catch (studentError) {
        console.warn(`⚠️ Error processing student ${student._id}: ${studentError.message}`);
      }
    }

    // Calculate summary
    issues.summary.totalIssues =
      (issues.orphanedTeacherAssignments?.length || 0) +
      (issues.inactiveStudentsWithActiveAssignments?.length || 0) +
      (issues.orphanedScheduleInfo?.length || 0);

    issues.summary.criticalIssues =
      (issues.orphanedTeacherAssignments?.length || 0);

    issues.summary.warnings =
      (issues.inactiveStudentsWithActiveAssignments?.length || 0) +
      (issues.orphanedScheduleInfo?.length || 0);

    console.log(`🔍 CLEANUP DETECTION COMPLETE: Found ${issues.summary.totalIssues} issues (${issues.summary.criticalIssues} critical, ${issues.summary.warnings} warnings)`);

    return issues;

  } catch (err) {
    console.error(`❌ Error detecting inconsistencies: ${err.message}`);
    throw new Error(`Error detecting inconsistencies: ${err.message}`);
  }
}

/**
 * Fix all detected inconsistencies
 */
async function fixAllInconsistencies(dryRun = true) {
  try {
    console.log(`🔧 CLEANUP FIX: Starting comprehensive fix (dry run: ${dryRun})...`);

    const issues = await detectInconsistencies();

    if (issues.summary.totalIssues === 0) {
      return {
        success: true,
        message: 'No inconsistencies found - database is clean',
        fixes: [],
        summary: { totalFixes: 0 }
      };
    }

    const fixes = [];

    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No actual changes will be made');

      if (issues.orphanedTeacherAssignments?.length > 0) {
        fixes.push(...issues.orphanedTeacherAssignments.map(issue => ({
          type: 'deactivate_orphaned_assignment',
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          assignmentId: issue.assignmentId,
          action: 'Set assignment.isActive = false',
          severity: issue.severity
        })));
      }

      if (issues.inactiveStudentsWithActiveAssignments?.length > 0) {
        fixes.push(...issues.inactiveStudentsWithActiveAssignments.map(issue => ({
          type: 'deactivate_stale_assignments',
          studentId: issue.studentId,
          assignmentCount: issue.activeAssignmentCount,
          action: 'Deactivate assignments for inactive student',
          severity: issue.severity
        })));
      }

      return {
        success: true,
        dryRun: true,
        message: `Fix plan generated for ${fixes.length} issues`,
        issues,
        fixPlan: fixes,
        summary: {
          totalIssues: issues.summary.totalIssues,
          plannedFixes: fixes.length
        }
      };
    }

    // Execute actual fixes
    return await withTransaction(async (session) => {
      const studentCollection = await getCollection('student');

      let fixedCount = 0;

      // Deactivate orphaned teacher assignments
      for (const issue of issues.orphanedTeacherAssignments) {
        await studentCollection.updateOne(
          {
            _id: ObjectId.createFromHexString(issue.studentId),
            'teacherAssignments.teacherId': issue.orphanedTeacherId
          },
          {
            $set: {
              'teacherAssignments.$.isActive': false,
              'teacherAssignments.$.endDate': new Date(),
              'teacherAssignments.$.updatedAt': new Date(),
              updatedAt: new Date(),
              'metadata.lastModifiedBy': 'data_cleanup_service'
            }
          },
          { session }
        );

        fixes.push({
          type: 'deactivate_orphaned_assignment',
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          status: 'fixed'
        });
        fixedCount++;
      }

      // Deactivate assignments for inactive students
      for (const issue of issues.inactiveStudentsWithActiveAssignments) {
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(issue.studentId) },
          {
            $set: {
              'teacherAssignments.$[elem].isActive': false,
              'teacherAssignments.$[elem].endDate': new Date(),
              'teacherAssignments.$[elem].updatedAt': new Date(),
              updatedAt: new Date(),
              'metadata.lastModifiedBy': 'data_cleanup_service'
            }
          },
          {
            arrayFilters: [{ 'elem.isActive': { $ne: false } }],
            session
          }
        );

        fixes.push({
          type: 'deactivate_stale_assignments',
          studentId: issue.studentId,
          assignmentCount: issue.activeAssignmentCount,
          status: 'fixed'
        });
        fixedCount++;
      }

      return {
        success: true,
        message: `Successfully fixed ${fixedCount} data inconsistencies`,
        fixes,
        summary: {
          totalIssues: issues.summary.totalIssues,
          totalFixes: fixedCount
        },
        timestamp: new Date()
      };
    });

  } catch (err) {
    console.error(`❌ Error fixing inconsistencies: ${err.message}`);
    throw new Error(`Error fixing inconsistencies: ${err.message}`);
  }
}

/**
 * Fix specific teacher-student relationship inconsistencies
 */
async function fixTeacherStudentRelationships(teacherId, studentId) {
  try {
    console.log(`🔧 RELATIONSHIP FIX: Fixing relationship between teacher ${teacherId} and student ${studentId}`);

    return await withTransaction(async (session) => {
      const teacherCollection = await getCollection('teacher');
      const studentCollection = await getCollection('student');

      const teacher = await teacherCollection.findOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { session }
      );

      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );

      if (!teacher || !student) {
        throw new Error('Teacher or student not found');
      }

      const fixes = [];

      const hasActiveAssignment = student.teacherAssignments?.some(
        a => a.teacherId === teacherId && a.isActive
      );

      if (!hasActiveAssignment) {
        // No active assignment — nothing to sync
        fixes.push('No active assignment found — no action needed');
      }

      return {
        success: true,
        message: `Relationship between teacher ${teacherId} and student ${studentId} verified`,
        fixes,
        hasActiveAssignment
      };
    });

  } catch (err) {
    console.error(`❌ Error fixing relationship: ${err.message}`);
    throw new Error(`Error fixing relationship: ${err.message}`);
  }
}

/**
 * Fix orphaned teacher assignments
 */
async function fixOrphanedTeacherAssignments(studentId) {
  try {
    console.log(`🔧 ASSIGNMENT FIX: Fixing orphaned assignments for student ${studentId}`);

    return await withTransaction(async (session) => {
      const studentCollection = await getCollection('student');
      const teacherCollection = await getCollection('teacher');

      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );

      if (!student) {
        throw new Error('Student not found');
      }

      const fixes = [];

      if (student.teacherAssignments?.length > 0) {
        for (const assignment of student.teacherAssignments) {
          if (assignment.isActive) {
            const teacher = await teacherCollection.findOne(
              { _id: ObjectId.createFromHexString(assignment.teacherId) },
              { session }
            );

            if (!teacher) {
              // Deactivate assignment for non-existent teacher
              await studentCollection.updateOne(
                {
                  _id: ObjectId.createFromHexString(studentId),
                  'teacherAssignments.teacherId': assignment.teacherId
                },
                {
                  $set: {
                    'teacherAssignments.$.isActive': false,
                    'teacherAssignments.$.endDate': new Date(),
                    'teacherAssignments.$.updatedAt': new Date(),
                    updatedAt: new Date()
                  }
                },
                { session }
              );

              fixes.push(`Deactivated assignment for non-existent teacher ${assignment.teacherId}`);
            }
          }
        }
      }

      return {
        success: true,
        message: `Fixed ${fixes.length} orphaned assignments for student ${studentId}`,
        fixes
      };
    });

  } catch (err) {
    console.error(`❌ Error fixing orphaned assignments: ${err.message}`);
    throw new Error(`Error fixing orphaned assignments: ${err.message}`);
  }
}

/**
 * Fix orphaned schedule information
 */
async function fixOrphanedScheduleInfo(studentId) {
  try {
    console.log(`🔧 SCHEDULE FIX: Fixing orphaned schedule info for student ${studentId}`);

    return await withTransaction(async (session) => {
      const studentCollection = await getCollection('student');

      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );

      if (!student) {
        throw new Error('Student not found');
      }

      const fixes = [];
      const cleanupOperations = [];

      // Check lesson schedule
      try {
        if (student.scheduleInfo &&
            student.scheduleInfo.lessonSchedule &&
            Array.isArray(student.scheduleInfo.lessonSchedule) &&
            student.scheduleInfo.lessonSchedule.length > 0) {

          for (const lesson of student.scheduleInfo.lessonSchedule) {
            if (lesson && lesson.teacherId) {
              const hasActiveAssignment = student.teacherAssignments?.some(
                a => a.teacherId === lesson.teacherId && a.isActive
              );

              if (!hasActiveAssignment) {
                cleanupOperations.push({
                  field: 'scheduleInfo.lessonSchedule',
                  value: { teacherId: lesson.teacherId }
                });
                fixes.push(`Marked lesson for teacher ${lesson.teacherId} for removal`);
              }
            }
          }
        }
      } catch (scheduleError) {
        console.warn(`⚠️ Error processing schedule info for student ${studentId}: ${scheduleError.message}`);
      }

      // Execute cleanup operations
      if (cleanupOperations.length > 0) {
        const pullOperations = {};

        for (const op of cleanupOperations) {
          if (!pullOperations[op.field]) {
            pullOperations[op.field] = [];
          }
          pullOperations[op.field].push(op.value);
        }

        const updateDoc = { $pull: {} };
        for (const [field, values] of Object.entries(pullOperations)) {
          updateDoc.$pull[field] = { $in: values };
        }

        updateDoc.$set = {
          'scheduleInfo.lastUpdated': new Date(),
          updatedAt: new Date()
        };

        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(studentId) },
          updateDoc,
          { session }
        );
      }

      return {
        success: true,
        message: `Fixed ${fixes.length} orphaned schedule items for student ${studentId}`,
        fixes
      };
    });

  } catch (err) {
    console.error(`❌ Error fixing orphaned schedule info: ${err.message}`);
    throw new Error(`Error fixing orphaned schedule info: ${err.message}`);
  }
}

/**
 * Generate a comprehensive cleanup report
 */
async function generateCleanupReport() {
  try {
    console.log('📊 CLEANUP REPORT: Generating comprehensive data consistency report...');

    const issues = await detectInconsistencies();

    const report = {
      timestamp: new Date(),
      summary: issues.summary,
      issues: issues,
      recommendations: [],
      priority: 'NORMAL'
    };

    // Add recommendations based on findings
    if (issues.summary.criticalIssues > 0) {
      report.priority = 'HIGH';
      report.recommendations.push({
        type: 'IMMEDIATE_ACTION',
        message: `${issues.summary.criticalIssues} critical inconsistencies found that could cause data corruption`,
        action: 'Run fixAllInconsistencies() immediately'
      });
    }

    if (issues.orphanedTeacherAssignments.length > 0) {
      report.recommendations.push({
        type: 'CLEANUP',
        message: `${issues.orphanedTeacherAssignments.length} students have assignments referencing non-existent teachers`,
        action: 'Deactivate orphaned teacherAssignments'
      });
    }

    if (issues.inactiveStudentsWithActiveAssignments.length > 0) {
      report.recommendations.push({
        type: 'CLEANUP',
        message: `${issues.inactiveStudentsWithActiveAssignments.length} inactive students still have active assignments`,
        action: 'Deactivate stale assignments for inactive students'
      });
    }

    if (issues.summary.totalIssues === 0) {
      report.recommendations.push({
        type: 'SUCCESS',
        message: 'No data inconsistencies detected - database is clean',
        action: 'No action required'
      });
    }

    console.log(`📊 CLEANUP REPORT COMPLETE: ${issues.summary.totalIssues} issues found`);

    return report;

  } catch (err) {
    console.error(`❌ Error generating cleanup report: ${err.message}`);
    throw new Error(`Error generating cleanup report: ${err.message}`);
  }
}
