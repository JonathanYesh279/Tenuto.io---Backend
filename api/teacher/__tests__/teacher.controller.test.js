import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teacherController } from '../teacher.controller.js'
import { teacherService } from '../teacher.service.js'
import { ObjectId } from 'mongodb'

// Mock the teacher service
vi.mock('../teacher.service.js', () => ({
  teacherService: {
    getTeachers: vi.fn(),
    getTeacherById: vi.fn(),
    getTeacherByRole: vi.fn(),
    addTeacher: vi.fn(),
    updateTeacher: vi.fn(),
    removeTeacher: vi.fn()
  }
}))

// Mock the teacher-lessons service (imported by controller)
vi.mock('../teacher-lessons.service.js', () => ({
  teacherLessonsService: {
    getTeacherLessons: vi.fn(),
    getTeacherWeeklySchedule: vi.fn(),
    getTeacherDaySchedule: vi.fn(),
    getTeacherLessonStats: vi.fn(),
    getTeacherStudentsWithLessons: vi.fn(),
    validateTeacherLessonData: vi.fn()
  }
}))

describe('Teacher Controller', () => {
  let req, res, next

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request object with context for tenant scoping
    req = {
      params: {},
      query: {},
      body: {},
      context: { tenantId: 'test-tenant-id' },
      teacher: {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        roles: ['מנהל']
      },
      isAdmin: true
    }

    // Setup response object with chainable methods
    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    // Setup next function
    next = vi.fn()
  })

  describe('getTeachers', () => {
    it('should get all teachers with correct filters', async () => {
      // Setup
      req.query = {
        name: 'Test Teacher',
        role: 'מורה',
        studentId: '123',
        orchestraId: '456',
        ensembleId: '789',
        isActive: 'true',
        showInActive: 'true'
      }

      const mockTeachers = [
        { _id: '1', personalInfo: { firstName: 'Teacher', lastName: 'One' } },
        { _id: '2', personalInfo: { firstName: 'Teacher', lastName: 'Two' } }
      ]
      teacherService.getTeachers.mockResolvedValue(mockTeachers)

      // Execute
      await teacherController.getTeachers(req, res, next)

      // Assert - controller now passes filterBy, page, limit, { context: req.context }
      expect(teacherService.getTeachers).toHaveBeenCalledWith(
        {
          name: 'Test Teacher',
          instrument: undefined,
          role: 'מורה',
          studentId: '123',
          orchestraId: '456',
          ensembleId: '789',
          isActive: 'true',
          showInActive: true
        },
        1, // default page
        0, // default limit
        { context: { tenantId: 'test-tenant-id' } }
      )
      expect(res.json).toHaveBeenCalledWith(mockTeachers)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get teachers')
      teacherService.getTeachers.mockRejectedValue(error)

      // Execute
      await teacherController.getTeachers(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getTeacherById', () => {
    it('should get a teacher by ID', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: teacherId.toString() }

      const mockTeacher = {
        _id: teacherId,
        personalInfo: { firstName: 'Test', lastName: 'Teacher' },
        roles: ['מורה']
      }
      teacherService.getTeacherById.mockResolvedValue(mockTeacher)

      // Execute
      await teacherController.getTeacherById(req, res, next)

      // Assert - controller now passes { context: req.context } as second arg
      expect(teacherService.getTeacherById).toHaveBeenCalledWith(
        teacherId.toString(),
        { context: { tenantId: 'test-tenant-id' } }
      )
      // Controller now returns { success: true, data: teacher }
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTeacher
      })
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Teacher not found')
      teacherService.getTeacherById.mockRejectedValue(error)

      // Execute
      await teacherController.getTeacherById(req, res, next)

      // Assert - "not found" errors return 404 directly
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Teacher not found'
      }))
    })
  })

  describe('getTeacherByRole', () => {
    it('should get teachers by role', async () => {
      // Setup
      req.params = { role: 'מורה' }

      const mockTeachers = [
        { _id: '1', personalInfo: { firstName: 'Teacher', lastName: 'One' }, roles: ['מורה'] },
        { _id: '2', personalInfo: { firstName: 'Teacher', lastName: 'Two' }, roles: ['מורה'] }
      ]
      teacherService.getTeacherByRole.mockResolvedValue(mockTeachers)

      // Execute
      await teacherController.getTeacherByRole(req, res, next)

      // Assert - controller now passes { context: req.context }
      expect(teacherService.getTeacherByRole).toHaveBeenCalledWith(
        'מורה',
        { context: { tenantId: 'test-tenant-id' } }
      )
      expect(res.json).toHaveBeenCalledWith(mockTeachers)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { role: 'invalid-role' }
      const error = new Error('Failed to get teachers by role')
      teacherService.getTeacherByRole.mockRejectedValue(error)

      // Execute
      await teacherController.getTeacherByRole(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addTeacher', () => {
    it('should add a new teacher', async () => {
      // Setup
      const newTeacher = {
        personalInfo: { firstName: 'New', lastName: 'Teacher' },
        roles: ['מורה']
      }
      req.body = newTeacher

      const createdTeacher = {
        _id: new ObjectId(),
        ...newTeacher
      }
      teacherService.addTeacher.mockResolvedValue(createdTeacher)

      // Execute
      await teacherController.addTeacher(req, res, next)

      // Assert - controller now passes teacherToAdd, adminId, { context: req.context }
      expect(teacherService.addTeacher).toHaveBeenCalledWith(
        newTeacher,
        req.teacher._id,
        { context: { tenantId: 'test-tenant-id' } }
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: createdTeacher })
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid teacher data')
      teacherService.addTeacher.mockRejectedValue(error)

      // Execute
      await teacherController.addTeacher(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateTeacher', () => {
    it('should update an existing teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: teacherId.toString() }

      const teacherUpdates = {
        personalInfo: { firstName: 'Updated', lastName: 'Teacher' },
        roles: ['מורה', 'מנצח']
      }
      req.body = teacherUpdates

      const updatedTeacher = {
        _id: teacherId,
        ...teacherUpdates
      }
      teacherService.updateTeacher.mockResolvedValue(updatedTeacher)

      // Execute
      await teacherController.updateTeacher(req, res, next)

      // Assert - controller now passes { context: req.context }
      expect(teacherService.updateTeacher).toHaveBeenCalledWith(
        teacherId.toString(),
        teacherUpdates,
        { context: { tenantId: 'test-tenant-id' } }
      )
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedTeacher })
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      const error = new Error('Failed to update teacher')
      teacherService.updateTeacher.mockRejectedValue(error)

      // Execute
      await teacherController.updateTeacher(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeTeacher', () => {
    it('should remove (deactivate) a teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: teacherId.toString() }

      const removedTeacher = {
        _id: teacherId,
        personalInfo: { firstName: 'Removed', lastName: 'Teacher' },
        isActive: false
      }
      teacherService.removeTeacher.mockResolvedValue(removedTeacher)

      // Execute
      await teacherController.removeTeacher(req, res, next)

      // Assert - controller now passes { context: req.context }
      expect(teacherService.removeTeacher).toHaveBeenCalledWith(
        teacherId.toString(),
        { context: { tenantId: 'test-tenant-id' } }
      )
      expect(res.json).toHaveBeenCalledWith(removedTeacher)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Failed to remove teacher')
      teacherService.removeTeacher.mockRejectedValue(error)

      // Execute
      await teacherController.removeTeacher(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})
