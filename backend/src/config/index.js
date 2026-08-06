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
  const envValue = process.env[key];
  if (envValue !== undefined) return envValue;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return fallback;
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
    algorithm: 'HS256',
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
    from: process.env.EMAIL_FROM || 'Enterprise Cyber Security <no-reply@cybersec.io>',
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
    otp: {
      windowMs: Number(process.env.OTP_WINDOW_MS) || 60000,
      maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: Number(process.env.REDIS_DB) || 0,
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'csa:',
    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
    lazyConnect: true,
    retryStrategy: {
      retries: Number(process.env.REDIS_MAX_RETRIES) || 3,
      baseDelayMs: Number(process.env.REDIS_RETRY_BASE_DELAY_MS) || 100,
      maxDelayMs: Number(process.env.REDIS_RETRY_MAX_DELAY_MS) || 5000,
    },
  },

  mfa: {
    totp: {
      window: Number(process.env.MFA_TOTP_WINDOW) || 1,
      algorithm: 'sha1',
      secretEncoding: 'base32',
    },
    backupCodesCount: Number(process.env.MFA_BACKUP_CODES_COUNT) || 10,
    verificationRateLimit: Number(process.env.MFA_VERIFICATION_RATE_LIMIT) || 5,
    verificationRateWindow: Number(process.env.MFA_VERIFICATION_RATE_WINDOW) || 60000,
  },

  otel: {
    enabled: process.env.OTEL_ENABLED !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME || 'cybersec-backend',
    prometheusPort: Number(process.env.OTEL_PROMETHEUS_PORT) || 9464,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  },
};

if (!config.admin.password) {
  throw new Error('Missing required environment variable: ADMIN_PASSWORD');
}

const validateJwtSecrets = () => {
  const devSecrets = ['dev_jwt_secret', 'dev_refresh_secret'];
  if (process.env.NODE_ENV !== 'test') {
    if (devSecrets.includes(config.jwt.secret)) {
      logger.warn('SECURITY WARNING: Using default JWT_SECRET. Set a strong environment variable for production.');
    }
    if (devSecrets.includes(config.jwt.refreshSecret)) {
      logger.warn('SECURITY WARNING: Using default JWT_REFRESH_SECRET. Set a strong environment variable for production.');
    }
    if (config.jwt.secret.length < 32) {
      logger.warn('SECURITY WARNING: JWT_SECRET is less than 32 characters. Use a stronger secret.');
    }
    if (config.jwt.refreshSecret.length < 32) {
      logger.warn('SECURITY WARNING: JWT_REFRESH_SECRET is less than 32 characters. Use a stronger secret.');
    }
  }
};

validateJwtSecrets();

export default config;

const logConfig = () => {
  logger.info('=== App Configuration ===');
  logger.info('Environment', { env: config.env });
  logger.info('Ollama URL', { url: config.ollama.url });
  logger.info('Ollama Model', { model: config.ollama.model });
  logger.info('Gemini Enabled', { enabled: Boolean(config.gemini.apiKey) });
  logger.info('Redis Host', { host: config.redis.host, port: config.redis.port });
  logger.info('MFA TOTP Enabled', { enabled: true });
  logger.info('Mongo URI', { uri: config.mongoUri.replace(/\/\/.*@/, '//***@') });
};

logConfig();
