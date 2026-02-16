import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { MongoClient, ObjectId } from 'mongodb'
import { config } from 'dotenv'
import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './setup/mongodb-memory-server.js'

// Load environment variables
config({ path: '.env.test' })

// Global test database instance
let testDatabase = null

// Mock MongoDB service when NOT using MongoDB Memory Server.
// The mock is active for unit tests and the default vitest config (USE_MEMORY_DB=false).
// Integration tests that set USE_MEMORY_DB=true get real MongoDB Memory Server instead.
const shouldUseMockDB = process.env.TEST_TYPE === 'unit' || process.env.USE_MEMORY_DB !== 'true'

if (shouldUseMockDB) {
  vi.mock('../services/mongoDB.service.js', () => {
    const db = {
      collection: vi.fn(() => ({
        find: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          sort: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
        findOne: vi.fn(() => Promise.resolve(null)),
        insertOne: vi.fn(() => Promise.resolve({ insertedId: new ObjectId() })),
        insertMany: vi.fn(() => Promise.resolve({ insertedCount: 1 })),
        updateOne: vi.fn(() => Promise.resolve({ modifiedCount: 1 })),
        updateMany: vi.fn(() => Promise.resolve({ modifiedCount: 1 })),
        findOneAndUpdate: vi.fn(() => Promise.resolve({})),
        deleteOne: vi.fn(() => Promise.resolve({ deletedCount: 1 })),
        deleteMany: vi.fn(() => Promise.resolve({ deletedCount: 1 })),
        countDocuments: vi.fn(() => Promise.resolve(0)),
        replaceOne: vi.fn(() => Promise.resolve({ modifiedCount: 1 })),
        client: {
          startSession: vi.fn(() => ({
            withTransaction: vi.fn(async (callback) => await callback()),
            endSession: vi.fn(() => Promise.resolve()),
          }))
        }
      })),
    }

    return {
      initializeMongoDB: vi.fn(() => Promise.resolve()),
      getDB: vi.fn(() => db),
      getCollection: vi.fn(() => db.collection()),
    }
  })
}

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mocked-token'),
    verify: vi.fn(() => ({ _id: 'mock-user-id', roles: ['מנהל'] })),
  },
  sign: vi.fn(() => 'mocked-token'),
  verify: vi.fn(() => ({ _id: 'mock-user-id', roles: ['מנהל'] })),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(() => Promise.resolve(true)),
    hash: vi.fn(() => Promise.resolve('hashed-password')),
  },
  compare: vi.fn(() => Promise.resolve(true)),
  hash: vi.fn(() => Promise.resolve('hashed-password')),
}))

// Mock tenant middleware — in unit tests, bypass tenant guard
// and return a default test tenant ID. Integration tests that need
// real tenant enforcement should use vitest.config.phase2.js (no setupFiles).
vi.mock('../middleware/tenant.middleware.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    requireTenantId: vi.fn((tenantId) => {
      // If tenantId is provided, return it (normal behavior).
      // If not provided, return a default test tenant instead of throwing.
      return tenantId || 'test-tenant-id'
    }),
  }
})

// Mock query scoping — in unit tests, buildScopedFilter passes through
// the base filter unchanged so existing test assertions still work.
// Integration tests that need real scoping use vitest.config.phase2.js.
vi.mock('../utils/queryScoping.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    buildScopedFilter: vi.fn((collection, baseFilter, context) => {
      // Pass through the base filter unchanged for unit test compatibility
      return { ...baseFilter }
    }),
    canAccessStudent: vi.fn(() => true),
    canAccessOwnResource: vi.fn(() => true),
  }
})

// Mock other services that might interfere with tests
vi.mock('../services/emailService.js', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendInvitationEmail: vi.fn(() => Promise.resolve({ success: true })),
}))

// Global test setup and teardown
beforeAll(async () => {
  console.log('Starting global test setup...')
  
  // Setup MongoDB Memory Server for integration and performance tests
  if (process.env.USE_MEMORY_DB === 'true') {
    try {
      testDatabase = await setupTestDatabase()
      console.log('MongoDB Memory Server started for tests')
      
      // Mock the MongoDB service to use our test database
      vi.doMock('../services/mongoDB.service.js', () => ({
        initializeMongoDB: vi.fn(() => Promise.resolve()),
        getDB: vi.fn(() => testDatabase.db),
        getCollection: vi.fn((name) => testDatabase.db.collection(name)),
      }))
    } catch (error) {
      console.error('Failed to setup test database:', error)
      throw new Error(
        `Failed to setup test database: ${error?.message || error}`,
      );
    }
  }
  
  console.log('Global test setup completed')
})

afterAll(async () => {
  console.log('Starting global test teardown...')
  
  // Cleanup MongoDB Memory Server
  if (testDatabase) {
    await teardownTestDatabase()
    testDatabase = null
    console.log('MongoDB Memory Server stopped')
  }
  
  console.log('Global test teardown completed')
})

afterEach(async () => {
  // Clear mock call history but keep mock implementations intact.
  // Using clearAllMocks (not resetAllMocks) because resetAllMocks
  // strips mock implementations (mockResolvedValue, etc.) which breaks
  // module-level mocks like requireTenantId and buildScopedFilter.
  vi.clearAllMocks()
  
  // Reset test database if using MongoDB Memory Server
  if (testDatabase && process.env.RESET_DB_AFTER_EACH === 'true') {
    try {
      await resetTestDatabase()
    } catch (error) {
      console.warn('Failed to reset test database:', error.message)
    }
  }
})

// Export test database for use in integration tests
export { testDatabase }
