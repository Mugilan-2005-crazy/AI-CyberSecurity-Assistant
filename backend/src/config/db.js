/**
 * config/db.js
 * ------------------------------------------------------------
 * Establishes the MongoDB Atlas connection using Mongoose.
 * Exits the process on failure in production (fail fast).
 *
 * Local-development fallback chain:
 *   1. Try MONGODB_URI (Atlas or custom URI).
 *   2. If that fails and we are on Windows / local dev, try
 *      mongodb://localhost:27017/cybersphere (local mongod).
 *   3. If local mongod also fails, fall back to mongodb-memory-server
 *      (only on architectures where MongoDB provides binaries).
 *   4. If memory server also fails, throw a clear error with
 *      remediation instructions instead of crashing silently.
 */
import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;

// Disable command buffering so DB operations fail fast with a clear
// error instead of silently queuing for serverSelectionTimeoutMS.
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 5000);

const isWindows = process.platform === 'win32';
const isArm64 = process.arch === 'arm64';

const startMemoryServer = async () => {
  // mongodb-memory-server does not provide Windows ARM64 binaries.
  // Skip it on that platform to avoid a hard crash and surface
  // a actionable error instead.
  if (isWindows && isArm64) {
    throw new Error(
      'mongodb-memory-server is not supported on Windows ARM64. ' +
      'Start a local mongod instance (e.g. `mongod --dbpath C:\\data\\db`) ' +
      'or use Docker: `docker run -d -p 27017:27017 mongo:7`. ' +
      'Then set MONGODB_URI=mongodb://localhost:27017/cybersphere'
    );
  }

  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  logger.info('Started in-memory MongoDB (mongodb-memory-server)');
  return uri;
};

export const connectDB = async () => {
  const triedUris = [];

  // Step 1: Try the configured MONGODB_URI.
  if (config.mongoUri) {
    const maxRetries = Number(process.env.MONGO_MAX_RETRIES) || 3;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const conn = await mongoose.connect(config.mongoUri, {
          serverSelectionTimeoutMS: 10000,
          maxPoolSize: 50,
          minPoolSize: 5,
        });
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      } catch (error) {
        logger.warn(`MongoDB (${config.mongoUri.replace(/\/\/.*@/, '//***@')}) unavailable: ${error.message}`);
        triedUris.push({ uri: config.mongoUri.replace(/\/\/.*@/, '//***@'), error: error.message });
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(1.5, attempt - 1);
          logger.info(`Retrying MongoDB connection in ${delay}ms... (${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (config.env === 'production') {
          logger.error(`MongoDB could not be reached after ${maxRetries} attempts. ` +
            'Application will run degraded instead of exiting so the HTTP ' +
            'liveness endpoint stays reachable; /ready will report not-ready.');
        }
      }
    }
  }

  // Step 2: Local-development fallback — try a local mongod instance.
  // This is the recommended path for Windows ARM64 where
  // mongodb-memory-server is not available.
  if (config.env !== 'production') {
    const localUri = 'mongodb://localhost:27017/cybersphere';
    logger.info(`Attempting local MongoDB fallback: ${localUri}`);
    try {
      const conn = await mongoose.connect(localUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 1,
      });
      logger.info(`MongoDB connected (local fallback): ${conn.connection.host}`);
      return conn;
    } catch (error) {
      logger.warn(`Local MongoDB (${localUri}) unavailable: ${error.message}`);
      triedUris.push({ uri: localUri, error: error.message });
    }

    // Step 3: Fall back to mongodb-memory-server if available.
    try {
      const memoryUri = await startMemoryServer();
      const conn = await mongoose.connect(memoryUri);
      logger.info(`MongoDB connected (in-memory): ${conn.connection.host}`);
      return conn;
    } catch (error) {
      logger.error(`In-memory MongoDB failed: ${error.message}`);
      triedUris.push({ uri: 'mongodb-memory-server', error: error.message });
    }
  }

  // Step 4: All connection attempts failed.
  const summary = triedUris.map((u) => `  - ${u.uri}: ${u.error}`).join('\n');
  const remediation =
    '\nRemediation options:\n' +
    '  1. Ensure MongoDB Atlas network access allows your IP.\n' +
    '  2. Start a local mongod: mongod --dbpath C:\\data\\db\n' +
    '  3. Use Docker: docker run -d -p 27017:27017 mongo:7\n' +
    '  4. Set MONGODB_URI to a reachable instance in .env';
  throw new Error(`All MongoDB connection attempts failed:\n${summary}${remediation}`);
};

export const stopMemoryServer = async () => {
  if (memoryServer) await memoryServer.stop();
};

export default connectDB;
