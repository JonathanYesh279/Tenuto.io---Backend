// api/teacher/__tests__/teacher.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateTeacher, teacherSchema, TEACHER_CONSTANTS } from '../teacher.validation.js'

// Helper: create a valid teacher with tenantId and firstName/lastName
function makeValidTeacher(overrides = {}) {
  return {
    tenantId: 'test-tenant-id',
    personalInfo: {
      firstName: 'Test',
      lastName: 'Teacher',
      phone: '0501234567',
      email: 'teacher@example.com',
      address: 'Test Address',
      ...(overrides.personalInfo || {})
    },
    roles: overrides.roles || ['מורה'],
    professionalInfo: {
      instruments: [],
      isActive: true,
      ...(overrides.professionalInfo || {})
    },
    teaching: {
      timeBlocks: [],
      ...(overrides.teaching || {})
    },
    credentials: {
      email: overrides.personalInfo?.email || 'teacher@example.com',
      password: 'password123',
      ...(overrides.credentials || {})
    },
    ...overrides
  }
}

describe('Teacher Validation', () => {
  describe('validateTeacher', () => {
    it('should validate a valid teacher object', () => {
      // Setup
      const validTeacher = makeValidTeacher()

      // Execute
      const { error, value } = validateTeacher(validTeacher)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validTeacher)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalTeacher = makeValidTeacher()

      // Execute
      const { error, value } = validateTeacher(minimalTeacher)

      // Assert
      expect(error).toBeUndefined()

      expect(value).toMatchObject({
        ...minimalTeacher,
        conducting: {},
        ensemblesIds: [],
        schoolYears: [],
        isActive: true
      })
    })

    it('should require personalInfo', () => {
      // Setup - remove personalInfo
      const invalidTeacher = makeValidTeacher()
      delete invalidTeacher.personalInfo

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo" is required')
    })

    it('should require roles array', () => {
      // Setup - remove roles
      const invalidTeacher = makeValidTeacher()
      delete invalidTeacher.roles

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"roles" is required')
    })

    it('should validate valid roles', () => {
      // Setup
      const invalidTeacher = makeValidTeacher({ roles: ['invalid-role'] })

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"roles[0]" must be one of')
    })

    it('should require professionalInfo', () => {
      // Setup - remove professionalInfo
      const invalidTeacher = makeValidTeacher()
      delete invalidTeacher.professionalInfo

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"professionalInfo" is required')
    })

    it('should require teaching object', () => {
      // Setup - remove teaching
      const invalidTeacher = makeValidTeacher()
      delete invalidTeacher.teaching

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"teaching" is required')
    })

    it('should require credentials', () => {
      // Setup - remove credentials
      const invalidTeacher = makeValidTeacher()
      delete invalidTeacher.credentials

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"credentials" is required')
    })

    it('should validate phone number format', () => {
      // Setup
      const invalidTeacher = makeValidTeacher({
        personalInfo: {
          firstName: 'Test',
          lastName: 'Teacher',
          phone: '123456789', // Invalid format (should start with 05)
          email: 'teacher@example.com',
          address: 'Test Address'
        }
      })

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.phone" with value')
    })

    it('should validate email format', () => {
      // Setup
      const invalidTeacher = makeValidTeacher({
        personalInfo: {
          firstName: 'Test',
          lastName: 'Teacher',
          phone: '0501234567',
          email: 'not-an-email', // Invalid email format
          address: 'Test Address'
        },
        credentials: {
          email: 'not-an-email', // Invalid email format
          password: 'password123'
        }
      })

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.email" must be a valid email')
    })

    it('should require emails in credentials and personalInfo to match', () => {
      // Setup
      const invalidTeacher = makeValidTeacher({
        personalInfo: {
          firstName: 'Test',
          lastName: 'Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        credentials: {
          email: 'different@example.com', // Different from personalInfo.email
          password: 'password123'
        }
      })

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"value" contains an invalid value')
    })
  })

  describe('TEACHER_CONSTANTS', () => {
    it('should define valid teacher roles', () => {
      // Assert - roles now include 'מורה תאוריה' and 'מגמה'
      expect(TEACHER_CONSTANTS.VALID_RULES).toEqual(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה', 'מגמה'])
    })
  })

  describe('teacherSchema', () => {
    it('should be a valid Joi schema object', () => {
      // Assert
      expect(teacherSchema).toBeDefined()
      expect(teacherSchema.validate).toBeTypeOf('function')
    })

    it('should set default values correctly', () => {
      // Setup - Create a minimal valid teacher
      const minimalTeacher = makeValidTeacher()

      // Execute
      const { value } = teacherSchema.validate(minimalTeacher)

      // Assert - Check default values
      expect(value.teaching.timeBlocks).toEqual([])
      expect(value.conducting).toEqual({})
      expect(value.ensemblesIds).toEqual([])
      expect(value.schoolYears).toEqual([])
      expect(value.isActive).toBe(true)
    })

    it('should allow full teacher object with all properties', () => {
      // Setup
      const fullTeacher = makeValidTeacher({
        roles: ['מורה', 'מנצח', 'מדריך הרכב'],
        personalInfo: {
          firstName: 'Full Test',
          lastName: 'Teacher',
          phone: '0501234567',
          email: 'full.teacher@example.com',
          address: 'Full Address'
        },
        professionalInfo: {
          instruments: [],
          isActive: true
        },
        teaching: {
          timeBlocks: []
        },
        conducting: {
          orchestraIds: ['orchestraId1', 'orchestraId2']
        },
        ensemblesIds: ['ensembleId1'],
        schoolYears: [
          {
            schoolYearId: 'yearId1',
            isActive: true
          },
          {
            schoolYearId: 'yearId2',
            isActive: false
          }
        ],
        credentials: {
          email: 'full.teacher@example.com',
          password: 'secure_password'
        },
        isActive: true
      })

      // Execute
      const { error, value } = teacherSchema.validate(fullTeacher)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(fullTeacher)
    })
  })
})
