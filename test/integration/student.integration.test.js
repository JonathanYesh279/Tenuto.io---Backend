// test/integration/student.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { ObjectId } from 'mongodb'

// Setup mocks before importing the routes
vi.mock('../../services/mongoDB.service.js', () => {
  // Create mock collection data
  const mockStudents = [
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      tenantId: 'test-tenant-id',
      personalInfo: {
        firstName: 'Test',
        lastName: 'Student',
        fullName: 'Test Student',
        phone: '0501234567',
        address: 'Test Address',
        parentName: 'Parent Name',
        parentPhone: '0501234568',
        parentEmail: 'parent@example.com',
        studentEmail: 'student@example.com'
      },
      academicInfo: {
        instrumentProgress: [
          { instrumentName: 'חצוצרה', currentStage: 3, isPrimary: true }
        ],
        class: 'ט',
        tests: {
          stageTest: {
            status: 'עבר/ה',
            lastTestDate: new Date('2023-05-15'),
            notes: 'Good performance'
          },
          technicalTest: {
            status: 'עבר/ה',
            lastTestDate: new Date('2023-06-10'),
            notes: 'Good technique'
          }
        }
      },
      enrollments: {
        orchestraIds: ['orchestra1'],
        ensembleIds: [],
        schoolYears: [
          {
            schoolYearId: 'year1',
            isActive: true
          }
        ]
      },
      isActive: true,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    },
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
      tenantId: 'test-tenant-id',
      personalInfo: {
        firstName: 'Another',
        lastName: 'Student',
        fullName: 'Another Student',
        phone: '0501234569',
        address: 'Another Address'
      },
      academicInfo: {
        instrumentProgress: [
          { instrumentName: 'קלרינט', currentStage: 2, isPrimary: true }
        ],
        class: 'ז'
      },
      enrollments: {
        orchestraIds: [],
        ensembleIds: ['ensemble1'],
        schoolYears: [
          {
            schoolYearId: 'year1',
            isActive: true
          }
        ]
      },
      isActive: true,
      createdAt: new Date('2023-02-01'),
      updatedAt: new Date('2023-02-01')
    }
  ]

  const mockTeachers = [
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
      personalInfo: {
        fullName: 'Test Teacher',
        email: 'teacher@example.com'
      },
      roles: ['מורה'],
      teaching: {
        studentIds: ['6579e36c83c8b3a5c2df8a8b'] // First student's ID
      },
      isActive: true
    }
  ]

  // Mock session for transaction support
  const mockSession = {
    startTransaction: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(),
    abortTransaction: vi.fn().mockResolvedValue(),
    endSession: vi.fn()
  }

  // Mock MongoDB collection functions
  const mockStudentCollection = {
    client: { startSession: vi.fn(() => mockSession) },
    find: vi.fn((query = {}) => {
      let filtered = [...mockStudents]

      // Apply basic filters
      if (query.isActive !== undefined) {
        filtered = filtered.filter(student => student.isActive === query.isActive)
      }

      // Handle $or queries (name search with firstName/lastName)
      if (query.$or) {
        filtered = filtered.filter(student => {
          return query.$or.some(condition => {
            for (const [key, val] of Object.entries(condition)) {
              const fieldValue = key.split('.').reduce((obj, k) => obj?.[k], student)
              if (val?.$regex) {
                const regex = new RegExp(val.$regex, val.$options || '')
                if (regex.test(fieldValue)) return true
              }
            }
            return false
          })
        })
      }

      // Legacy fullName filter
      if (query['personalInfo.fullName'] && query['personalInfo.fullName'].$regex) {
        const regex = new RegExp(query['personalInfo.fullName'].$regex, query['personalInfo.fullName'].$options || '')
        filtered = filtered.filter(student => regex.test(student.personalInfo.fullName))
      }

      if (query['academicInfo.instrumentProgress.instrumentName']) {
        filtered = filtered.filter(student =>
          student.academicInfo.instrumentProgress?.some(ip => ip.instrumentName === query['academicInfo.instrumentProgress.instrumentName']))
      }

      if (query['academicInfo.class']) {
        filtered = filtered.filter(student => student.academicInfo.class === query['academicInfo.class'])
      }

      return {
        toArray: vi.fn(() => Promise.resolve(filtered))
      }
    }),
    findOne: vi.fn((query = {}) => {
      if (query._id) {
        const found = mockStudents.find(s => 
          s._id.toString() === query._id.toString())
        return Promise.resolve(found || null)
      }
      return Promise.resolve(null)
    }),
    insertOne: vi.fn((doc) => {
      const newId = new ObjectId()
      const newStudent = { 
        ...doc, 
        _id: newId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockStudents.push(newStudent)
      return Promise.resolve({ insertedId: newId })
    }),
    findOneAndUpdate: vi.fn((query, update, options) => {
      const index = mockStudents.findIndex(s => 
        s._id.toString() === query._id.toString())
      
      if (index === -1) return Promise.resolve(null)
      
      if (update.$set) {
        mockStudents[index] = { 
          ...mockStudents[index], 
          ...update.$set,
          updatedAt: new Date()
        }
      }
      
      return Promise.resolve(mockStudents[index])
    })
  }

  const mockTeacherCollection = {
    findOne: vi.fn((query = {}) => {
      if (query._id) {
        const found = mockTeachers.find(t => 
          t._id.toString() === query._id.toString())
        return Promise.resolve(found || null)
      }
      
      if (query['teaching.studentIds']) {
        const found = mockTeachers.find(t => 
          t.teaching && t.teaching.studentIds && 
          t.teaching.studentIds.includes(query['teaching.studentIds']))
        return Promise.resolve(found || null)
      }
      
      return Promise.resolve(null)
    }),
    updateOne: vi.fn((query, update) => {
      const index = mockTeachers.findIndex(t => 
        t._id.toString() === query._id.toString())
      
      if (index === -1) return Promise.resolve({ modifiedCount: 0 })
      
      if (update.$addToSet && update.$addToSet['teaching.studentIds']) {
        if (!mockTeachers[index].teaching) {
          mockTeachers[index].teaching = { studentIds: [] }
        }
        
        if (!mockTeachers[index].teaching.studentIds.includes(update.$addToSet['teaching.studentIds'])) {
          mockTeachers[index].teaching.studentIds.push(update.$addToSet['teaching.studentIds'])
        }
      }
      
      if (update.$pull && update.$pull['teaching.studentIds']) {
        if (mockTeachers[index].teaching && mockTeachers[index].teaching.studentIds) {
          mockTeachers[index].teaching.studentIds = mockTeachers[index].teaching.studentIds
            .filter(id => id !== update.$pull['teaching.studentIds'])
        }
      }
      
      return Promise.resolve({ modifiedCount: 1 })
    })
  }

  // Return mock implementations for both collections
  return {
    getCollection: vi.fn((name) => {
      if (name === 'teacher') {
        return Promise.resolve(mockTeacherCollection)
      }
      return Promise.resolve(mockStudentCollection)
    }),
    initializeMongoDB: vi.fn()
  }
})

// Mock school year service
vi.mock('../../api/school-year/school-year.service.js', async () => ({
  schoolYearService: {
    getCurrentSchoolYear: vi.fn().mockResolvedValue({
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
      name: '2023-2024',
      isCurrent: true
    })
  }
}))

// Mock relationship validation service (used by student.service.js)
vi.mock('../../services/relationshipValidationService.js', () => ({
  relationshipValidationService: {
    validateStudentTeacherRelationship: vi.fn().mockResolvedValue({ valid: true }),
    validateTeacherExists: vi.fn().mockResolvedValue(true)
  }
}))

// Mock student-assignments validation
vi.mock('../../api/student/student-assignments.validation.js', () => ({
  validateTeacherAssignmentsMiddleware: vi.fn((req, res, next) => next()),
  validateTeacherAssignmentsWithDB: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
}))

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', async () => {
  const mockTeacher = {
    _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
    tenantId: 'test-tenant-id',
    personalInfo: {
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'teacher@example.com',
      phone: '0501234567'
    },
    roles: ['מנהל'],
    isActive: true
  }

  const setAuth = (req) => {
    req.teacher = mockTeacher
    req.isAdmin = true
    req.context = { tenantId: 'test-tenant-id', isAdmin: true }
  }

  return {
    authenticateToken: vi.fn((req, res, next) => {
      setAuth(req)
      next()
    }),
    requireAuth: vi.fn(() => (req, res, next) => {
      setAuth(req)
      next()
    })
  }
})

// Mock tenant middleware
vi.mock('../../middleware/tenant.middleware.js', () => ({
  requireTenantId: vi.fn((tenantId) => {
    if (!tenantId) throw new Error('TENANT_GUARD: tenantId is required')
    return tenantId
  })
}))

// Mock queryScoping to pass through
vi.mock('../../utils/queryScoping.js', () => ({
  buildScopedFilter: vi.fn((collection, criteria, context) => ({
    ...criteria,
    tenantId: context?.tenantId
  })),
  canAccessStudent: vi.fn(() => true),
  canAccessOwnResource: vi.fn(() => true)
}))

// Import routes after mocking
import studentRoutes from '../../api/student/student.route.js'

describe('Student API Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/student', studentRoutes)
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/student', () => {
    it('should return all active students', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('personalInfo')
      expect(response.body[0]).toHaveProperty('academicInfo')
    })

    it('should filter students by name', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student?name=Another')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].personalInfo.firstName).toBe('Another')
    })

    it('should filter students by instrument', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student?instrument=חצוצרה')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].academicInfo.instrumentProgress[0].instrumentName).toBe('חצוצרה')
    })

    it('should filter students by class', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student?class=ט')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].academicInfo.class).toBe('ט')
    })
  })

  describe('GET /api/student/:id', () => {
    it('should return a specific student by ID', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .get(`/api/student/${studentId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo.firstName).toBe('Test')
    })

    it('should handle student not found', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student/123456789012345678901234')
        .set('Authorization', 'Bearer valid-token')

      // Assert - The exact behavior depends on your controller
      expect(response.status).not.toBe(200)
    })
  })

  describe('POST /api/student', () => {
    it('should create a new student', async () => {
      // Setup - use firstName/lastName (Phase 4B), instrumentProgress, and tenantId
      const newStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'New',
          lastName: 'Student',
          phone: '0501234567',
          address: 'New Address'
        },
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1, isPrimary: true }
          ],
          class: 'א'
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/student')
        .set('Authorization', 'Bearer valid-token')
        .send(newStudent)

      // Assert - expecting 201
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo.firstName).toBe('New')
      expect(response.body.personalInfo.lastName).toBe('Student')
    })

    it('should reject invalid student data', async () => {
      // Setup
      const invalidStudent = {
        // Missing required fields
        personalInfo: {
          // Missing fullName
        },
        academicInfo: {
          // Missing required fields
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/student')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidStudent)

      // Assert
      expect(response.status).not.toBe(200)
      expect(response.status).not.toBe(201)
    })
  })

  describe('PUT /api/student/:id', () => {
    it('should update an existing student', async () => {
      // Setup - use firstName/lastName (Phase 4B)
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const updateData = {
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Student Name'
        },
        academicInfo: {
          class: 'ט'
        }
      }

      // Execute
      const response = await request(app)
        .put(`/api/student/${studentId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
    })
  })

  describe('DELETE /api/student/:id', () => {
    it('should deactivate a student (soft delete)', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .delete(`/api/student/${studentId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.isActive).toBe(false)
    })
  })

  describe('Teacher-Student Relationships', () => {
    it('should handle teacher access correctly', async () => {
      // Verifying that the authenticated teacher can access their own student
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const updateData = {
        personalInfo: {
          firstName: 'Teacher',
          lastName: 'Updated Student'
        },
        academicInfo: {
          class: 'י'
        }
      }

      // Execute - using the currently authenticated teacher
      const response = await request(app)
        .put(`/api/student/${studentId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
    })
  })
})