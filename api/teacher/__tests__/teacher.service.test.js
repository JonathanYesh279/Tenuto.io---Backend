import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teacherService } from '../teacher.service.js'
import { validateTeacher } from '../teacher.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'
import { authService } from '../../auth/auth.service.js'

const TEST_CONTEXT = { context: { tenantId: 'test-tenant-id' } }

// Mock dependencies
vi.mock('../teacher.validation.js', () => ({
  validateTeacher: vi.fn(),
  validateTeacherUpdate: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../auth/auth.service.js', () => ({
  authService: {
    encryptPassword: vi.fn()
  }
}))

vi.mock('../../../services/duplicateDetectionService.js', () => ({
  DuplicateDetectionService: {
    detectTeacherDuplicates: vi.fn().mockResolvedValue({ hasDuplicates: false, duplicates: [], duplicateCount: 0 }),
    shouldBlockCreation: vi.fn().mockReturnValue(false)
  }
}))

vi.mock('../../../services/emailService.js', () => ({
  emailService: {
    sendInvitationEmail: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../../services/invitationConfig.js', () => ({
  invitationConfig: {
    isEmailMode: vi.fn().mockReturnValue(false),
    isDefaultPasswordMode: vi.fn().mockReturnValue(true),
    getDefaultPassword: vi.fn().mockReturnValue('defaultPass123')
  }
}))

vi.mock('../../../utils/queryScoping.js', () => ({
  buildScopedFilter: vi.fn((collection, criteria, context) => {
    return { ...criteria, tenantId: context?.tenantId }
  })
}))

vi.mock('../../../middleware/tenant.middleware.js', () => ({
  requireTenantId: vi.fn((tenantId) => {
    if (!tenantId) throw new Error('TENANT_GUARD: tenantId is required')
    return tenantId
  })
}))

describe('Teacher Service', () => {
  let mockCollection, mockFind, mockFindOne, mockInsertOne, mockFindOneAndUpdate

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup MongoDB collection mock methods
    mockFind = vi.fn().mockReturnThis()
    mockFindOne = vi.fn()
    mockInsertOne = vi.fn()
    mockFindOneAndUpdate = vi.fn()

    mockCollection = {
      find: mockFind,
      toArray: vi.fn(),
      findOne: mockFindOne,
      insertOne: mockInsertOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      countDocuments: vi.fn()
    }

    // Properly chain the find and toArray methods
    mockFind.mockReturnValue({
      toArray: mockCollection.toArray
    })

    getCollection.mockResolvedValue(mockCollection)
  })

  describe('getTeachers', () => {
    it('should get all teachers with default filter', async () => {
      // Setup
      const mockTeachers = [
        { _id: '1', personalInfo: { firstName: 'Teacher', lastName: 'One' } },
        { _id: '2', personalInfo: { firstName: 'Teacher', lastName: 'Two' } }
      ]

      mockCollection.toArray.mockResolvedValue(mockTeachers)

      // Execute
      const result = await teacherService.getTeachers({}, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true,
        tenantId: 'test-tenant-id'
      }))
      expect(result).toEqual(mockTeachers)
    })

    it('should apply name filter correctly', async () => {
      // Setup
      const filterBy = { name: 'Teacher 1' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy, 1, 0, TEST_CONTEXT)

      // Assert - name filter now uses $or with firstName/lastName/fullName
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: expect.arrayContaining([
          { 'personalInfo.firstName': { $regex: 'Teacher 1', $options: 'i' } },
          { 'personalInfo.lastName': { $regex: 'Teacher 1', $options: 'i' } },
          { 'personalInfo.fullName': { $regex: 'Teacher 1', $options: 'i' } }
        ]),
        isActive: true,
        tenantId: 'test-tenant-id'
      }))
    })

    it('should apply instrument filter correctly', async () => {
      // Setup
      const filterBy = { instrument: 'Piano' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy, 1, 0, TEST_CONTEXT)

      // Assert - instrument filter now uses $or with instruments[]/instrument
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: expect.arrayContaining([
          { 'professionalInfo.instruments': { $regex: 'Piano', $options: 'i' } },
          { 'professionalInfo.instrument': { $regex: 'Piano', $options: 'i' } }
        ]),
        isActive: true,
        tenantId: 'test-tenant-id'
      }))
    })

    it('should apply orchestra filter correctly', async () => {
      // Setup
      const filterBy = { orchestraId: '456' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'conducting.orchestraIds': '456',
        isActive: true,
        tenantId: 'test-tenant-id'
      }))
    })

    it('should apply ensemble filter correctly', async () => {
      // Setup
      const filterBy = { ensembleId: '789' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'ensembleIds': '789',
        isActive: true,
        tenantId: 'test-tenant-id'
      }))
    })

    it('should include inactive teachers when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy, 1, 0, TEST_CONTEXT)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: false,
        tenantId: 'test-tenant-id'
      }))
    })

    it('should handle database errors', async () => {
      // Setup
      const dbError = new Error('Database error')
      mockCollection.toArray.mockRejectedValue(dbError)

      // Execute & Assert
      await expect(teacherService.getTeachers({}, 1, 0, TEST_CONTEXT))
        .rejects.toThrow('Error getting teachers: Database error')
    })

    it('should throw TENANT_GUARD when no tenantId provided', async () => {
      // Execute & Assert
      await expect(teacherService.getTeachers({}))
        .rejects.toThrow('TENANT_GUARD')
    })
  })

  describe('getTeacherById', () => {
    it('should get a teacher by ID', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockTeacher = {
        _id: teacherId,
        personalInfo: { firstName: 'Test', lastName: 'Teacher' }
      }

      mockFindOne.mockResolvedValue(mockTeacher)

      // Execute
      const result = await teacherService.getTeacherById(teacherId.toString(), TEST_CONTEXT)

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith(expect.objectContaining({
        _id: expect.any(ObjectId),
        tenantId: 'test-tenant-id'
      }))
      expect(result).toEqual(mockTeacher)
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.getTeacherById(teacherId.toString(), TEST_CONTEXT))
        .rejects.toThrow(`Error getting teacher by id: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.getTeacherById(teacherId.toString(), TEST_CONTEXT))
        .rejects.toThrow('Error getting teacher by id: Database error')
    })
  })

  describe('updateTeacher', () => {
    it('should update an existing teacher', async () => {
      // Setup
      const { validateTeacherUpdate } = await import('../teacher.validation.js')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Teacher',
          phone: '0501234567',
          email: 'updated@example.com',
          address: 'Updated Address'
        },
        roles: ['מורה', 'מנצח']
      }

      const validationResult = {
        error: null,
        value: { ...teacherToUpdate }
      }

      validateTeacherUpdate.mockReturnValue(validationResult)

      // Mock findOne for current teacher lookup
      mockFindOne.mockResolvedValue({
        _id: teacherId,
        personalInfo: { firstName: 'Old', lastName: 'Teacher' },
        credentials: { email: 'old@example.com' }
      })

      const updatedTeacher = {
        _id: teacherId,
        ...teacherToUpdate,
        updatedAt: new Date()
      }

      mockFindOneAndUpdate.mockResolvedValue(updatedTeacher)

      // Execute
      const result = await teacherService.updateTeacher(teacherId.toString(), teacherToUpdate, TEST_CONTEXT)

      // Assert
      expect(validateTeacherUpdate).toHaveBeenCalledWith(teacherToUpdate)
      expect(result).toEqual(updatedTeacher)
    })

    it('should throw error for invalid teacher data', async () => {
      // Setup
      const { validateTeacherUpdate } = await import('../teacher.validation.js')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = { invalidData: true }

      const validationResult = {
        error: new Error('Invalid teacher data'),
        value: null
      }

      validateTeacherUpdate.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate, TEST_CONTEXT))
        .rejects.toThrow('Error updating teacher: Invalid teacher data')
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const { validateTeacherUpdate } = await import('../teacher.validation.js')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: { firstName: 'Updated', lastName: 'Teacher' }
      }

      const validationResult = {
        error: null,
        value: teacherToUpdate
      }

      validateTeacherUpdate.mockReturnValue(validationResult)
      // findOne for current teacher returns null
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate, TEST_CONTEXT))
        .rejects.toThrow(`Error updating teacher: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const { validateTeacherUpdate } = await import('../teacher.validation.js')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: { firstName: 'Updated', lastName: 'Teacher' }
      }

      const validationResult = {
        error: null,
        value: teacherToUpdate
      }

      validateTeacherUpdate.mockReturnValue(validationResult)
      // findOne for current teacher succeeds
      mockFindOne.mockResolvedValue({
        _id: teacherId,
        personalInfo: { firstName: 'Old', lastName: 'Teacher' },
        credentials: { email: 'old@example.com' }
      })
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate, TEST_CONTEXT))
        .rejects.toThrow('Error updating teacher: Database error')
    })
  })

  describe('removeTeacher', () => {
    it('should deactivate a teacher (soft delete)', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      const deactivatedTeacher = {
        _id: teacherId,
        personalInfo: { firstName: 'Deactivated', lastName: 'Teacher' },
        isActive: false,
        updatedAt: new Date()
      }

      mockFindOneAndUpdate.mockResolvedValue(deactivatedTeacher)

      // Execute
      const result = await teacherService.removeTeacher(teacherId.toString(), TEST_CONTEXT)

      // Assert
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId), tenantId: 'test-tenant-id' },
        {
          $set: {
            isActive: false,
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )

      expect(result).toEqual(deactivatedTeacher)
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.removeTeacher(teacherId.toString(), TEST_CONTEXT))
        .rejects.toThrow(`Error removing teacher: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.removeTeacher(teacherId.toString(), TEST_CONTEXT))
        .rejects.toThrow('Error removing teacher: Database error')
    })
  })

  describe('getTeacherByRole', () => {
    it('should get teachers by role', async () => {
      // Setup
      const role = 'מורה'
      const mockTeachers = [
        { _id: '1', personalInfo: { firstName: 'Teacher', lastName: 'One' }, roles: ['מורה'] },
        { _id: '2', personalInfo: { firstName: 'Teacher', lastName: 'Two' }, roles: ['מורה', 'מנצח'] }
      ]

      mockCollection.toArray.mockResolvedValue(mockTeachers)

      // Execute
      const result = await teacherService.getTeacherByRole(role, TEST_CONTEXT)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        roles: role,
        isActive: true,
        tenantId: 'test-tenant-id'
      })
      expect(result).toEqual(mockTeachers)
    })

    it('should handle database errors', async () => {
      // Setup
      mockCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.getTeacherByRole('מורה', TEST_CONTEXT))
        .rejects.toThrow('Error getting teacher by role: Database error')
    })
  })
})
