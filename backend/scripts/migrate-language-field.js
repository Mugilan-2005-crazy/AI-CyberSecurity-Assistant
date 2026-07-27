/**
 * scripts/migrate-language-field.js
 * ------------------------------------------------------------
 * Migration: add language field to existing User and ChatLog documents.
 * Run with: node scripts/migrate-language-field.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const migrate = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const usersResult = await mongoose.connection.db.collection('users').updateMany(
      { language: { $exists: false } },
      { $set: { language: 'en' } }
    );
    console.log(`Users migration: matched=${usersResult.matchedCount}, modified=${usersResult.modifiedCount}`);

    const chatLogsResult = await mongoose.connection.db.collection('chatlogs').updateMany(
      { language: { $exists: false } },
      { $set: { language: 'en' } }
    );
    console.log(`ChatLogs migration: matched=${chatLogsResult.matchedCount}, modified=${chatLogsResult.modifiedCount}`);

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

migrate();
