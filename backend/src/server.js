/**
 * server.js
 * ------------------------------------------------------------
 * Application entry point. Connects to MongoDB, applies the
 * multer/express-fileupload upload handling for file scans,
 * and starts listening on the configured port.
 */
import app from './app.js';
import { connectDB } from './config/db.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import User from './models/User.js';

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ email: config.admin.email });
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
  await connectDB();
  await seedAdmin();
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.env}]`);
  });
};

start().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown.
process.on('SIGINT', () => { logger.info('Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('Shutting down...'); process.exit(0); });

export default app;
