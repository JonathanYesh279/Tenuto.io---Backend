// api/bagrut/__tests__/bagrut.migration.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bagrutService } from '../bagrut.service.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../student/student.service.js', () => ({
  studentService: {
    setBagrutId: vi.fn(),
    removeBagrutId: vi.fn()
  }
}))

// Mock tenant middleware to bypass tenantId guard
vi.mock('../../../middleware/tenant.middleware.js', () => ({
  requireTenantId: vi.fn((tenantId) => tenantId || 'test-tenant-id'),
}))

// Mock query scoping to return filters as-is
vi.mock('../../../utils/queryScoping.js', () => ({
  buildScopedFilter: vi.fn((type, filter) => filter),
}))

const TEST_CONTEXT = { context: { tenantId: 'test-tenant-id' } }

describe('Bagrut Presentation Update Tests (Post-Migration)', () => {
  let mockCollection

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn()
    }

    getCollection.mockResolvedValue(mockCollection)
  })

  describe('Presentations 0-2 (Regular Presentations)', () => {
    it('should update a regular presentation and strip grade/gradeLevel', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      const updatedBagrut = {
        _id: bagrutId,
        presentations: [
          { completed: true, status: 'passed', notes: 'Updated notes', reviewedBy: 'teacherId', lastUpdatedBy: 'teacherId', date: expect.any(Date) },
          { completed: true, status: 'passed', notes: '' },
          { completed: false, status: 'not tested', notes: '' },
          { completed: false, status: 'not tested', grade: null, detailedGrading: {} }
        ]
      }

      mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

      const result = await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'Updated notes', grade: 85, gradeLevel: 'good' },
        'teacherId',
        TEST_CONTEXT
      )

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: bagrutId, tenantId: 'test-tenant-id' },
        expect.objectContaining({
          $set: expect.objectContaining({
            'presentations.0': expect.objectContaining({
              notes: 'Updated notes',
              lastUpdatedBy: 'teacherId'
            })
          })
        }),
        { returnDocument: 'after' }
      )

      // Verify grade/gradeLevel were stripped from the update data
      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.0']
      expect(setArg).not.toHaveProperty('grade')
      expect(setArg).not.toHaveProperty('gradeLevel')
    })

    it('should set default notes when not provided', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true, notes: '' }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        1,
        { completed: true, status: 'passed' },
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.1']
      expect(setArg.notes).toBe('')
    })

    it('should set reviewedBy to teacherId when not provided', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'test' },
        'teacher123',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.0']
      expect(setArg.reviewedBy).toBe('teacher123')
      expect(setArg.lastUpdatedBy).toBe('teacher123')
    })

    it('should preserve reviewedBy when provided by frontend', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'test', reviewedBy: 'Examiner Name' },
        'teacher123',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.0']
      expect(setArg.reviewedBy).toBe('Examiner Name')
      expect(setArg.lastUpdatedBy).toBe('teacher123')
    })
  })

  describe('Presentation 3 (Graded Presentation)', () => {
    it('should calculate grade from detailedGrading for presentation 3', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      const presentationData = {
        completed: true,
        status: 'passed',
        detailedGrading: {
          playingSkills: { points: 35, maxPoints: 40 },
          musicalUnderstanding: { points: 26, maxPoints: 30 },
          textKnowledge: { points: 18, maxPoints: 20 },
          playingByHeart: { points: 9, maxPoints: 10 }
        }
      }

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [
          { completed: true }, { completed: true }, { completed: true },
          { ...presentationData, grade: 88, gradeLevel: 'good' }
        ]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        3,
        presentationData,
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.3']
      expect(setArg.grade).toBe(88) // 35 + 26 + 18 + 9 = 88
      expect(setArg.gradeLevel).toBeDefined()
    })

    it('should preserve grade fields for presentation 3 (not strip them)', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      const presentationData = {
        completed: true,
        grade: 85,
        gradeLevel: 'good',
        detailedGrading: {
          playingSkills: { points: 34, maxPoints: 40 },
          musicalUnderstanding: { points: 25, maxPoints: 30 },
          textKnowledge: { points: 17, maxPoints: 20 },
          playingByHeart: { points: 9, maxPoints: 10 }
        }
      }

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{}, {}, {}, presentationData]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        3,
        presentationData,
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.3']
      // Grade should be calculated from detailedGrading, not stripped
      expect(setArg.grade).toBe(85) // 34 + 25 + 17 + 9 = 85
    })
  })

  describe('Index Validation', () => {
    it('should reject negative presentation index', async () => {
      await expect(
        bagrutService.updatePresentation('6579e36c83c8b3a5c2df8a8b', -1, { notes: 'test' }, 'teacherId', TEST_CONTEXT)
      ).rejects.toThrow('Invalid presentation index')
    })

    it('should reject presentation index above 3', async () => {
      await expect(
        bagrutService.updatePresentation('6579e36c83c8b3a5c2df8a8b', 4, { notes: 'test' }, 'teacherId', TEST_CONTEXT)
      ).rejects.toThrow('Invalid presentation index')
    })

    it('should accept all valid indices (0-3)', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      for (let i = 0; i <= 3; i++) {
        mockCollection.findOneAndUpdate.mockResolvedValueOnce({
          _id: bagrutId,
          presentations: [{}, {}, {}, {}]
        })

        await expect(
          bagrutService.updatePresentation(
            bagrutId.toString(),
            i,
            i === 3 ? { detailedGrading: { playingSkills: { points: 30, maxPoints: 40 }, musicalUnderstanding: { points: 20, maxPoints: 30 }, textKnowledge: { points: 15, maxPoints: 20 }, playingByHeart: { points: 7, maxPoints: 10 } } } : { notes: 'test' },
            'teacherId',
            TEST_CONTEXT
          )
        ).resolves.toBeDefined()
      }
    })

    it('should handle invalid ObjectId gracefully', async () => {
      await expect(
        bagrutService.updatePresentation('invalid-object-id', 0, { notes: 'test' }, 'teacherId', TEST_CONTEXT)
      ).rejects.toThrow('Invalid ObjectId')
    })
  })

  describe('Data Integrity', () => {
    it('should always set date on presentation update', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'test' },
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.0']
      expect(setArg.date).toBeInstanceOf(Date)
    })

    it('should use provided date when available', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const customDate = '2024-06-15'

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'test', date: customDate },
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set['presentations.0']
      expect(setArg.date).toBeInstanceOf(Date)
      expect(setArg.date.toISOString()).toContain('2024-06-15')
    })

    it('should always update updatedAt timestamp', async () => {
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: bagrutId,
        presentations: [{ completed: true }]
      })

      await bagrutService.updatePresentation(
        bagrutId.toString(),
        0,
        { notes: 'test' },
        'teacherId',
        TEST_CONTEXT
      )

      const setArg = mockCollection.findOneAndUpdate.mock.calls[0][1].$set
      expect(setArg.updatedAt).toBeInstanceOf(Date)
    })
  })
})
