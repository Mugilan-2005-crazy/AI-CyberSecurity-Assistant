/**
 * config/index.js
 * ------------------------------------------------------------
 * Central configuration loader. Reads environment variables
 * once and exposes a single typed config object to the rest
 * of the application. Throws at boot if critical values are
 * missing in production so misconfiguration fails fast.
 */
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api',

  mongoUri: required('MONGODB_URI'),

  jwt: {
    secret: required('JWT_SECRET', 'dev_jwt_secret'),
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'CyberSec <no-reply@cybersec.io>',
  },

  gemini: { apiKey: process.env.GEMINI_API_KEY || '' },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1',
  },
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  virusTotal: { apiKey: process.env.VIRUSTOTAL_API_KEY || '' },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@cybersec.io',
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Super Admin',
  },
};

if (!config.admin.password) {
  throw new Error('Missing required environment variable: ADMIN_PASSWORD');
}

export default config;

const logConfig = () => {
  logger.info('=== App Configuration ===');
  logger.info('Environment', { env: config.env });
  logger.info('Ollama URL', { url: config.ollama.url });
  logger.info('Ollama Model', { model: config.ollama.model });
  logger.info('Gemini Enabled', { enabled: Boolean(config.gemini.apiKey) });
  logger.info('Mongo URI', { uri: config.mongoUri.replace(/\/\/.*@/, '//***@') });
};

logConfig();
