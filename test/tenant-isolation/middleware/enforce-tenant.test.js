/**
 * Unit tests for enforceTenant middleware.
 *
 * These are pure middleware unit tests — no MongoDB Memory Server needed.
 * Each test builds a minimal Express app with the real enforceTenant middleware
 * and verifies the expected HTTP status and error codes.
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { enforceTenant } from '../../../middleware/tenant.middleware.js';

function buildApp(contextMiddleware) {
  const app = express();
  app.use(express.json());

  if (contextMiddleware) {
    app.use(contextMiddleware);
  }

  app.use(enforceTenant);

  app.get('/test', (req, res) => {
    res.status(200).json({ success: true });
  });

  return app;
}

describe('enforceTenant middleware', () => {
  it('returns 403 MISSING_TENANT when req.context has no tenantId', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { userId: 'test-user' };
      next();
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MISSING_TENANT');
    expect(res.body.success).toBe(false);
  });

  it('passes through when req.context.tenantId is present', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { tenantId: 'test-tenant', userId: 'test-user' };
      next();
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 MISSING_TENANT when req.context is undefined', async () => {
    // No context middleware — req.context is undefined
    const app = buildApp(null);

    const res = await request(app).get('/test');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MISSING_TENANT');
    expect(res.body.success).toBe(false);
  });
});
