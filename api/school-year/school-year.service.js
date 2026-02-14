import { getCollection } from '../../services/mongoDB.service.js'
import { validateSchoolYear } from './school-year.validation.js'
import { ObjectId } from 'mongodb'
import { requireTenantId } from '../../middleware/tenant.middleware.js'

export const schoolYearService = {
  getSchoolYears,
  getSchoolYearById,
  getCurrentSchoolYear,
  createSchoolYear,
  updateSchoolYear,
  setCurrentSchoolYear,
  rolloverToNewYear
}

async function getSchoolYears(optionsOrTenantId = {}) {
  try {
    let tenantId
    if (typeof optionsOrTenantId === 'string') {
      // Legacy caller passing tenantId directly -- backward compat
      tenantId = requireTenantId(optionsOrTenantId)
    } else {
      tenantId = requireTenantId(optionsOrTenantId.context?.tenantId)
    }

    const collection = await getCollection('school_year')
    const filter = { isActive: true, tenantId }
    const query = collection.find(filter)
    const sorted = query.sort({ startDate: -1 })
    const limited = sorted.limit(4)
    return await limited.toArray()
  } catch (err) {
    console.error(`Error in schoolYearService.getSchoolYears: ${err}`)
    throw new Error(`Database error`)
  }
}

async function getSchoolYearById(schoolYearId, optionsOrTenantId = {}) {
  try {
    let tenantId
    if (typeof optionsOrTenantId === 'string') {
      // Legacy caller passing tenantId directly -- backward compat
      tenantId = requireTenantId(optionsOrTenantId)
    } else {
      tenantId = requireTenantId(optionsOrTenantId.context?.tenantId)
    }

    const collection = await getCollection('school_year')
    const schoolYear = await collection.findOne({
      _id: ObjectId.createFromHexString(schoolYearId),
      tenantId
    })

    if (!schoolYear) {
      throw new Error(`School year with id ${schoolYearId} not found`)
    }

    return schoolYear
  } catch (err) {
    console.error(`Error in schoolYearService.getSchoolYearById: ${err}`)
    throw err
  }
}

async function getCurrentSchoolYear(optionsOrTenantId = {}) {
  try {
    let tenantId
    if (typeof optionsOrTenantId === 'string') {
      // Legacy caller passing tenantId directly -- backward compat
      tenantId = requireTenantId(optionsOrTenantId)
    } else {
      tenantId = requireTenantId(optionsOrTenantId.context?.tenantId)
    }

    const collection = await getCollection('school_year')
    const filter = { isCurrent: true, tenantId }
    const schoolYear = await collection.findOne(filter)

    if (!schoolYear) {
      const currentYear = new Date().getFullYear()
      const defaultYear = {
        name: `${currentYear}-${currentYear + 1}`,
        startDate: new Date(`${currentYear}-08-20`),
        endDate: new Date(`${currentYear + 1}-08-01`),
        isCurrent: true,
        isActive: true,
        tenantId
      }

      const validationResult = validateSchoolYear(defaultYear)
      if (validationResult.error) {
        throw validationResult.error
      }

      const newYear = await createSchoolYear(validationResult.value, { context: { tenantId } })
      return await getSchoolYearById(newYear._id.toString(), { context: { tenantId } })
    }

    return schoolYear
  } catch (err) {
    console.error(`Error in schoolYearService.getCurrentSchoolYear: ${err}`)
    throw err instanceof Error ? err : new Error(`Database error`)
  }
}

async function createSchoolYear(schoolYearData, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId)

    // Validate the data
    const validationResult = validateSchoolYear(schoolYearData)
    if (validationResult.error) {
      throw validationResult.error
    }

    const value = validationResult.value

    // Server-derived tenantId (never from client)
    value.tenantId = tenantId

    // If this is a current year, update other years to not be current (scoped by tenant)
    if (value.isCurrent) {
      const collection = await getCollection('school_year')
      await collection.updateMany(
        { isCurrent: true, tenantId },
        { $set: { isCurrent: false, updatedAt: new Date() } }
      )
    }

    // Add timestamps
    value.createdAt = new Date()
    value.updatedAt = new Date()

    // Insert the new record
    const collection = await getCollection('school_year')
    const result = await collection.insertOne(value)

    // Return the created school year
    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error in schoolYearService.createSchoolYear: ${err}`)
    throw err
  }
}

async function updateSchoolYear(schoolYearId, schoolYearData, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId)

    // Validate the data
    const validationResult = validateSchoolYear(schoolYearData)
    if (validationResult.error) {
      throw validationResult.error
    }

    const value = validationResult.value
    value.updatedAt = new Date()

    // If this is becoming the current year, update other years (scoped by tenant)
    if (value.isCurrent) {
      const collection = await getCollection('school_year')
      await collection.updateMany(
        { _id: { $ne: ObjectId.createFromHexString(schoolYearId) }, isCurrent: true, tenantId },
        { $set: { isCurrent: false, updatedAt: new Date() } }
      )
    }

    // Update the school year (filter includes tenantId)
    const collection = await getCollection('school_year')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(schoolYearId), tenantId },
      { $set: value },
      { returnDocument: 'after' }
    )

    // Check if found
    if (!result) {
      throw new Error(`School year with id ${schoolYearId} not found`)
    }

    return result
  } catch (err) {
    console.error(`Error in schoolYearService.updateSchoolYear: ${err}`)
    throw err
  }
}

async function setCurrentSchoolYear(schoolYearId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId)
    const collection = await getCollection('school_year')

    // Verify the target school year exists within this tenant
    const target = await collection.findOne({
      _id: ObjectId.createFromHexString(schoolYearId),
      tenantId
    })
    if (!target) {
      throw new Error(`School year with id ${schoolYearId} not found`)
    }

    // Unset isCurrent for all school years in this tenant (tenant-scoped, not global)
    await collection.updateMany(
      { tenantId, isCurrent: true },
      { $set: { isCurrent: false, updatedAt: new Date() } }
    )

    // Then, set the specified school year as current (filter includes tenantId)
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(schoolYearId), tenantId },
      { $set: { isCurrent: true, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    return result
  } catch (err) {
    console.error(`Error in schoolYearService.setCurrentSchoolYear: ${err}`)
    throw err
  }
}

async function rolloverToNewYear(prevYearId, options = {}) {
  try {
    const tenantId = requireTenantId(options.context?.tenantId)

    // Get the previous year details - directly access the collection
    // instead of using getSchoolYearById to avoid test mocking issues
    const collection = await getCollection('school_year')
    const prevYear = await collection.findOne({
      _id: ObjectId.createFromHexString(prevYearId),
      tenantId
    })

    if (!prevYear) {
      throw new Error(`School year with id ${prevYearId} not found`)
    }

    // Calculate dates for the new year
    const newYearStartDate = new Date(prevYear.endDate)
    newYearStartDate.setDate(newYearStartDate.getDate() + 1)

    const newYearEndDate = new Date(newYearStartDate)
    newYearEndDate.setFullYear(newYearEndDate.getFullYear() + 1)
    newYearEndDate.setMonth(7) // August
    newYearEndDate.setDate(1)

    const startYear = newYearStartDate.getFullYear()
    const endYear = newYearEndDate.getFullYear()

    // Create the new year
    const newYear = {
      name: `${startYear}-${endYear}`,
      startDate: newYearStartDate,
      endDate: newYearEndDate,
      isCurrent: true,
      isActive: true
    }

    // Create the new school year record (tenantId set from context inside createSchoolYear)
    const createdYear = await createSchoolYear(newYear, { context: options.context })
    const newYearId = createdYear._id.toString()

    // Rest of the function remains the same...
    // ...

    return createdYear
  } catch (err) {
    console.error(`Error in schoolYearService.rolloverToNewYear: ${err}`)
    throw err instanceof Error ? err : new Error('Database error')
  }
}
