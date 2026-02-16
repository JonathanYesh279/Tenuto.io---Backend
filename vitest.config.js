import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.idea/**',
      '.git/**',
      '.cache/**',
      '.claude/**',
      '.planning/**',
      'public/**',
    ],
    setupFiles: ['./test/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'scripts/',
        'migrations/',
        '**/*.config.js',
        '**/*.test.js',
        '**/*.spec.js'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 20000, // 20 seconds for setup/teardown
    teardownTimeout: 10000, // 10 seconds for cleanup
    root: '.',
    pool: 'forks', // Use forks for better isolation
    maxConcurrency: 3, // Limit concurrent tests to prevent resource exhaustion on WSL2
    minWorkers: 1,
    maxWorkers: 2, // Reduced for WSL2 I/O stability
    env: {
      NODE_ENV: 'test',
      USE_MEMORY_DB: 'false',
      RESET_DB_AFTER_EACH: 'false',
      LOG_LEVEL: 'warn' // Reduce log noise during tests
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
