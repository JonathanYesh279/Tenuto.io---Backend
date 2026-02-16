import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticateToken, requireAuth } from '../auth.middleware.js'
import jwt from 'jsonwebtoken'
import { getCollection } from '../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('jsonwebtoken')
vi.mock('../../services/mongoDB.service.js')
vi.mock('../../services/logger.service.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}))

describe('Auth Middleware', () => {
  let req, res, next, mockCollection, mockFindOne

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request, response, and next function
    req = {
      headers: {},
      path: '/api/test',
      teacher: null
    }

    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    next = vi.fn()

    // Setup mock collection and findOne
    mockFindOne = vi.fn()
    mockCollection = {
      findOne: mockFindOne
    }
    getCollection.mockResolvedValue(mockCollection)
  })

  describe('authenticateToken', () => {
    it('should return 401 if no token is provided', async () => {
      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 401 if authentication header has incorrect format', async () => {
      // Setup
      req.headers['authorization'] = 'InvalidFormat'

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should authenticate user when valid token is provided', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockTeacher = {
        _id: teacherId,
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Teacher'
        },
        credentials: {
          email: 'test@example.com'
        },
        roles: ['מורה'],
        isActive: true
      }

      req.headers['authorization'] = 'Bearer valid-token'
      jwt.verify.mockReturnValue({ _id: teacherId.toString() })
      mockFindOne.mockResolvedValue(mockTeacher)

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.ACCESS_TOKEN_SECRET)
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        isActive: true
      })
      expect(req.teacher).toBe(mockTeacher)
      expect(req.loggedinUser).toEqual(expect.objectContaining({
        _id: teacherId.toString(),
        tenantId: 'test-tenant-id',
        roles: ['מורה']
      }))
      expect(next).toHaveBeenCalled()
    })

    it('should return 401 if token is invalid', async () => {
      // Setup
      req.headers['authorization'] = 'Bearer invalid-token'
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      })
    })

    it('should return 401 if token is expired', async () => {
      // Setup
      req.headers['authorization'] = 'Bearer expired-token'

      const tokenError = new Error('TokenExpiredError')
      tokenError.name = 'TokenExpiredError'

      jwt.verify.mockImplementation(() => {
        throw tokenError
      })

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      })
    })

    it('should return 401 if teacher is not found', async () => {
      // Setup
      req.headers['authorization'] = 'Bearer valid-token'
      jwt.verify.mockReturnValue({ _id: '6579e36c83c8b3a5c2df8a8b' })
      mockFindOne.mockResolvedValue(null)

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Teacher was not found',
        code: 'USER_NOT_FOUND'
      })
    })

    it('should handle server errors', async () => {
      // Setup
      req.headers['authorization'] = 'Bearer valid-token'
      jwt.verify.mockReturnValue({ _id: '6579e36c83c8b3a5c2df8a8b' })
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute
      await authenticateToken(req, res, next)

      // Assert - middleware now returns 401 for all errors in catch block
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      })
    })

    it('should return 401 for malformed JWT tokens', async () => {
      // Setup
      req.headers['authorization'] = 'Bearer malformed-token'

      const tokenError = new Error('jwt malformed')
      tokenError.name = 'JsonWebTokenError'

      jwt.verify.mockImplementation(() => {
        throw tokenError
      })

      // Execute
      await authenticateToken(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Malformed token',
        code: 'MALFORMED_TOKEN'
      })
    })
  })

  describe('requireAuth', () => {
    it('should allow admin users regardless of required roles', async () => {
      // Setup
      req.teacher = {
        roles: ['מנהל']
      }

      const middleware = requireAuth(['מורה'])

      // Execute
      await middleware(req, res, next)

      // Assert
      expect(req.isAdmin).toBe(true)
      expect(next).toHaveBeenCalled()
    })

    it('should proceed if user has one of the required roles', async () => {
      // Setup - Teacher with multiple roles
      req.teacher = {
        roles: ['מורה', 'מנצח']
      }

      const middleware = requireAuth(['מורה', 'מדריך הרכב'])

      // Execute
      await middleware(req, res, next)

      // Assert
      expect(req.isAdmin).toBeUndefined()
      expect(next).toHaveBeenCalled()
    })

    it('should return 403 if user does not have any required role', async () => {
      // Setup
      req.teacher = {
        roles: ['מורה']
      }

      const middleware = requireAuth(['מנצח', 'מדריך הרכב'])

      // Execute
      await middleware(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: ['מנצח', 'מדריך הרכב'],
        current: ['מורה']
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 401 if no teacher is found in request', async () => {
      // Setup
      req.teacher = null

      const middleware = requireAuth(['מורה'])

      // Execute
      await middleware(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 500 on unexpected errors', async () => {
      // Setup
      req.teacher = {
        roles: ['מורה']
      }

      const error = new Error('Unexpected error')

      const middleware = requireAuth(['מורה'])

      // Mock some unexpected error during execution
      vi.spyOn(req.teacher.roles, 'includes').mockImplementation(() => {
        throw error
      })

      // Execute
      await middleware(req, res, next)

      // Assert - production code now catches and returns 500 instead of calling next(error)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization failed',
        code: 'AUTH_FAILED'
      })
    })
  })
})