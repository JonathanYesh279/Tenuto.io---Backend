// api/rehearsal/rehearsal.service.js
import { getCollection, withTransaction } from '../../services/mongoDB.service.js';
import {
  validateRehearsal,
  validateRehearsalUpdate,
  validateBulkCreate,
  validateAttendance,
} from './rehearsal.validation.js';
import { ObjectId } from 'mongodb';
import {
  toUTC,
  createAppDate,
  getDayOfWeek,
  generateDatesForDayOfWeek,
  formatDate,
  getStartOfDay,
  getEndOfDay,
  isValidDate,
  now
} from '../../utils/dateHelpers.js';
import { buildScopedFilter } from '../../utils/queryScoping.js';
import { requireTenantId } from '../../middleware/tenant.middleware.js';
import { checkRehearsalConflicts } from '../../services/rehearsalConflictService.js';

export const rehearsalService = {
  getRehearsals,
  getRehearsalById,
  getOrchestraRehearsals,
  addRehearsal,
  updateRehearsal,
  removeRehearsal,
  bulkCreateRehearsals,
  bulkDeleteRehearsalsByOrchestra,
  bulkDeleteRehearsalsByDateRange,
  bulkUpdateRehearsalsByOrchestra,
  updateAttendance,
};

async function getRehearsals(filterBy = {}, options = {}) {
  try {
    const { context, scope } = options;
    requireTenantId(context?.tenantId);
    const collection = await getCollection('rehearsal');
    const criteria = buildScopedFilter('rehearsal', _buildCriteria(filterBy), context, scope);

    const rehearsal = await collection
      .find(criteria)
      .sort({ date: 1 })
      .toArray();

    return rehearsal;
  } catch (err) {
    console.error(`Failed to get rehearsals: ${err}`);
    throw new Error(`Failed to get rehearsals: ${err}`);
  }
}

async function getRehearsalById(rehearsalId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const collection = await getCollection('rehearsal');
    const rehearsal = await collection.findOne({
      _id: ObjectId.createFromHexString(rehearsalId),
      tenantId,
    });

    if (!rehearsal)
      throw new Error(`Rehearsal with id ${rehearsalId} not found`);
    return rehearsal;
  } catch (err) {
    console.error(`Failed to get rehearsal by id: ${err}`);
    throw new Error(`Failed to get rehearsal by id: ${err}`);
  }
}

async function getOrchestraRehearsals(orchestraId, filterBy = {}, options = {}) {
  try {
    filterBy.groupId = orchestraId;

    return await getRehearsals(filterBy, options);
  } catch (err) {
    console.error(`Failed to get orchestra rehearsals: ${err}`);
    throw new Error(`Failed to get orchestra rehearsals: ${err}`);
  }
}

async function addRehearsal(rehearsalToAdd, teacherId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    console.log(
      'Adding rehearsal with data:',
      JSON.stringify(rehearsalToAdd, null, 2)
    );

    const { error, value } = validateRehearsal(rehearsalToAdd);
    if (error) {
      console.error(`Validation error:`, error.details);
      throw error;
    }

    // Set tenantId from context (server-derived, never from client)
    value.tenantId = tenantId;

    if (!value.schoolYearId) {
      console.error('Missing required schoolYearId in rehearsal data');
      throw new Error('School year ID is required');
    }

    if (!isAdmin) {
      // Get the orchestra collection first and verify permissions
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        console.error('Failed to get orchestra collection');
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(value.groupId),
        conductorId: teacherId.toString(),
        tenantId,
      });

      if (!orchestra) {
        throw new Error('Not authorized to add rehearsal for this orchestra');
      }
    }

    // Validate and convert date to UTC for storage
    if (!isValidDate(value.date)) {
      throw new Error('Invalid rehearsal date provided');
    }

    const rehearsalDate = createAppDate(value.date);
    value.date = toUTC(rehearsalDate);

    // Calculate day of week if not provided (using timezone-aware calculation)
    if (value.dayOfWeek === undefined) {
      value.dayOfWeek = getDayOfWeek(rehearsalDate);
    }

    // Check for scheduling conflicts before inserting
    const conflicts = await checkRehearsalConflicts(
      { date: rehearsalDate, startTime: value.startTime, endTime: value.endTime, location: value.location, groupId: value.groupId },
      { context: options.context }
    );
    if (conflicts.hasConflicts) {
      const err = new Error('Scheduling conflict detected');
      err.code = 'CONFLICT';
      err.conflicts = conflicts;
      throw err;
    }

    // Set creation timestamps using timezone-aware current time
    const currentTime = now();
    value.createdAt = toUTC(currentTime);
    value.updatedAt = toUTC(currentTime);

    // Insert rehearsal atomically with orchestra update
    const rehearsalCollection = await getCollection('rehearsal');
    if (!rehearsalCollection) {
      console.error('Failed to get rehearsal collection');
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await withTransaction(async (session) => {
      const insertResult = await rehearsalCollection.insertOne(value, { session });
      console.log(
        `Successfully inserted rehearsal with ID: ${insertResult.insertedId}`
      );

      // Update orchestra if this is an orchestra rehearsal
      if (value.type === 'תזמורת') {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          throw new Error(
            'Database error: Failed to access orchestra collection'
          );
        }

        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(value.groupId), tenantId },
          { $push: { rehearsalIds: insertResult.insertedId.toString() } },
          { session }
        );
      }

      return insertResult;
    });

    return {
      _id: result.insertedId,
      id: result.insertedId,
      ...value,
    };
  } catch (err) {
    if (err.code === 'CONFLICT') throw err;
    console.error(`Failed to add rehearsal: ${err}`);
    throw new Error(`Failed to add rehearsal: ${err}`);
  }
}

async function updateRehearsal(
  rehearsalId,
  rehearsalToUpdate,
  teacherId,
  isAdmin = false,
  options = {}
) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const { error, value } = validateRehearsalUpdate(rehearsalToUpdate);

    if (error) throw error;

    // Handle date conversion for updates
    if (value.date) {
      if (!isValidDate(value.date)) {
        throw new Error('Invalid rehearsal date provided for update');
      }

      const rehearsalDate = createAppDate(value.date);
      value.date = toUTC(rehearsalDate);

      // Recalculate day of week if date changed
      value.dayOfWeek = getDayOfWeek(rehearsalDate);
    }

    value.updatedAt = toUTC(now());

    if (!isAdmin) {
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(value.groupId),
        tenantId,
      });

      if (!orchestra) {
        throw new Error(`Orchestra with id ${value.groupId} not found`);
      }

      if (orchestra.conductorId !== teacherId.toString()) {
        throw new Error(
          `Teacher with id ${teacherId} is not the conductor of the orchestra`
        );
      }
    }

    // Check for scheduling conflicts before updating
    const existing = await getRehearsalById(rehearsalId, options);
    const mergedData = {
      date: value.date || existing.date,
      startTime: value.startTime || existing.startTime,
      endTime: value.endTime || existing.endTime,
      location: value.location || existing.location,
      groupId: value.groupId || existing.groupId,
    };
    const conflicts = await checkRehearsalConflicts(
      mergedData,
      { context: options.context, excludeRehearsalId: rehearsalId }
    );
    if (conflicts.hasConflicts) {
      const err = new Error('Scheduling conflict detected');
      err.code = 'CONFLICT';
      err.conflicts = conflicts;
      throw err;
    }

    const collection = await getCollection('rehearsal');
    if (!collection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId), tenantId },
      { $set: value },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`);
    return result;
  } catch (err) {
    if (err.code === 'CONFLICT') throw err;
    console.error(`Failed to update rehearsal: ${err}`);
    throw new Error(`Failed to update rehearsal: ${err}`);
  }
}

async function removeRehearsal(rehearsalId, teacherId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const rehearsal = await getRehearsalById(rehearsalId, options);

    if (!isAdmin) {
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(rehearsal.groupId),
        tenantId,
      });

      if (!orchestra)
        throw new Error(`Orchestra with id ${rehearsal.groupId} not found`);

      if (orchestra.conductorId !== teacherId.toString())
        throw new Error(
          `Teacher with id ${teacherId} is not the conductor of the orchestra`
        );
    }

    // Atomically: remove from orchestra, delete attendance, delete rehearsal
    const collection = await getCollection('rehearsal');
    if (!collection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await withTransaction(async (session) => {
      // 1. Remove from orchestra record
      if (rehearsal.type === 'תזמורת') {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          throw new Error('Database error: Failed to access orchestra collection');
        }
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(rehearsal.groupId), tenantId },
          { $pull: { rehearsalIds: rehearsalId } },
          { session }
        );
      }

      // 2. Archive (soft-delete) associated attendance records
      const activityCollection = await getCollection('activity_attendance');
      if (activityCollection) {
        await activityCollection.updateMany(
          {
            sessionId: rehearsalId,
            activityType: rehearsal.type,
            tenantId,
          },
          {
            $set: {
              isArchived: true,
              archivedAt: toUTC(now()),
              archivedReason: 'rehearsal_deleted',
            }
          },
          { session }
        );
      }

      // 3. Hard delete - actually remove the document
      const deleteResult = await collection.findOneAndDelete(
        { _id: ObjectId.createFromHexString(rehearsalId), tenantId },
        { session }
      );

      if (!deleteResult) throw new Error(`Rehearsal with id ${rehearsalId} not found`);

      return deleteResult;
    });

    return result;
  } catch (err) {
    console.error(`Failed to remove rehearsal: ${err}`);
    throw new Error(`Failed to remove rehearsal: ${err}`);
  }
}

async function bulkCreateRehearsals(data, teacherId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    console.log(
      'Bulk creating rehearsals with data:',
      JSON.stringify(data, null, 2)
    );

    const { error, value } = validateBulkCreate(data);
    if (error) {
      console.error(`Bulk validation error:`, error.details);
      throw error;
    }

    // Check authorization if not admin
    if (!isAdmin) {
      try {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          throw new Error(
            'Database error: Failed to access orchestra collection'
          );
        }

        const teacherIdStr = teacherId ? teacherId.toString() : '';
        console.log(`Checking orchestra access for teacher: ${teacherIdStr}`);

        const orchestra = await orchestraCollection.findOne({
          _id: ObjectId.createFromHexString(value.orchestraId),
          conductorId: teacherIdStr,
          tenantId,
        });

        if (!orchestra) {
          throw new Error(
            'Not authorized to bulk create rehearsals for this orchestra'
          );
        }
      } catch (authErr) {
        console.error(`Authorization error: ${authErr.message}`);
        throw new Error(`Authorization failed: ${authErr.message}`);
      }
    }

    const {
      orchestraId,
      startDate,
      endDate,
      dayOfWeek,
      startTime,
      endTime,
      location,
      excludeDates = [],
      notes,
      schoolYearId,
    } = value;

    // Verify school year ID
    if (!schoolYearId) {
      console.error('Missing schoolYearId in bulk rehearsal data');
      throw new Error('School year ID is required for bulk creation');
    }

    // Validate input dates
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Invalid start or end date provided for bulk rehearsal creation');
    }

    // Generate dates for rehearsals using timezone-aware helper
    const utcDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates || []);

    console.log(`Generated ${utcDates.length} dates for rehearsals`);

    // Pre-validate all dates for conflicts before inserting any
    console.log(`Validating ${utcDates.length} dates for conflicts...`);
    const dateConflicts = [];
    for (const utcDate of utcDates) {
      const conflicts = await checkRehearsalConflicts(
        { date: utcDate, startTime, endTime, location, groupId: orchestraId },
        { context: options.context }
      );
      if (conflicts.hasConflicts) {
        dateConflicts.push({
          date: formatDate(utcDate, 'YYYY-MM-DD'),
          roomConflicts: conflicts.roomConflicts,
          teacherConflicts: conflicts.teacherConflicts,
        });
      }
    }

    if (dateConflicts.length > 0) {
      const err = new Error('Scheduling conflicts detected for bulk creation');
      err.code = 'BULK_CONFLICT';
      err.dateConflicts = dateConflicts;
      err.totalDates = utcDates.length;
      err.conflictingDates = dateConflicts.length;
      throw err;
    }

    // Create rehearsal documents with proper timezone handling
    const currentTime = now();
    const rehearsals = utcDates.map((utcDate) => ({
      groupId: orchestraId,
      type: 'תזמורת',
      date: utcDate, // Already in UTC from generateDatesForDayOfWeek
      dayOfWeek,
      startTime,
      endTime,
      location,
      attendance: { present: [], absent: [] },
      notes: notes || '',
      schoolYearId: schoolYearId,
      tenantId,
      createdAt: toUTC(currentTime),
      updatedAt: toUTC(currentTime),
    }));

    if (rehearsals.length === 0) {
      console.log('No rehearsal dates generated, returning empty result');
      return { insertedCount: 0, rehearsalIds: [] };
    }

    // Get rehearsal collection
    const rehearsalCollection = await getCollection('rehearsal');
    if (!rehearsalCollection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    // Insert all batches + update orchestra atomically
    const result = await withTransaction(async (session) => {
      const txResult = { insertedCount: 0, rehearsalIds: [] };

      // Insert rehearsals in batches
      const batchSize = 100;
      for (let i = 0; i < rehearsals.length; i += batchSize) {
        const batch = rehearsals.slice(i, i + batchSize);
        console.log(
          `Inserting batch ${i / batchSize + 1} with ${batch.length} rehearsals`
        );

        const batchResult = await rehearsalCollection.insertMany(batch, { session });
        console.log(`Batch inserted with result:`, batchResult);

        txResult.insertedCount += batchResult.insertedCount;
        const batchIds = Object.values(batchResult.insertedIds).map((id) =>
          id.toString()
        );
        txResult.rehearsalIds = [...txResult.rehearsalIds, ...batchIds];
      }

      // Update orchestra with new rehearsal IDs
      if (txResult.rehearsalIds.length > 0) {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          throw new Error('Database error: Failed to access orchestra collection');
        }

        console.log(
          `Updating orchestra ${orchestraId} with ${txResult.rehearsalIds.length} new rehearsal IDs`
        );

        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(orchestraId), tenantId },
          { $push: { rehearsalIds: { $each: txResult.rehearsalIds } } },
          { session }
        );
      }

      return txResult;
    });

    console.log(`Successfully created ${result.insertedCount} rehearsals`);
    return result;
  } catch (err) {
    console.error(`Failed to bulk create rehearsals: ${err}`);
    // Preserve custom error properties (e.g., BULK_CONFLICT with dateConflicts)
    if (err.code === 'BULK_CONFLICT') {
      throw err;
    }
    throw new Error(`Failed to bulk create rehearsals: ${err}`);
  }
}

async function bulkDeleteRehearsalsByOrchestra(orchestraId, userId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    // Input validation
    if (!orchestraId || !ObjectId.isValid(orchestraId)) {
      throw new Error('Invalid orchestra ID');
    }

    // Get collections
    const orchestraCollection = await getCollection('orchestra');
    const rehearsalCollection = await getCollection('rehearsal');
    const activityCollection = await getCollection('activity_attendance');

    if (!orchestraCollection || !rehearsalCollection) {
      throw new Error('Database error: Failed to access required collections');
    }

    // Verify orchestra exists (tenant-scoped)
    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(orchestraId),
      tenantId
    });

    if (!orchestra) {
      throw new Error('Orchestra not found');
    }

    // Authorization check - only admin or conductor of this orchestra can delete
    if (!isAdmin) {
      if (orchestra.conductorId !== userId.toString()) {
        throw new Error('Not authorized to delete rehearsals for this orchestra');
      }
    }

    // Get all rehearsals for this orchestra to collect IDs for cleanup (tenant-scoped)
    const rehearsals = await rehearsalCollection.find({
      groupId: orchestraId,
      tenantId
    }).toArray();

    const rehearsalIds = rehearsals.map(r => r._id.toString());

    // Use transaction for atomic data consistency
    const deletedCount = await withTransaction(async (session) => {
      // Delete all rehearsals for this orchestra (tenant-scoped)
      const deleteResult = await rehearsalCollection.deleteMany(
        { groupId: orchestraId, tenantId },
        { session }
      );

      // Archive (soft-delete) attendance records if collection exists
      if (activityCollection && rehearsalIds.length > 0) {
        await activityCollection.updateMany(
          {
            sessionId: { $in: rehearsalIds },
            activityType: 'תזמורת',
            tenantId
          },
          {
            $set: {
              isArchived: true,
              archivedAt: toUTC(now()),
              archivedReason: 'rehearsal_deleted',
            }
          },
          { session }
        );
      }

      // Update orchestra to remove rehearsal IDs
      await orchestraCollection.updateOne(
        { _id: ObjectId.createFromHexString(orchestraId), tenantId },
        { $set: { rehearsalIds: [] } },
        { session }
      );

      return deleteResult.deletedCount;
    });

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} rehearsals for orchestra ${orchestraId}`);

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} rehearsals for orchestra`
    };
  } catch (err) {
    console.error(`Failed to bulk delete rehearsals by orchestra: ${err}`);
    throw new Error(`Failed to bulk delete rehearsals by orchestra: ${err.message}`);
  }
}

async function bulkDeleteRehearsalsByDateRange(orchestraId, startDate, endDate, userId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    // Input validation
    if (!orchestraId || !ObjectId.isValid(orchestraId)) {
      throw new Error('Invalid orchestra ID');
    }

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    // Validate dates
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Invalid start or end date provided');
    }

    const startUTC = getStartOfDay(startDate);
    const endUTC = getEndOfDay(endDate);

    if (startUTC > endUTC) {
      throw new Error('Start date must be before or equal to end date');
    }

    // Get collections
    const orchestraCollection = await getCollection('orchestra');
    const rehearsalCollection = await getCollection('rehearsal');
    const activityCollection = await getCollection('activity_attendance');

    if (!orchestraCollection || !rehearsalCollection) {
      throw new Error('Database error: Failed to access required collections');
    }

    // Verify orchestra exists (tenant-scoped)
    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(orchestraId),
      tenantId
    });

    if (!orchestra) {
      throw new Error('Orchestra not found');
    }

    // Authorization check - only admin or conductor of this orchestra can delete
    if (!isAdmin) {
      if (orchestra.conductorId !== userId.toString()) {
        throw new Error('Not authorized to delete rehearsals for this orchestra');
      }
    }

    // Build query for rehearsals in date range for this orchestra (tenant-scoped)
    const deleteQuery = {
      groupId: orchestraId,
      tenantId,
      date: {
        $gte: startUTC,
        $lte: endUTC
      }
    };

    // Get rehearsals to be deleted for cleanup
    const rehearsalsToDelete = await rehearsalCollection.find(deleteQuery).toArray();
    const rehearsalIds = rehearsalsToDelete.map(r => r._id.toString());

    // Use transaction for atomic data consistency
    const deletedCount = await withTransaction(async (session) => {
      // Delete rehearsals in the date range for this orchestra
      const deleteResult = await rehearsalCollection.deleteMany(
        deleteQuery,
        { session }
      );

      // Archive (soft-delete) attendance records if collection exists
      if (activityCollection && rehearsalIds.length > 0) {
        await activityCollection.updateMany(
          {
            sessionId: { $in: rehearsalIds },
            activityType: 'תזמורת',
            tenantId
          },
          {
            $set: {
              isArchived: true,
              archivedAt: toUTC(now()),
              archivedReason: 'rehearsal_deleted',
            }
          },
          { session }
        );
      }

      // Update orchestra to remove deleted rehearsal IDs
      if (rehearsalIds.length > 0) {
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(orchestraId), tenantId },
          {
            $pull: { rehearsalIds: { $in: rehearsalIds } },
            $set: { lastModified: toUTC(now()) }
          },
          { session }
        );
      }

      return deleteResult.deletedCount;
    });

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} rehearsals for orchestra ${orchestraId} in date range ${startDate} to ${endDate}`);

    return {
      deletedCount,
      dateRange: { startDate, endDate },
      message: `Successfully deleted ${deletedCount} rehearsals between ${formatDate(startDate)} and ${formatDate(endDate)}`
    };
  } catch (err) {
    console.error(`Failed to bulk delete rehearsals by date range: ${err}`);
    throw new Error(`Failed to bulk delete rehearsals by date range: ${err.message}`);
  }
}

async function bulkUpdateRehearsalsByOrchestra(orchestraId, updateData, userId, isAdmin = false, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    // Input validation
    if (!orchestraId || !ObjectId.isValid(orchestraId)) {
      throw new Error('Invalid orchestra ID');
    }

    // Validate update data - check for forbidden fields
    const forbiddenFields = ['_id', 'createdAt', 'updatedAt', 'groupId', 'date', 'schoolYearId'];
    const updateKeys = Object.keys(updateData);
    const hasForbiddenField = updateKeys.some(key => forbiddenFields.includes(key));

    if (hasForbiddenField) {
      throw new Error(`Cannot update these fields in bulk operations: ${forbiddenFields.join(', ')}`);
    }

    // Validate time format if provided
    if (updateData.startTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.startTime)) {
      throw new Error('Start time must be in HH:MM format');
    }

    if (updateData.endTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.endTime)) {
      throw new Error('End time must be in HH:MM format');
    }

    // Get collections
    const orchestraCollection = await getCollection('orchestra');
    const rehearsalCollection = await getCollection('rehearsal');

    if (!orchestraCollection || !rehearsalCollection) {
      throw new Error('Database error: Failed to access required collections');
    }

    // Verify orchestra exists (tenant-scoped)
    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(orchestraId),
      tenantId
    });

    if (!orchestra) {
      throw new Error('Orchestra not found');
    }

    // Authorization check - only admin or conductor of this orchestra can update
    if (!isAdmin) {
      if (orchestra.conductorId !== userId.toString()) {
        throw new Error('Not authorized to update rehearsals for this orchestra');
      }
    }

    // Prepare update object with metadata
    const updateObject = {
      ...updateData,
      updatedAt: toUTC(now())
    };

    // Use transaction for atomic data consistency
    const updatedCount = await withTransaction(async (session) => {
      // Update all rehearsals for this orchestra (tenant-scoped)
      const updateResult = await rehearsalCollection.updateMany(
        { groupId: orchestraId, tenantId },
        { $set: updateObject },
        { session }
      );

      // Update orchestra's last modified timestamp
      await orchestraCollection.updateOne(
        { _id: ObjectId.createFromHexString(orchestraId), tenantId },
        { $set: { lastModified: toUTC(now()) } },
        { session }
      );

      return updateResult.modifiedCount;
    });

    // Logging
    console.log(`User ${userId} updated ${updatedCount} rehearsals for orchestra ${orchestraId}`);

    return {
      updatedCount,
      message: `Successfully updated ${updatedCount} rehearsals for orchestra`
    };
  } catch (err) {
    console.error(`Failed to bulk update rehearsals by orchestra: ${err}`);
    throw new Error(`Failed to bulk update rehearsals by orchestra: ${err.message}`);
  }
}

async function updateAttendance(
  rehearsalId,
  attendanceData,
  teacherId,
  isAdmin = false,
  options = {}
) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId);
    const { error, value } = validateAttendance(attendanceData);
    if (error) throw error;

    const { records } = value;

    // Load the rehearsal to get details (tenant-scoped via getRehearsalById)
    const rehearsal = await getRehearsalById(rehearsalId, options);

    // Load orchestra for authorization and membership validation
    const orchestraCollection = await getCollection('orchestra');
    if (!orchestraCollection) {
      throw new Error('Database error: Failed to access orchestra collection');
    }

    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(rehearsal.groupId),
      tenantId,
    });

    if (!orchestra) {
      throw new Error(`Orchestra with id ${rehearsal.groupId} not found`);
    }

    // Authorization check: admin or conductor
    if (!isAdmin) {
      if (orchestra.conductorId !== teacherId.toString()) {
        throw new Error('Not authorized to update attendance for this rehearsal');
      }
    }

    // Membership validation: every studentId must be in orchestra.memberIds
    const memberIdSet = new Set((orchestra.memberIds || []).map(id => id.toString()));
    const nonMemberIds = records
      .map(r => r.studentId)
      .filter(sid => !memberIdSet.has(sid));

    if (nonMemberIds.length > 0) {
      const err = new Error('Students not in orchestra membership');
      err.code = 'MEMBERSHIP_VALIDATION';
      err.invalidStudentIds = nonMemberIds;
      throw err;
    }

    // Build attendance cache (denormalized for rehearsal document)
    const attendanceCache = {
      present: records.filter(r => r.status === 'הגיע/ה').map(r => r.studentId),
      absent: records.filter(r => r.status === 'לא הגיע/ה').map(r => r.studentId),
      late: records.filter(r => r.status === 'איחור').map(r => r.studentId),
    };

    // Build activity_attendance documents (canonical source)
    const currentTime = toUTC(now());
    const activityDocs = records.map(record => ({
      studentId: record.studentId,
      activityType: rehearsal.type, // 'תזמורת' or 'הרכב'
      groupId: rehearsal.groupId,
      sessionId: rehearsalId,
      date: rehearsal.date,
      status: record.status,
      notes: record.notes || '',
      teacherId: teacherId.toString(),
      tenantId,
      createdAt: currentTime,
    }));

    // Get collections before transaction
    const rehearsalCollection = await getCollection('rehearsal');
    if (!rehearsalCollection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }
    const activityCollection = await getCollection('activity_attendance');
    if (!activityCollection) {
      throw new Error('Database error: Failed to access activity_attendance collection');
    }

    // Transactional write: all three operations are atomic
    const result = await withTransaction(async (session) => {
      // 1. Delete existing activity_attendance records for this session
      await activityCollection.deleteMany(
        {
          sessionId: rehearsalId,
          activityType: rehearsal.type,
          tenantId,
        },
        { session }
      );

      // 2. Insert new activity_attendance records (canonical source)
      if (activityDocs.length > 0) {
        await activityCollection.insertMany(activityDocs, { session });
      }

      // 3. Update rehearsal.attendance cache (derived from canonical)
      const updatedRehearsal = await rehearsalCollection.findOneAndUpdate(
        { _id: ObjectId.createFromHexString(rehearsalId), tenantId },
        {
          $set: {
            attendance: attendanceCache,
            updatedAt: currentTime,
          },
        },
        { returnDocument: 'after', session }
      );

      if (!updatedRehearsal) {
        throw new Error(`Rehearsal with id ${rehearsalId} not found`);
      }

      return updatedRehearsal;
    });

    return result;
  } catch (err) {
    if (err.code === 'MEMBERSHIP_VALIDATION') throw err;
    console.error(`Error updating attendance ${rehearsalId}: ${err.message}`);
    throw new Error(`Error updating attendance ${rehearsalId}: ${err.message}`);
  }
}

// Helper function to generate dates for a specific day of the week
// @deprecated Use generateDatesForDayOfWeek from dateHelpers instead
function _generateDatesForDayOfWeek(
  startDate,
  endDate,
  dayOfWeek,
  excludesDates = []
) {
  // Use the new timezone-aware date generation
  return generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludesDates);
}

// Helper function to build query criteria from filter
function _buildCriteria(filterBy) {
  const criteria = {};

  if (filterBy.groupId) {
    criteria.groupId = filterBy.groupId;
  }

  if (filterBy.type) {
    criteria.type = filterBy.type;
  }

  if (filterBy.fromDate) {
    if (!isValidDate(filterBy.fromDate)) {
      throw new Error('Invalid fromDate provided in rehearsal filter');
    }
    criteria.date = criteria.date || {};
    criteria.date.$gte = getStartOfDay(filterBy.fromDate);
    console.log('Date filter applied:', {
      fromDate: filterBy.fromDate,
      converted: getStartOfDay(filterBy.fromDate),
    });
  }

  if (filterBy.toDate) {
    if (!isValidDate(filterBy.toDate)) {
      throw new Error('Invalid toDate provided in rehearsal filter');
    }
    criteria.date = criteria.date || {};
    criteria.date.$lte = getEndOfDay(filterBy.toDate);
  }

  // isActive filtering removed - all records are now active (hard delete implementation)

  return criteria;
}
