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

const startMemoryServer = async () => {
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  logger.info('Started in-memory MongoDB (mongodb-memory-server)');
  return uri;
};

export const connectDB = async () => {
  let uri = config.mongoUri;

  if (uri) {
    try {
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      logger.warn(`MongoDB (${config.mongoUri ? 'configured URI' : 'none'}) unavailable: ${error.message}`);
      if (config.env === 'production') {
        logger.error('Refusing to start without a database in production.');
        process.exit(1);
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
