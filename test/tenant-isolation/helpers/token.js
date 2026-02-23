/**
 * JWT minting helper for tenant isolation tests.
 *
 * Produces real JWT tokens (not mocks) using the test secret
 * defined in vitest.config.tenant-isolation.js env vars.
 *
 * Usage:
 *   import { makeToken } from './helpers/token.js';
 *   const token = makeToken(teacherA);
 *   const res = await request(app).get('/api/student').set('Authorization', `Bearer ${token}`);
 */

import jwt from 'jsonwebtoken';

/**
 * Mint a real JWT access token for the given teacher fixture.
 *
 * @param {object} teacher - A teacher fixture from two-tenant-seed.js
 * @returns {string} Signed JWT token
 */
export function makeToken(teacher) {
  const payload = {
    _id: teacher._id.toString(),
    tenantId: teacher.tenantId,
    roles: teacher.roles,
    email: teacher.credentials.email,
    firstName: teacher.personalInfo.firstName,
    lastName: teacher.personalInfo.lastName,
    version: teacher.credentials.tokenVersion || 0,
  };

  return jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET || 'test-access-secret',
    { expiresIn: '1h' }
  );
}
