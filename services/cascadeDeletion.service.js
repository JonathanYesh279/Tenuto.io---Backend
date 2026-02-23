/**
 * MongoDB Cascade Deletion Service
 * Provides comprehensive cascade deletion operations with transaction support and audit trails
 *
 * TENANT ISOLATION: Every query in this service includes tenantId to prevent cross-tenant
 * data corruption. Entry points validate tenantId via requireTenantId guard.
 */

import { getDB } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { requireTenantId } from '../middleware/tenant.middleware.js';

export const cascadeDeletionService = {

  /**
   * Perform cascade deletion for a student with full transaction support
   * Creates snapshot, performs deletion, and logs audit trail
   * @param {string} studentId
   * @param {string} userId
   * @param {string} reason
   * @param {object} context - Must contain tenantId
   */
  async cascadeDeleteStudent(studentId, userId, reason = 'Administrative deletion', context) {
    const tenantId = requireTenantId(context?.tenantId);
    const db = getDB();
    const session = db.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const studentObjectId = new ObjectId(studentId);

        // Step 1: Create snapshot of current state
        const snapshot = await this.createStudentSnapshot(studentObjectId, session, tenantId);

        if (!snapshot.student) {
          throw new Error(`Student with ID ${studentId} not found`);
        }

        console.log(`Starting cascade deletion for student: ${snapshot.student.personalInfo?.firstName} ${snapshot.student.personalInfo?.lastName}`);

        // Step 2: Perform cascade operations
        const cascadeOperations = [];

        // Remove from teacher assignments
        const teacherCleanup = await this.removeStudentFromTeachers(studentObjectId, session, tenantId);
        if (teacherCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'teacher',
            operation: 'remove_student_references',
            affectedDocuments: teacherCleanup.modifiedCount,
            details: {
              studentsRemoved: teacherCleanup.studentsRemoved,
              scheduleSlotsFreed: teacherCleanup.scheduleSlotsFreed
            }
          });
        }

        // Remove from orchestras
        const orchestraCleanup = await this.removeStudentFromOrchestras(studentObjectId, session, tenantId);
        if (orchestraCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'orchestra',
            operation: 'remove_member',
            affectedDocuments: orchestraCleanup.modifiedCount,
            details: {
              orchestrasAffected: orchestraCleanup.orchestrasAffected
            }
          });
        }

        // Archive rehearsal attendance
        const rehearsalCleanup = await this.archiveStudentRehearsalAttendance(studentObjectId, session, tenantId);
        if (rehearsalCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'rehearsal',
            operation: 'archive_attendance',
            affectedDocuments: rehearsalCleanup.modifiedCount,
            details: {
              attendanceRecordsArchived: rehearsalCleanup.attendanceRecordsArchived
            }
          });
        }

        // Remove from theory lessons
        const theoryCleanup = await this.removeStudentFromTheoryLessons(studentObjectId, session, tenantId);
        if (theoryCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'theory_lesson',
            operation: 'remove_student',
            affectedDocuments: theoryCleanup.modifiedCount
          });
        }

        // Archive bagrut records
        const bagrutCleanup = await this.archiveStudentBagrut(studentObjectId, session, tenantId);
        if (bagrutCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'bagrut',
            operation: 'archive_record',
            affectedDocuments: bagrutCleanup.modifiedCount,
            details: {
              preservedAcademicData: true
            }
          });
        }

        // Archive activity attendance
        const attendanceCleanup = await this.archiveStudentAttendance(studentObjectId, session, tenantId);
        if (attendanceCleanup.modifiedCount > 0) {
          cascadeOperations.push({
            collection: 'activity_attendance',
            operation: 'archive_records',
            affectedDocuments: attendanceCleanup.modifiedCount
          });
        }

        // Step 3: Soft delete the student
        const studentDeletion = await this.softDeleteStudent(studentObjectId, reason, session, tenantId);

        // Step 4: Create audit record
        const auditRecord = {
          entityType: 'student',
          entityId: studentObjectId,
          tenantId,
          deletionType: 'cascade_cleanup',
          cascadeOperations,
          snapshot,
          timestamp: new Date(),
          userId: new ObjectId(userId),
          reason
        };

        await db.collection('deletion_audit').insertOne(auditRecord, { session });

        result = {
          success: true,
          studentId,
          cascadeOperations,
          totalAffectedDocuments: cascadeOperations.reduce((sum, op) => sum + op.affectedDocuments, 0),
          auditId: auditRecord._id,
          timestamp: auditRecord.timestamp
        };

        console.log(`Cascade deletion completed for student ${studentId}. Affected ${result.totalAffectedDocuments} documents across ${cascadeOperations.length} collections.`);
      });

      return result;

    } catch (error) {
      console.error('Error during cascade deletion:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Bulk cascade deletion for multiple students
   * @param {string[]} studentIds
   * @param {string} userId
   * @param {string} reason
   * @param {object} context - Must contain tenantId
   */
  async bulkCascadeDeleteStudents(studentIds, userId, reason = 'Bulk administrative deletion', context) {
    const results = [];
    const errors = [];

    console.log(`Starting bulk cascade deletion for ${studentIds.length} students`);

    for (const studentId of studentIds) {
      try {
        const result = await this.cascadeDeleteStudent(studentId, userId, reason, context);
        results.push(result);
      } catch (error) {
        console.error(`Error deleting student ${studentId}:`, error);
        errors.push({
          studentId,
          error: error.message
        });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      totalStudents: studentIds.length,
      totalDocumentsAffected: results.reduce((sum, r) => sum + r.totalAffectedDocuments, 0)
    };
  },

  /**
   * Create comprehensive snapshot of student and all related data
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async createStudentSnapshot(studentId, session, tenantId) {
    const db = getDB();

    try {
      const [
        student,
        relatedTeachers,
        relatedOrchestras,
        relatedRehearsals,
        relatedTheoryLessons,
        relatedBagrut,
        relatedAttendance
      ] = await Promise.all([
        db.collection('student').findOne({ _id: studentId, tenantId }, { session }),

        db.collection('teacher').find({
          'teaching.timeBlocks.assignedLessons.studentId': studentId,
          isActive: true,
          tenantId
        }, { session }).toArray(),

        db.collection('orchestra').find({
          memberIds: studentId,
          isActive: true,
          tenantId
        }, { session }).toArray(),

        db.collection('rehearsal').find({
          'attendance.studentId': studentId,
          tenantId
        }, { session }).toArray(),

        db.collection('theory_lesson').find({
          studentIds: studentId,
          tenantId
        }, { session }).toArray(),

        db.collection('bagrut').find({
          studentId: studentId,
          tenantId
        }, { session }).toArray(),

        db.collection('activity_attendance').find({
          studentId: studentId,
          tenantId
        }, { session }).toArray()
      ]);

      return {
        student,
        relatedData: {
          teachers: relatedTeachers,
          orchestras: relatedOrchestras,
          rehearsals: relatedRehearsals,
          theoryLessons: relatedTheoryLessons,
          bagrut: relatedBagrut,
          attendance: relatedAttendance
        },
        snapshotTimestamp: new Date()
      };

    } catch (error) {
      console.error('Error creating student snapshot:', error);
      throw error;
    }
  },

  /**
   * Remove student from all teacher assignments and schedules
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async removeStudentFromTeachers(studentId, session, tenantId) {
    const db = getDB();

    try {
      // First, get affected teachers for reporting
      const affectedTeachers = await db.collection('teacher').find({
        'teaching.timeBlocks.assignedLessons.studentId': studentId,
        isActive: true,
        tenantId
      }, { session }).toArray();

      let studentsRemoved = 0;
      let timeBlockLessonsDeactivated = 0;

      // Count removals for reporting
      affectedTeachers.forEach(teacher => {
        studentsRemoved++;
        if (teacher.teaching?.timeBlocks) {
          teacher.teaching.timeBlocks.forEach(block => {
            if (block.assignedLessons) {
              timeBlockLessonsDeactivated += block.assignedLessons.filter(
                lesson => lesson.studentId === studentId.toString() || (lesson.studentId?.equals && lesson.studentId.equals(studentId))
              ).length;
            }
          });
        }
      });

      // Deactivate student lessons in timeBlocks
      const timeBlockUpdate = await db.collection('teacher').updateMany(
        {
          'teaching.timeBlocks.assignedLessons.studentId': studentId,
          isActive: true,
          tenantId
        },
        {
          $set: {
            'teaching.timeBlocks.$[block].assignedLessons.$[lesson].isActive': false,
            'teaching.timeBlocks.$[block].assignedLessons.$[lesson].endDate': new Date(),
            'teaching.timeBlocks.$[block].assignedLessons.$[lesson].updatedAt': new Date(),
            'cascadeMetadata.lastUpdated': new Date()
          }
        },
        {
          arrayFilters: [
            { 'block.assignedLessons.studentId': studentId },
            { 'lesson.studentId': studentId }
          ],
          session
        }
      );

      return {
        modifiedCount: timeBlockUpdate.modifiedCount,
        studentsRemoved,
        scheduleSlotsFreed: timeBlockLessonsDeactivated,
        affectedTeachers: affectedTeachers.map(t => t._id)
      };

    } catch (error) {
      console.error('Error removing student from teachers:', error);
      throw error;
    }
  },

  /**
   * Remove student from orchestra member lists
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async removeStudentFromOrchestras(studentId, session, tenantId) {
    const db = getDB();

    try {
      // Get affected orchestras for reporting
      const affectedOrchestras = await db.collection('orchestra').find({
        memberIds: studentId,
        isActive: true,
        tenantId
      }, { projection: { _id: 1, name: 1 }, session }).toArray();

      const result = await db.collection('orchestra').updateMany(
        {
          memberIds: studentId,
          isActive: true,
          tenantId
        },
        {
          $pull: { memberIds: studentId },
          $set: { 'cascadeMetadata.lastUpdated': new Date() }
        },
        { session }
      );

      return {
        modifiedCount: result.modifiedCount,
        orchestrasAffected: affectedOrchestras.map(o => ({ id: o._id, name: o.name }))
      };

    } catch (error) {
      console.error('Error removing student from orchestras:', error);
      throw error;
    }
  },

  /**
   * Archive student attendance in rehearsals (preserve historical data)
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async archiveStudentRehearsalAttendance(studentId, session, tenantId) {
    const db = getDB();

    try {
      // Count attendance records to be archived
      const rehearsalsWithStudent = await db.collection('rehearsal').find({
        'attendance.studentId': studentId,
        tenantId
      }, { session }).toArray();

      let attendanceRecordsArchived = 0;
      rehearsalsWithStudent.forEach(rehearsal => {
        attendanceRecordsArchived += rehearsal.attendance.filter(
          att => att.studentId.equals(studentId)
        ).length;
      });

      // Mark attendance as archived rather than removing
      const result = await db.collection('rehearsal').updateMany(
        { 'attendance.studentId': studentId, tenantId },
        {
          $set: {
            'attendance.$[elem].archived': true,
            'attendance.$[elem].archivedAt': new Date(),
            'attendance.$[elem].archivedReason': 'student_deleted'
          }
        },
        {
          arrayFilters: [{ 'elem.studentId': studentId }],
          session
        }
      );

      return {
        modifiedCount: result.modifiedCount,
        attendanceRecordsArchived
      };

    } catch (error) {
      console.error('Error archiving student rehearsal attendance:', error);
      throw error;
    }
  },

  /**
   * Remove student from theory lesson student lists
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async removeStudentFromTheoryLessons(studentId, session, tenantId) {
    const db = getDB();

    try {
      const result = await db.collection('theory_lesson').updateMany(
        { studentIds: studentId, tenantId },
        {
          $pull: { studentIds: studentId },
          $set: { 'cascadeMetadata.lastUpdated': new Date() }
        },
        { session }
      );

      return result;

    } catch (error) {
      console.error('Error removing student from theory lessons:', error);
      throw error;
    }
  },

  /**
   * Archive student bagrut records (preserve academic data)
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async archiveStudentBagrut(studentId, session, tenantId) {
    const db = getDB();

    try {
      const result = await db.collection('bagrut').updateMany(
        {
          studentId: studentId,
          isActive: true,
          tenantId
        },
        {
          $set: {
            isActive: false,
            archived: true,
            archivedAt: new Date(),
            archivedReason: 'student_deleted',
            'cascadeMetadata.lastUpdated': new Date()
          }
        },
        { session }
      );

      return result;

    } catch (error) {
      console.error('Error archiving student bagrut:', error);
      throw error;
    }
  },

  /**
   * Archive student activity attendance records
   * @param {ObjectId} studentId
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async archiveStudentAttendance(studentId, session, tenantId) {
    const db = getDB();

    try {
      const result = await db.collection('activity_attendance').updateMany(
        { studentId: studentId, tenantId },
        {
          $set: {
            archived: true,
            archivedAt: new Date(),
            archivedReason: 'student_deleted',
            'cascadeMetadata.lastUpdated': new Date()
          }
        },
        { session }
      );

      return result;

    } catch (error) {
      console.error('Error archiving student attendance:', error);
      throw error;
    }
  },

  /**
   * Soft delete the student record
   * @param {ObjectId} studentId
   * @param {string} reason
   * @param {object} session - MongoDB session
   * @param {string} tenantId
   */
  async softDeleteStudent(studentId, reason, session, tenantId) {
    const db = getDB();

    try {
      const result = await db.collection('student').updateOne(
        { _id: studentId, tenantId },
        {
          $set: {
            isActive: false,
            deleted: true,
            deletedAt: new Date(),
            deletionReason: reason,
            'cascadeMetadata.lastUpdated': new Date()
          }
        },
        { session }
      );

      return result;

    } catch (error) {
      console.error('Error soft deleting student:', error);
      throw error;
    }
  },

  /**
   * Restore student from soft deletion (rollback cascade operations)
   * @param {string} studentId
   * @param {string} userId
   * @param {string} auditId
   * @param {object} context - Must contain tenantId
   */
  async restoreStudent(studentId, userId, auditId, context) {
    const tenantId = requireTenantId(context?.tenantId);
    const db = getDB();
    const session = db.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const studentObjectId = new ObjectId(studentId);
        const auditObjectId = new ObjectId(auditId);

        // Get the audit record to understand what was deleted
        const auditRecord = await db.collection('deletion_audit').findOne({
          _id: auditObjectId,
          entityId: studentObjectId,
          tenantId
        }, { session });

        if (!auditRecord) {
          throw new Error(`Audit record not found for student ${studentId}`);
        }

        const snapshot = auditRecord.snapshot;

        if (!snapshot || !snapshot.student) {
          throw new Error(`No snapshot data available for student restoration`);
        }

        console.log(`Starting restoration for student: ${snapshot.student.personalInfo?.firstName} ${snapshot.student.personalInfo?.lastName}`);

        // Step 1: Restore student record
        await db.collection('student').updateOne(
          { _id: studentObjectId, tenantId },
          {
            $set: {
              isActive: true,
              restoredAt: new Date(),
              restoredFromAudit: auditObjectId
            },
            $unset: {
              deleted: '',
              deletedAt: '',
              deletionReason: ''
            }
          },
          { session }
        );

        // Step 2: Restore relationships based on snapshot
        const restorationOperations = [];

        // Restore teacher relationships (reactivate student's teacherAssignments)
        if (snapshot.student?.teacherAssignments?.length > 0) {
          const teacherIds = [...new Set(
            snapshot.student.teacherAssignments
              .filter(a => a.isActive !== false)
              .map(a => a.teacherId)
          )];

          if (teacherIds.length > 0) {
            // Reactivate the student's assignments
            await db.collection('student').updateOne(
              { _id: studentObjectId, tenantId },
              {
                $set: {
                  'teacherAssignments.$[elem].isActive': true,
                  'teacherAssignments.$[elem].updatedAt': new Date()
                }
              },
              {
                arrayFilters: [{ 'elem.isActive': false }],
                session
              }
            );

            restorationOperations.push({
              collection: 'student',
              operation: 'restore_teacher_assignments',
              teacherIds
            });
          }
        }

        // Note: Schedule/timeBlock restoration would need more complex logic
        // as time slots might now be occupied

        // Restore orchestra memberships
        for (const orchestra of snapshot.relatedData.orchestras) {
          if (orchestra.memberIds?.includes(studentObjectId)) {
            await db.collection('orchestra').updateOne(
              { _id: orchestra._id, tenantId },
              {
                $addToSet: { memberIds: studentObjectId },
                $set: { 'cascadeMetadata.lastUpdated': new Date() }
              },
              { session }
            );

            restorationOperations.push({
              collection: 'orchestra',
              operation: 'restore_member',
              orchestraId: orchestra._id
            });
          }
        }

        // Restore bagrut records
        await db.collection('bagrut').updateMany(
          {
            studentId: studentObjectId,
            archivedReason: 'student_deleted',
            tenantId
          },
          {
            $set: {
              isActive: true,
              restoredAt: new Date()
            },
            $unset: {
              archived: '',
              archivedAt: '',
              archivedReason: ''
            }
          },
          { session }
        );

        // Unarchive attendance records
        await db.collection('activity_attendance').updateMany(
          {
            studentId: studentObjectId,
            archivedReason: 'student_deleted',
            tenantId
          },
          {
            $unset: {
              archived: '',
              archivedAt: '',
              archivedReason: ''
            }
          },
          { session }
        );

        // Note: Rehearsal attendance restoration would unarchive the attendance records
        await db.collection('rehearsal').updateMany(
          { 'attendance.studentId': studentObjectId, tenantId },
          {
            $unset: {
              'attendance.$[elem].archived': '',
              'attendance.$[elem].archivedAt': '',
              'attendance.$[elem].archivedReason': ''
            }
          },
          {
            arrayFilters: [{
              'elem.studentId': studentObjectId,
              'elem.archivedReason': 'student_deleted'
            }],
            session
          }
        );

        // Create restoration audit record
        const restorationAuditRecord = {
          entityType: 'student',
          entityId: studentObjectId,
          tenantId,
          deletionType: 'restoration',
          originalAuditId: auditObjectId,
          restorationOperations,
          timestamp: new Date(),
          userId: new ObjectId(userId),
          reason: 'Student restoration from deletion'
        };

        await db.collection('deletion_audit').insertOne(restorationAuditRecord, { session });

        result = {
          success: true,
          studentId,
          restorationOperations,
          originalAuditId: auditObjectId,
          restorationAuditId: restorationAuditRecord._id,
          timestamp: restorationAuditRecord.timestamp
        };

        console.log(`Student restoration completed for ${studentId}`);
      });

      return result;

    } catch (error) {
      console.error('Error during student restoration:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Get deletion audit history for a student
   * @param {string} studentId
   * @param {object} context - Must contain tenantId
   */
  async getStudentDeletionAuditHistory(studentId, context) {
    const tenantId = requireTenantId(context?.tenantId);
    const db = getDB();

    try {
      const auditRecords = await db.collection('deletion_audit')
        .find({ entityId: new ObjectId(studentId), tenantId })
        .sort({ timestamp: -1 })
        .toArray();

      return auditRecords;

    } catch (error) {
      console.error('Error getting student deletion audit history:', error);
      throw error;
    }
  },

  /**
   * Bulk operations for schedule maintenance
   * @param {object[]} operations
   * @param {object} context - Must contain tenantId
   */
  async bulkUpdateTeacherSchedules(operations, context) {
    const tenantId = requireTenantId(context?.tenantId);
    const db = getDB();
    const session = db.startSession();

    try {
      let results = [];

      await session.withTransaction(async () => {
        for (const operation of operations) {
          switch (operation.type) {
            case 'free_student_slots':
              // Deactivate student lessons in timeBlocks
              const freeTimeBlockResult = await db.collection('teacher').updateMany(
                {
                  'teaching.timeBlocks.assignedLessons.studentId': operation.studentId,
                  isActive: true,
                  tenantId
                },
                {
                  $set: {
                    'teaching.timeBlocks.$[block].assignedLessons.$[lesson].isActive': false,
                    'teaching.timeBlocks.$[block].assignedLessons.$[lesson].endDate': new Date(),
                    'teaching.timeBlocks.$[block].assignedLessons.$[lesson].updatedAt': new Date()
                  }
                },
                {
                  arrayFilters: [
                    { 'block.assignedLessons.studentId': operation.studentId },
                    { 'lesson.studentId': operation.studentId }
                  ],
                  session
                }
              );
              results.push({
                operation: operation.type,
                result: { timeBlocks: freeTimeBlockResult }
              });
              break;
          }
        }
      });

      return {
        success: true,
        operationsProcessed: operations.length,
        results
      };

    } catch (error) {
      console.error('Error in bulk schedule operations:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }
};
