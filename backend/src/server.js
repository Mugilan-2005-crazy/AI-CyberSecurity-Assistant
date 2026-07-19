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

const start = async () => {
  await connectDB();
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
