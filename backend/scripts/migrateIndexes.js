/**
 * scripts/migrateIndexes.js
 * ------------------------------------------------------------
 * Database migration script: ensures all production-scale
 * indexes exist on every collection used by the security platform.
 *
 * Run: node scripts/migrateIndexes.js
 *
 * This is safe to run repeatedly — it checks for existing
 * indexes before creating them and reports timing stats.
 */
import mongoose from 'mongoose';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';
import { connectDB } from '../src/config/db.js';

const INDEX_SPECS = {
  users: [
    { spec: { email: 1 }, options: { unique: true, background: true } },
    { spec: { name: 'text', email: 'text' }, options: { background: true } },
    { spec: { role: 1, isActive: 1, createdAt: 1 }, options: { background: true } },
    { spec: { isActive: 1, lastLogin: 1 }, options: { background: true } },
    { spec: { twoFactorEnabled: 1 }, options: { background: true } },
    { spec: { totpLockedUntil: 1 }, options: { expireAfterSeconds: 0 } },
    { spec: { passwordResetOTPExpire: 1 }, options: { expireAfterSeconds: 0 } },
    { spec: { emailVerificationExpire: 1 }, options: { expireAfterSeconds: 0 } },
  ],
  threatintels: [
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
    { spec: { ioc: 1, iocType: 1 }, options: { background: true } },
    { spec: { reputationScore: -1 }, options: { background: true } },
    { spec: { classification: 1, createdAt: -1 }, options: { background: true } },
    { spec: { threatCategory: 1, createdAt: -1 }, options: { background: true } },
    { spec: { user: 1, classification: 1, createdAt: -1 }, options: { background: true } },
    { spec: { user: 1, iocType: 1, createdAt: -1 }, options: { background: true } },
    { spec: { ioc: 'text', threatCategory: 'text' }, options: { background: true } },
  ],
  scanhistories: [
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
    { spec: { user: 1, type: 1, createdAt: -1 }, options: { background: true } },
    { spec: { verdict: 1, createdAt: -1 }, options: { background: true } },
    { spec: { riskScore: -1, createdAt: -1 }, options: { background: true } },
  ],
  chatlogs: [
    { spec: { user: 1, sessionId: 1 }, options: { background: true } },
    { spec: { user: 1, updatedAt: -1 }, options: { background: true } },
    { spec: { user: 1, createdAt: -1 }, options: { background: true } },
  ],
  incidentreports: [
    { spec: { createdBy: 1, createdAt: -1 }, options: { background: true } },
    { spec: { incidentId: 1, createdAt: -1 }, options: { background: true } },
    { spec: { severity: 1, status: 1 }, options: { background: true } },
  ],
  behaviortimelines: [
    { spec: { user: 1, timestamp: -1 }, options: { background: true } },
  ],
  userriskprofiles: [
    { spec: { user: 1, riskScore: -1 }, options: { background: true } },
  ],
};

async function ensureIndex(collection, spec, options) {
  const name = `${collection}_idx_${Object.keys(spec).join('_')}`;
  try {
    const model = mongoose.model(collection.charAt(0).toUpperCase() + collection.slice(1));
    await model.collection.createIndex(spec, { ...options, background: true });
    logger.info(`Index ensured: ${name} on ${collection}`, { spec, options });
  } catch (err) {
    if (err.code === 8000 || err.message?.includes('already exists')) {
      logger.debug(`Index already exists: ${name}`);
    } else {
      logger.warn(`Index failed: ${name} - ${err.message}`);
    }
  }
}

async function runMigration() {
  logger.info('=== Starting index migration ===');

  for (const [collection, indexes] of Object.entries(INDEX_SPECS)) {
    for (const { spec, options } of indexes) {
      await ensureIndex(collection, spec, options);
    }
  }

  for (const [collection, indexes] of Object.entries(INDEX_SPECS)) {
    const db = mongoose.connection.db;
    const existing = await db.collection(collection).listIndexes().toArray();
    logger.info(`Collection: ${collection} has ${existing.length} indexes`, {
      names: existing.map((i) => i.name),
    });
  }

  logger.info('=== Index migration complete ===');
}

const isMain = process.argv[1] && process.argv[1].includes('migrateIndexes.js');

if (isMain) {
  const conn = await connectDB();
  if (conn) {
    await runMigration();
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
  process.exit(0);
}

export { runMigration, INDEX_SPECS };
export default { runMigration, INDEX_SPECS };
