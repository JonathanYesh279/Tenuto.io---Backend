import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { doTimesOverlap } from '../utils/timeUtils.js';
import {
  toUTC,
  createAppDate,
  getStartOfDay,
  getEndOfDay,
  formatDate,
  generateDatesForDayOfWeek,
  isValidDate,
  isSameDay,
  getDayOfWeek
} from '../utils/dateHelpers.js';
import { requireTenantId } from '../middleware/tenant.middleware.js';
import { VALID_DAYS } from '../config/constants.js';

class ConflictDetectionService {
  
  /**
   * Check for room booking conflicts
   * @param {Object} lessonData - The lesson data to check
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @param {Object} options - Options object with context
   * @param {Object} options.context - Request context with tenantId
   * @returns {Array} Array of room conflicts
   */
  async checkRoomConflicts(lessonData, excludeId = null, options = {}) {
    try {
      const tenantId = requireTenantId(options.context?.tenantId);
      const { date, startTime, endTime, location } = lessonData;

      if (!date || !startTime || !endTime || !location) {
        return [];
      }

      // Validate date input
      if (!isValidDate(date)) {
        throw new Error('Invalid date provided for conflict check');
      }

      const collection = await getCollection('theory_lesson');

      // Use timezone-aware date range query for better accuracy
      const targetDate = createAppDate(date);
      const startOfDay = getStartOfDay(targetDate);
      const endOfDay = getEndOfDay(targetDate);

      // Build query to find lessons on the same date and location (tenant-scoped)
      const query = {
        tenantId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        location: location,
        ...(excludeId && { _id: { $ne: ObjectId.createFromHexString(excludeId) } })
      };
      
      // Find all lessons that could potentially conflict
      const existingLessons = await collection.find(query).toArray();
      
      // Filter for actual time conflicts using timezone-aware date comparison
      const conflictingLessons = existingLessons.filter(lesson => {
        // Ensure we're comparing the same day in app timezone
        const lessonAppDate = createAppDate(lesson.date);
        const isSameDay = targetDate.format('YYYY-MM-DD') === lessonAppDate.format('YYYY-MM-DD');
        
        return isSameDay && doTimesOverlap(startTime, endTime, lesson.startTime, lesson.endTime);
      });
      
      // Format conflicts for response with timezone-aware date formatting
      return conflictingLessons.map(lesson => ({
        type: 'room',
        conflictId: lesson._id.toString(),
        date: formatDate(lesson.date, 'YYYY-MM-DD'),
        location: lesson.location,
        existingTime: `${lesson.startTime}-${lesson.endTime}`,
        newTime: `${startTime}-${endTime}`,
        teacherId: lesson.teacherId,
        description: `Room ${location} is already booked on ${formatDate(date, 'DD/MM/YYYY')} from ${lesson.startTime}-${lesson.endTime}`,
        existingLesson: lesson
      }));
    } catch (error) {
      console.error('Error checking room conflicts:', error);
      throw new Error(`Failed to check room conflicts: ${error.message}`);
    }
  }
  
  /**
   * Check for teacher scheduling conflicts
   * @param {Object} lessonData - The lesson data to check
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @param {Object} options - Options object with context
   * @param {Object} options.context - Request context with tenantId
   * @returns {Array} Array of teacher conflicts
   */
  async checkTeacherConflicts(lessonData, excludeId = null, options = {}) {
    try {
      const tenantId = requireTenantId(options.context?.tenantId);
      const { date, startTime, endTime, teacherId, location } = lessonData;

      if (!date || !startTime || !endTime || !teacherId) {
        return [];
      }

      // Validate date input
      if (!isValidDate(date)) {
        throw new Error('Invalid date provided for teacher conflict check');
      }

      const collection = await getCollection('theory_lesson');

      // Use timezone-aware date range query
      const targetDate = createAppDate(date);
      const startOfDay = getStartOfDay(targetDate);
      const endOfDay = getEndOfDay(targetDate);

      // Build query to find lessons with the same teacher on the same date (tenant-scoped)
      const query = {
        tenantId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        teacherId: teacherId,
        location: { $ne: location }, // Different room (same room would be caught by room conflict)
        ...(excludeId && { _id: { $ne: ObjectId.createFromHexString(excludeId) } })
      };
      
      // Find all lessons that could potentially conflict
      const existingLessons = await collection.find(query).toArray();
      
      // Filter for actual time conflicts using timezone-aware date comparison
      const conflictingLessons = existingLessons.filter(lesson => {
        // Ensure we're comparing the same day in app timezone
        const lessonAppDate = createAppDate(lesson.date);
        const isSameDay = targetDate.format('YYYY-MM-DD') === lessonAppDate.format('YYYY-MM-DD');
        
        return isSameDay && doTimesOverlap(startTime, endTime, lesson.startTime, lesson.endTime);
      });
      
      // Format conflicts for response with timezone-aware date formatting
      return conflictingLessons.map(lesson => ({
        type: 'teacher',
        conflictId: lesson._id.toString(),
        date: formatDate(lesson.date, 'YYYY-MM-DD'),
        existingLocation: lesson.location,
        newLocation: location,
        existingTime: `${lesson.startTime}-${lesson.endTime}`,
        newTime: `${startTime}-${endTime}`,
        teacherId: lesson.teacherId,
        description: `Teacher is already scheduled on ${formatDate(date, 'DD/MM/YYYY')} from ${lesson.startTime}-${lesson.endTime} in ${lesson.location}`,
        existingLesson: lesson
      }));
    } catch (error) {
      console.error('Error checking teacher conflicts:', error);
      throw new Error(`Failed to check teacher conflicts: ${error.message}`);
    }
  }
  
  /**
   * Check for cross-source room conflicts (rehearsals and timeBlocks).
   * This complements the existing checkRoomConflicts which only checks theory-vs-theory.
   *
   * @param {Object} lessonData - { date, startTime, endTime, location }
   * @param {string} excludeId - Optional lesson ID to exclude (unused here, kept for API consistency)
   * @param {Object} options - { context: { tenantId } }
   * @returns {Array} Array of cross-source room conflicts
   */
  async checkCrossSourceRoomConflicts(lessonData, excludeId = null, options = {}) {
    try {
      const tenantId = requireTenantId(options.context?.tenantId);
      const { date, startTime, endTime, location } = lessonData;

      if (!date || !startTime || !endTime || !location) {
        return [];
      }

      if (!isValidDate(date)) {
        return [];
      }

      // Derive day-of-week from the lesson date
      const targetDate = createAppDate(date);
      const dayOfWeek = getDayOfWeek(targetDate);
      const hebrewDay = VALID_DAYS[dayOfWeek];
      const startOfDay = getStartOfDay(targetDate);
      const endOfDay = getEndOfDay(targetDate);

      const conflicts = [];

      // 1. Check rehearsals on the same date, same room, overlapping times
      const rehearsalCollection = await getCollection('rehearsal');
      const rehearsals = await rehearsalCollection.find({
        tenantId,
        location,
        date: { $gte: startOfDay, $lte: endOfDay },
      }).toArray();

      // Look up orchestra names for conflicting rehearsals
      const groupIds = [...new Set(rehearsals.filter(r => r.groupId).map(r => r.groupId))];
      const orchestraNameMap = await this._lookupOrchestraNames(groupIds);

      for (const r of rehearsals) {
        if (doTimesOverlap(startTime, endTime, r.startTime, r.endTime)) {
          conflicts.push({
            type: 'room',
            source: 'rehearsal',
            conflictId: r._id.toString(),
            date: formatDate(r.date, 'YYYY-MM-DD'),
            location: r.location,
            existingTime: `${r.startTime}-${r.endTime}`,
            newTime: `${startTime}-${endTime}`,
            activityName: orchestraNameMap.get(r.groupId) || '\u05D7\u05D6\u05E8\u05D4',
            description: `\u05D4\u05D7\u05D3\u05E8 ${location} \u05EA\u05E4\u05D5\u05E1 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D7\u05D6\u05E8\u05D4 "${orchestraNameMap.get(r.groupId) || ''}" \u05D1\u05E9\u05E2\u05D5\u05EA ${r.startTime}-${r.endTime}`,
          });
        }
      }

      // 2. Check timeBlocks on the same Hebrew day, same location, overlapping times
      if (hebrewDay) {
        const teacherCollection = await getCollection('teacher');
        const teachers = await teacherCollection.find({
          tenantId,
          isActive: true,
          'teaching.timeBlocks': {
            $elemMatch: {
              day: hebrewDay,
              location,
              isActive: { $ne: false },
            },
          },
        }, {
          projection: {
            'personalInfo.firstName': 1,
            'personalInfo.lastName': 1,
            'teaching.timeBlocks': 1,
          },
        }).toArray();

        for (const teacher of teachers) {
          const blocks = (teacher.teaching?.timeBlocks || []).filter(
            b => b.day === hebrewDay && b.location === location && b.isActive !== false
          );

          for (const block of blocks) {
            if (doTimesOverlap(startTime, endTime, block.startTime, block.endTime)) {
              const teacherName = `${teacher.personalInfo?.firstName || ''} ${teacher.personalInfo?.lastName || ''}`.trim();
              conflicts.push({
                type: 'room',
                source: 'timeBlock',
                conflictId: block._id ? block._id.toString() : teacher._id.toString(),
                date: formatDate(date, 'YYYY-MM-DD'),
                location,
                existingTime: `${block.startTime}-${block.endTime}`,
                newTime: `${startTime}-${endTime}`,
                activityName: `\u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9 - ${teacherName}`,
                description: `\u05D4\u05D7\u05D3\u05E8 ${location} \u05EA\u05E4\u05D5\u05E1 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05E9\u05D9\u05E2\u05D5\u05E8 \u05E4\u05E8\u05D8\u05D9 \u05E9\u05DC ${teacherName} \u05D1\u05E9\u05E2\u05D5\u05EA ${block.startTime}-${block.endTime}`,
              });
            }
          }
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking cross-source room conflicts:', error);
      // Non-fatal: return empty rather than blocking theory lesson creation
      return [];
    }
  }

  /**
   * Batch lookup orchestra names by groupId strings.
   * @param {string[]} groupIds
   * @returns {Promise<Map<string, string>>}
   * @private
   */
  async _lookupOrchestraNames(groupIds) {
    const map = new Map();
    if (!groupIds.length) return map;

    const collection = await getCollection('orchestra');
    const objectIds = groupIds
      .filter(id => ObjectId.isValid(id))
      .map(id => ObjectId.createFromHexString(id));

    if (!objectIds.length) return map;

    const orchestras = await collection
      .find({ _id: { $in: objectIds } }, { projection: { name: 1 } })
      .toArray();

    for (const o of orchestras) {
      map.set(o._id.toString(), o.name || '');
    }
    return map;
  }

  /**
   * Validate a single lesson for conflicts
   * @param {Object} lessonData - The lesson data to validate
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @param {Object} options - Options object with context
   * @param {Object} options.context - Request context with tenantId
   * @returns {Object} Conflict validation result
   */
  async validateSingleLesson(lessonData, excludeId = null, options = {}) {
    try {
      const roomConflicts = await this.checkRoomConflicts(lessonData, excludeId, options);
      const teacherConflicts = await this.checkTeacherConflicts(lessonData, excludeId, options);
      const crossSourceConflicts = await this.checkCrossSourceRoomConflicts(lessonData, excludeId, options);

      // Merge cross-source conflicts into room conflicts
      const allRoomConflicts = [...roomConflicts, ...crossSourceConflicts];

      return {
        hasConflicts: allRoomConflicts.length > 0 || teacherConflicts.length > 0,
        roomConflicts: allRoomConflicts,
        teacherConflicts,
        totalConflicts: allRoomConflicts.length + teacherConflicts.length
      };
    } catch (error) {
      console.error('Error validating single lesson:', error);
      throw new Error(`Failed to validate lesson: ${error.message}`);
    }
  }
  
  /**
   * Validate bulk lesson creation for conflicts
   * @param {Object} bulkData - The bulk creation data
   * @param {Object} options - Options object with context
   * @param {Object} options.context - Request context with tenantId
   * @returns {Object} Bulk conflict validation result
   */
  async validateBulkLessons(bulkData, options = {}) {
    try {
      const { startDate, endDate, dayOfWeek, startTime, endTime, location, teacherId, excludeDates = [] } = bulkData;
      
      // Validate input dates
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error('Invalid start or end date provided for bulk validation');
      }
      
      // Generate all lesson dates using timezone-aware date generation
      const lessonDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
      
      let allRoomConflicts = [];
      let allTeacherConflicts = [];
      
      // Check each date for conflicts
      for (const utcDate of lessonDates) {
        // Convert UTC date back to app timezone for display
        const appDate = createAppDate(utcDate);
        const dateString = appDate.format('YYYY-MM-DD');
        
        const lessonData = { date: dateString, startTime, endTime, location, teacherId };
        
        const roomConflicts = await this.checkRoomConflicts(lessonData, null, options);
        const teacherConflicts = await this.checkTeacherConflicts(lessonData, null, options);
        
        allRoomConflicts.push(...roomConflicts);
        allTeacherConflicts.push(...teacherConflicts);
      }
      
      return {
        hasConflicts: allRoomConflicts.length > 0 || allTeacherConflicts.length > 0,
        roomConflicts: allRoomConflicts,
        teacherConflicts: allTeacherConflicts,
        totalConflicts: allRoomConflicts.length + allTeacherConflicts.length,
        affectedDates: lessonDates.map(utcDate => formatDate(utcDate, 'YYYY-MM-DD')),
        totalLessons: lessonDates.length
      };
    } catch (error) {
      console.error('Error validating bulk lessons:', error);
      throw new Error(`Failed to validate bulk lessons: ${error.message}`);
    }
  }
  
  /**
   * Generate dates for recurring lessons (Legacy method - now uses timezone-aware helper)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {number} dayOfWeek - Day of week (0=Sunday, 6=Saturday)
   * @param {Array} excludeDates - Array of dates to exclude
   * @returns {Array} Array of date strings
   * @deprecated Use generateDatesForDayOfWeek from dateHelpers instead
   */
  generateRecurrenceDates(startDate, endDate, dayOfWeek, excludeDates = []) {
    // Use the new timezone-aware date generation
    const utcDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
    
    // Convert UTC dates back to date strings for backward compatibility
    return utcDates.map(utcDate => formatDate(utcDate, 'YYYY-MM-DD'));
  }

  /**
   * Get detailed conflict information for frontend display
   * @param {Array} conflicts - Array of conflicts from validation
   * @returns {Object} Formatted conflict information
   */
  formatConflictsForFrontend(conflicts) {
    const roomConflicts = conflicts.filter(c => c.type === 'room');
    const teacherConflicts = conflicts.filter(c => c.type === 'teacher');
    
    return {
      summary: {
        total: conflicts.length,
        room: roomConflicts.length,
        teacher: teacherConflicts.length
      },
      details: {
        roomConflicts: roomConflicts.map(c => ({
          date: c.date,
          location: c.location,
          existingTime: c.existingTime,
          newTime: c.newTime,
          message: `החדר ${c.location} תפוס ב-${formatDate(c.date, 'DD/MM/YYYY')} בין ${c.existingTime}`
        })),
        teacherConflicts: teacherConflicts.map(c => ({
          date: c.date,
          existingLocation: c.existingLocation,
          newLocation: c.newLocation,
          existingTime: c.existingTime,
          newTime: c.newTime,
          message: `המורה תפוס ב-${formatDate(c.date, 'DD/MM/YYYY')} בין ${c.existingTime} ב${c.existingLocation}`
        }))
      }
    };
  }
}

export default new ConflictDetectionService();