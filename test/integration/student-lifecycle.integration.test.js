import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const teacherId = new ObjectId()
const studentId = new ObjectId()
const timeBlockId = new ObjectId()

// Create separate mock collections for each collection type
const mockTeacherCollection = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  find: vi.fn(),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}

const mockStudentCollection = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  find: vi.fn(),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}

const mockAttendanceCollection = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  find: vi.fn(),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}

// Mock mongoDB.service
vi.mock('../../services/mongoDB.service.js', () => {
  return {
    getCollection: vi.fn((name) => {
      if (name === 'teacher') return Promise.resolve(mockTeacherCollection)
      if (name === 'student') return Promise.resolve(mockStudentCollection)
      if (name === 'activity_attendance') return Promise.resolve(mockAttendanceCollection)
      // Default fallback
      return Promise.resolve(mockTeacherCollection)
    }),
    getDB: vi.fn(),
    initializeMongoDB: vi.fn(),
  }
})

// Mock logger
vi.mock('../../services/logger.service.js', () => {
  const noop = () => {}
  const logger = { info: noop, error: noop, warn: noop, debug: noop, fatal: noop, child: () => logger }
  return { default: logger, createLogger: () => logger }
})

let timeBlockService
let attendanceService

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.ACCESS_TOKEN_SECRET = 'test-secret'

  const tbMod = await import('../../api/schedule/time-block.service.js')
  timeBlockService = tbMod.timeBlockService

  const attMod = await import('../../api/schedule/attendance.service.js')
  attendanceService = attMod.attendanceService
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Student Lifecycle E2E Test', () => {
  const tenantId = 'test-tenant-id'
  const context = { tenantId }

  it('create student -> assign to teacher -> mark attendance -> verify sync points', async () => {
    // ---- Step 1: Create student (simulated as direct DB insert) ----
    const studentDoc = {
      _id: studentId,
      tenantId,
      personalInfo: { firstName: 'New', lastName: 'Student', phone: '050333' },
      academicInfo: {
        instrumentProgress: [
          { instrument: 'חליל', currentStage: 1, isPrimary: true }
        ],
        class: 'ז'
      },
      teacherAssignments: [],
      enrollments: { orchestraIds: [], ensembleIds: [], schoolYears: [] },
      isActive: true,
      createdAt: new Date(),
    }

    mockStudentCollection.insertOne.mockResolvedValueOnce({ insertedId: studentId })

    // ---- Step 2: Assign student to teacher via timeBlock ----
    const teacherDoc = {
      _id: teacherId,
      tenantId,
      personalInfo: { firstName: 'Music', lastName: 'Teacher' },
      credentials: { email: 'teacher@test.com', tokenVersion: 0 },
      roles: ['מורה'],
      teaching: {
        timeBlocks: [
          {
            _id: timeBlockId,
            day: 'שני',
            startTime: '10:00',
            endTime: '14:00',
            location: 'Room B',
            isActive: true,
            assignedLessons: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      isActive: true,
    }

    // assignLessonToBlock calls:
    // 1. teacherCollection.findOne for teacher (with timeBlock query)
    mockTeacherCollection.findOne.mockResolvedValueOnce(teacherDoc)
    // 2. studentCollection.findOne for student
    mockStudentCollection.findOne.mockResolvedValueOnce(studentDoc)

    // 3. checkStudentScheduleConflict: teacherCollection.find().toArray()
    const mockConflictCursor = {
      toArray: vi.fn().mockResolvedValueOnce([]),
    }
    mockTeacherCollection.find.mockReturnValueOnce(mockConflictCursor)

    // 4. teacherCollection.updateOne (adds lesson to timeBlock)
    mockTeacherCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })
    // 5. studentCollection.updateOne (adds teacherAssignment)
    mockStudentCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

    const assignResult = await timeBlockService.assignLessonToBlock({
      teacherId: teacherId.toString(),
      studentId: studentId.toString(),
      timeBlockId: timeBlockId.toString(),
      startTime: '11:00',
      duration: 45,
    }, { context })

    expect(assignResult.success).toBe(true)

    // ---- Step 3: Verify sync points were written ----

    // Verify teacher update was called — lesson pushed to timeBlock
    const teacherUpdateCall = mockTeacherCollection.updateOne.mock.calls[0]
    expect(teacherUpdateCall[1].$push['teaching.timeBlocks.$.assignedLessons']).toBeDefined()
    // No $addToSet['teaching.studentIds'] — removed in Phase 5A

    // Verify student update was called with $push for teacherAssignments
    const studentUpdateCall = mockStudentCollection.updateOne.mock.calls[0]
    expect(studentUpdateCall[1].$push.teacherAssignments).toBeDefined()
    expect(studentUpdateCall[1].$push.teacherAssignments.teacherId).toBe(teacherId.toString())
    // No $addToSet.teacherIds — removed in Phase 5A

    // ---- Step 4: Mark attendance ----
    const attendanceRecord = {
      _id: new ObjectId(),
      studentId: studentId.toString(),
      teacherId: teacherId.toString(),
      tenantId,
      activityType: 'שיעור פרטי',
      status: 'הגיע/ה',
      date: new Date('2026-02-05'),
    }

    // getStudentPrivateLessonStats uses activity_attendance collection
    const mockStatsCursor = {
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([attendanceRecord]),
    }
    mockAttendanceCollection.find.mockReturnValueOnce(mockStatsCursor)

    const stats = await attendanceService.getStudentPrivateLessonStats(
      studentId.toString(),
      teacherId.toString(),
      { context }
    )

    expect(stats.totalLessons).toBe(1)
    expect(stats.attendedLessons).toBe(1)
    expect(stats.attendanceRate).toBe(100)
  })
})
