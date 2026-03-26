import { getCollection } from '../../services/mongoDB.service.js';
import { validateTheoryCourse, validateTheoryCourseUpdate } from './theory.validation.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../services/logger.service.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import { now, toUTC } from '../../utils/dateHelpers.js';

const logger = createLogger('theoryCourseService');

export const theoryCourseService = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  addStudentToCourse,
  removeStudentFromCourse,
  getCourseAttendanceAnalytics,
  linkLessonsToCourse,
};

/**
 * Create a new theory course (parent entity for recurring lessons).
 * After insert, adds courseId to the teacher's teaching.theoryCourseIds.
 */
async function createCourse(courseData, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);

    const { error, value } = validateTheoryCourse(courseData);
    if (error) throw new Error(`Validation error: ${error.message}`);

    value.tenantId = tenantId;
    value.studentIds = value.studentIds || [];
    value.lessonIds = [];
    value.isActive = value.isActive !== undefined ? value.isActive : true;
    value.createdAt = toUTC(now());
    value.updatedAt = toUTC(now());

    const courseCollection = await getCollection('theory_course');
    const result = await courseCollection.insertOne(value);
    const courseId = result.insertedId.toString();

    // Update teacher's theoryCourseIds
    try {
      const teacherCollection = await getCollection('teacher');
      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(value.teacherId), tenantId },
        { $addToSet: { 'teaching.theoryCourseIds': courseId } }
      );
    } catch (teacherErr) {
      logger.warn({ courseId, teacherId: value.teacherId, err: teacherErr.message }, 'Could not update teacher theoryCourseIds');
    }

    return { _id: result.insertedId, ...value };
  } catch (err) {
    logger.error({ err: err.message }, 'Error in createCourse');
    throw new Error(`Error in theoryCourseService.createCourse: ${err}`);
  }
}

/**
 * Get all theory courses for a tenant with optional filters.
 * Supported filters: category, teacherId, schoolYearId, isActive
 */
async function getCourses(filterBy = {}, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const collection = await getCollection('theory_course');

    const criteria = { tenantId };

    if (filterBy.category) criteria.category = filterBy.category;
    if (filterBy.teacherId) criteria.teacherId = filterBy.teacherId;
    if (filterBy.schoolYearId) criteria.schoolYearId = filterBy.schoolYearId;

    // Default to active only unless explicitly overridden
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive;
    } else if (!filterBy.showInactive) {
      criteria.isActive = true;
    }

    const courses = await collection
      .find(criteria)
      .sort({ category: 1 })
      .toArray();

    return courses;
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getCourses');
    throw new Error(`Error in theoryCourseService.getCourses: ${err}`);
  }
}

/**
 * Get a single theory course by ID with tenantId scoping.
 */
async function getCourseById(courseId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const collection = await getCollection('theory_course');

    const course = await collection.findOne({
      _id: ObjectId.createFromHexString(courseId),
      tenantId,
    });

    if (!course) throw new Error(`Theory course with id ${courseId} not found`);
    return course;
  } catch (err) {
    logger.error({ courseId, err: err.message }, 'Error in getCourseById');
    throw new Error(`Error in theoryCourseService.getCourseById: ${err}`);
  }
}

/**
 * Update a theory course. Only allows updating non-roster fields.
 * studentIds and lessonIds are managed via dedicated endpoints.
 */
async function updateCourse(courseId, updateData, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);

    const { error, value } = validateTheoryCourseUpdate(updateData);
    if (error) throw new Error(`Validation error: ${error.message}`);

    // Only allow safe fields — never overwrite studentIds or lessonIds here
    const allowedFields = ['category', 'teacherId', 'dayOfWeek', 'startTime', 'endTime', 'location', 'notes', 'syllabus', 'isActive'];
    const safeUpdate = {};
    for (const field of allowedFields) {
      if (value[field] !== undefined) safeUpdate[field] = value[field];
    }
    safeUpdate.updatedAt = toUTC(now());

    const collection = await getCollection('theory_course');
    const updated = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(courseId), tenantId },
      { $set: safeUpdate },
      { returnDocument: 'after' }
    );

    if (!updated) throw new Error(`Theory course with id ${courseId} not found`);
    return updated;
  } catch (err) {
    logger.error({ courseId, err: err.message }, 'Error in updateCourse');
    throw new Error(`Error in theoryCourseService.updateCourse: ${err}`);
  }
}

/**
 * Delete a theory course.
 * - Sets courseId: null on all linked theory_lesson documents
 * - Removes courseId from teacher's teaching.theoryCourseIds
 * - Removes courseId from students' enrollments.theoryCourseIds
 */
async function deleteCourse(courseId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const course = await getCourseById(courseId, options);

    // 1. Nullify courseId on all linked lessons
    const lessonCollection = await getCollection('theory_lesson');
    const lessonUpdateResult = await lessonCollection.updateMany(
      { courseId, tenantId },
      { $set: { courseId: null } }
    );
    logger.info({ courseId, lessonsUpdated: lessonUpdateResult.modifiedCount }, 'Nullified courseId on lessons');

    // 2. Remove courseId from teacher's theoryCourseIds
    const teacherCollection = await getCollection('teacher');
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(course.teacherId), tenantId },
      { $pull: { 'teaching.theoryCourseIds': courseId } }
    );

    // 3. Remove courseId from students' enrollments.theoryCourseIds
    if (course.studentIds && course.studentIds.length > 0) {
      const studentCollection = await getCollection('student');
      await studentCollection.updateMany(
        { 'enrollments.theoryCourseIds': courseId, tenantId },
        { $pull: { 'enrollments.theoryCourseIds': courseId } }
      );
    }

    // 4. Delete the course document
    const courseCollection = await getCollection('theory_course');
    const deleteResult = await courseCollection.deleteOne({
      _id: ObjectId.createFromHexString(courseId),
      tenantId,
    });

    return { deletedCount: deleteResult.deletedCount };
  } catch (err) {
    logger.error({ courseId, err: err.message }, 'Error in deleteCourse');
    throw new Error(`Error in theoryCourseService.deleteCourse: ${err}`);
  }
}

/**
 * Add a student to a theory course.
 * - Adds studentId to course's studentIds[]
 * - Adds studentId to future lessons' studentIds[] (date >= now)
 * - Updates student's enrollments.theoryCourseIds
 */
async function addStudentToCourse(courseId, studentId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);

    // 1. Add to course's studentIds
    const courseCollection = await getCollection('theory_course');
    const courseResult = await courseCollection.updateOne(
      { _id: ObjectId.createFromHexString(courseId), tenantId },
      { $addToSet: { studentIds: studentId }, $set: { updatedAt: toUTC(now()) } }
    );

    if (courseResult.matchedCount === 0) {
      throw new Error(`Theory course with id ${courseId} not found`);
    }

    // 2. Add to future lessons' studentIds
    try {
      const lessonCollection = await getCollection('theory_lesson');
      const nowIso = new Date().toISOString();
      await lessonCollection.updateMany(
        { courseId, tenantId, date: { $gte: nowIso } },
        { $addToSet: { studentIds: studentId } }
      );
    } catch (lessonErr) {
      logger.warn({ courseId, studentId, err: lessonErr.message }, 'Could not update future lessons studentIds');
    }

    // 3. Update student enrollments
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId), tenantId },
        { $addToSet: { 'enrollments.theoryCourseIds': courseId } }
      );
    } catch (studentErr) {
      logger.warn({ courseId, studentId, err: studentErr.message }, 'Could not update student theoryCourseIds');
    }

    return await getCourseById(courseId, options);
  } catch (err) {
    logger.error({ courseId, studentId, err: err.message }, 'Error in addStudentToCourse');
    throw new Error(`Error in theoryCourseService.addStudentToCourse: ${err}`);
  }
}

/**
 * Remove a student from a theory course.
 * - Pulls studentId from course's studentIds[]
 * - Pulls studentId from future lessons' studentIds[]
 * - Updates student's enrollments.theoryCourseIds
 */
async function removeStudentFromCourse(courseId, studentId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);

    // 1. Remove from course's studentIds
    const courseCollection = await getCollection('theory_course');
    const courseResult = await courseCollection.updateOne(
      { _id: ObjectId.createFromHexString(courseId), tenantId },
      { $pull: { studentIds: studentId }, $set: { updatedAt: toUTC(now()) } }
    );

    if (courseResult.matchedCount === 0) {
      throw new Error(`Theory course with id ${courseId} not found`);
    }

    // 2. Remove from future lessons' studentIds
    try {
      const lessonCollection = await getCollection('theory_lesson');
      const nowIso = new Date().toISOString();
      await lessonCollection.updateMany(
        { courseId, tenantId, date: { $gte: nowIso } },
        { $pull: { studentIds: studentId } }
      );
    } catch (lessonErr) {
      logger.warn({ courseId, studentId, err: lessonErr.message }, 'Could not update future lessons studentIds on remove');
    }

    // 3. Update student enrollments
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId), tenantId },
        { $pull: { 'enrollments.theoryCourseIds': courseId } }
      );
    } catch (studentErr) {
      logger.warn({ courseId, studentId, err: studentErr.message }, 'Could not remove theoryCourseId from student enrollments');
    }

    return await getCourseById(courseId, options);
  } catch (err) {
    logger.error({ courseId, studentId, err: err.message }, 'Error in removeStudentFromCourse');
    throw new Error(`Error in theoryCourseService.removeStudentFromCourse: ${err}`);
  }
}

/**
 * Get cross-session attendance analytics for a theory course.
 * Aggregates activity_attendance records for all lessons in the course.
 *
 * Returns:
 * - Per-student stats (attended, absences, late, attendanceRate)
 * - Per-session stats (date, totalStudents, presentCount)
 */
async function getCourseAttendanceAnalytics(courseId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const course = await getCourseById(courseId, options);

    const lessonIds = course.lessonIds || [];
    const activityCollection = await getCollection('activity_attendance');

    let studentStats = [];
    let sessionStats = [];

    if (lessonIds.length > 0) {
      // Per-student aggregation
      studentStats = await activityCollection.aggregate([
        {
          $match: {
            sessionId: { $in: lessonIds },
            activityType: 'תאוריה',
            tenantId,
            isArchived: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$studentId',
            totalSessions: { $sum: 1 },
            attended: {
              $sum: {
                $cond: [{ $in: ['$status', ['הגיע/ה', 'איחור']] }, 1, 0],
              },
            },
            absences: {
              $sum: {
                $cond: [{ $eq: ['$status', 'לא הגיע/ה'] }, 1, 0],
              },
            },
            lateCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'איחור'] }, 1, 0],
              },
            },
          },
        },
        {
          $addFields: {
            attendanceRate: {
              $cond: [
                { $eq: ['$totalSessions', 0] },
                0,
                { $multiply: [{ $divide: ['$attended', '$totalSessions'] }, 100] },
              ],
            },
          },
        },
        {
          $project: {
            studentId: '$_id',
            totalSessions: 1,
            attended: 1,
            absences: 1,
            lateCount: 1,
            attendanceRate: { $round: ['$attendanceRate', 1] },
          },
        },
      ]).toArray();

      // Per-session aggregation
      sessionStats = await activityCollection.aggregate([
        {
          $match: {
            sessionId: { $in: lessonIds },
            activityType: 'תאוריה',
            tenantId,
            isArchived: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$sessionId',
            date: { $first: '$date' },
            totalStudents: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['הגיע/ה', 'איחור']] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            sessionId: '$_id',
            date: 1,
            totalStudents: 1,
            presentCount: 1,
          },
        },
        { $sort: { date: 1 } },
      ]).toArray();
    }

    return {
      courseId,
      category: course.category,
      totalLessons: lessonIds.length,
      totalStudents: (course.studentIds || []).length,
      studentStats,
      sessionStats,
    };
  } catch (err) {
    logger.error({ courseId, err: err.message }, 'Error in getCourseAttendanceAnalytics');
    throw new Error(`Error in theoryCourseService.getCourseAttendanceAnalytics: ${err}`);
  }
}

/**
 * Link existing lessons to a course.
 * Used by enhanced bulkCreate to associate generated lessons with a course.
 * - Adds lessonIds to course's lessonIds[] ($addToSet with $each)
 * - Sets courseId on each lesson document
 */
async function linkLessonsToCourse(courseId, lessonIds, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);

    if (!lessonIds || lessonIds.length === 0) {
      return await getCourseById(courseId, options);
    }

    // 1. Add lesson IDs to the course's lessonIds array
    const courseCollection = await getCollection('theory_course');
    const courseResult = await courseCollection.updateOne(
      { _id: ObjectId.createFromHexString(courseId), tenantId },
      {
        $addToSet: { lessonIds: { $each: lessonIds } },
        $set: { updatedAt: toUTC(now()) },
      }
    );

    if (courseResult.matchedCount === 0) {
      throw new Error(`Theory course with id ${courseId} not found`);
    }

    // 2. Set courseId on each lesson document
    const lessonCollection = await getCollection('theory_lesson');
    await lessonCollection.updateMany(
      {
        _id: { $in: lessonIds.map(id => ObjectId.createFromHexString(id)) },
        tenantId,
      },
      { $set: { courseId } }
    );

    logger.info({ courseId, lessonCount: lessonIds.length }, 'Linked lessons to course');
    return await getCourseById(courseId, options);
  } catch (err) {
    logger.error({ courseId, lessonCount: lessonIds?.length, err: err.message }, 'Error in linkLessonsToCourse');
    throw new Error(`Error in theoryCourseService.linkLessonsToCourse: ${err}`);
  }
}
