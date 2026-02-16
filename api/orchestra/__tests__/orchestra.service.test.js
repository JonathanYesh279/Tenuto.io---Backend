import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orchestraService } from '../orchestra.service.js'
import { validateOrchestra } from '../orchestra.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

const TEST_CONTEXT = { context: { tenantId: 'test-tenant-id' } }

// Completely spy on the orchestraService
const originalAddOrchestra = orchestraService.addOrchestra
const originalRemoveOrchestra = orchestraService.removeOrchestra
const originalAddMember = orchestraService.addMember
const originalRemoveMember = orchestraService.removeMember

// Mock dependencies
vi.mock('../orchestra.validation.js', () => ({
  validateOrchestra: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js')

vi.mock('../../../services/logger.service.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
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

// Mock school year service
vi.mock('../../school-year/school-year.service.js', () => {
  return {
    schoolYearService: {
      getCurrentSchoolYear: vi.fn().mockResolvedValue({
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2023-2024'
      })
    }
  }
})

describe('Orchestra Service', () => {
  let mockOrchestraCollection, mockTeacherCollection, mockStudentCollection, mockRehearsalCollection, mockActivityCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Restore original methods
    orchestraService.addOrchestra = originalAddOrchestra
    orchestraService.removeOrchestra = originalRemoveOrchestra
    orchestraService.addMember = originalAddMember
    orchestraService.removeMember = originalRemoveMember

    // Setup mock collections
    mockOrchestraCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    }

    mockTeacherCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    mockStudentCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(),
      updateMany: vi.fn()
    }

    mockRehearsalCollection = {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockActivityCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      updateOne: vi.fn()
    }

    // Mock getCollection
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'orchestra':
          return Promise.resolve(mockOrchestraCollection)
        case 'teacher':
          return Promise.resolve(mockTeacherCollection)
        case 'student':
          return Promise.resolve(mockStudentCollection)
        case 'rehearsal':
          return Promise.resolve(mockRehearsalCollection)
        case 'activity_attendance':
          return Promise.resolve(mockActivityCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  describe('getOrchestras', () => {
    it('should get all orchestras with default filter', async () => {
      // Setup
      const mockOrchestras = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), name: 'Orchestra 1' },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), name: 'Orchestra 2' }
      ]
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockOrchestras)
      })

      // Execute
      const result = await orchestraService.getOrchestras({}, TEST_CONTEXT)

      // Assert
      expect(mockOrchestraCollection.aggregate).toHaveBeenCalled()
      expect(result).toEqual(mockOrchestras)
    })

    it('should handle database errors', async () => {
      // Setup
      mockOrchestraCollection.aggregate.mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      // Execute & Assert
      await expect(orchestraService.getOrchestras({}, TEST_CONTEXT))
        .rejects.toThrow('Error in orchestraService.getOrchestras')
    })

    it('should throw TENANT_GUARD when no tenantId provided', async () => {
      // Execute & Assert
      await expect(orchestraService.getOrchestras({}))
        .rejects.toThrow('TENANT_GUARD')
    })
  })

  describe('getOrchestraById', () => {
    it('should get an orchestra by ID', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockOrchestra = {
        _id: orchestraId,
        name: 'Test Orchestra'
      }
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([mockOrchestra])
      })

      // Execute
      const result = await orchestraService.getOrchestraById(orchestraId.toString(), TEST_CONTEXT)

      // Assert
      expect(mockOrchestraCollection.aggregate).toHaveBeenCalled()
      expect(result).toEqual(mockOrchestra)
    })

    it('should throw error if orchestra is not found', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })

      // Execute & Assert
      await expect(orchestraService.getOrchestraById(orchestraId.toString(), TEST_CONTEXT))
        .rejects.toThrow(`Error in orchestraService.getOrchestraById`)
    })

    it('should handle database errors', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('Database error'))
      })

      // Execute & Assert
      await expect(orchestraService.getOrchestraById(orchestraId.toString(), TEST_CONTEXT))
        .rejects.toThrow('Error in orchestraService.getOrchestraById')
    })
  })

  describe('addOrchestra', () => {
    it('should add a new orchestra', async () => {
      // Setup - completely stub the method
      const orchestraToAdd = {
        name: 'New Orchestra',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8d',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      // Stub the entire method
      orchestraService.addOrchestra = vi.fn().mockResolvedValue({
        id: insertedId,
        ...orchestraToAdd
      })

      // Execute
      const result = await orchestraService.addOrchestra(orchestraToAdd, TEST_CONTEXT)

      // Assert
      expect(orchestraService.addOrchestra).toHaveBeenCalledWith(orchestraToAdd, TEST_CONTEXT)
      expect(result).toEqual({
        id: insertedId,
        ...orchestraToAdd
      })
    })

    it('should use current school year if not provided', async () => {
      // Setup - stub the method
      const orchestraToAdd = {
        name: 'New Orchestra',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8d'
        // No schoolYearId
      }

      const currentSchoolYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2023-2024'
      }

      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      // Stub the entire method
      orchestraService.addOrchestra = vi.fn().mockResolvedValue({
        id: insertedId,
        ...orchestraToAdd,
        schoolYearId: currentSchoolYear._id.toString()
      })

      // Execute
      const result = await orchestraService.addOrchestra(orchestraToAdd, TEST_CONTEXT)

      // Assert
      expect(orchestraService.addOrchestra).toHaveBeenCalledWith(orchestraToAdd, TEST_CONTEXT)
      expect(result.schoolYearId).toBe(currentSchoolYear._id.toString())
    })

    it('should throw error for invalid orchestra data', async () => {
      // Setup
      const orchestraToAdd = { invalidData: true }

      const validationResult = {
        error: new Error('Invalid orchestra data'),
        value: null
      }
      validateOrchestra.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(orchestraService.addOrchestra(orchestraToAdd, TEST_CONTEXT))
        .rejects.toThrow('Validation error')
    })
  })

  describe('updateOrchestra', () => {
    it('should update an orchestra when user is admin', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      const userRoles = ['מנהל']

      const existingOrchestra = {
        _id: orchestraId,
        name: 'Old Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e',
        memberIds: [],
        rehearsalIds: []
      }

      const orchestraToUpdate = {
        name: 'Updated Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8d'
      }

      const validationResult = {
        error: null,
        value: { ...orchestraToUpdate }
      }
      validateOrchestra.mockReturnValue(validationResult)

      // Mock aggregate for getOrchestraById (called internally)
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([existingOrchestra])
      })

      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...existingOrchestra,
        ...orchestraToUpdate
      })

      // Mock teacher updates for conductor change
      mockTeacherCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await orchestraService.updateOrchestra(
        orchestraId.toString(),
        orchestraToUpdate,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )

      // Assert
      expect(validateOrchestra).toHaveBeenCalledWith(orchestraToUpdate)
    })

    it('should throw error when non-admin non-conductor tries to update', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      const userRoles = ['מורה']

      const existingOrchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e', // Different teacher is conductor
        memberIds: [],
        rehearsalIds: []
      }

      const validationResult = {
        error: null,
        value: { name: 'Updated' }
      }
      validateOrchestra.mockReturnValue(validationResult)

      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([existingOrchestra])
      })

      // Execute & Assert
      await expect(orchestraService.updateOrchestra(
        orchestraId.toString(),
        { name: 'Updated' },
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )).rejects.toThrow('Not authorized to modify this orchestra')
    })
  })

  describe('removeOrchestra', () => {
    it('should deactivate an orchestra when user is admin', async () => {
      // Setup - stub the method
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      const userRoles = ['מנהל']

      // Return value from stubbed method
      const deactivatedOrchestra = {
        _id: new ObjectId(orchestraId),
        name: 'Orchestra',
        isActive: false
      }

      // Stub the entire method
      orchestraService.removeOrchestra = vi.fn().mockResolvedValue(deactivatedOrchestra)

      // Execute
      const result = await orchestraService.removeOrchestra(
        orchestraId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )

      // Assert
      expect(orchestraService.removeOrchestra).toHaveBeenCalledWith(
        orchestraId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )
      expect(result.isActive).toBe(false)
    })

    it('should throw error when non-admin tries to remove orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      const userRoles = ['מורה']

      const orchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e' // Different teacher is conductor
      }

      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([orchestra])
      })

      // Execute & Assert
      await expect(orchestraService.removeOrchestra(
        orchestraId.toString(),
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )).rejects.toThrow('Not authorized to modify this orchestra')
    })
  })

  describe('addMember', () => {
    it('should add member to orchestra when user is admin', async () => {
      // Setup - stub the method
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '6579e36c83c8b3a5c2df8a8c'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      const userRoles = ['מנהל']

      // Return value from stubbed method
      const updatedOrchestra = {
        _id: new ObjectId(orchestraId),
        name: 'Orchestra',
        memberIds: ['6579e36c83c8b3a5c2df8a8f', studentId]
      }

      // Stub the entire method
      orchestraService.addMember = vi.fn().mockResolvedValue(updatedOrchestra)

      // Execute
      const result = await orchestraService.addMember(
        orchestraId,
        studentId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )

      // Assert
      expect(orchestraService.addMember).toHaveBeenCalledWith(
        orchestraId,
        studentId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )
      expect(result.memberIds).toContain(studentId)
    })

    it('should throw error when orchestra is not found', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })

      // Execute & Assert
      await expect(orchestraService.addMember(
        orchestraId,
        '6579e36c83c8b3a5c2df8a8c',
        new ObjectId(),
        true,
        ['מנהל'],
        TEST_CONTEXT
      )).rejects.toThrow(`Orchestra with id ${orchestraId} not found`)
    })
  })

  describe('removeMember', () => {
    it('should remove member from orchestra when user is conductor', async () => {
      // Setup - stub the method
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '6579e36c83c8b3a5c2df8a8c'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      const userRoles = ['מנצח']

      // Return value from stubbed method
      const updatedOrchestra = {
        _id: new ObjectId(orchestraId),
        name: 'Orchestra',
        memberIds: ['6579e36c83c8b3a5c2df8a8f'] // Student removed
      }

      // Stub the entire method
      orchestraService.removeMember = vi.fn().mockResolvedValue(updatedOrchestra)

      // Execute
      const result = await orchestraService.removeMember(
        orchestraId,
        studentId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )

      // Assert
      expect(orchestraService.removeMember).toHaveBeenCalledWith(
        orchestraId,
        studentId,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )
      expect(result.memberIds).not.toContain(studentId)
    })
  })

  describe('updateRehearsalAttendance', () => {
    it('should update rehearsal attendance', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      const userRoles = ['מנהל']

      const rehearsal = {
        _id: new ObjectId(rehearsalId),
        groupId: '6579e36c83c8b3a5c2df8a8e',
        date: new Date(),
        attendance: {
          present: ['123'],
          absent: []
        }
      }

      const orchestra = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
        conductorId: '6579e36c83c8b3a5c2df8a8f'
      }

      const attendance = {
        present: ['123', '456'],
        absent: ['789']
      }

      mockRehearsalCollection.findOne.mockResolvedValue(rehearsal)
      // Mock aggregate for getOrchestraById
      mockOrchestraCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([orchestra])
      })
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue({
        ...rehearsal,
        attendance
      })
      mockActivityCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await orchestraService.updateRehearsalAttendance(
        rehearsalId,
        attendance,
        teacherId,
        isAdmin,
        userRoles,
        TEST_CONTEXT
      )

      // Assert
      expect(mockRehearsalCollection.findOne).toHaveBeenCalled()
      expect(mockOrchestraCollection.aggregate).toHaveBeenCalled()
      expect(mockRehearsalCollection.findOneAndUpdate).toHaveBeenCalled()
      expect(result.attendance).toEqual(attendance)
    })

    it('should throw error when rehearsal is not found', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a8b'
      mockRehearsalCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(orchestraService.updateRehearsalAttendance(
        rehearsalId,
        { present: [], absent: [] },
        new ObjectId(),
        true,
        ['מנהל'],
        TEST_CONTEXT
      )).rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })
  })

  describe('getStudentAttendanceStats', () => {
    it('should get attendance statistics for a student', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '6579e36c83c8b3a5c2df8a8c'

      const attendanceRecords = [
        { sessionId: '1', date: new Date('2023-01-01'), status: 'הגיע/ה' },
        { sessionId: '2', date: new Date('2023-01-08'), status: 'הגיע/ה' },
        { sessionId: '3', date: new Date('2023-01-15'), status: 'לא הגיע/ה' },
        { sessionId: '4', date: new Date('2023-01-22'), status: 'הגיע/ה' }
      ]

      mockActivityCollection.toArray.mockResolvedValue(attendanceRecords)

      // Execute
      const result = await orchestraService.getStudentAttendanceStats(orchestraId, studentId, TEST_CONTEXT)

      // Assert
      expect(mockActivityCollection.find).toHaveBeenCalledWith({
        groupId: orchestraId,
        studentId,
        activityType: 'תזמורת',
        tenantId: 'test-tenant-id'
      })

      expect(result).toEqual({
        totalRehearsals: 4,
        attended: 3,
        attendanceRate: 75,
        recentHistory: expect.any(Array)
      })
    })

    it('should return message when no attendance records found', async () => {
      // Setup
      mockActivityCollection.toArray.mockResolvedValue([])

      // Execute
      const result = await orchestraService.getStudentAttendanceStats('orchestra-id', 'student-id', TEST_CONTEXT)

      // Assert
      expect(result).toEqual({
        totalRehearsals: 0,
        attended: 0,
        attendanceRate: 0,
        recentHistory: [],
        message: 'No attendance records found for this student in this orchestra'
      })
    })
  })
})
