/**
 * config/db.js
 * ------------------------------------------------------------
 * Establishes the MongoDB Atlas connection using Mongoose.
 * Exits the process on failure in production (fail fast).
 */
import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    if (config.env === 'production') process.exit(1);
    throw error;
  }
};

export default connectDB;
