/**
 * config/db.js
 * ------------------------------------------------------------
 * Establishes the MongoDB Atlas connection using Mongoose.
 * Exits the process on failure in production (fail fast).
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

const startMemoryServer = async () => {
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  logger.info('Started in-memory MongoDB (mongodb-memory-server)');
  return uri;
};

export const connectDB = async () => {
  let uri = config.mongoUri;

  if (uri) {
    const maxRetries = Number(process.env.MONGO_MAX_RETRIES) || 3;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10, minPoolSize: 2 });
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      } catch (error) {
        logger.warn(`MongoDB (${config.mongoUri ? 'configured URI' : 'none'}) unavailable: ${error.message}`);
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(1.5, attempt - 1);
          logger.info(`Retrying MongoDB connection in ${delay}ms... (${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (config.env === 'production') {
          logger.error('Refusing to start without a database in production after maximum retries.');
          process.exit(1);
        }
      }
    }
  }

  const memoryUri = await startMemoryServer();
  const conn = await mongoose.connect(memoryUri);
  logger.info(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

export const stopMemoryServer = async () => {
  if (memoryServer) await memoryServer.stop();
};

export default connectDB;
