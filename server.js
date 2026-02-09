import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'net';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { initializeMongoDB } from './services/mongoDB.service.js';
import path from 'path';
import fileRoutes from './api/file/file.route.js';
import { STORAGE_MODE } from './services/fileStorage.service.js';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { authenticateToken } from './middleware/auth.middleware.js';
import { addSchoolYearToRequest } from './middleware/school-year.middleware.js';
import { buildContext } from './middleware/tenant.middleware.js';
import { validateEnvironment } from './config/validateEnv.js';
import logger from './services/logger.service.js';
import healthRoutes from './api/health/health.route.js';

import schoolYearRoutes from './api/school-year/school-year.route.js';
import studentRoutes from './api/student/student.route.js';
import teacherRoutes from './api/teacher/teacher.route.js';
import theoryRoutes from './api/theory/theory.route.js';
import authRoutes from './api/auth/auth.route.js';
import orchestraRoutes from './api/orchestra/orchestra.route.js';
import rehearsalRoutes from './api/rehearsal/rehearsal.route.js';
import bagrutRoutes from './api/bagrut/bagrut.route.js';
import scheduleRoutes from './api/schedule/schedule.route.js';
import attendanceRoutes from './api/schedule/attendance.routes.js';
import timeBlockRoutes from './api/schedule/time-block.route.js';
import analyticsRoutes from './api/analytics/attendance.routes.js';
import adminValidationRoutes from './api/admin/consistency-validation.route.js';
import dateMonitoringRoutes from './api/admin/date-monitoring.route.js';
import pastActivitiesRoutes from './api/admin/past-activities.route.js';
import cascadeDeletionRoutes from './api/admin/cascade-deletion.routes.js';
import cleanupRoutes from './api/admin/cleanup.route.js';
import lessonRoutes from './api/lesson/lesson.route.js';
import { invitationController } from './api/teacher/invitation.controller.js';
import tenantRoutes from './api/tenant/tenant.route.js';
import hoursSummaryRoutes from './api/hours-summary/hours-summary.route.js';
import importRoutes from './api/import/import.route.js';
import exportRoutes from './api/export/export.route.js';
import superAdminRoutes from './api/super-admin/super-admin.route.js';
import { cascadeSystemInitializer } from './services/cascadeSystemInitializer.js';
import { errorHandler } from './middleware/error.handler.js';

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const app = express();

// Enable trust proxy for production (fixes rate limiting behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const corsOptions = {
  origin: NODE_ENV === 'production'
    ? [
        'https://rmc-music.org',
        'https://www.rmc-music.org',
        'http://rmc-music.org',
        'http://www.rmc-music.org',
        FRONTEND_URL // Keep existing FRONTEND_URL for backward compatibility
      ].filter(Boolean) // Remove any undefined values
    : [
        'http://localhost:5173',
        'http://172.29.139.184:5173',
        'http://10.0.2.2:5173', // Android emulator
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/, // Local network IPs
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/, // Private network IPs
        /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/ // Private network IPs
      ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

if (STORAGE_MODE === 'local') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Configure Helmet with proper CSP for Vite/ES modules and Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://rmc-music.org", "wss://rmc-music.org"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(mongoSanitize());

// Initialize MongoDB (moved to startup sequence below for better error handling)

// Direct invitation routes (no auth required)

// API configuration endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    apiUrl: process.env.API_URL || `https://${req.get('host')}/api`,
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use(
  '/api/tenant',
  authenticateToken,
  buildContext,
  tenantRoutes
);
app.use(
  '/api/student',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  studentRoutes
);
app.use(
  '/api/teacher',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  teacherRoutes
);
// Add plural route for frontend compatibility
app.use(
  '/api/teachers',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  teacherRoutes
);
app.use(
  '/api/orchestra',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  orchestraRoutes
);
app.use(
  '/api/rehearsal',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  rehearsalRoutes
);
app.use('/api/theory', authenticateToken, buildContext, addSchoolYearToRequest, theoryRoutes);
app.use('/api/bagrut', authenticateToken, buildContext, addSchoolYearToRequest, bagrutRoutes);
app.use(
  '/api/school-year',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  schoolYearRoutes
);
app.use(
  '/api/schedule',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  scheduleRoutes
);
app.use(
  '/api',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  timeBlockRoutes
);
app.use(
  '/api/attendance',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  attendanceRoutes
);
app.use(
  '/api/analytics',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  analyticsRoutes
);
app.use(
  '/api/admin/consistency-validation',
  authenticateToken,
  buildContext,
  adminValidationRoutes
);
app.use(
  '/api/admin/date-monitoring',
  authenticateToken,
  buildContext,
  dateMonitoringRoutes
);
app.use(
  '/api/admin/past-activities',
  authenticateToken,
  buildContext,
  pastActivitiesRoutes
);
app.use(
  '/api/admin',
  authenticateToken,
  buildContext,
  cascadeDeletionRoutes
);
app.use(
  '/api/admin/cleanup',
  authenticateToken,
  buildContext,
  cleanupRoutes
);
app.use('/api/files', authenticateToken, buildContext, fileRoutes);
app.use(
  '/api/hours-summary',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  hoursSummaryRoutes
);
app.use(
  '/api/import',
  authenticateToken,
  buildContext,
  importRoutes
);
app.use(
  '/api/export',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  exportRoutes
);
app.use(
  '/api/lessons',
  authenticateToken,
  buildContext,
  addSchoolYearToRequest,
  lessonRoutes
);

// Super admin routes (auth handled internally)
app.use('/api/super-admin', superAdminRoutes);

// Health check endpoints (no auth required)
app.use('/api/health', healthRoutes);

// Serve invitation acceptance page
app.get('/accept-invitation/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/accept-invitation.html'));
});

// Serve force password change page (for default password users)
app.get('/force-password-change', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/force-password-change.html'));
});

// Static files and catch-all route for production (AFTER API routes)
if (NODE_ENV === 'production') {
  // Serve static files with proper MIME types
  app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filepath) => {
      // Set correct MIME types for JavaScript modules
      if (filepath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (filepath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (filepath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      }
    }
  }));

  // Catch-all route for frontend routing - ONLY for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });
}

// Global error handler - Must come BEFORE 404 handler
app.use(errorHandler);

// 404 handler - Must come AFTER production routes and error handler
app.use((req, res) => {
  logger.debug({ method: req.method, path: req.originalUrl }, '404 Not Found')
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Improved server startup with error handling
const startServer = async () => {
  // Create the HTTP server instance separately from starting it
  const server = app.listen(PORT, HOST, async () => {
    logger.info({ host: HOST, port: PORT }, 'Server is running');

    // Initialize WebSocket and cascade system after server is running
    try {
      logger.info('Initializing WebSocket and Cascade System...');
      await cascadeSystemInitializer.initialize(server);
      logger.info('Server started with Cascade System and WebSocket enabled');
    } catch (error) {
      logger.error({ err: error.message }, 'Failed to initialize WebSocket/Cascade system');
      // Don't crash the server - continue without WebSocket
    }
  });

  // Handle port in use errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn({ port: PORT }, 'Port is already in use');

      const temp = createServer();
      temp.listen(PORT);

      temp.on('error', () => {
        logger.error({ port: PORT }, 'Port is still in use by another process');
        process.exit(1);
      });

      temp.on('listening', () => {
        logger.info({ port: PORT }, 'Found orphaned connection, cleaning up');
        temp.close();

        setTimeout(async () => {
          logger.info('Trying to restart server...');
          await startServer();
        }, 1000);
      });
    } else {
      logger.error({ err: error.message }, 'Server error');
      process.exit(1);
    }
  });

  // Handle graceful shutdown for nodemon restarts
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
};

// Start the server using our improved startup function
logger.info({ env: process.env.NODE_ENV || 'development', storageMode: process.env.STORAGE_MODE || 'local' }, 'Starting server initialization');

(async () => {
  try {
    // Validate environment variables before anything else
    validateEnvironment();

    // Initialize MongoDB with connection string
    await initializeMongoDB(process.env.MONGODB_URI);
    logger.info('MongoDB initialized successfully');

    // Start the server
    await startServer();
    logger.info('Server startup complete');
  } catch (error) {
    logger.fatal({ err: error.message }, 'Failed to initialize server');
    process.exit(1);
  }
})();

