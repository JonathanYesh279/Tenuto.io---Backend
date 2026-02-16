/**
 * Test helpers for tenant context.
 * After Phase 2 tenant hardening, all service functions require
 * a context object with tenantId. These helpers provide standard
 * test context objects.
 */

export const TEST_TENANT_ID = 'test-tenant-id'
export const TEST_TEACHER_ID = '6579e36c83c8b3a5c2df8a01'
export const TEST_ADMIN_ID = '6579e36c83c8b3a5c2df8a02'

/**
 * Creates a standard test context for service calls.
 * @param {object} overrides - Optional overrides for context fields
 * @returns {{ context: { tenantId: string, userId: string, roles: string[] } }}
 */
export function createTestContext(overrides = {}) {
  return {
    context: {
      tenantId: TEST_TENANT_ID,
      userId: TEST_TEACHER_ID,
      roles: ['מנהל'],
      ...overrides,
    }
  }
}

/**
 * Creates a teacher-role test context.
 * @param {string} teacherId - Optional teacher ID
 * @returns {{ context: { tenantId: string, userId: string, roles: string[] } }}
 */
export function createTeacherContext(teacherId = TEST_TEACHER_ID) {
  return createTestContext({
    userId: teacherId,
    roles: ['מורה'],
  })
}

/**
 * Creates an admin-role test context.
 * @param {string} adminId - Optional admin ID
 * @returns {{ context: { tenantId: string, userId: string, roles: string[] } }}
 */
export function createAdminContext(adminId = TEST_ADMIN_ID) {
  return createTestContext({
    userId: adminId,
    roles: ['מנהל'],
  })
}

/**
 * Creates a mock request object with tenant context attached.
 * Useful for controller tests that need req.context.
 * @param {object} overrides - Optional overrides for req fields
 * @returns {object} Mock request object
 */
export function createMockReq(overrides = {}) {
  return {
    context: {
      tenantId: TEST_TENANT_ID,
      userId: TEST_TEACHER_ID,
      roles: ['מנהל'],
    },
    teacher: {
      _id: { toString: () => TEST_TEACHER_ID },
    },
    loggedinUser: {
      _id: TEST_TEACHER_ID,
      roles: ['מנהל'],
      displayName: 'Test Admin',
    },
    params: {},
    query: {},
    body: {},
    ...overrides,
  }
}
