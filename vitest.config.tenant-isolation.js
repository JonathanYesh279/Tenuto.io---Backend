import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest configuration for Tenant Isolation tests.
 *
 * CRITICAL: This config has NO setupFiles.
 * The global test/setup.js mocks out requireTenantId, buildScopedFilter, JWT,
 * and bcrypt — which would defeat the purpose of tenant isolation testing.
 * Each test file imports test/tenant-isolation/setup.js directly to get
 * a real MongoDB Memory Server connection with real middleware.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/tenant-isolation/**/*.test.js'],
    // NO setupFiles — intentionally omitted to avoid global mocks
    pool: 'vmThreads',
    maxConcurrency: 1,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      ACCESS_TOKEN_SECRET: 'test-access-secret',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
})
