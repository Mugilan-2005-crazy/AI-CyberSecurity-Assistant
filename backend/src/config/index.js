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
    expire: process.env.JWT_EXPIRE || '15m',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },

  clientOrigin: (() => {
    const value = process.env.CLIENT_ORIGIN;
    if (!value) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing required environment variable: CLIENT_ORIGIN');
      }
      return 'http://localhost:5173';
    }
    return value;
  })(),

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
    timeout: Number(process.env.OLLAMA_TIMEOUT) || 30000,
  },
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  virusTotal: { apiKey: process.env.VIRUSTOTAL_API_KEY || '' },
  abuseipdb: { apiKey: process.env.ABUSEIPDB_API_KEY || '', baseUrl: 'https://api.abuseipdb.com/api/v2' },
  otx: { apiKey: process.env.OTX_API_KEY || '', baseUrl: 'https://otx.alienvault.com/api/v1' },
  nvd: { apiKey: process.env.NVD_API_KEY || '', baseUrl: 'https://services.nvd.nist.gov/rest/json/cves/2.0' },

  threatIntel: {
    cacheTtl: Number(process.env.THREAT_INTEL_CACHE_TTL) || 3600000,
    requestTimeout: Number(process.env.THREAT_INTEL_TIMEOUT) || 15000,
    maxRetries: Number(process.env.THREAT_INTEL_MAX_RETRIES) || 3,
  },

  cloud: {
    scanTimeout: Number(process.env.CLOUD_SCAN_TIMEOUT) || 120000,
    maxConcurrentProviders: Number(process.env.CLOUD_MAX_CONCURRENT) || 3,
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    },
    azure: {
      tenantId: process.env.AZURE_TENANT_ID || '',
      clientId: process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || '',
      keyFile: process.env.GCP_KEY_FILE || '',
    },
    kubernetes: {
      kubeconfigPath: process.env.KUBECONFIG || '',
      inCluster: process.env.K8S_IN_CLUSTER || 'false',
      defaultNamespace: process.env.K8S_DEFAULT_NAMESPACE || 'default',
    },
    container: {
      dockerHost: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
      scanInterval: Number(process.env.CONTAINER_SCAN_INTERVAL) || 3600000,
      maxImages: Number(process.env.CONTAINER_MAX_IMAGES) || 100,
    },
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@cybersec.io',
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Super Admin',
  },

  security: {
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: Number(process.env.LOCKOUT_DURATION) || 15 * 60 * 1000,
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
