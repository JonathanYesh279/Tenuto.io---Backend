/**
 * Unit tests for stripTenantId middleware.
 *
 * These are pure middleware unit tests — no MongoDB Memory Server needed.
 * Each test builds a minimal Express app with the real stripTenantId middleware
 * and verifies correct behavior for mismatch rejection, silent stripping,
 * and pass-through cases.
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { stripTenantId } from '../../../middleware/tenant.middleware.js';

function buildApp(contextMiddleware) {
  const app = express();
  app.use(express.json());

  if (contextMiddleware) {
    app.use(contextMiddleware);
  }

  app.use(stripTenantId);

  // Handler that echoes back body and query for inspection
  app.post('/test', (req, res) => {
    res.status(200).json({
      body: req.body,
      query: req.query,
    });
  });

  app.get('/test', (req, res) => {
    res.status(200).json({
      body: req.body,
      query: req.query,
    });
  });

  return app;
}

describe('stripTenantId middleware', () => {
  it('returns 400 TENANT_MISMATCH when body.tenantId differs from context', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { tenantId: 'server-id', userId: 'test-user' };
      next();
    });

    const res = await request(app)
      .post('/test')
      .send({ tenantId: 'different-id', name: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TENANT_MISMATCH');
  });

  it('silently strips matching tenantId from body', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { tenantId: 'server-id', userId: 'test-user' };
      next();
    });

    const res = await request(app)
      .post('/test')
      .send({ tenantId: 'server-id', name: 'test' });

    expect(res.status).toBe(200);
    // tenantId should be stripped from body
    expect(res.body.body.tenantId).toBeUndefined();
    // Other fields should remain
    expect(res.body.body.name).toBe('test');
  });

  it('strips tenantId from query params', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { tenantId: 'server-id', userId: 'test-user' };
      next();
    });

    const res = await request(app)
      .get('/test?tenantId=server-id&other=value');

    expect(res.status).toBe(200);
    // tenantId should be stripped from query
    expect(res.body.query.tenantId).toBeUndefined();
    // Other query params should remain
    expect(res.body.query.other).toBe('value');
  });

  it('passes through when no tenantId in body or query', async () => {
    const app = buildApp((req, res, next) => {
      req.context = { tenantId: 'server-id', userId: 'test-user' };
      next();
    });

    const res = await request(app)
      .post('/test')
      .send({ name: 'test', value: 42 });

    expect(res.status).toBe(200);
    expect(res.body.body.name).toBe('test');
    expect(res.body.body.value).toBe(42);
  });
});
