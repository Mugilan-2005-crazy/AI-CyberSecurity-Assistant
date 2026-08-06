/**
 * scripts/migrate-language-field.js
 * ------------------------------------------------------------
 * Migration: add language field to existing User and ChatLog documents.
 * Run with: node scripts/migrate-language-field.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../src/utils/logger.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  logger.error('MONGODB_URI is required');
  process.exit(1);
}

const migrate = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB');

    const usersResult = await mongoose.connection.db.collection('users').updateMany(
      { language: { $exists: false } },
      { $set: { language: 'en' } }
    );
    logger.info(`Users migration: matched=${usersResult.matchedCount}, modified=${usersResult.modifiedCount}`);

    const chatLogsResult = await mongoose.connection.db.collection('chatlogs').updateMany(
      { language: { $exists: false } },
      { $set: { language: 'en' } }
    );
    logger.info(`ChatLogs migration: matched=${chatLogsResult.matchedCount}, modified=${chatLogsResult.modifiedCount}`);

    logger.info('Migration completed successfully');
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

migrate();
