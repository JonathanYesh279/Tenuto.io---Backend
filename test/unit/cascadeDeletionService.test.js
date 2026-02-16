import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { complexStudentScenario, testHelpers, MOCK_STUDENT_ID } from '../fixtures/cascade-test-data.js';

// Mock MongoDB service - define mock objects inside the factory to avoid hoisting issues
const mockSession = {
  withTransaction: vi.fn(),
  endSession: vi.fn()
};

const mockCollection = {
  findOne: vi.fn(),
  find: vi.fn(() => ({
    toArray: vi.fn()
  })),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  countDocuments: vi.fn(),
  replaceOne: vi.fn(),
  client: {
    startSession: vi.fn()
  }
};

vi.mock('../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn(() => mockCollection)
}));

// Import after mock
const { cascadeDeletionService } = await import('../../services/cascadeDeletionService.js');

describe('Cascade Deletion Service - Unit Tests', () => {
  let mockData;

  beforeEach(() => {
    vi.clearAllMocks();
    mockData = testHelpers.getCleanMockData();

    // Setup default mocks - startSession returns synchronously (no await in production code)
    mockCollection.client.startSession.mockReturnValue(mockSession);
    mockSession.withTransaction.mockImplementation(async (callback) => {
      return await callback();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cascadeDeleteStudent', () => {
    it('should successfully delete student with all relationships', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);

      // Mock snapshot creation - findOne for student, find().toArray for each collection, then insertOne
      mockCollection.findOne.mockResolvedValueOnce(mockData.student); // snapshot student lookup
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' }); // snapshot insert

      // Mock successful cascade operations
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.updateMany
        .mockResolvedValueOnce({ modifiedCount: 2 }) // teacher timeBlocks
        .mockResolvedValueOnce({ modifiedCount: 2 }) // orchestras
        .mockResolvedValueOnce({ modifiedCount: 2 }) // rehearsals
        .mockResolvedValueOnce({ modifiedCount: 1 }) // theory lessons
        .mockResolvedValueOnce({ modifiedCount: 1 }); // bagrut (soft delete)

      mockCollection.deleteMany.mockResolvedValueOnce({ deletedCount: 2 }); // activity attendance

      // Audit log insert
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'audit123' });

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.studentId).toBe(MOCK_STUDENT_ID);
      expect(result.snapshotId).toBeTruthy();
    });

    it('should fail when student does not exist', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when student is already inactive', async () => {
      // Arrange
      const inactiveStudent = { ...mockData.student, isActive: false };
      mockCollection.findOne.mockResolvedValueOnce(inactiveStudent);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('already inactive');
    });

    it('should handle transaction failure with rollback information', async () => {
      // Arrange
      mockCollection.findOne
        .mockResolvedValueOnce(mockData.student)  // cascadeDeleteStudent student check
        .mockResolvedValueOnce(mockData.student); // snapshot student lookup

      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' }); // snapshot creation

      const transactionError = new Error('Transaction failed');
      mockSession.withTransaction.mockRejectedValueOnce(transactionError);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID, {
        createSnapshot: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
      expect(result.snapshotId).toBeTruthy();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('createDeletionSnapshot', () => {
    it('should create comprehensive snapshot of student data', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn()
          .mockResolvedValueOnce(mockData.teachers)
          .mockResolvedValueOnce(mockData.orchestras)
          .mockResolvedValueOnce(mockData.rehearsals)
          .mockResolvedValueOnce(mockData.theoryLessons)
          .mockResolvedValueOnce(mockData.bagrut)
          .mockResolvedValueOnce(mockData.activityAttendance)
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' });

      // Act
      const snapshotId = await cascadeDeletionService.createDeletionSnapshot(MOCK_STUDENT_ID);

      // Assert
      expect(snapshotId).toBeTruthy();
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(String),
          studentId: MOCK_STUDENT_ID,
          createdAt: expect.any(Date),
          data: expect.objectContaining({
            student: mockData.student,
          })
        })
      );
    });

    it('should handle snapshot creation failure', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }));
      const snapshotError = new Error('Snapshot creation failed');
      mockCollection.insertOne.mockRejectedValueOnce(snapshotError);

      // Act & Assert
      await expect(cascadeDeletionService.createDeletionSnapshot(MOCK_STUDENT_ID))
        .rejects.toThrow('Snapshot creation failed: Snapshot creation failed');
    });
  });

  describe('executeStudentCascade', () => {
    it('should execute all cascade operations within transaction', async () => {
      // Arrange
      const mockUpdateResults = { modifiedCount: 1 };
      const mockDeleteResults = { deletedCount: 1 };

      mockCollection.updateMany.mockResolvedValue(mockUpdateResults);
      mockCollection.deleteMany.mockResolvedValue(mockDeleteResults);
      mockCollection.updateOne.mockResolvedValue(mockUpdateResults);

      // Act
      const result = await cascadeDeletionService.executeStudentCascade(
        MOCK_STUDENT_ID,
        mockSession,
        { hardDelete: false, preserveAcademic: true }
      );

      // Assert
      expect(result.operations.length).toBeGreaterThanOrEqual(6);
      expect(result.operationCounts).toHaveProperty('teachersModified', 1);
      expect(result.operationCounts).toHaveProperty('orchestrasModified', 1);
      expect(result.operationCounts).toHaveProperty('rehearsalsModified', 1);
      expect(result.operationCounts).toHaveProperty('theoryLessonsModified', 1);
      expect(result.operationCounts).toHaveProperty('bagrutRecordsModified', 1);
      expect(result.operationCounts).toHaveProperty('attendanceRecordsDeleted', 1);
      expect(result.operationCounts).toHaveProperty('studentDeactivated', 1);
      expect(result.affectedCollections).toContain('teacher');
      expect(result.affectedCollections).toContain('orchestra');
      expect(result.affectedCollections).toContain('student');
    });

    it('should handle teacher timeBlock lesson deactivation', async () => {
      // Arrange
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      // Act
      await cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession);

      // Assert - Check that teacher update uses timeBlocks.assignedLessons pattern
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        { 'teaching.timeBlocks.assignedLessons.studentId': MOCK_STUDENT_ID },
        expect.objectContaining({
          $set: expect.objectContaining({
            'teaching.timeBlocks.$[block].assignedLessons.$[lesson].isActive': false,
          })
        }),
        expect.objectContaining({
          session: mockSession,
          arrayFilters: expect.arrayContaining([
            expect.objectContaining({ 'block.assignedLessons.studentId': MOCK_STUDENT_ID }),
            expect.objectContaining({ 'lesson.studentId': MOCK_STUDENT_ID })
          ])
        })
      );
    });

    it('should handle execution errors properly', async () => {
      // Arrange - first updateOne for assignment deactivation succeeds, then updateMany fails
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const executionError = new Error('Database operation failed');
      mockCollection.updateMany.mockRejectedValueOnce(executionError);

      // Act & Assert
      await expect(cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession))
        .rejects.toThrow('Cascade execution failed: Database operation failed');
    });
  });

  describe('cleanupOrphanedReferences', () => {
    it('should detect and report orphaned references in dry run mode', async () => {
      // Arrange - the production code queries students, teachers, and orchestras
      const activeStudents = [{ _id: new ObjectId('507f1f77bcf86cd799439001') }];
      const activeTeachers = [{ _id: new ObjectId('507f1f77bcf86cd799439002') }];

      // Students with orphaned teacherAssignments (referencing non-existent teacher)
      const studentsWithAssignments = [{
        _id: new ObjectId('507f1f77bcf86cd799439001'),
        teacherAssignments: [
          { teacherId: 'non-existent-teacher', isActive: true }
        ]
      }];

      // Orchestras with orphaned member references
      const orchestrasWithMembers = [{
        _id: new ObjectId('507f1f77bcf86cd799439003'),
        memberIds: [new ObjectId(MOCK_STUDENT_ID)] // orphaned - not in active students
      }];

      // Mock find calls in order
      let findCallCount = 0;
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockImplementation(() => {
          findCallCount++;
          switch(findCallCount) {
            case 1: return Promise.resolve(activeStudents);    // active students
            case 2: return Promise.resolve(activeTeachers);    // active teachers
            case 3: return Promise.resolve(studentsWithAssignments); // students with assignments
            case 4: return Promise.resolve(orchestrasWithMembers);  // orchestras
            default: return Promise.resolve([]);
          }
        })
      }));

      // Act
      const result = await cascadeDeletionService.cleanupOrphanedReferences(true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.totalOrphanedReferences).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      const cleanupError = new Error('Cleanup operation failed');
      mockCollection.find.mockImplementation(() => {
        throw cleanupError;
      });

      // Act & Assert
      await expect(cascadeDeletionService.cleanupOrphanedReferences())
        .rejects.toThrow('Cleanup failed: Cleanup operation failed');
    });
  });

  describe('validateDeletionImpact', () => {
    it('should analyze student deletion impact correctly', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.countDocuments
        .mockResolvedValueOnce(2) // teachers
        .mockResolvedValueOnce(2) // orchestras
        .mockResolvedValueOnce(3) // rehearsals
        .mockResolvedValueOnce(1) // theory lessons
        .mockResolvedValueOnce(1) // bagrut
        .mockResolvedValueOnce(5); // activity attendance

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.impact.studentExists).toBe(true);
      expect(result.impact.studentActive).toBe(true);
      expect(result.impact.totalReferences).toBe(14);
      expect(result.impact.relatedRecords.teacher).toBe(2);
      expect(result.impact.relatedRecords.bagrut).toBe(1);
      expect(result.impact.criticalDependencies).toContain('Academic bagrut records exist - consider preserveAcademic option');
    });

    it('should handle student not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should warn about students with no relationships', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.countDocuments.mockResolvedValue(0); // No related records

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.impact.totalReferences).toBe(0);
    });
  });

  describe('rollbackDeletion', () => {
    it('should successfully rollback deletion from snapshot', async () => {
      // Arrange
      const snapshotData = testHelpers.createSnapshotData(MOCK_STUDENT_ID, {
        student: mockData.student,
        teachers: mockData.teachers.slice(0, 1),
        orchestras: mockData.orchestras.slice(0, 1)
      });

      mockCollection.findOne.mockResolvedValueOnce(snapshotData);
      mockCollection.replaceOne.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Mark snapshot as used

      // Act
      const result = await cascadeDeletionService.rollbackDeletion(snapshotData._id.toString());

      // Assert
      expect(result.success).toBe(true);
      expect(result.studentId).toBe(MOCK_STUDENT_ID);
      expect(mockSession.withTransaction).toHaveBeenCalled();
    });

    it('should handle snapshot not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.rollbackDeletion('nonexistent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle rollback transaction failure', async () => {
      // Arrange
      const snapshotData = testHelpers.createSnapshotData(MOCK_STUDENT_ID, {});
      mockCollection.findOne.mockResolvedValueOnce(snapshotData);

      const rollbackError = new Error('Rollback transaction failed');
      mockSession.withTransaction.mockRejectedValueOnce(rollbackError);

      // Act
      const result = await cascadeDeletionService.rollbackDeletion(snapshotData._id.toString());

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rollback transaction failed');
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('generateDeletionAuditLog', () => {
    it('should create comprehensive audit log entry', async () => {
      // Arrange
      const operations = [
        { collection: 'teacher', operation: 'updateMany', modifiedCount: 2 },
        { collection: 'student', operation: 'updateOne', modifiedCount: 1 }
      ];
      const metadata = {
        startTime: new Date('2023-09-15T10:00:00Z'),
        endTime: new Date('2023-09-15T10:01:00Z'),
        snapshotId: 'snapshot123',
        options: { hardDelete: false }
      };

      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'audit123' });

      // Act
      const auditLog = await cascadeDeletionService.generateDeletionAuditLog(
        MOCK_STUDENT_ID,
        operations,
        metadata
      );

      // Assert
      expect(auditLog._id).toBeTruthy();
      expect(auditLog.type).toBe('student_cascade_deletion');
      expect(auditLog.studentId).toBe(MOCK_STUDENT_ID);
      expect(auditLog.operations).toEqual(operations);
      expect(auditLog.metadata).toEqual(metadata);
      expect(auditLog.summary).toEqual({
        totalOperations: 2,
        collectionsAffected: ['teacher', 'student'],
        executionTime: metadata.executionTime || null,
        snapshotCreated: true
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(auditLog);
    });

    it('should handle audit log creation failure gracefully', async () => {
      // Arrange
      const auditError = new Error('Audit log creation failed');
      mockCollection.insertOne.mockRejectedValueOnce(auditError);

      // Act
      const result = await cascadeDeletionService.generateDeletionAuditLog(
        MOCK_STUDENT_ID,
        [],
        {}
      );

      // Assert
      expect(result.error).toBe('Audit log generation failed');
      expect(result.message).toBe('Audit log creation failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle MongoDB session creation failure', async () => {
      // Arrange
      mockCollection.findOne
        .mockResolvedValueOnce(mockData.student)  // cascadeDeleteStudent student check
        .mockResolvedValueOnce(mockData.student); // snapshot student lookup

      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' }); // snapshot

      const sessionError = new Error('Session creation failed');
      mockCollection.client.startSession.mockImplementation(() => {
        throw sessionError;
      });

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session creation failed');
    });

    it('should handle partial operation failures during cascade execution', async () => {
      // Arrange - first updateOne for student assignment deactivation, then updateMany calls
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      mockCollection.updateMany
        .mockResolvedValueOnce({ modifiedCount: 2 }) // teachers succeed
        .mockRejectedValueOnce(new Error('Orchestra update failed')); // orchestras fail

      // Act & Assert
      await expect(cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession))
        .rejects.toThrow('Cascade execution failed: Orchestra update failed');
    });

    it('should ensure session cleanup on all execution paths', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      // Skip snapshot (createSnapshot defaults to true, so we need snapshot data)
      mockCollection.findOne.mockResolvedValueOnce(mockData.student); // snapshot student
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' });

      mockSession.withTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      // Act
      await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});