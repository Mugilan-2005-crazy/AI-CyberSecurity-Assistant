/**
 * server.js
 * ------------------------------------------------------------
 * Application entry point. Connects to MongoDB, applies the
 * multer/express-fileupload upload handling for file scans,
 * and starts listening on the configured port.
 */

import app from './app.js';
import { connectDB } from './config/db.js';
import { connectRedis, closeRedis } from './services/cache/redisClient.js';
import {
  initOpenTelemetry,
  shutdownOpenTelemetry,
} from './services/observability/opentelemetry.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import User from './models/User.js';
import {
  initSocketServer,
  closeSocketServer,
} from './socket/socketServer.js';

// --- Top-level process error guards ---
// Background async work (AI calls, scans, telemetry, socket tasks) can reject
// outside the request lifecycle. Registering handlers here prevents a single
// rejected promise from crashing the whole HTTP service and lets Railway keep
// the healthcheck alive. Uncaught exceptions are logged then exited so the
// process cannot continue in a possibly-corrupt state.
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason?.stack || reason?.message || reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err?.stack || err?.message || err}`);
  // Exit so the orchestrator can restart a potentially-corrupt process.
  process.exit(1);
});

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({
      email: config.admin.email,
    });

    if (existing) return;

    await User.create({
      name: config.admin.name,
      email: config.admin.email,
      password: config.admin.password,
      role: 'admin',
      isEmailVerified: true,
    });

    logger.info(`Admin created: ${config.admin.email}`);
  } catch (err) {
    logger.warn(`Admin seed skipped: ${err.message}`);
  }
};

const start = async () => {
  // 1. Bind the HTTP server immediately so the liveness endpoint
  //    (/api/health) is reachable as soon as the process is up — even
  //    if a dependency (MongoDB/Redis/OTel/Socket.IO) is slow or down.
  //    This keeps Railway's health endpoint available without
  //    requiring external services to be reachable first.
  const server = app.listen(config.port, () => {
    logger.info(
      `Server running on port ${config.port} [${config.env}]`
    );
  });

// 2. Attach Socket.IO to the shared HTTP server (non-blocking).
  //    A Socket.IO failure must not prevent HTTP startup, so it is
  //    wrapped and logged rather than allowed to crash the process.
  try {
    initSocketServer(server, config);
    logger.info('Socket.IO initialized');
  } catch (err) {
    logger.error(`Socket.IO init failed (continuing with HTTP only): ${err.message}`);
  }

  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, closing server...`);

    try {
      await closeSocketServer();
      logger.info('Socket.IO server closed');
    } catch (err) {
      logger.warn(`Socket.IO close error: ${err.message}`);
    }

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        const mongoose = (await import('mongoose')).default;

        if (mongoose.connection.readyState === 1) {
          await mongoose.disconnect();
          logger.info('MongoDB connection closed');
        }
      } catch (err) {
        logger.warn(`MongoDB disconnect error: ${err.message}`);
      }

      try {
        await closeRedis();
        logger.info('Redis connection closed');
      } catch (err) {
        logger.warn(`Redis disconnect error: ${err.message}`);
      }

      try {
        await shutdownOpenTelemetry();
      } catch (err) {
        logger.warn(`OpenTelemetry shutdown error: ${err.message}`);
      }

      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 3. Initialize dependencies in the background with controlled error
  //    handling. A failing optional dependency (Redis/OTel) falls back
  //    gracefully, and a MongoDB outage degrades the application
  //    (logged, /ready reports not-ready) instead of killing the process
  //    — so the HTTP liveness endpoint stays reachable for Railway.
  const initDependencies = async () => {
    try {
      await initOpenTelemetry();
    } catch (err) {
      logger.warn(`OpenTelemetry init failed (continuing): ${err.message}`);
    }

    try {
      await connectRedis();
    } catch (err) {
      logger.warn(`Redis init failed (using in-memory fallback): ${err.message}`);
    }

    try {
      await connectDB();
      await seedAdmin();
    } catch (err) {
      logger.error(`MongoDB connection failed — application degraded, /ready will report not-ready: ${err.message}`);
    }
  };

  initDependencies();
};

start().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

export default app;
