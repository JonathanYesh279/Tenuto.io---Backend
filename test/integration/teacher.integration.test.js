// test/integration/teacher.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { ObjectId } from 'mongodb'

// Setup mocks before importing the routes
vi.mock('../../services/mongoDB.service.js', () => {
  // Create mock collection data
  const mockTeachers = [
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      personalInfo: {
        fullName: 'Test Teacher',
        phone: '0501234567',
        email: 'teacher@example.com',
        address: 'Test Address'
      },
      roles: ['מורה'],
      professionalInfo: {
        instrument: 'Piano',
        isActive: true
      },
      teaching: {
        studentIds: [],
        schedule: []
      },
      credentials: {
        email: 'teacher@example.com',
        password: 'hashedPassword'
      },
      isActive: true
    },
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
      personalInfo: {
        fullName: 'Conductor Teacher',
        phone: '0501234568',
        email: 'conductor@example.com',
        address: 'Conductor Address'
      },
      roles: ['מנצח'],
      professionalInfo: {
        instrument: 'Violin',
        isActive: true
      },
      teaching: {
        studentIds: [],
        schedule: []
      },
      credentials: {
        email: 'conductor@example.com',
        password: 'hashedPassword'
      },
      isActive: true
    }
  ]

  // Mock MongoDB collection functions
  const mockCollection = {
    find: vi.fn((query = {}) => {
      const filtered = mockTeachers.filter(teacher => {
        // Handle basic filtering
        if (query.isActive !== undefined && teacher.isActive !== query.isActive) {
          return false
        }
        if (query['personalInfo.fullName'] && !teacher.personalInfo.fullName.includes(query['personalInfo.fullName'].$regex)) {
          return false
        }
        if (query.roles && !teacher.roles.includes(query.roles)) {
          return false
        }
        return true
      })
      return {
        toArray: vi.fn(() => Promise.resolve(filtered))
      }
    }),
    findOne: vi.fn((query = {}) => {
      if (query._id) {
        const found = mockTeachers.find(t => 
          t._id.toString() === query._id.toString())
        return Promise.resolve(found || null)
      }
      return Promise.resolve(null)
    }),
    insertOne: vi.fn((doc) => {
      const newId = new ObjectId()
      const newTeacher = { ...doc, _id: newId }
      mockTeachers.push(newTeacher)
      return Promise.resolve({ insertedId: newId })
    }),
    findOneAndUpdate: vi.fn((query, update, options) => {
      const index = mockTeachers.findIndex(t => 
        t._id.toString() === query._id.toString())
      
      if (index === -1) return Promise.resolve(null)
      
      if (update.$set) {
        mockTeachers[index] = { 
          ...mockTeachers[index], 
          ...update.$set 
        }
      }
      
      return Promise.resolve(mockTeachers[index])
    })
  }

  return {
    getCollection: vi.fn(() => Promise.resolve(mockCollection)),
    initializeMongoDB: vi.fn()
  }
})

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => {
  const mockTeacher = {
    _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
    tenantId: 'test-tenant-id',
    personalInfo: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phone: '0501234567',
      address: 'Test Address'
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
  }))
}))

// Mock DuplicateDetectionService to not block creation
vi.mock('../../services/duplicateDetectionService.js', () => ({
  DuplicateDetectionService: {
    detectTeacherDuplicates: vi.fn().mockResolvedValue({
      hasDuplicates: false,
      duplicates: [],
      duplicateCount: 0
    }),
    shouldBlockCreation: vi.fn().mockReturnValue(false)
  }
}))

// Mock emailService and invitationConfig
vi.mock('../../services/emailService.js', () => ({
  emailService: {
    sendInvitation: vi.fn().mockResolvedValue(true)
  }
}))
vi.mock('../../services/invitationConfig.js', () => ({
  invitationConfig: {
    baseUrl: 'http://localhost:3000',
    tokenExpiry: '7d',
    isEmailMode: vi.fn().mockReturnValue(false),
    isDefaultPasswordMode: vi.fn().mockReturnValue(true),
    getDefaultPassword: vi.fn().mockReturnValue('123456'),
    getCurrentMode: vi.fn().mockReturnValue('DEFAULT_PASSWORD'),
    validateMode: vi.fn().mockReturnValue(true)
  },
  INVITATION_MODES: { EMAIL: 'EMAIL', DEFAULT_PASSWORD: 'DEFAULT_PASSWORD' },
  DEFAULT_PASSWORD: '123456'
}))

// Import routes after mocking
import teacherRoutes from '../../api/teacher/teacher.route.js'

// Import other dependencies that might use the mocked modules
import { authService } from '../../api/auth/auth.service.js'
vi.mock('../../api/auth/auth.service.js', () => ({
  authService: {
    encryptPassword: vi.fn(password => Promise.resolve(`hashed_${password}`))
  }
}))

describe('Teacher API Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/teacher', teacherRoutes)
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/teacher', () => {
    it('should return all active teachers', async () => {
      // Execute
      const response = await request(app)
        .get('/api/teacher')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should filter teachers by name', async () => {
      // Execute
      const response = await request(app)
        .get('/api/teacher?name=Conductor')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })
  })

  describe('GET /api/teacher/:id', () => {
    it('should return a specific teacher by ID', async () => {
      // Set up
      const teacherId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .get(`/api/teacher/${teacherId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/teacher', () => {
    it('should create a new teacher', async () => {
      // Set up - use firstName/lastName (Phase 4B) and include tenantId
      const newTeacher = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'New',
          lastName: 'Teacher',
          phone: '0501234569',
          email: 'new@example.com',
          address: 'New Address'
        },
        roles: ['מורה', 'מדריך הרכב'],
        professionalInfo: {
          instrument: 'גיטרה',
          isActive: true
        },
        teaching: {
          timeBlocks: []
        },
        credentials: {
          email: 'new@example.com',
          password: 'password123'
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/teacher')
        .set('Authorization', 'Bearer valid-token')
        .send(newTeacher)

      // Assert - controller returns 201 for successful creation
      expect(response.status).toBe(201)
    })
  })

  describe('PUT /api/teacher/:id', () => {
    it('should update an existing teacher', async () => {
      // Set up - use firstName/lastName (Phase 4B)
      const teacherId = '6579e36c83c8b3a5c2df8a8b'
      const updatedInfo = {
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Updated Address'
        },
        roles: ['מורה', 'מנצח']
      }

      // Execute
      const response = await request(app)
        .put(`/api/teacher/${teacherId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updatedInfo)

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/teacher/:id', () => {
    it('should deactivate a teacher (soft delete)', async () => {
      // Set up
      const teacherId = '6579e36c83c8b3a5c2df8a8c'

      // Execute
      const response = await request(app)
        .delete(`/api/teacher/${teacherId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })
  })
})