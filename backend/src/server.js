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
  // Start HTTP server FIRST so Railway healthcheck
  // can reach /api/health even if dependencies are slow.
  const server = app.listen(config.port, () => {
    logger.info(
      `Server running on port ${config.port} [${config.env}]`
    );
  });

  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Initialize OpenTelemetry
    await initOpenTelemetry();
    logger.info('OpenTelemetry initialized');

    // Seed admin user if required
    await seedAdmin();

    // Initialize Socket.IO
    initSocketServer(server, config);
    logger.info('Socket.IO initialized');
  } catch (err) {
    // Do not prevent the HTTP server from starting.
    // Railway healthcheck can still reach /api/health.
    logger.error(`Startup dependency error: ${err.message}`);
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
};

start().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

export default app;
