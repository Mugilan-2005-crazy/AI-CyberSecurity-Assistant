/**
 * utils/seedAdmin.js
 * ------------------------------------------------------------
 * Idempotent admin bootstrap. Run with `npm run seed` to ensure
 * a super-admin account exists (credentials from config.admin).
 * Safe to run multiple times.
 */
import connectDB from '../config/db.js';
import User from '../models/User.js';
import config from '../config/index.js';
import logger from './logger.js';

const seed = async () => {
  await connectDB();
  const existing = await User.findOne({ email: config.admin.email });
  if (existing) {
    logger.info('Admin already exists, skipping.');
    process.exit(0);
  }
  await User.create({
    name: config.admin.name,
    email: config.admin.email,
    password: config.admin.password,
    role: 'admin',
    isEmailVerified: true,
  });
  logger.info(`Admin created: ${config.admin.email}`);
  process.exit(0);
};

seed().catch((e) => { logger.error(e.message); process.exit(1); });
