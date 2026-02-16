import { describe, it, expect, vi, beforeEach } from 'vitest'
import { studentService } from '../student.service.js'
import { validateStudent } from '../student.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { requireTenantId } from '../../../middleware/tenant.middleware.js'
import { buildScopedFilter } from '../../../utils/queryScoping.js'
import { ObjectId } from 'mongodb'

const TEST_TENANT_ID = 'test-tenant-id'
const TEST_CONTEXT = { context: { tenantId: TEST_TENANT_ID, isAdmin: true, userId: 'test-user-id' } }

// Mock dependencies
vi.mock('../student.validation.js', () => ({
  validateStudent: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../../middleware/tenant.middleware.js', () => ({
  requireTenantId: vi.fn((id) => {
    if (!id) throw new Error('TENANT_GUARD: tenantId is required but was not provided.')
    return id
  })
}))

vi.mock('../../../utils/queryScoping.js', () => ({
  buildScopedFilter: vi.fn((collection, baseFilter, context) => {
    if (!context?.tenantId) throw new Error('TENANT_GUARD: buildScopedFilter requires context.tenantId.')
    return { ...baseFilter, tenantId: context.tenantId }
  })
}))

vi.mock('../../school-year/school-year.service.js', async () => {
  const schoolYearService = {
    getCurrentSchoolYear: vi.fn().mockResolvedValue({
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
      name: '2023-2024',
      isCurrent: true
    })
  }
  return { schoolYearService }
})

// Mock relationship validation and assignment validation (used by updateStudent)
vi.mock('../../../services/relationshipValidationService.js', () => ({
  relationshipValidationService: {
    validateStudentTeacherRelationships: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] })
  }
}))

vi.mock('../student-assignments.validation.js', () => ({
  validateTeacherAssignmentsWithDB: vi.fn().mockResolvedValue({
    isValid: true,
    validatedAssignments: [],
    errors: [],
    warnings: [],
    fixes: []
  })
}))

describe('Student Service', () => {
  let mockStudentCollection, mockTeacherCollection, mockFind, mockFindOne, mockInsertOne, mockFindOneAndUpdate, mockUpdateOne

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup MongoDB collection mock methods
    mockFind = vi.fn().mockReturnThis()
    mockFindOne = vi.fn()
    mockInsertOne = vi.fn()
    mockFindOneAndUpdate = vi.fn()
    mockUpdateOne = vi.fn()

    // Mock session for updateStudent transaction support
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn()
    }

    mockStudentCollection = {
      find: mockFind,
      toArray: vi.fn(),
      findOne: mockFindOne,
      insertOne: mockInsertOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      updateOne: vi.fn(),
      updateMany: vi.fn(),
      countDocuments: vi.fn().mockResolvedValue(0),
      client: {
        startSession: vi.fn().mockReturnValue(mockSession)
      }
    }

    mockTeacherCollection = {
      findOne: vi.fn(),
      updateOne: mockUpdateOne,
      updateMany: vi.fn()
    }

    // Properly chain the find and toArray methods
    mockFind.mockReturnValue({
      toArray: mockStudentCollection.toArray
    })

    // Mock getCollection to return different collections based on name
    getCollection.mockImplementation((name) => {
      if (name === 'teacher') {
        return Promise.resolve(mockTeacherCollection)
      }
      return Promise.resolve(mockStudentCollection)
    })
  })

  describe('getStudents', () => {
    it('should get all students with default filter', async () => {
      // Setup
      const mockStudents = [
        { _id: '1', personalInfo: { firstName: 'Student', lastName: '1' } },
        { _id: '2', personalInfo: { firstName: 'Student', lastName: '2' } }
      ]

      mockStudentCollection.toArray.mockResolvedValue(mockStudents)

      // Execute - getStudents(filterBy, page, limit, options)
      const result = await studentService.getStudents({}, 1, 0, TEST_CONTEXT)

      // Assert
      expect(buildScopedFilter).toHaveBeenCalled()
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true,
        tenantId: TEST_TENANT_ID
      }))
      expect(result).toEqual(mockStudents)
    })

    it('should apply instrument filter correctly', async () => {
      // Setup
      const filterBy = { instrument: 'חצוצרה' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.instrumentProgress.instrumentName': 'חצוצרה'
      }))
    })

    it('should apply stage filter correctly', async () => {
      // Setup
      const filterBy = { stage: '3' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.instrumentProgress.currentStage': 3
      }))
    })

    it('should include inactive students when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: false
      }))
    })

    it('should handle database errors', async () => {
      // Setup
      mockStudentCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.getStudents({}, 1, 0, TEST_CONTEXT))
        .rejects.toThrow('Error getting students: Database error')
    })
  })

  describe('getStudentById', () => {
    it('should get a student by ID', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockStudent = {
        _id: studentId,
        personalInfo: { firstName: 'Test', lastName: 'Student' }
      }

      mockFindOne.mockResolvedValue(mockStudent)

      // Execute - getStudentById(studentId, options)
      const result = await studentService.getStudentById(studentId.toString(), TEST_CONTEXT)

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: expect.anything(),
        tenantId: TEST_TENANT_ID
      })
      expect(result).toEqual(mockStudent)
    })

    it('should throw error if student is not found', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.getStudentById(studentId.toString(), TEST_CONTEXT))
        .rejects.toThrow(`Error getting student by id: Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.getStudentById(studentId.toString(), TEST_CONTEXT))
        .rejects.toThrow('Error getting student by id: Database error')
    })
  })

  describe('addStudent', () => {
    it('should add a new student with current school year', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: {
          firstName: 'New',
          lastName: 'Student',
          phone: '0501234567'
        },
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1, isPrimary: true }
          ],
          class: 'א'
        },
        enrollments: {
          schoolYears: []
        }
      }

      const validationResult = {
        error: null,
        value: { ...studentToAdd }
      }

      validateStudent.mockReturnValue(validationResult)

      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockInsertOne.mockResolvedValue({ insertedId })

      // Execute - addStudent(studentToAdd, teacherId, isAdmin, options)
      const result = await studentService.addStudent(studentToAdd, null, false, TEST_CONTEXT)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToAdd)
      expect(mockInsertOne).toHaveBeenCalled()
      expect(result).toHaveProperty('_id', insertedId)
    })

    it('should throw error for invalid student data', async () => {
      // Setup
      const studentToAdd = { invalidData: true }

      const validationResult = {
        error: new Error('Invalid student data'),
        value: null
      }

      validateStudent.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(studentService.addStudent(studentToAdd, null, false, TEST_CONTEXT))
        .rejects.toThrow('Error adding student: Invalid student data')
    })
  })

  describe('updateStudent', () => {
    it('should update an existing student by admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Student',
          phone: '0501234567'
        },
        academicInfo: {
          currentStage: 2
        }
      }

      const validationResult = {
        error: null,
        value: { ...studentToUpdate }
      }

      validateStudent.mockReturnValue(validationResult)

      // Mock findOne for original student lookup
      mockFindOne.mockResolvedValue({
        _id: studentId,
        personalInfo: { firstName: 'Old', lastName: 'Student' },
        teacherAssignments: [],
        tenantId: TEST_TENANT_ID
      })

      const updatedStudent = {
        _id: studentId,
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Student',
          phone: '0501234567'
        },
        academicInfo: {
          currentStage: 2
        },
        updatedAt: new Date()
      }

      mockFindOneAndUpdate.mockResolvedValue(updatedStudent)

      // Execute - updateStudent(studentId, studentToUpdate, teacherId, isAdmin, options)
      const result = await studentService.updateStudent(studentId.toString(), studentToUpdate, null, true, TEST_CONTEXT)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToUpdate, true)
      expect(mockFindOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedStudent)
    })

    it('should throw error for invalid student data', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = { invalidData: true }

      const validationResult = {
        error: new Error('Invalid student data'),
        value: null
      }

      validateStudent.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate, null, true, TEST_CONTEXT))
        .rejects.toThrow('Error updating student: Invalid student data: Invalid student data')
    })

    it('should throw error if student is not found', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { firstName: 'Updated', lastName: 'Student' }
      }

      const validationResult = {
        error: null,
        value: studentToUpdate
      }

      validateStudent.mockReturnValue(validationResult)

      // findOne for original student
      mockFindOne.mockResolvedValue({
        _id: studentId,
        personalInfo: { firstName: 'Old', lastName: 'Student' },
        teacherAssignments: [],
        tenantId: TEST_TENANT_ID
      })

      // findOneAndUpdate returns null (not found after update)
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate, null, true, TEST_CONTEXT))
        .rejects.toThrow(`Error updating student: Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { firstName: 'Updated', lastName: 'Student' }
      }

      const validationResult = {
        error: null,
        value: studentToUpdate
      }

      validateStudent.mockReturnValue(validationResult)

      // findOne for original student
      mockFindOne.mockResolvedValue({
        _id: studentId,
        personalInfo: { firstName: 'Old', lastName: 'Student' },
        teacherAssignments: [],
        tenantId: TEST_TENANT_ID
      })

      // Mock findOneAndUpdate to throw a database error
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate, null, true, TEST_CONTEXT))
        .rejects.toThrow('Error updating student: Database error')
    })
  })

  describe('removeStudent', () => {
    it('should deactivate a student (soft delete) by admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true

      const deactivatedStudent = {
        _id: studentId,
        personalInfo: { firstName: 'Deactivated', lastName: 'Student' },
        isActive: false,
        updatedAt: new Date()
      }

      mockFindOneAndUpdate.mockResolvedValue(deactivatedStudent)

      // Execute - removeStudent(studentId, teacherId, isAdmin, options)
      const result = await studentService.removeStudent(studentId.toString(), null, isAdmin, TEST_CONTEXT)

      // Assert
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.anything(), tenantId: TEST_TENANT_ID },
        { $set: expect.objectContaining({
          isActive: false,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      expect(result).toEqual(deactivatedStudent)
    })

    it('should throw error if student is not found (admin removal)', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true

      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.removeStudent(studentId.toString(), null, isAdmin, TEST_CONTEXT))
        .rejects.toThrow(`Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true

      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudent(studentId.toString(), null, isAdmin, TEST_CONTEXT))
        .rejects.toThrow(`Database error`)
    })
  })

  describe('checkTeacherHasAccessToStudent', () => {
    it('should return true if teacher has access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      // Post Phase-2: checks via teacherAssignments on student collection (not teacher collection)
      mockFindOne.mockResolvedValue({
        _id: studentId,
        teacherAssignments: [{ teacherId: teacherId.toString() }]
      })

      // Execute - checkTeacherHasAccessToStudent(teacherId, studentId, options)
      const result = await studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString(),
        TEST_CONTEXT
      )

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: expect.anything(),
        tenantId: TEST_TENANT_ID,
        'teacherAssignments.teacherId': teacherId.toString(),
        isActive: true
      })
      expect(result).toBe(true)
    })

    it('should return false if teacher has no access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      // Student not found with this teacher assignment
      mockFindOne.mockResolvedValue(null)

      // Execute
      const result = await studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString(),
        TEST_CONTEXT
      )

      // Assert
      expect(mockFindOne).toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString(),
        TEST_CONTEXT
      )).rejects.toThrow('Error checking teacher access to student: Database error')
    })
  })

  describe('associateStudentWithTeacher', () => {
    it('should associate student with teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      mockStudentCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute - associateStudentWithTeacher(studentId, teacherId, options)
      const result = await studentService.associateStudentWithTeacher(
        studentId.toString(),
        teacherId.toString(),
        TEST_CONTEXT
      )

      // Assert - now updates student's teacherAssignments (not teacher's studentIds)
      expect(mockStudentCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything(), tenantId: TEST_TENANT_ID },
        expect.objectContaining({
          $push: { teacherAssignments: expect.any(Object) },
          $set: { updatedAt: expect.any(Date) }
        })
      )
      expect(result).toMatchObject({
        success: true,
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      mockStudentCollection.updateOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.associateStudentWithTeacher(
        studentId.toString(),
        teacherId.toString(),
        TEST_CONTEXT
      )).rejects.toThrow('Error associating student with teacher: Database error')
    })
  })

  describe('removeStudentTeacherAssociation', () => {
    it('should remove student from teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      mockTeacherCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })
      mockStudentCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })

      // Execute - removeStudentTeacherAssociation(studentId, teacherId, options)
      const result = await studentService.removeStudentTeacherAssociation(
        studentId.toString(),
        teacherId.toString(),
        TEST_CONTEXT
      )

      // Assert
      expect(result).toMatchObject({
        message: 'Student removed from teacher successfully',
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')

      mockTeacherCollection.updateMany.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudentTeacherAssociation(
        studentId.toString(),
        teacherId.toString(),
        TEST_CONTEXT
      )).rejects.toThrow('Error removing student from teacher: Database error')
    })
  })

  // Filter building functionality tests
  describe('Filter building functionality', () => {
    it('should build criteria with class filter', async () => {
      // Setup
      const filterBy = { class: 'א' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.class': 'א',
        isActive: true,
        tenantId: TEST_TENANT_ID
      }))
    })

    it('should build criteria with orchestra filter', async () => {
      // Setup
      const filterBy = { orchestraId: 'orchestra1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalled()
    })

    it('should build criteria with school year filter', async () => {
      // Setup
      const filterBy = { schoolYearId: 'year1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalled()
    })
  })
})
