// IMPORTANT: Import this file AFTER calling patchMongoDBService(db) from setup.js.
// patchMongoDBService uses vi.doMock to override the MongoDB service module.
// ESM static imports resolve at load time, so the mock MUST be registered
// before this file (and all the route/middleware modules it imports) are loaded.

/**
 * Express app builder for tenant isolation tests.
 *
 * Builds a real Express app with the actual middleware chain from server.js:
 *   authenticateToken -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest -> routes
 *
 * This is NOT a mock. Real middleware runs real logic against the
 * MongoDB Memory Server database via the patched mongoDB.service.js.
 *
 * Usage (inside beforeAll, AFTER patchMongoDBService):
 *   const { createTestApp } = await import('./helpers/test-app.js');
 *   const app = createTestApp();
 */

import express from 'express';
import cookieParser from 'cookie-parser';

// Real middleware (not mocked)
import { authenticateToken } from '../../../middleware/auth.middleware.js';
import { buildContext, enforceTenant, stripTenantId } from '../../../middleware/tenant.middleware.js';
import { addSchoolYearToRequest } from '../../../middleware/school-year.middleware.js';
import { errorHandler } from '../../../middleware/error.handler.js';

// Route modules — all tenant-scoped routes from server.js
import studentRoutes from '../../../api/student/student.route.js';
import teacherRoutes from '../../../api/teacher/teacher.route.js';
import orchestraRoutes from '../../../api/orchestra/orchestra.route.js';
import rehearsalRoutes from '../../../api/rehearsal/rehearsal.route.js';
import theoryRoutes from '../../../api/theory/theory.route.js';
import bagrutRoutes from '../../../api/bagrut/bagrut.route.js';
import schoolYearRoutes from '../../../api/school-year/school-year.route.js';
import hoursSummaryRoutes from '../../../api/hours-summary/hours-summary.route.js';
import attendanceRoutes from '../../../api/schedule/attendance.routes.js';
import analyticsRoutes from '../../../api/analytics/attendance.routes.js';
import scheduleRoutes from '../../../api/schedule/schedule.route.js';

// Exempt routes (no enforceTenant)
import authRoutes from '../../../api/auth/auth.route.js';
import healthRoutes from '../../../api/health/health.route.js';

/**
 * Create an Express app instance matching server.js middleware structure.
 * Does NOT call app.listen() — use with supertest.
 *
 * @returns {import('express').Express}
 */
export function createTestApp() {
  const app = express();

  // Body parsing + cookies (same as server.js)
  app.use(express.json());
  app.use(cookieParser());

  // JSON content type for /api routes (same as server.js)
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // ── Exempt routes (no enforceTenant) ────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/health', healthRoutes);
  app.get('/api/config', (req, res) => {
    res.json({
      apiUrl: `http://localhost:3001/api`,
      environment: 'test',
    });
  });

  // ── Tenant-scoped routes (full middleware chain) ────────────────────────
  // Chain: authenticateToken -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest -> routes
  const tenantChain = [authenticateToken, buildContext, enforceTenant, stripTenantId, addSchoolYearToRequest];

  app.use('/api/student', ...tenantChain, studentRoutes);
  app.use('/api/teacher', ...tenantChain, teacherRoutes);
  app.use('/api/orchestra', ...tenantChain, orchestraRoutes);
  app.use('/api/rehearsal', ...tenantChain, rehearsalRoutes);
  app.use('/api/theory', ...tenantChain, theoryRoutes);
  app.use('/api/bagrut', ...tenantChain, bagrutRoutes);
  app.use('/api/school-year', ...tenantChain, schoolYearRoutes);
  app.use('/api/hours-summary', ...tenantChain, hoursSummaryRoutes);
  app.use('/api/attendance', ...tenantChain, attendanceRoutes);
  app.use('/api/analytics', ...tenantChain, analyticsRoutes);
  app.use('/api/schedule', ...tenantChain, scheduleRoutes);

  // ── Error handler (same as server.js) ──────────────────────────────────
  app.use(errorHandler);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
    });
  });

  return app;
}
