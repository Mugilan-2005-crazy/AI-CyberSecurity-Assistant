import mongoose from 'mongoose';
import { stopMemoryServer } from '../src/config/db.js';

export default async function globalTeardown() {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  } catch (_e) {
  }
  try {
    await stopMemoryServer();
  } catch (_e) {
  }
}
