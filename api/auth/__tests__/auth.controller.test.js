import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authController } from '../auth.controller.js'
import { authService } from '../auth.service.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../auth.service.js', () => ({
  authService: {
    login: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    encryptPassword: vi.fn(),
    validateToken: vi.fn()
  }
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../../services/logger.service.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}))

vi.mock('../../services/invitationMigration.js', () => ({
  invitationMigration: {
    migratePendingInvitations: vi.fn(),
    getInvitationModeStats: vi.fn()
  }
}))

describe('Auth Controller', () => {
  let req, res, next, mockCollection

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup request object
    req = {
      body: {},
      cookies: {},
      teacher: {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b')
      }
    }

    // Setup response object with chainable methods
    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res),
      cookie: vi.fn(() => res),
      clearCookie: vi.fn(() => res)
    }

    // Setup next function
    next = vi.fn()

    // Setup MongoDB collection mock
    mockCollection = {
      findOne: vi.fn(),
      insertOne: vi.fn()
    }
    getCollection.mockResolvedValue(mockCollection)
  })

  describe('login', () => {
    it('should return 400 if email is missing', async () => {
      // Setup
      req.body = { password: 'password123' }

      // Execute
      await authController.login(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email and password are required'
      })
      expect(authService.login).not.toHaveBeenCalled()
    })

    it('should return 400 if password is missing', async () => {
      // Setup
      req.body = { email: 'test@example.com' }

      // Execute
      await authController.login(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email and password are required'
      })
      expect(authService.login).not.toHaveBeenCalled()
    })

    it('should login and return tokens when credentials are valid', async () => {
      // Setup
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      }

      const mockTeacher = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        personalInfo: {
          firstName: 'Test',
          lastName: 'Teacher',
          email: 'test@example.com'
        },
        credentials: { email: 'test@example.com' },
        roles: ['מורה']
      }

      authService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        teacher: mockTeacher
      })

      // Execute
      await authController.login(req, res)

      // Assert - controller now passes 3 args (email, password, tenantId)
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123', null)
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: expect.any(Boolean),
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        })
      )
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'mock-access-token',
        teacher: mockTeacher
      })
    })

    it('should return 401 when credentials are invalid', async () => {
      // Setup
      req.body = {
        email: 'test@example.com',
        password: 'wrong-password'
      }

      authService.login.mockRejectedValue(new Error('Invalid Credentials'))

      // Execute
      await authController.login(req, res)

      // Assert - controller now passes 3 args
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'wrong-password', null)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
    })

    it('should return 500 for unexpected server errors', async () => {
      // Setup
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      }

      authService.login.mockRejectedValue(new Error('Database connection error'))

      // Execute
      await authController.login(req, res)

      // Assert - controller now passes 3 args
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123', null)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR'
      })
    })

    it('should handle tenant selection required response', async () => {
      // Setup
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      }

      authService.login.mockResolvedValue({
        requiresTenantSelection: true,
        tenants: [
          { tenantId: 'tenant-1', tenantName: 'School A', roles: ['מורה'] },
          { tenantId: 'tenant-2', tenantName: 'School B', roles: ['מנהל'] }
        ]
      })

      // Execute
      await authController.login(req, res)

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requiresTenantSelection: true,
        tenants: expect.any(Array),
        code: 'TENANT_SELECTION_REQUIRED'
      })
    })
  })

  describe('refresh', () => {
    it('should return 401 if refresh token is missing', async () => {
      // Execute
      await authController.refresh(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      })
      expect(authService.refreshAccessToken).not.toHaveBeenCalled()
    })

    it('should return a new access token when refresh token is valid', async () => {
      // Setup
      req.cookies.refreshToken = 'valid-refresh-token'
      authService.refreshAccessToken.mockResolvedValue({ accessToken: 'new-access-token' })

      // Execute
      await authController.refresh(req, res)

      // Assert
      expect(authService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { accessToken: 'new-access-token' },
        message: 'Token refreshed successfully'
      })
    })

    it('should return 401 when refresh token is invalid', async () => {
      // Setup
      req.cookies.refreshToken = 'invalid-refresh-token'
      authService.refreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'))

      // Execute
      await authController.refresh(req, res)

      // Assert
      expect(authService.refreshAccessToken).toHaveBeenCalledWith('invalid-refresh-token')
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      })
    })
  })

  describe('logout', () => {
    it('should throw error if no teacher in request', async () => {
      // Setup
      req.teacher = null

      // Execute
      await authController.logout(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      })
      expect(authService.logout).not.toHaveBeenCalled()
    })

    it('should throw error if teacher ID is missing', async () => {
      // Setup
      req.teacher = { }  // No _id field

      // Execute
      await authController.logout(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      })
      expect(authService.logout).not.toHaveBeenCalled()
    })

    it('should successfully logout teacher and clear cookie', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.teacher = { _id: teacherId }
      authService.logout.mockResolvedValue(undefined)

      // Execute
      await authController.logout(req, res)

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(teacherId)
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      })
    })

    it('should handle logout service errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.teacher = { _id: teacherId }
      authService.logout.mockRejectedValue(new Error('Database error'))

      // Execute
      await authController.logout(req, res)

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(teacherId)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      })
    })
  })

  describe('initAdmin', () => {
    it('should return 400 if admin already exists', async () => {
      // Setup
      mockCollection.findOne.mockResolvedValue({ _id: 'existing-admin-id' })

      // Execute
      await authController.initAdmin(req, res)

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({ roles: { $in: ['מנהל'] } })
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin already exists' })
      expect(mockCollection.insertOne).not.toHaveBeenCalled()
    })

    it('should create a new admin if none exists', async () => {
      // Setup - first findOne for admin check, second for email check
      mockCollection.findOne
        .mockResolvedValueOnce(null)  // no admin exists
        .mockResolvedValueOnce(null)  // no email conflict
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockCollection.insertOne.mockResolvedValue({ insertedId })
      authService.encryptPassword.mockResolvedValue('hashed-password')

      // Execute
      await authController.initAdmin(req, res)

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({ roles: { $in: ['מנהל'] } })
      expect(authService.encryptPassword).toHaveBeenCalledWith('123456')
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        personalInfo: expect.objectContaining({
          firstName: 'מנהל',
          lastName: 'מערכת',
          email: 'admin@example.com'
        }),
        roles: ['מנהל'],
        credentials: expect.objectContaining({
          email: 'admin@example.com',
          password: 'hashed-password'
        }),
        isActive: true
      }))
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ message: 'Admin created successfully' })
    })

    it('should handle errors during admin creation', async () => {
      // Setup - first findOne for admin check, second for email check
      mockCollection.findOne
        .mockResolvedValueOnce(null)  // no admin exists
        .mockResolvedValueOnce(null)  // no email conflict
      mockCollection.insertOne.mockRejectedValue(new Error('Database error'))
      authService.encryptPassword.mockResolvedValue('hashed-password')

      // Execute
      await authController.initAdmin(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create admin' })
    })
  })
})